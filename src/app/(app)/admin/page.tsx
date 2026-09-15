import { requireAdmin } from "@/lib/auth";
import { getUserStats, getAllUsers } from "@/lib/queries/admin";
import { AdminUsersTable } from "@/components/admin/admin-users-table";

export default async function AdminPage() {
  const { supabase, userId } = await requireAdmin();

  const [stats, users] = await Promise.all([getUserStats(supabase), getAllUsers(supabase)]);

  const statTiles = [
    { label: "Total users", value: stats.total },
    { label: "New this week", value: stats.newThisWeek },
    { label: "Pending", value: stats.pending },
    { label: "Approved", value: stats.approved },
    { label: "Suspended", value: stats.suspended },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="h-[28px] w-[5px] shrink-0 rounded-full bg-accent" />
        <div>
          <h1 className="text-[28px] font-extrabold leading-none tracking-[-0.03em]">Admin</h1>
          <p className="mt-1.5 text-[13px] text-muted">Approve, suspend, and review who has access to AMHIL OS.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {statTiles.map((tile) => (
          <div key={tile.label} className="rounded-[14px] border border-line bg-surface px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-t5">{tile.label}</p>
            <p className="mt-1 text-[24px] font-extrabold tabular-nums tracking-[-0.02em]">{tile.value}</p>
          </div>
        ))}
      </div>

      <AdminUsersTable users={users} currentUserId={userId} />
    </div>
  );
}
