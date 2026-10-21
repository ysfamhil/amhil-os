// Run with: npm test  (Node's built-in runner; no extra dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";

// Non-literal specifier: Node needs the explicit ".ts" extension, which tsc rejects on a static import.
const { orNull } = (await import(new URL("./safe-query.ts", import.meta.url).href)) as typeof import("./safe-query");

function silenceErrors<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  return fn().finally(() => {
    console.error = original;
  });
}

test("returns the value when the query succeeds", async () => {
  assert.equal(await orNull("ok", async () => 42), 42);
});

test("returns null when the query rejects", async () => {
  const result = await silenceErrors(() => orNull("rejects", () => Promise.reject(new Error('relation "journal_entries" does not exist'))));
  assert.equal(result, null);
});

test("returns null when the callback throws synchronously", async () => {
  const result = await silenceErrors(() =>
    orNull("throws", () => {
      throw new Error("boom");
    })
  );
  assert.equal(result, null);
});

test("returns null for non-Error rejections", async () => {
  const result = await silenceErrors(() => orNull("string", () => Promise.reject("nope")));
  assert.equal(result, null);
});

test("logs the label and message when it falls back", async () => {
  const original = console.error;
  const calls: unknown[][] = [];
  console.error = (...args: unknown[]) => void calls.push(args);
  try {
    await orNull("journal summary", () => Promise.reject(new Error("permission denied")));
  } finally {
    console.error = original;
  }
  assert.equal(calls.length, 1);
  assert.match(String(calls[0][0]), /journal summary/);
  assert.equal(calls[0][1], "permission denied");
});

test("a falsy successful value is preserved, not swallowed", async () => {
  assert.equal(await orNull("zero", async () => 0), 0);
});
