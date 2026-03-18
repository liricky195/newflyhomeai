import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getMonitoredAirport, getSubscriptionByUserId, setUserNextScanAt } from "@/lib/db";
import { getScanInterval } from "@/lib/tierIntervals";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initDb();
    const airport = getMonitoredAirport(session.user.id);
    const sub = getSubscriptionByUserId(session.user.id);
    const scanIntervalSeconds = sub?.scan_interval_seconds ?? getScanInterval("free");

    // Prefer the user's own user_next_scan_at row (written by initNextScanAt or the
    // monitor daemon). Only fall back to synthesis when it has never been set.
    let nextScanAt = airport?.user_next_scan_at ?? null;
    const now = Math.floor(Date.now() / 1000);

    // Debug logging to trace timer behavior
    console.log(`[scan-status] user=${session.user.id.slice(0, 8)}... nextScanAt=${nextScanAt} now=${now} diff=${nextScanAt ? nextScanAt - now : 'null'} interval=${scanIntervalSeconds}`);

    if (nextScanAt === null && airport) {
      // Brand-new user (or just-reset airport): user_next_scan_at has never been
      // written by the monitor yet.  Synthesise a bootstrap value from the stable
      // DB anchor (last_scanned_at / last_scan_at) so the countdown starts
      // immediately instead of showing "Scanning…" forever.  We write this once
      // so that subsequent page refreshes read the stored value and honour elapsed
      // time rather than restarting from the full interval.
      const anchor = airport.last_scanned_at ?? airport.last_scan_at ?? now;
      nextScanAt = anchor + scanIntervalSeconds;
      if (nextScanAt <= now) {
        nextScanAt = now + scanIntervalSeconds;
      }
      console.log(`[scan-status] Bootstrap: writing nextScanAt=${nextScanAt} (anchor=${anchor})`);
      setUserNextScanAt(session.user.id, nextScanAt);
    } else if (nextScanAt !== null && nextScanAt <= now) {
      // The stored timestamp has expired — the monitor is either mid-scan or
      // about to run.  Compute a best-effort estimate for the UI countdown but
      // DO NOT write it to the DB.  All tabs and devices share the same
      // last_scanned_at anchor from the DB, so they independently arrive at the
      // same estimate without overwriting each other.  The monitor will write
      // the authoritative next value via updateScanTimestamps once it finishes.
      const anchor = airport?.last_scanned_at ?? airport?.last_scan_at ?? now;
      nextScanAt = anchor + scanIntervalSeconds;
      if (nextScanAt <= now) {
        nextScanAt = now + scanIntervalSeconds;
      }
      console.log(`[scan-status] Expired — estimate (not persisted): ${nextScanAt} (anchor=${anchor})`);
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
