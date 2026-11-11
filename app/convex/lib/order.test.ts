import { describe, expect, it } from "vitest";
import {
  compareOrderable,
  moveDisabled,
  moveItem,
  planReorder,
  reconcilePending,
  sequentialPositions,
  sortByOrder,
  type OwnedItem,
} from "./order";

function row(id: string, createdAt: number, position?: number): OwnedItem {
  return position === undefined
    ? { id, _creationTime: createdAt }
    : { id, _creationTime: createdAt, position };
}

describe("sortByOrder", () => {
  it("keeps creation order when no row has a position", () => {
    const rows = [row("c", 30), row("a", 10), row("b", 20)];
    expect(sortByOrder(rows).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("treats position 0 as an explicit first place", () => {
    const rows = [row("later", 50, 0), row("earlier", 10, 1)];
    expect(sortByOrder(rows).map((item) => item.id)).toEqual(["later", "earlier"]);
  });

  it("lets an explicit order beat creation time", () => {
    const rows = [row("old", 1, 2), row("mid", 2, 0), row("new", 3, 1)];
    expect(sortByOrder(rows).map((item) => item.id)).toEqual(["mid", "new", "old"]);
  });

  it("breaks equal positions by creation time", () => {
    const rows = [row("second", 20, 1), row("first", 10, 1)];
    expect(sortByOrder(rows).map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("places rows that still have no position after positioned rows", () => {
    const rows = [row("legacy-b", 20), row("positioned", 99, 0), row("legacy-a", 10)];
    expect(sortByOrder(rows).map((item) => item.id)).toEqual([
      "positioned",
      "legacy-a",
      "legacy-b",
    ]);
  });

  it("does not mutate the input", () => {
    const rows = [row("b", 2), row("a", 1)];
    sortByOrder(rows);
    expect(rows.map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("sequentialPositions", () => {
  it("numbers an unpositioned list in creation order", () => {
    expect(sequentialPositions([row("b", 2), row("a", 1)])).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]);
  });

  it("leaves a list that is already 0..n-1 alone", () => {
    expect(sequentialPositions([row("a", 2, 0), row("b", 1, 1)])).toEqual([]);
  });

  it("closes gaps without changing the displayed order", () => {
    expect(sequentialPositions([row("a", 1, 0), row("c", 3, 5), row("b", 2, 2)])).toEqual([
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ]);
  });

  it("preserves an explicit order that differs from creation time", () => {
    expect(sequentialPositions([row("old", 1, 1), row("new", 9, 0)])).toEqual([]);
    expect(sortByOrder([row("old", 1, 1), row("new", 9, 0)]).map((item) => item.id)).toEqual([
      "new",
      "old",
    ]);
  });
});

describe("planReorder", () => {
  const owned = [row("a", 1, 0), row("b", 2, 1), row("c", 3, 2)];

  it("uses the requested permutation", () => {
    expect(planReorder(owned, ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("drops duplicate ids and keeps the first occurrence", () => {
    expect(planReorder(owned, ["b", "b", "a"])).toEqual(["b", "a", "c"]);
  });

  it("skips ids the owner no longer has and appends omitted rows in current order", () => {
    expect(planReorder(owned, ["c", "missing", "a"])).toEqual(["c", "a", "b"]);
  });

  it("appends a row the client had not seen, in its current order", () => {
    const withNew = [...owned, row("d", 4)];
    expect(planReorder(withNew, ["b", "a", "c"])).toEqual(["b", "a", "c", "d"]);
  });

  it("normalizes to the current order when the client sends nothing", () => {
    expect(planReorder(owned, [])).toEqual(["a", "b", "c"]);
  });
});

describe("moveItem", () => {
  const items = ["a", "b", "c"];

  it("moves an item up or down", () => {
    expect(moveItem(items, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(items, 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("refuses a move past either end", () => {
    expect(moveItem(items, 0, -1)).toBeNull();
    expect(moveItem(items, 2, 1)).toBeNull();
    expect(moveItem(items, -1, 1)).toBeNull();
    expect(moveItem(["only"], 0, -1)).toBeNull();
    expect(moveItem(["only"], 0, 1)).toBeNull();
  });

  it("does not mutate the input", () => {
    moveItem(items, 0, 1);
    expect(items).toEqual(["a", "b", "c"]);
  });
});

describe("moveDisabled", () => {
  it("disables up on the first row and down on the last", () => {
    expect(moveDisabled(0, 3)).toEqual({ up: true, down: false });
    expect(moveDisabled(1, 3)).toEqual({ up: false, down: false });
    expect(moveDisabled(2, 3)).toEqual({ up: false, down: true });
  });

  it("disables both controls when the list has one row", () => {
    expect(moveDisabled(0, 1)).toEqual({ up: true, down: true });
  });
});

describe("reconcilePending", () => {
  it("keeps the optimistic order until the server matches it", () => {
    expect(reconcilePending(["b", "a", "c"], ["a", "b", "c"])).toBe("keep");
    expect(reconcilePending(["b", "a", "c"], ["b", "a", "c"])).toBe("clear");
  });

  it("clears when the server appended a row the client had not reordered", () => {
    expect(reconcilePending(["b", "a"], ["b", "a", "d"])).toBe("clear");
  });

  it("clears when the server dropped a row and the rest match", () => {
    expect(reconcilePending(["b", "a", "c"], ["b", "a"])).toBe("clear");
  });
});

describe("compareOrderable", () => {
  it("returns zero for the same creation time when neither row is positioned", () => {
    expect(compareOrderable({ _creationTime: 5 }, { _creationTime: 5 })).toBe(0);
  });
});
