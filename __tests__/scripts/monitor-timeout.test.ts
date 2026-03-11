/**
 * 4H — Monitor AbortController timeout
 * Tests that pollAirport wraps AeroDataBox calls in a 10 s AbortController,
 * logs a warn on timeout, does not call upsertFlight, and does not crash.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetFlightsByAirport = vi.fn();
vi.mock("@/lib/aerodatabox", () => ({
  getFlightsByAirport: (...a: unknown[]) => mockGetFlightsByAirport(...a),
}));

const mockUpsertFlight = vi.fn((f: unknown) => f);
const mockUpdateScanTimestamps = vi.fn();
const mockPurgeStaleFlights = vi.fn();
const mockUpdateFlightBookable = vi.fn();
const mockUpdateFlightPrice = vi.fn();
const mockGetActiveUsersForAirport = vi.fn().mockReturnValue([]);
const mockCreateNotification = vi.fn();

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    initDb: vi.fn(),
    closeDb: vi.fn(),
    getDb: vi.fn(),
    upsertFlight: (...a: unknown[]) => mockUpsertFlight(...a),
    updateScanTimestamps: (...a: unknown[]) => mockUpdateScanTimestamps(...a),
    purgeStaleFlights: (...a: unknown[]) => mockPurgeStaleFlights(...a),
    updateFlightBookable: (...a: unknown[]) => mockUpdateFlightBookable(...a),
    updateFlightPrice: (...a: unknown[]) => mockUpdateFlightPrice(...a),
    getActiveUsersForAirport: (...a: unknown[]) => mockGetActiveUsersForAirport(...a),
    createNotification: (...a: unknown[]) => mockCreateNotification(...a),
    purgeStalePendingBookings: vi.fn(),
    getAirportScanBuckets: vi.fn().mockReturnValue([]),
    getAirportsNeedingImmediateScan: vi.fn().mockReturnValue([]),
    getAllFlightStatuses: vi.fn().mockReturnValue([]),
    clearImmediateScanFlag: vi.fn(),
    getNextScanAt: vi.fn().mockReturnValue(null),
  };
});

vi.mock("@/lib/duffel", () => ({
  checkFlightBookable: vi.fn().mockResolvedValue({ bookable: true, lowestPriceCents: null, currency: null }),
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  initVapid: vi.fn(),
}));

vi.mock("@/lib/bookings", () => ({
  handleFlightCancellation: vi.fn().mockResolvedValue(undefined),
}));

const mockLog = vi.fn();
vi.mock("@/lib/logger", () => ({
  log: (...a: unknown[]) => mockLog(...a),
  logRequest: vi.fn(),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import { pollAirport, previousStatuses } from "@/scripts/monitor";

beforeEach(() => {
  vi.clearAllMocks();
  previousStatuses.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Monitor AbortController timeout (4H)", () => {
  it("fetch resolves within 10s: no abort, upsertFlight called", async () => {
    const flight = {
      id: "f1", flight_number: "EK001", airline: "Emirates",
      departure_airport: "DXB", destination_airport: "LHR",
      scheduled_departure: Math.floor(Date.now() / 1000) + 86400,
      estimated_departure: null, status: "scheduled" as const,
      bookable: 0, lowest_price_cents: null, currency: null,
    };
    mockGetFlightsByAirport.mockResolvedValueOnce([flight]);
    mockUpsertFlight.mockReturnValue({ ...flight, bookable: 1 });

    await pollAirport("DXB", 30);

    expect(mockUpsertFlight).toHaveBeenCalledWith(expect.objectContaining({ id: "f1" }));
    expect(mockLog).not.toHaveBeenCalledWith("warn", "monitor", expect.stringContaining("timed out"), expect.anything());
  });

  it("fetch hangs past 10s: abort() triggered, warn logged, upsertFlight NOT called", async () => {
    vi.useFakeTimers();
    // getFlightsByAirport never resolves (simulates a hang)
    mockGetFlightsByAirport.mockImplementationOnce(() => new Promise(() => {}));

    const pollPromise = pollAirport("DXB", 30);
    // Advance past the 10 s AbortController timeout
    await vi.advanceTimersByTimeAsync(10_001);
    await pollPromise;

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "monitor",
      "AeroDataBox poll timed out",
      expect.objectContaining({ airport: "DXB" })
    );
    expect(mockUpsertFlight).not.toHaveBeenCalled();
    expect(mockUpdateScanTimestamps).not.toHaveBeenCalled();
  });

  it("fetch throws AbortError directly: treated as timeout, warn logged, no crash", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    mockGetFlightsByAirport.mockRejectedValueOnce(abortError);

    await pollAirport("DXB", 30);

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "monitor",
      "AeroDataBox poll timed out",
      expect.objectContaining({ airport: "DXB" })
    );
    expect(mockUpsertFlight).not.toHaveBeenCalled();
  });

  it("fetch throws non-abort error: error logged, monitor continues (no crash)", async () => {
    mockGetFlightsByAirport.mockRejectedValueOnce(new Error("Network error"));

    // Should NOT throw
    await expect(pollAirport("DXB", 30)).resolves.toBeUndefined();

    expect(mockLog).toHaveBeenCalledWith(
      "error",
      "monitor",
      "AeroDataBox poll error",
      expect.objectContaining({ airport: "DXB" })
    );
    expect(mockUpsertFlight).not.toHaveBeenCalled();
  });

  it("airport 1 timeout does not affect airport 2 (separate AbortControllers)", async () => {
    vi.useFakeTimers();
    // Airport 1 hangs
    mockGetFlightsByAirport.mockImplementationOnce(() => new Promise(() => {}));
    // Airport 2 resolves normally
    mockGetFlightsByAirport.mockResolvedValueOnce([]);

    const p1 = pollAirport("DXB", 30);
    const p2 = pollAirport("LHR", 30);

    // Advance time to trigger Airport 1's timeout
    await vi.advanceTimersByTimeAsync(10_001);
    await Promise.all([p1, p2]);

    // DXB timed out
    expect(mockLog).toHaveBeenCalledWith("warn", "monitor", "AeroDataBox poll timed out",
      expect.objectContaining({ airport: "DXB" }));
    // LHR succeeded
    expect(mockLog).not.toHaveBeenCalledWith("warn", "monitor", "AeroDataBox poll timed out",
      expect.objectContaining({ airport: "LHR" }));
    // updateScanTimestamps called for LHR (successful empty poll) but not DXB
    expect(mockUpdateScanTimestamps).toHaveBeenCalledWith("LHR", 30);
    expect(mockUpdateScanTimestamps).not.toHaveBeenCalledWith("DXB", expect.anything());
  });
});
