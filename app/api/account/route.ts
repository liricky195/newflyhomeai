import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  initDb,
  getSubscriptionByUserId,
  getMonitoredAirport,
  getPushSubscriptionsByUserId,
  deleteUser,
} from "@/lib/db";
import { cancelSubscription } from "@/lib/stripe";
import { logRequest } from "@/lib/logger";
import { corsHeaders } from "@/lib/cors";

export async function GET(request: NextRequest) {
  const startMs = Date.now();
  const origin = request.headers.get("origin");
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/account", 401, durationMs);
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  initDb();
  const userId = session.user.id;

  const sub = getSubscriptionByUserId(userId);
  const airport = getMonitoredAirport(userId);
  const pushSubs = getPushSubscriptionsByUserId(userId);

  const durationMs = Date.now() - startMs;
  logRequest("GET", "/api/account", 200, durationMs, userId);

  return NextResponse.json({
    subscription: sub
      ? {
          tier: sub.tier,
          status: sub.status,
          scanIntervalSeconds: sub.scan_interval_seconds,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          hasActiveStripeSubscription: !!sub.stripe_subscription_id,
        }
      : {
          tier: "free" as const,
          status: "active" as const,
          scanIntervalSeconds: 1800,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: 0,
          hasActiveStripeSubscription: false,
        },
    monitoredAirport: airport
      ? {
          airportIata: airport.airport_iata,
          destinationIata: airport.destination_iata,
          travelDateFrom: airport.travel_date_from,
          travelDateTo: airport.travel_date_to,
        }
      : null,
    pushEnabled: pushSubs.length > 0,
  }, { headers: corsHeaders(origin) });
}

export async function DELETE(request: NextRequest) {
  const startMs = Date.now();
  const origin = request.headers.get("origin");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const durationMs = Date.now() - startMs;
    logRequest("DELETE", "/api/account", 401, durationMs);
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  try {
    initDb();
    const userId = session.user.id;

    // 1. Check for active Stripe subscription and cancel if exists
    const sub = getSubscriptionByUserId(userId);
    if (sub?.stripe_subscription_id && sub.status === "active") {
      try {
        await cancelSubscription(sub.stripe_subscription_id);
      } catch (err) {
        console.error("[delete-account] Stripe cancellation failed:", err);
      }
    }

    // 2. Delete user from DB (CASCADE handles dependent tables)
    deleteUser(userId);

    const durationMs = Date.now() - startMs;
    logRequest("DELETE", "/api/account", 200, durationMs, userId);

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders(origin) }
    );
  } catch (err) {
    const durationMs = Date.now() - startMs;
    logRequest("DELETE", "/api/account", 500, durationMs, session.user.id);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
