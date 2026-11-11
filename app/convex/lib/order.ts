/**
 * Order for subject headings and FAQs.
 *
 * `position` is optional so documents written before ordering still validate.
 * A list where every row omits it keeps today's order: ascending creation
 * time. Once a row has a position, rows that still omit it sort after the
 * positioned ones (a legacy insert during a rolling deploy lands at the end
 * instead of jumping ahead). Equal positions break ties by creation time.
 *
 * Reorder writes 0..n-1 for the caller's rows. New rows use the next index,
 * after any missing positions on that owner's existing rows are filled in.
 */

export type Orderable = {
  position?: number;
  _creationTime: number;
};

export type OwnedItem = Orderable & {
  id: string;
};

/**
 * Compare two rows for display.
 *
 * :param a: One row.
 * :param b: The other row.
 * :returns: A negative number when `a` comes first, positive when `b` does,
 *   and zero when creation time also matches.
 */
export function compareOrderable(a: Orderable, b: Orderable): number {
  if (a.position !== undefined && b.position !== undefined) {
    if (a.position !== b.position) return a.position - b.position;
    return a._creationTime - b._creationTime;
  }
  if (a.position !== undefined) return -1;
  if (b.position !== undefined) return 1;
  return a._creationTime - b._creationTime;
}

/**
 * Return a copy of `rows` in display order.
 *
 * :param rows: Rows to sort. The input array is not modified.
 * :returns: The sorted copy.
 */
export function sortByOrder<T extends Orderable>(rows: readonly T[]): T[] {
  return [...rows].sort(compareOrderable);
}

/**
 * Positions to persist so `rows` keep their current display order as 0..n-1.
 *
 * Rows that already have the right index are omitted.
 *
 * :param rows: One owner's rows.
 * :returns: Patches to apply. Empty when the list is already normalized.
 */
export function sequentialPositions<T extends OwnedItem>(
  rows: readonly T[],
): { id: string; position: number }[] {
  const writes: { id: string; position: number }[] = [];
  sortByOrder(rows).forEach((row, position) => {
    if (row.position !== position) writes.push({ id: row.id, position });
  });
  return writes;
}

/**
 * The id order to store for a reorder.
 *
 * Requested ids the owner still has come first, in that order, without
 * duplicates. Ids the client did not send (a row inserted after the client
 * read the list) keep their current display order and are appended. Ids that
 * are not in `owned` are skipped; the caller rejects ones that exist but
 * belong to someone else before calling this.
 *
 * :param owned: The caller's current rows.
 * :param requestedIds: The order the client asked for.
 * :returns: The id sequence to number as 0..n-1.
 */
export function planReorder(
  owned: readonly OwnedItem[],
  requestedIds: readonly string[],
): string[] {
  const ownedIds = new Set(owned.map((row) => row.id));
  const seen = new Set<string>();
  const head: string[] = [];
  for (const id of requestedIds) {
    if (seen.has(id) || !ownedIds.has(id)) continue;
    seen.add(id);
    head.push(id);
  }
  const rest = sortByOrder(owned.filter((row) => !seen.has(row.id))).map((row) => row.id);
  return [...head, ...rest];
}

/**
 * Move one item toward the start or the end.
 *
 * :param items: The current display order.
 * :param index: The item to move.
 * :param delta: `-1` for up, `1` for down.
 * :returns: The next order, or null when the move would pass an end.
 */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] | null {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return null;
  const next = items.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * Whether the up and down controls should be disabled.
 *
 * :param index: The item's place in the current list.
 * :param count: How many items are shown.
 * :returns: `up` is disabled on the first row, `down` on the last.
 */
export function moveDisabled(index: number, count: number): { up: boolean; down: boolean } {
  return { up: index <= 0, down: index >= count - 1 || count === 0 };
}

/**
 * Decide whether an optimistic order can be dropped in favor of the server.
 *
 * Extras on the server (a row added concurrently) are ignored as long as the
 * rows the client reordered appear in the requested order. A row the server
 * no longer has is treated as deleted.
 *
 * :param pendingIds: The order the client is showing.
 * :param serverIds: The order from the latest query.
 * :returns: `"clear"` when the server agrees, `"keep"` while it still shows
 *   the previous order.
 */
export function reconcilePending(
  pendingIds: readonly string[],
  serverIds: readonly string[],
): "clear" | "keep" {
  const pending = new Set(pendingIds);
  const server = new Set(serverIds);
  const stillThere = pendingIds.filter((id) => server.has(id));
  const known = serverIds.filter((id) => pending.has(id));
  const aligned =
    known.length === stillThere.length && known.every((id, index) => id === stillThere[index]);
  return aligned ? "clear" : "keep";
}
