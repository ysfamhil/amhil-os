import { test } from "node:test";
import assert from "node:assert/strict";

const { sanitizeNoteHtml } = (await import(new URL("./note-html.ts", import.meta.url).href)) as typeof import("./note-html");

/** Every "<" in sanitised output must start a tag this module wrote itself. */
const emittedTag = /^<(?:br|\/(?:b|strong|i|em|u|s|strike|code|span|p|div|ul|ol|li|blockquote|pre|h[1-6])|(?:b|strong|i|em|u|s|strike|code|span|p|div|ul|ol|li|blockquote|pre|h[1-6])(?: dir="(?:ltr|rtl|auto)")?(?: style="(?:[a-z-]+: [a-z0-9.% -]+;(?: |(?=")))+")?)>/;

function assertOnlySafeMarkup(output: string) {
  for (let at = output.indexOf("<"); at >= 0; at = output.indexOf("<", at + 1)) {
    const rest = output.slice(at, at + 600);
    assert.match(rest, emittedTag, `unexpected markup: ${rest.slice(0, 80)}`);
  }
}

function check(input: string, expected: string) {
  const output = sanitizeNoteHtml(input);
  assert.equal(output, expected);
  assertOnlySafeMarkup(output);
  assert.equal(sanitizeNoteHtml(output), output, "sanitising twice must change nothing");
}

test("pasted word-processor paragraphs keep their direction and spacing", () => {
  check(
    '<p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;">First paragraph </p>',
    '<p dir="ltr" style="line-height: 1.38; margin-top: 0pt; margin-bottom: 0pt;">First paragraph </p>',
  );
  check(
    '<span style="font-size: inherit; font-weight: inherit;">Heading ✨</span><ul><li><code inline="">x = 1</code></li></ul>',
    '<span style="font-size: inherit; font-weight: inherit;">Heading ✨</span><ul><li><code>x = 1</code></li></ul>',
  );
});

test("supported formatting is rebuilt in canonical form", () => {
  check('<P ALIGN=left DIR=RTL>مرحبا<BR/>x<br />y</P>', '<p dir="rtl">مرحبا<br>x<br>y</p>');
  check('<div style="TEXT-ALIGN: Center; font-weight:700"><b class="a" id="b">t</b></div>',
    '<div style="text-align: center; font-weight: 700;"><b>t</b></div>');
  check("<h2>Title</h2><blockquote><em>q</em></blockquote><pre><code>if (a &lt; b) {}</code></pre>",
    "<h2>Title</h2><blockquote><em>q</em></blockquote><pre><code>if (a &lt; b) {}</code></pre>");
});

test("unsafe attributes are removed without exposing the tag as text", () => {
  check('<p onclick="run()" onmouseover=run() class="x">Text</p>', "<p>Text</p>");
  check('<a href="javascript:alert(1)" onclick="x">link text</a>', "link text");
  check('<b title="a>b<c">bold</b>', "<b>bold</b>");
  // A malformed tag (unmatched quote) is not guessed at: it stays inert text.
  check('<p dir="x\\" onclick=run()">t</p>', '&lt;p dir="x\\" onclick=run()"&gt;t');
});

