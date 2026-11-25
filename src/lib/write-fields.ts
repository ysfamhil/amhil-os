/**
 * Server actions receive their arguments from the browser, so every object they get is
 * attacker-controlled: a signed-in user can call an action with extra keys (user_id, id,
 * created_at, completed_at, position, converted_client_id, ...) or with the id of another
 * user's project/goal/task. Two rules keep that harmless:
 *
 *  1. Database writes are built from an explicit allowlist of columns (`pickWritable`), never
 *     from a spread of the input. Each allowlist is a `Record<keyof XInput, true>`, so the
 *     compiler keeps it identical to the action's input interface: a field cannot be silently
 *     dropped or silently exposed.
 *  2. Every id that points at another record is checked to belong to the caller before it is
 *     written (`assertOwnedRelations`), so a clear "not found" is returned instead of relying
 *     on a database constraint alone.
 *
 * This module is deliberately plain TypeScript (no "use server", no framework imports) so it
 * can be unit-tested directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ClientInput } from "@/lib/actions/clients";
import type { CrmLeadInput } from "@/lib/actions/crm-leads";
import type { ExpenseInput } from "@/lib/actions/expenses";
import type { GoalInput } from "@/lib/actions/goals";
import type { HabitInput } from "@/lib/actions/habits";
import type { IncomeInput } from "@/lib/actions/income";
import type { LeadInput } from "@/lib/actions/leads";
import type { AreaInput, SessionInput, TopicInput } from "@/lib/actions/learning";
import type { NoteInput } from "@/lib/actions/notes";
import type { ProjectInput } from "@/lib/actions/projects";
import type { TaskInput } from "@/lib/actions/tasks";
import type { TimeEntryInput } from "@/lib/actions/time-entries";

export type FieldSet<T> = { readonly [K in keyof T]-?: true };

// ---- Writable columns per entity (exactly the fields of each action's input interface) ----

export const TASK_FIELDS: FieldSet<TaskInput> = {
  title: true, description: true, status: true, priority: true, due_date: true,
  estimated_minutes: true, project_id: true, goal_id: true, category: true, notes: true,
};
export const NOTE_FIELDS: FieldSet<NoteInput> = {
  title: true, content: true, tags: true, project_id: true, client_id: true, task_id: true,
  learning_topic_id: true, goal_id: true,
};
export const GOAL_FIELDS: FieldSet<GoalInput> = {
  title: true, description: true, category: true, start_date: true, target_date: true, status: true, progress: true,
};
export const HABIT_FIELDS: FieldSet<HabitInput> = {
  name: true, description: true, frequency: true, target: true, goal_id: true,
};
export const INCOME_FIELDS: FieldSet<IncomeInput> = {
  amount: true, currency: true, date: true, client_id: true, project_id: true, source: true,
  description: true, status: true, payment_date: true,
};
export const EXPENSE_FIELDS: FieldSet<ExpenseInput> = {
  amount: true, currency: true, date: true, category: true, project_id: true, description: true,
};
export const TIME_ENTRY_FIELDS: FieldSet<TimeEntryInput> = {
  project_id: true, task_id: true, category: true, date: true, start_time: true, end_time: true,
  duration_minutes: true, description: true,
};
export const CRM_LEAD_FIELDS: FieldSet<CrmLeadInput> = {
  name: true, website_url: true, contact: true, status: true, notes: true, date: true,
};
export const PROJECT_FIELDS: FieldSet<ProjectInput> = {
  name: true, description: true, status: true, start_date: true, target_date: true, goal_id: true,
  client_id: true, category: true, budget: true, estimated_hours: true, notes: true,
};
export const CLIENT_FIELDS: FieldSet<ClientInput> = {
  name: true, company: true, email: true, phone: true, country: true, source: true, status: true, notes: true,
};
export const LEAD_FIELDS: FieldSet<LeadInput> = {
  name: true, company: true, contact: true, source: true, status: true, estimated_value: true,
  notes: true, contacted_at: true,
};
export const AREA_FIELDS: FieldSet<AreaInput> = { name: true, description: true };
export const TOPIC_FIELDS: FieldSet<TopicInput> = {
  area_id: true, name: true, status: true, progress: true, confidence: true, goal_id: true, notes: true,
};
export const SESSION_FIELDS: FieldSet<SessionInput> = {
  topic_id: true, date: true, duration_minutes: true, notes: true, what_learned: true,
  confidence_before: true, confidence_after: true,
};

/**
 * Copies only the allowlisted keys that the caller actually supplied. Unknown keys (including
 * `user_id`, `id`, timestamps and every server-managed column) are dropped. Falsy values
 * (0, "", false, null) are kept; `undefined` is skipped so database defaults still apply.
 */
