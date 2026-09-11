"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Wallet, Plus, Trash2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IncomeFormModal } from "@/components/finance/income-form-modal";
import { deleteIncome } from "@/lib/actions/income";
import type { Income, IncomeStatus } from "@/types/database";

const STATUSES: IncomeStatus[] = ["Expected", "Invoiced", "Paid", "Cancelled"];
const STATUS_TONE: Record<IncomeStatus, "neutral" | "accent" | "success" | "danger"> = {
  Expected: "neutral",
  Invoiced: "accent",
  Paid: "success",
  Cancelled: "danger",
};

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function IncomeBoard({ entries }: { entries: Income[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingEntry, setEditingEntry] = useState<Income | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Income | null>(null);

  const status = searchParams.get("status") ?? "";

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const totalShown = entries.reduce((t, e) => t + e.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value || null })}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setEditingEntry(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          <Plus size={16} />
          Add Income
        </button>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Wallet} title="No income records" description="Add income as it comes in." />
      ) : (
        <>
          <p className="text-xs text-muted">
            {entries.length} record{entries.length === 1 ? "" : "s"} · {money(totalShown)} MAD shown
          </p>
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <Card key={entry.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{money(entry.amount)} MAD</span>
                    <Badge tone={STATUS_TONE[entry.status]}>{entry.status}</Badge>
                    <span className="text-muted">{entry.date}</span>
                    {entry.source && <Badge tone="neutral">{entry.source}</Badge>}
                  </div>
                  {entry.description && <p className="mt-1 text-sm text-muted">{entry.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEntry(entry);
                    setModalOpen(true);
                  }}
                  className="text-muted hover:text-foreground"
                  aria-label="Edit income"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingEntry(entry)}
                  className="text-muted hover:text-danger"
                  aria-label="Delete income"
                >
                  <Trash2 size={14} />
                </button>
              </Card>
            ))}
          </div>
        </>
      )}

      <IncomeFormModal
        key={editingEntry?.id ?? "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        income={editingEntry}
      />

      <ConfirmDialog
        open={Boolean(deletingEntry)}
        onClose={() => setDeletingEntry(null)}
        title="Delete income"
        description={`Delete this ${deletingEntry ? money(deletingEntry.amount) : ""} MAD income record? This can't be undone.`}
        onConfirm={async () => {
          if (deletingEntry) {
            await deleteIncome(deletingEntry.id);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
