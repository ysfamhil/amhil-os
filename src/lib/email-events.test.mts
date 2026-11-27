// Resend delivery events: only genuine ones are read, only this app's real problems raise an alert.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

const { deliveryProblem, isSignedByResend } = (await import(new URL("./email-events.ts", import.meta.url).href)) as typeof import("./email-events");

const secret = "whsec_" + randomBytes(24).toString("base64");
const now = 1_790_000_000_000;
const signed = (body: string, { key = secret, at = now / 1000, id = "msg_1" } = {}) =>
  new Headers({
    "svix-id": id,
    "svix-timestamp": String(at),
    "svix-signature": "v1,bm90LWl0 v1," + createHmac("sha256", Buffer.from(key.slice(6), "base64")).update(`${id}.${at}.${body}`).digest("base64"),
  });

test("only a fresh, unaltered request signed with the secret is accepted", () => {
  const body = '{"type":"email.bounced"}';
  assert.ok(isSignedByResend(secret, signed(body), body, now));
  assert.ok(!isSignedByResend(secret, signed(body), body + " ", now), "altered body");
  assert.ok(!isSignedByResend(secret, signed(body, { key: "whsec_" + randomBytes(24).toString("base64") }), body, now), "other secret");
  assert.ok(!isSignedByResend(secret, signed(body, { at: now / 1000 - 301 }), body, now), "old request");
  assert.ok(!isSignedByResend(secret, new Headers(), body, now), "unsigned");
  for (const bad of ["", "whsec_", "plain-secret"]) assert.ok(!isSignedByResend(bad, signed(body), body, now), bad);
});

const contact = "owner@example.test";
const event = (type: string, over: Record<string, unknown> = {}) => ({
  type,
  data: { from: "AMHIL OS <no-reply@mail.byamhil.com>", to: ["someone@example.test"], subject: "Confirm your AMHIL OS email address", ...over },
});

test("bounces, complaints, failures and suppressions raise an alert", () => {
  for (const type of ["email.bounced", "email.complained", "email.failed", "email.suppressed"]) {
    const problem = deliveryProblem(event(type), contact);
    assert.equal(problem?.recipient, "someone@example.test", type);
    assert.ok(problem.what.length > 0);
  }
});

test("everything else is ignored: other events, other projects and the alert address itself", () => {
  for (const type of ["email.sent", "email.delivered", "email.delivery_delayed", "email.opened"]) assert.equal(deliveryProblem(event(type), contact), null, type);
  assert.equal(deliveryProblem(event("email.bounced", { from: "no-reply@mail.other-project.test" }), contact), null);
  assert.equal(deliveryProblem(event("email.bounced", { from: "x@mail.byamhil.com.evil.test" }), contact), null);
  assert.equal(deliveryProblem(event("email.bounced", { to: ["OWNER@example.test"] }), contact), null);
  for (const junk of [null, {}, { type: "email.bounced" }, "text"]) assert.equal(deliveryProblem(junk, contact), null);
});
