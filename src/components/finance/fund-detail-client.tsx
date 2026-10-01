"use client";

import { useState } from "react";
import clsx from "clsx";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmergencyFundFormModal } from "@/components/finance/emergency-fund-form-modal";
import { EmergencyFundTransactionModal } from "@/components/finance/emergency-fund-transaction-modal";
import { deleteEmergencyFundTransaction } from "@/lib/actions/emergency-fund";
import { useRouter } from "next/navigation";
import type { EmergencyFundDetail } from "@/lib/queries/emergency-fund";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function FundDetailClient({ fund }: { fund: EmergencyFundDetail }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const progress = fund.targetAmount > 0 ? Math.min(100, (fund.balance / fund.targetAmount) * 100) : 0;
  const goalReached = fund.balance >= fund.targetAmount;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{fund.name}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-border/40"
          >
            <Pencil size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setTransactionOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#04212a] hover:opacity-90"
            style={{ backgroundColor: "var(--domain-savings)" }}
          >
            <Plus size={14} />
            Add / Withdraw
          </button>
        </div>
      </div>

      <Card>
        <CardHeader title="Balance" />
        <p className="text-2xl font-semibold tabular-nums">
          {money(fund.balance)} <span className="text-sm font-normal text-muted">/ {money(fund.targetAmount)} MAD</span>
        </p>
        <div className="mt-3">
          <ProgressBar value={progress} color="var(--domain-savings)" />
        </div>
        <p className="mt-2 text-sm text-muted">
          {goalReached ? (
            <span className="font-semibold" style={{ color: "var(--domain-savings)" }}>
              Goal reached 🎉
            </span>
          ) : (
            `${Math.round(progress)}% funded · ${money(Math.max(0, fund.targetAmount - fund.balance))} MAD to go`
          )}
        </p>
      </Card>

      <Card>
        <CardHeader title={`Transactions (${fund.transactions.length})`} />
        {fund.transactions.length === 0 ? (
          <p className="text-sm text-muted">No contributions yet.</p>
        ) : (
          <ul className="flex flex-col">
            {fund.transactions.map((t) => (
              <li key={t.id} className="group flex items-center gap-2 border-b border-line2 py-[9px] last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{t.note || (t.amount > 0 ? "Deposit" : "Withdrawal")}</p>
                  <p className="font-mono text-xs text-muted">{formatDate(t.created_at)}</p>
                </div>
                <span
                  className={clsx(
                    "shrink-0 font-mono text-sm font-semibold tabular-nums",
                    t.amount > 0 ? "text-green" : "text-red"
                  )}
                >
                  {t.amount > 0 ? "+" : "-"}
                  {money(Math.abs(t.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => setDeletingId(t.id)}
                  aria-label="Delete transaction"
                  className="shrink-0 rounded p-1 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <EmergencyFundFormModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fund={{ id: fund.id, name: fund.name, targetAmount: fund.targetAmount }}
      />

      <EmergencyFundTransactionModal open={transactionOpen} onClose={() => setTransactionOpen(false)} fundId={fund.id} />

      <ConfirmDialog
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title="Delete transaction"
        description="Remove this entry from the fund's ledger? This can't be undone."
        onConfirm={async () => {
          if (deletingId) {
            await deleteEmergencyFundTransaction(deletingId);
            router.refresh();
          }
        }}
      />
    </div>
  );
}
