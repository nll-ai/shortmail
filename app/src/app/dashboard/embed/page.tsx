import { withAuth } from "@workos-inc/authkit-nextjs";
import { EmbedManager } from "@/components/embed/EmbedManager";

export const dynamic = "force-dynamic";

export default async function EmbedPage() {
  await withAuth({ ensureSignedIn: true });

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Embed your form</h1>
      <p className="mt-1 text-sm text-gray-600">
        Put your ShortMail form on any website with one script tag — no iframe.
      </p>
      <EmbedManager />
    </main>
  );
}
