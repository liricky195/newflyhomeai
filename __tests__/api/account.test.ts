/**
 * GET /api/account — returns subscription, airport, push status
 * File: __tests__/api/account.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockGetSubscriptionByUserId = vi.fn();
const mockGetMonitoredAirport = vi.fn();
const mockGetPushSubscriptionsByUserId = vi.fn();
const mockInitDb = vi.fn();
vi.mock("@/lib/db", () => ({
  initDb: (...a: unknown[]) => mockInitDb(...a),
  getSubscriptionByUserId: (...a: unknown[]) => mockGetSubscriptionByUserId(...a),
  getMonitoredAirport: (...a: unknown[]) => mockGetMonitoredAirport(...a),
  getPushSubscriptionsByUserId: (...a: unknown[]) => mockGetPushSubscriptionsByUserId(...a),
}));

import { getServerSession } from "next-auth";

const SESSION = { user: { id: "u1", email: "u1@test.com" }, expires: "" };

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION);
  mockInitDb.mockReturnValue(undefined);
  mockGetSubscriptionByUserId.mockReturnValue({
    tier: "pro",
    status: "active",
    scan_interval_seconds: 300,
    current_period_end: 1800000000,
    cancel_at_period_end: 0,
    stripe_subscription_id: "sub_123",
  });
  mockGetMonitoredAirport.mockReturnValue({
    airport_iata: "DXB",
    destination_iata: "LHR",
    travel_date_from: "2026-06-01",
    travel_date_to: "2026-06-30",
  });
  mockGetPushSubscriptionsByUserId.mockReturnValue([{ id: "ps1" }]);
});

describe("GET /api/account", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/account/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns full data for authenticated user with subscription and airport", async () => {
    const { GET } = await import("@/app/api/account/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.subscription.tier).toBe("pro");
    expect(json.subscription.hasActiveStripeSubscription).toBe(true);
    expect(json.monitoredAirport!.airportIata).toBe("DXB");
    expect(json.pushEnabled).toBe(true);
  });

  it("returns free tier defaults when no subscription", async () => {
    mockGetSubscriptionByUserId.mockReturnValueOnce(null);
    const { GET } = await import("@/app/api/account/route");
    const res = await GET();
    const json = await res.json();
    expect(json.subscription.tier).toBe("free");
    expect(json.subscription.status).toBe("active");
    expect(json.subscription.scanIntervalSeconds).toBe(1800);
    expect(json.subscription.hasActiveStripeSubscription).toBe(false);
  });

  it("returns monitoredAirport=null when no airport set", async () => {
    mockGetMonitoredAirport.mockReturnValueOnce(null);
    const { GET } = await import("@/app/api/account/route");
    const res = await GET();
    const json = await res.json();
    expect(json.monitoredAirport).toBeNull();
  });

  it("returns pushEnabled=false when no push subscriptions", async () => {
    mockGetPushSubscriptionsByUserId.mockReturnValueOnce([]);
    const { GET } = await import("@/app/api/account/route");
    const res = await GET();
    const json = await res.json();
    expect(json.pushEnabled).toBe(false);
  });

  it("cancel_at_period_end=1 is surfaced correctly", async () => {
    mockGetSubscriptionByUserId.mockReturnValueOnce({
      tier: "standard",
      status: "active",
      scan_interval_seconds: 600,
      current_period_end: 1800000000,
      cancel_at_period_end: 1,
      stripe_subscription_id: "sub_456",
    });
    const { GET } = await import("@/app/api/account/route");
    const res = await GET();
    const json = await res.json();
    expect(json.subscription.cancelAtPeriodEnd).toBe(1);
  });
});
