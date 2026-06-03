/**
 * 純粋ゲームロジック（public/oxo-logic.js）のユニットテスト。
 *
 * DOM も Firebase も使わない。盤面は key-value のプレーンオブジェクトで組み立て、
 * 入力 → 出力だけを検証する。実装詳細（CSSクラス名・表示記号）には依存しない。
 */
const {
  GAME_CONSTANTS,
  coordsToKey,
  keyToCoords,
  createEmptyBoard,
  isValidPosition,
  getSymPoint,
  getPlacementHints,
  checkVictory,
} = require("../public/oxo-logic.js");

const SIZE = GAME_CONSTANTS.BOARD_SIZE;

/** 空盤面に { "d4": "black", ... } のような上書きを適用したものを返す */
function board(overrides = {}) {
  return { ...createEmptyBoard(), ...overrides };
}

describe("座標変換", () => {
  test("coordsToKey: 左上(0,0)は a7、右下(6,6)は g1", () => {
    expect(coordsToKey(0, 0)).toBe("a7");
    expect(coordsToKey(6, 6)).toBe("g1");
    expect(coordsToKey(3, 3)).toBe("d4"); // 中央
  });

  test("keyToCoords は coordsToKey の逆変換", () => {
    expect(keyToCoords("a7")).toEqual({ row: 0, col: 0 });
    expect(keyToCoords("g1")).toEqual({ row: 6, col: 6 });
    expect(keyToCoords("d4")).toEqual({ row: 3, col: 3 });
  });

  test("全マスで coordsToKey → keyToCoords が往復一致する", () => {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        expect(keyToCoords(coordsToKey(row, col))).toEqual({ row, col });
      }
    }
  });
});

describe("createEmptyBoard", () => {
  test("7x7=49マスがすべて空文字", () => {
    const b = createEmptyBoard();
    expect(Object.keys(b)).toHaveLength(SIZE * SIZE);
    expect(Object.values(b).every((v) => v === "")).toBe(true);
  });

  test("中央キー d4 を含む", () => {
    expect(createEmptyBoard()).toHaveProperty("d4", "");
  });
});

describe("isValidPosition", () => {
  test("盤内は true", () => {
    expect(isValidPosition(0, 0)).toBe(true);
    expect(isValidPosition(6, 6)).toBe(true);
    expect(isValidPosition(3, 3)).toBe(true);
  });

  test("盤外は false", () => {
    expect(isValidPosition(-1, 0)).toBe(false);
    expect(isValidPosition(0, -1)).toBe(false);
    expect(isValidPosition(SIZE, 0)).toBe(false);
    expect(isValidPosition(0, SIZE)).toBe(false);
  });
});

describe("getSymPoint（中心 c=3 に対する対称点）", () => {
  test("vertical は列を中心反転", () => {
    expect(getSymPoint(2, 1, "vertical")).toEqual([2, 5]);
  });
  test("horizontal は行を中心反転", () => {
    expect(getSymPoint(1, 2, "horizontal")).toEqual([5, 2]);
  });
  test("diag1 / diag2 の対称点", () => {
    // (2,1): dx=-1, dy=-2 -> diag1=[c-dy,c-dx]=[5,4], diag2=[c+dy,c+dx]=[1,2]
    expect(getSymPoint(2, 1, "diag1")).toEqual([5, 4]);
    expect(getSymPoint(2, 1, "diag2")).toEqual([1, 2]);
  });
  test("中心点はどの軸でも中心のまま", () => {
    for (const axis of GAME_CONSTANTS.AXES) {
      expect(getSymPoint(3, 3, axis)).toEqual([3, 3]);
    }
  });
  test("未知の軸は入力をそのまま返す", () => {
    expect(getSymPoint(2, 1, "unknown")).toEqual([2, 1]);
  });
});

describe("getPlacementHints（2つ目の配置候補）", () => {
  test("盤外候補は除外される", () => {
    for (const { row, col } of getPlacementHints(0, 0)) {
      expect(isValidPosition(row, col)).toBe(true);
    }
  });

  test("自分自身と同じ位置は含まれない", () => {
    const hints = getPlacementHints(2, 1);
    expect(hints).not.toContainEqual({ row: 2, col: 1 });
  });

  test("候補に重複がない", () => {
    const hints = getPlacementHints(2, 1);
    const keys = hints.map((h) => `${h.row},${h.col}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("中心(3,3)に置くと候補は無い（全軸が自分自身に写る）", () => {
    expect(getPlacementHints(3, 3)).toEqual([]);
  });
});

describe("checkVictory", () => {
  test("空盤面では勝者なし", () => {
    expect(checkVictory(createEmptyBoard(), "black")).toBe(false);
    expect(checkVictory(createEmptyBoard(), "white")).toBe(false);
  });

  test("2x2 の正方形で勝利", () => {
    // (0,0),(0,1),(1,0),(1,1) = a7,b7,a6,b6
    const b = board({ a7: "black", b7: "black", a6: "black", b6: "black" });
    expect(checkVictory(b, "black")).toBe(true);
    expect(checkVictory(b, "white")).toBe(false); // 色違いは勝利にならない
  });

  test("3つだけでは正方形が成立しない", () => {
    const b = board({ a7: "black", b7: "black", a6: "black" });
    expect(checkVictory(b, "black")).toBe(false);
  });

  test("十字（縦横）で勝利", () => {
    // 中心(1,1)とその上下左右
    const c = coordsToKey(1, 1);
    const b = board({
      [c]: "white",
      [coordsToKey(0, 1)]: "white",
      [coordsToKey(2, 1)]: "white",
      [coordsToKey(1, 0)]: "white",
      [coordsToKey(1, 2)]: "white",
    });
    expect(checkVictory(b, "white")).toBe(true);
  });

  test("十字（斜め）で勝利", () => {
    // 中心(2,2)とその四隅斜め
    const center = coordsToKey(2, 2);
    const b = board({
      [center]: "black",
      [coordsToKey(1, 1)]: "black",
      [coordsToKey(1, 3)]: "black",
      [coordsToKey(3, 1)]: "black",
      [coordsToKey(3, 3)]: "black",
    });
    expect(checkVictory(b, "black")).toBe(true);
  });

  test("十字は盤の端（外周）では成立しない", () => {
    // 中心を (0,1) に置くと上方向が盤外になり十字は作れない
    const b = board({
      [coordsToKey(0, 1)]: "black",
      [coordsToKey(1, 1)]: "black",
      [coordsToKey(0, 0)]: "black",
      [coordsToKey(0, 2)]: "black",
    });
    expect(checkVictory(b, "black")).toBe(false);
  });
});
