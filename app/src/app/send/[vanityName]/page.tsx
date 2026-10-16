import { notFound } from "next/navigation";
import { presetVarsAsStyle } from "@/widget/presets";
import { scopeCss } from "@/widget/scopeCss";
import { SendForm, type EmbedConfig } from "@/components/SendForm";

// Config must reflect the live Convex deployment (new headings appear
// immediately); never cache at build time.
export const dynamic = "force-dynamic";

type PageTheme = { preset: string; customCss: string | null } | null;
type SendConfig = {
  displayName: string;
  vanityName: string;
  headings: string[];
  faqs: { question: string; answer: string }[];
  isPaid: boolean;
  theme: PageTheme;
};

export default async function SendPage({
  params,
}: {
  params: Promise<{ vanityName: string }>;
}) {
  const { vanityName } = await params;
  const base = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!base) notFound();

  // httpActions (config + send) serve on the .site twin, not .cloud.
  const convexSiteUrl = base.replace(".convex.cloud", ".convex.site");

  const res = await fetch(
    `${convexSiteUrl}/api/embed/${encodeURIComponent(vanityName)}/config`,
    { cache: "no-store" },
  );
  if (!res.ok) notFound();
  const config = (await res.json()) as EmbedConfig & SendConfig;

  const themeVars = presetVarsAsStyle(config.theme?.preset ?? null);
  const scopedCustomCss = config.theme?.customCss
    ? scopeCss(config.theme.customCss, ".shortmail-scope")
    : "";

  return (
    <main
      className="mx-auto max-w-lg p-8"
      style={presetVarsAsStyle(config.theme?.preset ?? null)}
    >
      {scopedCustomCss ? (
        <style dangerouslySetInnerHTML={{ __html: scopedCustomCss }} />
      ) : null}
      <h1 className="text-2xl font-bold text-[var(--sm-text,#111111)]">
        Send a shortmail
      </h1>
      <p className="mt-1 mb-6 text-[var(--sm-muted,#4b5563)]">
        To <strong>{config.displayName}</strong> — max 500 characters.
      </p>
      <div className="shortmail-scope">
        <SendForm
          config={config}
          convexSiteUrl={convexSiteUrl}
          themeVars={themeVars}
        />
      </div>
    </main>
  );
}
