/**
 * GET /api/bookings/[bookingId]/conditions — fetch fare conditions from Duffel
 * File: __tests__/api/bookings-conditions.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockGetBookingById = vi.fn();
const mockInitDb = vi.fn();
vi.mock("@/lib/db", () => ({
  initDb: (...a: unknown[]) => mockInitDb(...a),
  getBookingById: (...a: unknown[]) => mockGetBookingById(...a),
}));

// We need ApiError as a class from duffel so the route's `instanceof` check works
vi.mock("@/lib/duffel", () => {
  class ApiError extends Error {
    httpStatus: number;
    apiMessage: string;
    constructor(status: number, message: string) {
      super(message);
      this.httpStatus = status;
      this.apiMessage = message;
    }
  }
  return { ApiError };
});

import { getServerSession } from "next-auth";

const SESSION = { user: { id: "u1", email: "u1@test.com" }, expires: "" };
const BOOKING_CONFIRMED = {
  id: "bk1",
  user_id: "u1",
  status: "confirmed",
  duffel_order_id: "ord_abc123",
};

const MOCK_DUFFEL_ORDER = {
  data: {
    slices: [
      {
        segments: [
          {
            passengers: [
              {
                baggages: [
                  { type: "carry_on", quantity: 1, max_weight_kg: null },
                  { type: "checked", quantity: 1, max_weight_kg: 23 },
                ],
              },
            ],
          },
        ],
      },
    ],
    conditions: {
      refund_before_departure: {
        allowed: false,
        penalty_amount: null,
        penalty_currency: null,
      },
      change_before_departure: {
        allowed: true,
        penalty_amount: "50.00",
        penalty_currency: "GBP",
      },
    },
  },
};

const originalFetch = global.fetch;

function makeRequest(bookingId: string): [NextRequest, { params: Promise<{ bookingId: string }> }] {
  return [
    new NextRequest(`http://localhost:3000/api/bookings/${bookingId}/conditions`),
    { params: Promise.resolve({ bookingId }) },
  ];
}

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION);
  mockInitDb.mockReturnValue(undefined);
  mockGetBookingById.mockReturnValue(BOOKING_CONFIRMED);
  process.env.DUFFEL_API_KEY = "duffel_test_key";

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(MOCK_DUFFEL_ORDER),
    text: () => Promise.resolve(""),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.DUFFEL_API_KEY;
});

describe("GET /api/bookings/[bookingId]/conditions", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("returns 404 when booking not found", async () => {
    mockGetBookingById.mockReturnValueOnce(null);
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk-unknown");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when booking belongs to another user", async () => {
    mockGetBookingById.mockReturnValueOnce({ ...BOOKING_CONFIRMED, user_id: "other-user" });
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it("returns available=false for cancelled booking (no Duffel call)", async () => {
    mockGetBookingById.mockReturnValueOnce({ ...BOOKING_CONFIRMED, status: "cancelled" });
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns available=false for pending booking", async () => {
    mockGetBookingById.mockReturnValueOnce({ ...BOOKING_CONFIRMED, status: "pending" });
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(false);
  });

  it("returns available=false when duffel_order_id is missing", async () => {
    mockGetBookingById.mockReturnValueOnce({ ...BOOKING_CONFIRMED, duffel_order_id: null });
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    const json = await res.json();
    expect(json.available).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns 502 when DUFFEL_API_KEY is missing", async () => {
    delete process.env.DUFFEL_API_KEY;
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(502);
  });

  it("returns 502 when Duffel API returns non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    }) as unknown as typeof fetch;
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(502);
  });

  it("returns full conditions and baggage data on success", async () => {
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.available).toBe(true);
    expect(json.baggage!.cabin).toHaveLength(1);
    expect(json.baggage!.cabin[0].type).toBe("carry_on");
    expect(json.baggage!.checked[0].max_weight_kg).toBe(23);
    expect(json.conditions!.refundable).toBe(false);
    expect(json.conditions!.changeable).toBe(true);
    expect(json.conditions!.changePenalty).toBe("50.00");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=300");
  });

  it("accumulates baggage quantities from multiple passengers", async () => {
    const multiPaxOrder = {
      data: {
        slices: [{
          segments: [{
            passengers: [
              { baggages: [{ type: "checked", quantity: 1, max_weight_kg: 23 }] },
              { baggages: [{ type: "checked", quantity: 1, max_weight_kg: null }] },
            ],
          }],
        }],
        conditions: {},
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(multiPaxOrder),
    }) as unknown as typeof fetch;

    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    const json = await res.json();
    expect(json.baggage!.checked[0].quantity).toBe(2);
  });

  it("handles empty slices gracefully (available=true with empty baggage)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { slices: [], conditions: {} } }),
    }) as unknown as typeof fetch;
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    const json = await res.json();
    expect(json.available).toBe(true);
    expect(json.baggage!.cabin).toHaveLength(0);
    expect(json.baggage!.checked).toHaveLength(0);
    expect(json.conditions!.refundable).toBe(false);
  });

  it("returns 502 on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure")) as unknown as typeof fetch;
    const { GET } = await import("@/app/api/bookings/[bookingId]/conditions/route");
    const [req, ctx] = makeRequest("bk1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("Network failure");
  });
});
