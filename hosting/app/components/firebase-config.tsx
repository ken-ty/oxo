'use client';

import { useEffect, useState } from 'react';

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
  
  // 非表示コンポーネント
  return (
    <div style={{ display: 'none' }}>
      <div id="firebase-debug">
        Firebase Status: {isFirebaseInitialized ? 'Initialized' : 'Initializing...'}
      </div>
    </div>
  );
} 
