import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { ReportRangeHeader } from "@/components/reports/report-range-header";
import type { CrossSystemReport as CrossSystemReportData } from "@/lib/queries/reports";
import type { DateRangePreset } from "@/lib/date-ranges";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function CrossSystemReport({
  range,
  rangeLabel,
  data,
}: {
  range: DateRangePreset;
  rangeLabel: string;
  data: CrossSystemReportData;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ReportRangeHeader range={range} rangeLabel={rangeLabel} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="Work" />
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Tasks completed" value={String(data.work.tasksCompleted)} />
            <Metric label="Hours worked" value={`${data.work.hoursWorked.toFixed(1)}h`} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Learning" />
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Hours" value={`${data.learning.hours.toFixed(1)}h`} />
            <Metric label="Topics completed" value={String(data.learning.topicsCompleted)} />
            <Metric label="Avg confidence" value={data.learning.averageConfidence != null ? `${data.learning.averageConfidence.toFixed(1)}/10` : "—"} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Projects" />
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Tasks completed" value={String(data.projects.tasksCompleted)} />
            <Metric label="Hours" value={`${data.projects.hours.toFixed(1)}h`} />
            <Metric label="Revenue (paid)" value={`${money(data.projects.revenue)} MAD`} tone="success" />
            <Metric label="Expenses" value={`${money(data.projects.expenses)} MAD`} tone="danger" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Freelance" />
          <div className="grid grid-cols-2 gap-3">
            <Metric label="New leads" value={String(data.freelance.newLeads)} />
            <Metric label="New clients" value={String(data.freelance.newClients)} />
            <Metric label="Active projects" value={String(data.freelance.activeProjects)} />
            <Metric label="Paid revenue" value={`${money(data.freelance.paidRevenue)} MAD`} tone="success" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Financial productivity" />
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Revenue / hour" value={data.financialProductivity.revenuePerHour != null ? `${money(data.financialProductivity.revenuePerHour)} MAD` : "—"} />
            <Metric label="Hours worked" value={`${data.financialProductivity.hoursWorked.toFixed(1)}h`} />
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/reports?tab=productivity" className="text-xs font-medium text-accent hover:underline">
          Productivity details →
        </Link>
        <Link href="/reports?tab=learning" className="text-xs font-medium text-accent hover:underline">
          Learning details →
        </Link>
        <Link href="/reports?tab=finance" className="text-xs font-medium text-accent hover:underline">
          Finance details →
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : ""}`}>
        {value}
      </p>
    </div>
  );
}
