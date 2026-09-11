"use client";

import { useState } from "react";
import { Pencil, ShieldCheck, Trash2 } from "lucide-react";
import clsx from "clsx";
import { WidgetShell, WidgetAddButton } from "./widget-shell";
import { EmergencyFundTransactionModal } from "./emergency-fund-transaction-modal";
import { EmergencyFundGoalModal } from "./emergency-fund-goal-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteEmergencyFundTransaction } from "@/lib/actions/emergency-fund";
import { useRouter } from "next/navigation";
import type { DashboardData } from "@/lib/dashboard";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function EmergencyFundWidget({ data }: { data: DashboardData }) {
  const router = useRouter();
  const { targetAmount, balance, recentTransactions } = data.emergencyFund;
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const progress = targetAmount > 0 ? Math.min(100, (balance / targetAmount) * 100) : 0;
  const goalReached = balance >= targetAmount;
  const remaining = Math.max(0, targetAmount - balance);

  return (
    <WidgetShell
      title="Emergency Fund"
      action={<WidgetAddButton onClick={() => setTransactionModalOpen(true)} label="Add" domain="savings" />}
      domain="savings"
      className="h-full"
      bodyClassName="flex flex-col gap-3 px-[16px] py-[13px]"
    >
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[24px] font-extrabold tabular-nums tracking-[-0.02em]">{money(balance)} MAD</span>
          <button
            type="button"
            onClick={() => setGoalModalOpen(true)}
            aria-label="Edit fund goal"
            className="flex shrink-0 items-center gap-1 text-[11px] text-t6 hover:text-t3"
          >
            of {money(targetAmount)} MAD
            <Pencil size={11} />
          </button>
        </div>

        <div className="mt-2">
          <div className="h-[6px] w-full overflow-hidden rounded-[4px] bg-track">
            <div
              className="h-full rounded-[4px] transition-[width] duration-150 ease-out"
              style={{ width: `${progress}%`, backgroundColor: "var(--domain-savings)" }}
            />
          </div>
        </div>

        <p className="mt-1.5 text-[11px] text-t6">
          {goalReached ? (
            <span className="font-semibold" style={{ color: "var(--domain-savings)" }}>
              Goal reached 🎉
            </span>
          ) : (
            <>
              {Math.round(progress)}% funded · {money(remaining)} MAD to go
            </>
          )}
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-surface2 px-2.5 py-2 text-[11.5px] text-t5">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" style={{ color: "var(--domain-savings)" }} />
        <span>Don&apos;t touch it unless it&apos;s genuinely an emergency.</span>
      </div>

      {recentTransactions.length === 0 ? (
        <p className="text-[12.5px] text-t6">No contributions yet.</p>
      ) : (
        <ul className="flex flex-col">
          {recentTransactions.map((t) => (
            <li
              key={t.id}
              className="group flex items-center gap-2 border-b border-line2 py-[7px] last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px]">{t.note || (t.amount > 0 ? "Deposit" : "Withdrawal")}</p>
                <p className="font-mono text-[10px] text-t7">{formatDate(t.created_at)}</p>
              </div>
              <span
                className={clsx(
                  "shrink-0 font-mono text-[11.5px] font-semibold tabular-nums",
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
                className="shrink-0 rounded p-1 text-t7 opacity-0 transition-opacity hover:text-red group-hover:opacity-100"
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <EmergencyFundTransactionModal open={transactionModalOpen} onClose={() => setTransactionModalOpen(false)} />
      <EmergencyFundGoalModal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} currentTarget={targetAmount} />

      <ConfirmDialog
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title="Delete transaction"
        description="Remove this entry from the emergency fund ledger? This can't be undone."
        onConfirm={async () => {
          if (deletingId) {
            await deleteEmergencyFundTransaction(deletingId);
            router.refresh();
          }
        }}
      />
    </WidgetShell>
  );
}
