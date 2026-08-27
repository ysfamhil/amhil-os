"use server";

import { createClient } from "@/lib/supabase/server";
import { toCSV } from "@/lib/csv";
import type { CSVEntity } from "@/lib/export-entities";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

const CSV_TABLE_BY_ENTITY: Record<CSVEntity, string> = {
  tasks: "tasks",
  projects: "projects",
  goals: "goals",
  learning: "learning_topics",
  habits: "habits",
  time: "time_entries",
  clients: "clients",
  leads: "leads",
  income: "income",
  expenses: "expenses",
  notes: "notes",
  timeline: "timeline_events",
};

export async function exportEntityCSV(entity: CSVEntity): Promise<{ filename: string; csv: string }> {
  const { supabase, user } = await requireUser();
  const table = CSV_TABLE_BY_ENTITY[entity];

  const { data, error } = await supabase.from(table).select("*").eq("user_id", user.id);
  if (error) throw new Error(error.message);

  return { filename: `${entity}.csv`, csv: toCSV((data ?? []) as Record<string, unknown>[]) };
}

/** Every user-owned table, for the full JSON backup. No secrets ever live in
 * these tables (they only ever held application data, never credentials),
 * so nothing needs to be filtered out here beyond the row's own columns. */
const FULL_EXPORT_TABLES = [
  "profiles",
  "clients",
  "leads",
  "goals",
  "projects",
  "project_milestones",
  "tasks",
  "subtasks",
  "tags",
  "task_tags",
  "learning_areas",
  "learning_topics",
  "learning_sessions",
  "habits",
  "habit_completions",
  "time_entries",
  "income",
  "expenses",
  "notes",
  "timeline_events",
  "notifications",
] as const;

export async function exportFullJSON(): Promise<{ filename: string; json: string }> {
  const { supabase, user } = await requireUser();

  const results = await Promise.all(
    FULL_EXPORT_TABLES.map(async (table) => {
      // task_tags has no user_id column of its own — scope through the tasks it belongs to.
      const query =
        table === "task_tags"
          ? supabase.from(table).select("*, tasks!inner(user_id)").eq("tasks.user_id", user.id)
          : table === "profiles"
            ? supabase.from(table).select("*").eq("id", user.id)
            : supabase.from(table).select("*").eq("user_id", user.id);

      const { data, error } = await query;
      if (error) throw new Error(`${table}: ${error.message}`);
      return [table, data ?? []] as const;
    })
  );

  const exportObject = {
    exportedAt: new Date().toISOString(),
    app: "AMHIL OS",
    version: 1,
    data: Object.fromEntries(results),
  };

  return { filename: "amhil-os-export.json", json: JSON.stringify(exportObject, null, 2) };
}
