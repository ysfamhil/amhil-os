"use server";

import { createClient } from "@/lib/supabase/server";
import { isRestrictedSession } from "@/lib/session-restriction";

const TOKEN_HASH = /^[A-Za-z0-9_-]{20,200}$/;
const INVALID = { signedIn: false, next: "/app/login?error=reset_link_invalid" };

export type RecoveryResult = { signedIn: boolean; next: string | null };

/**
 * Exchanges the token from a password-reset e-mail for a recovery session.
 *
 * Unlike the PKCE code in /app/auth/callback, a token hash needs nothing stored in the browser that
 * asked for the e-mail, so the link works wherever the e-mail is read. Supabase still validates it:
 * single use, time limited, and only for the "recovery" type, which is fixed here and never taken
 * from the request. Runs only on an explicit POST (Next rejects cross-origin server action calls).
 *
 * Returns where to go instead of redirecting: the page leaves with a full page load, so its strict
 * Content-Security-Policy and the token held in memory do not carry over to the next screen.
 */
export async function verifyRecoveryToken(_previous: RecoveryResult, formData: FormData): Promise<RecoveryResult> {
  const tokenHash = formData.get("token_hash");
  if (typeof tokenHash !== "string" || !TOKEN_HASH.test(tokenHash)) return INVALID;

  const supabase = await createClient();
  // Never silently swap a signed-in account for the one the link belongs to. Nothing is consumed,
  // so the same link still works after signing out.
  const { data: current } = await supabase.auth.getUser();
  if (current.user) {
    const { data: tokens } = await supabase.auth.getSession();
    if (!isRestrictedSession(tokens.session?.access_token)) return { signedIn: true, next: null };
  }

  let failed = true;
  try {
    failed = Boolean((await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash })).error);
  } catch {
    // Deliberately not logged: nothing about the request belongs in server logs.
  }
  return failed ? INVALID : { signedIn: false, next: "/app/reset-password" };
}
