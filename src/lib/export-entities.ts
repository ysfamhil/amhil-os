/**
 * Plain constants shared between the export server action and the client
 * component that renders one button per entity. Kept out of
 * src/lib/actions/export.ts deliberately — a "use server" file may only
 * export async functions, so a plain array/type export there breaks at
 * runtime when a Client Component imports it.
 */
export const CSV_ENTITIES = [
  "tasks",
  "projects",
  "goals",
  "learning",
  "habits",
  "time",
  "clients",
  "leads",
  "income",
  "expenses",
  "notes",
  "timeline",
] as const;

export type CSVEntity = (typeof CSV_ENTITIES)[number];
