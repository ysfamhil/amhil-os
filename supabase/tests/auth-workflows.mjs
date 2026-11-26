import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const api = new URL(process.env.AMHIL_TEST_API_URL);
const mail = new URL(process.env.AMHIL_TEST_MAIL_URL);
for (const endpoint of [api, mail]) {
  assert.equal(endpoint.protocol, "http:");
  assert.equal(endpoint.hostname, "127.0.0.1", "This test requires a disposable loopback stack");
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const browser = () => createClient(api.origin, process.env.AMHIL_TEST_ANON_KEY, options);
const trusted = createClient(api.origin, process.env.AMHIL_TEST_SERVICE_KEY, options);
const accounts = [];

function ok(result, step) {
  assert.ifError(result.error ? new Error(step + ": " + result.error.message) : null);
  return result.data;
}

async function signup(client) {
  const email = "phase1-" + randomUUID() + "@example.test";
  const password = randomUUID();
  const { user } = ok(await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Local test", role: "admin", status: "approved" } },
  }), "signup");
  accounts.push(user.id);
  ok(await client.auth.signInWithPassword({ email, password }), "password login");
  const profile = ok(await client.from("profiles").select("role,status").eq("id", user.id).single(), "read own profile");
  assert.deepEqual(profile, { role: "user", status: "pending" });
  return { id: user.id, email };
}

async function waitForRecovery(email) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const inbox = await fetch(new URL("/api/v1/messages", mail));
    assert.ok(inbox.ok, "Mailpit inbox reachable");
    const { messages } = await inbox.json();
    const message = messages.find((entry) => entry.To.some((recipient) => recipient.Address === email));
    if (message) {
      const response = await fetch(new URL("/api/v1/message/" + message.ID, mail));
      assert.ok(response.ok, "Mailpit message reachable");
      const { Text } = await response.json();
      const rawLink = Text.match(/https?:\/\/[^\s<>]+\/auth\/v1\/verify\?[^\s<>]+/)?.[0];
      assert.ok(rawLink, "Recovery email contains a verification URL");
      const link = new URL(rawLink);
      assert.equal(link.origin, api.origin, "Verification URL belongs to the disposable Auth service");
      return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.fail("Recovery message did not arrive");
}

async function recoverPassword(account) {
  const recovery = createClient(api.origin, process.env.AMHIL_TEST_ANON_KEY, {
    auth: { ...options.auth, flowType: "pkce" },
  });
  ok(await recovery.auth.resetPasswordForEmail(account.email), "request password recovery");
  const verification = await fetch(await waitForRecovery(account.email), { redirect: "manual" });
  assert.ok(verification.status >= 300 && verification.status < 400, "Recovery redirects with a code");
  const redirect = new URL(verification.headers.get("location"));
  const code = redirect.searchParams.get("code");
  assert.ok(code, "Recovery redirect supplied a PKCE code");
  ok(await recovery.auth.exchangeCodeForSession(code), "exchange recovery code");
  const password = randomUUID();
  ok(await recovery.auth.updateUser({ password }), "set recovered password");
  ok(await recovery.auth.signOut(), "sign out from recovery");
  ok(await browser().auth.signInWithPassword({ email: account.email, password }), "login with recovered password");
}

try {
  const admin = browser();
  const member = browser();
  const pending = browser();
  const adminAccount = await signup(admin);
  const memberAccount = await signup(member);
  const pendingAccount = await signup(pending);
  ok(await trusted.from("profiles").update({ role: "admin", status: "approved" })
    .eq("id", adminAccount.id).select("id").single(), "trusted administrator provisioning");

  const setStatus = async (status) => ok(await admin.from("profiles").update({
    status,
    approved_at: status === "approved" ? new Date().toISOString() : null,
    approved_by: status === "approved" ? adminAccount.id : null,
  }).eq("id", memberAccount.id).select("status").single(), "admin updates member status");

  assert.equal((await setStatus("approved")).status, "approved");
  const task = ok(await member.from("tasks").insert({ title: "Local authorization fixture" })
    .select("id").single(), "approved member writes a task");
  const notification = {
    user_id: memberAccount.id,
    type: "task_overdue",
    title: "Local reminder",
    message: "Local reminder",
    related_entity_type: "task",
    related_entity_id: task.id,
    occurred_on: "2026-01-01",
  };
  const upsertNotification = () => member.from("notifications").upsert(notification, {
    onConflict: "user_id,type,related_entity_id,occurred_on",
    ignoreDuplicates: true,
  }).select("id");
  assert.equal(ok(await upsertNotification(), "approved notification automation can insert").length, 1);
  assert.deepEqual(ok(await upsertNotification(), "notification deduplication still works"), []);
  assert.deepEqual(ok(await admin.from("tasks").select("id").eq("id", task.id), "admin task query"), []);

  assert.equal((await setStatus("suspended")).status, "suspended");
  assert.deepEqual(ok(await member.from("tasks").select("id"), "suspended task query"), []);
  assert.equal((await member.from("tasks").insert({ title: "Denied" })).error?.code, "42501");
  assert.equal(ok(await member.from("profiles").select("status").single(), "suspended status read").status, "suspended");

  await recoverPassword(pendingAccount);
  await recoverPassword(memberAccount);
  assert.equal((await setStatus("approved")).status, "approved");
  assert.deepEqual(ok(await member.from("tasks").select("id"), "reinstated task query"), [task]);
  console.log("Local signup, password login, both recovery flows, approval, suspension, ownership, notifications, and reinstatement passed.");
} finally {
  for (const id of accounts.reverse()) {
    ok(await trusted.auth.admin.deleteUser(id), "delete local fixture account");
  }
}
