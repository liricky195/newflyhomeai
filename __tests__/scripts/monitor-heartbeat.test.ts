/**
 * 4J — Monitor heartbeat
 * Tests that startHeartbeat emits a log every 60 seconds with the
 * correct fields.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockLog = vi.fn();
vi.mock("@/lib/logger", () => ({
  log: (...a: unknown[]) => mockLog(...a),
  logRequest: vi.fn(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    initDb: vi.fn(),
    closeDb: vi.fn(),
    getDb: vi.fn(),
    getAirportScanBuckets: vi.fn().mockReturnValue([]),
    getAllFlightStatuses: vi.fn().mockReturnValue([]),
    getAirportsNeedingImmediateScan: vi.fn().mockReturnValue([]),
    purgeStalePendingBookings: vi.fn(),
    upsertFlight: vi.fn((f: unknown) => f),
    updateScanTimestamps: vi.fn(),
    purgeStaleFlights: vi.fn(),
    getActiveUsersForAirport: vi.fn().mockReturnValue([]),
    createNotification: vi.fn(),
    updateFlightBookable: vi.fn(),
    updateFlightPrice: vi.fn(),
  };
});

vi.mock("@/lib/aerodatabox", () => ({
  getFlightsByAirport: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/duffel", () => ({
  checkFlightBookable: vi.fn().mockResolvedValue({ bookable: false, lowestPriceCents: null, currency: null }),
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  initVapid: vi.fn(),
}));

vi.mock("@/lib/bookings", () => ({
  handleFlightCancellation: vi.fn().mockResolvedValue(undefined),
}));

import { startHeartbeat, airportGroups, activeIntervals } from "@/scripts/monitor";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  airportGroups.clear();
  activeIntervals.length = 0;
});

afterEach(() => {
  // Clear any intervals created in tests
  for (const id of activeIntervals) clearInterval(id);
  activeIntervals.length = 0;
  vi.useRealTimers();
});

describe("Monitor heartbeat (4J)", () => {
  it("heartbeat emitted every 60 seconds", async () => {
    startHeartbeat();

    // Not emitted at time=0
    expect(mockLog).not.toHaveBeenCalledWith("info", "monitor", "heartbeat", expect.anything());

    // Advance 60 s
    await vi.advanceTimersByTimeAsync(60_001);

    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      "heartbeat",
      expect.objectContaining({
        uptime_seconds: expect.any(Number),
        airports_monitored: expect.any(Number),
      })
    );
  });

  it("heartbeat JSON contains level=info, message=heartbeat, uptime_seconds >= 0", async () => {
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(60_001);

    const heartbeatCall = mockLog.mock.calls.find(
      (c) => c[0] === "info" && c[1] === "monitor" && c[2] === "heartbeat"
    );
    expect(heartbeatCall).toBeDefined();
    const meta = heartbeatCall![3] as Record<string, unknown>;
    expect(typeof meta.uptime_seconds).toBe("number");
    expect(meta.uptime_seconds as number).toBeGreaterThanOrEqual(0);
  });

  it("airports_monitored reflects correct count from airportGroups", async () => {
    // Set up 2 airports in airportGroups
    airportGroups.set(30, new Set(["DXB", "LHR"]));
    airportGroups.set(60, new Set(["JFK"]));

    startHeartbeat();
    await vi.advanceTimersByTimeAsync(60_001);

    const heartbeatCall = mockLog.mock.calls.find(
      (c) => c[0] === "info" && c[1] === "monitor" && c[2] === "heartbeat"
    );
    expect(heartbeatCall).toBeDefined();
    const meta = heartbeatCall![3] as Record<string, unknown>;
    expect(meta.airports_monitored).toBe(3); // 2 + 1
  });

  it("heartbeat emits again at 120 seconds (every 60 s)", async () => {
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(120_001);

    const heartbeatCalls = mockLog.mock.calls.filter(
      (c) => c[0] === "info" && c[1] === "monitor" && c[2] === "heartbeat"
    );
    expect(heartbeatCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("heartbeat airports_monitored is 0 when no airports configured", async () => {
    airportGroups.clear();
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(60_001);

    const heartbeatCall = mockLog.mock.calls.find(
      (c) => c[0] === "info" && c[1] === "monitor" && c[2] === "heartbeat"
    );
    const meta = heartbeatCall![3] as Record<string, unknown>;
    expect(meta.airports_monitored).toBe(0);
  });
});
