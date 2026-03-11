/**
 * 4D — CORS integration tests
 * Verifies that CORS headers are correctly applied to API routes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock auth ─────────────────────────────────────────────────────────────────
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── Mock DB ───────────────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  initDb: vi.fn(),
  getDb: vi.fn(() => ({ prepare: vi.fn(() => ({ get: vi.fn().mockReturnValue(null) })) })),
  getFlightsByAirport: vi.fn().mockReturnValue([]),
  getNextScanAt: vi.fn().mockReturnValue(null),
  purgeStaleFlights: vi.fn(),
}));

// ── Mock Stripe webhook ───────────────────────────────────────────────────────
vi.mock("@/lib/stripe", () => ({
  handleWebhook: vi.fn().mockResolvedValue(undefined),
  assertStripeEnvVars: vi.fn(),
}));

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRequest: vi.fn() }));

// ── Mock rateLimit ────────────────────────────────────────────────────────────
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  resetRateLimitStore: vi.fn(),
}));

beforeEach(() => {
  vi.stubEnv("NEXTAUTH_URL", "https://flyhome.ai");
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(url: string, opts: RequestInit = {}) {
  return new Request(url, opts) as any;
}

describe("CORS integration (4D)", () => {
  it("GET /api/flights from allowed origin: Access-Control-Allow-Origin present and correct", async () => {
    const { GET } = await import("@/app/api/flights/route");
    const req = makeRequest("http://localhost/api/flights?airport=DXB", {
      headers: { Origin: "https://flyhome.ai" },
    });
    const res = await GET(req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://flyhome.ai");
  });

  it("GET /api/flights from disallowed origin: Access-Control-Allow-Origin absent", async () => {
    const { GET } = await import("@/app/api/flights/route");
    const req = makeRequest("http://localhost/api/flights?airport=DXB", {
      headers: { Origin: "https://attacker.com" },
    });
    const res = await GET(req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS /api/bookings from allowed origin: 200 with CORS headers", async () => {
    const { OPTIONS } = await import("@/app/api/bookings/route");
    const req = makeRequest("http://localhost/api/bookings", {
      method: "OPTIONS",
      headers: { Origin: "https://flyhome.ai" },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://flyhome.ai");
    expect(res.headers.get("Access-Control-Allow-Methods")).toBeTruthy();
  });

  it("GET /api/health: CORS headers always present regardless of origin (unrestricted)", async () => {
    const { GET } = await import("@/app/api/health/route");

    // With disallowed origin — health is unrestricted, should still return CORS headers
    const req = makeRequest("http://localhost/api/health", {
      headers: { Origin: "https://totally-different.com" },
    });
    const res = await GET(req);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://totally-different.com");
  });

  it("GET /api/health with no origin: CORS headers still present (*)", async () => {
    const { GET } = await import("@/app/api/health/route");
    const req = makeRequest("http://localhost/api/health");
    const res = await GET(req);
    // With no origin, unrestricted returns *
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("POST /api/webhooks/stripe: CORS headers always present (unrestricted)", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const req = makeRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: {
        Origin: "https://random-origin.com",
        "stripe-signature": "t=1,v1=sig",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const res = await POST(req);
    // Even error responses should have CORS headers (unrestricted)
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://random-origin.com");
  });

  it("OPTIONS /api/bookings from disallowed origin: no CORS headers", async () => {
    const { OPTIONS } = await import("@/app/api/bookings/route");
    const req = makeRequest("http://localhost/api/bookings", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.com" },
    });
    const res = await OPTIONS(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
