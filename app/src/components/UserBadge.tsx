"use client";

import { api } from "../../convex/_generated/api";
import { useMe } from "./useMe";

export function UserBadge() {
  const { me } = useMe();

  if (me === undefined || me === null) {
    return (
      <p className="text-sm text-gray-400">
        {me === null ? "Setting up your account…" : "Loading Convex identity…"}
      </p>
    );
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
