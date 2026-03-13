import Stripe from "stripe";
import {
  initDb,
  updateStripeSubscriptionTier,
  resetSubscriptionToFree,
  setCancelAtPeriodEnd,
  linkStripeCustomer,
  type SubscriptionTier,
} from "./db";
import { getScanInterval } from "./tierIntervals";
import { log } from "./logger";

// ─── Stripe client ───────────────────────────────────────────────────────────

// HARDENED IN STEP 10: startup assertions
export function assertStripeEnvVars(): void {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is required. Obtain from your Stripe dashboard (Developers → API keys)."
    );
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required. Obtain from your Stripe dashboard (Developers → Webhooks)."
    );
  }
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is required. Obtain from your Stripe dashboard (Developers → API keys)."
    );
  }
  return new Stripe(key, { apiVersion: "2024-04-10" as Stripe.LatestApiVersion });
}

// ─── Price ID → tier mapping ─────────────────────────────────────────────────

const PRICE_TIER_MAP: Record<string, { tier: SubscriptionTier }> = {};

function ensurePriceMap(): void {
  const std = process.env.STRIPE_PRICE_STANDARD;
  const pro = process.env.STRIPE_PRICE_PRO;
  const ult = process.env.STRIPE_PRICE_ULTIMATE;
  if (std) PRICE_TIER_MAP[std] = { tier: "standard" };
  if (pro) PRICE_TIER_MAP[pro] = { tier: "pro" };
  if (ult) PRICE_TIER_MAP[ult] = { tier: "ultimate" };
}

// ─── Subscription checkout ───────────────────────────────────────────────────

const TIER_PRICE_ENV: Record<string, string> = {
  standard: "STRIPE_PRICE_STANDARD",
  pro: "STRIPE_PRICE_PRO",
  ultimate: "STRIPE_PRICE_ULTIMATE",
};

