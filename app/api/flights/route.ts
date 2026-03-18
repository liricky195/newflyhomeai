import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  initDb,
  getFlightsByAirport as getCachedFlights,
  getNextScanAt,
  purgeStaleFlights,
} from "@/lib/db";
import { logRequest } from "@/lib/logger"; // HARDENED IN STEP 10
import { corsHeaders } from "@/lib/cors"; // HARDENED IN STEP 10

// This route is intentionally read-only. All AeroDataBox scanning and
// bookability checks are performed exclusively by the monitor.ts daemon
// on the server-side interval. No client action (navigation, refresh,
// URL manipulation) can ever trigger a live scan from here.

// HARDENED IN STEP 10: OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, { status: 200, headers: corsHeaders(origin) });
}

export async function GET(request: NextRequest) {
  const startMs = Date.now(); // HARDENED IN STEP 10: request duration tracking
  const origin = request.headers.get("origin");

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/flights", 401, durationMs);
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  const { searchParams } = new URL(request.url);
  const airport = searchParams.get("airport");

  if (!airport) {
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/flights", 400, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Missing required query parameter: airport" },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  if (!/^[A-Z]{3,4}$/.test(airport)) {
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/flights", 400, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Invalid airport IATA code (must be 3-4 uppercase letters)" },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  try {
    initDb();

    // Purge departed flights before reading so clients never see stale rows.
    purgeStaleFlights(airport);

    const flights = getCachedFlights(airport, ["scheduled", "active"]);
    // user_next_scan_at is owned exclusively by the monitor daemon (updateScanTimestamps)
    // and the monitored-airports setup route. This route must never write it — doing so
    // would reset the countdown on every page refresh and desync multiple tabs/devices.
    const nextScanAt = getNextScanAt(airport, session.user.id);

    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/flights", 200, durationMs, session.user.id);
    return NextResponse.json(
      { flights, nextScanAt },
      { headers: corsHeaders(origin) }
    );
  } catch (err) {
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/flights", 500, durationMs, session.user.id);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
