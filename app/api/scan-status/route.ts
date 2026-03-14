import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getMonitoredAirport, getSubscriptionByUserId, setUserNextScanAt } from "@/lib/db";

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

    // Prefer the user's own user_next_scan_at row (written by initNextScanAt or the
    // monitor daemon). Only fall back to synthesis when it has never been set.
    let nextScanAt = airport?.user_next_scan_at ?? null;
    const now = Math.floor(Date.now() / 1000);

    // Debug logging to trace timer behavior
    console.log(`[scan-status] user=${session.user.id.slice(0, 8)}... nextScanAt=${nextScanAt} now=${now} diff=${nextScanAt ? nextScanAt - now : 'null'} interval=${scanIntervalSeconds}`);

    if (nextScanAt === null && airport) {
      // Use last_scanned_at (monitor) then last_scan_at (legacy) as the anchor,
      // defaulting to now so the countdown begins immediately for brand-new users.
      const anchor = airport.last_scanned_at ?? airport.last_scan_at ?? now;
      nextScanAt = anchor + scanIntervalSeconds;
      // If the synthesised time is already past, push it to now + interval
      // so the UI never shows a permanently-zero countdown.
      if (nextScanAt <= now) {
        nextScanAt = now + scanIntervalSeconds;
      }
      // Save the synthesized timestamp so it persists across page refreshes.
      // This ensures the countdown doesn't reset every time the user reloads.
      console.log(`[scan-status] Synthesizing new timestamp: ${nextScanAt} (anchor=${anchor})`);
      setUserNextScanAt(session.user.id, nextScanAt);
    } else if (nextScanAt !== null && nextScanAt <= now) {
      // Timestamp is in the past - re-synthesize based on user's own interval.
      // The monitor updates timestamps airport-wide, but users have different
      // subscription tiers with different intervals. Re-synthesizing prevents
      // the "Scanning forever" bug when the monitor hasn't updated yet.
      const anchor = airport?.last_scanned_at ?? airport?.last_scan_at ?? now;
      nextScanAt = anchor + scanIntervalSeconds;
      if (nextScanAt <= now) {
        nextScanAt = now + scanIntervalSeconds;
      }
      console.log(`[scan-status] Re-synthesizing past timestamp: ${nextScanAt} (anchor=${anchor})`);
      setUserNextScanAt(session.user.id, nextScanAt);
    }

    return NextResponse.json({
      airportIata: airport?.airport_iata ?? null,
      scanIntervalSeconds,
      lastScanAt: airport?.last_scan_at ?? null,
      nextScanAt,
    });
  } catch (err) {
    console.error(`[scan-status] Error:`, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
