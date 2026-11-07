import { withAuth } from "@workos-inc/authkit-nextjs";
import { QueryBoundary } from "@/components/QueryBoundary";
import { SignOutButton } from "@/components/SignOutButton";
import { DashboardData } from "@/components/dashboard/DashboardData";

export default async function Dashboard() {
  const { user } = await withAuth({ ensureSignedIn: true });

  return (
    <main className="mx-auto max-w-6xl p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-2xl font-bold">ShortMail Dashboard</h1>
          <p className="mt-2">
            Signed in as <strong>{user.email}</strong>
          </p>
        </div>
        <SignOutButton />
      </div>
      <QueryBoundary>
        <DashboardData />
      </QueryBoundary>
    </main>
  );
}
