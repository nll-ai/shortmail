import { notFound } from "next/navigation";
import type { EmbedConfig } from "@/widget/config";
import { configUrl, convexSiteUrl } from "@/widget/api";

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
  if (!convexSiteUrl()) notFound();

  // httpActions (config + send) serve on the site URL, not the cloud URL.
  // The server-side fetch gives real 404s and the displayName for metadata.
  const res = await fetch(configUrl(vanityName), { cache: "no-store" });
  if (!res.ok) notFound();
  const config = (await res.json()) as EmbedConfig;

  return (
    <main
      className="min-h-svh bg-white px-4 py-10 text-[#171717]"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <div className="mx-auto max-w-lg border border-[#d4d4d4] bg-white p-6 sm:p-8">
        <script src="/widget.js" defer />
        <shortmail-widget vanity={vanityName} />
      </div>
      {/* displayName renders inside the widget; kept for metadata parity */}
      <meta name="shortmail:display-name" content={config.displayName} />
    </main>
  );
}
