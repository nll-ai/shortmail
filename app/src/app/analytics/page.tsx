import { withAuth } from "@workos-inc/authkit-nextjs";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await withAuth({ ensureSignedIn: true });

  return (
    <main className="mx-auto min-h-svh max-w-3xl bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-muted">
        Form views and messages for your send page, last 30 days.
      </p>
      <AnalyticsDashboard />
    </main>
  );
}