export function pickWritable<T extends object>(fields: FieldSet<T>, input: unknown): Partial<T> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) throw new Error("Invalid input");
  const source = input as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    if (!Object.hasOwn(source, key)) continue;
    const value = source[key];
    if (value !== undefined) picked[key] = value;
  }
  return picked as Partial<T>;
}

// ---- Ids and relations --------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function assertUuid(value: unknown, label = "Record"): asserts value is string {
  if (!isUuid(value)) throw new Error(`Invalid ${label.toLowerCase()} id`);
}

export function assertUuidList(values: unknown, label: string, max = 5000): asserts values is string[] {
  if (!Array.isArray(values) || values.length > max) throw new Error(`Invalid ${label.toLowerCase()} list`);
  for (const value of values) assertUuid(value, label);
}

export type RelationTable =
  | "projects" | "goals" | "clients" | "tasks" | "learning_topics" | "learning_areas" | "habits" | "emergency_fund";

const LABELS: Record<RelationTable, string> = {
  projects: "Project",
  goals: "Goal",
  clients: "Client",
  tasks: "Task",
  learning_topics: "Learning topic",
  learning_areas: "Learning area",
  habits: "Habit",
  emergency_fund: "Emergency fund",
};

type RelationMap = Readonly<Record<string, RelationTable>>;

/** Which columns of each entity point at another of the caller's own records. */
export const RELATIONS = {
  tasks: { project_id: "projects", goal_id: "goals" },
  notes: { project_id: "projects", client_id: "clients", task_id: "tasks", learning_topic_id: "learning_topics", goal_id: "goals" },
  habits: { goal_id: "goals" },
  income: { client_id: "clients", project_id: "projects" },
  expenses: { project_id: "projects" },
  time_entries: { project_id: "projects", task_id: "tasks" },
  projects: { goal_id: "goals", client_id: "clients" },
  learning_topics: { area_id: "learning_areas", goal_id: "goals" },
  learning_sessions: { topic_id: "learning_topics" },
} as const satisfies Record<string, RelationMap>;

/** Throws "<Label> not found" unless `id` is a record in `table` owned by `userId`. */
export async function assertOwnedRecord(
  supabase: SupabaseClient<Database>,
  userId: string,
  table: RelationTable,
  id: unknown,
): Promise<void> {
  const label = LABELS[table];
  assertUuid(id, label);
  const { data } = await supabase.from(table).select("id").eq("id", id).eq("user_id", userId).maybeSingle();
  if (!data) throw new Error(`${label} not found`);
}

/**
 * For every relation column present in `fields` with a value, checks that the referenced record
 * belongs to `userId`. null / undefined / "" mean "no relation" and are skipped (callers
 * normalise "" to null). Run this BEFORE the insert or update.
 */
export async function assertOwnedRelations(
  supabase: SupabaseClient<Database>,
  userId: string,
  relations: RelationMap,
  fields: Record<string, unknown>,
): Promise<void> {
  const checks: Promise<void>[] = [];
  for (const [column, table] of Object.entries(relations)) {
    const value = fields[column];
    if (value === undefined || value === null || value === "") continue;
    checks.push(assertOwnedRecord(supabase, userId, table, value));
  }
  await Promise.all(checks);
}
