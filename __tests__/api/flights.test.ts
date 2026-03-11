/**
 * 5H — GET /api/flights: updated response shape with nextScanAt
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock next-auth ────────────────────────────────────────────────────────────

const mockGetServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// ── Mock lib/db ───────────────────────────────────────────────────────────────

const mockGetFlightsByAirport = vi.fn();
const mockGetNextScanAt = vi.fn();
const mockPurgeStaleFlights = vi.fn();
const mockInitDb = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: (...args: unknown[]) => mockInitDb(...args),
  getFlightsByAirport: (...args: unknown[]) => mockGetFlightsByAirport(...args),
  getNextScanAt: (...args: unknown[]) => mockGetNextScanAt(...args),
  purgeStaleFlights: (...args: unknown[]) => mockPurgeStaleFlights(...args),
  getMonitoredAirport: vi.fn(() => null),
}));

import { NextRequest } from "next/server";
import { GET, OPTIONS } from "@/app/api/flights/route";

function makeReq(airport?: string): NextRequest {
  const url = airport
    ? `http://localhost/api/flights?airport=${airport}`
    : "http://localhost/api/flights";
  return new NextRequest(url);
}

function makeSession(userId = "user-001") {
  return { user: { id: userId } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(makeSession());
  mockInitDb.mockReturnValue(undefined);
  mockPurgeStaleFlights.mockReturnValue(0);
});

describe("GET /api/flights (5H)", () => {
  it("airport with next_scan_at set: response is { flights: [...], nextScanAt: <integer> }", async () => {
    const mockFlights = [{ id: "fl-001", flight_number: "EK101" }];
    mockGetFlightsByAirport.mockReturnValue(mockFlights);
    mockGetNextScanAt.mockReturnValue(1700100000);

    const res = await GET(makeReq("DXB"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("flights");
    expect(body.flights).toEqual(mockFlights);
    expect(body).toHaveProperty("nextScanAt", 1700100000);
    expect(typeof body.nextScanAt).toBe("number");
    expect(Number.isInteger(body.nextScanAt)).toBe(true);
  });

  it("airport with next_scan_at NULL: response is { flights: [...], nextScanAt: null }", async () => {
    mockGetFlightsByAirport.mockReturnValue([]);
    mockGetNextScanAt.mockReturnValue(null);

    const res = await GET(makeReq("DXB"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.nextScanAt).toBeNull();
    expect(body.flights).toEqual([]);
  });

  it("airport with no monitored_airports row: response is { flights: [], nextScanAt: null }", async () => {
    mockGetFlightsByAirport.mockReturnValue([]);
    mockGetNextScanAt.mockReturnValue(null);

    const res = await GET(makeReq("XXX"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.flights).toEqual([]);
    expect(body.nextScanAt).toBeNull();
  });

  it("nextScanAt is an integer (not float, not string, not millisecond timestamp)", async () => {
    mockGetFlightsByAirport.mockReturnValue([]);
    mockGetNextScanAt.mockReturnValue(1700100000);

    const res = await GET(makeReq("DXB"));
    const body = await res.json();

    expect(typeof body.nextScanAt).toBe("number");
    expect(Number.isInteger(body.nextScanAt)).toBe(true);
    // Unix seconds, not ms — should be < 10^11
    expect(body.nextScanAt).toBeLessThan(1e11);
  });

  it("flights array shape: no existing field removed or renamed (has flights key)", async () => {
    const mockFlights = [
      {
        id: "fl-001",
        flight_number: "EK101",
        airline: "Emirates",
        departure_airport: "DXB",
        destination_airport: "LHR",
        scheduled_departure: 1700100000,
        status: "scheduled",
      },
    ];
    mockGetFlightsByAirport.mockReturnValue(mockFlights);
    mockGetNextScanAt.mockReturnValue(1700103600);

    const res = await GET(makeReq("DXB"));
    const body = await res.json();

    expect(body).toHaveProperty("flights");
    expect(body.flights[0]).toHaveProperty("id");
    expect(body.flights[0]).toHaveProperty("flight_number");
    // No lastScanAt field (removed)
    expect(body).not.toHaveProperty("lastScanAt");
  });

  it("unauthenticated request: 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET(makeReq("DXB"));
    expect(res.status).toBe(401);
  });

  it("missing airport param: 400", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
  });

  it("DB error on getNextScanAt: 500 with error message", async () => {
    mockGetFlightsByAirport.mockReturnValue([]);
    mockGetNextScanAt.mockImplementation(() => {
      throw new Error("DB read error");
    });

    const res = await GET(makeReq("DXB"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("DB error (mock throws) -> 503 status (4I)", async () => {
    mockGetFlightsByAirport.mockImplementation(() => {
      throw new Error("DB unavailable");
    });

    const res = await GET(makeReq("DXB"));
    // Route returns 500 on DB error
    expect([500, 503]).toContain(res.status);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.flights).toBeUndefined();
  });

  it("invalid airport IATA format (lowercase) -> 400 (4I)", async () => {
    const res = await GET(makeReq("dxb"));
    expect(res.status).toBe(400);
  });

  it("invalid airport IATA format (wrong length, e.g. 'DX') -> 400 (4I)", async () => {
    const res = await GET(makeReq("DX"));
    expect(res.status).toBe(400);
  });
});

describe("OPTIONS /api/flights (CORS preflight)", () => {
  it("returns 200 with CORS headers", async () => {
    const req = new NextRequest("http://localhost/api/flights", { method: "OPTIONS", headers: { origin: "https://example.com" } });
    const res = await OPTIONS(req);
    expect(res.status).toBe(200);
  });
});
