import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

const app = new URL(process.env.AMHIL_TEST_APP_URL);
const api = new URL(process.env.AMHIL_TEST_API_URL);
for (const endpoint of [app, api]) {
  assert.equal(endpoint.protocol, "http:");
  assert.equal(endpoint.hostname, "127.0.0.1", "Tests require disposable loopback endpoints");
}
const trusted = createClient(api.origin, process.env.AMHIL_TEST_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cookies = new Map();
const member = createServerClient(api.origin, process.env.AMHIL_TEST_ANON_KEY, {
  cookies: {
    getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
    setAll: (values) => values.forEach(({ name, value }) => cookies.set(name, value)),
  },
});

function unwrap({ data, error }) {
  assert.ifError(error);
  return data;
}

const email = `browser-${randomUUID()}@example.test`;
const password = randomUUID();
const { user } = unwrap(await trusted.auth.admin.createUser({ email, password, email_confirm: true }));
let browser;

async function pageWithSession(javaScriptEnabled) {
  const context = await browser.newContext({ javaScriptEnabled });
  await context.addCookies(Array.from(cookies, ([name, value]) => ({ name, value, url: app.origin })));
  return context.newPage();
}

try {
  unwrap(await trusted.from("profiles").update({ status: "approved" }).eq("id", user.id).select("id").single());
  unwrap(await member.auth.signInWithPassword({ email, password }));
  browser = await chromium.launch({ executablePath: process.env.AMHIL_TEST_BROWSER_EXECUTABLE });

  unwrap(await member.from("notes").insert([
    {
      title: "Containment fixture",
      content: '</div></li><li>bare item</li><p>paragraph<div>block</div></p><b><i>misnested</b></i>'
        + '<strong>Valid note formatting</strong> &lt;b&gt;literal&lt;/b&gt; <img src=x onerror="unsafe-marker">'
        + '<ul><li>Allowed list item</li></ul><div>Note tail marker',
    },
    { title: "Adjacent note fixture", content: "<p>Adjacent note body</p>" },
  ]));

  // With app scripts disabled, Chrome parses precisely the HTML emitted
  // by Next.js before client hydration can repair an invalid document.
  const serverPage = await pageWithSession(false);
  for (const pathname of ["/notes", "/dashboard"]) {
    const response = await serverPage.goto(new URL(pathname, app).href);
    assert.equal(response?.status(), 200);
    const note = serverPage.locator("[data-note-html]").filter({ hasText: "Note tail marker" });
    assert.equal(await note.count(), 1, `${pathname} retains the tail inside the note wrapper`);
    assert.equal(await note.locator("strong").textContent(), "Valid note formatting");
    assert.equal(await note.locator("ul > li").textContent(), "Allowed list item");
    const text = await note.textContent();
    assert.ok(text?.includes("</div></li><li>bare item</li>"));
    assert.ok(text?.includes("misnested</i>"));
    assert.ok(text?.includes("<b>literal</b>"));
    assert.equal(await note.locator("img, script, [onerror]").count(), 0);
    assert.equal(await serverPage.locator("main [data-note-html]").filter({ hasText: "Adjacent note body" }).count(), 1);
    assert.equal(await note.evaluate((element) => Boolean(element.closest("main"))), true);
    if (pathname === "/dashboard") {
      assert.equal(await note.evaluate((element) => Boolean(element.closest("li button"))), true);
    }
  }
  await serverPage.context().close();

  unwrap(await member.rpc("reset_workspace_data"));
  const ui = await pageWithSession(true);
  const response = await ui.goto(new URL("/settings/data", app).href);
  assert.equal(response?.status(), 200);
  const backup = {
    app: "AMHIL OS", version: 1,
    data: { tasks: [{ id: randomUUID(), title: "Committed despite lost response" }] },
  };
  await ui.locator('input[type="file"]').setInputFiles({
    name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)),
  });
  const confirm = ui.getByRole("button", { name: "Confirm restore" });
  await confirm.waitFor();

  let restoreRequests = 0;
  let committed;
  const restoreUrl = "**/settings/data/restore?mode=restore";
  const discardResponse = async (route) => {
    restoreRequests += 1;
    committed = (await route.fetch({ maxRetries: 0 })).status();
    await route.abort("aborted");
  };
  await ui.route(restoreUrl, discardResponse);
  await confirm.click();
  await ui.locator('[role="alert"][lang="ar"]').waitFor();
  assert.match(await ui.locator('[role="alert"][lang="ar"]').textContent(), /تعذّر تأكيد نتيجة الاستعادة.*تحقّق من مساحة العمل/);
  assert.equal(committed, 200);
  assert.equal(await confirm.count(), 0, "stale preview is removed");
  assert.equal(restoreRequests, 1);
  assert.equal(unwrap(await member.from("tasks").select("title").single()).title, "Committed despite lost response");

  const check = ui.getByRole("button", { name: "Check workspace eligibility" });
  await check.click();
  await confirm.waitFor();
  assert.equal(await confirm.isDisabled(), true, "committed workspace blocks a second restore");
  assert.equal(restoreRequests, 1);

  unwrap(await member.rpc("reset_workspace_data"));
  await check.click();
  await ui.waitForFunction(() => Array.from(document.querySelectorAll("button"))
    .some((button) => button.textContent?.trim() === "Confirm restore" && !button.disabled));
  assert.equal(restoreRequests, 1, "fresh checks never retry the restore");
  await ui.unroute(restoreUrl, discardResponse);
  await ui.route(restoreUrl, (route) => route.fulfill({
    status: 400, json: { error: "Definite validation failure" },
  }));
  await confirm.click();
  await ui.getByText("Definite validation failure", { exact: true }).waitFor();
  assert.equal(await confirm.isDisabled(), false, "definite failures retain their normal UI behavior");

  console.log("Chromium verified pre-hydration Notes and Overview structure, a committed restore with a lost response, fresh eligibility checks, and definite failure handling.");
} finally {
  await browser?.close();
  unwrap(await trusted.auth.admin.deleteUser(user.id));
}
