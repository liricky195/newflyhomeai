/**
 * GET /api/scan-status — returns current scan status for user's airport
 * File: __tests__/api/scan-status.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockGetMonitoredAirport = vi.fn();
const mockGetSubscriptionByUserId = vi.fn();
const mockGetNextScanAt = vi.fn();
const mockInitDb = vi.fn();
vi.mock("@/lib/db", () => ({
  initDb: (...a: unknown[]) => mockInitDb(...a),
  getMonitoredAirport: (...a: unknown[]) => mockGetMonitoredAirport(...a),
  getSubscriptionByUserId: (...a: unknown[]) => mockGetSubscriptionByUserId(...a),
  getNextScanAt: (...a: unknown[]) => mockGetNextScanAt(...a),
}));

import { getServerSession } from "next-auth";

const SESSION = { user: { id: "u1", email: "u1@test.com" }, expires: "" };

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION);
  mockInitDb.mockReturnValue(undefined);
  mockGetMonitoredAirport.mockReturnValue({ airport_iata: "DXB", last_scan_at: 1700000000 });
  mockGetSubscriptionByUserId.mockReturnValue({ scan_interval_seconds: 600 });
  mockGetNextScanAt.mockReturnValue(1700000600);
});

describe("GET /api/scan-status", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/scan-status/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns airport, scan interval and next scan time for authenticated user", async () => {
    const { GET } = await import("@/app/api/scan-status/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.airportIata).toBe("DXB");
    expect(json.scanIntervalSeconds).toBe(600);
    expect(json.nextScanAt).toBe(1700000600);
    expect(json.lastScanAt).toBe(1700000000);
  });

  it("returns null airport and default interval when no airport or subscription", async () => {
    mockGetMonitoredAirport.mockReturnValueOnce(null);
    mockGetSubscriptionByUserId.mockReturnValueOnce(null);
    const { GET } = await import("@/app/api/scan-status/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.airportIata).toBeNull();
    expect(json.scanIntervalSeconds).toBe(1800);
    expect(json.nextScanAt).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockGetMonitoredAirport.mockImplementationOnce(() => { throw new Error("oops"); });
    const { GET } = await import("@/app/api/scan-status/route");
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
