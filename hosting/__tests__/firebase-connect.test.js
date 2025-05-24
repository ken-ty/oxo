/**
 * FirebaseConnectクラスのユニットテスト
 * Firebase Emulatorを使用
 */
require('@testing-library/jest-dom');
const firebase = require('firebase/app');
const { getDatabase, ref, set, get } = require('firebase/database');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');

describe('FirebaseConnect', () => {
  let firebaseConnect;
  let testEnv;
  
  // テスト環境のセットアップ
  beforeAll(async () => {
    // Firebase Emulator用のテスト環境を初期化
    testEnv = await initializeTestEnvironment({
      projectId: 'test-oxo-game',
      database: {
        host: 'localhost',
        port: 9000, // デフォルトのEmulator port
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
      <button id="create-room-button">ルーム作成</button>
      <span id="room-id-display"></span>
      <input id="join-room-input" placeholder="ルームIDを入力" />
      <button id="join-room-button">ルーム参加</button>
      <div id="online-status">オフライン</div>
      <div id="game-start-container" style="display: none;"></div>
    `;
    
    // window.gameのモック
    window.game = {
      enableOnlineMode: jest.fn(),
      syncWithOnlineState: jest.fn()
    };
    
    // FirebaseのモックをwindowにセットアップとFirebaseConnectの初期化
    window.firebase = {
      initializeApp: jest.fn(),
      database: jest.fn().mockReturnValue({
        ref: jest.fn().mockReturnValue({
          once: jest.fn().mockImplementation(() => Promise.resolve({
            exists: () => false,
            val: () => null
          })),
          on: jest.fn(),
          set: jest.fn().mockResolvedValue({}),
          child: jest.fn().mockReturnThis()
        })
      })
    };
    
    // firebase-connect.jsの読み込みと実行
    jest.resetModules();
    require('../public/firebase-connect.js');
    
    // FirebaseConnectインスタンスへの参照を取得
    firebaseConnect = window.firebaseConnect;
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
  
  // 新しいルーム作成のテスト（モック版）
  test('新しいルームを作成できる', async () => {
    // データベース参照のモック
    const gameRef = {
      set: jest.fn().mockResolvedValue({}),
      once: jest.fn().mockResolvedValue({ exists: () => false })
    };
    
    // ルーム作成メソッドを呼び出し
    await firebaseConnect.createNewRoom(gameRef);
    
    // setメソッドが呼ばれたことを確認
    expect(gameRef.set).toHaveBeenCalled();
    
    // ルーム作成後、window.gameのメソッドが呼ばれたことを確認
    expect(window.game.enableOnlineMode).toHaveBeenCalled();
  });
  
  // 既存のルームに参加するテスト
  test('既存のルームに参加できる', () => {
    // ゲームデータのモック
    const gameData = {
      isStarted: false,
      board: Array(49).fill(null),
      currentPlayer: 'black'
    };
    
    // ルーム参加メソッドを呼び出し
    firebaseConnect.joinExistingRoom(gameData);
    
    // playerRoleが設定されていることを確認
    expect(window.playerRole).toBe('white');
    
    // オンラインモードが有効化されたことを確認
    expect(window.game.enableOnlineMode).toHaveBeenCalled();
    
    // ゲーム状態が同期されたことを確認
    expect(window.game.syncWithOnlineState).toHaveBeenCalledWith(gameData);
  });
  
  // 既にゲームが開始されているルームへの参加拒否テスト
  test('既に開始されているゲームには参加できない', () => {
    // ゲームデータのモック（開始済み）
    const gameData = {
      isStarted: true,
      board: Array(49).fill(null),
      currentPlayer: 'black'
    };
    
    // windowのalertをモック
    const alertMock = jest.spyOn(window, 'alert').mockImplementation();
    
    // ルーム参加メソッドを呼び出し
    firebaseConnect.joinExistingRoom(gameData);
    
    // アラートが表示されたことを確認
    expect(alertMock).toHaveBeenCalledWith('このゲームは既に開始されています。新しいルームを作成してください。');
    
    // オンラインモードが有効化されていないことを確認
    expect(window.game.enableOnlineMode).not.toHaveBeenCalled();
  });
}); 
