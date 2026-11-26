import { test } from "node:test";
import assert from "node:assert/strict";

const { sanitizeNoteHtml } = (await import(new URL("./note-html.ts", import.meta.url).href)) as typeof import("./note-html");

test("stored note markup renders as allowed tags or escaped text", () => {
  const legacy = '<p><strong>Bold</strong> &lt;b&gt; &amp; &#60; <em>Emphasis</em></p>';
  const directlyWritten = '<img src=x onerror="run()"><p onclick="run()">Text</p><script>run()</script>';
  const rendered = sanitizeNoteHtml(legacy + directlyWritten);
  assert.ok(rendered.startsWith(legacy));
  assert.ok(rendered.includes('&lt;img src=x onerror="run()"&gt;'));
  assert.ok(rendered.includes('&lt;p onclick="run()"&gt;'));
  assert.ok(rendered.includes("&lt;script&gt;run()&lt;/script&gt;"));
  assert.doesNotMatch(rendered, /<(?:img|script)|<p\s+onclick=/);
  assert.equal(sanitizeNoteHtml(rendered), rendered);
});

test("only exact attribute-free formatting tags reach the note HTML sink", () => {
  const input = '<ul><li><b>One</b></li></ul><img alt="<b>"><svg><g onload=x></g></svg>';
  assert.equal(
    sanitizeNoteHtml(input),
    '<ul><li><b>One</b></li></ul>&lt;img alt="&lt;b&gt;"&gt;&lt;svg&gt;&lt;g onload=x&gt;&lt;/g&gt;&lt;/svg&gt;',
  );
  assert.equal(sanitizeNoteHtml("<".repeat(780000)), "&lt;".repeat(780000));
});

test("note fragments cannot close ancestors or trigger implicit list and paragraph closes", () => {
  const raw = "</div></li><li>bare item</li><p>text<div>block</div></p><ol><li><b>valid</b></li></ol>";
  const safe = "&lt;/div&gt;&lt;/li&gt;&lt;li&gt;bare item&lt;/li&gt;<p>text&lt;div&gt;block&lt;/div&gt;</p><ol><li><b>valid</b></li></ol>";
  assert.equal(sanitizeNoteHtml(raw), safe);
  assert.equal(sanitizeNoteHtml(safe), safe);
});

test("misnested note markup is escaped or closed entirely inside the fragment", () => {
  const safe = "<b><i>text</i></b>&lt;/i&gt; &lt;strong&gt; example";
  assert.equal(sanitizeNoteHtml("<b><i>text</b></i> &lt;strong&gt; example"), safe);
  assert.equal(sanitizeNoteHtml(safe), safe);
});
