// Password recovery must work in whichever browser reads the e-mail, without weakening the checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");

test("the reset e-mail links to the recovery page with the token after '#'", () => {
  const template = read("../../supabase/templates/recovery.html");
  const links = [...template.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ["{{ .SiteURL }}/app/auth/recovery#token_hash={{ .TokenHash }}", "{{ .SiteURL }}"]);
  assert.ok(!template.includes("{{ .ConfirmationURL }}"), "the one-click link would be used up by mail scanners");
  assert.ok(!template.includes("{{ .Token }}") && !template.includes("{{ .Email }}"));
  const images = [...template.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(images.every((src) => src === "{{ .SiteURL }}/apple-icon.png"), "no third-party or tracking images");
});

test("opening the recovery page verifies nothing; only the posted form does", () => {
  for (const path of ["../app/app/auth/recovery/page.tsx", "../components/auth/recovery-continue.tsx"]) {
    const source = code(path);
    assert.ok(!/verifyOtp|exchangeCodeForSession|createClient|requestSubmit|\.submit\(|formAction\(/.test(source), `${path} must not act on load`);
  }
  const component = code("../components/auth/recovery-continue.tsx");
  assert.match(component, /useActionState\(verifyRecoveryToken,/);
  assert.match(component, /<form action=\{formAction\}/);
});

test("the token leaves the address bar, is never stored or logged, and no exit keeps the page alive", () => {
  const component = code("../components/auth/recovery-continue.tsx");
  assert.match(component, /history\.replaceState\(window\.history\.state, "", window\.location\.pathname\)/);
  assert.match(component, /window\.location\.replace\(state\.next\)/);
  assert.ok(!/next\/link|useRouter/.test(component), "client-side navigation would carry the token and policy along");
  for (const path of ["../components/auth/recovery-continue.tsx", "./actions/recovery.ts"]) {
    assert.ok(!/console\.|localStorage|sessionStorage|document\.cookie|sendBeacon|fetch\(|https?:\/\//.test(code(path)), path);
  }
  assert.match(read("../../next.config.ts"), /logging: \{ serverFunctions: false \}/);
  const manifest = read("../../package.json");
  assert.ok(!/sentry|analytics|speed-insights|posthog|segment|datadog|logrocket|hotjar/i.test(manifest), "a new reporting tool must be reviewed against recovery tokens");
});

test("the action accepts only a well-formed recovery token and never takes the type or target from the request", () => {
  const action = code("./actions/recovery.ts");
  assert.match(action, /verifyOtp\(\{ type: "recovery", token_hash: tokenHash \}\)/);
  assert.equal(action.match(/formData\.get\(/g)!.length, 1);
  assert.deepEqual([...action.matchAll(/next: "([^"]+)"/g)].map((m) => m[1]), [
    "/app/login?error=reset_link_invalid",
    "/app/reset-password",
  ]);
  // A signed-in account is refused before the token is used.
  assert.ok(action.indexOf("signedIn: true") < action.indexOf("verifyOtp("));
  const pattern = new RegExp(/const TOKEN_HASH = \/(.+)\/;/.exec(read("./actions/recovery.ts"))![1]);
  for (const good of ["a".repeat(56), "pkce_" + "0f".repeat(28)]) assert.ok(pattern.test(good), good);
  for (const bad of ["", "short", "a".repeat(201), "a".repeat(30) + "&type=signup", "../app/admin/aaaaaaaaaaaaaaaaaaaa", "a b".repeat(20)]) assert.ok(!pattern.test(bad), bad);
});

test("only a session started with a password counts as a full session", async () => {
  const { isRestrictedSession } = (await import(new URL("./session-restriction.ts", import.meta.url).href)) as typeof import("./session-restriction");
  const token = (claims: unknown) => `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
  const amr = (...methods: string[]) => token({ sub: "u", amr: methods.map((method) => ({ method, timestamp: 1 })) });
  assert.equal(isRestrictedSession(amr("password")), false);
  assert.equal(isRestrictedSession(amr("otp", "password")), false);
  for (const methods of [["otp"], ["recovery"], ["magiclink"], []]) assert.equal(isRestrictedSession(amr(...methods)), true, String(methods));
  for (const bad of [null, undefined, "", "not-a-token", "a.%%%.c", token({ sub: "u" }), token({ amr: "password" }), token({ amr: ["password"] })]) {
    assert.equal(isRestrictedSession(bad as string), true, String(bad));
  }
});

test("every server gate, the proxy and the database refuse restricted sessions", () => {
  for (const path of ["./auth.ts", "./actions/admin.ts", "./actions/import.ts", "../app/app/(app)/settings/data/backup/route.ts"]) {
    assert.match(code(path), /session\??\.restricted/, path);
  }
  assert.equal(code("./auth.ts").match(/session\.restricted\)/g)!.length, 2, "requireApprovedSession and requireAdmin");
  const proxy = code("./supabase/middleware.ts");
  assert.match(proxy, /const RESTRICTED_SESSION_PATHS = \["\/app\/reset-password", "\/app\/pending"\];/);
  assert.match(proxy, /restricted && !isPublicPath && !covers\(RESTRICTED_SESSION_PATHS/);
  const migration = read("../../supabase/migrations/20261126000002_recovery_sessions_are_limited.sql");
  assert.equal(migration.match(/@> '\[\{"method":"password"\}\]'::jsonb/g)!.length, 2, "is_approved_account and is_admin");
});

test("older links still go through the PKCE callback, and sign-up confirmation is unchanged", () => {
  assert.match(read("../app/app/forgot-password/page.tsx"), /\/app\/auth\/callback\?next=\/app\/reset-password/);
  assert.match(read("../app/app/auth/callback/route.ts"), /exchangeCodeForSession\(code\)/);
  assert.match(read("../app/app/signup/page.tsx"), /emailRedirectTo: `\$\{window\.location\.origin\}\/app\/auth\/callback`/);
});
