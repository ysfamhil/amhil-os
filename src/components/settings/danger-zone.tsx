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

  return (
    <Card domain="danger">
      <CardHeader title="Danger zone" />
      <div className="flex items-start justify-between gap-4">
        <p className="flex items-start gap-2 text-sm text-muted">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
          <span>
            Permanently delete every task, habit, goal, time entry, income, and expense you&apos;ve entered. Your
            account, profile, and settings stay intact — this only clears entries, so you can start using the app
            fresh.
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

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete everything?"
        description="This permanently deletes all tasks, subtasks, habits and their history, goals, time entries, income, and expenses. Your login and profile are not affected. This cannot be undone."
        confirmLabel="Delete everything"
        onConfirm={async () => {
          await resetAllData();
          router.refresh();
        }}
      />
    </Card>
  );
}
