"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "../../../../convex/_generated/api";
import { QueryBoundary } from "@/components/QueryBoundary";

type AdminRole = "moderator" | "admin" | "super_admin";

export default function AdminUsersPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
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
    return <p className="text-sm text-gray-400">Loading…</p>;
  }
  if (me === null || !me.adminRole) {
    return (
      <p className=" border border-red-300 bg-red-50 p-4 text-sm text-red-800">
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
    return <p className="text-sm text-gray-400">Loading users…</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className=" border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-gray-500">
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
                      ? "border-green-600 text-green-700"
                      : "border-gray-400 text-gray-600"
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
                    className=" border border-gray-300 px-1 py-0.5 text-xs"
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
                    className="text-xs text-red-600 hover:underline"
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
