"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { QueryBoundary } from "@/components/QueryBoundary";

type AdminRole = "moderator" | "admin" | "super_admin";

export default function AdminUsersPage() {
  return (
    <main className="mx-auto min-h-svh max-w-3xl bg-background p-8 text-foreground">
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

  const setUserPaid = useMutation(api.admin.setUserPaid);
  const setUserAdminRole = useMutation(api.admin.setUserAdminRole);
  const deleteUser = useMutation(api.admin.deleteUser);

  if (users === undefined) {
    return <p className="text-sm text-muted">Loading users…</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="border border-danger-border bg-danger-bg p-3 text-sm text-danger-foreground">
          {error}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-muted">
            <th className="py-1">Email</th>
            <th className="py-1">Vanity</th>
            <th className="py-1">Paid</th>
            {isSuperAdmin && <th className="py-1">Role</th>}
            {isSuperAdmin && <th className="py-1">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t align-middle">
              <td className="py-2">{u.email}</td>
              <td className="py-2 font-mono text-xs">{u.vanityName}</td>
              <td className="py-2">
                <button
                  type="button"
                  className={` border px-3 py-0.5 text-xs ${
                    u.isPaid
                      ? "border-success text-success"
                      : "border-line text-muted"
                  }`}
                  onClick={async () => {
                    setError("");
                    try {
                      await setUserPaid({ userId: u.id, isPaid: !u.isPaid });
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : "Update failed",
                      );
                    }
                  }}
                >
                  {u.isPaid ? "paid" : "free"}
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
