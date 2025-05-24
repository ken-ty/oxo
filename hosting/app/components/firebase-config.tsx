'use client';

import { useEffect, useState } from 'react';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyD6W5G7Yr4Cz_Mau-Xo7HFZGfQDM3Vnt14",
  authDomain: "bglab-oxo.firebaseapp.com",
  databaseURL: "https://bglab-oxo-default-rtdb.firebaseio.com",
  projectId: "bglab-oxo",
  storageBucket: "bglab-oxo.appspot.com",
  messagingSenderId: "775863260997",
  appId: "1:775863260997:web:a36e12b3a0d8ce5f3d7f01"
};

declare global {
  interface Window {
    firebase: any;
    db: any;
    roomId: string | null;
    isOnlineMode: boolean;
    playerRole: string | null;
    game: any;
  }
}

export default function FirebaseConfig() {
  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);

  // Firebaseの初期化チェック
  useEffect(() => {
    const checkFirebase = () => {
      if (typeof window !== 'undefined' && window.firebase) {
        console.log('Firebase SDK loaded!');
        
        try {
          // 多重初期化を防止
          if (!window.db) {
            window.firebase.initializeApp(firebaseConfig);
            window.db = window.firebase.database();
            console.log('Firebase initialized successfully!');
            
            // オンライン対戦用の状態
            window.roomId = null;
            window.isOnlineMode = false;
            window.playerRole = null; // 'black' または 'white'
            
            setIsFirebaseInitialized(true);
          }
        } catch (error) {
          console.error('Firebase initialization error:', error);
        }
      } else {
        console.log('Firebase SDK not loaded yet, retrying...');
        setTimeout(checkFirebase, 500);
      }
    };
    
    checkFirebase();
  }, []);
  
  // DOMイベントの設定
  useEffect(() => {
    if (isFirebaseInitialized) {
      console.log('Setting up event listeners...');
      setupEventListeners();
    }
  }, [isFirebaseInitialized]);
  
  // ランダムなルームIDを生成
  function generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
  }
  
  // DOMイベントの設定
  function setupEventListeners() {
    setTimeout(() => {
      const createRoomButton = document.getElementById('create-room-button');
      const joinRoomButton = document.getElementById('join-room-button');
      const joinRoomInput = document.getElementById('join-room-input');
      const roomIdDisplay = document.getElementById('room-id-display');
      const onlineStatus = document.getElementById('online-status');
      
      if (!createRoomButton || !joinRoomButton || !joinRoomInput || !roomIdDisplay || !onlineStatus) {
        console.error('Required DOM elements not found');
        return;
      }
      
      console.log('DOM elements found, attaching event listeners');
      
      // ルーム作成
      createRoomButton.addEventListener('click', () => {
        console.log('Create room button clicked');
        window.roomId = generateRoomId();
        window.playerRole = 'black'; // ルーム作成者は黒
        window.isOnlineMode = true;
        
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
        
        console.log('Saving initial state to Firebase, roomId:', window.roomId);
        
        window.db.ref(`games/${window.roomId}`).set(initialState)
          .then(() => {
            console.log('Room created successfully!');
            roomIdDisplay.textContent = `ルームID: ${window.roomId}`;
            onlineStatus.textContent = 'オンライン (黒)';
            onlineStatus.style.color = '#4CAF50';
            
            // ゲーム状態の監視を開始
            startGameStateListener();
          })
          .catch((error: any) => {
            console.error('Error creating room:', error);
            alert('ルーム作成に失敗しました: ' + error.message);
          });
      });
      
      // ルーム参加
      joinRoomButton.addEventListener('click', () => {
        const inputRoomId = (joinRoomInput as HTMLInputElement).value.trim();
        if (!inputRoomId) {
          alert('ルームIDを入力してください');
          return;
        }
        
        console.log('Checking room existence:', inputRoomId);
        
        // 指定されたルームが存在するか確認
        window.db.ref(`games/${inputRoomId}`).once('value')
          .then((snapshot: any) => {
            if (!snapshot.exists()) {
              alert('指定されたルームが見つかりません');
              return;
            }
            
            window.roomId = inputRoomId;
            window.playerRole = 'white'; // 参加者は白
            window.isOnlineMode = true;
            
            console.log('Room exists, joining as white');
            
            // プレイヤー情報を更新
            window.db.ref(`games/${window.roomId}/players/white`).set('guest')
              .then(() => {
                console.log('Joined room successfully!');
                roomIdDisplay.textContent = `ルームID: ${window.roomId}`;
                onlineStatus.textContent = 'オンライン (白)';
                onlineStatus.style.color = '#4CAF50';
                
                // ゲーム状態の監視を開始
                startGameStateListener();
              })
              .catch((error: any) => {
                console.error('Error joining room:', error);
                alert('ルーム参加に失敗しました: ' + error.message);
              });
          })
          .catch((error: any) => {
            console.error('Error checking room:', error);
            alert('ルーム確認に失敗しました: ' + error.message);
          });
      });
    }, 1000); // DOMが完全にロードされるのを待つ
  }
  
  // ゲーム状態の監視を開始
  function startGameStateListener() {
    console.log('Starting game state listener for roomId:', window.roomId);
    window.db.ref(`games/${window.roomId}`).on('value', (snapshot: any) => {
      const gameState = snapshot.val();
      if (!gameState) {
        console.warn('No game state received');
        return;
      }
      
      console.log('Game state updated:', gameState);
      
      // ゲームクラスのオンライン同期を呼び出す
      if (window.game) {
        window.game.syncWithOnlineState(gameState);
      } else {
        console.warn('Game object not found');
      }
    });
  }
  
  // 非表示コンポーネント
  return (
    <div style={{ display: 'none' }}>
      <div id="firebase-debug">
        Firebase Status: {isFirebaseInitialized ? 'Initialized' : 'Initializing...'}
      </div>
    </div>
  );
} 
