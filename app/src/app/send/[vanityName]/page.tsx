import { notFound } from "next/navigation";
import type { EmbedConfig } from "@/widget/config";
import { SendFrame } from "../SendFrame";

// Config must reflect the live Convex deployment (new headings appear
// immediately); never cache at build time.
export const dynamic = "force-dynamic";

/**
 * The hosted send page is a shell: title, 404 handling, and the widget.
 * The widget (src/widget/shortmail-widget.ts) owns form rendering,
 * theming, submission and analytics — one implementation shared with the
 * embeddable embed (plan §3.5).
 */
export default async function SendPage({
  params,
}: {
  params: Promise<{ vanityName: string }>;
}) {
  const { vanityName } = await params;
  const base = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!base) notFound();

  // httpActions (config + send) serve on the .site twin, not .cloud. The
  // server-side fetch gives real 404s and the displayName for metadata.
  const res = await fetch(
    `${base.replace(".convex.cloud", ".convex.site")}/api/embed/${encodeURIComponent(vanityName)}/config`,
    { cache: "no-store" },
  );
  if (!res.ok) notFound();
  const config = (await res.json()) as EmbedConfig;

  return (
    <SendFrame
      vanityName={vanityName}
      theme={config.theme}
      displayName={config.displayName}
    />
  );
}
