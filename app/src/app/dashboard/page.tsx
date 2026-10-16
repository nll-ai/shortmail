import { withAuth } from "@workos-inc/authkit-nextjs";
import { UserBadge } from "@/components/UserBadge";

export default async function Dashboard() {
  const { user } = await withAuth({ ensureSignedIn: true });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold mb-4">ShortMail Dashboard</h1>
      <p className="mb-2">
        Signed in as <strong>{user.email}</strong>
      </p>
      <UserBadge />
      <p className="mt-6 text-sm text-gray-500">
        Feature parity (headings, FAQs, admin) lands in P1 — issue #23.
      </p>
    </main>
  );
}
