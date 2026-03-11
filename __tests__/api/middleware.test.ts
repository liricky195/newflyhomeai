/**
 * Middleware tests — auth gates, rate limiting, redirects
 * File: __tests__/api/middleware.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock rateLimit ────────────────────────────────────────────────────────────
const mockRateLimit = vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 });
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// ── Import middleware after mocks ─────────────────────────────────────────────
import { middleware } from "@/middleware";

function makeRequest(path: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}): NextRequest {
  const req = new NextRequest(`http://localhost:3000${path}`);
  for (const [k, v] of Object.entries(cookies)) {
    req.cookies.set(k, v);
  }
  for (const [k, v] of Object.entries(headers)) {
    (req.headers as unknown as Map<string, string>).set(k, v);
  }
  return req;
}

const SESSION_COOKIE = { "next-auth.session-token": "valid-session-token" };

beforeEach(() => {
  mockRateLimit.mockClear();
  mockRateLimit.mockReturnValue({ allowed: true, retryAfterMs: 0 });
});

describe("middleware", () => {
  // ── Public routes (always allow) ───────────────────────────────────────────
  describe("public routes", () => {
    it("allows /api/auth/signin without session", () => {
      const res = middleware(makeRequest("/api/auth/signin"));
      expect(res.status).not.toBe(401);
      expect(res.headers.get("location")).toBeNull();
    });

    it("allows /api/auth (exact path) without session", () => {
      const res = middleware(makeRequest("/api/auth"));
      expect(res.status).not.toBe(401);
    });

    it("allows /api/webhooks/stripe without session", () => {
      const res = middleware(makeRequest("/api/webhooks/stripe"));
      expect(res.status).not.toBe(401);
    });

    it("allows /api/health without session", () => {
      const res = middleware(makeRequest("/api/health"));
      expect(res.status).not.toBe(401);
    });

    it("allows /bookings/confirm-error without session", () => {
      const res = middleware(makeRequest("/bookings/confirm-error"));
      expect(res.status).not.toBe(401);
    });

    it("rate-limits /api/auth/ when limit exceeded", () => {
      mockRateLimit.mockReturnValueOnce({ allowed: false, retryAfterMs: 45000 });
      const res = middleware(makeRequest("/api/auth/signin", {}, { "x-forwarded-for": "1.2.3.4" }));
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("45");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    });

    it("uses x-real-ip as fallback when x-forwarded-for absent", () => {
      mockRateLimit.mockReturnValueOnce({ allowed: false, retryAfterMs: 10000 });
      const res = middleware(makeRequest("/api/auth/callback/google", {}, { "x-real-ip": "5.6.7.8" }));
      expect(res.status).toBe(429);
    });

    it("uses 'unknown' as IP key when no IP header present", () => {
      mockRateLimit.mockReturnValueOnce({ allowed: false, retryAfterMs: 5000 });
      const res = middleware(makeRequest("/api/auth/signin"));
      expect(res.status).toBe(429);
      expect(mockRateLimit).toHaveBeenCalledWith("auth:unknown", 10, 60_000);
    });

    it("does NOT rate-limit /api/webhooks/stripe", () => {
      middleware(makeRequest("/api/webhooks/stripe"));
      expect(mockRateLimit).not.toHaveBeenCalled();
    });

    it("does NOT rate-limit /api/health", () => {
      middleware(makeRequest("/api/health"));
      expect(mockRateLimit).not.toHaveBeenCalled();
    });
  });

  // ── Admin pages ────────────────────────────────────────────────────────────
  describe("admin pages", () => {
    it("redirects /admin to /auth when unauthenticated", () => {
      const res = middleware(makeRequest("/admin"));
      expect(res.status).toBe(307);
      const location = res.headers.get("location") ?? "";
      expect(location).toContain("/auth");
    });

    it("allows /admin through when session present", () => {
      const res = middleware(makeRequest("/admin", SESSION_COOKIE));
      expect(res.status).not.toBe(307);
    });

    it("callbackUrl is set when redirecting /admin", () => {
      const res = middleware(makeRequest("/admin"));
      const location = res.headers.get("location") ?? "";
      expect(location).toContain("callbackUrl");
    });
  });

  // ── Auth-gated pages ───────────────────────────────────────────────────────
  describe("auth-gated pages", () => {
    const gatedPages = ["/dashboard", "/flights", "/edit-details", "/account", "/bookings"];

    for (const page of gatedPages) {
      it(`redirects ${page} to /auth when unauthenticated`, () => {
        const res = middleware(makeRequest(page));
        expect(res.status).toBe(307);
        const location = res.headers.get("location") ?? "";
        expect(location).toContain("/auth");
        expect(location).toContain("callbackUrl");
      });

      it(`allows ${page} through when session present`, () => {
        const res = middleware(makeRequest(page, SESSION_COOKIE));
        expect(res.status).not.toBe(307);
      });
    }

    it("redirects /bookings/confirm (sub-path) to /auth when unauthenticated", () => {
      const res = middleware(makeRequest("/bookings/confirm"));
      expect(res.status).toBe(307);
    });

    it("uses __Secure-next-auth cookie as session token (HTTPS)", () => {
      const res = middleware(makeRequest("/dashboard", { "__Secure-next-auth.session-token": "secure-token" }));
      expect(res.status).not.toBe(307);
    });
  });

  // ── Admin API routes ───────────────────────────────────────────────────────
  describe("admin API routes", () => {
    it("returns 401 for /api/admin/* without session", () => {
      const res = middleware(makeRequest("/api/admin/stats"));
      expect(res.status).toBe(401);
    });

    it("allows /api/admin/* through with session (403 handled in route)", () => {
      const res = middleware(makeRequest("/api/admin/stats", SESSION_COOKIE));
      expect(res.status).not.toBe(401);
    });
  });

  // ── Generic API routes ─────────────────────────────────────────────────────
  describe("generic API routes", () => {
    it("returns 401 for /api/flights without session", () => {
      const res = middleware(makeRequest("/api/flights"));
      expect(res.status).toBe(401);
    });

    it("allows /api/flights through with session", () => {
      const res = middleware(makeRequest("/api/flights", SESSION_COOKIE));
      expect(res.status).not.toBe(401);
    });

    it("returns 401 for /api/bookings without session", () => {
      const res = middleware(makeRequest("/api/bookings"));
      expect(res.status).toBe(401);
    });
  });

  // ── Non-API, non-page routes (pass-through) ────────────────────────────────
  describe("pass-through routes", () => {
    it("allows unknown paths (e.g. landing page) through", () => {
      const res = middleware(makeRequest("/"));
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(401);
    });
  });
});
