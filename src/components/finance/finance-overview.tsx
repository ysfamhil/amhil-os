import { Card, CardHeader } from "@/components/ui/card";
import { DateRangePicker } from "@/components/finance/date-range-picker";
import { MonthlyTrendChart } from "@/components/finance/monthly-trend-chart";
import { ExplainReportButton } from "@/components/reports/explain-report-button";
import type { FinanceBreakdowns, FinanceOverview as FinanceOverviewData } from "@/lib/queries/finance";
import type { MonthlyFinancePoint } from "@/lib/queries/finance";
import type { FinanceAdvancedMetrics } from "@/lib/queries/reports";
import type { DateRangePreset } from "@/lib/date-ranges";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function FinanceOverview({
  range,
  rangeLabel,
  overview,
  breakdowns,
  trend,
  advanced,
}: {
  range: DateRangePreset;
  rangeLabel: string;
  overview: FinanceOverviewData;
  breakdowns: FinanceBreakdowns;
  trend: MonthlyFinancePoint[];
  advanced?: FinanceAdvancedMetrics;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Showing {rangeLabel}</p>
        <DateRangePicker current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <p className="text-xs text-muted">Revenue (paid)</p>
          <p className="mt-1 text-lg font-semibold text-success">{money(overview.paidRevenue)} MAD</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Expenses</p>
          <p className="mt-1 text-lg font-semibold text-danger">{money(overview.expenses)} MAD</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Net income</p>
          <p className={`mt-1 text-lg font-semibold ${overview.netIncome >= 0 ? "text-success" : "text-danger"}`}>
            {money(overview.netIncome)} MAD
          </p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Expected income</p>
          <p className="mt-1 text-lg font-semibold">{money(overview.expectedIncome)} MAD</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Invoiced (unpaid)</p>
          <p className="mt-1 text-lg font-semibold">{money(overview.invoicedIncome)} MAD</p>
        </Card>
      </div>

      <ExplainReportButton reportName="Finance" data={{ range: rangeLabel, overview, breakdowns }} />

      {overview.cancelledIncome > 0 && (
        <p className="text-xs text-muted">
          {money(overview.cancelledIncome)} MAD in cancelled income for this period is excluded from every figure above.
        </p>
      )}

      <Card>
        <CardHeader title="Revenue vs. expenses (last 6 months)" />
        <MonthlyTrendChart data={trend} />
      </Card>

      {advanced && (
        <Card>
          <CardHeader title="Advanced analytics" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted">Growth vs. prior period</p>
              <p className="mt-1 text-sm font-semibold">
                {advanced.revenueGrowthPercent != null ? `${advanced.revenueGrowthPercent >= 0 ? "+" : ""}${advanced.revenueGrowthPercent}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Revenue concentration</p>
              <p className="mt-1 text-sm font-semibold">
                {advanced.revenueConcentrationPercent != null
                  ? `${advanced.revenueConcentrationPercent}% from ${advanced.topClientName}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Avg. project value</p>
              <p className="mt-1 text-sm font-semibold">
                {advanced.averageProjectValue != null ? `${money(advanced.averageProjectValue)} MAD` : "—"}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue by client" />
          <BreakdownList items={breakdowns.byClient.map((c) => ({ label: c.label, value: c.revenue }))} emptyText="No paid income in this period." />
        </Card>
        <Card>
          <CardHeader title="Revenue by source" />
          <BreakdownList items={breakdowns.bySource.map((s) => ({ label: s.label, value: s.revenue }))} emptyText="No paid income in this period." />
        </Card>
        <Card>
          <CardHeader title="Revenue & expenses by project" />
          {breakdowns.byProject.length === 0 ? (
            <p className="text-sm text-muted">No project-linked records in this period.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {breakdowns.byProject.map((p) => (
                <li key={p.key} className="flex items-center justify-between text-sm">
                  <span>{p.label}</span>
                  <span className="text-xs text-muted">
                    <span className="text-success">{money(p.revenue)}</span> /{" "}
                    <span className="text-danger">{money(p.expenses)}</span> MAD
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Expenses by category" />
          <BreakdownList items={breakdowns.byCategory.map((c) => ({ label: c.label, value: c.expenses }))} emptyText="No expenses in this period." />
        </Card>
      </div>
    </div>
  );
}

function BreakdownList({ items, emptyText }: { items: { label: string; value: number }[]; emptyText: string }) {
  if (items.length === 0) return <p className="text-sm text-muted">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center justify-between text-sm">
          <span>{item.label}</span>
          <span className="text-muted">{money(item.value)} MAD</span>
        </li>
      ))}
    </ul>
  );
}
