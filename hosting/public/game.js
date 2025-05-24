/**
 * OXO Game Logic
 */

// 定数定義
const GAME_CONSTANTS = {
  BOARD_SIZE: 7,
  CENTER: 3,
  AXES: ['vertical', 'horizontal', 'diag1', 'diag2'],
  GAME_STATES: {
    WAITING: 'waiting',   // ルーム作成、相手待ち
    READY: 'ready',       // 両プレイヤー参加、開始待ち
    PLAYING: 'playing',   // ゲーム進行中
    FINISHED: 'finished'  // ゲーム終了
  }
};

/**
 * OXOゲームクラス
 */
class OXOGame {
  /**
   * コンストラクタ
   */
  constructor() {
    this.initDOMElements();
    this.initGameState();
    this.setupEventListeners();
    this.resetGame();
  }

  /**
   * DOM要素の初期化
   */
  initDOMElements() {
    this.boardElement = document.getElementById("board");
    this.statusElement = document.getElementById("status");
    this.recordElement = document.getElementById("record");
    this.undoButton = document.getElementById("undo-button");
    this.resetButton = document.getElementById("reset-button");
    this.startGameButton = document.getElementById("start-game-button");
    this.endGameButton = document.getElementById("end-game-button");
    this.onlineStatusElement = document.getElementById("online-status");
  }

  /**
   * ゲーム状態の初期化
   */
  initGameState() {
    this.cells = [];
    this.currentPlayer = "black";
    this.placedThisTurn = 0;
    this.firstPlacement = null;
    this.gameOver = false;
    this.moveHistory = [];
    
    // オンラインモード用
    this.isOnlineMode = false;
    this.isStarted = false;
    this.gameState = GAME_CONSTANTS.GAME_STATES.WAITING;
    this.lastUpdateTime = 0;
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    this.undoButton.addEventListener("click", () => this.undoMove());
    this.resetButton.addEventListener("click", () => this.resetGame());
    
    if (this.startGameButton) {
      this.startGameButton.addEventListener("click", () => this.startGame());
    }
    
    if (this.endGameButton) {
      this.endGameButton.addEventListener("click", () => {
        if (window.firebaseConnect && typeof window.firebaseConnect.disbandRoom === 'function') {
          window.firebaseConnect.disbandRoom();
        }
      });
    }
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
  
  // === セル操作関連メソッド ===
  
  /**
   * 指定された位置のセルを取得
   */
  getCell(row, col) {
    return this.cells[row * GAME_CONSTANTS.BOARD_SIZE + col];
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
      const rowLabel = GAME_CONSTANTS.BOARD_SIZE - row; // 1-7
      this.recordElement.textContent += `${player === "black" ? '黒' : '白'}: ${colLabel}${rowLabel} `;
      
      // 履歴に追加
      this.moveHistory.push({ row, col });
      return true;
    }
    return false;
  }
  
  // === ゲームフロー関連メソッド ===
  
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
    this.updateGameRecord(stepsToUndo);
    
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
   * 棋譜を更新
   */
  updateGameRecord(stepsToUndo) {
    let moves = this.recordElement.textContent.trim().split(/\s+/);
    if (moves.length >= stepsToUndo * 2) {
      moves.splice(moves.length - stepsToUndo * 2, stepsToUndo * 2);
    } else {
      moves = [];
    }
    this.recordElement.textContent = moves.join(" ") + (moves.length > 0 ? " " : "");
  }
  
  /**
   * 対称点を計算
   */
  getSymPoint(row, col, axis) {
    const c = GAME_CONSTANTS.CENTER;
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
    const playerText = this.currentPlayer === "black" ? "黒" : "白";
    
    if (this.gameOver) {
      const winner = this.currentPlayer === "black" ? '黒' : '白';
      this.statusElement.textContent = `${winner}の勝ち！`;
      this.statusElement.classList.add("victory");
      return;
    }
    
    if (this.isOnlineMode) {
      if (!this.isStarted) {
        this.statusElement.textContent = "ゲーム開始ボタンを押してください";
        this.statusElement.style.color = '#FF9800'; // オレンジ色
        return;
      }
      
      if (window.playerRole === this.currentPlayer) {
        this.statusElement.textContent = `あなたの番です (${playerText})`;
        this.statusElement.style.color = '#4CAF50'; // 緑色で強調
      } else {
        this.statusElement.textContent = `相手の番です (${playerText})`;
        this.statusElement.style.color = '#FF5722'; // オレンジ色
      }
    } else {
      this.statusElement.textContent = `${playerText}の番です`;
      this.statusElement.style.color = ''; // デフォルト色にリセット
    }
  }
  
