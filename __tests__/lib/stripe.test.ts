import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Stripe SDK ──────────────────────────────────────────────────────────

const mockCheckoutSessionCreate = vi.fn();
const mockPortalSessionCreate = vi.fn();
const mockRefundCreate = vi.fn();
const mockSubscriptionRetrieve = vi.fn();
const mockSubscriptionUpdate = vi.fn();
const mockWebhookConstructEvent = vi.fn();
const mockInvoicesCreatePreview = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: { create: mockCheckoutSessionCreate },
      },
      billingPortal: {
        sessions: { create: mockPortalSessionCreate },
      },
      refunds: { create: mockRefundCreate },
      subscriptions: {
        retrieve: mockSubscriptionRetrieve,
        update: mockSubscriptionUpdate,
      },
      invoices: { createPreview: mockInvoicesCreatePreview },
      webhooks: { constructEvent: mockWebhookConstructEvent },
    })),
  };
});

// ── Mock DB functions ────────────────────────────────────────────────────────

vi.mock("@/lib/db", () => ({
  initDb: vi.fn(),
  updateStripeSubscriptionTier: vi.fn(),
  resetSubscriptionToFree: vi.fn(),
  setCancelAtPeriodEnd: vi.fn(),
}));

import {
  createSubscriptionCheckout,
  createPortalSession,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  getProrationPreview,
  handleWebhook,
} from "@/lib/stripe";
import {
  updateStripeSubscriptionTier,
  resetSubscriptionToFree,
  setCancelAtPeriodEnd,
} from "@/lib/db";

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("STRIPE_PRICE_STANDARD", "price_standard");
  vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
  vi.stubEnv("STRIPE_PRICE_ULTIMATE", "price_ultimate");
  vi.stubEnv("NEXTAUTH_URL", "http://localhost:3001");
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── createSubscriptionCheckout ───────────────────────────────────────────────

describe("createSubscriptionCheckout", () => {
  it("creates session in subscription mode", async () => {
    mockCheckoutSessionCreate.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/session_123",
    });

    const url = await createSubscriptionCheckout("user_1", "pro");

    expect(url).toBe("https://checkout.stripe.com/session_123");
    expect(mockCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_pro", quantity: 1 }],
      })
    );
  });
});

// ── createPortalSession ──────────────────────────────────────────────────────

describe("createPortalSession", () => {
  it("returns portal URL", async () => {
    mockPortalSessionCreate.mockResolvedValueOnce({
      url: "https://billing.stripe.com/portal_123",
    });

    const url = await createPortalSession("cus_123");
    expect(url).toBe("https://billing.stripe.com/portal_123");
  });
});

// ── handleWebhook ────────────────────────────────────────────────────────────

