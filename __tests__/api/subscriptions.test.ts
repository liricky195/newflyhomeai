/**
 * 4M — POST /api/subscriptions
 * 4N — POST /api/subscriptions/proration
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// HARDENED IN STEP 10: mock rateLimit so existing tests are not rate-limited
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterMs: 0 }),
  resetRateLimitStore: vi.fn(),
}));

// HARDENED IN STEP 10: mock logger to suppress logRequest output in tests
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRequest: vi.fn() }));

// ── Mock next-auth ────────────────────────────────────────────────────────────

const mockGetServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────

const mockGetSubscriptionByUserId = vi.fn();
const mockInitDb = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  getSubscriptionByUserId: (...args: unknown[]) => mockGetSubscriptionByUserId(...args),
}));

// ── Mock Stripe lib ───────────────────────────────────────────────────────────

const mockCreateSubscriptionCheckout = vi.fn();
const mockCreatePortalSession = vi.fn();
const mockUpgradeSubscription = vi.fn();
const mockDowngradeSubscription = vi.fn();
const mockCancelSubscription = vi.fn();
const mockReactivateSubscription = vi.fn();
const mockGetProrationPreview = vi.fn();

vi.mock("@/lib/stripe", () => ({
  createSubscriptionCheckout: (...args: unknown[]) => mockCreateSubscriptionCheckout(...args),
  createPortalSession: (...args: unknown[]) => mockCreatePortalSession(...args),
  upgradeSubscription: (...args: unknown[]) => mockUpgradeSubscription(...args),
  downgradeSubscription: (...args: unknown[]) => mockDowngradeSubscription(...args),
  cancelSubscription: (...args: unknown[]) => mockCancelSubscription(...args),
  reactivateSubscription: (...args: unknown[]) => mockReactivateSubscription(...args),
  getProrationPreview: (...args: unknown[]) => mockGetProrationPreview(...args),
}));

import { POST, OPTIONS } from "@/app/api/subscriptions/route";
import { POST as prorationPOST } from "@/app/api/subscriptions/proration/route";

function makeReq(body: unknown, url = "http://localhost/api/subscriptions"): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSession(userId = "user-001") {
  return { user: { id: userId } };
}

function makeSubscription(overrides = {}) {
  return {
    id: "sub-1",
    user_id: "user-001",
    stripe_customer_id: "cus_123",
    stripe_subscription_id: "sub_stripe_123",
    tier: "standard",
    status: "active",
    scan_interval_seconds: 180,
    current_period_end: 1800000000,
    cancel_at_period_end: 0,
    created_at: 1000000,
    updated_at: 1000000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(makeSession());
  mockInitDb.mockReturnValue(undefined);
  vi.stubEnv("STRIPE_PRICE_STANDARD", "price_standard");
  vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
  vi.stubEnv("STRIPE_PRICE_ULTIMATE", "price_ultimate");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─────────────────────────────────────────────────────────────────────────────
// 4M — POST /api/subscriptions
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/subscriptions (4M)", () => {
  it("action='checkout', tier='standard' -> 200 with Stripe checkout URL; correct price ID used", async () => {
    mockCreateSubscriptionCheckout.mockResolvedValue("https://checkout.stripe.com/std");

    const res = await POST(makeReq({ action: "checkout", tier: "standard" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.stripe.com/std");
    expect(mockCreateSubscriptionCheckout).toHaveBeenCalledWith("user-001", "standard");
  });

  it("action='checkout', tier='pro' -> correct Pro price ID", async () => {
    mockCreateSubscriptionCheckout.mockResolvedValue("https://checkout.stripe.com/pro");

    const res = await POST(makeReq({ action: "checkout", tier: "pro" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toContain("stripe.com");
    expect(mockCreateSubscriptionCheckout).toHaveBeenCalledWith("user-001", "pro");
  });

  it("action='checkout', tier='ultimate' -> correct Ultimate price ID", async () => {
    mockCreateSubscriptionCheckout.mockResolvedValue("https://checkout.stripe.com/ult");

    const res = await POST(makeReq({ action: "checkout", tier: "ultimate" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockCreateSubscriptionCheckout).toHaveBeenCalledWith("user-001", "ultimate");
  });

  it("action='checkout', missing tier -> 400", async () => {
    const res = await POST(makeReq({ action: "checkout" }));
    expect(res.status).toBe(400);
    expect(mockCreateSubscriptionCheckout).not.toHaveBeenCalled();
  });

  it("action='portal' -> 200 with Stripe portal URL", async () => {
    mockGetSubscriptionByUserId.mockReturnValue(makeSubscription());
    mockCreatePortalSession.mockResolvedValue("https://billing.stripe.com/portal");

    const res = await POST(makeReq({ action: "portal" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://billing.stripe.com/portal");
  });

  it("action='portal', no stripe customer -> 400", async () => {
    mockGetSubscriptionByUserId.mockReturnValue({ ...makeSubscription(), stripe_customer_id: null });

    const res = await POST(makeReq({ action: "portal" }));
    expect(res.status).toBe(400);
  });

  it("Stripe throws on checkout -> 500", async () => {
    mockCreateSubscriptionCheckout.mockRejectedValue(new Error("Stripe error"));

    const res = await POST(makeReq({ action: "checkout", tier: "pro" }));
    expect(res.status).toBe(500);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makeReq({ action: "checkout", tier: "standard" }));
    expect(res.status).toBe(401);
  });

  it("action='upgrade' with no existing subscription -> falls back to checkout", async () => {
    mockGetSubscriptionByUserId.mockReturnValue({ ...makeSubscription(), stripe_subscription_id: null });
    mockCreateSubscriptionCheckout.mockResolvedValue("https://checkout.stripe.com/upgrade");

    const res = await POST(makeReq({ action: "upgrade", tier: "pro" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toContain("checkout.stripe.com");
  });

  it("action='upgrade' with active subscription -> calls upgradeSubscription", async () => {
    mockGetSubscriptionByUserId.mockReturnValue(makeSubscription());
    mockUpgradeSubscription.mockResolvedValue(undefined);

    const res = await POST(makeReq({ action: "upgrade", tier: "pro" }));
    expect(res.status).toBe(200);
    expect(mockUpgradeSubscription).toHaveBeenCalledWith("sub_stripe_123", "price_pro");
  });

  it("action='downgrade' with active subscription -> calls downgradeSubscription", async () => {
    mockGetSubscriptionByUserId.mockReturnValue(makeSubscription());
    mockDowngradeSubscription.mockResolvedValue(undefined);

    const res = await POST(makeReq({ action: "downgrade", tier: "standard" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockDowngradeSubscription).toHaveBeenCalledWith("sub_stripe_123", "price_standard");
  });

  it("action='cancel' with active subscription -> calls cancelSubscription", async () => {
    mockGetSubscriptionByUserId.mockReturnValue(makeSubscription());
    mockCancelSubscription.mockResolvedValue(undefined);

    const res = await POST(makeReq({ action: "cancel" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_stripe_123");
  });

  it("action='reactivate' with active subscription -> calls reactivateSubscription", async () => {
    mockGetSubscriptionByUserId.mockReturnValue(makeSubscription());
    mockReactivateSubscription.mockResolvedValue(undefined);

    const res = await POST(makeReq({ action: "reactivate" }));
    expect(res.status).toBe(200);
    expect(mockReactivateSubscription).toHaveBeenCalledWith("sub_stripe_123");
  });

  it("action='cancel' with no stripe subscription -> 400 no active subscription", async () => {
    mockGetSubscriptionByUserId.mockReturnValue({ ...makeSubscription(), stripe_subscription_id: null });

    const res = await POST(makeReq({ action: "cancel" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No active subscription");
  });

  it("invalid JSON body -> 400", async () => {
    const req = new NextRequest("http://localhost/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid JSON");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4N — POST /api/subscriptions/proration
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/subscriptions/proration (4N)", () => {
  function makeProrationReq(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/subscriptions/proration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("valid targetTier in body -> 200 with proration amounts", async () => {
    mockGetSubscriptionByUserId.mockReturnValue(makeSubscription());
    mockGetProrationPreview.mockResolvedValue({ amountDueCents: 1500, currency: "usd" });

    const res = await prorationPOST(makeProrationReq({ targetTier: "pro" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.amountDueCents).toBe(1500);
    expect(body.currency).toBe("usd");
  });

  it("missing targetTier -> 400", async () => {
    const res = await prorationPOST(makeProrationReq({}));
    expect(res.status).toBe(400);
  });

  it("invalid targetTier (free) -> 400", async () => {
    const res = await prorationPOST(makeProrationReq({ targetTier: "free" }));
    expect(res.status).toBe(400);
  });

  it("no current subscription -> 200 with zero proration", async () => {
    mockGetSubscriptionByUserId.mockReturnValue(null);

    const res = await prorationPOST(makeProrationReq({ targetTier: "standard" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.amountDueCents).toBe(0);
  });

  it("no stripe_subscription_id -> 200 with zero proration", async () => {
    mockGetSubscriptionByUserId.mockReturnValue({ ...makeSubscription(), stripe_subscription_id: null });

    const res = await prorationPOST(makeProrationReq({ targetTier: "pro" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.amountDueCents).toBe(0);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await prorationPOST(makeProrationReq({ targetTier: "standard" }));
    expect(res.status).toBe(401);
  });

  it("Stripe proration throws -> 500", async () => {
    mockGetSubscriptionByUserId.mockReturnValue(makeSubscription());
    mockGetProrationPreview.mockRejectedValue(new Error("Stripe error"));

    const res = await prorationPOST(makeProrationReq({ targetTier: "ultimate" }));
    expect(res.status).toBe(500);
  });
});

describe("OPTIONS /api/subscriptions (CORS preflight)", () => {
  it("returns 200 with CORS headers", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/subscriptions", { method: "OPTIONS", headers: { origin: "https://example.com" } });
    const res = await OPTIONS(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/subscriptions/proration — additional branches", () => {
  function makeProrationReq2(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/subscriptions/proration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("invalid JSON body -> 400", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost/api/subscriptions/proration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json",
    });
    const res = await prorationPOST(req);
    expect(res.status).toBe(400);
  });

  it("missing price env var for target tier -> 400", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    vi.unstubAllEnvs();
    // Don't stub STRIPE_PRICE_PRO so it's undefined
    const res = await prorationPOST(makeProrationReq2({ targetTier: "pro" }));
    expect(res.status).toBe(400);
    // Restore env vars for other tests
    vi.stubEnv("STRIPE_PRICE_STANDARD", "price_standard");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    vi.stubEnv("STRIPE_PRICE_ULTIMATE", "price_ultimate");
  });
});

describe("POST /api/subscriptions — getPriceId throws when env var missing", () => {
  it("upgrade action with missing price env var -> 500", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1" } });
    // Provide a subscription with stripe_subscription_id so the upgrade path is reached
    mockGetSubscriptionByUserId.mockReturnValueOnce({ stripe_subscription_id: "sub_123", stripe_customer_id: "cus_123" });
    vi.unstubAllEnvs();
    // No STRIPE_PRICE_PRO set → getPriceId throws

    const req = new NextRequest("http://localhost/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upgrade", tier: "pro" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);

    // Restore for other tests
    vi.stubEnv("STRIPE_PRICE_STANDARD", "price_standard");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    vi.stubEnv("STRIPE_PRICE_ULTIMATE", "price_ultimate");
  });
});
