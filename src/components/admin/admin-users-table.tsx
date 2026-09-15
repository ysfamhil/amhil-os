"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { approveUser, rejectUser, suspendUser, reinstateUser } from "@/lib/actions/admin";
import { Users } from "lucide-react";
import type { Profile, UserStatus } from "@/types/database";

const STATUS_TONE: Record<UserStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  suspended: "danger",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminUsersTable({ users, currentUserId }: { users: Profile[]; currentUserId: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ user: Profile; action: "reject" | "suspend" } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<void>) {
    setError(null);
    setPendingId(id);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPendingId(null);
    }
  }

  if (users.length === 0) {
    return <EmptyState icon={Users} title="No users yet" description="Signups will show up here for approval." />;
  }

  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
      {error && <p className="border-b border-line px-4 py-2 text-[12.5px] text-danger">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-[0.07em] text-t5">
              <th className="px-4 py-3 font-semibold">User</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              const isPending = pendingId === u.id;
              return (
                <tr key={u.id} className="border-b border-line2 last:border-b-0 hover:bg-surface2">
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.full_name || "—"}</p>
                    <p className="font-mono text-[11px] text-t6">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.role === "admin" ? "accent" : "neutral"}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-t6">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-t7">You</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {u.status === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => run(u.id, () => approveUser(u.id))}
                              className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-green hover:bg-g12 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => setConfirming({ user: u, action: "reject" })}
                              className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-red hover:bg-r13 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {u.status === "approved" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => setConfirming({ user: u, action: "suspend" })}
                            className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-red hover:bg-r13 disabled:opacity-50"
                          >
                            Suspend
                          </button>
                        )}
                        {u.status === "suspended" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => run(u.id, () => reinstateUser(u.id))}
                            className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-green hover:bg-g12 disabled:opacity-50"
                          >
                            Reinstate
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title={confirming?.action === "reject" ? "Reject user" : "Suspend user"}
        description={
          confirming?.action === "reject"
            ? `Reject ${confirming?.user.email}? They won't be able to access AMHIL OS.`
            : `Suspend ${confirming?.user.email}? They'll immediately lose access to AMHIL OS.`
        }
        confirmLabel={confirming?.action === "reject" ? "Reject" : "Suspend"}
        onConfirm={async () => {
          if (!confirming) return;
          const { user, action } = confirming;
          await run(user.id, () => (action === "reject" ? rejectUser(user.id) : suspendUser(user.id)));
        }}
      />
    </div>
  );
}