describe("handleWebhook", () => {
  it("throws on invalid signature before any DB write", async () => {
    mockWebhookConstructEvent.mockImplementation(() => {
      throw new Error("Webhook signature verification failed");
    });

    await expect(
      handleWebhook(Buffer.from("{}"), "invalid_sig")
    ).rejects.toThrow("Webhook signature verification failed");

    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("checkout.session.completed updates subscription tier", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_123",
          subscription: "sub_123",
        },
      },
    });

    mockSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ price: { id: "price_pro" } }] },
      current_period_end: 1700000000,
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: "cus_123",
        tier: "pro",
        status: "active",
      })
    );
  });

  it("customer.subscription.deleted resets to free tier", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: {
        object: { customer: "cus_456" },
      },
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(resetSubscriptionToFree).toHaveBeenCalledWith("cus_456");
  });

  it("customer.subscription.updated updates tier", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_999",
          customer: "cus_789",
          status: "active",
          items: { data: [{ price: { id: "price_standard" } }] },
          metadata: {},
        },
      },
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: "cus_789",
        tier: "standard",
        status: "active",
      })
    );
  });

  // 5K: payment_intent.succeeded after deletion — must log and return 200, not crash
  it("payment_intent.succeeded is received — logs event type and does not crash (5K)", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_789",
          metadata: { userId: "u1", flightId: "f1", offerId: "off_1" },
        },
      },
    });

    // Should not throw
    await expect(handleWebhook(Buffer.from("{}"), "valid_sig")).resolves.toBeUndefined();

    // fulfillFlightBooking no longer exists — Stripe refund must not be called
    expect(mockRefundCreate).not.toHaveBeenCalled();

    stdoutSpy.mockRestore();
  });

  it("payment_intent.payment_failed is received — returns without crashing (5K)", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "payment_intent.payment_failed",
      data: {
        object: { id: "pi_bad" },
      },
    });

    await expect(handleWebhook(Buffer.from("{}"), "valid_sig")).resolves.toBeUndefined();
    expect(mockRefundCreate).not.toHaveBeenCalled();
  });

  it("unknown event type logs and returns without crashing", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "some.unknown.event",
      data: { object: {} },
    });

    await expect(handleWebhook(Buffer.from("{}"), "valid_sig")).resolves.toBeUndefined();

    // Logger writes to process.stdout for info-level messages
    const writtenOutput = stdoutSpy.mock.calls.map((c) => String(c[0])).join("");
    expect(writtenOutput).toContain("some.unknown.event");
    stdoutSpy.mockRestore();
  });

  // ── 5L: Regression — all paths that set free tier write scan_interval_seconds=1800 ──

  it("5L: customer.subscription.deleted: resetSubscriptionToFree called with correct customerId", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: {
        object: { customer: "cus_del_456" },
      },
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(resetSubscriptionToFree).toHaveBeenCalledWith("cus_del_456");
  });

  it("5L: checkout.session.completed (Standard): updateStripeSubscriptionTier called with tier=standard", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_std",
          subscription: "sub_std",
        },
      },
    });

    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_std",
      items: { data: [{ price: { id: "price_standard" } }] },
      current_period_end: 1700000000,
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "standard" })
    );
  });

  it("5L: checkout.session.completed (Pro): updateStripeSubscriptionTier called with tier=pro", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_pro",
          subscription: "sub_pro",
        },
      },
    });

    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_pro",
      items: { data: [{ price: { id: "price_pro" } }] },
      current_period_end: 1700000000,
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "pro" })
    );
  });

  it("5L: checkout.session.completed (Ultimate): updateStripeSubscriptionTier called with tier=ultimate", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_ult",
          subscription: "sub_ult",
        },
      },
    });

    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_ult",
      items: { data: [{ price: { id: "price_ultimate" } }] },
      current_period_end: 1700000000,
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "ultimate" })
    );
  });

  it("invoice.paid with known price → updates tier", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_inv",
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_inv" },
          },
          lines: {
            data: [{ pricing: { price: "price_standard" } }],
          },
        },
      },
    });
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_inv",
      items: { data: [{ price: { id: "price_standard" } }] },
      current_period_end: 1900000000,
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "standard", stripe_customer_id: "cus_inv" })
    );
  });

  it("invoice.paid with unknown price → skips (no DB write)", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_inv",
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_inv" },
          },
          lines: {
            data: [{ pricing: { price: "price_unknown_tier" } }],
          },
        },
      },
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("invoice.paid with no subscription → skips", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_inv",
          parent: null,
          lines: { data: [] },
        },
      },
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("customer.subscription.updated with past_due status → saves past_due", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_past_due",
          customer: "cus_past_due",
          status: "past_due",
          items: { data: [{ price: { id: "price_standard" } }] },
          metadata: {},
          current_period_end: 1700000000,
        },
      },
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ status: "past_due" })
    );
  });

  it("checkout.session.completed with non-subscription mode → skips", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          customer: "cus_payment",
          subscription: null,
        },
      },
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("checkout.session.completed with no customer → skips", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: null,
          subscription: null,
        },
      },
    });

    await handleWebhook(Buffer.from("{}"), "valid_sig");

    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });
});

// ── upgradeSubscription ──────────────────────────────────────────────────────

