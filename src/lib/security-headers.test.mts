import { test } from "node:test";
import assert from "node:assert/strict";

const { default: config } = (await import(new URL("../../next.config.ts", import.meta.url).href)) as typeof import("../../next.config");

const rules = await config.headers!();
const toMap = (rule: (typeof rules)[number]) => new Map(rule.headers.map((header) => [header.key, header.value] as const));
const directives = (value: string) =>
  new Map(
    value
      .split(";")
      .map((directive) => directive.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values.join(" ")] as const),
  );
// The first rule is the baseline for every route.
const headers = toMap(rules[0]);
const csp = directives(headers.get("Content-Security-Policy")!);

test("one catch-all rule applies the headers to every route, with no duplicate header names", () => {
  assert.equal(rules[0].source, "/:path*");
  for (const rule of rules) assert.equal(rule.headers.length, new Set(rule.headers.map((header) => header.key)).size);
});

test("the only override is a stricter policy on the page that holds a recovery token", () => {
  assert.equal(rules.length, 2);
  assert.equal(rules[1].source, "/app/auth/recovery");
  const override = toMap(rules[1]);
  assert.deepEqual([...override.keys()], ["Content-Security-Policy", "Referrer-Policy"]);
  assert.equal(override.get("Referrer-Policy"), "no-referrer");

  const strict = directives(override.get("Content-Security-Policy")!);
  // Everything the baseline restricts stays restricted.
  for (const [name, value] of csp) assert.equal(strict.get(name), value, name);
  // Nothing may be loaded from, or sent to, another origin.
  assert.equal(strict.get("default-src"), "'self'");
  assert.equal(strict.get("connect-src"), "'self'");
  assert.equal(strict.get("font-src"), "'self'");
  assert.equal(strict.get("img-src"), "'self' data:");
  assert.equal(strict.get("script-src"), "'self' 'unsafe-inline'");
  assert.equal(strict.get("style-src"), "'self' 'unsafe-inline'");
});

test("framing is blocked by both CSP frame-ancestors and X-Frame-Options", () => {
  assert.equal(csp.get("frame-ancestors"), "'none'");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
});

test("the CSP restricts base URIs, form targets and plugins to this origin or nothing", () => {
  assert.equal(csp.get("base-uri"), "'self'");
  assert.equal(csp.get("form-action"), "'self'");
  assert.equal(csp.get("object-src"), "'none'");
});

test("the CSP never weakens script execution (no unsafe-inline / unsafe-eval / wildcards / data:)", () => {
  const value = headers.get("Content-Security-Policy")!;
  for (const forbidden of ["unsafe-inline", "unsafe-eval", "unsafe-hashes", "*", "data:", "http:"]) {
    assert.ok(!value.includes(forbidden), `CSP must not contain ${forbidden}`);
  }
});

test("MIME sniffing is disabled and referrers never leave the origin", () => {
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("Referrer-Policy"), "same-origin");
});

test("Permissions-Policy denies every powerful capability the app does not use", () => {
  const policy = headers.get("Permissions-Policy")!;
  for (const feature of ["camera", "microphone", "geolocation", "payment", "usb", "display-capture"]) {
    assert.ok(policy.split(", ").includes(`${feature}=()`), `${feature} must be denied`);
  }
  assert.ok(policy.split(", ").every((item) => /^[a-z-]+=\(\)$/.test(item)), "every entry must be an empty allow-list");
});

test("the framework is not advertised and HSTS is left to the platform", () => {
  assert.equal(config.poweredByHeader, false);
  assert.ok(!headers.has("Strict-Transport-Security"), "HSTS is verified at the platform, not asserted here");
});
