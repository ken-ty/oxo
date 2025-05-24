'use client';

import { useEffect, useCallback } from 'react';

export default function GameBoard() {
  // スクリプト読み込み関数
  const loadScript = useCallback((src: string, onLoad?: () => void) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    
    if (onLoad) {
      script.onload = onLoad;
    }
    
    script.onerror = (error) => {
      console.error(`Error loading script ${src}:`, error);
    };
    
    document.body.appendChild(script);
    return script;
  }, []);

  // スクリプトのクリーンアップ関数
  const removeScript = useCallback((src: string) => {
    const script = document.querySelector(`script[src="${src}"]`);
    if (script) {
      document.body.removeChild(script);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Firebase SDKが完全に読み込まれるのを少し待つ
    const timeout = setTimeout(() => {
      console.log('Loading game script...');
      
      // Firebase接続スクリプト読み込み後にゲームスクリプトを読み込む
      const firebaseScript = loadScript('/firebase-connect.js', () => {
        console.log('Firebase connect script loaded successfully!');
        loadScript('/game.js', () => {
          console.log('Game script loaded successfully!');
        });
      });
    }, 1000);
    
    // クリーンアップ関数
    return () => {
      clearTimeout(timeout);
      removeScript('/firebase-connect.js');
      removeScript('/game.js');
    };
  }, [loadScript, removeScript]);
  
  return (
    <>
      <div className="game-title">OXO</div>
      <div className="rules">
        <strong>ルール:</strong><br />
        ・先手は黒、交互に2つずつコマを置きます。<br />
        ・1つ目のコマを置いた後、縦・横・斜めの軸に線対称となる位置に2つ目を置きます。<br />
        ・中央には白いコマが初めから置かれています。<br />
        ・以下の形を作ると勝ちです：<br />
        - 2×2の正方形<br />
        - 十字形（縦横 or 斜め）
      </div>
      
      {/* オンラインモード用UI */}
      <div className="online-controls">
        <div>
          <button id="create-room-button" className="game-button">ルーム作成</button>
          <span id="room-id-display"></span>
        </div>
        <div>
          <input id="join-room-input" placeholder="ルームIDを入力" />
          <button id="join-room-button" className="game-button">ルーム参加</button>
        </div>
        <div id="online-status">オフライン</div>
        
        {/* ゲーム開始ボタン - 最初は非表示 */}
        <div id="game-start-container" style={{display: 'none', marginTop: '10px'}}>
          <button id="start-game-button" className="game-button start-button">ゲームを開始</button>
        </div>
      </div>
      
      <div id="status" className="game-status">黒の番です</div>
      <div className="game-container">
        <div className="row-labels">
          <div>7</div><div>6</div><div>5</div><div>4</div><div>3</div><div>2</div><div>1</div>
        </div>
        <div id="board" className="board"></div>
      </div>
      <div className="col-labels">
        <div></div>
        <div>a</div><div>b</div><div>c</div><div>d</div><div>e</div><div>f</div><div>g</div>
      </div>
      <div id="record" className="game-record"></div>
      <div className="game-controls">
        <button className="game-button" id="undo-button">待った</button>
        <button className="game-button" id="reset-button">リセット</button>
      </div>

      <div className="game-footer">製作：上田悠</div>
    </>
  );
} 
