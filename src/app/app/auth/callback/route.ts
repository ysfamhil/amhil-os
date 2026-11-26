import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // `next` is already validated by safeNextPath; resolving it against our own
      // origin and re-checking the result keeps a bug there from becoming an open redirect.
      const target = new URL(next, origin);
      if (target.origin === origin) return NextResponse.redirect(target);
    }
  }

  // Covers both an outright invalid code and an expired/already-used one —
  // exchangeCodeForSession fails the same way for either, and neither should
  // ever reach a page that assumes a valid session exists.
  const loginUrl = new URL(`${origin}/app/login`);
  // "/reset-password" is what links sent before the app moved under /app still carry.
  if (next === "/app/reset-password" || next === "/reset-password") {
    loginUrl.searchParams.set("error", "reset_link_invalid");
  }
  return NextResponse.redirect(loginUrl);
}
