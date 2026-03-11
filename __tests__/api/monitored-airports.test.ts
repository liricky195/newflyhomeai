/**
 * 4K — POST /api/monitored-airports
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockGetMonitoredAirport = vi.fn();
const mockSetMonitoredAirport = vi.fn();
const mockDeactivateOtherAirports = vi.fn();
const mockSetAirportLastScanAt = vi.fn();
const mockSetUserPersonalDetails = vi.fn();
const mockGetUserPersonalDetails = vi.fn();
const mockFlagAirportForImmediateScan = vi.fn();
const mockInitDb = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  getMonitoredAirport: (...args: unknown[]) => mockGetMonitoredAirport(...args),
  setMonitoredAirport: (...args: unknown[]) => mockSetMonitoredAirport(...args),
  deactivateOtherAirports: (...args: unknown[]) => mockDeactivateOtherAirports(...args),
  setAirportLastScanAt: (...args: unknown[]) => mockSetAirportLastScanAt(...args),
  setUserPersonalDetails: (...args: unknown[]) => mockSetUserPersonalDetails(...args),
  getUserPersonalDetails: (...args: unknown[]) => mockGetUserPersonalDetails(...args),
  flagAirportForImmediateScan: (...args: unknown[]) => mockFlagAirportForImmediateScan(...args),
}));

import { POST, GET } from "@/app/api/monitored-airports/route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/monitored-airports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSession(userId = "user-001") {
  return { user: { id: userId } };
}

function makeExistingAirport(iata = "DXB") {
  return {
    id: "row-1",
    user_id: "user-001",
    airport_iata: iata,
    destination_iata: null,
    travel_date_from: null,
    travel_date_to: null,
    active: 1,
    last_scan_at: null,
    last_scanned_at: null,
    next_scan_at: null,
    needs_immediate_scan: 0,
    created_at: 1000000,
    updated_at: 1000000,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(makeSession());
  mockInitDb.mockReturnValue(undefined);
  mockGetMonitoredAirport.mockReturnValue(null);
  mockSetMonitoredAirport.mockReturnValue(undefined);
  mockDeactivateOtherAirports.mockReturnValue(undefined);
  mockFlagAirportForImmediateScan.mockReturnValue(undefined);
});

describe("POST /api/monitored-airports (4K)", () => {
  it("first-time user, valid IATA code -> 200; row inserted; flagAirportForImmediateScan called", async () => {
    mockGetMonitoredAirport.mockReturnValue(null);

    const res = await POST(makeReq({ airport_iata: "DXB" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSetMonitoredAirport).toHaveBeenCalledOnce();
    expect(mockFlagAirportForImmediateScan).toHaveBeenCalledWith("user-001");
  });

  it("returning user, same airport_iata, different destination -> 200; row updated; airport_iata unchanged", async () => {
    mockGetMonitoredAirport.mockReturnValue(makeExistingAirport("DXB"));

    const res = await POST(makeReq({ airport_iata: "DXB", destination_iata: "LHR" }));
    expect(res.status).toBe(200);
    expect(mockSetMonitoredAirport).toHaveBeenCalledOnce();
    // Not a first-set, so flagAirportForImmediateScan should NOT be called
    expect(mockFlagAirportForImmediateScan).not.toHaveBeenCalled();
  });

  it("returning user, different airport_iata -> 403 'Your stranded airport cannot be changed'", async () => {
    mockGetMonitoredAirport.mockReturnValue(makeExistingAirport("DXB"));

    const res = await POST(makeReq({ airport_iata: "AUH" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("cannot be changed");
  });

  it("airport_iata lowercase -> 400 (Zod regex fails)", async () => {
    const res = await POST(makeReq({ airport_iata: "dxb" }));
    expect(res.status).toBe(400);
  });

  it("airport_iata wrong length (5 chars) -> 400", async () => {
    const res = await POST(makeReq({ airport_iata: "DXBXX" }));
    expect(res.status).toBe(400);
  });

  it("airport_iata special chars -> 400", async () => {
    const res = await POST(makeReq({ airport_iata: "DX-" }));
    expect(res.status).toBe(400);
  });

  it("travel_date_to < travel_date_from -> 400", async () => {
    const res = await POST(makeReq({
      airport_iata: "DXB",
      travel_date_from: 1800000000,
      travel_date_to: 1700000000,
    }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });

  it("travel_date_to === travel_date_from -> 200 (edge case, not a violation)", async () => {
    const res = await POST(makeReq({
      airport_iata: "DXB",
      travel_date_from: 1800000000,
      travel_date_to: 1800000000,
    }));
    expect(res.status).toBe(200);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makeReq({ airport_iata: "DXB" }));
    expect(res.status).toBe(401);
  });

  it("DB error -> 500", async () => {
    mockSetMonitoredAirport.mockImplementation(() => {
      throw new Error("DB write error");
    });

    const res = await POST(makeReq({ airport_iata: "DXB" }));
    expect(res.status).toBe(500);
  });

  it("4-letter IATA code (e.g. EGLL) is accepted", async () => {
    const res = await POST(makeReq({ airport_iata: "EGLL" }));
    expect(res.status).toBe(200);
  });

  it("POST with only destination update (no airport_iata) on existing row -> 200", async () => {
    mockGetMonitoredAirport.mockReturnValue(makeExistingAirport("DXB"));

    const res = await POST(makeReq({ destination_iata: "CDG" }));
    expect(res.status).toBe(200);
    expect(mockSetMonitoredAirport).toHaveBeenCalledOnce();
  });
});

describe("GET /api/monitored-airports", () => {
  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("user with no airport -> 200 with null airport", async () => {
    mockGetMonitoredAirport.mockReturnValue(null);
    mockGetUserPersonalDetails.mockReturnValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.airport).toBeNull();
  });

  it("user with airport row -> 200 with airport data", async () => {
    mockGetMonitoredAirport.mockReturnValue(makeExistingAirport("DXB"));
    mockGetUserPersonalDetails.mockReturnValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.airport?.airport_iata).toBe("DXB");
  });
});

// ── Additional branch coverage ────────────────────────────────────────────────

describe("GET /api/monitored-airports — travel dates set", () => {
  it("airport with travel_date_from and travel_date_to -> formatted dates in response", async () => {
    mockGetMonitoredAirport.mockReturnValue({
      ...makeExistingAirport("DXB"),
      travel_date_from: 1700000000,
      travel_date_to: 1700100000,
    });
    mockGetUserPersonalDetails.mockReturnValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.airport?.travel_date_from).toBeTruthy();
    expect(body.airport?.travel_date_to).toBeTruthy();
  });
});

describe("POST /api/monitored-airports — additional branches", () => {
  it("invalid JSON body -> 400", async () => {
    const req = new NextRequest("http://localhost/api/monitored-airports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("existing airport with last_scan_at -> setAirportLastScanAt called on re-set", async () => {
    mockGetMonitoredAirport.mockReturnValue({
      ...makeExistingAirport("DXB"),
      last_scan_at: 1700000000,
    });

    const res = await POST(makeReq({ airport_iata: "DXB", destination_iata: "LHR" }));
    expect(res.status).toBe(200);
    expect(mockSetAirportLastScanAt).toHaveBeenCalledWith("user-001", "DXB", 1700000000);
  });

  it("airport_iata not sent with existing airport -> update destination only", async () => {
    mockGetMonitoredAirport.mockReturnValue(makeExistingAirport("DXB"));

    const res = await POST(makeReq({ destination_iata: "JFK" }));
    expect(res.status).toBe(200);
    expect(mockSetMonitoredAirport).toHaveBeenCalledWith(
      expect.objectContaining({ airport_iata: "DXB", destination_iata: "JFK" })
    );
  });

  it("airport_iata not sent, no existing airport -> 200 ok (noop)", async () => {
    mockGetMonitoredAirport.mockReturnValue(null);

    const res = await POST(makeReq({ destination_iata: "JFK" }));
    expect(res.status).toBe(200);
    expect(mockSetMonitoredAirport).not.toHaveBeenCalled();
  });

  it("with personal_details object -> setUserPersonalDetails called", async () => {
    mockGetMonitoredAirport.mockReturnValue(null);

    const res = await POST(makeReq({
      airport_iata: "DXB",
      personal_details: {
        full_name: "Alice Smith",
        date_of_birth: "1990-01-01",
        passport_number: "AB123456",
        passport_expiry: "2030-01-01",
        nationality: "GB",
        phone: "+441234567890",
      },
    }));
    expect(res.status).toBe(200);
    expect(mockSetUserPersonalDetails).toHaveBeenCalledWith(
      "user-001",
      expect.objectContaining({ full_name: "Alice Smith" })
    );
  });
});
