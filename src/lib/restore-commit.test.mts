import { test } from "node:test";
import assert from "node:assert/strict";

const { commitWorkspaceRestore } = (await import(new URL("./restore-commit.ts", import.meta.url).href)) as typeof import("./restore-commit");

test("the HTTP result reports a committed restore even if cache invalidation throws", async () => {
  const problem = new Error("cache unavailable");
  const order: string[] = [];
  const response = await commitWorkspaceRestore(
    async () => {
      order.push("commit");
      return { data: { tasks: 2 }, error: null };
    },
    () => {
      order.push("invalidate");
      throw problem;
    },
    (error) => {
      assert.equal(error, problem);
      order.push("reported");
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { restored: { tasks: 2 } });
  assert.deepEqual(order, ["commit", "invalidate", "reported"]);
});

test("an RPC denial retains its status and skips cache invalidation", async () => {
  const response = await commitWorkspaceRestore(
    async () => ({ data: null, error: { code: "42501", message: "denied" } }),
    () => assert.fail("invalidated after a failed RPC"),
    () => assert.fail("reported a cache failure that did not occur"),
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "An approved account is required." });
});

test("confirmed restore returns HTTP success even if cache invalidation and reporting both throw", async () => {
  let commits = 0;
  let reports = 0;
  const response = await commitWorkspaceRestore(
    async () => {
      commits += 1;
      return { data: { notes: 1 }, error: null };
    },
    () => { throw new Error("cache unavailable"); },
    () => {
      reports += 1;
      throw new Error("logger unavailable");
    },
  );
  assert.equal(commits, 1);
  assert.equal(reports, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { restored: { notes: 1 } });
});