  /**
   * セルクリック時の処理
   */
  handleCellClick(row, col) {
    // 基本的なチェック
    if (this.shouldIgnoreClick(row, col)) return;
    
    if (this.placedThisTurn === 0) {
      this.handleFirstPlacement(row, col);
    } else if (this.placedThisTurn === 1) {
      this.handleSecondPlacement(row, col);
    }
  }
  
  /**
   * クリックを無視すべきかの判定
   */
  shouldIgnoreClick(row, col) {
    // ゲーム終了時または既に石がある場合は無視
    if (this.gameOver || this.getCell(row, col).textContent) return true;
    
    // オンラインモードの場合、自分の手番でなければ無視
    if (this.isOnlineMode && window.playerRole !== this.currentPlayer) {
      console.log('相手の番です - あなた:', window.playerRole, '現在の手番:', this.currentPlayer);
      return true;
    }
    
    // オンラインモードでゲームが開始されていない場合は無視
    if (this.isOnlineMode && !this.isStarted) {
      this.statusElement.textContent = "ゲーム開始ボタンを押してください";
      return true;
    }
    
    return false;
  }
  
  /**
   * 1つ目のコマの配置処理
   */
  handleFirstPlacement(row, col) {
    // 1つ目のコマを置く
    this.placePiece(row, col, this.currentPlayer);
    this.firstPlacement = { row, col };
    this.placedThisTurn = 1;
    
    // ヒントを表示
    this.showPlacementHints(row, col);
    
    // オンラインモードの場合、Firebaseに状態を保存
    if (this.isOnlineMode) {
      this.saveGameStateToFirebase();
    }
  }
  
  /**
   * 配置可能な場所のヒントを表示
   */
  showPlacementHints(row, col) {
    this.clearHints();
    const shown = new Set();
    
    for (const axis of GAME_CONSTANTS.AXES) {
      const [r, c] = this.getSymPoint(row, col, axis);
      if (this.isValidPosition(r, c) && !(r === row && c === col)) {
        const key = `${r},${c}`;
        if (!shown.has(key)) {
          shown.add(key);
          this.showHint(r, c);
        }
      }
    }
  }
  
  /**
   * 有効な位置かどうかを判定
   */
  isValidPosition(row, col) {
    return row >= 0 && row < GAME_CONSTANTS.BOARD_SIZE && 
           col >= 0 && col < GAME_CONSTANTS.BOARD_SIZE;
  }
  
  /**
   * 2つ目のコマの配置処理
   */
  handleSecondPlacement(row, col) {
    // ヒントがない場所には置けない
    if (!this.getCell(row, col).querySelector(".hint")) return;
    
    // 2つ目のコマを置く
    this.placePiece(row, col, this.currentPlayer);
    this.clearHints();
    
    // 勝利判定
    const playerClass = this.currentPlayer === "black" ? "black-piece" : "white-piece";
    if (this.checkVictory(playerClass)) {
      this.gameOver = true;
      this.gameState = GAME_CONSTANTS.GAME_STATES.FINISHED;
      this.statusElement.textContent = `${this.currentPlayer === "black" ? '黒' : '白'}の勝ち！`;
      this.statusElement.classList.add("victory");
      this.beep(660, 200);
      
      // オンラインモードの場合、勝利状態を保存
      if (this.isOnlineMode) {
        this.saveGameStateToFirebase(true, this.currentPlayer);
      }
      
      return;
    }
    
    // 次のプレイヤーに交代
    this.currentPlayer = this.currentPlayer === "black" ? "white" : "black";
    this.placedThisTurn = 0;
    this.firstPlacement = null;
    
    // ステータス表示を更新
    this.updateStatus();
    
    // オンラインモードの場合、Firebaseに状態を保存
    if (this.isOnlineMode) {
      this.saveGameStateToFirebase();
    }
  }
  
