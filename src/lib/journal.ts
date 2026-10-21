import type { JournalMood } from "@/types/database";

export const JOURNAL_MOODS: { value: JournalMood; label: string; color: string }[] = [
  { value: "great", label: "Great", color: "#2fe3b0" },
  { value: "productive", label: "Productive", color: "#5b8def" },
  { value: "normal", label: "Normal", color: "#9ca3af" },
  { value: "difficult", label: "Difficult", color: "#ff8f6b" },
];

export function moodMeta(mood: JournalMood | null | undefined) {
  return JOURNAL_MOODS.find((m) => m.value === mood) ?? null;
}

export function isJournalMood(value: unknown): value is JournalMood {
  return JOURNAL_MOODS.some((m) => m.value === value);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True only for a real calendar date in YYYY-MM-DD form (rejects 2026-02-31). */
export function isValidISODate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftISODate(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return formatISODate(d);
}

export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Consecutive journaled days. The streak is still alive if today hasn't been
 * written yet but yesterday was — it only resets once a whole day is missed.
 */
export function computeStreak(entryDates: string[], today: string): number {
  const dates = new Set(entryDates);
  let cursor = dates.has(today) ? today : shiftISODate(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak++;
    cursor = shiftISODate(cursor, -1);
  }
  return streak;
}

/** How many of the last `days` days (ending today) have an entry. */
export function countRecentEntries(entryDates: string[], today: string, days = 30): number {
  const from = shiftISODate(today, -(days - 1));
  return entryDates.filter((d) => d >= from && d <= today).length;
}

/** One-line plain-text preview of an entry body. */
export function makeSnippet(text: string | null | undefined, max = 120): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Monday-first grid of ISO dates for a month; `null` pads the leading blanks. */
export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(formatISODate(new Date(year, month, day)));
  return cells;
}
