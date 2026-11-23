"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { resetAllData } from "@/lib/actions/reset";

export function DangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState<Record<string, number> | null>(null);

  return (
    <Card domain="danger">
      <CardHeader title="Danger zone" />
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
          <span>
            Permanently clear all workspace data, including planning, time, clients, learning, notes, journal,
            finance, CRM, and activity. Your login and profile stay intact.{" "}
            <a href="#workspace-backup" className="font-medium text-accent hover:underline">Download a backup first</a>.
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg border border-danger px-3 py-2 text-sm font-medium text-danger transition-colors hover:bg-r13"
        >
          Reset all data
        </button>
      </div>

      {removed && (
        <div className="mt-3 text-sm text-muted">
          <p role="status">Deleted {Object.values(removed).reduce((total, count) => total + count, 0)} workspace records.</p>
          <details className="mt-2">
            <summary>Deletion counts</summary>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {Object.entries(removed).map(([table, count]) => (
                <li key={table}>{count} {table.replaceAll("_", " ")}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete everything?"
        description="This permanently clears all 24 workspace tables for your account, including journal history, CRM leads, and funds. Your login and profile stay intact."
        confirmLabel="Delete everything"
        onConfirm={async () => {
          setRemoved(null);
          const result = await resetAllData();
          if (!result.ok) throw new Error(result.message);
          setRemoved(result.removed);
          router.refresh();
        }}
      />
    </Card>
  );
}
