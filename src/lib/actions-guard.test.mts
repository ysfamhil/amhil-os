import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

// Static guard over the server actions: they receive attacker-controlled objects, so a database write
// must never be built from a spread of the input. See src/lib/write-fields.ts.
const dir = new URL("./actions/", import.meta.url);
const files = readdirSync(dir).filter((name) => name.endsWith(".ts"));
const source = Object.fromEntries(files.map((name) => [name, readFileSync(new URL(name, dir), "utf8")]));

// Actions whose input is an explicit, hand-built object (reviewed) and so need no allowlist helper.
const EXPLICIT_ONLY = new Set(["journal.ts", "profile.ts", "emergency-fund.ts", "subtasks.ts", "notifications.ts", "admin.ts", "import.ts", "export.ts", "reset.ts", "search.ts", "timeline.ts", "ai.ts"]);

test("the guard actually sees the action files", () => {
  assert.ok(files.length >= 20, `expected the action files, found ${files.length}`);
  for (const name of ["tasks.ts", "notes.ts", "goals.ts", "habits.ts", "income.ts", "expenses.ts", "time-entries.ts", "crm-leads.ts"]) {
    assert.ok(files.includes(name), `${name} must be scanned`);
  }
});

test("no action spreads or passes raw client input into a database write", () => {
  const forbidden: [RegExp, string][] = [
    [/\.\.\.\s*input\b/, "spread of `input`"],
    [/\.(update|insert|upsert)\(\s*input\s*[,)]/, "raw `input` passed to a write"],
    [/\.(update|insert|upsert)\(\s*\{\s*\.\.\.input/, "spread of `input` inside a write"],
  ];
  for (const [name, text] of Object.entries(source)) {
    for (const [pattern, what] of forbidden) {
      assert.ok(!pattern.test(text), `${name}: ${what}. Build writes from pickWritable() instead.`);
    }
  }
});

test("every write whose argument is a variable is built from the allowlist helper", () => {
  const variableWrite = /\.(update|insert|upsert)\(\s*([A-Za-z_]\w*)\s*[,)]/g;
  for (const [name, text] of Object.entries(source)) {
    const variables = [...text.matchAll(variableWrite)].map((match) => match[2]);
    for (const variable of variables) {
      assert.ok(["patch", "fields", "toInsert"].includes(variable), `${name}: unexpected variable \`${variable}\` passed to a write`);
    }
    if (!EXPLICIT_ONLY.has(name) && variables.some((variable) => variable === "patch" || variable === "fields")) {
      assert.match(text, /pickWritable\(/, `${name}: writes a patch but never calls pickWritable()`);
    }
  }
});

test("every action module that defines an Input interface uses the allowlist helper", () => {
  for (const [name, text] of Object.entries(source)) {
    if (EXPLICIT_ONLY.has(name)) continue;
    if (/export interface \w*Input\b/.test(text)) {
      assert.match(text, /pickWritable\(/, `${name}: defines an Input interface but never calls pickWritable()`);
    }
  }
});

test("actions that accept a foreign-key id verify it belongs to the caller", () => {
  const needsRelations = ["tasks.ts", "notes.ts", "habits.ts", "income.ts", "expenses.ts", "time-entries.ts", "projects.ts", "learning.ts"];
  for (const name of needsRelations) {
    assert.match(source[name], /assertOwnedRelations\(/, `${name}: must call assertOwnedRelations()`);
  }
  assert.match(source["habits.ts"], /assertOwnedRecord\(supabase, user\.id, "habits", habitId\)/, "habit completions must verify the habit");
  assert.match(source["emergency-fund.ts"], /assertOwnedRecord\(supabase, user\.id, "emergency_fund", fundId\)/, "fund transactions must verify the fund");
  assert.match(source["subtasks.ts"], /\.from\("tasks"\)\.select\("id"\)\.eq\("id", taskId\)\.eq\("user_id", user\.id\)/, "subtasks must verify the task");
});

test("no action writes user_id from anything but the authenticated session", () => {
  for (const [name, text] of Object.entries(source)) {
    // Object-literal values only; a type annotation such as `user_id: string;` is not a write.
    for (const match of text.matchAll(/user_id:\s*([^,}\n]+)/g)) {
      const value = match[1].trim();
      if (/^string\b/.test(value)) continue;
      assert.match(value, /^user\.id$/, `${name}: user_id must be user.id, found ${value}`);
    }
  }
});
