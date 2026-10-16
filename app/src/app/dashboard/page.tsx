import { withAuth } from "@workos-inc/authkit-nextjs";
import { UserBadge } from "@/components/UserBadge";
import { QueryBoundary } from "@/components/QueryBoundary";
import { DashboardData } from "@/components/dashboard/DashboardData";

export default async function Dashboard() {
  const { user } = await withAuth({ ensureSignedIn: true });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold mb-4">ShortMail Dashboard</h1>
      <p className="mb-2">
        Signed in as <strong>{user.email}</strong>
      </p>
      <UserBadge />
      <QueryBoundary>
        <DashboardData />
      </QueryBoundary>
    </main>
  );
}
