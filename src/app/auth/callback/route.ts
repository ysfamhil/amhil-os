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
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Covers both an outright invalid code and an expired/already-used one —
  // exchangeCodeForSession fails the same way for either, and neither should
  // ever reach a page that assumes a valid session exists.
  const loginUrl = new URL(`${origin}/login`);
  if (next === "/reset-password") {
    loginUrl.searchParams.set("error", "reset_link_invalid");
  }
  return NextResponse.redirect(loginUrl);
}
