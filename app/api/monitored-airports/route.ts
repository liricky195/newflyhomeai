import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getMonitoredAirport, setMonitoredAirport, setAirportLastScanAt, getSubscriptionByUserId, initNextScanAt, deactivateOtherAirports, setUserPersonalDetails, getUserPersonalDetails, flagAirportForImmediateScan, setNextScanAtImmediate } from "@/lib/db";
import { getScanInterval } from "@/lib/tierIntervals";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { UserPersonalDetails } from "@/lib/db";

function toUnix(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime();
  return isNaN(ms) ? null : Math.floor(ms / 1000);
}

const MonitoredAirportSchema = z
  .object({
    airport_iata: z.string().regex(/^[A-Z]{3,4}$/).optional(),
    destination_iata: z.string().length(3).regex(/^[A-Z]{3}$/).optional().nullable(),
    travel_date_from: z.number().int().positive().optional().nullable(),
    travel_date_to: z.number().int().positive().optional().nullable(),
    max_price_usd: z.number().int().positive().optional().nullable(),
    personal_details: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .refine(
    (data) =>
      data.travel_date_from == null ||
      data.travel_date_to == null ||
      data.travel_date_to >= data.travel_date_from,
    { message: "travel_date_to must be >= travel_date_from" }
  );

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  initDb();
  const userId = session.user.id;
  const airport = getMonitoredAirport(userId);
  const personal = getUserPersonalDetails(userId);

  return NextResponse.json({
    airport: airport
      ? {
          airport_iata: airport.airport_iata,
          destination_iata: airport.destination_iata ?? null,
          travel_date_from: airport.travel_date_from
            ? new Date(airport.travel_date_from * 1000).toISOString().slice(0, 10)
            : null,
          travel_date_to: airport.travel_date_to
            ? new Date(airport.travel_date_to * 1000).toISOString().slice(0, 10)
            : null,
          max_price_usd: airport.max_price_usd ?? null,
        }
      : null,
    personal: personal ?? null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = MonitoredAirportSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { airport_iata, destination_iata, travel_date_from, travel_date_to, max_price_usd, personal_details } = parsed.data;

  try {
    initDb();

    const existing = getMonitoredAirport(session.user.id);

    // One-airport-per-account enforcement: if a row exists and the new code differs, reject
    if (airport_iata && existing && existing.airport_iata !== airport_iata) {
      return NextResponse.json(
        { error: "Your stranded airport cannot be changed. Contact support if this is incorrect." },
        { status: 403 }
      );
    }

    // If airport_iata is provided (first-time setup), create/update the airport row
    if (airport_iata) {
      const previousLastScanAt = existing?.last_scan_at ?? null;
      const isFirstSet = !existing;

      setMonitoredAirport({
        id: crypto.randomUUID(),
        user_id: session.user.id,
        airport_iata,
        destination_iata: destination_iata ?? null,
        travel_date_from: typeof travel_date_from === "number" ? travel_date_from : null,
        travel_date_to: typeof travel_date_to === "number" ? travel_date_to : null,
        active: 1,
        max_price_usd: max_price_usd ?? null,
      });
      deactivateOtherAirports(session.user.id, airport_iata);

      if (previousLastScanAt) {
        setAirportLastScanAt(session.user.id, airport_iata, previousLastScanAt);
      }
      const sub = getSubscriptionByUserId(session.user.id);
      const scanInterval = sub?.scan_interval_seconds ?? getScanInterval("free");
      initNextScanAt(session.user.id, scanInterval);

      // Give the client an immediate non-null nextScanAt so the countdown
      // starts at once instead of showing "Scanning…". The monitor will
      // overwrite this with the real next_scan_at once the priority poll
      // completes (usually within ~5 s).
      setNextScanAtImmediate(session.user.id);

      // First time this user sets an airport (or re-sets after an admin reset):
      // signal the monitor to scan immediately rather than waiting for the next tick.
      if (isFirstSet) {
        flagAirportForImmediateScan(session.user.id);
      }
    } else if (existing) {
      // airport_iata not sent — update destination/dates only on existing row
      setMonitoredAirport({
        id: crypto.randomUUID(),
        user_id: session.user.id,
        airport_iata: existing.airport_iata,
        destination_iata: destination_iata !== undefined ? (destination_iata ?? null) : existing.destination_iata,
        travel_date_from: travel_date_from !== undefined ? (typeof travel_date_from === "number" ? travel_date_from : null) : existing.travel_date_from,
        travel_date_to: travel_date_to !== undefined ? (typeof travel_date_to === "number" ? travel_date_to : null) : existing.travel_date_to,
        active: 1,
        max_price_usd: max_price_usd !== undefined ? (max_price_usd ?? null) : existing.max_price_usd,
      });

      // If user is updating their filters (destination, dates, or price), trigger an immediate scan
      // to show them the new results without waiting for their tier timer.
      flagAirportForImmediateScan(session.user.id);
    }

    if (personal_details && typeof personal_details === "object") {
      const pd = personal_details as Partial<UserPersonalDetails>;
      setUserPersonalDetails(session.user.id, {
        full_name: pd.full_name ?? null,
        date_of_birth: pd.date_of_birth ?? null,
        passport_number: pd.passport_number ?? null,
        passport_expiry: pd.passport_expiry ?? null,
        nationality: pd.nationality ?? null,
        phone: pd.phone ?? null,
      });
    }

    revalidatePath("/flights");
    revalidatePath("/dashboard");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
