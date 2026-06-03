/**
 * OXO 純粋ゲームロジック
 *
 * DOM / Firebase / window などの I/O に一切依存しない純粋関数群。
 * - ブラウザでは <script> 読み込みで `window.OXOLogic` として参照できる
 * - Node/Jest では `require('./oxo-logic.js')` で参照できる
 *
 * 盤面は { "a1": "" | "black" | "white", ... } の key-value 形式。
 * key は列ラベル(a-g) + 行ラベル(1-7)。行は上から 0..6、表示行ラベルは 7-row。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api; // CommonJS (Jest / Node)
  } else {
    root.OXOLogic = api; // ブラウザ global
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** ゲーム定数 */
  const GAME_CONSTANTS = {
    BOARD_SIZE: 7,
    CENTER: 3,
    AXES: ["vertical", "horizontal", "diag1", "diag2"],
    GAME_STATES: {
      WAITING: "waiting", // ルーム作成、相手待ち
      READY: "ready", // 両プレイヤー参加、開始待ち
      PLAYING: "playing", // ゲーム進行中
      FINISHED: "finished", // ゲーム終了
    },
  };

  /**
   * 行列座標を key（a1-g7）に変換する。
   * @param {number} row 0..6（上が0）
   * @param {number} col 0..6（左が0）
   * @returns {string}
   */
  function coordsToKey(row, col) {
    const colLabel = String.fromCharCode(97 + col); // a-g
    const rowLabel = GAME_CONSTANTS.BOARD_SIZE - row; // 1-7
    return `${colLabel}${rowLabel}`;
  }

  /**
   * key（a1-g7）を行列座標に変換する。
   * @param {string} key
   * @returns {{ row: number, col: number }}
   */
  function keyToCoords(key) {
    const col = key.charCodeAt(0) - 97; // a-g -> 0-6
    const row = GAME_CONSTANTS.BOARD_SIZE - parseInt(key[1], 10); // 1-7 -> 6-0
    return { row, col };
  }

  /**
   * 全マス空の盤面を生成する。
   * @returns {Record<string, string>}
   */
  function createEmptyBoard() {
    const board = {};
    for (let row = 0; row < GAME_CONSTANTS.BOARD_SIZE; row++) {
      for (let col = 0; col < GAME_CONSTANTS.BOARD_SIZE; col++) {
        board[coordsToKey(row, col)] = "";
      }
    }
    return board;
  }

  /**
   * 盤面内の有効な座標かどうかを判定する。
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
  function isValidPosition(row, col) {
    return (
      row >= 0 &&
      row < GAME_CONSTANTS.BOARD_SIZE &&
      col >= 0 &&
      col < GAME_CONSTANTS.BOARD_SIZE
    );
  }

  /**
   * 指定軸に対する中心対称点を計算する。
   * @param {number} row
   * @param {number} col
   * @param {'vertical'|'horizontal'|'diag1'|'diag2'} axis
   * @returns {[number, number]}
   */
  function getSymPoint(row, col, axis) {
    const c = GAME_CONSTANTS.CENTER;
    const dx = row - c;
    const dy = col - c;

    switch (axis) {
      case "vertical":
        return [row, c - dy];
      case "horizontal":
        return [c - dx, col];
      case "diag1":
        return [c - dy, c - dx];
      case "diag2":
        return [c + dy, c + dx];
      default:
        return [row, col];
    }
  }

  /**
   * 1つ目のコマを置いたとき、2つ目を置ける候補（対称点）の一覧を返す。
   * 盤外・自身と同じ位置は除外し、重複は排除する。
   * @param {number} row
   * @param {number} col
   * @returns {Array<{ row: number, col: number }>}
   */
  function getPlacementHints(row, col) {
    const hints = [];
    const seen = new Set();

    for (const axis of GAME_CONSTANTS.AXES) {
      const [r, c] = getSymPoint(row, col, axis);
      if (!isValidPosition(r, c)) continue;
      if (r === row && c === col) continue;
      const key = `${r},${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hints.push({ row: r, col: c });
    }

    return hints;
  }

  /**
   * 指定プレイヤーが勝利形（2x2 正方形 / 縦横十字 / 斜め十字）を作っているか判定する。
   * @param {Record<string, string>} board
   * @param {'black'|'white'} playerColor
   * @returns {boolean}
   */
  function checkVictory(board, playerColor) {
    const size = GAME_CONSTANTS.BOARD_SIZE;
    const at = (row, col) => board[coordsToKey(row, col)] === playerColor;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        // 2x2 の正方形
        if (r < size - 1 && c < size - 1) {
          if (at(r, c) && at(r, c + 1) && at(r + 1, c) && at(r + 1, c + 1)) {
            return true;
          }
        }

        // 内側のセルでのみ十字を判定
        const isInner = r > 0 && r < size - 1 && c > 0 && c < size - 1;
        if (isInner) {
          // 十字（縦横）
          if (
            at(r, c) &&
            at(r - 1, c) &&
            at(r + 1, c) &&
            at(r, c - 1) &&
            at(r, c + 1)
          ) {
            return true;
          }
          // 十字（斜め）
          if (
            at(r, c) &&
            at(r - 1, c - 1) &&
            at(r - 1, c + 1) &&
            at(r + 1, c - 1) &&
            at(r + 1, c + 1)
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  return {
    GAME_CONSTANTS,
    coordsToKey,
    keyToCoords,
    createEmptyBoard,
    isValidPosition,
    getSymPoint,
    getPlacementHints,
    checkVictory,
  };
});
