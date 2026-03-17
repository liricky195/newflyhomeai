import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getMonitoredAirport, getSubscriptionByUserId, getNotificationsByUserId } from "@/lib/db";
import { getScanInterval } from "@/lib/tierIntervals";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initDb();

  const userId = session.user.id;
  const airport = getMonitoredAirport(userId);

  if (!airport) {
    return NextResponse.json({ redirect: "/edit-details" });
  }

  const subscription = getSubscriptionByUserId(userId);
  const notifications = getNotificationsByUserId(userId);

  return NextResponse.json({
    airport: {
      iata: airport.airport_iata,
      destination_iata: airport.destination_iata,
      active: airport.active,
      last_scan_at: airport.last_scan_at ?? null,
    },
    subscription: {
      tier: subscription?.tier ?? "free",
      scan_interval_seconds: subscription?.scan_interval_seconds ?? getScanInterval("free"),
      status: subscription?.status ?? "active",
    },
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      sent_at: n.sent_at,
      read_at: n.read_at,
    })),
  });
}
