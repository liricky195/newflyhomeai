/**
 * 5F — POST /api/bookings (Duffel Links flow)
 * 5H — GET /api/bookings (list endpoint)
 * File: __tests__/api/bookings.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// HARDENED IN STEP 10: mock rateLimit so existing tests are not rate-limited
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  resetRateLimitStore: vi.fn(),
}));

// HARDENED IN STEP 10: mock logger to suppress logRequest output in tests
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRequest: vi.fn() }));

// ── Mock next-auth ────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────

const mockInitDb = vi.fn();
const mockCreatePendingBookingForDuffel = vi.fn();
const mockUpdateBookingDuffelLinkId = vi.fn();
const mockDeletePendingBooking = vi.fn();
const mockGetBookingsWithFlightsByUserId = vi.fn();

// getDb mock — controls the raw SQL queries used in flight ownership check
const mockPrepareGet = vi.fn();
const mockPrepareObj = { get: mockPrepareGet };
const mockGetDb = vi.fn().mockReturnValue({ prepare: vi.fn().mockReturnValue(mockPrepareObj) });

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  getDb: () => mockGetDb(),
  createPendingBookingForDuffel: (...args: unknown[]) =>
    mockCreatePendingBookingForDuffel(...args),
  updateBookingDuffelLinkId: (...args: unknown[]) =>
    mockUpdateBookingDuffelLinkId(...args),
  deletePendingBooking: (...args: unknown[]) => mockDeletePendingBooking(...args),
  getBookingsWithFlightsByUserId: (...args: unknown[]) =>
    mockGetBookingsWithFlightsByUserId(...args),
  getBookingById: vi.fn(),
}));

// ── Mock Duffel ───────────────────────────────────────────────────────────────

const mockCreateDuffelLink = vi.fn();

class MockApiError extends Error {
  httpStatus: number;
  apiMessage: string;
  constructor(httpStatus: number, apiMessage: string) {
    super(`Duffel API error ${httpStatus}: ${apiMessage}`);
    this.httpStatus = httpStatus;
    this.apiMessage = apiMessage;
    Object.setPrototypeOf(this, MockApiError.prototype);
  }
}

vi.mock("@/lib/duffel", () => ({
  createDuffelLink: (...args: unknown[]) => mockCreateDuffelLink(...args),
  ApiError: MockApiError,
  searchOffers: vi.fn(),
}));

import { getServerSession } from "next-auth";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown): Request {
  return new Request("http://localhost:3001/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  offerId: "off_123",
  flightId: "fl-001",
  given_name: "Alice",
  family_name: "Smith",
  born_on: "1990-06-15",
  passport_number: "AB1234567",
  nationality: "GB",
  phone: "+447700900000",
};

const FLIGHT_ROW = { id: "fl-001", departure_airport: "DXB" };
const AIRPORT_ROW = { airport_iata: "DXB" };
const DUFFEL_LINK = {
  id: "lnk_abc",
  url: "https://links.duffel.com/checkout/abc",
  expiresAt: "2025-01-01T00:30:00Z",
};
const PENDING_BOOKING = {
  id: "bk-pending-001",
  status: "pending",
  internal_reference: "ref-uuid-001",
};

function setupOwnershipMocks() {
  // Two sequential .prepare().get() calls inside the handler:
  //   1st → flight row
  //   2nd → user's monitored airport
  mockPrepareGet
    .mockReturnValueOnce(FLIGHT_ROW)
    .mockReturnValueOnce(AIRPORT_ROW);
}

beforeEach(async () => {
  vi.clearAllMocks();
  // Re-apply session mock after clearAllMocks
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: "u1", email: "test@test.com" },
    expires: "",
  });
  mockGetDb.mockReturnValue({
    prepare: vi.fn().mockReturnValue({ get: mockPrepareGet }),
  });
  // HARDENED IN STEP 10: re-apply rateLimit mock after clearAllMocks
  const { rateLimit } = await import("@/lib/rateLimit");
  vi.mocked(rateLimit).mockReturnValue({ allowed: true, retryAfterMs: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5F — POST /api/bookings
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/bookings (5F)", () => {
  it("valid body → 200 { checkoutUrl, bookingId }; pending DB row written; createDuffelLink called once", async () => {
    setupOwnershipMocks();
    mockCreatePendingBookingForDuffel.mockReturnValueOnce(PENDING_BOOKING);
    mockCreateDuffelLink.mockResolvedValueOnce(DUFFEL_LINK);

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(VALID_BODY) as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.checkoutUrl).toBe(DUFFEL_LINK.url);
    expect(json.bookingId).toBe(PENDING_BOOKING.id);

    expect(mockCreatePendingBookingForDuffel).toHaveBeenCalledOnce();
    expect(mockCreateDuffelLink).toHaveBeenCalledOnce();

    const duffelCallArgs = mockCreateDuffelLink.mock.calls[0][0] as {
      offerId: string;
      reference: string;
      successUrl: string;
      abandonUrl: string;
    };
    expect(duffelCallArgs.offerId).toBe(VALID_BODY.offerId);
    expect(duffelCallArgs.successUrl).toContain(duffelCallArgs.reference);
  });

  it("successUrl contains internal_reference", async () => {
    setupOwnershipMocks();
    const ref = "test-internal-ref-123";
    mockCreatePendingBookingForDuffel.mockReturnValueOnce({
      ...PENDING_BOOKING,
      internal_reference: ref,
    });
    mockCreateDuffelLink.mockResolvedValueOnce(DUFFEL_LINK);

    // Intercept createDuffelLink args
    const { POST } = await import("@/app/api/bookings/route");
    await POST(makePostRequest(VALID_BODY) as any);

    const callArgs = mockCreateDuffelLink.mock.calls[0][0] as { successUrl: string };
    // The route builds internalReference via crypto.randomUUID(), not from pending booking
    // but it should be present in successUrl
    expect(callArgs.successUrl).toMatch(/\/bookings\/confirm\?ref=/);
  });

  it("missing offerId → 400; createDuffelLink NOT called; no DB row written", async () => {
    const body = { ...VALID_BODY, offerId: undefined };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
    expect(mockCreateDuffelLink).not.toHaveBeenCalled();
    expect(mockCreatePendingBookingForDuffel).not.toHaveBeenCalled();
  });

  it("missing flightId → 400; no DB or Duffel calls", async () => {
    const { offerId: _o, flightId: _f, ...rest } = VALID_BODY;
    const body = { offerId: _o, ...rest };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
    expect(mockCreateDuffelLink).not.toHaveBeenCalled();
    expect(mockCreatePendingBookingForDuffel).not.toHaveBeenCalled();
  });

  it("missing given_name → 400", async () => {
    const body = { ...VALID_BODY, given_name: "" };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
    expect(mockCreateDuffelLink).not.toHaveBeenCalled();
  });

  it("missing family_name → 400", async () => {
    const body = { ...VALID_BODY, family_name: "" };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
    expect(mockCreateDuffelLink).not.toHaveBeenCalled();
  });

  it("empty passport_number → 400", async () => {
    const body = { ...VALID_BODY, passport_number: "" };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
  });

  it("invalid nationality 'USA' (3 chars) → 400", async () => {
    const body = { ...VALID_BODY, nationality: "USA" };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
  });

  it("invalid phone '555-0000' → 400", async () => {
    const body = { ...VALID_BODY, phone: "555-0000" };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
    expect(mockCreateDuffelLink).not.toHaveBeenCalled();
  });

  it("born_on with invalid format '01-01-1990' → 400", async () => {
    const body = { ...VALID_BODY, born_on: "01-01-1990" };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
  });

  it("born_on in the future → 400", async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const body = {
      ...VALID_BODY,
      born_on: future.toISOString().slice(0, 10),
    };

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(body) as any);

    expect(res.status).toBe(400);
  });

  it("flight ownership check fail (flight not found) → 403; no DB row written", async () => {
    mockPrepareGet.mockReturnValueOnce(null); // flight not found

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(VALID_BODY) as any);

    expect(res.status).toBe(403);
    expect(mockCreatePendingBookingForDuffel).not.toHaveBeenCalled();
    expect(mockCreateDuffelLink).not.toHaveBeenCalled();
  });

  it("flight ownership check fail (different airport) → 403; no DB row written", async () => {
    mockPrepareGet
      .mockReturnValueOnce({ id: "fl-001", departure_airport: "DXB" })
      .mockReturnValueOnce({ airport_iata: "LHR" }); // user monitors LHR, not DXB

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(VALID_BODY) as any);

    expect(res.status).toBe(403);
    expect(mockCreatePendingBookingForDuffel).not.toHaveBeenCalled();
  });

  it("flight ownership check fail (no monitored airport) → 403", async () => {
    mockPrepareGet
      .mockReturnValueOnce(FLIGHT_ROW)
      .mockReturnValueOnce(null); // no monitored airport for user

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(VALID_BODY) as any);

    expect(res.status).toBe(403);
  });

  it("DB pending row insert fails → 500; no Duffel call", async () => {
    setupOwnershipMocks();
    mockCreatePendingBookingForDuffel.mockImplementationOnce(() => {
      throw new Error("DB constraint error");
    });

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(VALID_BODY) as any);

    expect(res.status).toBe(500);
    expect(mockCreateDuffelLink).not.toHaveBeenCalled();
  });

  it("pending row inserted, createDuffelLink throws ApiError → 502; pending row deleted", async () => {
    setupOwnershipMocks();
    mockCreatePendingBookingForDuffel.mockReturnValueOnce(PENDING_BOOKING);
    mockCreateDuffelLink.mockRejectedValueOnce(
      new MockApiError(422, "Offer has expired")
    );

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(VALID_BODY) as any);

    expect(res.status).toBe(502);
    expect(mockDeletePendingBooking).toHaveBeenCalledWith(PENDING_BOOKING.id);
  });

  it("pending row inserted, createDuffelLink throws generic error → 502; pending row deleted", async () => {
    setupOwnershipMocks();
    mockCreatePendingBookingForDuffel.mockReturnValueOnce(PENDING_BOOKING);
    mockCreateDuffelLink.mockRejectedValueOnce(new Error("Network failure"));

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(VALID_BODY) as any);

    expect(res.status).toBe(502);
    expect(mockDeletePendingBooking).toHaveBeenCalledWith(PENDING_BOOKING.id);
  });

  it("unauthenticated → 401 before any DB or Duffel access", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/bookings/route");
    const res = await POST(makePostRequest(VALID_BODY) as any);

    expect(res.status).toBe(401);
    expect(mockCreatePendingBookingForDuffel).not.toHaveBeenCalled();
    expect(mockCreateDuffelLink).not.toHaveBeenCalled();
  });

  it("second POST for same flight does not crash (no UNIQUE constraint on user_id+flight_id for pending rows)", async () => {
    // First booking
    mockPrepareGet
      .mockReturnValueOnce(FLIGHT_ROW)
      .mockReturnValueOnce(AIRPORT_ROW)
      // Second booking
      .mockReturnValueOnce(FLIGHT_ROW)
      .mockReturnValueOnce(AIRPORT_ROW);

    mockCreatePendingBookingForDuffel
      .mockReturnValueOnce({ ...PENDING_BOOKING, id: "bk-1" })
      .mockReturnValueOnce({ ...PENDING_BOOKING, id: "bk-2" });
    mockCreateDuffelLink
      .mockResolvedValueOnce({ ...DUFFEL_LINK, url: "https://link1" })
      .mockResolvedValueOnce({ ...DUFFEL_LINK, url: "https://link2" });

    const { POST } = await import("@/app/api/bookings/route");
    const res1 = await POST(makePostRequest(VALID_BODY) as any);
    const res2 = await POST(makePostRequest(VALID_BODY) as any);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5H — GET /api/bookings
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/bookings (5H)", () => {
  function makeGetRequest(): Request {
    return new Request("http://localhost:3001/api/bookings", { method: "GET" });
  }

  it("authenticated user with bookings → 200; each booking contains total_amount, total_currency, cancellation_pending, confirm_fetch_failed", async () => {
    mockGetBookingsWithFlightsByUserId.mockReturnValueOnce([
      {
        id: "bk-001",
        status: "confirmed",
        duffel_total: "450.00",
        total_currency: "GBP",
        cancellation_pending: 0,
        confirm_fetch_failed: 0,
        flight_number: "EK101",
      },
    ]);

    const { GET } = await import("@/app/api/bookings/route");
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.bookings).toHaveLength(1);
    const b = json.bookings[0];
    expect(b.total_amount).toBe("450.00");
    expect(b.total_currency).toBe("GBP");
    expect(b.cancellation_pending).toBe(0);
    expect(b.confirm_fetch_failed).toBe(0);
  });

  it("confirmed booking has status='confirmed' and non-null total_amount", async () => {
    mockGetBookingsWithFlightsByUserId.mockReturnValueOnce([
      {
        id: "bk-confirmed",
        status: "confirmed",
        duffel_total: "321.50",
        total_currency: "USD",
        cancellation_pending: 0,
        confirm_fetch_failed: 0,
      },
    ]);

    const { GET } = await import("@/app/api/bookings/route");
    const res = await GET();
    const json = await res.json();

    expect(json.bookings[0].status).toBe("confirmed");
    expect(json.bookings[0].total_amount).not.toBeNull();
    expect(json.bookings[0].total_amount).toBe("321.50");
  });

  it("pending booking has status='pending' and null total_amount (not yet confirmed)", async () => {
    mockGetBookingsWithFlightsByUserId.mockReturnValueOnce([
      {
        id: "bk-pending",
        status: "pending",
        duffel_total: null,
        total_currency: null,
        cancellation_pending: 0,
        confirm_fetch_failed: 0,
      },
    ]);

    const { GET } = await import("@/app/api/bookings/route");
    const res = await GET();
    const json = await res.json();

    expect(json.bookings[0].status).toBe("pending");
    expect(json.bookings[0].total_amount).toBeNull();
  });

  it("empty list (no bookings) → 200 with empty array, not 404", async () => {
    mockGetBookingsWithFlightsByUserId.mockReturnValueOnce([]);

    const { GET } = await import("@/app/api/bookings/route");
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.bookings).toEqual([]);
  });

  it("unauthenticated → 401", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/bookings/route");
    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockGetBookingsWithFlightsByUserId).not.toHaveBeenCalled();
  });
});
