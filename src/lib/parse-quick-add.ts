import { addDaysISODate, todayISODate, tomorrowISODate } from "@/lib/dates";
import type { TaskPriority } from "@/types/database";

export interface ParsedQuickAdd {
  title: string;
  priority?: TaskPriority;
  tag?: string;
  dueDate?: string;
  dueDateLabel?: string;
}

const PRIORITY_WORDS: Record<string, TaskPriority> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function resolveWeekday(name: string): string {
  const target = WEEKDAYS.indexOf(name);
  const now = new Date();
  const current = now.getDay();
  const delta = (target - current + 7) % 7;
  return addDaysISODate(delta, now);
}

/**
 * Lightweight, dependency-free parser for the quick-add row. Recognizes
 * `!priority`, `#tag`, and a handful of date phrases; everything else stays
 * in the title verbatim. `due_date` is date-only in this schema, so time
 * mentions (e.g. "5pm") are consumed as part of the date phrase but not
 * stored separately.
 */
export function parseQuickAdd(input: string): ParsedQuickAdd {
  let title = input;
  let priority: TaskPriority | undefined;
  let tag: string | undefined;
  let dueDate: string | undefined;
  let dueDateLabel: string | undefined;

  title = title.replace(/!(\w+)/g, (match, word: string) => {
    const p = PRIORITY_WORDS[word.toLowerCase()];
    if (p) {
      priority = p;
      return "";
    }
    return match;
  });

  title = title.replace(/#(\w+)/g, (_match, word: string) => {
    tag = word;
    return "";
  });

  const lower = title.toLowerCase();
  const datePatterns: [RegExp, () => { date: string; label: string }][] = [
    [/\btoday\b(\s*\d{1,2}(:\d{2})?\s*(am|pm)?)?/, () => ({ date: todayISODate(), label: "today" })],
    [/\btomorrow\b(\s*\d{1,2}(:\d{2})?\s*(am|pm)?)?/, () => ({ date: tomorrowISODate(), label: "tomorrow" })],
    [
      /\bin (\d+) days?\b/,
      () => {
        const match = lower.match(/\bin (\d+) days?\b/);
        const n = match ? Number(match[1]) : 1;
        return { date: addDaysISODate(n), label: `in ${n}d` };
      },
    ],
    ...WEEKDAYS.map(
      (day): [RegExp, () => { date: string; label: string }] => [
        new RegExp(`\\b${day}\\b(\\s*\\d{1,2}(:\\d{2})?\\s*(am|pm)?)?`),
        () => ({ date: resolveWeekday(day), label: day }),
      ]
    ),
  ];

  for (const [pattern, resolve] of datePatterns) {
    const match = lower.match(pattern);
    if (match) {
      const { date, label } = resolve();
      dueDate = date;
      dueDateLabel = label;
      title = title.replace(new RegExp(match[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "");
      break;
    }
  }

  return { title: title.replace(/\s+/g, " ").trim(), priority, tag, dueDate, dueDateLabel };
}