  /**
   * 勝利条件をチェック
   */
  checkVictory(cls) {
    const get = (r, c) => this.getCell(r, c)?.classList.contains(cls);
    
    // 全てのセルをチェック
    for (let r = 0; r < GAME_CONSTANTS.BOARD_SIZE; r++) {
      for (let c = 0; c < GAME_CONSTANTS.BOARD_SIZE; c++) {
        // 2x2の正方形チェック
        if (r < GAME_CONSTANTS.BOARD_SIZE - 1 && c < GAME_CONSTANTS.BOARD_SIZE - 1) {
          if (get(r, c) && get(r, c+1) && get(r+1, c) && get(r+1, c+1)) {
            return true;
          }
        }
        
        // 十字形チェック - 縦横
        if (r > 0 && r < GAME_CONSTANTS.BOARD_SIZE - 1 && c > 0 && c < GAME_CONSTANTS.BOARD_SIZE - 1) {
          if (get(r, c) && get(r-1, c) && get(r+1, c) && get(r, c-1) && get(r, c+1)) {
            return true;
          }
        }
        
        // 十字形チェック - 斜め
        if (r > 0 && r < GAME_CONSTANTS.BOARD_SIZE - 1 && c > 0 && c < GAME_CONSTANTS.BOARD_SIZE - 1) {
          if (get(r, c) && get(r-1, c-1) && get(r-1, c+1) && get(r+1, c-1) && get(r+1, c+1)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * ゲームをリセット
   */
  resetGame() {
    // ゲーム状態をリセット
    this.initGameState();
    
    // 盤面をクリア
    this.boardElement.innerHTML = '';
    this.recordElement.textContent = '';
    this.statusElement.classList.remove("victory");
    
    // 盤面を生成
    this.createBoard();
    
    // 初期状態を設定
    this.setupInitialState();
    
    // ステータス表示を更新
    this.updateStatus();
    
    // オンラインモードの場合、Firebaseに状態を保存
    if (this.isOnlineMode) {
      this.saveGameStateToFirebase();
    }
  }
  
  /**
   * 盤面を作成
   */
  createBoard() {
    // 7x7のマス目を作成
    for (let row = 0; row < GAME_CONSTANTS.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONSTANTS.BOARD_SIZE; col++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        
        // クリックイベントを設定
        cell.addEventListener("click", () => this.handleCellClick(row, col));
        
        this.boardElement.appendChild(cell);
        this.cells.push(cell);
      }
    }
  }
  
  /**
   * 初期状態を設定
   */
  setupInitialState() {
    // 中央に白を配置
    const centerCell = this.getCell(GAME_CONSTANTS.CENTER, GAME_CONSTANTS.CENTER);
    centerCell.textContent = "●";
    centerCell.classList.add("white-piece");
  }
  
  // === オンラインモード関連メソッド ===
  
  /**
   * ゲームを開始
   */
  startGame() {
    if (!this.isOnlineMode) return;
    
    // ルームの参照
    const gameRef = window.db.ref(`games/${window.roomId}`);
    
    // ゲーム開始状態を更新
    gameRef.update({
      isStarted: true,
      gameState: GAME_CONSTANTS.GAME_STATES.PLAYING,
      startedAt: firebase.database.ServerValue.TIMESTAMP
    })
    .then(() => {
      console.log('ゲームを開始しました');
      this.isStarted = true;
      this.gameState = GAME_CONSTANTS.GAME_STATES.PLAYING;
      
      // ゲーム開始ボタンを非表示
      const startContainer = document.getElementById('game-start-container');
      if (startContainer) startContainer.style.display = 'none';
      
      // ステータス表示を更新
      this.updateStatus();
    })
    .catch(error => {
      console.error('ゲーム開始エラー:', error);
    });
  }
  
  /**
   * オンラインモードを有効化
   */
  enableOnlineMode() {
    this.isOnlineMode = true;
    window.isOnlineMode = true;
    
    // オンラインステータスを更新
    if (this.onlineStatusElement) {
      this.onlineStatusElement.textContent = 'オンライン';
      this.onlineStatusElement.style.color = '#4CAF50';
    }
    
    // 終了ボタンを表示
    if (this.endGameButton) {
      this.endGameButton.style.display = 'block';
    }
    
    // ステータス表示を更新
    this.updateStatus();
  }
  
  /**
   * Firebaseにゲーム状態を保存
   */
  saveGameStateToFirebase(isGameOver = false, winner = null) {
    if (!this.isOnlineMode || !window.roomId) return;
    
    // 盤面状態を配列に変換
    const boardState = Array(GAME_CONSTANTS.BOARD_SIZE * GAME_CONSTANTS.BOARD_SIZE).fill(null);
    this.cells.forEach((cell, index) => {
      if (cell.classList.contains('black-piece')) {
        boardState[index] = 'black';
      } else if (cell.classList.contains('white-piece')) {
        boardState[index] = 'white';
      }
    });
    
    // ゲーム状態オブジェクト
    const gameState = {
      board: boardState,
      currentPlayer: this.currentPlayer,
      gameOver: isGameOver,
      isStarted: this.isStarted,
      gameState: isGameOver ? GAME_CONSTANTS.GAME_STATES.FINISHED : this.gameState,
      placedThisTurn: this.placedThisTurn,
      firstPlacement: this.firstPlacement,
      lastUpdateTime: firebase.database.ServerValue.TIMESTAMP,
      center: {
        row: GAME_CONSTANTS.CENTER,
        col: GAME_CONSTANTS.CENTER,
        piece: 'white'
      }
    };
    
    // 勝者情報を追加（勝利時）
    if (isGameOver && winner) {
      gameState.winner = winner;
    }
    
    // Firebaseに保存
    window.db.ref(`games/${window.roomId}`).update(gameState)
      .then(() => {
        console.log('ゲーム状態を保存しました');
      })
      .catch(error => {
        console.error('ゲーム状態の保存エラー:', error);
      });
  }
  
  /**
   * オンライン状態と同期
   */
  syncWithOnlineState(gameState) {
    if (!this.isOnlineMode) return;
    
    // 変更がない場合は更新しない
    if (gameState.lastUpdateTime && gameState.lastUpdateTime <= this.lastUpdateTime) {
      return;
    }
    
    // 最終更新時刻を更新
    if (gameState.lastUpdateTime) {
      this.lastUpdateTime = gameState.lastUpdateTime;
    }
    
    // ゲーム状態を更新
    this.gameState = gameState.gameState || GAME_CONSTANTS.GAME_STATES.WAITING;
    this.isStarted = gameState.isStarted || false;
    
    // ゲーム開始ボタンの表示/非表示
    const startContainer = document.getElementById('game-start-container');
    if (startContainer) {
      startContainer.style.display = this.isStarted ? 'none' : 'block';
    }
    
    // ゲーム終了状態の場合
    if (gameState.gameOver) {
      this.gameOver = true;
      const winner = gameState.winner === 'black' ? '黒' : '白';
      this.statusElement.textContent = `${winner}の勝ち！`;
      this.statusElement.classList.add("victory");
      return;
    }
    
    // プレイヤーの手番を更新
    this.currentPlayer = gameState.currentPlayer || 'black';
    this.placedThisTurn = gameState.placedThisTurn || 0;
    this.firstPlacement = gameState.firstPlacement || null;
    
    // 盤面状態を更新
    if (gameState.board) {
      // 盤面をクリア
      this.cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('black-piece', 'white-piece');
      });
      
      // 新しい状態を反映
      gameState.board.forEach((piece, index) => {
        if (piece) {
          const row = Math.floor(index / GAME_CONSTANTS.BOARD_SIZE);
          const col = index % GAME_CONSTANTS.BOARD_SIZE;
          const cell = this.getCell(row, col);
          
          cell.textContent = '●';
          cell.classList.add(piece === 'black' ? 'black-piece' : 'white-piece');
        }
      });
      
      // ヒントを更新
      this.clearHints();
      if (this.placedThisTurn === 1 && this.firstPlacement) {
        this.showPlacementHints(this.firstPlacement.row, this.firstPlacement.col);
      }
    }
    
    // ステータス表示を更新
    this.updateStatus();
  }
}

// ゲームのインスタンスを作成して公開
window.game = new OXOGame(); 
