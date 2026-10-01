import Link from "next/link";
import { WidgetShell, WidgetAddButton } from "./widget-shell";
import type { DashboardData } from "@/lib/dashboard";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function FinanceWidget({
  data,
  onAddIncome,
  onAddExpense,
}: {
  data: DashboardData;
  onAddIncome: () => void;
  onAddExpense: () => void;
}) {
  const maxBar = Math.max(1, ...data.financeTrend.map((p) => Math.max(p.revenue, p.expenses)));

  const revenue = data.finance.allTime.revenue;
  const expenses = data.finance.allTime.expenses;
  const netIncome = data.finance.allTime.netIncome;

  return (
    <WidgetShell
      title="Finance · All Time"
      domain="finance"
      action={
        <div className="flex items-center gap-1">
          <Link href="/finance" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-t6 hover:bg-surface2 hover:text-t3">
            View all
          </Link>
          <WidgetAddButton onClick={onAddIncome} label="Income" domain="finance" />
          <WidgetAddButton onClick={onAddExpense} label="Expense" domain="finance" />
        </div>
      }
      className="@container h-full"
    >
      <div className="grid h-full grid-cols-1 gap-0 @lg:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4 border-b border-line px-[16px] py-[15px] @lg:border-b-0 @lg:border-r">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.11em]" style={{ color: "var(--domain-finance)" }}>
                Income
              </p>
              <p className="mt-1 text-[22px] font-extrabold tabular-nums tracking-[-0.02em] text-green">
                +{money(revenue)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-red">Expenses</p>
              <p className="mt-1 text-[22px] font-extrabold tabular-nums tracking-[-0.02em] text-red">
                -{money(expenses)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-t5">Net</p>
              <p
                className={`mt-1 text-[22px] font-extrabold tabular-nums tracking-[-0.02em] ${netIncome >= 0 ? "text-green" : "text-red"}`}
              >
                {money(netIncome)}
              </p>
            </div>
          </div>

          <div className="flex flex-1 items-end gap-[6px]">
            {data.financeTrend.map((point, i) => {
              const isCurrent = i === data.financeTrend.length - 1;
              const isPrevious = i === data.financeTrend.length - 2;
              const height = Math.max(2, Math.round((point.revenue / maxBar) * 62));
              return (
                <div key={point.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{
                      height: `${height}px`,
                      backgroundColor: isCurrent ? "var(--domain-finance)" : isPrevious ? "var(--bar-mid)" : "var(--bar-dim)",
                    }}
                  />
                  <span className="font-mono text-[9.5px] text-t7">{point.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="scroll-thin overflow-y-auto">
          {data.finance.recentTransactions.length === 0 ? (
            <div className="flex flex-col items-start gap-2 px-[16px] py-4">
              <p className="text-[12.5px] text-t6">No income logged yet.</p>
              <button type="button" onClick={onAddIncome} className="text-[12px] font-bold" style={{ color: "var(--domain-finance)" }}>
                + Add income
              </button>
            </div>
          ) : (
            <ul>
              {data.finance.recentTransactions.map((tx) => (
                <li key={tx.id} className="flex items-center gap-2 border-b border-line2 px-[16px] py-[10px] last:border-b-0 hover:bg-surface2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px]">{tx.label}</p>
                    <p className="font-mono text-[10px] text-t7">{tx.date}</p>
                  </div>
                  <span className={`shrink-0 font-mono text-[11.5px] font-semibold tabular-nums ${tx.type === "income" ? "text-green" : "text-red"}`}>
                    {tx.type === "income" ? "+" : "-"}
                    {money(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
