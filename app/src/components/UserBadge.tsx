"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserBadge() {
  const me = useQuery(api.users.me);

  if (me === undefined) {
    return <p className="text-sm text-gray-400">Loading Convex identity…</p>;
  }
  if (me === null) {
    return <p className="text-sm text-red-500">Convex identity: unauthenticated</p>;
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
