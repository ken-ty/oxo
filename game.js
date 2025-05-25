/**
 * OXO Game Logic
 */

// 定数定義
const BOARD_SIZE = 7;
const CENTER = 3;
const AXES = ['vertical', 'horizontal', 'diag1', 'diag2'];

/**
 * OXOゲームクラス
 */
class OXOGame {
  /**
   * コンストラクタ
   */
  constructor() {
    // DOM要素
    this.boardElement = document.getElementById("board");
    this.statusElement = document.getElementById("status");
    this.recordElement = document.getElementById("record");
    this.undoButton = document.getElementById("undo-button");
    this.resetButton = document.getElementById("reset-button");
    
    // ゲーム状態
    this.cells = [];
    this.currentPlayer = "black";
    this.placedThisTurn = 0;
    this.firstPlacement = null;
    this.gameOver = false;
    this.moveHistory = [];
    
    // オンラインモード用
    this.isOnlineMode = false;
    
    // イベントリスナーの設定
    this.undoButton.addEventListener("click", () => this.undoMove());
    this.resetButton.addEventListener("click", () => this.resetGame());
    
    // ゲーム開始
    this.resetGame();
  }
  
  /**
   * 効果音を鳴らす
   */
  beep(freq = 440, duration = 100) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.1;
    osc.type = 'square';
    osc.frequency.value = freq;
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  }
  
  /**
   * 指定された位置のセルを取得
   */
  getCell(row, col) {
    return this.cells[row * BOARD_SIZE + col];
  }
  
  /**
   * 置ける場所にヒントを表示
   */
  showHint(row, col) {
    const cell = this.getCell(row, col);
    if (!cell.textContent && !cell.querySelector(".hint")) {
      const hint = document.createElement("div");
      hint.className = "hint";
      cell.appendChild(hint);
    }
  }
  
  /**
   * すべてのヒントを消去
   */
  clearHints() {
    this.cells.forEach(cell => {
      const hint = cell.querySelector(".hint");
      if (hint) cell.removeChild(hint);
    });
  }
  
  /**
   * コマを置く
   */
  placePiece(row, col, player) {
    const cell = this.getCell(row, col);
    if (!cell.textContent) {
      cell.textContent = "●";
      cell.classList.add(player === "black" ? "black-piece" : "white-piece");
      
      this.beep(500, 80);
      
      // 棋譜に記録
      const colLabel = String.fromCharCode(97 + col); // a-g
      const rowLabel = BOARD_SIZE - row; // 1-7
      this.recordElement.textContent += `${player === "black" ? '黒' : '白'}: ${colLabel}${rowLabel} `;
      
      // 履歴に追加
      this.moveHistory.push({ row, col });
      return true;
    }
    return false;
  }
  
  /**
   * 一手戻る
   */
  undoMove() {
    // オンラインモードでは待ったできない
    if (this.isOnlineMode) {
      alert('オンラインモードでは待ったはできません');
      return;
    }
    
    if (this.gameOver || this.moveHistory.length === 0) return;
    
    const stepsToUndo = (this.placedThisTurn === 1 || this.moveHistory.length === 1) ? 1 : 2;
    
    // コマを取り除く
    for (let i = 0; i < stepsToUndo; i++) {
      const last = this.moveHistory.pop();
      const cell = this.getCell(last.row, last.col);
      cell.textContent = "";
      cell.classList.remove("black-piece", "white-piece");
    }
    
    // 棋譜を更新
    let moves = this.recordElement.textContent.trim().split(/\s+/);
    if (moves.length >= stepsToUndo * 2) {
      moves.splice(moves.length - stepsToUndo * 2, stepsToUndo * 2);
    } else {
      moves = [];
    }
    this.recordElement.textContent = moves.join(" ") + (moves.length > 0 ? " " : "");
    
    // ゲーム状態を更新
    this.placedThisTurn = 0;
    this.firstPlacement = null;
    this.clearHints();
    this.gameOver = false;
    
    // 2手戻す場合は手番も変更
    if (stepsToUndo === 2) {
      this.currentPlayer = this.currentPlayer === "black" ? "white" : "black";
    }
    
    this.updateStatus();
  }
  
  /**
   * 対称点を計算
   */
  getSymPoint(row, col, axis) {
    const c = CENTER;
    const dx = row - c;
    const dy = col - c;
    
    switch (axis) {
      case 'vertical': return [row, c - dy];
      case 'horizontal': return [c - dx, col];
      case 'diag1': return [c - dy, c - dx];
      case 'diag2': return [c + dy, c + dx];
      default: return [row, col];
    }
  }
  
  /**
   * ステータス表示を更新
   */
  updateStatus() {
    this.statusElement.textContent = `${this.currentPlayer === "black" ? "黒" : "白"}の番です`;
  }
  
  /**
   * セルクリック時の処理
   */
  handleCellClick(row, col) {
    // ゲーム終了時または既に石がある場合は無視
    if (this.gameOver || this.getCell(row, col).textContent) return;
    
    // オンラインモードの場合、自分の手番でなければ無視
    if (this.isOnlineMode && window.playerRole !== this.currentPlayer) {
      alert('相手の番です');
      return;
    }
    
    if (this.placedThisTurn === 0) {
      // 1つ目のコマを置く
      this.placePiece(row, col, this.currentPlayer);
      this.firstPlacement = { row, col };
      this.placedThisTurn = 1;
      
      // ヒントを表示
      this.clearHints();
      const shown = new Set();
      
      for (const axis of AXES) {
        const [r, c] = this.getSymPoint(row, col, axis);
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && !(r === row && c === col)) {
          const key = `${r},${c}`;
          if (!shown.has(key)) {
            shown.add(key);
            this.showHint(r, c);
          }
        }
      }
      
      // オンラインモードの場合、Firebaseに状態を保存
      if (this.isOnlineMode) {
        this.saveGameStateToFirebase();
      }
    } else if (this.placedThisTurn === 1) {
      // ヒントがない場所には置けない
      if (!this.getCell(row, col).querySelector(".hint")) return;
      
      // 2つ目のコマを置く
      this.placePiece(row, col, this.currentPlayer);
      this.clearHints();
      
      // 勝利判定
      if (this.checkVictory(this.currentPlayer === "black" ? "black-piece" : "white-piece")) {
        this.statusElement.textContent = `${this.currentPlayer === "black" ? "黒" : "白"}の勝ちです！`;
        this.beep(880, 300);
        this.gameOver = true;
        
        // オンラインモードの場合、Firebaseに勝利状態を保存
        if (this.isOnlineMode) {
          this.saveGameStateToFirebase(true, this.currentPlayer);
        }
        
        return;
      }
      
      // 次のプレイヤーへ
      this.placedThisTurn = 0;
      this.firstPlacement = null;
      this.currentPlayer = this.currentPlayer === "black" ? "white" : "black";
      this.updateStatus();
      
      // オンラインモードの場合、Firebaseに状態を保存
      if (this.isOnlineMode) {
        this.saveGameStateToFirebase();
      }
    }
  }
  
  /**
   * 勝利判定
   */
  checkVictory(cls) {
    const get = (r, c) => this.getCell(r, c)?.classList.contains(cls);
    
    // 2x2の正方形チェック
    for (let r = 0; r <= 5; r++) {
      for (let c = 0; c <= 5; c++) {
        if (get(r, c) && get(r, c + 1) && get(r + 1, c) && get(r + 1, c + 1)) return true;
      }
    }
    
    // 十字形チェック
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 5; c++) {
        // 縦横の十字
        if (get(r, c) && get(r - 1, c) && get(r + 1, c) && get(r, c - 1) && get(r, c + 1)) return true;
        
        // 斜めの十字
        if (get(r, c) && get(r - 1, c - 1) && get(r + 1, c + 1) && get(r - 1, c + 1) && get(r + 1, c - 1)) return true;
      }
    }
    
    return false;
  }
  
  /**
   * ゲームをリセット
   */
  resetGame() {
    // ボードと状態をクリア
    this.boardElement.innerHTML = "";
    this.recordElement.textContent = "";
    this.cells = [];
    this.moveHistory = [];
    
    // 初期状態に戻す
    this.currentPlayer = "black";
    this.placedThisTurn = 0;
    this.firstPlacement = null;
    this.gameOver = false;
    
    // ボードを作成
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        
        // 軸のセルは色を変える
        if (row === CENTER || col === CENTER || row === col || row + col === BOARD_SIZE - 1) {
          cell.classList.add("axis-cell");
        }
        
        // 中央には白いコマを初期配置
        if (row === CENTER && col === CENTER) {
          cell.textContent = "●";
          cell.classList.add("white-piece");
        }
        
        cell.addEventListener("click", () => this.handleCellClick(row, col));
        this.boardElement.appendChild(cell);
        this.cells.push(cell);
      }
    }
    
    this.updateStatus();
    
    // オンラインモードで新規ゲームの場合
    if (this.isOnlineMode && window.roomId) {
      this.saveGameStateToFirebase();
    }
  }
  
  /**
   * オンラインモードを有効にする
   */
  enableOnlineMode() {
    this.isOnlineMode = true;
    
    // 待ったボタンを無効化
    this.undoButton.disabled = true;
    this.undoButton.style.opacity = 0.5;
  }
  
  /**
   * Firebaseにゲーム状態を保存
   */
  saveGameStateToFirebase(isGameOver = false, winner = null) {
    if (!window.roomId || !window.db) return;
    
    // ボード状態の取得
    const boardState = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    this.cells.forEach((cell, index) => {
      if (cell.textContent) {
        if (cell.classList.contains('black-piece')) {
          boardState[index] = 'black';
        } else if (cell.classList.contains('white-piece')) {
          boardState[index] = 'white';
        }
      }
    });
    
    // ゲーム状態の作成
    const gameState = {
      board: boardState,
      currentPlayer: this.currentPlayer,
      gameOver: isGameOver || this.gameOver,
      placedThisTurn: this.placedThisTurn,
      firstPlacement: this.firstPlacement,
      moveHistory: this.moveHistory
    };
    
    if (isGameOver) {
      gameState.winner = winner;
    }
    
    // Firebaseに保存
    window.db.ref(`games/${window.roomId}`).update(gameState)
      .catch(error => {
        console.error('Error saving game state:', error);
      });
  }
  
  /**
   * オンライン状態と同期
   */
  syncWithOnlineState(gameState) {
    if (!this.isOnlineMode) {
      this.enableOnlineMode();
    }
    
    // ゲームオーバーの場合
    if (gameState.gameOver && gameState.winner) {
      this.statusElement.textContent = `${gameState.winner === "black" ? "黒" : "白"}の勝ちです！`;
      this.gameOver = true;
      return;
    }
    
    // ボード状態の反映
    if (gameState.board) {
      gameState.board.forEach((piece, index) => {
        const row = Math.floor(index / BOARD_SIZE);
        const col = index % BOARD_SIZE;
        const cell = this.getCell(row, col);
        
        // セルをクリア
        cell.textContent = "";
        cell.classList.remove("black-piece", "white-piece");
        
        // 新しい状態を設定
        if (piece) {
          cell.textContent = "●";
          cell.classList.add(piece === "black" ? "black-piece" : "white-piece");
        }
      });
    }
    
    // ゲーム状態の更新
    this.currentPlayer = gameState.currentPlayer;
    this.placedThisTurn = gameState.placedThisTurn;
    this.firstPlacement = gameState.firstPlacement;
    this.gameOver = gameState.gameOver;
    
    // ヒントの更新
    this.clearHints();
    if (this.placedThisTurn === 1 && this.firstPlacement) {
      const shown = new Set();
      for (const axis of AXES) {
        const [r, c] = this.getSymPoint(this.firstPlacement.row, this.firstPlacement.col, axis);
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && 
            !(r === this.firstPlacement.row && c === this.firstPlacement.col)) {
          const key = `${r},${c}`;
          if (!shown.has(key)) {
            shown.add(key);
            this.showHint(r, c);
          }
        }
      }
    }
    
    // ステータス更新
    this.updateStatus();
  }
}

// ゲームインスタンスを作成し、グローバルに公開
const game = new OXOGame();
window.game = game; 
