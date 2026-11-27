// The application lives under /app; only the landing page is public at the root.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const src = fileURLToPath(new URL("..", import.meta.url));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const files = walk(src).map((path) => relative(src, path));

/** First URL segment of every route under src/app/app (route groups add none). */
const sections = new Set(
  files
    .filter((f) => f.startsWith("app/app/") && /\/(page\.tsx|route\.ts)$/.test(f))
    .map((f) => f.slice("app/app/".length).split("/").filter((part) => !part.startsWith("("))[0])
    .filter((part) => part && !part.includes(".")),
);

test("only the landing page is routed outside /app", () => {
  const outside = files.filter((f) => /^app\/.*(page\.tsx|route\.ts)$/.test(f) && !f.startsWith("app/app/"));
  assert.deepEqual(outside, ["app/page.tsx"]);
  assert.ok(sections.size >= 15, `found only ${sections.size} sections`);
});

test("no in-app link, redirect, revalidation or fetch is missing the /app prefix", () => {
  // projects/clients/learning/leads have no pages today but are still written as in-app paths.
  const names = [...sections, "projects", "clients", "learning", "leads"].join("|");
  const unprefixed = new RegExp(`(?:["'\`]|\\$\\{[^}]*\\}|next=)/(?:${names})(?=[/"'\`?#$]|$)`, "m");
  const offenders = files
    .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
    .flatMap((f) =>
      readFileSync(join(src, f), "utf8")
        .split("\n")
        .map((line, index) => ({ where: `${f}:${index + 1}`, line }))
        // The callback also accepts the pre-move value carried by reset links already sent.
        .filter(({ line }) => unprefixed.test(line.replace('next === "/reset-password"', "")) && !/^\s*(\/\/|\*|\/\*)/.test(line))
        .map(({ where, line }) => `${where}: ${line.trim()}`),
    );
  assert.deepEqual(offenders, []);
});

test("every section has a redirect from its old address, and the root is not redirected", async () => {
  const { default: config } = (await import(new URL("../../next.config.ts", import.meta.url).href)) as typeof import("../../next.config");
  const redirects = await config.redirects!();
  assert.equal(redirects.length, 1);
  const [rule] = redirects;
  const moved = /:section\(([^)]*)\)/.exec(rule.source)![1].split("|");
  // "api" never existed at the root, so it has no old address to redirect.
  assert.deepEqual([...sections].filter((section) => section !== "api" && !moved.includes(section)), []);
  assert.ok(!moved.includes("app"), "a redirect from /app would loop");
  assert.equal(rule.destination, "/app/:section/:path*");
  assert.equal(rule.permanent, false);
});

test("the proxy exempts the landing page by exact match and keeps public screens under /app", () => {
  const middleware = readFileSync(join(src, "lib/supabase/middleware.ts"), "utf8");
  assert.match(middleware, /if \(request\.nextUrl\.pathname === "\/"\) return NextResponse\.next/);
  const list = /const PUBLIC_PATHS = \[([^\]]*)\]/.exec(middleware)![1];
  const publicPaths = [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(publicPaths, ["/app/login", "/app/signup", "/app/forgot-password", "/app/auth/callback", "/app/auth/recovery", "/app/api/account-email", "/app/api/email-events"]);
});

test("auth e-mails return through the callback under /app", () => {
  const read = (f: string) => readFileSync(join(src, f), "utf8");
  assert.ok(read("app/app/forgot-password/page.tsx").includes("${window.location.origin}/app/auth/callback?next=/app/reset-password"));
  assert.ok(read("app/app/signup/page.tsx").includes("emailRedirectTo: `${window.location.origin}/app/auth/callback`"));
});

test("the login screen offers sign-up, and new accounts still wait for approval", async () => {
  const { PUBLIC_SIGNUP_ENABLED } = (await import(new URL("./auth-config.ts", import.meta.url).href)) as typeof import("./auth-config");
  assert.equal(PUBLIC_SIGNUP_ENABLED, true);
  assert.match(readFileSync(join(src, "app/app/signup/page.tsx"), "utf8"), /admin will still need to approve/);
  const login = readFileSync(join(src, "app/app/login/page.tsx"), "utf8");
  assert.match(login, /\{PUBLIC_SIGNUP_ENABLED && \([\s\S]*href="\/app\/signup"/);
  assert.equal(login.match(/href="\/app\/signup"/g)!.length, 1);
});
