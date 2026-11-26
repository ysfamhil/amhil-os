// The auth e-mails share one look, link only where intended and carry no code or tracking.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name: string) => readFileSync(new URL(`../../supabase/templates/${name}`, import.meta.url), "utf8");
const variables = (html: string) => [...new Set(html.match(/\{\{[^}]*\}\}/g))].sort();
const links = (html: string) => [...html.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);

const expected = {
  "confirm-signup.html": { button: "{{ .ConfirmationURL }}", variables: ["{{ .ConfirmationURL }}", "{{ .SiteURL }}"] },
  "password-changed.html": { button: "{{ .SiteURL }}/app/forgot-password", variables: ["{{ .Email }}", "{{ .SiteURL }}"] },
  "email-changed.html": { button: "mailto:hello@byamhil.com", variables: ["{{ .Email }}", "{{ .OldEmail }}", "{{ .SiteURL }}"] },
};

test("each template has one button to its intended destination, plus the footer link", () => {
  for (const [name, { button, variables: allowed }] of Object.entries(expected)) {
    const html = read(name);
    assert.deepEqual(links(html), [button, "{{ .SiteURL }}"], name);
    assert.deepEqual(variables(html), allowed, name);
    assert.ok(!/\{\{\s*\.(Token|TokenHash)\s*\}\}/.test(html), `${name} must not carry a code`);
    const images = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(images.length === 2 && images.every((src) => src === "{{ .SiteURL }}/apple-icon.png"), `${name}: no third-party or tracking images`);
  }
});

test("all templates share the reset e-mail's layout", () => {
  // Everything that carries the look: tags and their styles, without the text, links or alt text.
  const skeleton = (html: string) =>
    [...html.matchAll(/<([a-z0-9]+)((?:\s+[a-z-]+="[^"]*")*)\s*\/?>/g)].map(
      ([, tag, attributes]) => tag + (/ style="([^"]*)"/.exec(attributes)?.[1] ?? "").replace("; overflow-wrap:anywhere; word-break:break-word", ""),
    );
  const reference = skeleton(read("recovery.html"));
  for (const name of Object.keys(expected)) assert.deepEqual(skeleton(read(name)), reference, name);
});
