/**
 * A session is "restricted" unless it was started with a password. Password-recovery and e-mail
 * confirmation links create sessions without it; those may set a password and nothing else.
 * The database enforces the same rule (is_approved_account / is_admin).
 *
 * Only call this with an access token that Supabase has already validated (after auth.getUser()):
 * it reads the claim, it does not verify the signature. Anything unreadable counts as restricted.
 */
export function isRestrictedSession(accessToken: string | null | undefined): boolean {
  try {
    const payload = accessToken!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { amr } = JSON.parse(atob(payload)) as { amr?: unknown };
    return !(Array.isArray(amr) && amr.some((entry) => (entry as { method?: unknown } | null)?.method === "password"));
  } catch {
    return true;
  }
}
