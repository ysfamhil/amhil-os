import clsx from "clsx";
import { WidgetShell } from "./widget-shell";
import { Sparkline } from "./sparkline";
import type { DashboardData } from "@/lib/dashboard";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

function signed(value: number, digits = 1) {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return "±0";
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function Tile({
  label,
  value,
  unit,
  delta,
  deltaTone,
  color,
  sparkline,
}: {
  label: string;
  value: string;
  unit?: string;
  delta: string;
  deltaTone: "up" | "down" | "neutral";
  color: string;
  sparkline: number[];
}) {
  return (
    <div className="flex flex-col justify-between rounded-[14px] border border-line bg-surface2 p-[13px]">
      <p className="text-[10px] font-bold uppercase tracking-[0.11em]" style={{ color }}>
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="flex items-baseline gap-1">
          <span className="text-[26px] font-extrabold tabular-nums leading-none tracking-[-0.03em]">{value}</span>
          {unit && <span className="text-[11px] text-t6">{unit}</span>}
        </p>
        <Sparkline values={sparkline} color={color} />
      </div>
      <span
        className={clsx(
          "mt-2 inline-flex w-fit items-center rounded-full px-[7px] py-[2px] font-mono text-[10px] font-semibold",
          deltaTone === "up" && "bg-g12 text-green",
          deltaTone === "down" && "bg-r13 text-red",
          deltaTone === "neutral" && "bg-chip text-t4"
        )}
      >
        {delta}
      </span>
    </div>
  );
}

export function WeekSummaryWidget({ data }: { data: DashboardData }) {
  return (
    <WidgetShell title="Week Summary" color="var(--accent)" className="h-full" bodyClassName="p-[13px]">
      <div className="grid grid-cols-2 gap-[10px]">
        <Tile
          label="Tasks Done"
          value={String(data.week.tasksCompleted)}
          delta={`${signed(data.week.tasksCompletedDelta, 0)} vs last wk`}
          deltaTone={data.week.tasksCompletedDelta > 0 ? "up" : data.week.tasksCompletedDelta < 0 ? "down" : "neutral"}
          color="var(--domain-tasks)"
          sparkline={data.week.tasksSparkline}
        />
        <Tile
          label="Hours Worked"
          value={data.week.hoursWorked.toFixed(1)}
          unit="h"
          delta={`${signed(data.week.hoursWorkedDelta, 1)} vs last wk`}
          deltaTone={data.week.hoursWorkedDelta > 0 ? "up" : data.week.hoursWorkedDelta < 0 ? "down" : "neutral"}
          color="var(--domain-time)"
          sparkline={data.week.hoursSparkline}
        />
        <Tile
          label="Habit Consistency"
          value={`${data.week.habitConsistency}%`}
          delta={`${data.week.habitCompletions}/${data.week.habitPossible} done`}
          deltaTone="neutral"
          color="var(--domain-habits)"
          sparkline={data.week.habitsSparkline}
        />
        <Tile
          label="Net Income"
          value={money(data.finance.netIncome)}
          unit="MAD"
          delta={data.finance.netIncome >= 0 ? "positive" : "negative"}
          deltaTone={data.finance.netIncome >= 0 ? "up" : "down"}
          color="var(--domain-finance)"
          sparkline={data.finance.netIncomeSparkline}
        />
      </div>
    </WidgetShell>
  );
}
