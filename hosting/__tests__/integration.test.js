/**
 * OXOゲームの結合テスト
 * ゲームロジックとFirebase連携を総合的にテスト
 */
require('@testing-library/jest-dom');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');

describe('OXOゲーム 結合テスト', () => {
  let testEnv;
  let game;
  let firebaseConnect;
  
  // テスト環境のセットアップ
  beforeAll(async () => {
    // Firebase Emulator用のテスト環境を初期化
    testEnv = await initializeTestEnvironment({
      projectId: 'test-oxo-game',
      database: {
        host: 'localhost',
        port: 9000,
      }
    });
    
    // データベースをクリア
    await testEnv.clearDatabase();
  });
  
  // テスト環境のクリーンアップ
  afterAll(async () => {
    await testEnv.cleanup();
  });
  
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
      <div id="online-status">オフライン</div>
      <div id="game-start-container" style="display: none;"></div>
    `;
    
    // FirebaseのモックをwindowにセットアップとFirebaseConnectの初期化
    window.firebase = {
      initializeApp: jest.fn(),
      database: jest.fn().mockReturnValue({
        ref: jest.fn().mockReturnThis(),
        once: jest.fn().mockImplementation(() => Promise.resolve({
          exists: () => false,
          val: () => null
        })),
        on: jest.fn(),
        set: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        child: jest.fn().mockReturnThis()
      })
    };
    
    // Firebaseコネクトモジュールを読み込み
    jest.resetModules();
    require('../public/firebase-connect.js');
    
    // FirebaseConnectインスタンスへの参照を取得
    firebaseConnect = window.firebaseConnect;
    
    // ゲームモジュールを読み込み
    require('../public/game.js');
    
    // ゲームインスタンスへの参照を取得
    game = window.game;
  });
  
  // テスト後のクリーンアップ
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });
  
  // オンラインモードでのゲームフローをテスト
  test('オンラインモードでルーム作成からゲーム開始までの流れ', async () => {
    // ルーム作成ボタンをクリック
    const createRoomButton = document.getElementById('create-room-button');
    createRoomButton.click();
    
    // roomIdがセットされ、ディスプレイに表示されることを確認
    expect(window.roomId).not.toBeNull();
    
    // オンラインモードが有効化されていることを確認
    expect(game.isOnlineMode).toBe(true);
    
    // ゲーム開始ボタンが表示されていることを確認
    const startContainer = document.getElementById('game-start-container');
    expect(startContainer.style.display).toBe('block');
    
    // ゲーム開始ボタンをクリック
    const startGameButton = document.getElementById('start-game-button');
    startGameButton.click();
    
    // ステータスが更新されていることを確認
    const status = document.getElementById('status');
    expect(status.textContent).not.toBe('');
  });
  
  // オンラインモードでの対局をシミュレート
  test('オンラインモードで対局シミュレーション', async () => {
    // ルーム作成と参加（モック）
    window.roomId = 'test-room-id';
    window.playerRole = 'black';
    game.enableOnlineMode();
    game.isStarted = true;
    
    // 黒プレイヤー（自分）のコマを配置
    game.handleCellClick(1, 1);
    
    // Firebaseへの状態保存が呼ばれたことを確認
    expect(window.firebase.database().ref().update).toHaveBeenCalled();
    
    // 2つ目のコマを配置（ヒントがある位置に）
    let hintCell = null;
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].querySelector('.hint')) {
        const row = Math.floor(i / 7);
        const col = i % 7;
        hintCell = { row, col };
        break;
      }
    }
    
    if (hintCell) {
      game.handleCellClick(hintCell.row, hintCell.col);
      
      // 手番が切り替わったことを確認
      expect(game.currentPlayer).toBe('white');
      
      // Firebaseへの状態保存が再度呼ばれたことを確認
      expect(window.firebase.database().ref().update).toHaveBeenCalledTimes(2);
    }
  });
  
  // オンラインモードでの勝利条件チェック
  test('オンラインモードでの勝利', async () => {
    // ルーム作成と参加（モック）
    window.roomId = 'test-room-id';
    window.playerRole = 'black';
    game.enableOnlineMode();
    game.isStarted = true;
    
    // 黒が正方形を作る
    // 1手目
    game.handleCellClick(1, 1); // 左上
    
    // ヒントがある位置に2つ目のコマを置く
    let hintCell = null;
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].querySelector('.hint')) {
        const row = Math.floor(i / 7);
        const col = i % 7;
        if (row === 1 && col === 2) { // 右上を選択
          hintCell = { row, col };
          break;
        }
      }
    }
    
    if (hintCell) {
      game.handleCellClick(hintCell.row, hintCell.col);
    }
    
    // 2手目
    game.handleCellClick(2, 1); // 左下
    
    // ヒントがある位置に2つ目のコマを置く
    hintCell = null;
    for (let i = 0; i < game.cells.length; i++) {
      if (game.cells[i].querySelector('.hint')) {
        const row = Math.floor(i / 7);
        const col = i % 7;
        if (row === 2 && col === 2) { // 右下を選択
          hintCell = { row, col };
          break;
        }
      }
    }
    
    if (hintCell) {
      game.handleCellClick(hintCell.row, hintCell.col);
      
      // 勝利条件が満たされたことを確認
      expect(game.gameOver).toBe(true);
      
      // 勝利状態がFirebaseに保存されたことを確認
      expect(window.firebase.database().ref().update).toHaveBeenCalledWith(
        expect.objectContaining({
          gameOver: true
        })
      );
    }
  });
}); 
