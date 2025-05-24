// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyD6W5G7Yr4Cz_Mau-Xo7HFZGfQDM3Vnt14",
  authDomain: "bglab-oxo.firebaseapp.com",
  databaseURL: "https://bglab-oxo-default-rtdb.firebaseio.com",
  projectId: "bglab-oxo",
  storageBucket: "bglab-oxo.appspot.com",
  messagingSenderId: "775863260997",
  appId: "1:775863260997:web:a36e12b3a0d8ce5f3d7f01"
};

// Firebase の初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ランダムなルームIDを生成
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

// オンライン対戦用の状態
let roomId = null;
let isOnlineMode = false;
let playerRole = null; // 'black' または 'white'

// DOM要素
const createRoomButton = document.getElementById('create-room-button');
const joinRoomButton = document.getElementById('join-room-button');
const joinRoomInput = document.getElementById('join-room-input');
const roomIdDisplay = document.getElementById('room-id-display');
const onlineStatus = document.getElementById('online-status');

// ルーム作成
createRoomButton.addEventListener('click', () => {
  roomId = generateRoomId();
  playerRole = 'black'; // ルーム作成者は黒
  isOnlineMode = true;
  
  // Firebaseにゲーム初期状態を保存
  const initialState = {
    board: Array(49).fill(null),
    currentPlayer: 'black',
    gameOver: false,
    winner: null,
    players: {
      black: 'host'
    },
    center: {
      row: 3,
      col: 3,
      piece: 'white'
    }
  };
  
  // 中央のコマを設定
  initialState.board[3 * 7 + 3] = 'white';
  
  db.ref(`games/${roomId}`).set(initialState)
    .then(() => {
      roomIdDisplay.textContent = `ルームID: ${roomId}`;
      onlineStatus.textContent = 'オンライン (黒)';
      onlineStatus.style.color = '#4CAF50';
      
      // ゲーム状態の監視を開始
      startGameStateListener();
    })
    .catch(error => {
      console.error('Error creating room:', error);
      alert('ルーム作成に失敗しました');
    });
});

// ルーム参加
joinRoomButton.addEventListener('click', () => {
  const inputRoomId = joinRoomInput.value.trim();
  if (!inputRoomId) {
    alert('ルームIDを入力してください');
    return;
  }
  
  // 指定されたルームが存在するか確認
  db.ref(`games/${inputRoomId}`).once('value')
    .then(snapshot => {
      if (!snapshot.exists()) {
        alert('指定されたルームが見つかりません');
        return;
      }
      
      roomId = inputRoomId;
      playerRole = 'white'; // 参加者は白
      isOnlineMode = true;
      
      // プレイヤー情報を更新
      db.ref(`games/${roomId}/players/white`).set('guest')
        .then(() => {
          roomIdDisplay.textContent = `ルームID: ${roomId}`;
          onlineStatus.textContent = 'オンライン (白)';
          onlineStatus.style.color = '#4CAF50';
          
          // ゲーム状態の監視を開始
          startGameStateListener();
        })
        .catch(error => {
          console.error('Error joining room:', error);
          alert('ルーム参加に失敗しました');
        });
    })
    .catch(error => {
      console.error('Error checking room:', error);
      alert('ルーム確認に失敗しました');
    });
});

// ゲーム状態の監視を開始
function startGameStateListener() {
  db.ref(`games/${roomId}`).on('value', snapshot => {
    const gameState = snapshot.val();
    if (!gameState) return;
    
    // ゲームクラスのオンライン同期を呼び出す
    if (window.game) {
      window.game.syncWithOnlineState(gameState);
    }
  });
} 
