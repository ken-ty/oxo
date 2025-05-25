/**
 * Firebase連携とリアルタイム同期のテスト
 * 盤面操作からFirebase更新、そして相手プレイヤーへの反映までを検証
 */
require('@testing-library/jest-dom');

// Firebaseモジュールのモック
jest.mock('firebase/app');
jest.mock('firebase/database');

describe('Firebase同期テスト', () => {
  let game;
  let OXOGame; // クラス参照用変数
  let mockFirebaseDB;
  let mockSnapshot;
  let updateCallData;
  
  // 各テスト前の準備
  beforeEach(() => {
    // DOMの準備
    document.body.innerHTML = `
      <div id="board"></div>
      <div id="status" class="game-status"></div>
      <div id="record" class="game-record"></div>
      <button id="undo-button">待った</button>
      <button id="reset-button">リセット</button>
      <button id="start-game-button">ゲームを開始</button>
      <button id="create-room-button">ルーム作成</button>
      <span id="room-id-display"></span>
      <input id="join-room-input" placeholder="ルームIDを入力" />
      <button id="join-room-button">ルーム参加</button>
      <button id="end-game-button" style="display: none;">ゲーム終了</button>
      <div id="online-status">オフライン</div>
      <div id="game-start-container" style="display: none;"></div>
    `;
    
    // モックコールバック関数
    updateCallData = null;
    
    // Firebaseのモック
    mockSnapshot = {
      val: jest.fn()
    };
    
    mockFirebaseDB = {
      ref: jest.fn().mockReturnValue({
        update: jest.fn().mockImplementation((data) => {
          // 更新データを保存
          updateCallData = data;
          return Promise.resolve();
        }),
        on: jest.fn().mockImplementation((event, callback) => {
          // 'on'メソッドの呼び出しを保存して後で手動で呼び出せるようにする
          mockFirebaseDB.triggerCallback = (data) => {
            mockSnapshot.val.mockReturnValue(data);
            callback(mockSnapshot);
          };
        }),
        child: jest.fn().mockReturnThis(),
        set: jest.fn().mockResolvedValue({})
      })
    };
    
    // window.dbをモック
    window.db = mockFirebaseDB;
    
    // オンラインモード用の設定
    window.roomId = 'test-room-id';
    window.isOnlineMode = false;
    window.playerRole = null;
    
    window.firebase = {
      database: {
        ServerValue: {
          TIMESTAMP: Date.now()
        }
      }
    };
    
    // ゲームモジュールを読み込み
    jest.resetModules();
    require('../public/game.js');
    
    // ゲームインスタンスへの参照を取得
    game = window.game;
    // OXOGameクラスのコンストラクタをキャプチャ
    OXOGame = game.constructor;
  });
  
  // テスト後のクリーンアップ
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });
  
  // セル操作からFirebase更新までのテスト
  test('盤面をタップしたらFirebaseに状態が保存される', () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    game.isStarted = true;
    game.gameState = 'playing';
    window.playerRole = 'black';
    
    // Firebaseの参照が正しく設定されていることを確認
    expect(window.db.ref).toHaveBeenCalledTimes(0);
    
    // 盤面のセルをクリック
    game.handleCellClick(1, 1);
    
    // Firebaseへの更新が呼ばれたことを確認
    expect(window.db.ref).toHaveBeenCalledWith(`games/${window.roomId}`);
    expect(updateCallData).not.toBeNull();
    
    // 更新データに正しい情報が含まれていることを確認
    expect(updateCallData).toHaveProperty('board');
    expect(updateCallData).toHaveProperty('currentPlayer', 'black');
    expect(updateCallData).toHaveProperty('placedThisTurn', 1);
    expect(updateCallData).toHaveProperty('firstPlacement');
    
    // 盤面データに正しく石が配置されていることを確認
    const boardState = updateCallData.board;
    expect(boardState[1 * 7 + 1]).toBe('black');
  });
  
  // Firebase更新からDOM更新までのテスト
  test('Firebaseからの更新が盤面に反映される', () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    game.isStarted = true;
    game.gameState = 'playing';
    window.playerRole = 'white'; // 白プレイヤーとして設定
    
    // Firebase上のゲーム状態をモック
    const mockGameState = {
      board: Array(49).fill(null),
      currentPlayer: 'black',
      gameOver: false,
      isStarted: true,
      gameState: 'playing',
      placedThisTurn: 1,
      firstPlacement: { row: 2, col: 2 },
      lastUpdateTime: Date.now()
    };
    
    // 黒の石を配置
    mockGameState.board[2 * 7 + 2] = 'black';
    
    // リスナーをセットアップ
    const gameRef = window.db.ref(`games/${window.roomId}`);
    gameRef.on('value', (snapshot) => {
      const gameData = snapshot.val();
      if (gameData) {
        game.syncWithOnlineState(gameData);
      }
    });
    
    // Firebaseからの更新をシミュレート
    mockFirebaseDB.triggerCallback(mockGameState);
    
    // 盤面が更新されていることを確認
    const cell = game.getCell(2, 2);
    expect(cell.classList.contains('black-piece')).toBe(true);
    expect(cell.textContent).toBe('●');
    
    // ゲーム状態が更新されていることを確認
    expect(game.currentPlayer).toBe('black');
    expect(game.placedThisTurn).toBe(1);
    expect(game.firstPlacement).toEqual({ row: 2, col: 2 });
    
    // ヒントが表示されていることを確認
    const hints = document.querySelectorAll('.hint');
    expect(hints.length).toBeGreaterThan(0);
  });
  
  // 完全な対局シミュレーション - 簡略化バージョン
  test('盤面操作の変更が他のプレイヤーに反映される', () => {
    // 1. 黒プレイヤー（ホスト）のセットアップ
    game.enableOnlineMode();
    game.isStarted = true;
    game.gameState = 'playing';
    window.playerRole = 'black';
    
    // 2. モックデータを直接設定
    const initialBoard = Array(49).fill(null);
    initialBoard[24] = 'white'; // 中央に白を配置
    
    // 3. 更新データをシミュレート - 黒が1つ目のコマを配置
    const firstUpdateData = {
      board: [...initialBoard],
      currentPlayer: 'black',
      gameOver: false,
      isStarted: true,
      gameState: 'playing',
      placedThisTurn: 1,
      firstPlacement: { row: 1, col: 1 },
      lastUpdateTime: Date.now()
    };
    
    // 黒のコマを配置
    firstUpdateData.board[1 * 7 + 1] = 'black';
    
    // 4. 白プレイヤー側でのデータ受信をシミュレート
    const whitePlayerGame = new OXOGame();
    whitePlayerGame.enableOnlineMode();
    whitePlayerGame.isStarted = true;
    whitePlayerGame.gameState = 'playing';
    window.playerRole = 'white';
    
    // 5. 黒プレイヤーの更新を白プレイヤーに反映
    whitePlayerGame.syncWithOnlineState(firstUpdateData);
    
    // 6. 白プレイヤー側で盤面が更新されていることを確認
    let cell = whitePlayerGame.getCell(1, 1);
    expect(cell.classList.contains('black-piece')).toBe(true);
    
    // 7. 2回目の更新データをシミュレート - 黒が2つ目のコマを配置して手番が白に
    const secondUpdateData = {
      board: [...firstUpdateData.board],
      currentPlayer: 'white', // 手番が白に変わる
      gameOver: false,
      isStarted: true,
      gameState: 'playing',
      placedThisTurn: 0, // リセットされる
      firstPlacement: null, // リセットされる
      lastUpdateTime: Date.now() + 1000 // 1秒後の更新
    };
    
    // 黒の2つ目のコマを配置（対称位置）
    secondUpdateData.board[5 * 7 + 5] = 'black';
    
    // 8. 白プレイヤー側でのデータ受信をシミュレート
    whitePlayerGame.syncWithOnlineState(secondUpdateData);
    
    // 9. 白プレイヤー側で盤面が正しく更新されていることを確認
    cell = whitePlayerGame.getCell(5, 5);
    expect(cell.classList.contains('black-piece')).toBe(true);
    
    // 10. 手番が白に切り替わっていることを確認
    expect(whitePlayerGame.currentPlayer).toBe('white');
    expect(whitePlayerGame.placedThisTurn).toBe(0);
  });
  
  // Firebaseがオブジェクトとして送信した配列データの処理テスト
  test('Firebaseからオブジェクト形式で送られてきた盤面データを正しく処理できる', () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    game.isStarted = true;
    game.gameState = 'playing';
    window.playerRole = 'white'; // 白プレイヤーとして設定
    
    // Firebase上のゲーム状態をモック（オブジェクト形式の盤面データ）
    const mockGameState = {
      // オブジェクト形式の盤面データ（配列ではない）
      board: {
        '0': null, '1': null, '2': null, '3': null, '4': null, '5': null, '6': null,
        '7': null, '8': null, '9': null, '10': null, '11': null, '12': null, '13': null,
        '14': null, '15': null, '16': 'black', '17': null, '18': null, '19': null, '20': null,
        '21': null, '22': null, '23': null, '24': 'white', '25': null, '26': null, '27': null,
        '28': null, '29': null, '30': null, '31': null, '32': null, '33': null, '34': null,
        '35': null, '36': null, '37': null, '38': null, '39': null, '40': null, '41': null,
        '42': null, '43': null, '44': null, '45': null, '46': null, '47': null, '48': null
      },
      currentPlayer: 'black',
      gameOver: false,
      isStarted: true,
      gameState: 'playing',
      placedThisTurn: 1,
      firstPlacement: { row: 2, col: 2 },
      lastUpdateTime: Date.now()
    };
    
    // リスナーをセットアップ
    const gameRef = window.db.ref(`games/${window.roomId}`);
    gameRef.on('value', (snapshot) => {
      const gameData = snapshot.val();
      if (gameData) {
        game.syncWithOnlineState(gameData);
      }
    });
    
    // Firebaseからの更新をシミュレート
    mockFirebaseDB.triggerCallback(mockGameState);
    
    // 盤面が更新されていることを確認
    // 黒のコマが配置されている位置（16 = 2行 * 7 + 2列）
    const blackCell = game.getCell(2, 2);
    expect(blackCell.classList.contains('black-piece')).toBe(true);
    expect(blackCell.textContent).toBe('●');
    
    // 白のコマが配置されている位置（24 = 3行 * 7 + 3列、中央）
    const whiteCell = game.getCell(3, 3);
    expect(whiteCell.classList.contains('white-piece')).toBe(true);
    expect(whiteCell.textContent).toBe('●');
    
    // ゲーム状態が更新されていることを確認
    expect(game.currentPlayer).toBe('black');
    expect(game.placedThisTurn).toBe(1);
    expect(game.firstPlacement).toEqual({ row: 2, col: 2 });
  });
  
  // 盤面専用の更新処理テスト
  test('盤面専用の更新処理が正しく機能する', () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    game.isStarted = true;
    game.gameState = 'playing';
    window.playerRole = 'white';
    
    // 初期状態の盤面をクリア
    game.cells.forEach(cell => {
      cell.textContent = '';
      cell.classList.remove('black-piece', 'white-piece');
    });
    
    // 中央のコマだけを再配置（初期状態）
    const centerCell = game.getCell(3, 3);
    centerCell.textContent = '●';
    centerCell.classList.add('white-piece');
    
    // 盤面データ（配列形式）
    const boardData = Array(49).fill(null);
    boardData[3 * 7 + 3] = 'white'; // 中央の白
    boardData[1 * 7 + 1] = 'black'; // (1,1)に黒
    boardData[5 * 7 + 5] = 'black'; // (5,5)に黒
    
    // updateBoardOnlyメソッドを呼び出す
    game.updateBoardOnly(boardData);
    
    // 盤面が正しく更新されていることを確認
    expect(centerCell.classList.contains('white-piece')).toBe(true);
    
    // 黒のコマが正しく配置されているか確認
    const blackCell1 = game.getCell(1, 1);
    expect(blackCell1.classList.contains('black-piece')).toBe(true);
    expect(blackCell1.textContent).toBe('●');
    
    const blackCell2 = game.getCell(5, 5);
    expect(blackCell2.classList.contains('black-piece')).toBe(true);
    expect(blackCell2.textContent).toBe('●');
    
    // ゲームの状態は変更されていないことを確認
    expect(game.currentPlayer).toBe('black'); // デフォルト値
    expect(game.placedThisTurn).toBe(0);      // デフォルト値
  });
  
  // オブジェクト形式での盤面専用更新テスト
  test('オブジェクト形式の盤面データでも盤面専用の更新処理が機能する', () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    game.isStarted = true;
    game.gameState = 'playing';
    window.playerRole = 'white';
    
    // 初期状態の盤面をクリア
    game.cells.forEach(cell => {
      cell.textContent = '';
      cell.classList.remove('black-piece', 'white-piece');
    });
    
    // 盤面データ（オブジェクト形式）- 正しいインデックス計算
    // 7x7の盤面では: row*7 + col がインデックス
    // (3,3) = 3*7+3 = 24
    // (1,1) = 1*7+1 = 8
    // (5,5) = 5*7+5 = 40
    const boardData = {
      '24': 'white', // 中央の白 (3*7+3)
      '8': 'black',  // (1,1)に黒 (1*7+1)
      '40': 'black'  // (5,5)に黒 (5*7+5)
    };
    
    // updateBoardOnlyメソッドを呼び出す
    game.updateBoardOnly(boardData);
    
    // すべてのセルを表示（デバッグ用）
    console.log('すべてのセルの状態:');
    game.cells.forEach((cell, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const hasBlack = cell.classList.contains('black-piece');
      const hasWhite = cell.classList.contains('white-piece');
      if (hasBlack || hasWhite) {
        console.log(`インデックス ${index} (${row},${col}): ${hasBlack ? '黒' : ''}${hasWhite ? '白' : ''}`);
      }
    });
    
    // 盤面が正しく更新されていることを確認 - 手動でインデックスを確認
    const centerCell = game.getCell(3, 3);
    expect(centerCell.classList.contains('white-piece')).toBe(true);
    
    // 黒のコマが正しく配置されているか確認
    const blackCell1 = game.getCell(1, 1);
    expect(blackCell1.classList.contains('black-piece')).toBe(true);
    
    const blackCell2 = game.getCell(5, 5);
    expect(blackCell2.classList.contains('black-piece')).toBe(true);
  });
}); 
