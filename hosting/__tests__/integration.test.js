/**
 * OXOゲームの結合テスト
 * ゲームロジックとFirebase連携を総合的にテスト（モック版）
 */
require('@testing-library/jest-dom');

// Firebase Emulatorの代わりにモックを使用する
jest.mock('@firebase/rules-unit-testing', () => ({
  initializeTestEnvironment: jest.fn().mockImplementation(() => Promise.resolve({
    clearDatabase: jest.fn().mockResolvedValue({}),
    cleanup: jest.fn().mockResolvedValue({})
  }))
}));

// モジュールのモック
jest.mock('../public/firebase-connect.js', () => {
  // FirebaseConnectクラスのモック実装
  class MockFirebaseConnect {
    constructor() {
      // windowへの直接参照をmock接頭辞付きの変数に変更
      this.mockDb = {
        ref: jest.fn().mockReturnThis(),
        once: jest.fn().mockResolvedValue({
          exists: () => false,
          val: () => null
        }),
        on: jest.fn(),
        set: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        child: jest.fn().mockReturnThis()
      };
      
      this.setupEventListeners();
    }
    
    setupEventListeners() {
      // この関数はJestのモックが呼び出すので、DOMがない可能性があるため安全に実装
      const mockSetupListeners = () => {
        const createRoomButton = document.getElementById('create-room-button');
        if (createRoomButton) {
          createRoomButton.addEventListener('click', () => this.createRoom());
        }
        
        const joinRoomButton = document.getElementById('join-room-button');
        const joinRoomInput = document.getElementById('join-room-input');
        
        if (joinRoomButton && joinRoomInput) {
          joinRoomButton.addEventListener('click', () => {
            this.joinRoom(joinRoomInput.value.trim());
          });
        }
        
        const endGameButton = document.getElementById('end-game-button');
        if (endGameButton) {
          endGameButton.addEventListener('click', () => this.disbandRoom());
        }
      };
      
      // テスト環境でDOMが準備できているときだけ実行
      if (typeof document !== 'undefined') {
        mockSetupListeners();
      }
    }
    
    generateRoomId() {
      return 'test-room-id';
    }
    
    createRoom() {
      const roomId = this.generateRoomId();
      this.joinRoom(roomId);
    }
    
    joinRoom(roomId) {
      // グローバル変数への代入を避ける
      this.roomId = roomId;
      
      const roomIdDisplay = document.getElementById('room-id-display');
      if (roomIdDisplay) {
        roomIdDisplay.textContent = roomId;
      }
      
      this.createNewRoom();
      this.setupGameListener(roomId);
    }
    
    createNewRoom() {
      // グローバル変数への代入を避ける
      this.playerRole = 'black';
      
      // windowへの参照を避ける
      const mockGame = global.game;
      if (mockGame && typeof mockGame.enableOnlineMode === 'function') {
        mockGame.enableOnlineMode();
      }
      
      const startContainer = document.getElementById('game-start-container');
      if (startContainer) startContainer.style.display = 'block';
    }
    
    joinExistingRoom(gameData) {
      // グローバル変数への代入を避ける
      this.playerRole = 'white';
      
      // windowへの参照を避ける
      const mockGame = global.game;
      if (mockGame && typeof mockGame.enableOnlineMode === 'function') {
        mockGame.enableOnlineMode();
      }
    }
    
    setupGameListener(roomId) {
      // リスナー設定のモック
    }
    
    disbandRoom() {
      const mockConfirm = global.confirm;
      const mockDb = this.mockDb;
      
      if (mockConfirm && mockConfirm('ゲームを終了してルームを解散しますか？')) {
        mockDb.ref().update({
          gameState: 'finished',
          isRoomDisbanded: true,
          disbandedAt: Date.now()
        });
        
        const mockAlert = global.alert;
        if (mockAlert) mockAlert('ゲームを終了しました。トップページに戻ります。');
      }
    }
    
    handleRoomDisbanded() {
      const mockAlert = global.alert;
      if (mockAlert) mockAlert('相手プレイヤーによってゲームが終了しました。トップページに戻ります。');
    }
  }
  
  // モジュールエクスポート
  return {
    MockFirebaseConnect
  };
}, { virtual: true });

