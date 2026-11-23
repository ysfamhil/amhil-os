// Keep this attribute-free allowlist in sync with clean_note in
// 20261021000007_workspace_backup_validation.sql.
const allowedTag = /^<(\/?)(b|strong|i|em|u|s|strike|p|div|ul|ol|li|blockquote|pre|code|h[1-6]|br)>$/;
const htmlTokens = /<(?:"[^"]*"|'[^']*'|[^<>"'])*>|[^<]+|<+(?=<)|</g;
const inlineTags = new Set(["b", "strong", "i", "em", "u", "s", "strike", "code", "br"]);
const phrasingContainers = new Set([...inlineTags, "p", "pre", "h1", "h2", "h3", "h4", "h5", "h6"]);
const listContainers = new Set(["ul", "ol"]);

function escapeAngles(text: string): string {
  return text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function sanitizeNoteHtml(content: string): string {
  const openTags: string[] = [];
  const openings = new Map<string, number[]>();
  const fragment = content.replace(htmlTokens, (token) => {
    const match = allowedTag.exec(token);
    if (!match) return escapeAngles(token);
    const [, closing, tag] = match;
    const parent = openTags.at(-1);

    if (closing) {
      const opening = openings.get(tag)?.at(-1);
      if (opening === undefined) return escapeAngles(token);
      return openTags.splice(opening).reverse().map((openTag) => {
        openings.get(openTag)?.pop();
        return `</${openTag}>`;
      }).join("");
    }

    // A bare list item or a block inside a paragraph can cause the HTML
    // parser to implicitly close an element outside the intended fragment.
    if (tag === "li" && !listContainers.has(parent ?? "")) return escapeAngles(token);
    if (parent && phrasingContainers.has(parent) && !inlineTags.has(tag)) return escapeAngles(token);
    if (tag !== "br") {
      const positions = openings.get(tag) ?? [];
      positions.push(openTags.length);
      openings.set(tag, positions);
      openTags.push(tag);
    }
    return token;
  });
  return fragment + openTags.reverse().map((tag) => `</${tag}>`).join("");
}
