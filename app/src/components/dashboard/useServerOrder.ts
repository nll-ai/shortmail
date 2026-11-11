"use client";

import { useRef, useState } from "react";
import { reconcilePending } from "../../../convex/lib/order";

/**
 * Show a local order immediately, then drop it once the server list agrees.
 *
 * The latest query wins after a successful save. A failed save clears the
 * local order so the screen returns to the last server list. An older save
 * that fails after a newer move does not wipe the newer order.
 *
 * :param items: The list from the server, already in display order.
 * :returns: The list to render, plus start/fail helpers for a move.
 */
export function useServerOrder<T extends { id: string }>(items: readonly T[]): {
  shown: readonly T[];
  begin: (next: readonly T[]) => number;
  fail: (token: number) => void;
} {
  const [pending, setPending] = useState<readonly T[] | null>(null);
  const generation = useRef(0);
  const signature = items.map((item) => item.id).join("\0");
  const [seenSignature, setSeenSignature] = useState(signature);

  if (signature !== seenSignature) {
    setSeenSignature(signature);
    if (
      pending &&
      reconcilePending(
        pending.map((item) => item.id),
        items.map((item) => item.id),
      ) === "clear"
    ) {
      setPending(null);
    }
  }

  return {
    shown: pending ?? items,
    begin(next) {
      const token = ++generation.current;
      setPending(next);
      return token;
    },
    fail(token) {
      if (token !== generation.current) return;
      setPending(null);
    },
  };
}
