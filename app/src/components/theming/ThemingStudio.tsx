"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { sanitizeCss } from "../../../convex/lib/cssSanitize";
import {
  THEME_PRESETS,
  presetVarsAsStyle,
} from "../../widget/presets";

const SAMPLE_MESSAGES = [
  { name: "Ada Lovelace", email: "ada@example.com", text: "Loved your talk — any chance you could keynote our meetup next month?" },
  { name: "Grace Hopper", email: "grace@example.org", text: "Following up from the conference. Would love to pick your brain sometime." },
];

export function ThemingStudio() {
  const theme = useQuery(api.theming.myTheme);
  const save = useMutation(api.theming.saveTheme);

  const [preset, setPreset] = useState<string | null>(null);
  const [customCss, setCustomCss] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string }
  >({ kind: "idle" });

  const draftPreset = preset ?? (theme?.tier === "premium" ? theme.preset : "default");
  const draftCss = customCss ?? (theme?.tier === "premium" ? (theme.customCss ?? "") : "");
  const themeVars = useMemo(() => presetVarsAsStyle(draftPreset), [draftPreset]);

  if (theme === undefined) {
    return <p className="text-sm text-gray-400">Loading theme…</p>;
  }
  if (theme === null) {
    return <p className="text-sm text-gray-400">Setting up your account…</p>;
  }
  if (theme.tier === "free") {
    return (
      <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 p-6">
        <h2 className="text-lg font-semibold">Theming is a premium feature</h2>
        <p className="mt-2 text-sm text-gray-600">
          Pick a color preset and add your own CSS so your send form matches
          your site — on the hosted page and everywhere it is embedded.
        </p>
        <a
          href="mailto:eric.ma@nonlinearlabs.ai?subject=ShortMail%20premium"
          className="mt-4 inline-block rounded-full bg-black px-5 py-2 text-sm text-white hover:opacity-80"
        >
          Upgrade to premium
        </a>
      </div>
    );
  }

  // Client-side preview uses the exact same sanitizer as save-time (R2).
  const previewSanitized = sanitizeCss(draftCss);
  const previewCss =
    previewSanitized.ok ? previewSanitized.css.replace(/(^|\n)(?!\s*\.shortmail-scope)/g, "$1.shortmail-scope ") : "";

  async function handleSave() {
    setSaveState({ kind: "saving" });
    const result = await save({ preset: draftPreset, customCss: draftCss });
    if (result.ok) {
      setSaveState({ kind: "saved" });
      // clear local drafts so the saved query values show through
      setPreset(null);
      setCustomCss(null);
    } else {
      setSaveState({ kind: "error", message: result.error ?? "Save failed" });
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold">Preset</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-full border px-4 py-1.5 text-sm ${
                draftPreset === p.id
                  ? "border-black bg-black text-white"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Custom CSS (optional)</h3>
        <p className="mt-1 text-xs text-gray-500">
          Sanitized on save: url()/imports/fonts are stripped, 16KB max. Scope
          is the form only — it cannot affect the rest of any page.
        </p>
        <textarea
          value={draftCss}
          onChange={(e) => setCustomCss(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={'button {\n  letter-spacing: 0.02em;\n}'}
          className="mt-2 w-full rounded-lg border border-gray-300 p-3 font-mono text-xs focus:border-black focus:outline-none"
        />
        {!previewSanitized.ok && (
          <p className="mt-1 text-xs text-red-600">⚠ {previewSanitized.error}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleSave()}
          disabled={saveState.kind === "saving"}
          className="rounded-full bg-black px-5 py-2 text-sm text-white hover:opacity-80 disabled:opacity-40"
        >
          {saveState.kind === "saving" ? "Saving…" : "Save theme"}
        </button>
        {saveState.kind === "saved" && (
          <span className="text-sm text-green-700">Saved ✓ — live on your send page.</span>
        )}
        {saveState.kind === "error" && (
          <span className="text-sm text-red-600">
            {saveState.message === "PREMIUM_REQUIRED"
              ? "Premium required."
              : saveState.message}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Live preview</h3>
        <p className="mt-1 text-xs text-gray-500">
          Exactly what visitors see on your send page.
        </p>
        <div
          className="mt-3 rounded-lg border p-6"
          style={themeVars}
        >
          {previewCss ? (
            <style
              dangerouslySetInnerHTML={{
                __html: previewCss.split(".shortmail-scope").join(".shortmail-scope"),
              }}
            />
          ) : null}
          <div className="shortmail-scope space-y-3 rounded-[var(--sm-radius,0.75rem)] bg-[var(--sm-bg,#ffffff)] p-4 text-[var(--sm-text,#111111)]">
            {SAMPLE_MESSAGES.map((m) => (
              <div key={m.email} className="border-b border-[var(--sm-border,#e5e7eb)] pb-2 text-sm">
                <p className="font-medium">{m.name}</p>
                <p className="text-[var(--sm-muted,#6b7280)]">{m.email}</p>
                <p className="mt-1">{m.text}</p>
                <button className="mt-2 rounded-full bg-[var(--sm-accent,#111111)] px-4 py-1 text-[var(--sm-accent-text,#ffffff)]">
                  Reply
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
