/**
 * 4I — Monitor graceful shutdown
 * Tests that gracefulShutdown() clears intervals, closes DB, logs,
 * and calls process.exit(0). Also tests SIGTERM, SIGINT, and
 * unhandledRejection behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks (must be set up before import) ──────────────────────────────────────

const mockCloseDb = vi.fn();
const mockInitDb = vi.fn();
const mockGetDb = vi.fn();
const mockLog = vi.fn();

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return {
    ...actual,
    initDb: () => mockInitDb(),
    closeDb: () => mockCloseDb(),
    getDb: () => mockGetDb(),
    closeDb: () => mockCloseDb(),
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

vi.mock("@/lib/logger", () => ({
  log: (...a: unknown[]) => mockLog(...a),
  logRequest: vi.fn(),
}));

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

import { gracefulShutdown, handleUnhandledRejection, activeIntervals } from "@/scripts/monitor";

beforeEach(() => {
  vi.clearAllMocks();
  // Ensure activeIntervals is empty at test start
  activeIntervals.length = 0;
});

describe("Monitor graceful shutdown (4I)", () => {
  it("gracefulShutdown: setInterval handles cleared, no further poll calls", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    const id = setInterval(() => {}, 60_000);
    activeIntervals.push(id);

    gracefulShutdown();

    expect(activeIntervals.length).toBe(0);
    exitSpy.mockRestore();
  });

  it("gracefulShutdown: DB close called", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    gracefulShutdown();
    expect(mockCloseDb).toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("gracefulShutdown: 'shutting down gracefully' logged", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    gracefulShutdown();
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "monitor",
      expect.stringContaining("shutting down gracefully")
    );
    exitSpy.mockRestore();
  });

  it("gracefulShutdown: process.exit(0) called", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    gracefulShutdown();
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("SIGTERM: gracefulShutdown triggered (process.exit called)", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    process.emit("SIGTERM");
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("SIGINT: gracefulShutdown triggered (process.exit called)", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    process.emit("SIGINT");
    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });

  it("unhandledRejection: error logged, process.exit NOT called", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    // Call the exported handler directly to avoid triggering Vitest's own unhandledRejection listener
    handleUnhandledRejection(new Error("something went wrong"));
    expect(mockLog).toHaveBeenCalledWith(
      "error",
      "monitor",
      "Unhandled rejection",
      expect.objectContaining({ reason: expect.any(String) })
    );
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
