import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/callback"];
// Bounced straight to /dashboard if the visitor already has a session — same
// treatment /login always got, extended to the other two credential-entry
// screens. Not /reset-password: reaching it *requires* an active (recovery)
// session, so being logged in is the expected state there, not a reason to bounce.
const AUTH_ONLY_PATHS = ["/login", "/signup", "/forgot-password"];
// Reachable once signed in even before an admin approves the account — just
// enough to see the pending/suspended notice and sign out, or to finish a
// password reset. Everything else under (app) requires status = "approved".
const APPROVAL_EXEMPT_PATHS = ["/pending", "/reset-password"];

export async function updateSession(request: NextRequest) {
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

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && AUTH_ONLY_PATHS.some((path) => request.nextUrl.pathname === path)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/dashboard";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (user && !isPublicPath) {
    const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).maybeSingle();
    // role = "admin" alone doesn't bypass this — a suspended admin (suspended
    // by another admin; an admin can't suspend themselves) needs to land on
    // /pending exactly like any other suspended user, not skip the gate.
    const isApproved = profile?.status === "approved";
    const isApprovalExempt = APPROVAL_EXEMPT_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

    if (!isApproved && !isApprovalExempt) {
      const pendingUrl = request.nextUrl.clone();
      pendingUrl.pathname = "/pending";
      pendingUrl.search = "";
      return NextResponse.redirect(pendingUrl);
    }

    if (isApproved && request.nextUrl.pathname.startsWith("/pending")) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/dashboard";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }

    if (request.nextUrl.pathname.startsWith("/admin") && profile?.role !== "admin") {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/dashboard";
      homeUrl.search = "";
      return NextResponse.redirect(homeUrl);
    }
  }

  return supabaseResponse;
}
