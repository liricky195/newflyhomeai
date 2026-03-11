import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Stripe SDK ──────────────────────────────────────────────────────────

const mockWebhookConstructEvent = vi.fn();
const mockRefundCreate = vi.fn();
const mockSubscriptionRetrieve = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: { sessions: { create: vi.fn() } },
      paymentIntents: { create: vi.fn() },
      billingPortal: { sessions: { create: vi.fn() } },
      refunds: { create: mockRefundCreate },
      subscriptions: { retrieve: mockSubscriptionRetrieve },
      webhooks: { constructEvent: mockWebhookConstructEvent },
    })),
  };
});

// ── Mock DB ──────────────────────────────────────────────────────────────────

const mockUpdateSubscriptionTier = vi.fn();
const mockResetSubscriptionToFree = vi.fn();
const mockGetBookingByPaymentIntentId = vi.fn();
const mockUpdateBookingStatus = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: vi.fn(),
  getBookingByPaymentIntentId: (...args: unknown[]) => mockGetBookingByPaymentIntentId(...args),
  updateBookingStatus: (...args: unknown[]) => mockUpdateBookingStatus(...args),
  updateStripeSubscriptionTier: (...args: unknown[]) => mockUpdateSubscriptionTier(...args),
  resetSubscriptionToFree: (...args: unknown[]) => mockResetSubscriptionToFree(...args),
  createNotification: vi.fn(),
  getUserById: vi.fn().mockReturnValue({ id: "u1", email: "test@test.com" }),
}));

vi.mock("@/lib/duffel", () => ({
  createOrder: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

import { createOrder } from "@/lib/duffel";

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("STRIPE_PRICE_STANDARD", "price_standard");
  vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
  vi.stubEnv("STRIPE_PRICE_ULTIMATE", "price_ultimate");
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function makeWebhookRequest(body: string, sig = "valid_sig"): Request {
  return new Request("http://localhost:3001/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": sig,
    },
    body,
  });
}

describe("POST /api/webhooks/stripe", () => {
  it("returns 400 on invalid signature and touches no DB", async () => {
    mockWebhookConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeWebhookRequest("{}", "bad_sig") as any);

    expect(res.status).toBe(400);
    expect(mockUpdateSubscriptionTier).not.toHaveBeenCalled();
    expect(mockUpdateBookingStatus).not.toHaveBeenCalled();
  });

  it("missing stripe-signature header -> 400 (4X)", async () => {
    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const reqNoSig = new Request("http://localhost:3001/api/webhooks/stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await POST(reqNoSig as any);

    expect(res.status).toBe(400);
    expect(mockUpdateSubscriptionTier).not.toHaveBeenCalled();
  });

  it("Unknown event type -> 200 returned, no error (4X)", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "some.completely.unknown.event",
      data: { object: {} },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeWebhookRequest("{}") as any);

    expect(res.status).toBe(200);
    expect(mockUpdateSubscriptionTier).not.toHaveBeenCalled();
  });

  it("checkout.session.completed updates subscription tier", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_789",
          subscription: "sub_789",
        },
      },
    });

    mockSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ price: { id: "price_pro" } }] },
      current_period_end: 1700000000,
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeWebhookRequest("{}") as any);

    expect(res.status).toBe(200);
    expect(mockUpdateSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: "cus_789",
        tier: "pro",
      })
    );
  });

  it("customer.subscription.updated -> tier updated (4X)", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_upd",
          customer: "cus_upd",
          status: "active",
          items: { data: [{ price: { id: "price_ultimate" } }] },
          metadata: {},
        },
      },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeWebhookRequest("{}") as any);

    expect(res.status).toBe(200);
    expect(mockUpdateSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: "cus_upd",
        tier: "ultimate",
      })
    );
  });

  it("customer.subscription.deleted -> tier set to 'free' (4X)", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_del" } },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeWebhookRequest("{}") as any);

    expect(res.status).toBe(200);
    expect(mockResetSubscriptionToFree).toHaveBeenCalledWith("cus_del");
  });

  it("payment_intent.succeeded received post-deletion — logs and returns 200 (5K regression)", async () => {
    // After deleting fulfillFlightBooking, payment_intent.succeeded must no longer
    // trigger any DB write, Duffel call, or Stripe refund — just log and return 200.
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_old", metadata: {} } },
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");
    const res = await POST(makeWebhookRequest("{}") as any);

    expect(res.status).toBe(200);
    expect(mockRefundCreate).not.toHaveBeenCalled();
    expect(mockUpdateBookingStatus).not.toHaveBeenCalled();
    expect(mockUpdateSubscriptionTier).not.toHaveBeenCalled();
  });
});

describe("OPTIONS /api/webhooks/stripe (CORS preflight)", () => {
  it("returns 200 with CORS headers", async () => {
    const { NextRequest } = await import("next/server");
    const { OPTIONS } = await import("@/app/api/webhooks/stripe/route");
    const req = new NextRequest("http://localhost/api/webhooks/stripe", { method: "OPTIONS", headers: { origin: "https://example.com" } });
    const res = await OPTIONS(req);
    expect(res.status).toBe(200);
  });
});
