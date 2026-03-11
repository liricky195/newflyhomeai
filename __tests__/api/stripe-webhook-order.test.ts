/**
 * 4F — Webhook signature first-operation guarantee
 * Verifies that constructEvent is called before any DB functions,
 * and that DB functions are only called when constructEvent succeeds.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Stripe ───────────────────────────────────────────────────────────────
const mockConstructEvent = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { retrieve: vi.fn() },
    invoices: { createPreview: vi.fn() },
  })),
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────
const mockInitDb = vi.fn();
const mockUpdateStripeSubscriptionTier = vi.fn();
const mockResetSubscriptionToFree = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: (...a: unknown[]) => mockInitDb(...a),
  updateStripeSubscriptionTier: (...a: unknown[]) => mockUpdateStripeSubscriptionTier(...a),
  resetSubscriptionToFree: (...a: unknown[]) => mockResetSubscriptionToFree(...a),
  setCancelAtPeriodEnd: vi.fn(),
  getBookingByPaymentIntentId: vi.fn(),
  updateBookingStatus: vi.fn(),
  createNotification: vi.fn(),
  getUserById: vi.fn(),
}));

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock("@/lib/logger", () => ({ log: vi.fn(), logRequest: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder");
  vi.stubEnv("STRIPE_PRICE_STANDARD", "price_std");
  vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
  vi.stubEnv("STRIPE_PRICE_ULTIMATE", "price_ult");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeWebhookRequest(body = "{}", sig = "valid_sig") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": sig,
    },
    body,
  });
}

describe("Stripe webhook order (4F)", () => {
  it("constructEvent throws → no DB function called", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("Webhook signature verification failed");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeWebhookRequest() as any);

    expect(res.status).toBe(400);
    // constructEvent threw — no DB functions should have been called
    expect(mockInitDb).not.toHaveBeenCalled();
    expect(mockUpdateStripeSubscriptionTier).not.toHaveBeenCalled();
    expect(mockResetSubscriptionToFree).not.toHaveBeenCalled();
  });

  it("constructEvent succeeds → initDb called after", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_test",
          id: "sub_test",
          items: { data: [{ price: { id: "price_std" } }] },
          status: "canceled",
        },
      },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    await POST(makeWebhookRequest() as any);

    // constructEvent succeeded → DB functions should be called
    expect(mockInitDb).toHaveBeenCalled();
    expect(mockResetSubscriptionToFree).toHaveBeenCalledWith("cus_test");
  });

  it("constructEvent is the first operation after reading raw body (order guarantee)", async () => {
    const callOrder: string[] = [];

    mockConstructEvent.mockImplementationOnce(() => {
      callOrder.push("constructEvent");
      throw new Error("Invalid signature");
    });
    mockInitDb.mockImplementationOnce(() => {
      callOrder.push("initDb");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    await POST(makeWebhookRequest() as any);

    // constructEvent should appear first (before initDb)
    expect(callOrder[0]).toBe("constructEvent");
    expect(callOrder).not.toContain("initDb");
  });

  it("missing stripe-signature header → 400 before constructEvent is called", async () => {
    const req = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(req as any);

    expect(res.status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
    expect(mockInitDb).not.toHaveBeenCalled();
  });
});
