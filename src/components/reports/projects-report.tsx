import { Card, CardHeader } from "@/components/ui/card";
import { ReportRangeHeader } from "@/components/reports/report-range-header";
import type { ProjectsReport as ProjectsReportData } from "@/lib/queries/reports";
import type { DateRangePreset } from "@/lib/date-ranges";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function ProjectsReport({
  range,
  rangeLabel,
  data,
}: {
  range: DateRangePreset;
  rangeLabel: string;
  data: ProjectsReportData;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ReportRangeHeader range={range} rangeLabel={rangeLabel} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Active projects</p>
          <p className="mt-1 text-lg font-semibold">{data.active}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Completed projects</p>
          <p className="mt-1 text-lg font-semibold text-success">{data.completed}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Total hours (period)</p>
          <p className="mt-1 text-lg font-semibold">{data.totalHours.toFixed(1)}h</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Avg progress</p>
          <p className="mt-1 text-lg font-semibold">{data.averageProgress}%</p>
        </Card>
      </div>

      {data.plannedVsActualHours && (
        <Card>
          <p className="text-xs text-muted">Planned vs. actual hours (projects with an estimate)</p>
          <p className="mt-1 text-lg font-semibold">
            {data.plannedVsActualHours.plannedHours}h planned / {data.plannedVsActualHours.actualHours.toFixed(1)}h actual
          </p>
        </Card>
      )}

      {data.efficiencyByProject.length > 0 && (
        <Card>
          <CardHeader title="Revenue & profit per hour" />
          <ul className="flex flex-col gap-2">
            {data.efficiencyByProject.map((p) => (
              <li key={p.name} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="text-xs text-muted">
                  {money(p.revenuePerHour)} MAD/h revenue · <span className={p.profitPerHour >= 0 ? "text-success" : "text-danger"}>{money(p.profitPerHour)} MAD/h profit</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Projects by status" />
          {data.byStatus.length === 0 ? (
            <p className="text-sm text-muted">No projects yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.byStatus.map((s) => (
                <li key={s.status} className="flex items-center justify-between text-sm">
                  <span>{s.status}</span>
                  <span className="text-muted">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Revenue, expenses & profit by project (period)" />
          {data.breakdowns.length === 0 ? (
            <p className="text-sm text-muted">No project-linked income or expenses in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.breakdowns.map((p) => (
                <li key={p.key} className="flex items-center justify-between text-sm">
                  <span>{p.label}</span>
                  <span className="text-xs text-muted">
                    <span className="text-success">{money(p.revenue)}</span> /{" "}
                    <span className="text-danger">{money(p.expenses)}</span> /{" "}
                    <span className={p.revenue - p.expenses >= 0 ? "text-success" : "text-danger"}>
                      {money(p.revenue - p.expenses)}
                    </span>{" "}
                    MAD
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
