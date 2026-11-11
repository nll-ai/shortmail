import { describe, expect, it } from "vitest";
import { applyTheme } from "./theme";
import { presetById, THEME_PRESETS } from "./presets";

describe("theme presets", () => {
  it("lets the default preset follow the system scheme", () => {
    const preset = presetById("default");
    expect(preset.colorScheme).toBe("light dark");
    expect(preset.vars["--sm-bg"]).toBe("light-dark(#ffffff, #0a0a0a)");
    expect(preset.vars["--sm-text"]).toBe("light-dark(#171717, #ededed)");
    expect(preset.vars["--sm-muted"]).toBe("light-dark(#525252, #a3a3a3)");
    expect(preset.vars["--sm-danger"]).toContain("light-dark(");

    const missing = applyTheme(null);
    expect(missing.style).toMatchObject({
      "--sm-bg": "light-dark(#ffffff, #0a0a0a)",
    });
    const savedDefault = applyTheme({ preset: "default", customCss: null });
    expect(savedDefault.style).toMatchObject(missing.style);
  });

  it("keeps explicit preset colors when the system scheme changes", () => {
    expect(presetById("midnight").colorScheme).toBe("dark");
    expect(presetById("midnight").vars["--sm-bg"]).toBe("#0b1020");
    expect(presetById("midnight").vars["--sm-text"]).toBe("#e5e7eb");
    expect(presetById("paper").colorScheme).toBe("light");
    expect(presetById("paper").vars["--sm-bg"]).toBe("#faf6ef");
    expect(presetById("paper").vars["--sm-text"]).toBe("#3b2f24");
    expect(presetById("contrast").colorScheme).toBe("dark");
    expect(presetById("contrast").vars["--sm-bg"]).toBe("#000000");
    expect(presetById("contrast").vars["--sm-accent"]).toBe("#ffe500");

    for (const preset of THEME_PRESETS) {
      if (preset.id === "default") continue;
      for (const value of Object.values(preset.vars)) {
        expect(value, preset.id).not.toContain("light-dark(");
      }
    }
  });

  it("still applies sanitized custom CSS on top of a preset", () => {
    const applied = applyTheme({
      preset: "midnight",
      customCss: "button { letter-spacing: 0.2em; }",
    });
    expect(applied.style).toMatchObject({ "--sm-bg": "#0b1020" });
    expect(applied.css).toContain("letter-spacing: 0.2em");
    expect(applied.scopeClass).toBe("shortmail-scope");
  });
});
