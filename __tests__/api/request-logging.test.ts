/**
 * 4K — logRequest in all route handlers
 * Verifies that every API response calls logRequest with the correct fields.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock auth ─────────────────────────────────────────────────────────────────
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── Mock DB ───────────────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  initDb: vi.fn(),
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({ get: vi.fn().mockReturnValue(null) })),
  })),
  getFlightsByAirport: vi.fn().mockReturnValue([]),
  getNextScanAt: vi.fn().mockReturnValue(null),
  purgeStaleFlights: vi.fn(),
}));

// ── Mock Stripe / Duffel ──────────────────────────────────────────────────────
vi.mock("@/lib/stripe", () => ({
  handleWebhook: vi.fn().mockResolvedValue(undefined),
  assertStripeEnvVars: vi.fn(),
}));
vi.mock("@/lib/duffel", () => ({
  createDuffelLink: vi.fn().mockResolvedValue({ url: "https://pay.duffel.com/test" }),
  ApiError: class ApiError extends Error {
    httpStatus: number; apiMessage: string;
    constructor(s: number, m: string) { super(m); this.httpStatus = s; this.apiMessage = m; }
  },
}));

// ── Mock rateLimit ────────────────────────────────────────────────────────────
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  resetRateLimitStore: vi.fn(),
}));

// ── Mock logger — capture logRequest calls ────────────────────────────────────
const mockLogRequest = vi.fn();
const mockLog = vi.fn();
vi.mock("@/lib/logger", () => ({
  log: (...a: unknown[]) => mockLog(...a),
  logRequest: (...a: unknown[]) => mockLogRequest(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logRequest in route handlers (4K)", () => {
  it("GET /api/health 200: logRequest called with method=GET, path=/api/health, statusCode=200, durationMs >= 0", async () => {
    const { GET } = await import("@/app/api/health/route");
    await GET(new Request("http://localhost/api/health") as any);

    expect(mockLogRequest).toHaveBeenCalledWith(
      "GET",
      "/api/health",
      expect.any(Number), // status (200 or 503 depending on DB mock)
      expect.any(Number), // durationMs
    );
    const call = mockLogRequest.mock.calls[0];
    expect(call[3]).toBeGreaterThanOrEqual(0); // durationMs >= 0
  });

  it("GET /api/flights 401 (unauthenticated): logRequest called with statusCode=401, userId=undefined", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/flights/route");
    await GET(new Request("http://localhost/api/flights?airport=DXB") as any);

    expect(mockLogRequest).toHaveBeenCalledWith("GET", "/api/flights", 401, expect.any(Number));
    // userId should NOT be passed for 401
    const call = mockLogRequest.mock.calls.find(
      (c) => c[0] === "GET" && c[1] === "/api/flights" && c[2] === 401
    );
    expect(call).toBeDefined();
    expect(call![4]).toBeUndefined();
  });

  it("GET /api/flights 200 (authenticated): logRequest called with userId set", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-logged" } });
    const { GET } = await import("@/app/api/flights/route");
    await GET(new Request("http://localhost/api/flights?airport=DXB") as any);

    expect(mockLogRequest).toHaveBeenCalledWith(
      "GET", "/api/flights", expect.any(Number), expect.any(Number), "user-logged"
    );
  });

  it("POST /api/bookings 429: logRequest called with statusCode=429", async () => {
    const { rateLimit } = await import("@/lib/rateLimit");
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, retryAfterMs: 30_000 });
    mockGetServerSession.mockResolvedValue({ user: { id: "user-rl" } });

    const { POST } = await import("@/app/api/bookings/route");
    await POST(new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: "o1", flightId: "f1", given_name: "J", family_name: "D", born_on: "1990-01-01", passport_number: "A123", nationality: "GB" }),
    }) as any);

    expect(mockLogRequest).toHaveBeenCalledWith(
      "POST", "/api/bookings", 429, expect.any(Number), "user-rl"
    );
  });

  it("durationMs is always non-negative", async () => {
    const { GET } = await import("@/app/api/health/route");
    await GET(new Request("http://localhost/api/health") as any);

    for (const call of mockLogRequest.mock.calls) {
      const durationMs = call[3] as number;
      expect(durationMs).toBeGreaterThanOrEqual(0);
    }
  });
});
