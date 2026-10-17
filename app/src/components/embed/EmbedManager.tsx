"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";

const PROD_WIDGET_URL = "https://shortmail-gamma.vercel.app/widget.js";

function originOf(input: string): string | null {
  const trimmed = input.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function EmbedManager() {
  const me = useQuery(api.users.me);
  const save = useMutation(api.users.setEmbedAllowedOrigins);

  const [draft, setDraft] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  if (me === undefined) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }
  if (me === null) {
    return <p className="text-sm text-red-500">Sign in required.</p>;
  }

  const originsValue =
    draft ?? (me.embedAllowedOrigins ?? []).join("\n");
  const vanity = me.vanityName;

  const snippet = `<script src="${PROD_WIDGET_URL.replace(
    "https://shortmail-gamma.vercel.app",
    typeof window !== "undefined" ? window.location.origin : "https://shortmail-gamma.vercel.app",
  )}" defer></script>
<shortmail-widget vanity="${vanity}"></shortmail-widget>`;

  async function handleSave(): Promise<void> {
    setSaveState({ kind: "saving" });
    const origins = originsValue
      .split("\n")
      .map(originOf)
      .filter((o): o is string => Boolean(o));
    try {
      await save({ origins });
      setDraft(null);
      setSaveState({ kind: "saved" });
    } catch (e) {
      const code =
        e instanceof Error && "data" in e
          ? String((e as { data?: unknown }).data)
          : "Save failed";
      setSaveState({
        kind: "error",
        message: code === "PREMIUM_REQUIRED" ? "Premium required." : code,
      });
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold">1. Your embed snippet</h3>
        <pre className="mt-2 rounded-lg bg-gray-900 p-4 text-xs text-gray-100 overflow-x-auto">
          {snippet}
        </pre>
        <p className="mt-1 text-xs text-gray-500">
          Paste into any HTML page. The form renders inside a shadow root —
          no iframe. See{" "}
          <a href="/embed-docs" className="underline">
            embed docs
          </a>
          .
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold">2. Restrict embedding (optional)</h3>
        <p className="mt-1 text-xs text-gray-500">
          One origin per line (e.g. <code>https://yoursite.com</code>). Empty
          = your form may be embedded anywhere. Non-matching sites get a
          &quot;not allowed&quot; state instead of your form.
        </p>
        <textarea
          value={originsValue}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          spellCheck={false}
          className="mt-2 w-full rounded-lg border border-gray-300 p-3 font-mono text-xs focus:border-black focus:outline-none"
          placeholder={"https://yoursite.com"}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={() => void handleSave()}
            disabled={saveState.kind === "saving" || draft === null}
            className="rounded-full bg-black px-5 py-2 text-sm text-white hover:opacity-80 disabled:opacity-40"
          >
            {saveState.kind === "saving" ? "Saving…" : "Save origins"}
          </button>
          {saveState.kind === "saved" && (
            <span className="text-sm text-green-700">Saved ✓</span>
          )}
          {saveState.kind === "error" && (
            <span className="text-sm text-red-600">{saveState.message}</span>
          )}
        </div>
      </div>
    </div>
  );
}
