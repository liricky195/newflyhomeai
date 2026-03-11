import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getMonitoredAirport, getSubscriptionByUserId, getNextScanAt } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initDb();
    const airport = getMonitoredAirport(session.user.id);
    const sub = getSubscriptionByUserId(session.user.id);
    const nextScanAt = airport ? getNextScanAt(airport.airport_iata) : null;

    return NextResponse.json({
      airportIata: airport?.airport_iata ?? null,
      scanIntervalSeconds: sub?.scan_interval_seconds ?? 1800,
      lastScanAt: airport?.last_scan_at ?? null,
      nextScanAt,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
