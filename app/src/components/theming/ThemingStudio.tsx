"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { THEME_PRESETS, presetById } from "../../widget/presets";
import { applyTheme } from "../../widget/theme";
import { UpgradeBillingCard } from "../billing/UpgradeBilling";
import { primaryClass } from "@/theme/controls";

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

  if (theme === undefined) {
    return <p className="text-sm text-muted">Loading theme…</p>;
  }
  if (theme === null) {
    return <p className="text-sm text-muted">Setting up your account…</p>;
  }
  if (theme.tier === "free") {
    return (
      <div className="mt-6 border border-info-border bg-info-bg p-6 text-info-foreground">
        <h2 className="text-lg font-semibold">Theming is a premium feature</h2>
        <p className="mt-2 text-sm">
          Pick a color preset and add your own CSS so your send form matches
          your site — on the hosted page and everywhere it is embedded.
        </p>
        <div className="mt-4">
          <UpgradeBillingCard compact />
        </div>
      </div>
    );
  }

  // Client-side preview uses the exact same apply path as the hosted page
  // (finding 3): sanitize + scope in ONE module, so the preview cannot drift.
  const preview = applyTheme({ preset: draftPreset, customCss: draftCss });

  async function handleSave() {
    setSaveState({ kind: "saving" });
    try {
      await save({ preset: draftPreset, customCss: draftCss });
      setSaveState({ kind: "saved" });
      // clear local drafts so the saved query values show through
      setPreset(null);
      setCustomCss(null);
    } catch (e) {
      const code =
        e instanceof Error && "data" in e
          ? String((e as { data?: unknown }).data)
          : e instanceof Error
            ? e.message
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
        <h3 className="text-sm font-semibold">Preset</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={` border px-4 py-1.5 text-sm ${
                draftPreset === p.id
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-line bg-background text-foreground hover:bg-surface"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Custom CSS (optional)</h3>
        <p className="mt-1 text-xs text-muted">
          Sanitized on save: url()/imports/fonts are stripped, 16KB max. Scope
          is the form only — it cannot affect the rest of any page.
        </p>
        <textarea
          value={draftCss}
          onChange={(e) => setCustomCss(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={'button {\n  letter-spacing: 0.02em;\n}'}
          className="mt-2 w-full border border-line bg-background p-3 font-mono text-xs text-foreground focus:border-foreground focus:outline-none"
        />
        {!preview.css && draftCss.trim() && (
          <p className="mt-1 text-xs text-warning-foreground">
            ⚠ Nothing to preview — the CSS was sanitized away or is invalid.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleSave()}
          disabled={saveState.kind === "saving"}
          className={primaryClass}
        >
          {saveState.kind === "saving" ? "Saving…" : "Save theme"}
        </button>
        {saveState.kind === "saved" && (
          <span className="text-sm text-success">Saved ✓ — live on your send page.</span>
        )}
        {saveState.kind === "error" && (
          <span className="text-sm text-danger">
            {saveState.message === "PREMIUM_REQUIRED"
              ? "Premium required."
              : saveState.message}
          </span>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold">Live preview</h3>
        <p className="mt-1 text-xs text-muted">
          Exactly what visitors see on your send page. Default follows the
          system scheme. A saved preset keeps its colors.
        </p>
        <div
          className="mt-3 border p-6"
          style={{
            ...preview.style,
            background: "var(--sm-bg)",
            color: "var(--sm-text)",
            borderColor: "var(--sm-border)",
            colorScheme: presetById(draftPreset).colorScheme,
          }}
        >
          {preview.css ? (
            <style dangerouslySetInnerHTML={{ __html: preview.css }} />
          ) : null}
          <div className={`${preview.scopeClass} space-y-3 rounded-[var(--sm-radius,0.75rem)] bg-[var(--sm-bg)] p-4 text-[var(--sm-text)]`}>
            {SAMPLE_MESSAGES.map((m) => (
              <div key={m.email} className="border-b border-[var(--sm-border)] pb-2 text-sm">
                <p className="font-medium">{m.name}</p>
                <p className="text-[var(--sm-muted)]">{m.email}</p>
                <p className="mt-1">{m.text}</p>
                <button className="mt-2 bg-[var(--sm-accent)] px-4 py-1 text-[var(--sm-accent-text)]">
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
