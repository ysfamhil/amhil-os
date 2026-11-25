import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import type { FieldSet } from "./write-fields";

const fieldsModule = (await import(new URL("./write-fields.ts", import.meta.url).href)) as typeof import("./write-fields");
const {
  pickWritable, assertOwnedRelations, assertOwnedRecord, assertUuid, assertUuidList, isUuid, RELATIONS,
  TASK_FIELDS, NOTE_FIELDS, GOAL_FIELDS, HABIT_FIELDS, INCOME_FIELDS, EXPENSE_FIELDS, TIME_ENTRY_FIELDS,
  CRM_LEAD_FIELDS, PROJECT_FIELDS, CLIENT_FIELDS, LEAD_FIELDS, AREA_FIELDS, TOPIC_FIELDS, SESSION_FIELDS,
} = fieldsModule;

const ALL_SETS = {
  tasks: TASK_FIELDS, notes: NOTE_FIELDS, goals: GOAL_FIELDS, habits: HABIT_FIELDS, income: INCOME_FIELDS,
  expenses: EXPENSE_FIELDS, time_entries: TIME_ENTRY_FIELDS, crm_leads: CRM_LEAD_FIELDS, projects: PROJECT_FIELDS,
  clients: CLIENT_FIELDS, leads: LEAD_FIELDS, learning_areas: AREA_FIELDS, learning_topics: TOPIC_FIELDS,
  learning_sessions: SESSION_FIELDS,
} as const;

// Columns the server owns. None of them may ever be writable through a client-supplied object.
const SERVER_MANAGED = [
  "id", "user_id", "created_at", "updated_at", "completed_at", "position", "status_changed_at", "follow_up_count",
  "last_followed_up", "converted_at", "converted_client_id", "started_at", "role", "approved_at", "approved_by",
  "is_admin",
];

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const OTHER_USER_RECORD = "99999999-9999-4999-8999-999999999999";
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("no allowlist contains a server-managed column", () => {
  for (const [entity, set] of Object.entries(ALL_SETS)) {
    for (const column of Object.keys(set)) {
      assert.ok(!SERVER_MANAGED.includes(column), `${entity} must not allow writing ${column}`);
    }
  }
});

test("hostile input: only allowlisted columns survive, for every entity", () => {
  for (const [entity, set] of Object.entries(ALL_SETS)) {
    const legit = Object.keys(set);
    const hostile: Record<string, unknown> = { ...Object.fromEntries(legit.map((key) => [key, `v-${key}`])) };
    for (const column of SERVER_MANAGED) hostile[column] = "injected";
    hostile.some_unknown_column = "injected";
    const picked = pickWritable(set as FieldSet<object>, hostile);
    assert.deepEqual(Object.keys(picked).sort(), [...legit].sort(), `${entity}: exactly the allowlisted columns`);
    for (const column of [...SERVER_MANAGED, "some_unknown_column"]) {
      assert.ok(!Object.hasOwn(picked, column), `${entity}: ${column} must be dropped`);
    }
  }
});

test("a valid update is passed through unchanged, including falsy values; undefined is skipped", () => {
  const picked = pickWritable(GOAL_FIELDS, { title: "Ship it", description: null, progress: 0, category: "", status: "In Progress", start_date: undefined });
  assert.deepEqual(picked, { title: "Ship it", description: null, progress: 0, category: "", status: "In Progress" });
  assert.deepEqual(pickWritable(TASK_FIELDS, {}), {});
  assert.deepEqual(pickWritable(HABIT_FIELDS, { name: "Run", target: 3, goal_id: null }), { name: "Run", target: 3, goal_id: null });
});

test("non-object input is rejected", () => {
  for (const bad of [null, undefined, "title", 42, true, [], [{ title: "x" }]]) {
    assert.throws(() => pickWritable(TASK_FIELDS, bad), /Invalid input/, `${JSON.stringify(bad)} must be rejected`);
  }
});

test("prototype tricks and inherited properties are ignored", () => {
  const hostile = JSON.parse('{"__proto__":{"user_id":"attacker"},"constructor":{"prototype":{"user_id":"attacker"}},"title":"x"}');
  const picked = pickWritable(TASK_FIELDS, hostile);
  assert.deepEqual(picked, { title: "x" });
  assert.equal(({} as Record<string, unknown>).user_id, undefined, "Object.prototype must not be polluted");
  const inherited = Object.create({ title: "inherited", user_id: "attacker" }) as object;
  assert.deepEqual(pickWritable(TASK_FIELDS, inherited), {}, "inherited properties are not own properties");
});

test("every *_id column that points at another record is ownership-checked", () => {
  const relationEntities = {
    tasks: TASK_FIELDS, notes: NOTE_FIELDS, habits: HABIT_FIELDS, income: INCOME_FIELDS, expenses: EXPENSE_FIELDS,
    time_entries: TIME_ENTRY_FIELDS, projects: PROJECT_FIELDS, learning_topics: TOPIC_FIELDS, learning_sessions: SESSION_FIELDS,
  } as const;
  for (const [entity, set] of Object.entries(relationEntities)) {
    const relations = RELATIONS[entity as keyof typeof RELATIONS] as Record<string, string>;
    const idColumns = Object.keys(set).filter((column) => column.endsWith("_id"));
    assert.deepEqual(Object.keys(relations).sort(), idColumns.sort(), `${entity}: relation map must cover exactly its *_id columns`);
  }
  // Entities without any *_id field need no relation map.
  for (const set of [GOAL_FIELDS, CRM_LEAD_FIELDS, CLIENT_FIELDS, LEAD_FIELDS, AREA_FIELDS]) {
    assert.deepEqual(Object.keys(set).filter((column) => column.endsWith("_id")), []);
  }
});

