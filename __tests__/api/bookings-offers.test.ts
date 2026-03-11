/**
 * 5E — GET /api/bookings/offers
 * File: __tests__/api/bookings-offers.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock next-auth ────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────

const mockInitDb = vi.fn();
const mockGetFlightById = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  getFlightById: (...args: unknown[]) => mockGetFlightById(...args),
}));

// ── Mock Duffel ───────────────────────────────────────────────────────────────

const mockSearchOffers = vi.fn();

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
  searchOffers: (...args: unknown[]) => mockSearchOffers(...args),
  ApiError: MockApiError,
}));

import { getServerSession } from "next-auth";

const FLIGHT_ROW = {
  id: "fl-001",
  flight_number: "EK101",
  departure_airport: "DXB",
  destination_airport: "LHR",
  scheduled_departure: 1741334400,
  status: "scheduled",
};

function makeRequest(flightId?: string): Request {
  const url = flightId
    ? `http://localhost:3001/api/bookings/offers?flight_id=${flightId}`
    : "http://localhost:3001/api/bookings/offers";
  return new Request(url, { method: "GET" });
}

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: "u1", email: "test@test.com" },
    expires: "",
  });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 5E — GET /api/bookings/offers
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/bookings/offers (5E)", () => {
  it("valid flight_id in DB, searchOffers returns offers → 200 with DuffelOffer array", async () => {
    mockGetFlightById.mockReturnValueOnce(FLIGHT_ROW);
    mockSearchOffers.mockResolvedValueOnce([
      { id: "off_1", airline: "EK", amount: "450.00", currency: "GBP" },
      { id: "off_2", airline: "EK", amount: "500.00", currency: "GBP" },
    ]);

    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest("fl-001") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.offers).toHaveLength(2);
    expect(json.offers[0].id).toBe("off_1");
  });

  it("valid flight_id in DB, searchOffers returns empty array → 200 with empty array (not 404)", async () => {
    mockGetFlightById.mockReturnValueOnce(FLIGHT_ROW);
    mockSearchOffers.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest("fl-001") as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.offers).toEqual([]);
  });

  it("flight_id param absent → 400", async () => {
    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest() as any);

    expect(res.status).toBe(400);
    expect(mockSearchOffers).not.toHaveBeenCalled();
  });

  it("flight_id present but not a valid flight ID format → 400 or 404, not 500", async () => {
    mockGetFlightById.mockReturnValueOnce(null);

    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest("../../etc/passwd") as any);

    expect([400, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
    expect(mockSearchOffers).not.toHaveBeenCalled();
  });

  it("flight_id not found in DB → 404", async () => {
    mockGetFlightById.mockReturnValueOnce(null);

    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest("fl-ghost") as any);

    expect(res.status).toBe(404);
    expect(mockSearchOffers).not.toHaveBeenCalled();
  });

  it("searchOffers throws ApiError → 502 with error message", async () => {
    mockGetFlightById.mockReturnValueOnce(FLIGHT_ROW);
    mockSearchOffers.mockRejectedValueOnce(
      new MockApiError(422, "No availability for this flight")
    );

    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest("fl-001") as any);
    const json = await res.json();

    expect(res.status).toBe(502);
    expect(json.error).toContain("No availability for this flight");
  });

  it("searchOffers throws 500 ApiError → 502", async () => {
    mockGetFlightById.mockReturnValueOnce(FLIGHT_ROW);
    mockSearchOffers.mockRejectedValueOnce(
      new MockApiError(500, "Internal Duffel error")
    );

    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest("fl-001") as any);

    expect(res.status).toBe(502);
  });

  it("unauthenticated request → 401", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest("fl-001") as any);

    expect(res.status).toBe(401);
    expect(mockSearchOffers).not.toHaveBeenCalled();
    expect(mockGetFlightById).not.toHaveBeenCalled();
  });

  it("searchOffers receives correct flight_number, depDate, dep_airport, dest_airport", async () => {
    mockGetFlightById.mockReturnValueOnce(FLIGHT_ROW);
    mockSearchOffers.mockResolvedValueOnce([]);

    const { GET } = await import("@/app/api/bookings/offers/route");
    await GET(makeRequest("fl-001") as any);

    expect(mockSearchOffers).toHaveBeenCalledWith(
      "EK101",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD from scheduled_departure
      "DXB",
      "LHR",
      [{ type: "adult" }]
    );
  });
});

describe("GET /api/bookings/offers — non-ApiError throws 500", () => {
  it("searchOffers throws a regular Error -> 500", async () => {
    mockGetFlightById.mockReturnValueOnce(FLIGHT_ROW);
    mockSearchOffers.mockRejectedValueOnce(new Error("Network timeout"));

    const { GET } = await import("@/app/api/bookings/offers/route");
    const res = await GET(makeRequest("fl-001") as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
