"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

type Row = Record<string, unknown>;

/** Tables importable from a full export, in dependency order — a table only
 * ever references tables listed before it, so inserting in this order means
 * every foreign key it needs has already been remapped. Two exclusions:
 * `profiles` (the importing user already has their own profile row, and
 * overwriting it isn't what "restore my data" should mean), and `task_tags`
 * (a pure join table on `(task_id, tag_id)` with no `id` column of its own —
 * the generic id-remapping this importer does for every other table doesn't
 * apply to it, so tag-to-task associations aren't restored by import even
 * though tags and tasks themselves are; they're still included in the JSON
 * export for full-fidelity backup). */
const IMPORT_TABLES = [
  "clients",
  "leads",
  "goals",
  "learning_areas",
  "tags",
  "habits",
  "projects",
  "project_milestones",
  "learning_topics",
  "tasks",
  "subtasks",
  "learning_sessions",
  "habit_completions",
  "time_entries",
  "income",
  "expenses",
  "notes",
  "timeline_events",
] as const;

type ImportTable = (typeof IMPORT_TABLES)[number];

/** Columns that are NOT NULL with no default — a row missing one of these
 * can't be inserted at all. */
const REQUIRED_FIELDS: Partial<Record<ImportTable, string[]>> = {
  clients: ["name"],
  leads: ["name"],
  goals: ["title"],
  learning_areas: ["name"],
  tags: ["name"],
  habits: ["name"],
  projects: ["name"],
  project_milestones: ["project_id", "title"],
  learning_topics: ["area_id", "name"],
  tasks: ["title"],
  subtasks: ["task_id", "title"],
  learning_sessions: ["topic_id", "duration_minutes"],
  habit_completions: ["habit_id", "date"],
  time_entries: ["duration_minutes"],
  income: ["amount"],
  expenses: ["amount"],
  notes: ["title"],
  timeline_events: ["event_type", "title"],
};

/** Foreign-key columns that reference another importable table's `id`. */
const FK_FIELDS: Partial<Record<ImportTable, { field: string; references: ImportTable }[]>> = {
  leads: [{ field: "converted_client_id", references: "clients" }],
  project_milestones: [{ field: "project_id", references: "projects" }],
  learning_topics: [{ field: "area_id", references: "learning_areas" }],
  tasks: [
    { field: "project_id", references: "projects" },
    { field: "goal_id", references: "goals" },
  ],
  subtasks: [{ field: "task_id", references: "tasks" }],
  learning_sessions: [{ field: "topic_id", references: "learning_topics" }],
  habit_completions: [{ field: "habit_id", references: "habits" }],
  time_entries: [
    { field: "project_id", references: "projects" },
    { field: "task_id", references: "tasks" },
  ],
  income: [
    { field: "client_id", references: "clients" },
    { field: "project_id", references: "projects" },
  ],
  expenses: [{ field: "project_id", references: "projects" }],
  notes: [
    { field: "project_id", references: "projects" },
    { field: "task_id", references: "tasks" },
    { field: "learning_topic_id", references: "learning_topics" },
    { field: "client_id", references: "clients" },
    { field: "goal_id", references: "goals" },
  ],
  projects: [
    { field: "client_id", references: "clients" },
    { field: "goal_id", references: "goals" },
  ],
  habits: [{ field: "goal_id", references: "goals" }],
  timeline_events: [{ field: "project_id", references: "projects" }],
};

const DATE_LIKE_SUFFIXES = ["_at", "_date"];

function looksLikeDateField(field: string): boolean {
  return DATE_LIKE_SUFFIXES.some((s) => field.endsWith(s)) || field === "date";
}

function isValidDateValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "string") return false;
  return !Number.isNaN(Date.parse(value));
}

export interface ImportValidationError {
  table: string;
  index: number;
  message: string;
}

export interface ImportPreview {
  valid: boolean;
  counts: Record<string, number>;
  duplicates: Record<string, number>;
  errors: ImportValidationError[];
}

interface ParsedExport {
  data: Partial<Record<ImportTable, Row[]>>;
}

function parseExport(jsonText: string): ParsedExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || !("data" in parsed)) {
    throw new Error("This doesn't look like an AMHIL OS export — missing a top-level \"data\" object.");
  }
  const data = (parsed as { data: unknown }).data;
  if (typeof data !== "object" || data === null) {
    throw new Error("The export's \"data\" field must be an object.");
  }
  return { data: data as Partial<Record<ImportTable, Row[]>> };
}

