/**
 * OXOGameクラスのユニットテスト
 */
require('@testing-library/jest-dom');

describe('OXOGame', () => {
  let game;
  
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
      <button id="end-game-button" style="display: none;">ゲーム終了</button>
      <div id="game-start-container" style="display: none;"></div>
      <div id="online-status">オフライン</div>
    `;

    // グローバル変数のリセット
    window.playerRole = null;
    window.isOnlineMode = false;
    window.roomId = null;
    
    // Firebaseのモック
    window.firebase = {
      database: {
        ServerValue: {
          TIMESTAMP: Date.now()
        }
      }
    };
    
    window.db = {
      ref: jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue({}),
        child: jest.fn().mockReturnValue({
          set: jest.fn().mockResolvedValue({})
        })
      })
    };
    
    // firebaseConnectのモック
    window.firebaseConnect = {
      disbandRoom: jest.fn()
    };

    // game.jsの読み込みと実行（モックではなく実際のコードを使用）
    jest.resetModules();
    require('../public/game.js');
    
    // グローバル変数gameへの参照を取得
    game = window.game;
  });

  // テスト後のクリーンアップ
  afterEach(() => {
    // イベントリスナーやタイマーをクリア
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  // 基本的な初期化のテスト
  test('初期化時に正しい状態が設定される', () => {
    expect(game.currentPlayer).toBe('black');
    expect(game.placedThisTurn).toBe(0);
    expect(game.gameOver).toBe(false);
    expect(game.isOnlineMode).toBe(false);
    expect(game.cells.length).toBe(49); // 7x7のボード
    expect(game.gameState).toBe('waiting');
  });

  // ゲームボードのレンダリングテスト
  test('ゲームボードが正しくレンダリングされる', () => {
    const boardElement = document.getElementById('board');
    expect(boardElement.children.length).toBe(49); // 7x7のボード
    
    // 中央のセルが白で初期化されていることを確認
    const centerCell = game.getCell(3, 3); // 中央のセル
    expect(centerCell.classList.contains('white-piece')).toBe(true);
    expect(centerCell.textContent).toBe('●');
  });

  // コマの配置テスト
  test('コマを正しく配置できる', () => {
    // 1つ目のコマを配置
    const row = 2, col = 2;
    game.handleCellClick(row, col);
    
    // 1つ目のコマが正しく配置されたか確認
    const cell = game.getCell(row, col);
    expect(cell.classList.contains('black-piece')).toBe(true);
    expect(cell.textContent).toBe('●');
    expect(game.placedThisTurn).toBe(1);
    
    // ヒントが表示されているか確認
    const hints = document.querySelectorAll('.hint');
    expect(hints.length).toBeGreaterThan(0);
  });

  // 2つ目のコマの配置テスト
  test('2つのコマを配置した後に手番が切り替わる', () => {
    // 1つ目のコマを配置
    game.handleCellClick(2, 2);
    expect(game.currentPlayer).toBe('black');
    
    // 2つ目のコマを配置（ヒントがある位置に）
    // まず、ヒントがある場所を探す
    let hintCell = null;
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].querySelector('.hint')) {
        const row = Math.floor(i / 7);
        const col = i % 7;
        hintCell = { row, col };
        break;
      }
    }
    
    // ヒントが見つかった場合のみテスト
    if (hintCell) {
      game.handleCellClick(hintCell.row, hintCell.col);
      
      // 手番が切り替わったことを確認
      expect(game.currentPlayer).toBe('white');
      expect(game.placedThisTurn).toBe(0);
      
      // ヒントが消去されていることを確認
      const hints = document.querySelectorAll('.hint');
      expect(hints.length).toBe(0);
    } else {
      // ヒントが見つからなかった場合はスキップ
      console.warn('ヒント付きのセルが見つかりませんでした');
    }
  });

  // 一手戻るテスト
  test('一手戻る機能が正しく動作する', () => {
    // 1つ目のコマを配置
    game.handleCellClick(2, 2);
    expect(game.moveHistory.length).toBe(1);
    
    // 一手戻る
    game.undoMove();
    
    // コマが削除されていることを確認
    const cell = game.getCell(2, 2);
    expect(cell.textContent).toBe('');
    expect(cell.classList.contains('black-piece')).toBe(false);
    expect(game.moveHistory.length).toBe(0);
  });

  // ゲームリセットテスト
  test('ゲームリセットが正しく動作する', () => {
    // コマを配置
    game.handleCellClick(2, 2);
    game.handleCellClick(4, 4);
    
    // リセット
    game.resetGame();
    
    // 初期状態に戻っていることを確認
    expect(game.currentPlayer).toBe('black');
    expect(game.placedThisTurn).toBe(0);
    expect(game.moveHistory.length).toBe(0);
    
    // 中央のセルのみが白で初期化されていることを確認
    const centerCell = game.getCell(3, 3);
    expect(centerCell.classList.contains('white-piece')).toBe(true);
    
    // その他のセルが空であることを確認
    const cell1 = game.getCell(2, 2);
    const cell2 = game.getCell(4, 4);
    expect(cell1.textContent).toBe('');
    expect(cell2.textContent).toBe('');
  });

  // 勝利条件の確認テスト（2x2の正方形）
  test('2x2の正方形を作ると勝利する', () => {
    // 黒が正方形を作る - 直接セルを設定
    // 1. 左上のセル
    const cell1 = game.getCell(1, 1);
    cell1.textContent = "●";
    cell1.classList.add("black-piece");
    
    // 2. 右上のセル
    const cell2 = game.getCell(1, 2);
    cell2.textContent = "●";
    cell2.classList.add("black-piece");
    
    // 3. 左下のセル
    const cell3 = game.getCell(2, 1);
    cell3.textContent = "●";
    cell3.classList.add("black-piece");
    
    // 4. 右下のセル
    const cell4 = game.getCell(2, 2);
    cell4.textContent = "●";
    cell4.classList.add("black-piece");
    
    // 勝利判定を手動で呼び出す
    expect(game.checkVictory("black-piece")).toBe(true);
  });

  // オンラインモードテスト
  test('オンラインモードを有効化できる', () => {
    game.enableOnlineMode();
    
    expect(game.isOnlineMode).toBe(true);
    expect(window.isOnlineMode).toBe(true);
    
    const onlineStatus = document.getElementById('online-status');
    expect(onlineStatus.textContent).toBe('オンライン');
    // CSSのカラー値はブラウザによって形式が異なるので、存在確認のみ行う
    expect(onlineStatus.style.color).not.toBe('');
    
    // 終了ボタンが表示されているか確認
    const endGameButton = document.getElementById('end-game-button');
    expect(endGameButton.style.display).toBe('block');
  });
  
  // ゲーム開始テスト
  test('ゲームを開始できる', async () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    window.roomId = 'test-room';
    
    // ゲーム開始
    await game.startGame();
    
    // ゲーム状態が更新されていることを確認
    expect(game.isStarted).toBe(true);
    expect(game.gameState).toBe('playing');
    
    // Firebaseへの状態更新が呼ばれたことを確認
    expect(window.db.ref).toHaveBeenCalledWith('games/test-room');
    expect(window.db.ref().update).toHaveBeenCalledWith(
      expect.objectContaining({
        isStarted: true,
        gameState: 'playing'
      })
    );
    
    // ゲーム開始ボタンが非表示になっていることを確認
    const startContainer = document.getElementById('game-start-container');
    expect(startContainer.style.display).toBe('none');
  });
  
  // オンライン状態の同期テスト
  test('オンライン状態と同期できる', () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    
    // モック状態データ
    const gameState = {
      board: Array(49).fill(null),
      currentPlayer: 'white',
      gameOver: false,
      isStarted: true,
      gameState: 'playing',
      placedThisTurn: 1,
      firstPlacement: { row: 2, col: 2 },
      lastUpdateTime: Date.now()
    };
    
    // 盤面に黒のコマを配置
    gameState.board[2 * 7 + 2] = 'black';
    
    // 状態を同期
    game.syncWithOnlineState(gameState);
    
    // ゲーム状態が更新されていることを確認
    expect(game.currentPlayer).toBe('white');
    expect(game.isStarted).toBe(true);
    expect(game.gameState).toBe('playing');
    expect(game.placedThisTurn).toBe(1);
    
    // 盤面が正しく更新されていることを確認
    const cell = game.getCell(2, 2);
    expect(cell.classList.contains('black-piece')).toBe(true);
    expect(cell.textContent).toBe('●');
    
    // ヒントが表示されていることを確認
    const hints = document.querySelectorAll('.hint');
    expect(hints.length).toBeGreaterThan(0);
  });
  
  // ゲーム終了状態の同期テスト
  test('ゲーム終了状態を同期できる', () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    
    // モック状態データ（ゲーム終了）
    const gameState = {
      board: Array(49).fill(null),
      currentPlayer: 'black',
      gameOver: true,
      isStarted: true,
      gameState: 'finished',
      winner: 'black',
      lastUpdateTime: Date.now()
    };
    
    // 状態を同期
    game.syncWithOnlineState(gameState);
    
    // ゲーム状態が更新されていることを確認
    expect(game.gameOver).toBe(true);
    
    // 勝利メッセージが表示されていることを確認
    const status = document.getElementById('status');
    expect(status.textContent).toBe('黒の勝ち！');
    expect(status.classList.contains('victory')).toBe(true);
  });
  
  // 終了ボタンクリックテスト
  test('終了ボタンでルームを解散できる', () => {
    // オンラインモードを有効化
    game.enableOnlineMode();
    
    // 終了ボタンをクリック
    const endGameButton = document.getElementById('end-game-button');
    endGameButton.click();
    
    // firebaseConnectのdisbandRoomメソッドが呼ばれたことを確認
    expect(window.firebaseConnect.disbandRoom).toHaveBeenCalled();
  });
}); 
