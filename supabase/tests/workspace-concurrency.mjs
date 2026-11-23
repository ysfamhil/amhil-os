import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";

const db = new URL(process.env.AMHIL_TEST_DB_URL);
assert.equal(db.hostname, "127.0.0.1", "A disposable loopback database is required");
const env = {
  ...process.env,
  PGHOST: db.hostname,
  PGPORT: db.port,
  PGDATABASE: db.pathname.slice(1),
  PGUSER: decodeURIComponent(db.username),
  PGPASSWORD: decodeURIComponent(db.password),
  PGOPTIONS: "-c statement_timeout=6000",
};
const args = ["-X", "-qAt", "--no-password", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
const first = randomUUID();
const other = randomUUID();

function sql(query, expectedError) {
  const result = spawnSync("psql", args, { env, input: query, encoding: "utf8", timeout: 9000 });
  assert.ifError(result.error);
  if (expectedError) {
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(expectedError), result.stderr);
    return "";
  }
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function account(id) {
  return `set local role authenticated; set local "request.jwt.claim.sub" = '${id}';`;
}

async function hold(query, check) {
  const session = spawn("psql", args, { env, stdio: ["pipe", "pipe", "pipe"] });
  const closed = once(session, "close");
  try {
    await new Promise((resolve, reject) => {
      let output = "";
      let errors = "";
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for transaction")), 8000);
      session.stdout.on("data", (chunk) => {
        output += chunk.toString();
        if (output.includes("workspace-lock-ready\n")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      session.stderr.on("data", (chunk) => { errors += chunk.toString(); });
      closed.then(([code]) => {
        clearTimeout(timeout);
        if (code !== 0) reject(new Error(errors || "Test transaction failed"));
      }, reject);
      session.stdin.write(`begin; ${query}\nselect 'workspace-lock-ready';\n`);
    });
    check();
  } finally {
    session.stdin.end("rollback;\n");
    await closed;
  }
}

try {
  sql(`insert into auth.users (id, email) values
    ('${first}', 'concurrency-${first}@example.test'), ('${other}', 'concurrency-${other}@example.test');
    update public.profiles set status = 'approved' where id in ('${first}', '${other}');`);

  await hold(`${account(first)} select public.reset_workspace_data();`, () => {
    assert.equal(sql(`begin; ${account(other)}
      insert into public.tasks (title) values ('Other workspace write') returning title;
      commit;`), "Other workspace write");
    sql(`begin; ${account(first)} insert into public.tasks (title) values ('Must fail'); commit;`, "55P03");
  });

  await hold(`${account(first)} insert into public.tasks (title) values ('Held owner write');`, () => {
    sql(`begin; ${account(first)} select public.reset_workspace_data(); commit;`, "55P03");
    assert.equal(sql(`begin; ${account(other)} select public.reset_workspace_data()->>'tasks'; commit;`), "1");
    const legacy = { app: "AMHIL OS", version: 1, data: { tasks: [{ id: randomUUID(), title: "Restored" }] } };
    assert.equal(sql(`begin; ${account(other)}
      select public.restore_workspace_backup($backup$${JSON.stringify(legacy)}$backup$)->>'tasks'; commit;`), "1");
  });

  await hold(`${account(other)} select id from public.tasks for update;`, () => {
    const start = Date.now();
    sql(`begin; ${account(other)} select public.reset_workspace_data(); commit;`, "55P03");
    assert.ok(Date.now() - start < 5000, "physical row lock wait is bounded");
    assert.equal(sql(`begin; ${account(first)}
      insert into public.tasks (title) values ('Independent write') returning title; commit;`), "Independent write");
  });

  assert.equal(sql(`begin; ${account(other)} select title from public.tasks; commit;`), "Restored");
  console.log("Concurrent empty reset, other-account writes and restore, same-account conflicts, and physical lock timeout passed.");
} finally {
  sql(`delete from auth.users where id in ('${first}', '${other}');`);
}
