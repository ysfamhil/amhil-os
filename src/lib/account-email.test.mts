// Account e-mails: the five messages, the shared look, and that a stranger's name cannot inject markup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { ACCOUNT_EMAIL_KINDS, renderAccountEmail, SITE_URL } = (await import(
  new URL("./account-email.ts", import.meta.url).href
)) as typeof import("./account-email");

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const render = (kind: (typeof ACCOUNT_EMAIL_KINDS)[number], name: string | null = "Sam") =>
  renderAccountEmail(kind, { email: "sam@example.test", name }, "contact@example.test");
const links = (html: string) => [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);

test("each message has its own subject, one button and a plain-text version", () => {
  const buttons = {
    admin_new_registration: `${SITE_URL}/app/admin`,
    account_approved: `${SITE_URL}/app/login`,
    account_declined: "mailto:contact@example.test",
    account_suspended: "mailto:contact@example.test",
    account_restored: `${SITE_URL}/app/login`,
  };
  assert.deepEqual(Object.keys(buttons), [...ACCOUNT_EMAIL_KINDS]);
  const subjects = new Set<string>();
  for (const kind of ACCOUNT_EMAIL_KINDS) {
    const { subject, html, text } = render(kind);
    subjects.add(subject);
    assert.deepEqual(links(html), [buttons[kind], SITE_URL], kind);
    assert.ok(text.includes(buttons[kind].replace("mailto:", "")), kind);
    assert.ok(!/<[a-z]/i.test(text), `${kind}: markup in the text version`);
    assert.ok(!subject.includes("sam@") && !subject.includes("Sam"), `${kind}: personal data in the subject`);
  }
  assert.equal(subjects.size, ACCOUNT_EMAIL_KINDS.length);
});

test("user messages carry nothing typed by anyone", () => {
  for (const kind of ACCOUNT_EMAIL_KINDS.filter((k) => k !== "admin_new_registration")) {
    const { html, text } = render(kind, "Injected Name");
    for (const part of [html, text]) assert.ok(!part.includes("Injected") && !part.includes("sam@example.test"), kind);
  }
});

test("the registration alert escapes the name and keeps it to one short line", () => {
  const { html, text, subject } = render("admin_new_registration", `<a href="https://evil.example">Reset\r\nBcc: x</a>${"y".repeat(200)}`);
  assert.deepEqual(links(html), [`${SITE_URL}/app/admin`, SITE_URL]);
  assert.ok(html.includes("&lt;a href=&quot;https://evil.example&quot;&gt;Reset Bcc: x&lt;/a&gt;"));
  assert.ok(!/\r/.test(text) && !text.includes("y".repeat(81)));
  assert.equal(subject, "New AMHIL OS registration waiting for approval");
  assert.ok(render("admin_new_registration", null).text.includes("sam@example.test confirmed"));
});

test("the look is the reset e-mail's", () => {
  const skeleton = (html: string) =>
    [...html.matchAll(/<([a-z0-9]+)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/g)].map(
      ([, tag, attributes]) => tag + (/ style="([^"]*)"/.exec(attributes)?.[1] ?? "").replace("; overflow-wrap:anywhere; word-break:break-word", ""),
    );
  const reference = skeleton(read("../../supabase/templates/recovery.html"));
  for (const kind of ACCOUNT_EMAIL_KINDS) assert.deepEqual(skeleton(render(kind).html), reference, kind);
});

test("the route accepts only a fresh signature of the exact body, and logs nothing", () => {
  const route = read("../app/app/api/account-email/route.ts").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
  assert.ok(route.indexOf("!signedBy(secret, request, body)") < route.indexOf("JSON.parse("), "verify before parsing");
  assert.match(route, /createHmac\("sha256", secret\)\.update\(`\$\{time\}\.\$\{body\}`\)/);
  assert.match(route, /timingSafeEqual\(expected, /);
  assert.match(route, /Math\.abs\(Date\.now\(\) \/ 1000 - Number\(time\)\) > MAX_AGE_SECONDS\) return false/);
  assert.ok(!/console\.|cookies|createClient|SERVICE_ROLE|NEXT_PUBLIC|x-account-email-secret/.test(route));
  assert.match(route, /secret\.length < 32 \|\| !apiKey \|\| !contact\) return reply\(503\)/);
  // the key only ever goes to Resend or to a fake on this machine
  assert.ok(route.includes('/^http:\\/\\/127\\.0\\.0\\.1:\\d+$/') && route.includes('"https://api.resend.com"'));
  // the kinds the database can queue are the kinds the app can send
  const migration = read("../../supabase/migrations/20261126000003_account_email_queue.sql");
  const allowed = /kind text not null check \(kind in \(([^)]*)\)/.exec(migration)![1];
  assert.deepEqual([...allowed.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]), [...ACCOUNT_EMAIL_KINDS]);
});

test("the database sends with the http extension in a private schema, never pg_net, and never the secret", () => {
  const migration = read("../../supabase/migrations/20261126000003_account_email_queue.sql").replace(/^\s*--.*$/gm, "");
  assert.match(migration, /create extension http with schema account_email_private;/);
  assert.ok(!/pg_net|net\.http_|create extension if not exists http/.test(migration));
  assert.match(migration, /extensions\.hmac\(convert_to\(v_time \|\| '\.' \|\| v_body, 'UTF8'\), convert_to\(v_secret, 'UTF8'\), 'sha256'\)/);
  // the secret appears only as the signing key
  assert.equal(migration.match(/v_secret/g)!.length, 4);
  assert.match(migration, /position\(r\.id::text in coalesce\(v_content, ''\)\) > 0 then null/);
});
