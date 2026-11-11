import { applyTheme } from "@/widget/theme";
import { presetById } from "@/widget/presets";

/**
 * Hosted letter page chrome.
 *
 * The card uses the owner's preset. The default preset follows the OS.
 * Midnight, paper, high contrast, and custom CSS keep the colors the owner
 * saved. The page around the card follows the visitor's scheme.
 *
 * :param vanityName: Account slug mounted on the widget.
 * :param theme: Saved preset, or null when the account has not chosen one.
 * :param displayName: Optional name kept for metadata parity.
 */
export function SendFrame({
  vanityName,
  theme,
  displayName,
}: {
  vanityName: string;
  theme: { preset: string; customCss: string | null } | null;
  displayName?: string;
}) {
  const applied = applyTheme(theme);
  const scheme = presetById(theme?.preset ?? null).colorScheme;

  return (
    <main
      className="min-h-svh bg-background px-4 py-10 text-foreground"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <div
        className={`${applied.scopeClass} mx-auto max-w-lg border p-6 sm:p-8`}
        style={{
          ...applied.style,
          background: "var(--sm-bg)",
          color: "var(--sm-text)",
          borderColor: "var(--sm-border)",
          colorScheme: scheme,
        }}
      >
        <script src="/widget.js" defer />
        <shortmail-widget vanity={vanityName} />
      </div>
      {displayName ? (
        <meta name="shortmail:display-name" content={displayName} />
      ) : null}
    </main>
  );
}
