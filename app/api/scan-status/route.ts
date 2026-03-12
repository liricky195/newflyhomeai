import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getMonitoredAirport, getSubscriptionByUserId } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initDb();
    const airport = getMonitoredAirport(session.user.id);
    const sub = getSubscriptionByUserId(session.user.id);
    const scanIntervalSeconds = sub?.scan_interval_seconds ?? 1800;

    // Prefer the user's own next_scan_at row (written by initNextScanAt or the
    // monitor daemon). Only fall back to synthesis when it has never been set.
    let nextScanAt = airport?.next_scan_at ?? null;

    if (nextScanAt === null && airport) {
      const now = Math.floor(Date.now() / 1000);
      // Use last_scanned_at (monitor) then last_scan_at (legacy) as the anchor,
      // defaulting to now so the countdown begins immediately for brand-new users.
      const anchor = airport.last_scanned_at ?? airport.last_scan_at ?? now;
      nextScanAt = anchor + scanIntervalSeconds;
      // If the synthesised time is already past, push it to now + interval
      // so the UI never shows a permanently-zero countdown.
      if (nextScanAt <= now) {
        nextScanAt = now + scanIntervalSeconds;
      }
    }

    return NextResponse.json({
      airportIata: airport?.airport_iata ?? null,
      scanIntervalSeconds,
      lastScanAt: airport?.last_scan_at ?? null,
      nextScanAt,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
