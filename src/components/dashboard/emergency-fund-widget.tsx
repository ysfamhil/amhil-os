import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { WidgetShell } from "./widget-shell";
import type { DashboardData } from "@/lib/dashboard";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function EmergencyFundWidget({ data }: { data: DashboardData }) {
  const { targetAmount, balance } = data.emergencyFund;
  const progress = targetAmount > 0 ? Math.min(100, (balance / targetAmount) * 100) : 0;
  const goalReached = targetAmount > 0 && balance >= targetAmount;
  const remaining = Math.max(0, targetAmount - balance);

  return (
    <WidgetShell
      title="Emergency Fund"
      action={
        <Link href="/finance?tab=funds" className="rounded-lg px-2 py-1 text-[11px] font-semibold text-t6 hover:bg-surface2 hover:text-t3">
          View funds
        </Link>
      }
      domain="savings"
      className="h-full"
      bodyClassName="flex flex-col gap-3 px-[16px] py-[13px]"
    >
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[24px] font-extrabold tabular-nums tracking-[-0.02em]">{money(balance)} MAD</span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-t6">of {money(targetAmount)} MAD</span>
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
          {targetAmount === 0 ? (
            "No funds yet."
          ) : goalReached ? (
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

      <Link
        href="/finance?tab=funds"
        className="text-[12px] font-bold"
        style={{ color: "var(--domain-savings)" }}
      >
        Manage funds →
      </Link>
    </WidgetShell>
  );
}
