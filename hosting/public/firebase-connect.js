/**
 * OXOゲーム Firebase接続
 */

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyC9AQgfGQNPYUpDKaYHdz_dLPEwZmkZi5A",
  authDomain: "bglab-oxo.firebaseapp.com",
  databaseURL: "https://bglab-oxo-default-rtdb.firebaseio.com",
  projectId: "bglab-oxo",
  storageBucket: "bglab-oxo.appspot.com",
  messagingSenderId: "889486070533",
  appId: "1:889486070533:web:9a1c91c90b1f8b48e18ece"
};

// ゲームの状態を定義
const GAME_STATES = {
  WAITING: 'waiting',   // ルーム作成、相手待ち
  READY: 'ready',       // 両プレイヤー参加、開始待ち
  PLAYING: 'playing',   // ゲーム進行中
  FINISHED: 'finished'  // ゲーム終了
};

// Firebaseクラス
class FirebaseConnect {
  constructor() {
    // Firebase初期化
    firebase.initializeApp(firebaseConfig);
    this.db = firebase.database();
    window.db = this.db;
    
    // DOMの準備ができてからイベントリスナーをセットアップ
    this.setupEventListenersWhenReady();
  }
  
  // DOMの準備を確認してイベントリスナーをセットアップ
  setupEventListenersWhenReady() {
    // DOMが既に読み込み済みの場合は直接セットアップ
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(() => this.setupEventListeners(), 100);
    } else {
      // そうでなければDOMContentLoadedを待つ
      document.addEventListener('DOMContentLoaded', () => {
        this.setupEventListeners();
      });
    }
  }
  
  // イベントリスナーのセットアップ
  setupEventListeners() {
    // ルーム作成ボタンのイベントリスナー
    const createRoomButton = document.getElementById('create-room-button');
    if (createRoomButton) {
      createRoomButton.addEventListener('click', () => this.createRoom());
      console.log('ルーム作成ボタンのイベントリスナーを設定しました');
    } else {
      console.error('ルーム作成ボタンが見つかりません');
    }
    
    // ルーム参加ボタンのイベントリスナー
    const joinRoomButton = document.getElementById('join-room-button');
    const joinRoomInput = document.getElementById('join-room-input');
    
    if (joinRoomButton && joinRoomInput) {
      joinRoomButton.addEventListener('click', () => {
        this.joinRoom(joinRoomInput.value.trim());
      });
      
      // Enterキーでも参加できるように
      joinRoomInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.joinRoom(joinRoomInput.value.trim());
        }
      });
      console.log('ルーム参加ボタンのイベントリスナーを設定しました');
    } else {
      console.error('ルーム参加ボタンまたは入力フィールドが見つかりません');
    }
    
    // ゲーム終了ボタンのイベントリスナー
    const endGameButton = document.getElementById('end-game-button');
    if (endGameButton) {
      endGameButton.addEventListener('click', () => this.disbandRoom());
      console.log('ゲーム終了ボタンのイベントリスナーを設定しました');
    }
  }

  // 乱数でルームIDを生成
  generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
  }
  
  // ルームを作成する
  createRoom() {
    console.log('ルーム作成が呼び出されました');
    const roomId = this.generateRoomId();
    this.joinRoom(roomId);
  }
  
  // ルームに参加する
  joinRoom(roomId) {
    if (!roomId) {
      alert('ルームIDを入力してください');
      return;
    }
    
    console.log(`ルーム参加: ${roomId}`);
    
    // ルームIDを保存
    window.roomId = roomId;
    
    // ルーム表示を更新
    const roomIdDisplay = document.getElementById('room-id-display');
    if (roomIdDisplay) {
      roomIdDisplay.textContent = roomId;
    }
    
    // ゲームルームの参照
    const gameRef = this.db.ref(`games/${roomId}`);
    
    // ルームが存在するか確認
    gameRef.once('value', (snapshot) => {
      if (!snapshot.exists()) {
        // ルームが存在しない場合は新規作成
        this.createNewRoom(gameRef);
      } else {
        // ルームが存在する場合は参加
        this.joinExistingRoom(snapshot.val());
      }
      
      // リアルタイム更新をリッスン
      this.setupGameListener(roomId);
    }).catch((error) => {
      console.error('ルーム参加エラー:', error);
      alert('ルームへの参加に失敗しました');
    });
  }
  
  // 新しいルームを作成
  createNewRoom(gameRef) {
    // key-value形式の空の盤面を作成
    const initialBoard = {};
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        const colLabel = String.fromCharCode(97 + col); // a-g
        const rowLabel = 7 - row; // 1-7
        const key = `${colLabel}${rowLabel}`;
        initialBoard[key] = "";
      }
    }
    
    // d4の位置に白を配置
    initialBoard['d4'] = 'white';
    
    gameRef.set({
      board: initialBoard,
      currentPlayer: 'black',
      gameOver: false,
      players: {
        black: 'host', // 作成者は黒
        white: null    // 参加者はまだ未定
      },
      gameState: GAME_STATES.WAITING, // ゲーム状態を追加
      isStarted: false, // ゲーム開始状態
      createdAt: firebase.database.ServerValue.TIMESTAMP // 作成時刻を記録
    }).then(() => {
      console.log('ルームを作成しました');
      window.playerRole = 'black'; // 作成者は黒（ホスト）
      
      if (window.game && typeof window.game.enableOnlineMode === 'function') {
        window.game.enableOnlineMode();
      } else {
        console.error('game.enableOnlineModeが見つかりません');
      }
      
      // ゲーム開始ボタンを表示
      const startContainer = document.getElementById('game-start-container');
      if (startContainer) startContainer.style.display = 'block';
    }).catch((error) => {
      console.error('ルーム作成エラー:', error);
      alert('ルームの作成に失敗しました');
    });
  }
  
  // 既存のルームに参加
  joinExistingRoom(gameData) {
    // ゲーム状態をチェック
    if (gameData.gameState === GAME_STATES.FINISHED) {
      alert('このゲームは既に終了しています。新しいルームを作成してください。');
      return;
    }
    
    // 既にゲームが開始されている場合
    if (gameData.isStarted) {
      alert('このゲームは既に開始されています。新しいルームを作成してください。');
      return;
    }
    
    // ゲームルームの参照
    const gameRef = this.db.ref(`games/${window.roomId}`);
    
    // プレイヤーの役割を設定
    window.playerRole = 'white'; // 参加者は白（ゲスト）
    
    // プレイヤー情報を更新
    gameRef.child('players/white').set('guest')
      .then(() => {
        // ゲーム状態を更新
        return gameRef.child('gameState').set(GAME_STATES.READY);
      })
      .then(() => {
        console.log('ルームに参加しました');
        
        // オンラインモードを有効化
        if (window.game && typeof window.game.enableOnlineMode === 'function') {
          window.game.enableOnlineMode();
          
          // ゲーム状態をロード
          if (typeof window.game.syncWithOnlineState === 'function') {
            window.game.syncWithOnlineState(gameData);
          } else {
            console.error('game.syncWithOnlineStateが見つかりません');
          }
        } else {
          console.error('game.enableOnlineModeが見つかりません');
        }
      })
      .catch(error => {
        console.error('参加処理エラー:', error);
      });
  }
  
  // ゲーム状態のリアルタイム更新をリッスン
  setupGameListener(roomId) {
    const gameRef = this.db.ref(`games/${roomId}`);
    
    console.log(`ルーム ${roomId} のリスナーを設定しました`);
    
    // メインのゲーム状態リスナー
    gameRef.on('value', (snapshot) => {
      console.log('ゲーム状態の更新を検出:', snapshot.val());
      const gameData = snapshot.val();
      if (gameData && window.game && typeof window.game.syncWithOnlineState === 'function') {
        // ゲーム状態を同期
        window.game.syncWithOnlineState(gameData);
        
        // ルームが解散された場合
        if (gameData.gameState === GAME_STATES.FINISHED && gameData.isRoomDisbanded) {
          this.handleRoomDisbanded();
        }
      }
    });
    
    // 盤面専用のリスナー（パフォーマンス向上のため）
    gameRef.child('board').on('value', (snapshot) => {
      console.log('盤面データの更新を検出:', snapshot.val());
      const boardData = snapshot.val();
      if (boardData && window.game && typeof window.game.updateBoardOnly === 'function') {
        // 盤面のみを更新（他の状態は変更しない）
        window.game.updateBoardOnly(boardData);
      }
    });
    
    // エラーハンドリング
    gameRef.on('error', (error) => {
      console.error('Firebase リスナーエラー:', error);
    });
  }
  
  // ルームを解散する
  disbandRoom() {
    if (!window.roomId) return;
    
    const gameRef = this.db.ref(`games/${window.roomId}`);
    
    // 確認ダイアログ
    if (confirm('ゲームを終了してルームを解散しますか？')) {
      gameRef.update({
        gameState: GAME_STATES.FINISHED,
        isRoomDisbanded: true,
        disbandedAt: firebase.database.ServerValue.TIMESTAMP
      })
      .then(() => {
        console.log('ルームを解散しました');
        alert('ゲームを終了しました。トップページに戻ります。');
        window.location.href = '/'; // トップページにリダイレクト
      })
      .catch(error => {
        console.error('ルーム解散エラー:', error);
      });
    }
  }
  
  // ルーム解散時の処理
  handleRoomDisbanded() {
    // 自分がルームを解散した場合は何もしない（すでにリダイレクト処理済み）
    if (window.isDisbanderPlayer) return;
    
    // 他のプレイヤーによってルームが解散された場合
    alert('相手プレイヤーによってゲームが終了しました。トップページに戻ります。');
    window.location.href = '/'; // トップページにリダイレクト
  }
}

// Firebase接続インスタンスを作成
const firebaseConnect = new FirebaseConnect(); 
