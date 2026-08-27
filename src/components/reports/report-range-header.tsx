import { DateRangePicker } from "@/components/finance/date-range-picker";
import type { DateRangePreset } from "@/lib/date-ranges";

export function ReportRangeHeader({ range, rangeLabel }: { range: DateRangePreset; rangeLabel: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">Showing {rangeLabel}</p>
      <DateRangePicker current={range} />
    </div>
  );
}
