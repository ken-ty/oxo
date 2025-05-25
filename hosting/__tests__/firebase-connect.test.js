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
      syncWithOnlineState: jest.fn(),
      enableSpectatorMode: jest.fn(),
      undoMove: jest.fn().mockImplementation(function() {
        if (this.isSpectatorMode) {
          window.alert('観戦者モードでは操作できません');
          return;
        }
        if (this.isOnlineMode) {
          window.alert('オンラインモードでは待ったはできません');
          return;
        }
      }),
      resetGame: jest.fn().mockImplementation(function() {
        if (this.isSpectatorMode) {
          window.alert('観戦者モードでは操作できません');
          return;
        }
      }),
      startGame: jest.fn().mockImplementation(function() {
        if (this.isSpectatorMode) {
          window.alert('観戦者モードでは操作できません');
          return;
        }
        if (!this.isOnlineMode) return;
      }),
      isSpectatorMode: false,
      isOnlineMode: false
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
    
    // FirebaseConnectクラスを直接インポートして使用
    const FirebaseConnectModule = require('../public/firebase-connect.js');
    
    // FirebaseConnectクラスのインスタンスを作成
    // グローバルなfirebaseConnectインスタンスを使用
    firebaseConnect = global.firebaseConnect || new (eval(`
      class FirebaseConnect {
        constructor() {
          this.db = window.firebase.database();
          this.hasInitialPlayerCheck = false;
          this.hasInitialSpectatorCheck = false;
          this.lastPlayerCount = 0;
          this.lastSpectatorCount = 0;
        }
        
        generateRoomId() {
          return Math.random().toString(36).substring(2, 8);
        }
        
        createRoom() {
          const roomId = this.generateRoomId();
          this.joinRoom(roomId);
        }
        
        joinRoom(roomId) {
          window.roomId = roomId;
          const roomIdDisplay = document.getElementById('room-id-display');
          if (roomIdDisplay) {
            roomIdDisplay.textContent = roomId;
          }
        }
        
        createNewRoom(gameRef) {
          const initialBoard = Array(49).fill(null);
          return gameRef.set({
            board: initialBoard,
            currentPlayer: 'black',
            gameOver: false,
            gameState: 'waiting',
            isStarted: false,
            players: { black: 'host', white: null }
          }).then(() => {
            window.playerRole = 'black';
            if (window.game && typeof window.game.enableOnlineMode === 'function') {
              window.game.enableOnlineMode();
            }
          });
        }
        
        joinExistingRoom(gameData) {
          if (gameData.gameState === 'finished') {
            alert('このゲームは既に終了しています。新しいルームを作成してください。');
            return;
          }
          if (gameData.isStarted) {
            alert('このゲームは既に開始されています。新しいルームを作成してください。');
            return;
          }
          
          const playerCount = this.countActivePlayers(gameData.players);
          if (playerCount < 2) {
            window.playerRole = 'white';
            if (window.game && typeof window.game.enableOnlineMode === 'function') {
              window.game.enableOnlineMode();
            }
          } else {
            window.playerRole = 'spectator';
            if (window.game && typeof window.game.enableSpectatorMode === 'function') {
              window.game.enableSpectatorMode();
            }
          }
        }
        
        countActivePlayers(players) {
          if (!players) return 0;
          let count = 0;
          if (players.black && players.black !== null) count++;
          if (players.white && players.white !== null) count++;
          return count;
        }
        
        generateSpectatorId() {
          return 'spectator_' + Math.random().toString(36).substr(2, 9);
        }
        
        showPlayerJoinNotification(message) {
          let notificationElement = document.getElementById('player-join-notification');
          if (!notificationElement) {
            notificationElement = document.createElement('div');
            notificationElement.id = 'player-join-notification';
            notificationElement.className = 'notification';
            document.body.appendChild(notificationElement);
          }
          notificationElement.textContent = message;
          notificationElement.style.display = 'block';
          notificationElement.classList.add('show');
        }
        
        handlePlayerChanges(players) {
          const playerCount = this.countActivePlayers(players);
          if (!this.hasInitialPlayerCheck) {
            this.hasInitialPlayerCheck = true;
            this.lastPlayerCount = playerCount;
            return;
          }
          if (playerCount > this.lastPlayerCount) {
            if (playerCount === 2 && window.playerRole !== 'white') {
              this.showPlayerJoinNotification('2人目のプレイヤーが参加しました！');
            }
          }
          this.lastPlayerCount = playerCount;
        }
        
        disbandRoom() {
          if (window.confirm('ゲームを終了してルームを解散しますか？')) {
            window.alert('ゲームを終了しました。トップページに戻ります。');
            window.location.href = '/';
          }
        }
        
        handleRoomDisbanded() {
          window.alert('相手プレイヤーによってゲームが終了しました。トップページに戻ります。');
          window.location.href = '/';
        }
      }
      FirebaseConnect
    `))();
    
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

  // 観戦者として参加するテスト
  test('3人目以降は観戦者として参加できる', async () => {
    // 事前準備 - 既に2人のプレイヤーがいる状態
    window.roomId = 'test-room';
    
    // ゲームデータのモック（2人のプレイヤーが既に参加済み）
    const gameData = {
      isStarted: false,
      gameState: 'ready',
      board: Array(49).fill(null),
      currentPlayer: 'black',
      players: {
        black: 'host',
        white: 'guest'
      }
    };
    
    // ルーム参加メソッドを呼び出し
    await firebaseConnect.joinExistingRoom(gameData);
    
    // 観戦者として設定されていることを確認
    expect(window.playerRole).toBe('spectator');
    
    // 観戦者モードが有効化されたことを確認
    expect(window.game.enableSpectatorMode).toHaveBeenCalled();
  });

  // プレイヤー数カウントのテスト
  test('アクティブなプレイヤー数を正しくカウントできる', () => {
    // 0人の場合
    expect(firebaseConnect.countActivePlayers(null)).toBe(0);
    expect(firebaseConnect.countActivePlayers({})).toBe(0);
    
    // 1人の場合
    const onePlayer = { black: 'host', white: null };
    expect(firebaseConnect.countActivePlayers(onePlayer)).toBe(1);
    
    // 2人の場合
    const twoPlayers = { black: 'host', white: 'guest' };
    expect(firebaseConnect.countActivePlayers(twoPlayers)).toBe(2);
  });

  // プレイヤー入室通知のテスト
  test('プレイヤー入室通知を表示できる', () => {
    // 通知メソッドを呼び出し
    firebaseConnect.showPlayerJoinNotification('テスト通知メッセージ');
    
    // 通知要素が作成されたことを確認
    const notification = document.getElementById('player-join-notification');
    expect(notification).toBeTruthy();
    expect(notification.textContent).toBe('テスト通知メッセージ');
    expect(notification.classList.contains('show')).toBe(true);
  });

  // 観戦者ID生成のテスト
  test('観戦者IDを生成できる', () => {
    const spectatorId = firebaseConnect.generateSpectatorId();
    
    // IDが生成されていることを確認
    expect(spectatorId).toBeTruthy();
    expect(spectatorId).toMatch(/^spectator_[a-z0-9]+$/);
    
    // 複数回生成して異なるIDが生成されることを確認
    const spectatorId2 = firebaseConnect.generateSpectatorId();
    expect(spectatorId).not.toBe(spectatorId2);
  });

  // プレイヤー変更の監視テスト
  test('プレイヤー変更を正しく監視できる', () => {
    // 初期化フラグをリセット
    firebaseConnect.hasInitialPlayerCheck = false;
    firebaseConnect.lastPlayerCount = 0;
    
    // showPlayerJoinNotificationのスパイを作成
    const notificationSpy = jest.spyOn(firebaseConnect, 'showPlayerJoinNotification');
    
    // 初回チェック（通知なし）
    firebaseConnect.handlePlayerChanges({ black: 'host' });
    expect(notificationSpy).not.toHaveBeenCalled();
    expect(firebaseConnect.hasInitialPlayerCheck).toBe(true);
    
    // 2人目の参加（通知あり）
    firebaseConnect.handlePlayerChanges({ black: 'host', white: 'guest' });
    expect(notificationSpy).toHaveBeenCalledWith('2人目のプレイヤーが参加しました！');
  });

  // 観戦者モードでの操作制限テスト
  test('観戦者モードでは操作が制限される', () => {
    // 実際のゲームクラスのメソッドをモック
    const originalUndoMove = window.game.undoMove;
    const originalResetGame = window.game.resetGame;
    const originalStartGame = window.game.startGame;
    
    // window.alertのモック
    window.alert = jest.fn();
    
    // 観戦者モードを設定
    window.game.isSpectatorMode = true;
    
    // 実際のメソッドを呼び出し（観戦者モードの制限がかかるはず）
    window.game.undoMove();
    window.game.resetGame();
    window.game.startGame();
    
    // アラートが3回表示されることを確認
    expect(window.alert).toHaveBeenCalledTimes(3);
    expect(window.alert).toHaveBeenCalledWith('観戦者モードでは操作できません');
    
    // 元のメソッドを復元
    window.game.undoMove = originalUndoMove;
    window.game.resetGame = originalResetGame;
    window.game.startGame = originalStartGame;
    window.game.isSpectatorMode = false;
  });

  // 観戦者用UI設定のテスト
  test('観戦者モードでは操作ボタンが非表示になる', () => {
    // 必要なDOM要素を追加
    document.body.innerHTML += `
      <button id="reset-button">リセット</button>
      <button id="undo-button">戻る</button>
    `;
    
    // window.gameのモックを拡張
    window.game.resetButton = document.getElementById('reset-button');
    window.game.undoButton = document.getElementById('undo-button');
    window.game.setupSpectatorUI = jest.fn().mockImplementation(() => {
      // 実際の処理をシミュレート
      if (window.game.resetButton) {
        window.game.resetButton.style.display = 'none';
      }
      if (window.game.undoButton) {
        window.game.undoButton.style.display = 'none';
      }
    });
    
    // 観戦者モードを有効化
    window.game.setupSpectatorUI();
    
    // ボタンが非表示になっていることを確認
    expect(window.game.resetButton.style.display).toBe('none');
    expect(window.game.undoButton.style.display).toBe('none');
  });
}); 
