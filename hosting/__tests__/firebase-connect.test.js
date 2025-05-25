/**
 * FirebaseConnectクラスのユニットテスト
 * Firebase Emulatorの代わりにモックを使用
 */
require('@testing-library/jest-dom');

// Firebaseモジュールのモック
jest.mock('firebase/app');
jest.mock('firebase/database');
jest.mock('@firebase/rules-unit-testing', () => ({
  initializeTestEnvironment: jest.fn().mockImplementation(() => Promise.resolve({
    clearDatabase: jest.fn().mockResolvedValue({}),
    cleanup: jest.fn().mockResolvedValue({})
  }))
}));

describe('FirebaseConnect', () => {
  let firebaseConnect;
  
  // 各テスト前の準備
  beforeEach(() => {
    // DOMの準備
    document.body.innerHTML = `
      <div id="board"></div>
      <div id="status" class="game-status"></div>
      <div id="record" class="game-record"></div>
      <button id="create-room-button">ルーム作成</button>
      <span id="room-id-display"></span>
      <input id="join-room-input" placeholder="ルームIDを入力" />
      <button id="join-room-button">ルーム参加</button>
      <button id="end-game-button" style="display: none;">ゲーム終了</button>
      <div id="online-status">オフライン</div>
      <div id="game-start-container" style="display: none;"></div>
    `;
    
    // window.gameのモック
    window.game = {
      enableOnlineMode: jest.fn(),
      syncWithOnlineState: jest.fn()
    };
    
    // FirebaseのモックをwindowにセットアップとFirebaseConnectの初期化
    // Firebase モックを修正: database を関数として定義
    const mockRef = {
      once: jest.fn().mockImplementation(() => Promise.resolve({
        exists: () => false,
        val: () => null
      })),
      on: jest.fn(),
      set: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      child: jest.fn().mockReturnThis()
    };
    
    window.firebase = {
      initializeApp: jest.fn(),
      database: jest.fn().mockReturnValue({
        ref: jest.fn().mockReturnValue(mockRef)
      })
    };
    
    // ServerValue は database の中ではなく独立したプロパティとして定義
    window.firebase.database.ServerValue = {
      TIMESTAMP: Date.now()
    };
    
    // firebase-connect.jsの読み込みと実行
    jest.resetModules();
    require('../public/firebase-connect.js');
    
    // FirebaseConnectインスタンスへの参照を取得
    firebaseConnect = window.firebaseConnect;
    
    // ウィンドウ関数のモック
    window.alert = jest.fn();
    window.confirm = jest.fn().mockImplementation(() => true);
    window.location = { href: 'http://localhost:3000' };
  });
  
  // テスト後のクリーンアップ
  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });
  
  // ルームID生成のテスト
  test('ルームIDが正しいフォーマットで生成される', () => {
    // FirebaseConnectクラスのインスタンスメソッドにアクセス
    const roomId = firebaseConnect.generateRoomId();
    
    // ルームIDの形式を確認
    expect(typeof roomId).toBe('string');
    expect(roomId.length).toBeGreaterThanOrEqual(4);
  });
  
  // イベントリスナーの設定テスト
  test('ボタンのイベントリスナーが正しく設定される', () => {
    // setupEventListenersWhenReadyがFirebaseConnectのコンストラクタで呼ばれる
    // FirebaseConnectが既に初期化されているので、setupEventListenersも呼ばれているはず
    
    // ルーム作成ボタンにイベントリスナーが設定されているか確認
    const createRoomButton = document.getElementById('create-room-button');
    const createRoomSpy = jest.spyOn(firebaseConnect, 'createRoom');
    
    // ボタンクリックをシミュレート
    createRoomButton.click();
    
    // createRoomメソッドが呼ばれたことを確認
    expect(createRoomSpy).toHaveBeenCalled();
  });
  
  // ルーム参加のテスト
  test('ルームIDを指定してルームに参加できる', () => {
    // joinRoomメソッドのスパイを作成
    const joinRoomSpy = jest.spyOn(firebaseConnect, 'joinRoom');
    
    // 入力フィールドに値を設定し、ボタンクリックをシミュレート
    const joinRoomInput = document.getElementById('join-room-input');
    const joinRoomButton = document.getElementById('join-room-button');
    
    joinRoomInput.value = 'test-room';
    joinRoomButton.click();
    
    // joinRoomメソッドが呼ばれ、正しいルームIDが渡されたことを確認
    expect(joinRoomSpy).toHaveBeenCalledWith('test-room');
  });
  
  // 新しいルーム作成のテスト
  test('新しいルームを作成できる', async () => {
    // データベース参照のモック
    const gameRef = {
      set: jest.fn().mockResolvedValue({}),
      once: jest.fn().mockResolvedValue({ exists: () => false })
    };
    
    // ルーム作成メソッドを呼び出し
    await firebaseConnect.createNewRoom(gameRef);
    
    // setメソッドが呼ばれ、正しいパラメータが設定されていることを確認
    expect(gameRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        board: expect.any(Array),
        currentPlayer: 'black',
        gameOver: false,
        gameState: 'waiting',
        isStarted: false,
        players: expect.objectContaining({
          black: 'host',
          white: null
        })
      })
    );
    
    // ルーム作成後、window.gameのメソッドが呼ばれたことを確認
    expect(window.game.enableOnlineMode).toHaveBeenCalled();
  });
  
  // 既存のルームに参加するテスト
  test('既存のルームに参加できる', async () => {
    // 事前準備
    window.roomId = 'test-room';
    
    // ゲームデータのモック
    const gameData = {
      isStarted: false,
      gameState: 'waiting',
      board: Array(49).fill(null),
      currentPlayer: 'black'
    };
    
    // ルーム参加メソッドを呼び出し
    await firebaseConnect.joinExistingRoom(gameData);
    
    // playerRoleが設定されていることを確認
    expect(window.playerRole).toBe('white');
    
    // オンラインモードが有効化されたことを確認
    expect(window.game.enableOnlineMode).toHaveBeenCalled();
  });
  
  // 既にゲームが開始されているルームへの参加拒否テスト
  test('既に開始されているゲームには参加できない', () => {
    // ゲームデータのモック（開始済み）
    const gameData = {
      isStarted: true,
      gameState: 'playing',
      board: Array(49).fill(null),
      currentPlayer: 'black'
    };
    
    // ルーム参加メソッドを呼び出し
    firebaseConnect.joinExistingRoom(gameData);
    
    // アラートが表示されたことを確認
    expect(window.alert).toHaveBeenCalledWith('このゲームは既に開始されています。新しいルームを作成してください。');
    
    // オンラインモードが有効化されていないことを確認
    expect(window.game.enableOnlineMode).not.toHaveBeenCalled();
  });
  
  // 終了したゲームへの参加拒否テスト
  test('終了したゲームには参加できない', () => {
    // ゲームデータのモック（終了済み）
    const gameData = {
      isStarted: true,
      gameState: 'finished',
      gameOver: true,
      board: Array(49).fill(null),
      currentPlayer: 'black',
      winner: 'black'
    };
    
    // ルーム参加メソッドを呼び出し
    firebaseConnect.joinExistingRoom(gameData);
    
    // アラートが表示されたことを確認
    expect(window.alert).toHaveBeenCalledWith('このゲームは既に終了しています。新しいルームを作成してください。');
    
    // オンラインモードが有効化されていないことを確認
    expect(window.game.enableOnlineMode).not.toHaveBeenCalled();
  });
  
  // ルーム解散のテスト
  test('ルームを解散できる', async () => {
    // 事前準備
    window.roomId = 'test-room';
    
    // ルーム解散メソッドを呼び出し
    await firebaseConnect.disbandRoom();
    
    // 確認ダイアログが表示されたことを確認
    expect(window.confirm).toHaveBeenCalledWith('ゲームを終了してルームを解散しますか？');
    
    // データベース更新メソッドが正しいパラメータで呼ばれたことを確認
    expect(window.firebase.database().ref().update).toHaveBeenCalledWith(
      expect.objectContaining({
        gameState: 'finished',
        isRoomDisbanded: true,
        disbandedAt: expect.any(Number)
      })
    );
    
    // アラートが表示されたことを確認
    expect(window.alert).toHaveBeenCalledWith('ゲームを終了しました。トップページに戻ります。');
    
    // リダイレクトされることを確認
    expect(window.location.href).toBe('/');
  });
  
  // ルーム解散通知の処理テスト
  test('相手プレイヤーによるルーム解散を処理できる', () => {
    // ルーム解散通知処理メソッドを呼び出し
    firebaseConnect.handleRoomDisbanded();
    
    // アラートが表示されたことを確認
    expect(window.alert).toHaveBeenCalledWith('相手プレイヤーによってゲームが終了しました。トップページに戻ります。');
    
    // リダイレクトされることを確認
    expect(window.location.href).toBe('/');
  });
}); 
