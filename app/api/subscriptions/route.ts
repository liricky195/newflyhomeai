import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { initDb, getSubscriptionByUserId, initNextScanAt } from "@/lib/db";
import { getScanInterval } from "@/lib/tierIntervals";
import {
  createSubscriptionCheckout,
  createPortalSession,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
} from "@/lib/stripe";
import { logRequest } from "@/lib/logger"; // HARDENED IN STEP 10
import { rateLimit } from "@/lib/rateLimit"; // HARDENED IN STEP 10
import { corsHeaders } from "@/lib/cors"; // HARDENED IN STEP 10

const TIER_PRICE_ENV: Record<string, string> = {
  standard: "STRIPE_PRICE_STANDARD",
  pro: "STRIPE_PRICE_PRO",
  ultimate: "STRIPE_PRICE_ULTIMATE",
};

function getPriceId(tier: string): string {
  const envVar = TIER_PRICE_ENV[tier];
  const priceId = process.env[envVar];
  if (!priceId) throw new Error(`${envVar} is not set`);
  return priceId;
}

const ActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("checkout"),
    tier: z.enum(["standard", "pro", "ultimate"]),
  }),
  z.object({ action: z.literal("portal") }),
  z.object({
    action: z.literal("upgrade"),
    tier: z.enum(["standard", "pro", "ultimate"]),
  }),
  z.object({
    action: z.literal("downgrade"),
    tier: z.enum(["standard", "pro", "ultimate"]),
  }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("reactivate") }),
]);

// HARDENED IN STEP 10: OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 200, headers: corsHeaders(origin) });
}

export async function POST(request: NextRequest) {
  const startMs = Date.now(); // HARDENED IN STEP 10: request duration tracking
  const origin = request.headers.get("origin");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/subscriptions", 401, durationMs);
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  // HARDENED IN STEP 10: rate limiting — 5 requests per 60 s per user
  const rl = rateLimit("subscriptions_post:" + session.user.id, 5, 60_000);
  if (!rl.allowed) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/subscriptions", 429, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Too many requests." },
      {
        status: 429,
        headers: {
          ...corsHeaders(origin),
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/subscriptions", 400, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/subscriptions", 400, durationMs, session.user.id);
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  try {
    initDb();

    if (parsed.data.action === "checkout") {
      const url = await createSubscriptionCheckout(
        session.user.id,
        parsed.data.tier
      );
      const durationMs = Date.now() - startMs;
      logRequest("POST", "/api/subscriptions", 200, durationMs, session.user.id);
      return NextResponse.json({ url }, { headers: corsHeaders(origin) });
    }

    if (parsed.data.action === "portal") {
      const sub = getSubscriptionByUserId(session.user.id);
      if (!sub?.stripe_customer_id) {
        const durationMs = Date.now() - startMs;
        logRequest("POST", "/api/subscriptions", 400, durationMs, session.user.id);
        return NextResponse.json(
          { error: "No active Stripe subscription found" },
          { status: 400, headers: corsHeaders(origin) }
        );
      }
      const url = await createPortalSession(sub.stripe_customer_id);
      const durationMs = Date.now() - startMs;
      logRequest("POST", "/api/subscriptions", 200, durationMs, session.user.id);
      return NextResponse.json({ url }, { headers: corsHeaders(origin) });
    }

    // All remaining actions require an active Stripe subscription.
    const sub = getSubscriptionByUserId(session.user.id);
    if (!sub?.stripe_subscription_id) {
      // upgrade with no existing subscription → fall through to checkout flow
      if (parsed.data.action === "upgrade") {
        const url = await createSubscriptionCheckout(
          session.user.id,
          parsed.data.tier
        );
        const durationMs = Date.now() - startMs;
        logRequest("POST", "/api/subscriptions", 200, durationMs, session.user.id);
        return NextResponse.json({ url }, { headers: corsHeaders(origin) });
      }
      const durationMs = Date.now() - startMs;
      logRequest("POST", "/api/subscriptions", 400, durationMs, session.user.id);
      return NextResponse.json(
        { error: "No active subscription" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    if (parsed.data.action === "upgrade") {
      const priceId = getPriceId(parsed.data.tier);
      await upgradeSubscription(sub.stripe_subscription_id, priceId);
      // Reset the scan countdown to the new tier's interval immediately so the
      // UI reflects the upgrade without waiting for the next monitor poll.
      initNextScanAt(session.user.id, getScanInterval(parsed.data.tier));
      const durationMs = Date.now() - startMs;
      logRequest("POST", "/api/subscriptions", 200, durationMs, session.user.id);
      return NextResponse.json({ success: true }, { headers: corsHeaders(origin) });
    }

    if (parsed.data.action === "downgrade") {
      const priceId = getPriceId(parsed.data.tier);
      await downgradeSubscription(sub.stripe_subscription_id, priceId);
      const durationMs = Date.now() - startMs;
      logRequest("POST", "/api/subscriptions", 200, durationMs, session.user.id);
      return NextResponse.json(
        { success: true, effectiveDate: sub.current_period_end },
        { headers: corsHeaders(origin) }
      );
    }

    if (parsed.data.action === "cancel") {
      await cancelSubscription(sub.stripe_subscription_id);
      const durationMs = Date.now() - startMs;
      logRequest("POST", "/api/subscriptions", 200, durationMs, session.user.id);
      return NextResponse.json(
        { success: true, accessUntil: sub.current_period_end },
        { headers: corsHeaders(origin) }
      );
    }

    // reactivate
    await reactivateSubscription(sub.stripe_subscription_id);
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/subscriptions", 200, durationMs, session.user.id);
    return NextResponse.json({ success: true }, { headers: corsHeaders(origin) });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/subscriptions", 500, durationMs, session.user.id);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
