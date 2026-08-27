"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Receipt, Plus, Trash2, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EXPENSE_CATEGORIES, ExpenseFormModal, type ProjectOption } from "@/components/finance/expense-form-modal";
import { deleteExpense } from "@/lib/actions/expenses";
import type { Expense } from "@/types/database";

export type ExpenseWithRelations = Expense & { projects: { id: string; name: string } | null };

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function ExpenseBoard({ entries, projects }: { entries: ExpenseWithRelations[]; projects: ProjectOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [modalOpen, setModalOpen] = useState(() => searchParams.get("new") === "1");
  const [editingEntry, setEditingEntry] = useState<Expense | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<ExpenseWithRelations | null>(null);

  const category = searchParams.get("category") ?? "";

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
          value={category}
          onChange={(e) => updateParams({ category: e.target.value || null })}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
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
          Add Expense
        </button>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses" description="Track your costs by category and project." />
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
                    {entry.category && <Badge tone="neutral">{entry.category}</Badge>}
                    <span className="text-muted">{entry.date}</span>
                    {entry.projects && <span className="text-muted">{entry.projects.name}</span>}
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
                  aria-label="Edit expense"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingEntry(entry)}
                  className="text-muted hover:text-danger"
                  aria-label="Delete expense"
                >
                  <Trash2 size={14} />
                </button>
              </Card>
            ))}
          </div>
        </>
      )}

      <ExpenseFormModal
        key={editingEntry?.id ?? "new"}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        expense={editingEntry}
        projects={projects}
      />

      <ConfirmDialog
        open={Boolean(deletingEntry)}
        onClose={() => setDeletingEntry(null)}
        title="Delete expense"
        description={`Delete this ${deletingEntry ? money(deletingEntry.amount) : ""} MAD expense? This can't be undone.`}
        onConfirm={async () => {
          if (deletingEntry) {
            await deleteExpense(deletingEntry.id);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