test("only harmless style declarations survive", () => {
  const hostile = [
    "position:fixed", "top:0", "z-index:9999", "width:100vw", "display:none", "color:#000",
    "background:url(https://evil.example/x)", "background-image:url(javascript:alert(1))",
    "behavior:url(x.htc)", "width:expression(alert(1))", "margin-top:-500px", "font-size:99999px",
    "font-weight:bold!important", "line-height:1;}body{display:none", "-moz-binding:url(x)",
    "font-style:ital\\69 c", "text-align:&#108;eft",
  ];
  for (const declaration of hostile) {
    const output = sanitizeNoteHtml(`<div style="${declaration}">t</div>`);
    assertOnlySafeMarkup(output);
    assert.doesNotMatch(output, /position|z-index|width|display|color|url|expression|behavior|binding|-500|99999|important|\\|&#/, declaration);
  }
  check('<div style="margin-left: 2em; position: fixed">t</div>', '<div style="margin-left: 2em;">t</div>');
});

test("dangerous elements are removed along with their content", () => {
  check("a<script>alert(1)</script>b<style>body{display:none}</style>c", "abc");
  check('x<iframe src="https://evil.example">inner</iframe><object><embed src=x></object>y', "xy");
  check("<svg><script>alert(1)</script><g onload=x></g></svg><math><mtext>m</mtext></math>z", "z");
  check('<img src=x onerror="alert(1)"><input autofocus onfocus=alert(1)><meta charset=utf-8><link rel=x>ok', "ok");
  check("<SCRIPT >alert(1)</SCRIPT >after", "after");
  check("<script>never closed", "never closed");
  check("<!-- <img src=x onerror=alert(1)> -->a<!DOCTYPE html><?xml version=1?>b<!--open <b>", "ab");
});

test("unsupported wrappers keep their text and line structure", () => {
  check('<font face="x">f</font> <a href="https://example.com">site</a> <o:p></o:p>', "f site ");
  check("<section><header>h</header><table><tr><td>a</td><td>b</td></tr></table></section>",
    "<div><div>h</div><div><div> a b</div></div></div>");
  check('<b style="font-weight:normal" id="docs-guid"><p dir="ltr"><span style="font-weight:400">One</span></p></b>',
    '<b style="font-weight: normal;"><p dir="ltr"><span style="font-weight: 400;">One</span></p></b>');
});

test("text that is not markup stays visible, and escaped examples stay text", () => {
  check("use <your name> and 3 < 4 > 2", "use &lt;your name&gt; and 3 &lt; 4 &gt; 2");
  check("&lt;script&gt; &amp; &#60; <em>x</em>", "&lt;script&gt; &amp; &#60; <em>x</em>");
  check("#include <stdio.h>", "#include &lt;stdio.h&gt;");
});

test("note fragments cannot close ancestors or trigger implicit closes", () => {
  check("</div></li><li>bare item</li><p>text<div>block</div></p><ol><li><b>valid</b></li></ol>",
    "<div>bare item</div><p>text<br>block</p><ol><li><b>valid</b></li></ol>");
  check("<div><p><div>x</div>still</p>tail</div>", "<div><p><br>xstill</p>tail</div>");
  check("<h1>a<h2>b</h2></h1>", "<h1>a<br>b</h1>");
  check("<b><i>text</b></i> &lt;strong&gt; example", "<b><i>text</i></b> &lt;strong&gt; example");
});

test("unclosed list items stay siblings, and nested lists stay nested", () => {
  check("<ul><li>a<li><b>b</ul>", "<ul><li>a</li><li><b>b</b></li></ul>");
  check("<ol><li>a<ul><li>a1<li>a2</ul><li>b</ol>", "<ol><li>a<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ol>");
  check('<p style="color:red" style="font-style:italic" dir="up" dir="rtl">x</p>', "<p>x</p>");
});

test("random token soup can only produce safe, stable markup", () => {
  const alphabet = [
    "<", ">", "/", " ", "=", '"', "'", "!", "-", "?", "a", "p", "div", "li", "ul", "span", "script",
    "svg", "style", "img", "onerror", "alert(1)", "dir", "rtl", "font-weight:bold", ";", "url(x)",
    "<p>", "</p>", "<b ", "<!--", "-->", "&lt;", "\n", "\u0000", "`",
  ];
  let seed = 20261126;
  const random = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return Math.floor((seed / 2147483648) * n);
  };
  for (let round = 0; round < 20000; round++) {
    const input = Array.from({ length: 1 + random(24) }, () => alphabet[random(alphabet.length)]).join("");
    const output = sanitizeNoteHtml(input);
    assertOnlySafeMarkup(output);
    assert.equal(sanitizeNoteHtml(output), output, JSON.stringify(input));
  }
});

test("hostile sizes are handled in linear time", () => {
  const started = performance.now();
  assert.equal(sanitizeNoteHtml("<".repeat(780000)), "&lt;".repeat(780000));
  assert.equal(sanitizeNoteHtml("<script>".repeat(100000)), "");
  assert.equal(sanitizeNoteHtml("<!--".repeat(200000)), "");
  sanitizeNoteHtml("<div>".repeat(100000) + "</p>".repeat(100000));
  sanitizeNoteHtml("<ul>" + "<li>".repeat(200000));
  sanitizeNoteHtml("<p " + "a ".repeat(500000) + ">x");
  sanitizeNoteHtml('<"'.repeat(300000));
  sanitizeNoteHtml(`<p style="${"a:b;".repeat(100000)}">x</p>`);
  assert.ok(performance.now() - started < 5000);
});
