import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = new URL("../", import.meta.url).pathname;

const PALETTE =
  /\b(bg-white|bg-black|text-white|text-black|text-gray-\d+|bg-gray-\d+|border-gray-\d+|text-red-\d+|bg-red-\d+|border-red-\d+|text-blue-\d+|text-green-\d+|bg-green-\d+|border-green-\d+|bg-amber-\d+|border-amber-\d+|text-amber-\d+|bg-indigo-\d+|border-indigo-\d+|text-indigo-\d+|border-neutral-\d+|bg-neutral-\d+|text-neutral-\d+)\b/;

/**
 * Product screens. Tests and the widget preset table are allowed to name
 * colors directly. Pages are not.
 *
 * :param dir: Directory to walk.
 * :returns: TSX files that ship in the app.
 */
function productScreens(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "widget" || entry === "theme") continue;
      found.push(...productScreens(full));
      continue;
    }
    if (!entry.endsWith(".tsx")) continue;
    if (entry.includes(".test.")) continue;
    found.push(full);
  }
  return found;
}

describe("page colors", () => {
  it("uses theme tokens instead of a fixed light palette", () => {
    const offenders: string[] = [];
    for (const file of productScreens(SRC)) {
      const text = readFileSync(file, "utf8");
      const relative = path.relative(SRC, file);
      if (PALETTE.test(text)) offenders.push(relative);
      const themeMeta = relative === "app/layout.tsx" || relative === "app/global-error.tsx";
      if (!themeMeta && /#[0-9a-fA-F]{3,8}/.test(text)) offenders.push(`${relative} hex`);
    }
    expect(offenders).toEqual([]);
  });
});
