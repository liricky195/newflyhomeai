/**
 * Auth middleware gate for all route protection.
 *
 * NOTE: This app uses strategy:"database" (not JWT). next-auth/middleware's
 * getToken() returns null for database sessions, so session presence is
 * determined by checking for the next-auth session cookie.
 * The authoritative isAdmin(userId) DB check still runs inside each route
 * handler and server component where SQLite is available.
 *
 * Rules:
 * - Public (no check): /api/auth/*, /api/webhooks/stripe, /api/health,
 *   /bookings/confirm-error, static assets
 * - Auth-gated pages (redirect to /auth?callbackUrl=...):
 *   /dashboard, /flights, /edit-details, /account, /bookings, /bookings/confirm
 * - Admin-only pages (redirect to / if no session; let page handle role):
 *   /admin
 * - Auth-gated API routes (401 JSON if no session):
 *   all /api/* except public routes above
 * - Admin API routes (401 if no session; route handler does 403 for non-admin):
 *   /api/admin/*
 */
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit"; // HARDENED IN STEP 10: auth brute-force protection

const AUTH_GATED_PAGES = [
  "/dashboard",
  "/flights",
  "/edit-details",
  "/account",
  "/bookings",
];

function hasSession(req: NextRequest): boolean {
  return !!(
    req.cookies.get("next-auth.session-token") ??
    req.cookies.get("__Secure-next-auth.session-token")
  );
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // ── Public routes — always allow ───────────────────────────────────────────
  if (
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/webhooks/stripe") ||
    pathname === "/api/health" ||
    pathname.startsWith("/bookings/confirm-error")
  ) {
    // IP-based rate limiting for sensitive auth action routes only.
    // /api/auth/session is a high-frequency polling endpoint (fires on every
    // useSession() mount) and must NOT be counted against the limit — doing so
    // exhausts the budget through normal browsing and blocks legitimate sign-ins.
    const RATE_LIMITED_AUTH = [
      "/api/auth/signin",
      "/api/auth/callback",
      "/api/auth/csrf",
      "/api/auth/signout",
    ];
    const isRateLimitedAuth = RATE_LIMITED_AUTH.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
    if (isRateLimitedAuth) {
      const ip =
        req.headers.get("x-forwarded-for") ??
        req.headers.get("x-real-ip") ??
        "unknown";
      const rl = rateLimit("auth:" + ip, 10, 60_000);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Too many authentication requests. Please wait." },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }
    }
    return NextResponse.next();
  }

  const authenticated = hasSession(req);

  // ── Admin-only pages ───────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!authenticated) {
      const signInUrl = new URL("/auth", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }
    // Role check (isAdmin) happens inside the page / server component
    return NextResponse.next();
  }

  // ── Auth-gated pages ───────────────────────────────────────────────────────
  const isAuthGatedPage = AUTH_GATED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isAuthGatedPage) {
    if (!authenticated) {
      const signInUrl = new URL("/auth", req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // ── Admin API routes ───────────────────────────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // 403 for non-admin is enforced inside each route handler via isAdmin()
    return NextResponse.next();
  }

  // ── All other API routes ───────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - Public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
