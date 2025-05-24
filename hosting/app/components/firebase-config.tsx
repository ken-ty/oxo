'use client';

import { useEffect, useState, createContext, useContext } from 'react';

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

// グローバル型定義
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

// Firebase状態のコンテキスト
type FirebaseContextType = {
  isInitialized: boolean;
};

const FirebaseContext = createContext<FirebaseContextType>({
  isInitialized: false
});

// Firebaseコンテキストを使用するカスタムフック
export const useFirebase = () => useContext(FirebaseContext);

export default function FirebaseConfig() {
  const [isInitialized, setIsInitialized] = useState(false);

  // Firebaseの初期化処理
  useEffect(() => {
    // 再帰的に初期化チェック
    const initializeFirebase = () => {
      if (typeof window === 'undefined') return;
      
      if (window.firebase) {
        console.log('Firebase SDK loaded!');
        
        try {
          // 多重初期化防止
          if (!window.db) {
            window.firebase.initializeApp(firebaseConfig);
            window.db = window.firebase.database();
            
            // オンライン対戦状態初期化
            window.roomId = null;
            window.isOnlineMode = false;
            window.playerRole = null;
            
            console.log('Firebase initialized successfully!');
            setIsInitialized(true);
          }
        } catch (error) {
          console.error('Firebase initialization error:', error);
        }
      } else {
        console.log('Firebase SDK not loaded yet, retrying...');
        setTimeout(initializeFirebase, 500);
      }
    };
    
    initializeFirebase();
    
    // クリーンアップ
    return () => {
      // Firebaseリスナーのクリーンアップが必要な場合はここに追加
    };
  }, []);
  
  return (
    <FirebaseContext.Provider value={{ isInitialized }}>
      <div style={{ display: 'none' }}>
        <div id="firebase-debug">
          Firebase Status: {isInitialized ? 'Initialized' : 'Initializing...'}
        </div>
      </div>
    </FirebaseContext.Provider>
  );
} 
