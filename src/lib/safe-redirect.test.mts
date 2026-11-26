import { test } from "node:test";
import assert from "node:assert/strict";

const { safeNextPath } = (await import(new URL("./safe-redirect.ts", import.meta.url).href)) as typeof import("./safe-redirect");

const APP_ORIGIN = "https://os.byamhil.com";
const FALLBACK = "/__fallback__";
const next = (value: string | null | undefined) => safeNextPath(value, FALLBACK);

test("legitimate internal paths, queries and fragments pass through unchanged", () => {
  for (const ok of [
    "/",
    "/dashboard",
    "/tasks",
    "/finance/funds/6f1c0c5e-1b1e-4c7e-9d0a-0123456789ab",
    "/journal?date=2026-01-01",
    "/tasks?status=Done&priority=High&q=hello%20world",
    "/notes?q=caf%C3%A9",
    "/tasks#top",
    "/settings/data?x=1#section",
    "/reset-password",
    "/admin",
    "/a%20b/c",
  ]) {
    assert.equal(next(ok), ok, `${ok} should be preserved`);
  }
});

test("missing or empty input falls back; the fallback is configurable", () => {
  assert.equal(safeNextPath(null), "/app/dashboard");
  assert.equal(safeNextPath(undefined), "/app/dashboard");
  assert.equal(safeNextPath(""), "/app/dashboard");
  assert.equal(safeNextPath("https://evil.example", "/home"), "/home");
});

test("off-site and protocol-relative targets are rejected", () => {
  for (const bad of [
    "//evil.example",
    "///evil.example",
    "////evil.example/path",
    "https://evil.example",
    "http://evil.example/x",
    "HTTPS://EVIL.EXAMPLE",
    "evil.example",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "mailto:a@b.c",
    " //evil.example",
    "dashboard",
    "../dashboard",
    "\\\\evil.example",
  ]) {
    assert.equal(next(bad), FALLBACK, `${JSON.stringify(bad)} must be rejected`);
  }
});

test("backslashes are rejected literally and percent-encoded", () => {
  for (const bad of ["/\\evil.example", "/\\/evil.example", "/a\\b", "/%5Cevil.example", "/%5c/evil.example", "/a/%5Cb"]) {
    assert.equal(next(bad), FALLBACK, `${JSON.stringify(bad)} must be rejected`);
  }
});

test("control and invisible characters are rejected literally and percent-encoded", () => {
  for (const bad of [
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\u0000/evil.example",
    "/\u001f/evil.example",
    "/\u007f/evil.example",
    "/\u0085/evil.example",
    "/ /evil.example",
    "/​/evil.example",
    "/﻿/evil.example",
    "/%09/evil.example",
    "/%0A/evil.example",
    "/%0d%0a/evil.example",
    "/%00",
    "/ok?x=%0d%0aSet-Cookie:a=b",
    "/%E2%80%A8/evil.example",
  ]) {
    assert.equal(next(bad), FALLBACK, `${JSON.stringify(bad)} must be rejected`);
  }
});

test("dot-segment tricks that normalise to a protocol-relative URL are rejected", () => {
  for (const bad of ["/..//evil.example", "/.//evil.example", "/%2e%2e//evil.example", "/%2E%2E//evil.example", "/a/..//evil.example", "/././/evil.example"]) {
    assert.equal(next(bad), FALLBACK, `${JSON.stringify(bad)} must be rejected`);
  }
  // Harmless dot segments are resolved, and the RESOLVED path is what callers receive.
  assert.equal(next("/a/b/../c"), "/a/c");
  assert.equal(next("/a/./b"), "/a/b");
});

test("malformed or oversized input is rejected", () => {
  assert.equal(next("/%E0%A4%A"), FALLBACK);
  assert.equal(next("/%"), FALLBACK);
  assert.equal(next("/" + "a".repeat(2048)), FALLBACK);
  assert.equal(next("/" + "a".repeat(2047)), "/" + "a".repeat(2047));
  assert.equal(next(42 as unknown as string), FALLBACK);
  assert.equal(next({} as unknown as string), FALLBACK);
});

test("exhaustive property: whatever comes out always stays on the application origin", () => {
  const alphabet = ["/", "\\", "\t", "\n", "\r", ".", "%", "2", "e", "f", "5", "c", "0", "a", ":", "@", " ", "?", "#"];
  const resolved = (value: string) => new URL(value, APP_ORIGIN);
  let checked = 0;
  let accepted = 0;
  const visit = (prefix: string, depth: number) => {
    const out = next(prefix);
    checked += 1;
    if (out !== FALLBACK) {
      accepted += 1;
      assert.ok(out.startsWith("/") && !out.startsWith("//"), `${JSON.stringify(prefix)} -> ${JSON.stringify(out)} is not a single-slash path`);
      assert.ok(!/[\u0000-\u001f\u007f\\]/.test(out), `${JSON.stringify(prefix)} -> ${JSON.stringify(out)} contains a control character or backslash`);
      const url = resolved(out);
      assert.equal(url.origin, APP_ORIGIN, `${JSON.stringify(prefix)} -> ${JSON.stringify(out)} left the origin`);
      // Validated value is idempotent: validating it again returns it unchanged.
      assert.equal(next(out), out, `${JSON.stringify(out)} must be stable`);
    }
    if (depth === 0) return;
    for (const ch of alphabet) visit(prefix + ch, depth - 1);
  };
  visit("/", 4);
  visit("", 3);
  assert.ok(checked > 90_000, `expected an exhaustive sweep, only checked ${checked}`);
  assert.ok(accepted > 1_000, "the sweep must also exercise accepted values");
});
