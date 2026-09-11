/**
 * Tags are free text (no stored color), so we derive a stable color per tag
 * by hashing its name into a small palette drawn from the app's domain
 * colors. Same tag always gets the same color; different tags are visually
 * distinct without needing a color picker or a schema change.
 */
const TAG_PALETTE = [
  "var(--domain-tasks)",
  "var(--domain-goals)",
  "var(--domain-time)",
  "var(--domain-finance)",
  "var(--domain-learning)",
  "var(--domain-habits)",
];

export function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash << 5) - hash + tag.charCodeAt(i);
    hash |= 0;
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}
