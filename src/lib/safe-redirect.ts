/**
 * The "next" redirect target after login is attacker-controllable (it comes
 * straight from a URL query param), so it must be constrained to an in-app
 * path before use - otherwise a crafted login link like `/app/login?next=//evil.com`
 * could send a user off-site right after authenticating.
 *
 * Browsers do not treat the string literally: the URL parser silently strips
 * tab / CR / LF anywhere in the input, turns `\` into `/`, and resolves dot
 * segments (including `%2e`), so `/\t/evil.com`, `/\evil.com` and
 * `/..//evil.com` all end up as protocol-relative URLs that leave the origin.
 * A prefix check on the raw string cannot catch those. This function therefore
 *
 *   1. rejects anything that is not a single-slash absolute path,
 *   2. rejects control / invisible characters and backslashes, both literally
 *      and after one round of percent-decoding,
 *   3. resolves the value exactly as a browser would and requires the result
 *      to stay on the same origin and not to begin with `//`,
 *
 * and returns the *resolved* path + query + hash, so what the caller redirects
 * to is what was validated. Legitimate paths and query strings pass unchanged.
 */
const MAX_LENGTH = 2048;
// Code-point ranges that must never appear in a redirect target (checked literally and after
// percent-decoding): C0 controls incl. tab/CR/LF/NUL, DEL and C1 controls, zero-width and
// directional marks, line/paragraph separators, word joiner, BOM, and the backslash.
// Kept as plain numbers so the source stays ASCII and cannot be mangled by tooling.
const DISALLOWED_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x2028, 0x2029],
  [0x2060, 0x2060],
  [0xfeff, 0xfeff],
  [0x005c, 0x005c],
];

function hasDisallowedCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) as number;
    if (DISALLOWED_RANGES.some(([low, high]) => codePoint >= low && codePoint <= high)) return true;
  }
  return false;
}

const PROBE_ORIGIN = "http://next-path.invalid";

export function safeNextPath(next: string | null | undefined, fallback = "/app/dashboard"): string {
  if (typeof next !== "string" || next.length === 0 || next.length > MAX_LENGTH) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (hasDisallowedCharacter(next)) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (hasDisallowedCharacter(decoded)) return fallback;

  let resolved: URL;
  try {
    resolved = new URL(next, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (resolved.origin !== PROBE_ORIGIN) return fallback;

  const path = resolved.pathname + resolved.search + resolved.hash;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
