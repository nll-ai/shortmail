import { notFound } from "next/navigation";
import type { EmbedConfig } from "@/widget/config";

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
    <main className="mx-auto max-w-lg px-4 py-10">
      <div className="border border-neutral-300 bg-white p-6 sm:p-8">
        <script src="/widget.js" defer />
        <shortmail-widget vanity={vanityName} />
      </div>
      {/* displayName renders inside the widget; kept for metadata parity */}
      <meta name="shortmail:display-name" content={config.displayName} />
    </main>
  );
}
