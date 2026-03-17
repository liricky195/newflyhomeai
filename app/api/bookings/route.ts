import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { initDb, getBookingsWithFlightsByUserId } from "@/lib/db";
import { log, logRequest } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit";
import { corsHeaders } from "@/lib/cors";

// ─── Zod schema ──────────────────────────────────────────────────────────────

const PostBookingSchema = z.object({
  flightId: z.string().min(1),
});

// ─── OPTIONS /api/bookings (CORS preflight) ───────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(origin),
  });
}

// ─── POST /api/bookings ───────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startMs = Date.now();
  const origin = request.headers.get("origin");

  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 401, durationMs);
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  // 2. Rate limiting — 5 requests per 60 s per user
  const rl = rateLimit("bookings_post:" + session.user.id, 5, 60_000);
  if (!rl.allowed) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 429, durationMs, session.user.id);
    return NextResponse.json(
      {
        error: "Too many booking requests. Please wait before trying again.",
        retryAfterMs: rl.retryAfterMs,
      },
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

  // 3. Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 400, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const parsed = PostBookingSchema.safeParse(body);
  if (!parsed.success) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 400, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const { flightId } = parsed.data;

  initDb();

  // 4. Look up flight to get route and departure date
  const { getDb } = await import("@/lib/db");
  const flightRow = getDb()
    .prepare<
      [string],
      {
        id: string;
        departure_airport: string;
        destination_airport: string;
        scheduled_departure: number;
      }
    >(
      "SELECT id, departure_airport, destination_airport, scheduled_departure FROM flights WHERE id = ?"
    )
    .get(flightId);

  if (!flightRow) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 404, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Flight not found" },
      { status: 404, headers: corsHeaders(origin) }
    );
  }

  // 5. Verify flight belongs to the user's monitored airport
  const userAirport = getDb()
    .prepare<[string], { airport_iata: string }>(
      "SELECT airport_iata FROM monitored_airports WHERE user_id = ? AND active = 1 LIMIT 1"
    )
    .get(session.user.id);

  if (!userAirport || userAirport.airport_iata !== flightRow.departure_airport) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 403, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Flight does not belong to your monitored airport" },
      { status: 403, headers: corsHeaders(origin) }
    );
  }

  // 6. Build Google Flights URL
  const departureDate = new Date(flightRow.scheduled_departure * 1000)
    .toISOString()
    .slice(0, 10);
  const checkoutUrl = `https://www.google.com/travel/flights?q=One-way+Flights+from+${flightRow.departure_airport}+to+${flightRow.destination_airport}+on+${departureDate}`;

  const durationMs = Date.now() - startMs;
  logRequest("POST", "/api/bookings", 200, durationMs, session.user.id);
  log("info", "bookings", "Google Flights redirect", {
    userId: session.user.id,
    flightId,
    checkoutUrl,
  });

  return NextResponse.json(
    { checkoutUrl },
    { headers: corsHeaders(origin) }
  );
}

// ─── GET /api/bookings ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startMs = Date.now();
  const origin = request?.headers?.get("origin") ?? null;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/bookings", 401, durationMs);
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders(origin) }
    );
  }

  try {
    initDb();
    const bookings = getBookingsWithFlightsByUserId(session.user.id);
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/bookings", 200, durationMs, session.user.id);
    return NextResponse.json(
      {
        bookings: bookings.map((b) => ({
          ...b,
          total_amount: b.duffel_total ?? null,
          total_currency: b.total_currency ?? null,
          cancellation_pending: b.cancellation_pending ?? 0,
          confirm_fetch_failed: b.confirm_fetch_failed ?? 0,
        })),
      },
      { headers: corsHeaders(origin) }
    );
  } catch (err) {
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/bookings", 500, durationMs, session.user.id);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}
