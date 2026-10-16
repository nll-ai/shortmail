import { notFound } from "next/navigation";
import { SendForm, type EmbedConfig } from "@/components/SendForm";

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

  const res = await fetch(
    `${base}/api/embed/${encodeURIComponent(vanityName)}/config`,
    { cache: "no-store" },
  );
  if (!res.ok) notFound();
  const config = (await res.json()) as EmbedConfig;

  // The send httpAction lives on the .site twin of the .cloud base URL.
  const convexSiteUrl = base.replace(".convex.cloud", ".convex.site");

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-2xl font-bold">Send a shortmail</h1>
      <p className="mt-1 mb-6 text-gray-600">
        To <strong>{config.displayName}</strong> — max 500 characters.
      </p>
      <SendForm config={config} convexSiteUrl={convexSiteUrl} />
    </main>
  );
}
