/**
 * The "next" redirect target after login is attacker-controllable (it comes
 * straight from a URL query param), so it must be constrained to an
 * in-app relative path before use — otherwise a crafted login link like
 * `/login?next=//evil.com` could send a user off-site right after
 * authenticating. A single leading slash not followed by another slash (or
 * backslash, which some browsers treat as a path separator) is the only
 * shape allowed.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
