import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRestrictedSession } from "@/lib/session-restriction";

// "/app/api/account-email" takes no cookies: the database job calls it with a shared secret.
const PUBLIC_PATHS = ["/app/login", "/app/signup", "/app/forgot-password", "/app/auth/callback", "/app/auth/recovery", "/app/api/account-email"];
// Bounced straight to /app/dashboard if the visitor already has a session — same
// treatment /login always got, extended to the other two credential-entry
// screens. Not /reset-password: reaching it *requires* an active (recovery)
// session, so being logged in is the expected state there, not a reason to bounce.
const AUTH_ONLY_PATHS = ["/app/login", "/app/signup", "/app/forgot-password"];
// Reachable once signed in even before an admin approves the account — just
// enough to see the pending/suspended notice and sign out, or to finish a
// password reset. Everything else under (app) requires status = "approved".
const APPROVAL_EXEMPT_PATHS = ["/app/pending", "/app/reset-password"];
// All that a session from an e-mail link (password recovery) can open, besides the public screens.
const RESTRICTED_SESSION_PATHS = ["/app/reset-password", "/app/pending"];

/** Whole path segments only: "/app/login" does not cover "/app/loginx". */
const covers = (paths: string[], pathname: string) => paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export async function updateSession(request: NextRequest) {
  // The public landing page, and only that exact path: it needs no session. Everything else that
  // is not listed in PUBLIC_PATHS still requires one.
  if (request.nextUrl.pathname === "/") return NextResponse.next({ request });

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = covers(PUBLIC_PATHS, request.nextUrl.pathname);
  // getUser() above had Supabase validate the token; only now is its claim read.
  const restricted = user ? isRestrictedSession((await supabase.auth.getSession()).data.session?.access_token) : false;

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/app/login";
    loginUrl.search = "";
    // Keep the query string so a deep link such as /app/journal?date=2026-01-01 survives the
    // sign-in round trip. safeNextPath validates the value again before it is used.
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  if (restricted && !isPublicPath && !covers(RESTRICTED_SESSION_PATHS, request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/app/login";
    loginUrl.search = "?error=sign_in_required";
    return NextResponse.redirect(loginUrl);
  }

  // A restricted session may stay on the sign-in screen: signing in there is how it becomes a full one.
  if (user && !restricted && AUTH_ONLY_PATHS.some((path) => request.nextUrl.pathname === path)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/app/dashboard";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
    // role = "admin" alone doesn't bypass this — a suspended admin (suspended
    // by another admin; an admin can't suspend themselves) needs to land on
    // /pending exactly like any other suspended user, not skip the gate.
    const isApproved = profile?.status === "approved";
    const isApprovalExempt = covers(APPROVAL_EXEMPT_PATHS, request.nextUrl.pathname);

    if (!isApproved && !isApprovalExempt) {
      const pendingUrl = request.nextUrl.clone();
      pendingUrl.pathname = "/app/pending";
      pendingUrl.search = "";
      return NextResponse.redirect(pendingUrl);
    }

    if (isApproved && request.nextUrl.pathname.startsWith("/app/pending")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/app/dashboard";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }

    if (request.nextUrl.pathname.startsWith("/app/admin") && profile?.role !== "admin") {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/app/dashboard";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
  }

  return supabaseResponse;
}
