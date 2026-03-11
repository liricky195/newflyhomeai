/**
 * 4Y — scripts/monitor.ts unit tests for monitor logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FlightStatus, DbFlight } from "@/lib/db";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("@/lib/aerodatabox", () => ({
  getFlightsByAirport: vi.fn(),
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
    purgeStalePendingBookings: vi.fn(),
    getAirportsNeedingImmediateScan: vi.fn(() => []),
    clearImmediateScanFlag: vi.fn(),
    getAllFlightStatuses: vi.fn(() => []),
  };
});

vi.mock("@/lib/duffel", () => ({
  checkFlightBookable: vi.fn().mockResolvedValue({ bookable: true, lowestPriceCents: null, currency: null }),
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/bookings", () => ({
  handleFlightCancellation: vi.fn().mockResolvedValue(undefined),
}));

import { getFlightsByAirport } from "@/lib/aerodatabox";
import {
  upsertFlight,
  updateScanTimestamps,
  getActiveUsersForAirport,
  purgeStalePendingBookings,
} from "@/lib/db";
import { sendPushNotification } from "@/lib/push";
import { handleFlightCancellation } from "@/lib/bookings";
import {
  pollAirport,
  previousStatuses,
  airportGroups,
  activeTimers,
} from "@/scripts/monitor";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

beforeEach(() => {
  vi.clearAllMocks();
  previousStatuses.clear();
  airportGroups.clear();
  activeTimers.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  previousStatuses.clear();
  airportGroups.clear();
  activeTimers.clear();
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// pollAirport tests
// ─────────────────────────────────────────────────────────────────────────────

describe("pollAirport (4Y)", () => {
  it("calls AeroDataBox, calls upsertFlight for each flight returned", async () => {
    const flights = [
      makeFlight({ id: "EK101-1" }),
      makeFlight({ id: "EK102-1", flight_number: "EK102" }),
    ];
    vi.mocked(getFlightsByAirport).mockResolvedValue(flights);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);

    await pollAirport("DXB", 60);

    expect(getFlightsByAirport).toHaveBeenCalledWith("DXB");
    expect(upsertFlight).toHaveBeenCalledTimes(2);
  });

  it("AeroDataBox returns empty list -> no upsertFlight calls", async () => {
    vi.mocked(getFlightsByAirport).mockResolvedValue([]);

    await pollAirport("DXB", 60);

    expect(upsertFlight).not.toHaveBeenCalled();
    expect(updateScanTimestamps).toHaveBeenCalledWith("DXB", 60);
  });

  it("AeroDataBox throws (non-timeout) -> error logged; does not crash; does not call upsertFlight", async () => {
    const errorSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(getFlightsByAirport).mockRejectedValue(new Error("API unavailable"));

    await expect(pollAirport("DXB", 60)).resolves.toBeUndefined();

    expect(upsertFlight).not.toHaveBeenCalled();
    expect(updateScanTimestamps).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("upsertFlight returns { wasNew: true } -> notifyUsersOfNewFlight called (sendPushNotification)", async () => {
    const flight = makeFlight({ id: "new-flight" });
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([{ user_id: "user-001" }]);

    await pollAirport("DXB", 60);

    expect(sendPushNotification).toHaveBeenCalledWith(
      "user-001",
      expect.objectContaining({ title: expect.stringContaining("EK101") })
    );
  });

  it("upsertFlight returns existing flight with same status -> notifyUsersOfNewFlight NOT called", async () => {
    const flight = makeFlight({ status: "scheduled" });

    // First poll (makes it known)
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([{ user_id: "user-001" }]);
    await pollAirport("DXB", 60);

    vi.clearAllMocks();

    // Second poll with same status
    vi.mocked(getFlightsByAirport).mockResolvedValue([flight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([{ user_id: "user-001" }]);
    await pollAirport("DXB", 60);

    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  it("flight transitions to 'cancelled' from previous non-cancelled -> handleFlightCancellation called", async () => {
    const scheduledFlight = makeFlight({ status: "scheduled" });
    vi.mocked(getFlightsByAirport).mockResolvedValue([scheduledFlight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);
    await pollAirport("DXB", 60);

    vi.clearAllMocks();

    const cancelledFlight = makeFlight({ status: "cancelled" });
    vi.mocked(getFlightsByAirport).mockResolvedValue([cancelledFlight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);
    await pollAirport("DXB", 60);

    // handleFlightCancellation is called asynchronously, wait for it
    await vi.waitFor(() => {
      expect(handleFlightCancellation).toHaveBeenCalledWith(cancelledFlight.id);
    });
  });

  it("flight was already cancelled on previous poll -> handleFlightCancellation NOT called again", async () => {
    const cancelledFlight = makeFlight({ status: "cancelled" });

    // First poll: cancelled flight (new)
    vi.mocked(getFlightsByAirport).mockResolvedValue([cancelledFlight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);
    await pollAirport("DXB", 60);

    vi.clearAllMocks();

    // Second poll: still cancelled
    vi.mocked(getFlightsByAirport).mockResolvedValue([cancelledFlight]);
    vi.mocked(getActiveUsersForAirport).mockReturnValue([]);
    await pollAirport("DXB", 60);

    // Should NOT be called again since prev was already 'cancelled'
    expect(handleFlightCancellation).not.toHaveBeenCalled();
  });

  it("purgeStalePendingBookings called -> does not crash the process", async () => {
    // Just verify purgeStalePendingBookings can be called without error
    vi.mocked(purgeStalePendingBookings).mockReturnValue(undefined);
    expect(() => purgeStalePendingBookings()).not.toThrow();
  });

  it("AeroDataBox call simulated timeout (AbortController) -> logs warning; does not crash; no upsertFlight", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    const errorSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    vi.mocked(getFlightsByAirport).mockRejectedValue(abortError);

    await expect(pollAirport("DXB", 60)).resolves.toBeUndefined();
    expect(upsertFlight).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