describe("upgradeSubscription", () => {
  it("retrieves subscription, updates price, writes to DB", async () => {
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [{ id: "item_1", price: { id: "price_standard" } }] },
      current_period_end: 1900000000,
    });
    mockSubscriptionUpdate.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [{ id: "item_1", price: { id: "price_pro" } }] },
      current_period_end: 1900000000,
    });

    await upgradeSubscription("sub_123", "price_pro");

    expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_123", expect.objectContaining({
      items: [{ id: "item_1", price: "price_pro" }],
      proration_behavior: "always_invoice",
    }));
    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "pro", stripe_customer_id: "cus_123" })
    );
  });

  it("throws resource_missing error with helpful message", async () => {
    const err = Object.assign(new Error("Not found"), { code: "resource_missing" });
    mockSubscriptionRetrieve.mockRejectedValueOnce(err);
    await expect(upgradeSubscription("sub_gone", "price_pro")).rejects.toThrow("Subscription not found");
  });

  it("throws if subscription has no items", async () => {
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_empty",
      customer: "cus_123",
      items: { data: [] },
    });
    await expect(upgradeSubscription("sub_empty", "price_pro")).rejects.toThrow("no items");
  });

  it("throws if new price has no tier mapping", async () => {
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [{ id: "item_1", price: { id: "price_standard" } }] },
    });
    mockSubscriptionUpdate.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [{ id: "item_1", price: { id: "price_unmapped" } }] },
    });
    await expect(upgradeSubscription("sub_123", "price_unmapped")).rejects.toThrow("No tier mapping");
  });
});

// ── downgradeSubscription ────────────────────────────────────────────────────

describe("downgradeSubscription", () => {
  it("retrieves subscription, updates price with no proration", async () => {
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [{ id: "item_1", price: { id: "price_pro" } }] },
    });
    mockSubscriptionUpdate.mockResolvedValueOnce({ id: "sub_123", customer: "cus_123" });

    await downgradeSubscription("sub_123", "price_standard");

    expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_123", expect.objectContaining({
      items: [{ id: "item_1", price: "price_standard" }],
      proration_behavior: "none",
    }));
    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("throws if subscription has no items", async () => {
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [] },
    });
    await expect(downgradeSubscription("sub_123", "price_standard")).rejects.toThrow("no items");
  });
});

// ── cancelSubscription ───────────────────────────────────────────────────────

describe("cancelSubscription", () => {
  it("sets cancel_at_period_end=true and writes to DB", async () => {
    mockSubscriptionUpdate.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
    });

    await cancelSubscription("sub_123");

    expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_123", { cancel_at_period_end: true });
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("cus_123", 1);
  });

  it("throws with helpful message when subscription is missing", async () => {
    const err = Object.assign(new Error("Not found"), { code: "resource_missing" });
    mockSubscriptionUpdate.mockRejectedValueOnce(err);
    await expect(cancelSubscription("sub_gone")).rejects.toThrow("Subscription not found");
  });
});

// ── reactivateSubscription ───────────────────────────────────────────────────

describe("reactivateSubscription", () => {
  it("sets cancel_at_period_end=false and writes to DB", async () => {
    mockSubscriptionUpdate.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
    });

    await reactivateSubscription("sub_123");

    expect(mockSubscriptionUpdate).toHaveBeenCalledWith("sub_123", { cancel_at_period_end: false });
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("cus_123", 0);
  });
});

// ── getProrationPreview ──────────────────────────────────────────────────────

describe("getProrationPreview", () => {
  it("returns amountDueCents and currency from Stripe preview", async () => {
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [{ id: "item_1", price: { id: "price_standard" } }] },
    });
    mockInvoicesCreatePreview.mockResolvedValueOnce({
      amount_due: 2500,
      currency: "gbp",
    });

    const result = await getProrationPreview("sub_123", "price_pro");
    expect(result.amountDueCents).toBe(2500);
    expect(result.currency).toBe("gbp");
  });

  it("throws if subscription has no items", async () => {
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_123",
      customer: "cus_123",
      items: { data: [] },
    });
    await expect(getProrationPreview("sub_123", "price_pro")).rejects.toThrow("no items");
  });
});

// ── Additional webhook branch coverage ──────────────────────────────────────

