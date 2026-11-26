// End-to-end regression test for the server-action write allowlists and relation-ownership checks.
// It calls the REAL server actions of a running PRODUCTION build over HTTP, as a signed-in user, and
// reads the database back with the service key to see what was actually written.
//
// Needs: a disposable local stack (see backup-http.mjs), `npm run build` output in .next, and the app
// running with `next start` on a loopback port. Synthetic users only; everything created is deleted.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const app = new URL(process.env.AMHIL_TEST_APP_URL);
const api = new URL(process.env.AMHIL_TEST_API_URL);
for (const endpoint of [app, api]) {
  assert.equal(endpoint.protocol, "http:");
  assert.equal(endpoint.hostname, "127.0.0.1", "Tests require disposable loopback endpoints");
}
const anonKey = process.env.AMHIL_TEST_ANON_KEY;
const trusted = createClient(api.origin, process.env.AMHIL_TEST_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const unwrap = ({ data, error }) => { assert.ifError(error); return data; };

// Action ids are generated per build; the manifest maps them back to the exported function names.
const manifest = JSON.parse(readFileSync(new URL("../../.next/server/server-reference-manifest.json", import.meta.url), "utf8")).node;
const actionId = (name, file) => {
  const entry = Object.entries(manifest).find(([, value]) => value.exportedName === name && value.filename.endsWith(`/${file}`));
  assert.ok(entry, `server action ${name} (${file}) is not registered in this build`);
  return entry[0];
};
const FILES = {
  createTask: "tasks.ts", updateTask: "tasks.ts", createNote: "notes.ts", updateNote: "notes.ts", updateGoal: "goals.ts",
  createGoal: "goals.ts", createHabit: "habits.ts", updateHabit: "habits.ts", setHabitCompletion: "habits.ts",
  createIncome: "income.ts", updateIncome: "income.ts", createExpense: "expenses.ts", updateExpense: "expenses.ts",
  createTimeEntry: "time-entries.ts", updateTimeEntry: "time-entries.ts", updateCrmLead: "crm-leads.ts",
  addEmergencyFundDeposit: "emergency-fund.ts",
};

const results = [];
const check = async (name, fn) => {
  try { const detail = await fn(); results.push(true); console.log(`PASS  ${name}${detail ? " - " + detail : ""}`); }
  catch (error) { results.push(false); console.log(`FAIL  ${name} - ${String(error.message).split("\n")[0].slice(0, 220)}`); }
};

const created = [];
async function signedInUser(label) {
  const email = `actions-${label}-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { user } = unwrap(await trusted.auth.admin.createUser({ email, password, email_confirm: true }));
  created.push(user.id);
  unwrap(await trusted.from("profiles").update({ status: "approved" }).eq("id", user.id).select("id").single());
  const jar = new Map();
  const client = createServerClient(api.origin, anonKey, {
    cookies: { getAll: () => Array.from(jar, ([name, value]) => ({ name, value })), setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)) },
  });
  unwrap(await client.auth.signInWithPassword({ email, password }));
  return { id: user.id, cookie: () => Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ") };
}

const attacker = await signedInUser("attacker");
const victim = await signedInUser("victim");

/** Calls a real server action as the attacker. Returns { ok, status }. Arguments are JSON-encoded like React does for plain data. */
async function act(name, ...args) {
  const response = await fetch(new URL("/app/tasks", app), {
    method: "POST",
    redirect: "manual",
    headers: {
      "next-action": actionId(name, FILES[name]),
      "content-type": "text/plain;charset=UTF-8",
      accept: "text/x-component",
      origin: app.origin,
      cookie: attacker.cookie(),
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  if (process.env.AMHIL_TEST_DEBUG) console.log(`      [debug] ${name} -> HTTP ${response.status} ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  // Next reports a thrown action error either as HTTP 500 or as HTTP 200 with an error row (`1:E{"digest":...}`)
  // in the flight response, so success means: status 200 AND no error row.
  const thrown = /(^|\n)\d+:E\{/.test(text);
  return { ok: response.status === 200 && !thrown, status: response.status, text };
}

const row = async (table, id) => unwrap(await trusted.from(table).select("*").eq("id", id).single());
const seed = async (table, owner, values) => unwrap(await trusted.from(table).insert({ user_id: owner, ...values }).select("*").single());
const countWhere = async (table, filters) => {
  let query = trusted.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
  const { count, error } = await query; assert.ifError(error); return count;
};

try {
  // The victim owns one of everything an attacker could try to point a record at.
  const victimProject = await seed("projects", victim.id, { name: "Victim project" });
  const victimGoal = await seed("goals", victim.id, { title: "Victim goal" });
  const victimClient = await seed("clients", victim.id, { name: "Victim client" });
  const victimTask = await seed("tasks", victim.id, { title: "Victim task" });
  const victimHabit = await seed("habits", victim.id, { name: "Victim habit" });
  const victimFund = await seed("emergency_fund", victim.id, { name: "Victim fund", target_amount: 1000 });
  // The attacker's own records.
  const myProject = await seed("projects", attacker.id, { name: "My project" });
  const myGoal = await seed("goals", attacker.id, { title: "My goal" });
  const myTask = await seed("tasks", attacker.id, { title: "My task" });
  const myHabit = await seed("habits", attacker.id, { name: "My habit" });
  const myFund = await seed("emergency_fund", attacker.id, { name: "My fund", target_amount: 500 });

  // ---- 1. Legitimate behaviour is unchanged ----------------------------------------------------
  await check("valid create: title is trimmed, ownership comes from the session, own relations are accepted", async () => {
    const result = await act("createTask", { title: "  Legit task  ", priority: "High", project_id: myProject.id, goal_id: myGoal.id });
    assert.ok(result.ok, `the action failed (HTTP ${result.status})`);
    const rows = unwrap(await trusted.from("tasks").select("*").eq("title", "Legit task"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, attacker.id); assert.equal(rows[0].priority, "High");
    assert.equal(rows[0].project_id, myProject.id); assert.equal(rows[0].goal_id, myGoal.id);
  });
  await check("valid update: allowed fields change and Done still sets completed_at on the server", async () => {
    const result = await act("updateTask", myTask.id, { title: "Renamed task", status: "Done", priority: "Urgent" });
    assert.ok(result.ok, `the action failed (HTTP ${result.status})`);
    const after = await row("tasks", myTask.id);
    assert.equal(after.title, "Renamed task"); assert.equal(after.priority, "Urgent"); assert.equal(after.status, "Done");
    assert.ok(after.completed_at, "completed_at is set by the server when a task is completed");
    assert.equal((await act("updateTask", myTask.id, { status: "Todo" })).ok, true);
    assert.equal((await row("tasks", myTask.id)).completed_at, null, "reopening clears completed_at");
  });
  await check("valid create/update of a note, habit completion and fund deposit on OWN records", async () => {
    assert.ok((await act("createNote", { title: "Legit note", project_id: myProject.id, tags: ["a"] })).ok);
    assert.equal((await countWhere("notes", { user_id: attacker.id, title: "Legit note" })), 1);
    assert.ok((await act("setHabitCompletion", myHabit.id, "2026-01-02", true, null)).ok);
    assert.equal((await countWhere("habit_completions", { habit_id: myHabit.id })), 1);
    assert.ok((await act("addEmergencyFundDeposit", myFund.id, 50, "ok")).ok);
    assert.equal((await countWhere("emergency_fund_transactions", { fund_id: myFund.id })), 1);
  });

  // ---- 2. Unexpected fields never reach the database --------------------------------------------
  const HOSTILE = {
    user_id: victim.id, id: randomUUID(), created_at: "2001-01-01T00:00:00.000Z", updated_at: "2001-01-01T00:00:00.000Z",
    completed_at: "2001-01-01T00:00:00.000Z", position: 424242, status_changed_at: "2001-01-01T00:00:00.000Z",
    follow_up_count: 99, last_followed_up: "2001-01-01", converted_at: "2001-01-01T00:00:00.000Z",
    converted_client_id: victimClient.id, started_at: "2001-01-01T00:00:00.000Z", role: "admin",
  };
  const updates = [
    ["updateTask", "tasks", { title: "Seed task" }, { title: "Changed task" }],
    ["updateGoal", "goals", { title: "Seed goal" }, { title: "Changed goal", progress: 40 }],
    ["updateHabit", "habits", { name: "Seed habit" }, { name: "Changed habit", target: 3 }],
    ["updateIncome", "income", { amount: 10, currency: "MAD" }, { amount: 20 }],
    ["updateExpense", "expenses", { amount: 10, currency: "MAD" }, { amount: 15 }],
    ["updateTimeEntry", "time_entries", { duration_minutes: 30 }, { duration_minutes: 45 }],
    ["updateCrmLead", "crm_leads", { name: "Seed lead" }, { name: "Changed lead" }],
    ["updateNote", "notes", { title: "Seed note" }, { title: "Changed note" }],
  ];
  // Variant 1 carries user_id/id too (the database rejects those, which would break a naive implementation);
  // variant 2 carries ONLY server-managed columns that EXIST on the table (created_at, position, completed_at,
  // follow_up_count, ...) - values the database would happily accept, which is the dangerous case.
  const existingServerManaged = (exampleRow) =>
    Object.fromEntries(Object.entries(HOSTILE).filter(([column]) => column in exampleRow && column !== "id" && column !== "user_id"));
  const SERVER_MANAGED_COLUMNS = ["completed_at", "position", "follow_up_count", "status_changed_at", "last_followed_up", "converted_at", "converted_client_id", "started_at"];
  for (const [action, table, base, legit] of updates) {
    for (const variant of ["with user_id/id", "existing server-managed columns only"]) {
      await check(`${action} (${variant}): injected fields are ignored, the legitimate change applies`, async () => {
        const target = await seed(table, attacker.id, base);
        const hostile = variant === "with user_id/id" ? HOSTILE : existingServerManaged(target);
        assert.ok(variant === "with user_id/id" || Object.keys(hostile).length > 0, "the variant must inject at least one existing column");
        const result = await act(action, target.id, { ...legit, ...hostile });
        assert.ok(result.ok, `the action failed (HTTP ${result.status})`);
        const after = await row(table, target.id);
        for (const [column, value] of Object.entries(legit)) assert.equal(after[column], value, `${column} must be updated`);
        assert.equal(after.id, target.id, "id unchanged");
        assert.equal(after.user_id, attacker.id, "ownership unchanged");
        assert.equal(after.created_at, target.created_at, "created_at unchanged");
        for (const column of SERVER_MANAGED_COLUMNS) {
          if (column in target) assert.deepEqual(after[column], target[column], `${column} unchanged`);
        }
        assert.equal(await countWhere(table, { id: HOSTILE.id }), 0, "no row was created under the injected id");
      });
    }
  }
  for (const variant of ["with user_id/id", "existing server-managed columns only"]) {
    await check(`createTask / createGoal (${variant}): injected fields are ignored`, async () => {
      for (const [action, table, title, example] of [["createTask", "tasks", `Hostile task ${variant}`, myTask], ["createGoal", "goals", `Hostile goal ${variant}`, myGoal]]) {
        const hostileBase = variant === "with user_id/id" ? HOSTILE : existingServerManaged(example);
        const hostile = { ...hostileBase, ...(hostileBase.id ? { id: randomUUID() } : {}) };
        const result = await act(action, { title, ...hostile });
        assert.ok(result.ok, `${action}: the action failed (HTTP ${result.status})`);
        const rows = unwrap(await trusted.from(table).select("*").eq("title", title));
        assert.equal(rows.length, 1, `${action}: exactly one row`);
        assert.equal(rows[0].user_id, attacker.id, `${action}: owned by the caller, not the injected user`);
        if (hostile.id) assert.notEqual(rows[0].id, hostile.id, `${action}: server-generated id`);
        assert.ok(Date.now() - new Date(rows[0].created_at).getTime() < 10 * 60_000, `${action}: created_at is the real creation time`);
        assert.notEqual(rows[0].position, 424242, `${action}: position is not client-controlled`);
        if ("completed_at" in rows[0]) assert.equal(rows[0].completed_at, null, `${action}: completed_at not client-controlled`);
      }
    });
  }
  await check("the victim's records cannot be updated through the attacker's session", async () => {
    const before = await row("tasks", victimTask.id);
    const result = await act("updateTask", victimTask.id, { title: "Hijacked" });
    assert.ok(!result.ok, "the call must fail");
    assert.deepEqual(await row("tasks", victimTask.id), before, "the victim's task is untouched");
  });

  // ---- 3. Cross-user relation ids are rejected ---------------------------------------------------
  const readBack = {
    tasks: (id) => row("tasks", id), habits: (id) => row("habits", id), notes: (id) => row("notes", id),
  };
  const myNote = await seed("notes", attacker.id, { title: "My note" });
  const rejectedCreates = [
    ["createTask", { title: "Cross project", project_id: victimProject.id }, "tasks", { title: "Cross project" }],
    ["createTask", { title: "Cross goal", goal_id: victimGoal.id }, "tasks", { title: "Cross goal" }],
    ["createNote", { title: "Cross client", client_id: victimClient.id }, "notes", { title: "Cross client" }],
    ["createNote", { title: "Cross task", task_id: victimTask.id }, "notes", { title: "Cross task" }],
    ["createIncome", { amount: 5, description: "Cross client income", client_id: victimClient.id }, "income", { description: "Cross client income" }],
    ["createIncome", { amount: 5, description: "Cross project income", project_id: victimProject.id }, "income", { description: "Cross project income" }],
    ["createExpense", { amount: 5, description: "Cross project expense", project_id: victimProject.id }, "expenses", { description: "Cross project expense" }],
    ["createTimeEntry", { duration_minutes: 5, description: "Cross task time", task_id: victimTask.id }, "time_entries", { description: "Cross task time" }],
    ["createTimeEntry", { duration_minutes: 5, description: "Cross project time", project_id: victimProject.id }, "time_entries", { description: "Cross project time" }],
    ["createHabit", { name: "Cross goal habit", goal_id: victimGoal.id }, "habits", { name: "Cross goal habit" }],
  ];
  for (const [action, input, table, where] of rejectedCreates) {
    await check(`${action} with another user's ${Object.keys(input).find((k) => k.endsWith("_id"))} is rejected and nothing is written`, async () => {
      const result = await act(action, input);
      assert.ok(!result.ok, "the call must fail");
      assert.equal(await countWhere(table, { user_id: attacker.id, ...where }), 0, "no row was written");
    });
  }
  await check("updates that re-point a record at another user's project/goal/client/task are rejected and the record is unchanged", async () => {
    for (const [action, id, table, column, foreign] of [
      ["updateTask", myTask.id, "tasks", "project_id", victimProject.id],
      ["updateTask", myTask.id, "tasks", "goal_id", victimGoal.id],
      ["updateNote", myNote.id, "notes", "task_id", victimTask.id],
      ["updateNote", myNote.id, "notes", "client_id", victimClient.id],
      ["updateHabit", myHabit.id, "habits", "goal_id", victimGoal.id],
    ]) {
      const before = (await row(table, id))[column];
      const result = await act(action, id, { [column]: foreign });
      assert.ok(!result.ok, `${action} ${column} must fail`);
      assert.equal((await row(table, id))[column], before, `${table}.${column} unchanged`);
    }
  });
  await check("habit completion for another user's habit is rejected and writes nothing", async () => {
    const result = await act("setHabitCompletion", victimHabit.id, "2026-01-03", true, null);
    assert.ok(!result.ok);
    assert.equal(await countWhere("habit_completions", { habit_id: victimHabit.id }), 0);
  });
  await check("a deposit into another user's emergency fund is rejected and writes nothing", async () => {
    const result = await act("addEmergencyFundDeposit", victimFund.id, 100, "nope");
    assert.ok(!result.ok);
    assert.equal(await countWhere("emergency_fund_transactions", { fund_id: victimFund.id }), 0);
  });
  await check("malformed ids are rejected before the database is touched", async () => {
    const before = await row("tasks", myTask.id);
    for (const [name, args] of [["updateTask", ["not-a-uuid", { title: "x" }]], ["updateTask", [myTask.id, { project_id: "1' or '1'='1" }]], ["updateNote", ["../x", { title: "x" }]]]) {
      assert.ok(!(await act(name, ...args)).ok, `${name} ${JSON.stringify(args).slice(0, 40)} must fail`);
    }
    assert.deepEqual(await row("tasks", myTask.id), before);
  });
  void readBack;
} finally {
  for (const id of created.reverse()) {
    const { error } = await trusted.auth.admin.deleteUser(id);
    if (error) { results.push(false); console.log(`FAIL  cleanup of synthetic user - ${error.message}`); }
  }
}

const failed = results.filter((ok) => !ok).length;
console.log(failed === 0 ? `All ${results.length} checks passed against the real server actions.` : `${failed} of ${results.length} checks FAILED.`);
process.exit(failed === 0 ? 0 : 1);
