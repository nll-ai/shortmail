import { notFound } from "next/navigation";
import { applyTheme } from "@/widget/theme";
import { SendForm } from "@/components/SendForm";
import type { EmbedConfig } from "@/widget/config";

// Config must reflect the live Convex deployment (new headings appear
// immediately); never cache at build time.
export const dynamic = "force-dynamic";

export default async function SendPage({
  params,
}: {
  params: Promise<{ vanityName: string }>;
}) {
  const { vanityName } = await params;
  const base = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!base) notFound();

  // httpActions (config + send) serve on the .site twin, not .cloud.
  const res = await fetch(
    `${base.replace(".convex.cloud", ".convex.site")}/api/embed/${encodeURIComponent(vanityName)}/config`,
    { cache: "no-store" },
  );
  if (!res.ok) notFound();
  const config = (await res.json()) as EmbedConfig;

  const { style: themeStyle, css: scopedCustomCss, scopeClass } = applyTheme(
    config.theme,
  );

  return (
    <main className="mx-auto max-w-lg p-8" style={themeStyle}>
      {scopedCustomCss ? (
        <style dangerouslySetInnerHTML={{ __html: scopedCustomCss }} />
      ) : null}
      <h1 className="text-2xl font-bold text-[var(--sm-text,#111111)]">
        Send a shortmail
      </h1>
      <p className="mt-1 mb-6 text-[var(--sm-muted,#4b5563)]">
        To <strong>{config.displayName}</strong> — max 500 characters.
      </p>
      <div className={scopeClass}>
        <SendForm config={config} themeVars={themeStyle} />
      </div>
    </main>
  );
}