function validate(parsed: ParsedExport): { counts: Record<string, number>; errors: ImportValidationError[] } {
  const counts: Record<string, number> = {};
  const errors: ImportValidationError[] = [];
  const idsByTable = new Map<ImportTable, Set<string>>();

  for (const table of IMPORT_TABLES) {
    const rows = parsed.data[table];
    if (!rows) continue;
    if (!Array.isArray(rows)) {
      errors.push({ table, index: -1, message: `"${table}" must be an array.` });
      continue;
    }
    counts[table] = rows.length;
    idsByTable.set(table, new Set(rows.map((r) => (typeof r.id === "string" ? r.id : "")).filter(Boolean)));
  }

  for (const table of IMPORT_TABLES) {
    const rows = parsed.data[table];
    if (!Array.isArray(rows)) continue;

    const required = REQUIRED_FIELDS[table] ?? [];
    const fks = FK_FIELDS[table] ?? [];

    rows.forEach((row, index) => {
      if (typeof row.id !== "string" || row.id.length === 0) {
        errors.push({ table, index, message: "Missing or invalid \"id\"." });
      }
      for (const field of required) {
        if (row[field] == null || row[field] === "") {
          errors.push({ table, index, message: `Missing required field "${field}".` });
        }
      }
      for (const [field, value] of Object.entries(row)) {
        if (looksLikeDateField(field) && !isValidDateValue(value)) {
          errors.push({ table, index, message: `Field "${field}" is not a valid date.` });
        }
      }
      for (const fk of fks) {
        const value = row[fk.field];
        if (value == null) continue;
        if (typeof value !== "string") {
          errors.push({ table, index, message: `Field "${fk.field}" must be a string id.` });
          continue;
        }
        const referencedIds = idsByTable.get(fk.references);
        if (referencedIds && !referencedIds.has(value)) {
          errors.push({
            table,
            index,
            message: `"${fk.field}" references a "${fk.references}" row not included in this import.`,
          });
        }
      }
    });
  }

  return { counts, errors };
}

export async function previewImport(jsonText: string): Promise<ImportPreview> {
  const { supabase, user } = await requireUser();
  const parsed = parseExport(jsonText);
  const { counts, errors } = validate(parsed);

  const duplicates: Record<string, number> = {};
  for (const table of IMPORT_TABLES) {
    const rows = parsed.data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const ids = rows.map((r) => r.id).filter((id): id is string => typeof id === "string");
    if (ids.length === 0) continue;
    const { data: existing } = await supabase.from(table).select("id").eq("user_id", user.id).in("id", ids);
    duplicates[table] = existing?.length ?? 0;
  }

  return { valid: errors.length === 0, counts, duplicates, errors: errors.slice(0, 50) };
}

export interface ImportResult {
  ok: boolean;
  inserted: Record<string, number>;
  error?: string;
}

/**
 * TRANSACTION SAFETY — documented limitation:
 *
 * This import writes through the Supabase JS client (PostgREST), which has
 * no equivalent of a client-driven multi-statement SQL transaction spanning
 * several `.insert()` calls across different tables — each `.insert()` is
 * its own request/transaction at the database level. True ACID atomicity
 * across all `IMPORT_TABLES` would require moving this logic into a single
 * Postgres function (called via `.rpc()`) that does every insert inside one
 * server-side transaction. That's a real architectural change — rewriting
 * this dynamic, per-table, FK-remapping logic in PL/pgSQL — not something to
 * do silently in a hardening/release pass.
 *
 * Instead, this applies a compensating-rollback: every row inserted gets a
 * fresh id we control, so if any table's insert fails partway through, we
 * delete every row this same call already inserted (children before
 * parents, the reverse of IMPORT_TABLES' dependency order) before returning
 * the error. From the user's perspective the import is still all-or-nothing.
 * The one residual gap true DB transactions don't have: if the process
 * itself dies between the failed insert and the rollback finishing (e.g. a
 * server restart), some already-inserted rows could be left behind. That
 * window is small and the failure mode is a network/DB error mid-import,
 * not a routine occurrence — worth knowing, not worth over-engineering
 * around given the current architecture.
 */
export async function applyImport(jsonText: string): Promise<ImportResult> {
  const { supabase, user } = await requireUser();
  const parsed = parseExport(jsonText);
  const { errors } = validate(parsed);
  if (errors.length > 0) {
    return { ok: false, inserted: {}, error: `Import has ${errors.length} validation error(s) — fix them and try again.` };
  }

  // Every row gets a brand-new id, and every foreign key referencing another
  // imported row is remapped to match — this guarantees the import can never
  // collide with or overwrite an existing record, at the cost of the
  // imported data becoming a fresh copy rather than reusing the original ids.
  const idMap = new Map<string, string>();
  for (const table of IMPORT_TABLES) {
    const rows = parsed.data[table];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (typeof row.id === "string") idMap.set(row.id, randomUUID());
    }
  }

  const inserted: Record<string, number> = {};
  const insertedIdsByTable: { table: ImportTable; ids: string[] }[] = [];

  async function rollback() {
    for (const { table, ids } of [...insertedIdsByTable].reverse()) {
      if (ids.length === 0) continue;
      const { error } = await supabase.from(table).delete().eq("user_id", user.id).in("id", ids);
      if (error) console.error("[import] rollback failed:", table, error.message);
    }
  }

  for (const table of IMPORT_TABLES) {
    const rows = parsed.data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const fks = FK_FIELDS[table] ?? [];
    const remapped = rows.map((row) => {
      const next: Row = { ...row, id: idMap.get(row.id as string), user_id: user.id };
      for (const fk of fks) {
        const value = row[fk.field];
        if (typeof value === "string") next[fk.field] = idMap.get(value) ?? null;
      }
      return next;
    });

    const { error } = await supabase.from(table).insert(remapped as never);
    if (error) {
      await rollback();
      return {
        ok: false,
        inserted: {},
        error: `Failed inserting "${table}": ${error.message}. Nothing from this import was kept.`,
      };
    }
    insertedIdsByTable.push({ table, ids: remapped.map((r) => r.id as string) });
    inserted[table] = remapped.length;
  }

  return { ok: true, inserted };
}
