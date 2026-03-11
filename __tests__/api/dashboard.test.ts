/**
 * GET /api/dashboard — aggregate data for dashboard page
 * File: __tests__/api/dashboard.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockGetMonitoredAirport = vi.fn();
const mockGetSubscriptionByUserId = vi.fn();
const mockGetNotificationsByUserId = vi.fn();
const mockInitDb = vi.fn();
vi.mock("@/lib/db", () => ({
  initDb: (...a: unknown[]) => mockInitDb(...a),
  getMonitoredAirport: (...a: unknown[]) => mockGetMonitoredAirport(...a),
  getSubscriptionByUserId: (...a: unknown[]) => mockGetSubscriptionByUserId(...a),
  getNotificationsByUserId: (...a: unknown[]) => mockGetNotificationsByUserId(...a),
}));

import { getServerSession } from "next-auth";

const SESSION = { user: { id: "u1", email: "u1@test.com" }, expires: "" };

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION);
  mockInitDb.mockReturnValue(undefined);
  mockGetMonitoredAirport.mockReturnValue({
    airport_iata: "DXB",
    destination_iata: "LHR",
    travel_date_from: "2026-06-01",
    travel_date_to: "2026-06-30",
    active: 1,
    last_scan_at: 1700000000,
  });
  mockGetSubscriptionByUserId.mockReturnValue({
    tier: "standard",
    scan_interval_seconds: 600,
    status: "active",
  });
  mockGetNotificationsByUserId.mockReturnValue([
    { id: "n1", type: "new_flight", title: "New flight!", body: "EK101", sent_at: 1700000000, read_at: null },
  ]);
});

describe("GET /api/dashboard", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns airport, subscription, notifications for authenticated user", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.airport.iata).toBe("DXB");
    expect(json.subscription.tier).toBe("standard");
    expect(json.notifications).toHaveLength(1);
    expect(json.notifications[0].id).toBe("n1");
  });

  it("redirects to /edit-details when no airport set", async () => {
    mockGetMonitoredAirport.mockReturnValueOnce(null);
    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.redirect).toBe("/edit-details");
  });

  it("returns last_scan_at from airport row", async () => {
    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const json = await res.json();
    expect(json.airport.last_scan_at).toBe(1700000000);
  });

  it("returns last_scan_at=null when field is null", async () => {
    mockGetMonitoredAirport.mockReturnValueOnce({
      airport_iata: "DXB",
      destination_iata: "LHR",
      travel_date_from: "2026-06-01",
      travel_date_to: "2026-06-30",
      active: 1,
      last_scan_at: null,
    });
    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const json = await res.json();
    expect(json.airport.last_scan_at).toBeNull();
  });

  it("uses free tier defaults when no subscription row", async () => {
    mockGetSubscriptionByUserId.mockReturnValueOnce(null);
    const { GET } = await import("@/app/api/dashboard/route");
    const res = await GET();
    const json = await res.json();
    expect(json.subscription.tier).toBe("free");
    expect(json.subscription.scan_interval_seconds).toBe(1800);
    expect(json.subscription.status).toBe("active");
  });
});