export async function createSubscriptionCheckout(
  userId: string,
  tier: "standard" | "pro" | "ultimate"
): Promise<string> {
  const stripe = getStripe();
  const envVar = TIER_PRICE_ENV[tier];
  const priceRef = process.env[envVar];
  if (!priceRef) throw new Error(`${envVar} is not set`);

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";

  // If the env var is a price_... ID use it directly; otherwise treat it as a
  // dollar amount and build an inline price so no pre-created Stripe product is needed.
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = priceRef.startsWith("price_")
    ? { price: priceRef, quantity: 1 }
    : {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(parseFloat(priceRef) * 100),
          recurring: { interval: "week" },
          product_data: {
            name: `flyhome.ai ${tier.charAt(0).toUpperCase() + tier.slice(1)}`,
          },
        },
        quantity: 1,
      };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [lineItem],
    success_url: `${baseUrl}/plans?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/plans`,
    metadata: { userId, tier },
    subscription_data: {
      metadata: { userId, tier },
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

// ─── Customer portal ─────────────────────────────────────────────────────────

export async function createPortalSession(
  stripeCustomerId: string
): Promise<string> {
  const stripe = getStripe();
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3001";

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${baseUrl}/plans`,
  });

  return session.url;
}

// ─── Subscription lifecycle ──────────────────────────────────────────────────

export async function upgradeSubscription(
  stripeSubscriptionId: string,
  newPriceId: string
): Promise<void> {
  const stripe = getStripe();
  ensurePriceMap();

  const existing = await stripe.subscriptions
    .retrieve(stripeSubscriptionId)
    .catch(rethrowIfNotSubscriptionMissing);
  const itemId = existing.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no items");

  const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: "always_invoice",
    billing_cycle_anchor: "unchanged",
  });

  const customerId =
    typeof updated.customer === "string" ? updated.customer : updated.customer.id;
  const mapped = PRICE_TIER_MAP[newPriceId];
  if (!mapped) throw new Error(`No tier mapping for price ${newPriceId}`);
  const periodEnd =
    (updated as unknown as { current_period_end?: number }).current_period_end ?? null;

  initDb();
  updateStripeSubscriptionTier({
    stripe_customer_id: customerId,
    tier: mapped.tier,
    status: "active",
    stripe_subscription_id: updated.id,
    current_period_end: periodEnd,
  });
}

export async function downgradeSubscription(
  stripeSubscriptionId: string,
  newPriceId: string
): Promise<void> {
  const stripe = getStripe();

  const existing = await stripe.subscriptions
    .retrieve(stripeSubscriptionId)
    .catch(rethrowIfNotSubscriptionMissing);
  const itemId = existing.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no items");

  // DB is intentionally NOT updated here — the invoice.paid webhook finalises
  // the tier change at the start of the next billing period.
  await stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: "none",
    billing_cycle_anchor: "unchanged",
  });
}

function rethrowIfNotSubscriptionMissing(err: unknown): never {
  const stripeErr = err as { code?: string; message?: string };
  if (stripeErr?.code === "resource_missing") {
    throw new Error(
      "Subscription not found in Stripe — it may have been manually seeded for testing. " +
      "Use the Stripe Dashboard or CLI to create a real test subscription."
    );
  }
  throw err;
}

export async function cancelSubscription(
  stripeSubscriptionId: string
): Promise<void> {
  const stripe = getStripe();

  const updated = await stripe.subscriptions
    .update(stripeSubscriptionId, { cancel_at_period_end: true })
    .catch(rethrowIfNotSubscriptionMissing);

  const customerId =
    typeof updated.customer === "string" ? updated.customer : updated.customer.id;

  initDb();
  setCancelAtPeriodEnd(customerId, 1);
}

export async function reactivateSubscription(
  stripeSubscriptionId: string
): Promise<void> {
  const stripe = getStripe();

  const updated = await stripe.subscriptions
    .update(stripeSubscriptionId, { cancel_at_period_end: false })
    .catch(rethrowIfNotSubscriptionMissing);

  const customerId =
    typeof updated.customer === "string" ? updated.customer : updated.customer.id;

  initDb();
  setCancelAtPeriodEnd(customerId, 0);
}

export async function getProrationPreview(
  stripeSubscriptionId: string,
  newPriceId: string
): Promise<{ amountDueCents: number; currency: string }> {
  const stripe = getStripe();

  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no items");

  const upcoming = await stripe.invoices.createPreview({
    customer: customerId,
    subscription: stripeSubscriptionId,
    subscription_details: {
      items: [{ id: itemId, price: newPriceId }],
      proration_date: Math.floor(Date.now() / 1000),
    },
  });

  return { amountDueCents: upcoming.amount_due, currency: upcoming.currency };
}

// ─── Webhook handler ─────────────────────────────────────────────────────────

// HARDENED IN STEP 10 (1F): accepts string | Buffer — route uses request.text()
export async function handleWebhook(
  rawBody: string | Buffer,
  signature: string
): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  initDb();
  ensurePriceMap();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode !== "subscription") break;

      // ── Subscription checkout ────────────────────────────────────────────
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id;

      if (!customerId) break;

      // Link the Stripe customer ID to the user's subscription row so that
      // updateStripeSubscriptionTier (which looks up by stripe_customer_id) can
      // find the row. New users have stripe_customer_id = NULL until this point.
      const userId = session.metadata?.userId;
      if (userId) {
        linkStripeCustomer(userId, customerId);
      }

      // Retrieve subscription to get the price ID
      const sub = subscriptionId
        ? await stripe.subscriptions.retrieve(subscriptionId)
        : null;
      const priceId = sub?.items.data[0]?.price.id;
      const mapped = priceId ? PRICE_TIER_MAP[priceId] : undefined;
      const tier: SubscriptionTier =
        mapped?.tier ??
        ((session.metadata?.tier ?? "standard") as SubscriptionTier);

      const periodEnd = (sub as unknown as { current_period_end?: number })?.current_period_end ?? null;

      updateStripeSubscriptionTier({
        stripe_customer_id: customerId,
        tier,
        status: "active",
        stripe_subscription_id: subscriptionId ?? null,
        current_period_end: periodEnd,
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const priceId = sub.items.data[0]?.price.id;
      const mapped = priceId ? PRICE_TIER_MAP[priceId] : undefined;
      const tier: SubscriptionTier =
        mapped?.tier ??
        ((sub.metadata?.tier ?? "standard") as SubscriptionTier);
      const subPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? null;

      updateStripeSubscriptionTier({
        stripe_customer_id: customerId,
        tier,
        status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled",
        stripe_subscription_id: sub.id,
        current_period_end: subPeriodEnd,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      resetSubscriptionToFree(customerId);
      break;
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      // In Stripe SDK v20 the subscription reference lives on inv.parent.
      const invParent = inv.parent as unknown as {
        type?: string;
        subscription_details?: { subscription?: string | Stripe.Subscription };
      } | null;
      const subscriptionRef = invParent?.subscription_details?.subscription;
      const subscriptionId =
        typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id;
      // Only process subscription invoices — skip one-time charges.
      if (!subscriptionId) break;

      const customerId =
        typeof inv.customer === "string"
          ? inv.customer
          : (inv.customer as Stripe.Customer | null)?.id;
      if (!customerId) break;

      // Price lives on InvoiceLineItem.pricing.price in SDK v20.
      const lineItem = inv.lines.data[0];
      const linePrice = (lineItem as unknown as { pricing?: { price?: string | Stripe.Price } })
        ?.pricing?.price;
      const priceId = typeof linePrice === "string" ? linePrice : linePrice?.id;

      ensurePriceMap();
      const mapped = priceId ? PRICE_TIER_MAP[priceId] : undefined;
      // If the price isn't one of our known tiers, skip (e.g. one-time add-ons).
      if (!mapped) break;

      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const periodEnd =
        (sub as unknown as { current_period_end?: number }).current_period_end ?? null;
      updateStripeSubscriptionTier({
        stripe_customer_id: customerId,
        tier: mapped.tier,
        status: "active",
        stripe_subscription_id: sub.id,
        current_period_end: periodEnd,
      });
      break;
    }

    default: {
      log("info", "stripe", `Unhandled event type: ${event.type}`);
      break;
    }
  }
}
