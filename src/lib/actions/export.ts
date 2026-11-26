"use server";

import { requireApprovedSession } from "@/lib/auth";
import { toCSV } from "@/lib/csv";
import type { CSVEntity } from "@/lib/export-entities";

const CSV_TABLE_BY_ENTITY = {
  tasks: "tasks",
  projects: "projects",
  goals: "goals",
  learning: "learning_topics",
  habits: "habits",
  time: "time_entries",
  clients: "clients",
  leads: "leads",
  crm: "crm_leads",
  income: "income",
  expenses: "expenses",
  notes: "notes",
  timeline: "timeline_events",
} as const satisfies Record<CSVEntity, string>;

export async function exportEntityCSV(entity: CSVEntity): Promise<{ filename: string; csv: string }> {
  const { supabase, user } = await requireApprovedSession();
  if (!Object.hasOwn(CSV_TABLE_BY_ENTITY, entity)) throw new Error("Unsupported CSV export.");
  const table = CSV_TABLE_BY_ENTITY[entity];

  const rows: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  let expected: number | null = null;
  while (true) {
    let query = supabase.from(table).select("*", { count: "exact" }).eq("user_id", user.id);
    if (cursor) query = query.gt("id", cursor);
    const { data, count, error } = await query.order("id").limit(500);
    if (error || count === null) throw new Error("Could not read the full CSV export.");
    expected ??= count;
    if (count !== expected - rows.length) throw new Error("Records changed during export. Please retry.");
    if (!data.length) break;
    for (const row of data) {
      const fields: Record<string, unknown> = { ...row };
      delete fields.user_id;
      rows.push(fields);
    }
    cursor = data.at(-1)?.id;
    if (rows.length === expected) break;
  }
  if (rows.length !== expected) throw new Error("The CSV export was incomplete. Please retry.");
  return { filename: `${entity}.csv`, csv: toCSV(rows) };
}
