// The only HTML sanitiser for notes. Every HTML sink (card, widget, editor) and every save goes
// through it, so it is the security boundary: the database stores note content as it was written.
//
// Safety by construction: input markup is never copied to the output. Text has its angle brackets
// escaped, and every tag that comes out is rebuilt here from an allowlisted name plus allowlisted,
// strictly matched attribute values.

const formattingTags = new Set([
  "b", "strong", "i", "em", "u", "s", "strike", "code", "span", "br",
  "p", "div", "ul", "ol", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6",
]);
const blockTags = new Set([
  "p", "div", "ul", "ol", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6",
]);
const listTags = new Set(["ul", "ol"]);
const heading = /^h[1-6]$/;

// Removed together with everything inside them.
const unsafeContainers = new Set([
  "script", "style", "template", "iframe", "object", "applet", "svg", "math", "noscript",
  "noembed", "noframes", "textarea", "select", "title", "xmp", "frameset",
]);
// Never have content, so only the tag itself is removed.
const voidTags = new Set([
  "area", "base", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);
// Unsupported block wrappers become a plain <div> so that their line breaks survive.
const blockWrappers = new Set([
  "address", "article", "aside", "caption", "center", "dd", "details", "dl", "dt", "fieldset",
  "figcaption", "figure", "footer", "form", "header", "main", "nav", "section", "summary",
  "table", "tr",
]);
// Other real HTML elements: the tag is dropped and its text is kept. A name that is not listed
// anywhere is not markup (for example "<your name>"), so it stays visible as text.
const unwrappedTags = new Set([
  "a", "abbr", "acronym", "audio", "bdi", "bdo", "big", "body", "button", "canvas", "cite",
  "colgroup", "data", "datalist", "del", "dfn", "dialog", "font", "head", "html", "ins", "kbd",
  "label", "legend", "map", "mark", "menu", "meter", "nobr", "optgroup", "option", "output",
  "picture", "progress", "q", "rp", "rt", "ruby", "samp", "small", "sub", "sup", "tbody", "td",
  "tfoot", "th", "thead", "time", "tt", "var", "video",
]);

const length = "(?:0|(?:\\d{1,3}(?:\\.\\d{1,3})?|\\.\\d{1,3})(?:px|pt|em|rem|%))";
const values = (pattern: string) => new RegExp(`^(?:${pattern})$`, "i");
// Typography and spacing only. No colours (they break the dark theme), no positioning or sizing,
// nothing that can load a resource. Negative lengths are rejected.
const styleProperties = new Map<string, RegExp>([
  ["font-weight", values("normal|bold|bolder|lighter|inherit|[1-9]00")],
  ["font-style", values("normal|italic|oblique|inherit")],
  ["font-size", values(`inherit|smaller|larger|x-small|small|medium|large|x-large|${length}`)],
  ["text-decoration", values("none|inherit|underline|line-through|underline line-through")],
  ["text-align", values("left|right|center|justify|start|end|inherit")],
  ["line-height", values(`normal|inherit|\\d(?:\\.\\d{1,3})?|${length}`)],
  ["margin-top", values(length)],
  ["margin-bottom", values(length)],
  ["margin-left", values(length)],
  ["margin-right", values(length)],
  ["padding-left", values(length)],
]);

const htmlTokens = /<!--[\s\S]*?(?:-->|$)|<(?:"[^"]*"|'[^']*'|[^<>"'])*>|[^<]+|<+(?=<)|</g;
const tagParts = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)(?=[\s/>])([\s\S]*)>$/;
const attributeParts = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function escapeAngles(text: string): string {
  return text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function safeStyle(value: string): string {
  const declarations = new Map<string, string>();
  for (const declaration of value.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const setting = declaration.slice(colon + 1).trim();
    if (styleProperties.get(property)?.test(setting)) declarations.set(property, setting.toLowerCase());
  }
  return [...declarations].map(([property, setting]) => `${property}: ${setting};`).join(" ");
}

function safeAttributes(source: string): string {
  let dir = "";
  let style = "";
  const seen = new Set<string>();
  for (const [, name, double, single, bare] of source.matchAll(attributeParts)) {
    const attribute = name.toLowerCase();
    // As in HTML, only the first occurrence of an attribute counts.
    if (seen.has(attribute)) continue;
    seen.add(attribute);
    const value = double ?? single ?? bare ?? "";
    if (attribute === "dir" && /^(?:ltr|rtl|auto)$/i.test(value)) dir = value.toLowerCase();
    if (attribute === "style") style = safeStyle(value);
  }
  return (dir ? ` dir="${dir}"` : "") + (style ? ` style="${style}"` : "");
}

interface OpenTag {
  source: string;
  /** Tag written to the output, or null when the source tag was dropped. */
  output: string | null;
  /** Nearest written ancestor, including this tag. */
  parent: string | null;
  inParagraph: boolean;
}

export function sanitizeNoteHtml(content: string): string {
  const stack: OpenTag[] = [];
  const openings = new Map<string, number[]>();
  const unterminated = new Set<string>();
  const parts: string[] = [];
  const tokens = new RegExp(htmlTokens);
  const innermost = (name: string) => openings.get(name)?.at(-1) ?? -1;
  /** Closes the open tag at this stack position and everything inside it. */
  const closeFrom = (position: number) => {
    for (const open of stack.splice(position).reverse()) {
      openings.get(open.source)?.pop();
      if (open.output) parts.push(`</${open.output}>`);
    }
  };

  for (let found = tokens.exec(content); found; found = tokens.exec(content)) {
    const token = found[0];
    if (token.startsWith("<!") || token.startsWith("<?")) {
      // Comments, doctypes and processing instructions (word processors paste these).
      if (!token.endsWith(">") && !token.startsWith("<!--")) parts.push(escapeAngles(token));
      continue;
    }
    const match = tagParts.exec(token);
    if (!match) {
      parts.push(escapeAngles(token));
      continue;
    }
    const closing = match[1] === "/";
    const source = match[2].toLowerCase();

    if (unsafeContainers.has(source)) {
      if (!closing && !unterminated.has(source)) {
        const end = new RegExp(`</${source}(?=[\\s/>])[^>]*>`, "gi");
        end.lastIndex = tokens.lastIndex;
        if (end.exec(content)) tokens.lastIndex = end.lastIndex;
        else unterminated.add(source); // search once, so repeated openings stay linear
      }
      continue;
    }
    const supported = formattingTags.has(source) || blockWrappers.has(source) || unwrappedTags.has(source);
    if (voidTags.has(source) || source.includes(":")) continue;
    if (!supported) {
      parts.push(escapeAngles(token));
      continue;
    }

    if (source === "br") {
      parts.push("<br>");
      continue;
    }

    if (closing) {
      if (innermost(source) >= 0) closeFrom(innermost(source));
      continue;
    }
    // As in HTML, a new list item ends the previous one in the same list.
    if (source === "li" && innermost("li") > Math.max(innermost("ul"), innermost("ol"))) closeFrom(innermost("li"));

    const top = stack.at(-1);
    const parent = top?.parent ?? null;
    const inParagraph = top?.inParagraph ?? false;
    let output: string | null = formattingTags.has(source) ? source : blockWrappers.has(source) ? "div" : null;

    // A bare list item can implicitly close an element outside the note.
    if (output === "li" && !listTags.has(parent ?? "")) output = "div";
    // So can a block inside a paragraph, or a heading directly inside a heading.
    if (output && blockTags.has(output) && (inParagraph || (heading.test(output) && heading.test(parent ?? "")))) {
      output = null;
      parts.push("<br>");
    }
    if (source === "td" || source === "th") parts.push(" ");

    const positions = openings.get(source) ?? [];
    positions.push(stack.length);
    openings.set(source, positions);
    stack.push({ source, output, parent: output ?? parent, inParagraph: inParagraph || output === "p" });
    if (output) parts.push(`<${output}${safeAttributes(match[3])}>`);
  }

  for (const open of stack.reverse()) if (open.output) parts.push(`</${open.output}>`);
  return parts.join("");
}