describe('OXOゲーム 結合テスト', () => {
  let game;
  let mockFirebaseConnect;
  
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
    
    // グローバル変数の設定
    global.firebase = {
      database: {
        ServerValue: {
          TIMESTAMP: Date.now()
        }
      }
    };
    
    // モックデータベース参照
    global.db = {
      ref: jest.fn().mockReturnValue({
        update: jest.fn().mockResolvedValue({}),
        child: jest.fn().mockReturnValue({
          set: jest.fn().mockResolvedValue({})
        })
      })
    };
    
    // ウィンドウ関数のモック
    global.alert = jest.fn();
    global.confirm = jest.fn().mockImplementation(() => true);
    
    // FirebaseConnectモックのインスタンスを作成
    const { MockFirebaseConnect } = require('../public/firebase-connect.js');
    mockFirebaseConnect = new MockFirebaseConnect();
    global.firebaseConnect = mockFirebaseConnect;
    
    // ゲームモジュールを読み込み
    jest.resetModules();
    require('../public/game.js');
    
    // ゲームインスタンスへの参照を取得
    game = global.game;
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
    expect(global.roomId).toBe('test-room-id');
    
    // オンラインモードが有効化されていることを確認
    expect(game.isOnlineMode).toBe(true);
    
    // ゲーム開始ボタンが表示されていることを確認
    const startContainer = document.getElementById('game-start-container');
    expect(startContainer.style.display).toBe('block');
    
    // ゲーム開始ボタンをクリック
    const startGameButton = document.getElementById('start-game-button');
    startGameButton.click();
    
    // ゲーム状態が更新されていることを確認
    expect(game.isStarted).toBe(true);
    expect(game.gameState).toBe('playing');
    
    // Firebaseへの状態更新が呼ばれたことを確認
    expect(global.db.ref).toHaveBeenCalledWith(expect.stringContaining('games/'));
  });
  
  // オンラインモードでの対局をシミュレート
  test('オンラインモードで対局シミュレーション', async () => {
    // ルーム作成と参加（モック）
    global.roomId = 'test-room-id';
    global.playerRole = 'black';
    game.enableOnlineMode();
    game.isStarted = true;
    game.gameState = 'playing';
    
    // 黒プレイヤー（自分）のコマを配置
    game.handleCellClick(1, 1);
    
    // Firebaseへの状態保存が呼ばれたことを確認
    expect(global.db.ref).toHaveBeenCalledWith(expect.stringContaining('games/test-room-id'));
    
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
    }
  });
  
  // オンラインモードでの勝利条件チェック
  test('オンラインモードでの勝利', async () => {
    // ルーム作成と参加（モック）
    global.roomId = 'test-room-id';
    global.playerRole = 'black';
    game.enableOnlineMode();
    game.isStarted = true;
    game.gameState = 'playing';
    
    // 黒が正方形を作る - 直接セルを設定
    // 左上
    game.getCell(1, 1).textContent = "●";
    game.getCell(1, 1).classList.add("black-piece");
    
    // 右上
    game.getCell(1, 2).textContent = "●";
    game.getCell(1, 2).classList.add("black-piece");
    
    // 左下
    game.getCell(2, 1).textContent = "●";
    game.getCell(2, 1).classList.add("black-piece");
    
    // 右下をクリックして勝利条件を満たす
    game.currentPlayer = 'black';
    game.handleCellClick(2, 2);
    
    // 勝利状態になっていることを確認
    expect(game.gameOver).toBe(true);
    expect(game.gameState).toBe('finished');
    
    // ステータスが勝利表示になっていることを確認
    const status = document.getElementById('status');
    expect(status.textContent).toBe('黒の勝ち！');
    expect(status.classList.contains('victory')).toBe(true);
  });
}); 