describe("handleWebhook — additional branch coverage", () => {
  it("checkout.session.completed: customer/subscription as objects (not strings)", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: { id: "cus_obj_123" },
          subscription: { id: "sub_obj_123" },
        },
      },
    });
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      items: { data: [{ price: { id: "price_pro" } }] },
      current_period_end: 1700000000,
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: "cus_obj_123" })
    );
  });

  it("checkout.session.completed: session.mode !== subscription — no DB write", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: { object: { mode: "payment", customer: "cus_pay" } },
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("checkout.session.completed: no customerId — breaks without DB write", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: { object: { mode: "subscription", customer: null, subscription: null } },
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("checkout.session.completed: no subscriptionId — uses tier from metadata", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          customer: "cus_no_sub",
          subscription: null,
          metadata: { tier: "pro", userId: "u1" },
        },
      },
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: "cus_no_sub", tier: "pro" })
    );
  });

  it("customer.subscription.updated: object customer, past_due status", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_pd",
          customer: { id: "cus_past_due" },
          status: "past_due",
          items: { data: [{ price: { id: "price_standard" } }] },
          metadata: {},
        },
      },
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: "cus_past_due", status: "past_due" })
    );
  });

  it("customer.subscription.updated: canceled status maps to 'canceled'", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_can",
          customer: "cus_canceled",
          status: "canceled",
          items: { data: [{ price: { id: "price_standard" } }] },
          metadata: {},
        },
      },
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: "cus_canceled", status: "canceled" })
    );
  });

  it("customer.subscription.deleted: object customer", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: { object: { customer: { id: "cus_obj_del" } } },
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(resetSubscriptionToFree).toHaveBeenCalledWith("cus_obj_del");
  });

  it("invoice.paid: null parent subscription — skips DB write", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_inv",
          parent: null,
          lines: { data: [] },
        },
      },
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("invoice.paid: null customer — skips DB write", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "invoice.paid",
      data: {
        object: {
          customer: null,
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_inv_2" },
          },
          lines: { data: [{ pricing: { price: "price_pro" } }] },
        },
      },
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("invoice.paid: unknown price — skips DB write", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_inv_3",
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: "sub_inv_3" },
          },
          lines: { data: [{ pricing: { price: "price_unknown" } }] },
        },
      },
    });
    mockSubscriptionRetrieve.mockResolvedValueOnce({ id: "sub_inv_3", current_period_end: 1700000000 });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).not.toHaveBeenCalled();
  });

  it("invoice.paid: object subscription reference and object customer", async () => {
    mockWebhookConstructEvent.mockReturnValueOnce({
      type: "invoice.paid",
      data: {
        object: {
          customer: { id: "cus_inv_obj" },
          parent: {
            type: "subscription_details",
            subscription_details: { subscription: { id: "sub_inv_obj" } },
          },
          lines: { data: [{ pricing: { price: "price_pro" } }] },
        },
      },
    });
    mockSubscriptionRetrieve.mockResolvedValueOnce({
      id: "sub_inv_obj",
      current_period_end: 1700000000,
    });
    await handleWebhook(Buffer.from("{}"), "valid_sig");
    expect(updateStripeSubscriptionTier).toHaveBeenCalledWith(
      expect.objectContaining({ stripe_customer_id: "cus_inv_obj" })
    );
  });
});

// ── cancelSubscription — object customer branch ──────────────────────────────
describe("cancelSubscription — object customer", () => {
  it("uses customer.id when customer is an object", async () => {
    mockSubscriptionUpdate.mockResolvedValueOnce({
      id: "sub_obj",
      customer: { id: "cus_obj" },
    });
    await cancelSubscription("sub_obj");
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("cus_obj", 1);
  });
});

// ── reactivateSubscription — object customer branch ───────────────────────────
describe("reactivateSubscription — object customer", () => {
  it("uses customer.id when customer is an object", async () => {
    mockSubscriptionUpdate.mockResolvedValueOnce({
      id: "sub_react_obj",
      customer: { id: "cus_react_obj" },
    });
    await reactivateSubscription("sub_react_obj");
    expect(setCancelAtPeriodEnd).toHaveBeenCalledWith("cus_react_obj", 0);
  });
});
