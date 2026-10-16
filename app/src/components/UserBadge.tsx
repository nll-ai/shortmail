"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";

export function UserBadge() {
  const me = useQuery(api.users.me);
  const ensure = useMutation(api.users.ensureMe);
  // Self-provision on first login: `me` returns null until the row exists.
  const ensureStarted = useRef(false);
  useEffect(() => {
    if (me === null && !ensureStarted.current) {
      ensureStarted.current = true;
      void ensure();
    }
  }, [me, ensure]);

  if (me === undefined) {
    return <p className="text-sm text-gray-400">Loading Convex identity…</p>;
  }
  if (me === null) {
    return <p className="text-sm text-gray-400">Setting up your account…</p>;
  }

  return (
    <div className="mt-4 rounded-lg border p-4 text-sm">
      <p>
        <strong>Convex user row:</strong> {me.email}
      </p>
      <p>
        vanity: <code>{me.vanityName}</code> · isPaid:{" "}
        <code>{String(me.isPaid)}</code> · adminRole:{" "}
        <code>{me.adminRole ?? "none"}</code>
      </p>
    </div>
  );
}
