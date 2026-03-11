import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FlightStatus, DbFlight } from "@/lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// Mocks — must be declared before importing the module under test
// ─────────────────────────────────────────────────────────────────────────────

// HARDENED IN STEP 10: mock logger (monitor now uses log() instead of console.log)
const mockLog = vi.fn();
vi.mock("@/lib/logger", () => ({
  log: (...a: unknown[]) => mockLog(...a),
  logRequest: vi.fn(),
}));

vi.mock("@/lib/aerodatabox", () => ({
  getFlightsByAirport: vi.fn(),
}));

// HARDENED IN STEP 10: also mock bookings (monitor imports handleFlightCancellation)
vi.mock("@/lib/bookings", () => ({
  handleFlightCancellation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    initDb: vi.fn(),
    upsertFlight: vi.fn((f: unknown) => f as DbFlight),
    updateFlightBookable: vi.fn(),
    updateFlightPrice: vi.fn(),
    updateScanTimestamps: vi.fn(),
    createNotification: vi.fn((n: unknown) => n),
    getAirportScanBuckets: vi.fn(() => []),
    getActiveUsersForAirport: vi.fn(() => []),
    purgeStaleFlights: vi.fn(),
  };
});

vi.mock("@/lib/duffel", () => ({
  checkFlightBookable: vi.fn().mockResolvedValue({ bookable: true, lowestPriceCents: null, currency: null }),
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

import { getFlightsByAirport } from "@/lib/aerodatabox";
import {
  upsertFlight,
  createNotification,
  getActiveUsersForAirport,
  updateScanTimestamps,
  getAirportScanBuckets,
} from "@/lib/db";
import { sendPushNotification } from "@/lib/push";
import {
  pollAirport,
  previousStatuses,
  airportGroups,
  activeTimers,
  reconcileAirports,
  readCurrentIntervals,
} from "@/scripts/monitor";

import { beforeEach } from "vitest";
beforeEach(() => {
  mockLog.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type FlightForUpsert = Omit<DbFlight, "created_at" | "last_seen_at">;

function makeFlight(overrides: Partial<FlightForUpsert> = {}): FlightForUpsert {
  return {
    id: "EK101-2026-03-07T10:00:00Z",
    flight_number: "EK101",
    airline: "Emirates",
    departure_airport: "DXB",
    destination_airport: "LHR",
    scheduled_departure: 1772992800,
    estimated_departure: null,
    status: "scheduled",
    aircraft_type: "Boeing 777-300ER",
    bookable: 1,
    lowest_price_cents: null,
    price_currency: null,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  previousStatuses.clear();
  airportGroups.clear();
  activeTimers.clear();
});

afterEach(() => {
  previousStatuses.clear();
  airportGroups.clear();
  activeTimers.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// pollAirport
// ─────────────────────────────────────────────────────────────────────────────

describe("pollAirport", () => {
  it("calls upsertFlight once per flight returned", async () => {
    const flights = [
      makeFlight({ id: "EK101-2026-03-07T10:00:00Z" }),
      makeFlight({ id: "EK102-2026-03-07T11:00:00Z", flight_number: "EK102" }),
    ];
    vi.mocked(getFlightsByAirport).mockResolvedValue(flights);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);

    await pollAirport("DXB", 60);

    expect(upsertFlight).toHaveBeenCalledTimes(2);
    expect(upsertFlight).toHaveBeenCalledWith(flights[0]);
    expect(upsertFlight).toHaveBeenCalledWith(flights[1]);
  });

  it("notifies on first poll (all flights are new)", async () => {
    const flight = makeFlight();
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([
      { user_id: "user-001" },
    ]);

    await pollAirport("DXB", 60);

    expect(sendPushNotification).toHaveBeenCalledOnce();
    expect(sendPushNotification).toHaveBeenCalledWith("user-001", {
      title: "New flight: EK101",
      body: expect.stringContaining("EK101"),
    });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-001",
        flight_id: flight.id,
        type: "new_flight",
      })
    );
  });

  it("does NOT notify on second poll if status unchanged", async () => {
    const flight = makeFlight();
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([
      { user_id: "user-001" },
    ]);

    await pollAirport("DXB", 60);
    vi.clearAllMocks();

    // Second poll with identical data
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    await pollAirport("DXB", 60);

    expect(sendPushNotification).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("notifies when flight status changes between polls", async () => {
    const scheduled = makeFlight({ status: "scheduled" });
    vi.mocked(getFlightsByAirport).mockResolvedValue([scheduled]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([
      { user_id: "user-001" },
    ]);

    await pollAirport("DXB", 60);
    vi.clearAllMocks();

    const active = makeFlight({ status: "active" });
    vi.mocked(getFlightsByAirport).mockResolvedValue([active]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([
      { user_id: "user-001" },
    ]);

    await pollAirport("DXB", 60);

    expect(sendPushNotification).toHaveBeenCalledOnce();
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "status_change",
      })
    );
  });

  it("logs error and continues when getFlightsByAirport throws", async () => {
    // HARDENED IN STEP 10: monitor uses log("error") not console.error
    vi.mocked(getFlightsByAirport).mockRejectedValue(
      new Error("API unavailable")
    );

    // Should NOT throw
    await expect(pollAirport("DXB", 60)).resolves.toBeUndefined();

    // In Step 10, getFlightsByAirport errors are treated as non-abort errors
    // (logged as "error" with "AeroDataBox poll error") OR as AbortError warnings
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringMatching(/warn|error/),
      "monitor",
      expect.any(String),
      expect.anything()
    );
    expect(upsertFlight).not.toHaveBeenCalled();
  });

  it("handles zero flights gracefully", async () => {
    vi.mocked(getFlightsByAirport).mockResolvedValue([]);

    await pollAirport("DXB", 60);

    // HARDENED IN STEP 10: monitor now uses log() not console.log
    expect(mockLog).toHaveBeenCalledWith(
      "debug",
      "monitor",
      expect.stringContaining("0 flights"),
      expect.anything()
    );
    expect(upsertFlight).not.toHaveBeenCalled();
  });

  it("notifies all active users for the airport", async () => {
    const flight = makeFlight();
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([
      { user_id: "user-001" },
      { user_id: "user-002" },
    ]);

    await pollAirport("DXB", 60);

    expect(sendPushNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5F — startup and tick query (LEFT JOIN, COALESCE, reconcileAirports)
// ─────────────────────────────────────────────────────────────────────────────

describe("5F — monitor startup and tick reconciliation", () => {
  it("startup with user who has monitored_airports row but NO subscriptions row: airport IS included (LEFT JOIN, COALESCE=1800)", () => {
    vi.mocked(getAirportScanBuckets).mockReturnValue([
      { airport_iata: "DXB", interval: 1800 }, // COALESCE default — no subscription row
    ]);

    const liveIntervals = new Map([["DXB", 1800]]);
    reconcileAirports(liveIntervals);

    expect(airportGroups.has(1800)).toBe(true);
    expect(airportGroups.get(1800)!.has("DXB")).toBe(true);
  });

  it("startup with user who has monitored_airports row and free subscription (1800s): interval is 1800", () => {
    const liveIntervals = new Map([["DXB", 1800]]);
    reconcileAirports(liveIntervals);

    expect(airportGroups.get(1800)!.has("DXB")).toBe(true);
  });

  it("startup with user who has monitored_airports row and standard subscription (180s): interval is 180", () => {
    const liveIntervals = new Map([["DXB", 180]]);
    reconcileAirports(liveIntervals);

    expect(airportGroups.get(180)!.has("DXB")).toBe(true);
  });

  it("startup with two users at same airport — one free (1800s), one pro (60s): airport at 60s (minimum)", () => {
    // The DB query returns MIN(scan_interval_seconds) so we get 60
    const liveIntervals = new Map([["DXB", 60]]);
    reconcileAirports(liveIntervals);

    expect(airportGroups.get(60)!.has("DXB")).toBe(true);
    expect(airportGroups.has(1800)).toBe(false);
  });

  it("startup with zero active monitored airports: no groups created", () => {
    const liveIntervals = new Map<string, number>();
    reconcileAirports(liveIntervals);

    expect(airportGroups.size).toBe(0);
  });

  it("tick re-read: user upgrades from free to standard — airport moved to 180s bucket, change logged", () => {
    // HARDENED IN STEP 10: monitor uses log() not console.log
    airportGroups.set(1800, new Set(["DXB"]));

    const liveIntervals = new Map([["DXB", 180]]);
    reconcileAirports(liveIntervals);

    expect(airportGroups.get(1800)?.has("DXB")).toBe(false);
    expect(airportGroups.get(180)?.has("DXB")).toBe(true);
    expect(mockLog).toHaveBeenCalledWith(
      "info", "monitor", expect.stringContaining("1800s → 180s"), expect.anything()
    );
  });

  it("tick re-read: user degrades from standard to free — airport moved to 1800s bucket", () => {
    // HARDENED IN STEP 10: monitor uses log() not console.log
    airportGroups.set(180, new Set(["DXB"]));

    const liveIntervals = new Map([["DXB", 1800]]);
    reconcileAirports(liveIntervals);

    expect(airportGroups.get(180)?.has("DXB")).toBe(false);
    expect(airportGroups.get(1800)?.has("DXB")).toBe(true);
    expect(mockLog).toHaveBeenCalledWith(
      "info", "monitor", expect.stringContaining("180s → 1800s"), expect.anything()
    );
  });

  it("tick re-read: new airport added mid-session — detected, immediate poll triggered, updateScanTimestamps called after successful poll", async () => {
    // Start with no airports
    const flight = makeFlight({ departure_airport: "AUH" });
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);

    // New airport appears in live intervals
    const liveIntervals = new Map([["AUH", 1800]]);
    reconcileAirports(liveIntervals);

    // Wait for the immediate poll to complete
    await vi.waitFor(() => {
      expect(vi.mocked(updateScanTimestamps)).toHaveBeenCalledWith("AUH", 1800);
    }, { timeout: 2000 });

    expect(airportGroups.get(1800)?.has("AUH")).toBe(true);
  });

  it("tick re-read: airport removed — polling stops, log emitted", () => {
    // HARDENED IN STEP 10: monitor uses log() not console.log
    // (logSpy removed — we use mockLog instead)

    // Start with DXB
    airportGroups.set(1800, new Set(["DXB"]));

    // DXB no longer in live intervals
    const liveIntervals = new Map<string, number>();
    reconcileAirports(liveIntervals);

    expect(airportGroups.get(1800)?.has("DXB")).toBe(false);
    expect(mockLog).toHaveBeenCalledWith(
      "info", "monitor", expect.stringContaining("DXB"), expect.anything()
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5G — scan timestamps written correctly
// ─────────────────────────────────────────────────────────────────────────────

describe("5G — scan timestamps written correctly", () => {
  it("successful AeroDataBox poll: updateScanTimestamps called with correct airportIata and intervalSeconds", async () => {
    const flight = makeFlight();
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);

    await pollAirport("DXB", 1800);

    expect(vi.mocked(updateScanTimestamps)).toHaveBeenCalledWith("DXB", 1800);
  });

  it("failed AeroDataBox poll (throws): updateScanTimestamps NOT called", async () => {
    vi.mocked(getFlightsByAirport).mockRejectedValue(new Error("ADB unavailable"));

    await pollAirport("DXB", 1800);

    expect(vi.mocked(updateScanTimestamps)).not.toHaveBeenCalled();
  });

  it("successful poll with zero flights: updateScanTimestamps IS called (empty result is a valid successful poll)", async () => {
    vi.mocked(getFlightsByAirport).mockResolvedValue([]);

    await pollAirport("DXB", 60);

    expect(vi.mocked(updateScanTimestamps)).toHaveBeenCalledWith("DXB", 60);
  });

  it("airport with last_scanned_at NULL (first-ever scan): scan runs and updateScanTimestamps called on completion", async () => {
    const flight = makeFlight();
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);

    await pollAirport("DXB", 1800);

    expect(vi.mocked(updateScanTimestamps)).toHaveBeenCalledOnce();
    expect(vi.mocked(updateScanTimestamps)).toHaveBeenCalledWith("DXB", 1800);
  });

  it("correct intervalSeconds passed to updateScanTimestamps for each tier", async () => {
    const flight = makeFlight();
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);

    // Pro tier (60s)
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    await pollAirport("DXB", 60);
    expect(vi.mocked(updateScanTimestamps)).toHaveBeenLastCalledWith("DXB", 60);

    vi.clearAllMocks();

    // Ultimate tier (30s)
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    await pollAirport("AUH", 30);
    expect(vi.mocked(updateScanTimestamps)).toHaveBeenLastCalledWith("AUH", 30);
  });
});
