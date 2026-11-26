import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const app = new URL(process.env.AMHIL_TEST_APP_URL);
const api = new URL(process.env.AMHIL_TEST_API_URL);
for (const endpoint of [app, api]) {
  assert.equal(endpoint.protocol, "http:");
  assert.equal(endpoint.hostname, "127.0.0.1", "Tests require disposable loopback endpoints");
}
const anonKey = process.env.AMHIL_TEST_ANON_KEY;
const trusted = createClient(api.origin, process.env.AMHIL_TEST_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function unwrap({ data, error }) {
  assert.ifError(error);
  return data;
}

const email = `backup-${randomUUID()}@example.test`;
const password = randomUUID();
const { user } = unwrap(await trusted.auth.admin.createUser({ email, password, email_confirm: true }));
const jar = new Map();
const member = createServerClient(api.origin, anonKey, {
  cookies: {
    getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
    setAll: (cookies) => cookies.forEach(({ name, value }) => jar.set(name, value)),
  },
});

const cookieHeader = () => Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
const limit = 3 * 1024 * 1024;
const vercelDefault = 4_500_000;

function headerBytes(headers) {
  return [...headers].reduce((size, [key, value]) => size + Buffer.byteLength(`${key}: ${value}\r\n`), 2);
}

async function upload(mode, body, origin = app.origin) {
  const url = new URL(`/settings/data/restore?mode=${mode}`, app);
  const length = Buffer.byteLength(body);
  const headers = new Headers({
    cookie: cookieHeader(), origin, "content-type": "application/json",
    "content-length": String(length), host: app.host,
  });
  assert.ok(length + headerBytes(headers) + Buffer.byteLength(`POST ${url.pathname}${url.search} HTTP/1.1\r\n`) < vercelDefault);
  return fetch(url, { method: "POST", redirect: "manual", headers, body });
}

const download = () => fetch(new URL("/settings/data/backup", app), {
  headers: { cookie: cookieHeader(), "accept-encoding": "identity" },
});

try {
  unwrap(await trusted.from("profiles").update({ status: "approved" }).eq("id", user.id).select("id").single());
  unwrap(await member.auth.signInWithPassword({ email, password }));

  const page = await fetch(new URL("/settings/data", app), { headers: { cookie: cookieHeader() } });
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Export All Data/);
  assert.match(html, /Choose a JSON backup/);
  assert.match(html, /Download a backup first/);

  const exact = {
    integer: "9007199254740993",
    decimal: "0.123456789012345678901234567890",
    large: "12345678901234567890123456789012345678901234567890",
  };
  const rawMetadata = Object.entries(exact).map(([key, numeric]) => `"${key}": ${numeric}`).join(", ");
  const legacy = `{"app":"AMHIL OS","version":1,"data":{"timeline_events":[{
    "id":"${randomUUID()}","event_type":"task_created","title":"Lossless HTTP values","metadata":{${rawMetadata}}
  }]}}`;
  assert.equal((await upload("preview", legacy)).status, 200);
  assert.equal((await upload("restore", legacy)).status, 200);
  const assertExactBytes = (body) => {
    for (const [key, numeric] of Object.entries(exact)) {
      const token = `"${key}": ${numeric}`;
      assert.ok(body.includes(Buffer.from(token + ",")) || body.includes(Buffer.from(token + "}")),
        `${key} must survive as exact UTF-8 JSON bytes`);
    }
  };

  unwrap(await member.from("tasks").insert(Array.from({ length: 1001 }, (_, index) => ({
    title: `Backup task ${index}`,
  }))));
  const linked = unwrap(await member.from("tasks").select("id").eq("title", "Backup task 0").single());
  unwrap(await member.from("time_entries").insert({ duration_minutes: 20, task_id: linked.id }));
  const linkedTaskTitle = async () => unwrap(await member.from("time_entries").select("tasks(title)").single()).tasks.title;
  assert.equal(await linkedTaskTitle(), "Backup task 0");
  const initial = unwrap(await member.rpc("export_workspace_backup"));
  const multibyteContent = "é".repeat(Math.floor((limit - Buffer.byteLength(JSON.stringify(initial)) - 100_000) / 2));
  const note = unwrap(await member.from("notes").insert({
    title: "Multibyte transport fixture", content: multibyteContent,
  }).select("id").single());
  const response = await download();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(response.headers.get("content-type"), /^application\/json; charset=utf-8$/i);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-encoding"), null, "an identity download must not be re-encoded");
  const exportedBytes = Buffer.from(await response.arrayBuffer());
  assertExactBytes(exportedBytes);
  const payload = exportedBytes.toString("utf8");
  const bytes = Buffer.byteLength(payload);
  // Next.js 16.4 no longer forwards a route handler's Content-Length (it frames the body with
  // Transfer-Encoding: chunked), so the header is not required. Completeness is proven below by
  // comparing the full body with the database export instead. If a platform does send a length,
  // it must still be exactly right.
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) assert.equal(Number(declaredLength), bytes);
  assert.ok(bytes > 2_900_000 && bytes <= limit);
  assert.ok(bytes + headerBytes(response.headers) + Buffer.byteLength("HTTP/1.1 200 OK\r\n") < vercelDefault);
  const backup = JSON.parse(payload);
  assert.equal(backup.app, "AMHIL OS");
  assert.equal(backup.counts.tasks, 1001);
  // The downloaded body must be the complete export: identical to a fresh database export except
  // for the dynamic exportedAt timestamp (same bytes, same length, nothing truncated or altered).
  const withoutExportedAt = (text) => text.replace(/"exportedAt": "[^"]+"/, '"exportedAt": ""');
  const expectedExport = unwrap(await member.rpc("export_workspace_backup_text")).body;
  assert.equal(withoutExportedAt(payload), withoutExportedAt(expectedExport),
    "downloaded body must equal the database export except for exportedAt");
  assert.equal(bytes, Buffer.byteLength(expectedExport), "downloaded length must equal the exported length");

  unwrap(await member.from("notes").update({ content: "é".repeat(limit / 2) }).eq("id", note.id));
  const oversizedDownload = await download();
  assert.equal(oversizedDownload.status, 422);
  assert.match((await oversizedDownload.json()).error, /3 MiB/);
  unwrap(await member.from("notes").update({ content: multibyteContent }).eq("id", note.id));

  assert.equal((await upload("preview", payload, "http://127.0.0.1:1")).status, 403);
  assert.equal((await upload("preview", "{broken")).status, 400);
  assert.equal((await upload("preview", '{"app":"AMHIL OS","version":1,"version":2,"data":{}}')).status, 400);
  const padded = payload + " ".repeat(limit - bytes);
  assert.equal(Buffer.byteLength(padded), limit);
  assert.equal((await upload("preview", padded + " ")).status, 413);

  const blocked = await upload("preview", padded);
  assert.equal(blocked.status, 200);
  assert.equal((await blocked.json()).preview.empty, false);
  assert.equal((await upload("restore", payload)).status, 400);

  const imprecise = `{"app":"AMHIL OS","version":1,"data":{"income":[{
    "id":"${randomUUID()}","amount":1.235
  }]}}`;
  const snapshotDigest = async () => {
    const snapshot = await download();
    assert.equal(snapshot.status, 200);
    const data = (await snapshot.text()).replace(/"exportedAt": "[^"]+"/, '"exportedAt": ""');
    return createHash("sha256").update(data).digest("hex");
  };
  const beforeRejectedRestore = await snapshotDigest();
  for (const mode of ["preview", "restore"]) {
    const result = await upload(mode, imprecise);
    assert.equal(result.status, 400);
    assert.match((await result.json()).error, /income\.amount without precision loss/);
  }
  assert.equal(await snapshotDigest(), beforeRejectedRestore,
    "precision rejection leaves every existing record unchanged");

  const reset = unwrap(await member.rpc("reset_workspace_data"));
  assert.equal(reset.tasks, 1001);
  const ready = await upload("preview", padded);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).preview.empty, true);

  const restored = await upload("restore", padded);
  assert.equal(restored.status, 200);
  assert.equal((await restored.json()).restored.tasks, 1001);
  assert.equal(await linkedTaskTitle(), "Backup task 0");
  assert.deepEqual(unwrap(await member.rpc("export_workspace_backup")).counts, backup.counts);
  const reExport = await download();
  assert.equal(reExport.status, 200);
  assertExactBytes(Buffer.from(await reExport.arrayBuffer()));
  assert.equal((await upload("restore", payload)).status, 400);
  console.log("Backup HTTP round trip passed with exact numeric bytes, a near-limit multibyte download, and an exact-limit upload.");

  // Seed old stored content with the trusted client and bypass the note
  // action with an ordinary authenticated write for the second record.
  unwrap(await trusted.from("notes").insert({
    user_id: user.id,
    title: "Legacy note fixture",
    content: '<strong>Legacy allowed formatting</strong> &lt;b&gt;literal&lt;/b&gt;<img src="legacy-note-marker" onerror="alert(1)">',
  }));
  unwrap(await member.from("notes").insert({
    title: "Direct note fixture",
    content: '<em>Direct allowed formatting</em><p onclick="DIRECT_NOTE_MARKER">Unsafe handler</p><script>DIRECT_NOTE_MARKER</script>',
  }));
  for (const path of ["/notes", "/dashboard"]) {
    const view = await fetch(new URL(path, app), { headers: { cookie: cookieHeader() } });
    assert.equal(view.status, 200);
    const rendered = await view.text();
    assert.ok(rendered.includes("<strong>Legacy allowed formatting</strong>"), `${path} preserves allowed formatting`);
    assert.ok(rendered.includes("<em>Direct allowed formatting</em>"), `${path} preserves directly written formatting`);
    assert.ok(rendered.includes("&lt;b&gt;literal&lt;/b&gt;"), `${path} preserves escaped literal tags`);
    assert.ok(rendered.includes("<p>Unsafe handler</p>"), `${path} drops the handler and keeps the paragraph`);
    assert.ok(!/<img\b[^>]*legacy-note-marker|<p\b[^>]*onclick="DIRECT_NOTE_MARKER"|<script>DIRECT_NOTE_MARKER/.test(rendered),
      `${path} must keep unsafe markup out of the rendered HTML`);
  }
  console.log("Notes and Overview rendered legacy and direct database writes with unsafe markup removed.");
} finally {
  unwrap(await trusted.auth.admin.deleteUser(user.id));
}
