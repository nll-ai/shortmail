"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../convex/_generated/api";
import { QueryBoundary } from "@/components/QueryBoundary";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      <QueryBoundary>
        <AdminHome />
      </QueryBoundary>
    </main>
  );
}

function AdminHome() {
  const me = useQuery(api.users.me);

  if (me === undefined) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }
  if (me === null || !me.adminRole) {
    return (
      <p className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        Admin access required.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Signed in as <strong>{me.email}</strong> — role:{" "}
        <code>{me.adminRole}</code>
      </p>
      <Link href="/admin/users" className="text-sm underline">
        Manage users →
      </Link>
      <StatsPanel />
    </div>
  );
}

function StatsPanel() {
  const stats = useQuery(api.admin.adminStats);

  if (stats === undefined) {
    return <p className="text-sm text-gray-400">Loading stats…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total users" value={stats.totalUsers} />
        <StatCard label="Paid" value={stats.paidUsers} />
        <StatCard label="Free" value={stats.freeUsers} />
        <StatCard label="Admins" value={stats.adminUsers} />
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 text-base font-semibold">10 most recent users</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase text-gray-500">
              <th className="py-1">Email</th>
              <th className="py-1">Vanity</th>
              <th className="py-1">Paid</th>
              <th className="py-1">Role</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentUsers.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-1">{u.email}</td>
                <td className="py-1 font-mono text-xs">{u.vanityName}</td>
                <td className="py-1">{u.isPaid ? "yes" : "no"}</td>
                <td className="py-1">{u.adminRole ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
