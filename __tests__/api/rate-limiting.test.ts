/**
 * 4C — Rate limiting integration
 * Tests that POST /api/bookings and POST /api/subscriptions enforce
 * per-user rate limits of 5 req/60 s, and return 429 with Retry-After
 * on the 6th request. Also tests that two different users are independent
 * and that windows reset after 60 s.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetRateLimitStore } from "@/lib/rateLimit";

// ── Mock auth ─────────────────────────────────────────────────────────────────
const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// ── Mock DB ───────────────────────────────────────────────────────────────────
// getDb().prepare().get() — returns a row that passes BOTH flight AND airport checks
const DB_ROW = { id: "f1", departure_airport: "DXB", airport_iata: "DXB" };
const mockCreatePending = vi.fn();
const mockGetSubByUserId = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: vi.fn(),
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({ get: vi.fn().mockReturnValue(DB_ROW) })),
  })),
  createPendingBookingForDuffel: (...a: unknown[]) => mockCreatePending(...a),
  deletePendingBooking: vi.fn(),
  getBookingsWithFlightsByUserId: vi.fn().mockReturnValue([]),
  getSubscriptionByUserId: (...a: unknown[]) => mockGetSubByUserId(...a),
  getBookingById: vi.fn(),
}));

// ── Mock Duffel ───────────────────────────────────────────────────────────────
vi.mock("@/lib/duffel", () => ({
  createDuffelLink: vi.fn().mockResolvedValue({ url: "https://pay.duffel.com/test" }),
  ApiError: class ApiError extends Error {
    httpStatus: number; apiMessage: string;
    constructor(s: number, m: string) { super(m); this.httpStatus = s; this.apiMessage = m; }
  },
}));

// ── Mock Stripe ───────────────────────────────────────────────────────────────
vi.mock("@/lib/stripe", () => ({
  createSubscriptionCheckout: vi.fn().mockResolvedValue("https://stripe.com/checkout"),
  createPortalSession: vi.fn(),
  upgradeSubscription: vi.fn(),
  downgradeSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  reactivateSubscription: vi.fn(),
}));

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRequest: vi.fn() }));

// ── Import routes (static — after mocks are hoisted) ─────────────────────────
import { POST as postBooking } from "@/app/api/bookings/route";
import { POST as postSub } from "@/app/api/subscriptions/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeBookingRequest(userId: string) {
  mockGetServerSession.mockResolvedValue({ user: { id: userId } });
  return new Request("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offerId: "offer-1", flightId: "f1",
      given_name: "John", family_name: "Doe",
      born_on: "1990-01-01", passport_number: "A12345678",
      nationality: "GB", phone: "+447700900000",
    }),
  });
}

function makeSubRequest(userId: string) {
  mockGetServerSession.mockResolvedValue({ user: { id: userId } });
  return new Request("http://localhost/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "checkout", tier: "standard" }),
  });
}

describe("Rate limiting integration (4C)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Use a modern date so born_on "1990-01-01" is clearly in the past
    vi.setSystemTime(new Date("2025-06-01T00:00:00Z"));
    resetRateLimitStore(); // clear in-memory rate limit state between tests
    vi.clearAllMocks();
    // Re-set mock return values after clearAllMocks
    mockCreatePending.mockReturnValue({ id: "bk-1", internal_reference: "ref-1" });
    mockGetSubByUserId.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("POST /api/bookings — 5 requests same user: all 200", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await postBooking(makeBookingRequest("user-5ok") as any);
      expect(res.status).toBe(200);
    }
  });

  it("POST /api/bookings — 6th request same user: 429 with Retry-After header", async () => {
    for (let i = 0; i < 5; i++) {
      await postBooking(makeBookingRequest("user-6th") as any);
    }
    const res = await postBooking(makeBookingRequest("user-6th") as any);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    const body = await res.json();
    expect(body.error).toMatch(/too many/i);
  });

  it("POST /api/bookings — two different users are independent (A exhausted, B still allowed)", async () => {
    // Exhaust user A
    for (let i = 0; i < 5; i++) {
      await postBooking(makeBookingRequest("user-A") as any);
    }
    const resA = await postBooking(makeBookingRequest("user-A") as any);
    expect(resA.status).toBe(429);

    // User B still has full allowance
    const resB = await postBooking(makeBookingRequest("user-B") as any);
    expect(resB.status).toBe(200);
  });

  it("POST /api/subscriptions — 5 allowed, 6th is 429", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await postSub(makeSubRequest("user-sub") as any);
      expect(res.status).toBe(200);
    }
    const res6 = await postSub(makeSubRequest("user-sub") as any);
    expect(res6.status).toBe(429);
  });

  it("Rate limit window reset: after 60_001 ms, user A can make requests again", async () => {
    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      await postBooking(makeBookingRequest("user-reset") as any);
    }
    expect((await postBooking(makeBookingRequest("user-reset") as any)).status).toBe(429);

    // Advance past the 60 s window
    vi.advanceTimersByTime(60_001);

    // Should be allowed again (first 5 timestamps are now older than windowMs)
    const res = await postBooking(makeBookingRequest("user-reset") as any);
    expect(res.status).toBe(200);
  });
});
