/**
 * Formats a Date's LOCAL calendar date as YYYY-MM-DD. Every caller in this
 * file builds its Date via local-timezone components (new Date(y, m, d)), so
 * formatting through `.toISOString()` (which converts to UTC first) would
 * silently roll the date back a day for any positive UTC offset — e.g. local
 * midnight Aug 1 in GMT+1 is 23:00 UTC Jul 31, so `.toISOString()` reports
 * "2026-07-31" for what should be "2026-08-01". Reading the local
 * getFullYear/getMonth/getDate instead avoids that conversion entirely.
 */
function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayISODate(): string {
  return toISODate(new Date());
}

export function tomorrowISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

export function startOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // week starts Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeekISODate(date = new Date()): string {
  return toISODate(startOfWeek(date));
}

export function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfMonthISODate(date = new Date()): string {
  return toISODate(startOfMonth(date));
}

export function endOfMonthISODate(date = new Date()): string {
  return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function endOfWeek(date = new Date()): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

export function endOfWeekISODate(date = new Date()): string {
  return toISODate(endOfWeek(date));
}

export function startOfQuarter(date = new Date()): Date {
  const quarterMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterMonth, 1);
}

export function startOfQuarterISODate(date = new Date()): string {
  return toISODate(startOfQuarter(date));
}

export function endOfQuarterISODate(date = new Date()): string {
  const start = startOfQuarter(date);
  return toISODate(new Date(start.getFullYear(), start.getMonth() + 3, 0));
}

export function startOfYearISODate(date = new Date()): string {
  return toISODate(new Date(date.getFullYear(), 0, 1));
}

export function endOfYearISODate(date = new Date()): string {
  return toISODate(new Date(date.getFullYear(), 11, 31));
}

export function addDaysISODate(days: number, date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
