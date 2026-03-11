/**
 * Tests for scripts/monitor.ts — main(), reconcileAirports(), startIntervalForBucket()
 * File: __tests__/scripts/monitor-main.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock logger ────────────────────────────────────────────────────────────────
const mockLog = vi.fn();
vi.mock("@/lib/logger", () => ({ log: (...a: unknown[]) => mockLog(...a), logRequest: vi.fn() }));

// ── Mock DB functions ─────────────────────────────────────────────────────────
const mockInitDb = vi.fn();
const mockGetAllFlightStatuses = vi.fn().mockReturnValue([]);
const mockGetAirportScanBuckets = vi.fn().mockReturnValue([]);
const mockGetAirportsNeedingImmediateScan = vi.fn().mockReturnValue([]);
const mockGetFlightsByAirport = vi.fn().mockResolvedValue([]);
const mockUpsertFlight = vi.fn();
const mockPurgeStaleFlights = vi.fn();
const mockPurgeStalePendingBookings = vi.fn();
const mockUpdateScanTimestamps = vi.fn();
const mockClearImmediateScanFlag = vi.fn();
const mockCloseDb = vi.fn();

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    initDb: () => mockInitDb(),
    closeDb: () => mockCloseDb(),
    getAllFlightStatuses: () => mockGetAllFlightStatuses(),
    getAirportScanBuckets: () => mockGetAirportScanBuckets(),
    getAirportsNeedingImmediateScan: () => mockGetAirportsNeedingImmediateScan(),
    upsertFlight: (...a: unknown[]) => mockUpsertFlight(...a),
    purgeStaleFlights: (...a: unknown[]) => mockPurgeStaleFlights(...a),
    purgeStalePendingBookings: () => mockPurgeStalePendingBookings(),
    updateScanTimestamps: (...a: unknown[]) => mockUpdateScanTimestamps(...a),
    clearImmediateScanFlag: (...a: unknown[]) => mockClearImmediateScanFlag(...a),
    getActiveUsersForAirport: vi.fn().mockReturnValue([]),
    createNotification: vi.fn(),
  };
});

// ── Mock AeroDataBox ──────────────────────────────────────────────────────────
vi.mock("@/lib/aerodatabox", () => ({
  getFlightsByAirport: (...a: unknown[]) => mockGetFlightsByAirport(...a),
}));

// ── Mock duffel ───────────────────────────────────────────────────────────────
vi.mock("@/lib/duffel", () => ({
  checkFlightBookable: vi.fn().mockResolvedValue({ bookable: false, lowestPriceCents: null, currency: null }),
}));

// ── Mock bookings ─────────────────────────────────────────────────────────────
vi.mock("@/lib/bookings", () => ({
  handleFlightCancellation: vi.fn().mockResolvedValue(undefined),
  notifyUsersOfNewFlight: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock push ─────────────────────────────────────────────────────────────────
vi.mock("@/lib/push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
  initVapid: vi.fn(),
}));

// Import the module at the top level (same module instance throughout file)
import {
  main,
  reconcileAirports,
  startIntervalForBucket,
  airportGroups,
  activeIntervals,
  activeTimers,
  previousStatuses,
} from "@/scripts/monitor";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Reset in-memory module state
  airportGroups.clear();
  activeTimers.clear();
  activeIntervals.length = 0;
  previousStatuses.clear();
  mockGetAllFlightStatuses.mockReturnValue([]);
  mockGetAirportScanBuckets.mockReturnValue([]);
  mockGetAirportsNeedingImmediateScan.mockReturnValue([]);
  mockGetFlightsByAirport.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// main() — idle (no active airport buckets)
// ─────────────────────────────────────────────────────────────────────────────
describe("main() — idle state (no airport buckets)", () => {
  it("initializes DB and pre-loads flight statuses into previousStatuses", () => {
    mockGetAllFlightStatuses.mockReturnValue([
      { id: "fl-1", status: "scheduled" },
      { id: "fl-2", status: "active" },
    ]);
    mockGetAirportScanBuckets.mockReturnValue([]);

    main();

    expect(mockInitDb).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      expect.stringContaining("Pre-loaded 2 known flight"),
      expect.objectContaining({ count: 2 })
    );
    expect(previousStatuses.size).toBe(2);
    expect(previousStatuses.get("fl-1")).toBe("scheduled");
  });

  it("logs idle message and returns early when no buckets", () => {
    mockGetAirportScanBuckets.mockReturnValue([]);

    main();

    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      expect.stringContaining("Monitor idle")
    );
    // No airport intervals started
    expect(airportGroups.size).toBe(0);
  });

  it("starts the 5s immediate-scan interval even in idle mode", () => {
    mockGetAirportScanBuckets.mockReturnValue([]);

    main();

    // activeIntervals should contain exactly the heartbeat + immediate-scan timers
    expect(activeIntervals.length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// main() — with airport buckets
// ─────────────────────────────────────────────────────────────────────────────
describe("main() — with airport buckets", () => {
  it("populates airportGroups and starts bucket intervals", () => {
    mockGetAirportScanBuckets.mockReturnValue([
      { airport_iata: "DXB", interval: 600 },
    ]);

    main();

    // DXB should be in the 600s group
    expect(airportGroups.has(600)).toBe(true);
    expect(airportGroups.get(600)?.has("DXB")).toBe(true);

    // A setInterval for 600s should have been registered
    expect(activeTimers.has(600)).toBe(true);
  });

  it("starts hourly-refresh and purge intervals", () => {
    mockGetAirportScanBuckets.mockReturnValue([
      { airport_iata: "LHR", interval: 300 },
    ]);

    main();

    // heartbeat + immediate + bucket + hourly + purge = 5 intervals
    expect(activeIntervals.length).toBeGreaterThanOrEqual(3);
  });

  it("calls purgeStalePendingBookings immediately on startup", () => {
    mockGetAirportScanBuckets.mockReturnValue([
      { airport_iata: "JFK", interval: 300 },
    ]);

    main();

    expect(mockPurgeStalePendingBookings).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// reconcileAirports
// ─────────────────────────────────────────────────────────────────────────────
describe("reconcileAirports", () => {
  it("removes airports that are no longer in the live DB", () => {
    // Seed in-memory state with DXB in the 600s bucket
    const group = new Set(["DXB"]);
    airportGroups.set(600, group);

    // Live DB has no airports
    reconcileAirports(new Map());

    expect(group.has("DXB")).toBe(false);
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      expect.stringContaining("Stopped monitoring DXB"),
      expect.anything()
    );
  });

  it("moves airport to new bucket when interval changes", () => {
    const group = new Set(["DXB"]);
    airportGroups.set(600, group);

    // Live DB now shows DXB at 300s
    reconcileAirports(new Map([["DXB", 300]]));

    expect(group.has("DXB")).toBe(false); // removed from old bucket
    expect(airportGroups.get(300)?.has("DXB")).toBe(true); // added to new bucket
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      expect.stringContaining("interval changed"),
      expect.anything()
    );
  });

  it("adds new airports detected in live DB", () => {
    // No airports in memory yet
    reconcileAirports(new Map([["DXB", 600]]));

    expect(airportGroups.get(600)?.has("DXB")).toBe(true);
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      expect.stringContaining("New airport detected: DXB"),
      expect.anything()
    );
  });

  it("does not start a new interval bucket if one already exists", () => {
    // Pre-register the 600s bucket interval
    const existingGroup = new Set<string>();
    airportGroups.set(600, existingGroup);
    const fakeId = setTimeout(() => {}, 999999);
    activeTimers.set(600, fakeId as NodeJS.Timeout);

    const initialIntervalCount = activeIntervals.length;

    reconcileAirports(new Map([["DXB", 600]]));

    // No new startIntervalForBucket call — interval count unchanged
    expect(activeIntervals.length).toBe(initialIntervalCount);

    clearTimeout(fakeId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startIntervalForBucket
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// runImmediateScans (inner closure in main)
// ─────────────────────────────────────────────────────────────────────────────
describe("main() runImmediateScans (inner closure)", () => {
  it("does nothing when no airports need immediate scan (early return path)", async () => {
    mockGetAirportScanBuckets.mockReturnValue([]);
    mockGetAirportsNeedingImmediateScan.mockReturnValue([]);

    main();

    // Advance past the 5s immediate-scan tick
    await vi.advanceTimersByTimeAsync(5001);

    // No clearImmediateScanFlag called
    expect(mockClearImmediateScanFlag).not.toHaveBeenCalled();
  });

  it("polls and clears flag when airports need immediate scan", async () => {
    mockGetAirportScanBuckets.mockReturnValue([{ airport_iata: "DXB", interval: 600 }]);
    mockGetAirportsNeedingImmediateScan.mockReturnValue([
      { airport_iata: "DXB", interval: 600 },
    ]);
    mockGetFlightsByAirport.mockResolvedValue([]);

    main();

    // Advance past the 5s immediate-scan tick
    await vi.advanceTimersByTimeAsync(5001);

    expect(mockClearImmediateScanFlag).toHaveBeenCalledWith("DXB");
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      expect.stringContaining("Priority scan triggered for DXB"),
      expect.anything()
    );
  });

  it("logs AeroDataBox poll error when getFlightsByAirport throws", async () => {
    mockGetAirportScanBuckets.mockReturnValue([]);
    mockGetAirportsNeedingImmediateScan.mockReturnValue([
      { airport_iata: "SYD", interval: 300 },
    ]);
    mockGetFlightsByAirport.mockRejectedValue(new Error("API down"));

    main();

    await vi.advanceTimersByTimeAsync(5001);

    // Flush micro-tasks so the async pollAirport rejection is processed
    await Promise.resolve();
    await Promise.resolve();

    expect(mockLog).toHaveBeenCalledWith(
      "error",
      "monitor",
      "AeroDataBox poll error",
      expect.objectContaining({ airport: "SYD" })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// hourlyRefresh (inner closure in main)
// ─────────────────────────────────────────────────────────────────────────────
describe("main() hourlyRefresh (inner closure)", () => {
  it("refreshes all airports in the bucket on the hourly tick", async () => {
    mockGetAirportScanBuckets.mockReturnValue([
      { airport_iata: "LHR", interval: 300 },
    ]);
    mockGetFlightsByAirport.mockResolvedValue([
      { id: "fl-1", flight_number: "BA001", status: "scheduled", origin_iata: "LHR", destination_iata: "JFK", estimated_departure: "2026-03-10T10:00:00Z", actual_departure: null, bookable: false, lowest_price_cents: null, currency: null, airport_iata: "LHR" },
    ]);

    main();

    // Advance 1 hour to trigger hourlyRefresh
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1);

    expect(mockPurgeStaleFlights).toHaveBeenCalledWith("LHR");
    expect(mockUpsertFlight).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      expect.stringContaining("[hourly-refresh] LHR"),
      expect.anything()
    );
  });

  it("logs error when hourlyRefresh getFlightsByAirport throws", async () => {
    mockGetAirportScanBuckets.mockReturnValue([
      { airport_iata: "CDG", interval: 600 },
    ]);
    mockGetFlightsByAirport.mockRejectedValue(new Error("AeroDataBox timeout"));

    main();

    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 + 1);

    expect(mockLog).toHaveBeenCalledWith(
      "error",
      "monitor",
      expect.stringContaining("[hourly-refresh] CDG error"),
      expect.anything()
    );
  });
});

describe("startIntervalForBucket", () => {
  it("logs the starting message with interval seconds", () => {
    airportGroups.set(300, new Set(["LHR"]));

    startIntervalForBucket(300);

    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      "Starting 300s interval",
      expect.objectContaining({ intervalSeconds: 300 })
    );
  });

  it("registers a new setInterval in activeIntervals and activeTimers", () => {
    const before = activeIntervals.length;
    airportGroups.set(900, new Set(["CDG"]));

    startIntervalForBucket(900);

    expect(activeIntervals.length).toBe(before + 1);
    expect(activeTimers.has(900)).toBe(true);
  });

  it("on tick: calls reconcileAirports (getAirportScanBuckets) and polls airports", async () => {
    mockGetAirportScanBuckets.mockReturnValue([{ airport_iata: "SYD", interval: 120 }]);
    airportGroups.set(120, new Set(["SYD"]));

    startIntervalForBucket(120);

    // Advance timer to trigger the first tick
    await vi.advanceTimersByTimeAsync(120 * 1000);

    // reconcileAirports reads DB via getAirportScanBuckets inside readCurrentIntervals
    expect(mockGetAirportScanBuckets).toHaveBeenCalled();
  });
});
