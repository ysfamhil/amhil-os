import {
  addDaysISODate,
  endOfMonthISODate,
  endOfQuarterISODate,
  endOfWeekISODate,
  endOfYearISODate,
  startOfMonthISODate,
  startOfQuarterISODate,
  startOfWeekISODate,
  startOfYearISODate,
  todayISODate,
} from "@/lib/dates";

/**
 * Centralized date-range presets so Finance (and Phase 5 Reports) share one
 * definition of "this month", "last quarter", etc. instead of each screen
 * computing its own boundaries.
 */
export const DATE_RANGE_PRESETS = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "last_year",
  "custom",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  last_week: "Last Week",
  this_month: "This Month",
  last_month: "Last Month",
  this_quarter: "This Quarter",
  this_year: "This Year",
  last_year: "Last Year",
  custom: "Custom Range",
};

export function resolveDateRange(preset: DateRangePreset, custom?: { start: string; end: string }): DateRange {
  const today = todayISODate();
  const label = DATE_RANGE_LABELS[preset];

  switch (preset) {
    case "today":
      return { start: today, end: today, label };
    case "yesterday": {
      const y = addDaysISODate(-1);
      return { start: y, end: y, label };
    }
    case "this_week":
      return { start: startOfWeekISODate(), end: endOfWeekISODate(), label };
    case "last_week": {
      const lastWeekDay = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return { start: startOfWeekISODate(lastWeekDay), end: endOfWeekISODate(lastWeekDay), label };
    }
    case "this_month":
      return { start: startOfMonthISODate(), end: endOfMonthISODate(), label };
    case "last_month": {
      const lastMonthDay = new Date();
      lastMonthDay.setDate(1);
      lastMonthDay.setMonth(lastMonthDay.getMonth() - 1);
      return { start: startOfMonthISODate(lastMonthDay), end: endOfMonthISODate(lastMonthDay), label };
    }
    case "this_quarter":
      return { start: startOfQuarterISODate(), end: endOfQuarterISODate(), label };
    case "this_year":
      return { start: startOfYearISODate(), end: endOfYearISODate(), label };
    case "last_year": {
      const lastYearDay = new Date(new Date().getFullYear() - 1, 0, 1);
      return { start: startOfYearISODate(lastYearDay), end: endOfYearISODate(lastYearDay), label };
    }
    case "custom":
      return { start: custom?.start ?? today, end: custom?.end ?? today, label };
    default:
      return { start: startOfMonthISODate(), end: endOfMonthISODate(), label: DATE_RANGE_LABELS.this_month };
  }
}

export function isDateRangePreset(value: string): value is DateRangePreset {
  return (DATE_RANGE_PRESETS as readonly string[]).includes(value);
}
