"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { QueryBoundary } from "@/components/QueryBoundary";

type AdminRole = "moderator" | "admin" | "super_admin";
type CompKind = "lifetime" | "one_year";

function formatPeriodEnd(ms: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function AdminUsersPage() {
  return (
    <main className="mx-auto min-h-svh max-w-5xl bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold mb-4">User management</h1>
      <Link href="/admin" className="text-sm underline">
        ← Admin stats
      </Link>
      <div className="mt-4">
        <QueryBoundary>
          <AdminUsers />
        </QueryBoundary>
      </div>
    </main>
  );
}

function AdminUsers() {
  const me = useQuery(api.users.me);

  if (me === undefined) {
    return <p className="text-sm text-muted">Loading…</p>;
  }
  if (me === null || !me.adminRole) {
    return (
      <p className="border border-danger-border bg-danger-bg p-4 text-sm text-danger-foreground">
        Admin access required.
      </p>
    );
  }

  return <UsersPanel isSuperAdmin={me.adminRole === "super_admin"} />;
}

function UsersPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const users = useQuery(api.admin.listUsers);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [compKind, setCompKind] = useState<CompKind>("one_year");
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const setUserAdminRole = useMutation(api.admin.setUserAdminRole);
  const deleteUser = useMutation(api.admin.deleteUser);

  if (users === undefined) {
    return <p className="text-sm text-muted">Loading users…</p>;
  }

  async function compPremium(userId: Id<"users">) {
    setBusyUser(userId);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/billing/comp-premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, compKind }),
      });
      const body = (await res.json()) as { error?: string; compKind?: CompKind };
      if (!res.ok) {
        throw new Error(body.error ?? "Comp failed");
      }
      setSuccess(
        `Comped (${body.compKind ?? compKind}) — Premium will reflect after Stripe sync.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comp failed");
    } finally {
      setBusyUser(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Premium comps use Stripe 100% coupons (<code>shortmail_comp_lifetime</code> or{" "}
        <code>shortmail_comp_1yr</code>). One-year comps renew at list price only when the
        customer has a card on file; otherwise the subscription ends after one year.
      </p>
      <label className="flex items-center gap-2 text-sm">
        Default comp type:
        <select
          className="border border-line bg-background px-2 py-1 text-xs"
          value={compKind}
          onChange={(e) => setCompKind(e.target.value as CompKind)}
        >
          <option value="one_year">Free for one year</option>
          <option value="lifetime">Free for life</option>
        </select>
      </label>
      {error && (
        <p className="border border-danger-border bg-danger-bg p-3 text-sm text-danger-foreground">
          {error}
        </p>
      )}
      {success && (
        <p className="border border-info-border bg-info-bg p-3 text-sm text-info-foreground">
          {success}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-muted">
            <th className="py-1">Email</th>
            <th className="py-1">Vanity</th>
            <th className="py-1">Paid</th>
            <th className="py-1">Comp / period</th>
            <th className="py-1">Premium</th>
            {isSuperAdmin && <th className="py-1">Role</th>}
            {isSuperAdmin && <th className="py-1">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t align-middle">
              <td className="py-2">{u.email}</td>
              <td className="py-2 font-mono text-xs">{u.vanityName}</td>
              <td className="py-2 text-xs">{u.isPaid ? "yes" : "no"}</td>
              <td className="py-2 text-xs text-muted">
                {u.stripeCompKind ? (
                  <>
                    {u.stripeCompKind === "lifetime" ? "Lifetime" : "One year"}
                    {u.stripeCompKind === "one_year" && u.stripeCancelAtPeriodEnd
                      ? " (ends)"
                      : ""}
                    <br />
                    Until {formatPeriodEnd(u.stripeCurrentPeriodEnd)}
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2">
                <button
                  type="button"
                  className="border border-line px-3 py-0.5 text-xs disabled:opacity-50"
                  disabled={busyUser === u.id || Boolean(u.stripeSubscriptionId)}
                  onClick={() => void compPremium(u.id)}
                >
                  {u.stripeSubscriptionId ? "Subscribed" : "Comp Premium"}
                </button>
              </td>
              {isSuperAdmin && (
                <td className="py-2">
                  <select
                    className="border border-line bg-background px-1 py-0.5 text-xs text-foreground"
                    value={u.adminRole ?? ""}
                    onChange={async (e) => {
                      setError("");
                      const role = e.target.value;
                      try {
                        await setUserAdminRole({
                          userId: u.id,
                          role:
                            role === ""
                              ? null
                              : (role as AdminRole),
                        });
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Role update failed",
                        );
                      }
                    }}
                  >
                    <option value="">none</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                </td>
              )}
              {isSuperAdmin && (
                <td className="py-2">
                  <button
                    type="button"
                    className="text-xs text-danger hover:underline"
                    onClick={async () => {
                      if (!confirm(`Delete ${u.email}? This also removes their headings and FAQs.`)) {
                        return;
                      }
                      setError("");
                      try {
                        await deleteUser({ userId: u.id });
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Delete failed",
                        );
                      }
                    }}
                  >
                    delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
