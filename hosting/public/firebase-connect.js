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

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
window.db = db;

// 乱数でルームIDを生成
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

// ルームを作成する
function createRoom() {
  const roomId = generateRoomId();
  joinRoom(roomId);
}

// ルームに参加する
function joinRoom(roomId) {
  if (!roomId) {
    alert('ルームIDを入力してください');
    return;
  }
  
  // ルームIDを保存
  window.roomId = roomId;
  
  // ルーム表示を更新
  document.getElementById('room-id-display').textContent = roomId;
  
  // ゲームルームの参照
  const gameRef = db.ref(`games/${roomId}`);
  
  // ルームが存在するか確認
  gameRef.once('value', (snapshot) => {
    if (!snapshot.exists()) {
      // ルームが存在しない場合は新規作成
      const initialBoard = Array(49).fill(null);
      initialBoard[24] = 'white'; // 中央に白を配置
      
      gameRef.set({
        board: initialBoard,
        currentPlayer: 'black',
        gameOver: false,
        players: {
          black: 'host', // 作成者は黒
          white: 'guest'  // 参加者は白
        },
        isStarted: false, // ゲーム開始状態を追加
        center: {
          row: 3,
          col: 3,
          piece: 'white'
        }
      }).then(() => {
        console.log('ルームを作成しました');
        window.playerRole = 'black'; // 作成者は黒（ホスト）
        game.enableOnlineMode();
        
        // ゲーム開始ボタンを表示
        const startContainer = document.getElementById('game-start-container');
        if (startContainer) startContainer.style.display = 'block';
      }).catch((error) => {
        console.error('ルーム作成エラー:', error);
        alert('ルームの作成に失敗しました');
      });
    } else {
      // ルームが存在する場合は参加
      const gameData = snapshot.val();
      
      // 既にゲームが開始されている場合
      if (gameData.isStarted) {
        alert('このゲームは既に開始されています。新しいルームを作成してください。');
        return;
      }
      
      // プレイヤーの役割を設定
      window.playerRole = 'white'; // 参加者は白（ゲスト）
      
      // オンラインモードを有効化
      game.enableOnlineMode();
      
      // ゲーム状態をロード
      game.syncWithOnlineState(gameData);
      
      console.log('ルームに参加しました');
    }
    
    // リアルタイム更新をリッスン
    setupGameListener(roomId);
  }).catch((error) => {
    console.error('ルーム参加エラー:', error);
    alert('ルームへの参加に失敗しました');
  });
}

// ゲーム状態のリアルタイム更新をリッスン
function setupGameListener(roomId) {
  const gameRef = db.ref(`games/${roomId}`);
  
  gameRef.on('value', (snapshot) => {
    const gameData = snapshot.val();
    if (gameData) {
      // ゲーム状態を同期
      game.syncWithOnlineState(gameData);
    }
  });
}

// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
  // ルーム作成ボタンのイベントリスナー
  const createRoomButton = document.getElementById('create-room-button');
  if (createRoomButton) {
    createRoomButton.addEventListener('click', createRoom);
  }
  
  // ルーム参加ボタンのイベントリスナー
  const joinRoomButton = document.getElementById('join-room-button');
  const joinRoomInput = document.getElementById('join-room-input');
  
  if (joinRoomButton && joinRoomInput) {
    joinRoomButton.addEventListener('click', () => {
      joinRoom(joinRoomInput.value.trim());
    });
    
    // Enterキーでも参加できるように
    joinRoomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinRoom(joinRoomInput.value.trim());
      }
    });
  }
}); 
