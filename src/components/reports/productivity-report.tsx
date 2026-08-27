import { Card, CardHeader } from "@/components/ui/card";
import { ReportRangeHeader } from "@/components/reports/report-range-header";
import { TrendBarChart } from "@/components/reports/trend-bar-chart";
import { ExplainReportButton } from "@/components/reports/explain-report-button";
import type { ProductivityReport as ProductivityReportData } from "@/lib/queries/reports";
import type { DateRangePreset } from "@/lib/date-ranges";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <Card>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : ""}`}>
        {value}
      </p>
    </Card>
  );
}

export function ProductivityReport({
  range,
  rangeLabel,
  data,
}: {
  range: DateRangePreset;
  rangeLabel: string;
  data: ProductivityReportData;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ReportRangeHeader range={range} rangeLabel={rangeLabel} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Tasks completed" value={String(data.tasksCompleted)} tone="success" />
        <Stat label="Completion rate" value={`${data.completionRate}%`} />
        <Stat label="Tasks created" value={String(data.tasksCreated)} />
        <Stat label="Overdue tasks" value={String(data.overdueTasks)} tone={data.overdueTasks > 0 ? "danger" : undefined} />
        <Stat label="Hours worked" value={`${data.hoursWorked.toFixed(1)}h`} />
        <Stat label="Productive days" value={String(data.productiveDays)} />
        <Stat label="Avg completed / day" value={data.avgCompletedPerDay.toFixed(1)} />
        <Stat label="Avg time to complete" value={data.avgCompletionTimeHours != null ? `${data.avgCompletionTimeHours}h` : "—"} />
        {data.plannedVsActualMinutes && (
          <Stat
            label="Planned vs. actual"
            value={`${Math.round(data.plannedVsActualMinutes.plannedMinutes / 60)}h / ${Math.round(data.plannedVsActualMinutes.actualMinutes / 60)}h`}
          />
        )}
      </div>

      <ExplainReportButton reportName="Productivity" data={{ rangeLabel, ...data }} />

      <Card>
        <CardHeader title="Tasks completed over time" />
        {data.trend.every((p) => p.count === 0) ? (
          <p className="text-sm text-muted">No tasks completed in this period.</p>
        ) : (
          <TrendBarChart data={data.trend} color="var(--color-success)" />
        )}
      </Card>
    </div>
  );
}
