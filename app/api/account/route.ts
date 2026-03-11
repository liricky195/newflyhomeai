import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  initDb,
  getSubscriptionByUserId,
  getMonitoredAirport,
  getPushSubscriptionsByUserId,
} from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initDb();
  const userId = session.user.id;

  const sub = getSubscriptionByUserId(userId);
  const airport = getMonitoredAirport(userId);
  const pushSubs = getPushSubscriptionsByUserId(userId);

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
  });
}
