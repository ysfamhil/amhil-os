import { test } from "node:test";
import assert from "node:assert/strict";

const { default: config } = (await import(new URL("../../next.config.ts", import.meta.url).href)) as typeof import("../../next.config");

const rules = await config.headers!();
const headers = new Map(rules.flatMap((rule) => rule.headers.map((header) => [header.key, header.value] as const)));
const csp = new Map(
  headers
    .get("Content-Security-Policy")!
    .split(";")
    .map((directive) => directive.trim().split(/\s+/))
    .map(([name, ...values]) => [name, values.join(" ")] as const),
);

test("one catch-all rule applies the headers to every route, with no duplicate header names", () => {
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "/:path*");
  assert.equal(rules[0].headers.length, new Set(rules[0].headers.map((header) => header.key)).size);
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
