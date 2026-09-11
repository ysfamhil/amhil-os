import { Card, CardHeader } from "@/components/ui/card";
import { DateRangePicker } from "@/components/finance/date-range-picker";
import { MonthlyTrendChart } from "@/components/finance/monthly-trend-chart";
import type { FinanceOverview as FinanceOverviewData } from "@/lib/queries/finance";
import type { MonthlyFinancePoint } from "@/lib/queries/finance";
import type { DateRangePreset } from "@/lib/date-ranges";

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount);
}

export function FinanceOverview({
  range,
  rangeLabel,
  overview,
  trend,
}: {
  range: DateRangePreset;
  rangeLabel: string;
  overview: FinanceOverviewData;
  trend: MonthlyFinancePoint[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Showing {rangeLabel}</p>
        <DateRangePicker current={range} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">Income</p>
          <p className="mt-1 text-lg font-semibold text-success">+{money(overview.paidRevenue)} MAD</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Expenses</p>
          <p className="mt-1 text-lg font-semibold text-danger">-{money(overview.expenses)} MAD</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Net</p>
          <p className={`mt-1 text-lg font-semibold ${overview.netIncome >= 0 ? "text-success" : "text-danger"}`}>
            {money(overview.netIncome)} MAD
          </p>
        </Card>
      </div>

      {(overview.expectedIncome > 0 || overview.invoicedIncome > 0) && (
        <p className="text-xs text-muted">
          {overview.invoicedIncome > 0 && `${money(overview.invoicedIncome)} MAD invoiced, not yet paid. `}
          {overview.expectedIncome > 0 && `${money(overview.expectedIncome)} MAD expected.`}
        </p>
      )}

      <Card>
        <CardHeader title="Income vs. expenses (last 6 months)" />
        <MonthlyTrendChart data={trend} />
      </Card>
    </div>
  );
}