// ---- ownership checks against a recording fake of the Supabase query builder ----------------

interface Row { id: string; user_id: string }
function fakeSupabase(tables: Record<string, Row[]>) {
  const queries: { table: string; filters: Record<string, string> }[] = [];
  const client = {
    from(table: string) {
      const filters: Record<string, string> = {};
      const builder = {
        select: () => builder,
        eq: (column: string, value: string) => { filters[column] = value; return builder; },
        maybeSingle: async () => {
          queries.push({ table, filters: { ...filters } });
          const row = (tables[table] ?? []).find((r) => r.id === filters.id && r.user_id === filters.user_id);
          return { data: row ? { id: row.id } : null, error: null };
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, queries };
}

test("own records pass and are checked against both id and user_id", async () => {
  const { client, queries } = fakeSupabase({ projects: [{ id: A, user_id: ME }], goals: [{ id: B, user_id: ME }] });
  await assertOwnedRelations(client, ME, RELATIONS.tasks, { title: "x", project_id: A, goal_id: B });
  assert.equal(queries.length, 2);
  for (const query of queries) assert.equal(query.filters.user_id, ME, "the lookup must be scoped to the caller");
  assert.deepEqual(queries.map((q) => q.table).sort(), ["goals", "projects"]);
});

test("another user's record id is rejected with a clear message, per table", async () => {
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ["tasks", { project_id: OTHER_USER_RECORD }, /Project not found/],
    ["tasks", { goal_id: OTHER_USER_RECORD }, /Goal not found/],
    ["notes", { client_id: OTHER_USER_RECORD }, /Client not found/],
    ["notes", { task_id: OTHER_USER_RECORD }, /Task not found/],
    ["notes", { learning_topic_id: OTHER_USER_RECORD }, /Learning topic not found/],
    ["time_entries", { task_id: OTHER_USER_RECORD }, /Task not found/],
    ["income", { client_id: OTHER_USER_RECORD }, /Client not found/],
    ["habits", { goal_id: OTHER_USER_RECORD }, /Goal not found/],
    ["learning_topics", { area_id: OTHER_USER_RECORD }, /Learning area not found/],
    ["learning_sessions", { topic_id: OTHER_USER_RECORD }, /Learning topic not found/],
  ];
  for (const [entity, fields, message] of cases) {
    // The record exists, but it belongs to somebody else.
    const everything = Object.fromEntries(["projects", "goals", "clients", "tasks", "learning_topics", "learning_areas", "habits"].map((t) => [t, [{ id: OTHER_USER_RECORD, user_id: "someone-else" }]]));
    const { client } = fakeSupabase(everything);
    await assert.rejects(
      assertOwnedRelations(client, ME, RELATIONS[entity as keyof typeof RELATIONS], fields),
      message,
      `${entity} ${JSON.stringify(fields)}`,
    );
  }
});

test("one bad relation among several rejects the whole write", async () => {
  const { client } = fakeSupabase({ projects: [{ id: A, user_id: ME }], goals: [{ id: OTHER_USER_RECORD, user_id: "someone-else" }] });
  await assert.rejects(assertOwnedRelations(client, ME, RELATIONS.tasks, { project_id: A, goal_id: OTHER_USER_RECORD }), /Goal not found/);
});

test("no relation (null, undefined, empty string) and unrelated fields trigger no lookup", async () => {
  const { client, queries } = fakeSupabase({});
  await assertOwnedRelations(client, ME, RELATIONS.tasks, { project_id: null, goal_id: "", title: "x", description: A });
  await assertOwnedRelations(client, ME, RELATIONS.tasks, {});
  assert.equal(queries.length, 0);
});

test("malformed ids are rejected before any database lookup", async () => {
  const { client, queries } = fakeSupabase({});
  for (const bad of ["not-a-uuid", "1' or '1'='1", "../etc/passwd", 123, {}, ["x"], A + "x"]) {
    await assert.rejects(assertOwnedRelations(client, ME, RELATIONS.tasks, { project_id: bad }), /Invalid project id/, JSON.stringify(bad));
  }
  assert.equal(queries.length, 0);
  await assert.rejects(assertOwnedRecord(client, ME, "habits", "nope"), /Invalid habit id/);
  await assert.rejects(assertOwnedRecord(client, ME, "emergency_fund", A), /Emergency fund not found/);
});

test("uuid helpers", () => {
  assert.ok(isUuid(A) && isUuid(A.toUpperCase()));
  for (const bad of ["", "abc", null, undefined, 1, A + " ", " " + A, A.slice(1)]) assert.ok(!isUuid(bad), JSON.stringify(bad));
  assert.doesNotThrow(() => assertUuid(A));
  assert.throws(() => assertUuid("x", "Task"), /Invalid task id/);
  assert.doesNotThrow(() => assertUuidList([A, B], "Task"));
  assert.throws(() => assertUuidList([A, "x"], "Task"), /Invalid task id/);
  assert.throws(() => assertUuidList("not a list", "Task"), /Invalid task list/);
  assert.throws(() => assertUuidList(new Array(5001).fill(A), "Task"), /Invalid task list/);
});

// ---- compile-time guarantees (checked by `tsc`, not at runtime) ---------------------------------

test("type level: an allowlist must list exactly the keys of its input interface", () => {
  interface Sample { a: string; b?: number }
  const exact: FieldSet<Sample> = { a: true, b: true };
  // @ts-expect-error - the optional key `b` is missing: a legitimate field would be silently dropped
  const missing: FieldSet<Sample> = { a: true };
  // @ts-expect-error - `c` is not a field of the interface: an unknown column would be exposed
  const extra: FieldSet<Sample> = { a: true, b: true, c: true };
  assert.deepEqual(Object.keys(exact), ["a", "b"]);
  void missing;
  void extra;
});
