/**
 * ScanContext — white-box tests for the GET /api/flights trigger contract.
 *
 * GET /api/flights MUST be triggered in exactly three cases:
 *   1. nextScanAt countdown actively reaches 0 (normal scan boundary).
 *   2. 3 seconds after the user confirms their stranded airport
 *      (tested in __tests__/components/FirstAirportModal.test.tsx).
 *   3. nextScanAt transitions from a future value to 0/past within the same
 *      mount (subscription upgrade → monitor immediate scan → next_scan_at = 0).
 *
 * GET /api/flights MUST NOT be triggered by ScanContext in these cases:
 *   4. Page reload — component mounts and next_scan_at is already 0 in the DB.
 *   5. Logout then login — same as page reload (component remounts cold).
 *   6. Login from another device/tab — same as reload (fresh mount, stale ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

// ── Mock SWR ──────────────────────────────────────────────────────────────────

const mockGlobalMutate = vi.fn();
let mockStatusData:
  | {
      airportIata: string | null;
      scanIntervalSeconds: number;
      lastScanAt: number | null;
      nextScanAt: number | null;
    }
  | undefined = undefined;

vi.mock("swr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("swr")>();
  return {
    ...actual,
    default: (key: string) => {
      if (key === "/api/scan-status") {
        return { data: mockStatusData };
      }
      return { data: undefined };
    },
    useSWRConfig: () => ({ mutate: mockGlobalMutate }),
  };
});

import { ScanProvider, useScan } from "@/contexts/ScanContext";

// ── Helper ────────────────────────────────────────────────────────────────────

function Consumer() {
  useScan();
  return null;
}

function renderProvider() {
  return render(
    <ScanProvider>
      <Consumer />
    </ScanProvider>
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mockStatusData = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Case 1: countdown boundary ────────────────────────────────────────────────

describe("ScanContext — Case 1: GET /api/flights triggered when nextScanAt countdown reaches 0", () => {
  it("fires globalMutate for /api/flights when countdown reaches 0 (scan boundary)", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockStatusData = {
      airportIata: "DXB",
      scanIntervalSeconds: 1800,
      lastScanAt: null,
      nextScanAt: now + 2,
    };

    renderProvider();
    await act(async () => { await Promise.resolve(); });

    // Advance 3 seconds — countdown crosses 0
    await act(async () => { vi.advanceTimersByTime(3000); });

    expect(mockGlobalMutate).toHaveBeenCalledWith("/api/flights?airport=DXB");
  });

  it("does NOT fire a second scan-boundary call for the same nextScanAt value", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockStatusData = {
      airportIata: "DXB",
      scanIntervalSeconds: 1800,
      lastScanAt: null,
      nextScanAt: now + 1,
    };

    renderProvider();
    await act(async () => { await Promise.resolve(); });

    // Advance well past 0 — the scan fires once, not on every subsequent tick
    await act(async () => { vi.advanceTimersByTime(5000); });

    const flightsCalls = mockGlobalMutate.mock.calls.filter(
      (c) => typeof c[0] === "string" && c[0].includes("/api/flights")
    );
    expect(flightsCalls).toHaveLength(1);
  });
});

// ── Case 3: subscription upgrade (nextScanAt transitions future → 0) ──────────

describe("ScanContext — Case 3: GET /api/flights triggered after subscription upgrade", () => {
  it("fires when nextScanAt transitions from a future value to 0 within the same mount", async () => {
    const now = Math.floor(Date.now() / 1000);
    mockStatusData = {
      airportIata: "DXB",
      scanIntervalSeconds: 1800,
      lastScanAt: null,
      nextScanAt: now + 100,
    };

    const { rerender } = renderProvider();
    await act(async () => { await Promise.resolve(); });
    mockGlobalMutate.mockClear();

    // Advance 50 s — scan has NOT fired yet (nextScanAt still in future)
    await act(async () => { vi.advanceTimersByTime(50_000); });

    expect(mockGlobalMutate).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/flights")
    );

    // Simulate: admin upgrades subscription → monitor runs immediate scan →
    // sets next_scan_at = 0 → /api/scan-status SWR poll returns nextScanAt = 0.
    mockStatusData = {
      airportIata: "DXB",
      scanIntervalSeconds: 60,
      lastScanAt: null,
      nextScanAt: 0,
    };
    rerender(<ScanProvider><Consumer /></ScanProvider>);

    await act(async () => { await Promise.resolve(); });

    expect(mockGlobalMutate).toHaveBeenCalledWith("/api/flights?airport=DXB");
  });
});

// ── Should-NOT cases ──────────────────────────────────────────────────────────

describe("ScanContext — scan-boundary trigger MUST NOT fire in these cases", () => {
  it("does NOT fire on mount when nextScanAt is already 0 (page reload with stale timestamp)", async () => {
    mockStatusData = {
      airportIata: "DXB",
      scanIntervalSeconds: 1800,
      lastScanAt: null,
      nextScanAt: 0,
    };

    renderProvider();
    await act(async () => { await Promise.resolve(); });

    // Advance timers — countdown sits at 0 throughout; no scan trigger should fire
    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(mockGlobalMutate).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/flights")
    );
  });

  it("does NOT fire on remount with stale nextScanAt = 0 (logout then login simulation)", async () => {
    mockStatusData = {
      airportIata: "DXB",
      scanIntervalSeconds: 1800,
      lastScanAt: null,
      nextScanAt: 0,
    };

    const { unmount } = renderProvider();
    await act(async () => { await Promise.resolve(); });
    unmount();

    vi.clearAllMocks();

    // Re-login: remount
    renderProvider();
    await act(async () => { await Promise.resolve(); });

    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(mockGlobalMutate).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/flights")
    );
  });

  it("does NOT fire when a new device/tab mounts with nextScanAt = 0 (another-device simulation)", async () => {
    mockStatusData = {
      airportIata: "DXB",
      scanIntervalSeconds: 60,
      lastScanAt: null,
      nextScanAt: 0,
    };

    renderProvider();
    await act(async () => { await Promise.resolve(); });

    await act(async () => { vi.advanceTimersByTime(10_000); });

    expect(mockGlobalMutate).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/flights")
    );
  });
});
