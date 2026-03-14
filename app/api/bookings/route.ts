import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";
import {
  initDb,
  getBookingsWithFlightsByUserId,
  createPendingBookingForDuffel,
  deletePendingBooking,
} from "@/lib/db";
import { createDuffelLink, ApiError } from "@/lib/duffel";
import { log, logRequest } from "@/lib/logger";
import { rateLimit } from "@/lib/rateLimit"; // HARDENED IN STEP 10: rate limiting
import { corsHeaders } from "@/lib/cors"; // HARDENED IN STEP 10: CORS

// ─── Zod schema ──────────────────────────────────────────────────────────────

const PostBookingSchema = z.object({
  offerId: z.string().min(1),
  flightId: z.string().min(1),
  given_name: z.string().min(1),
  family_name: z.string().min(1),
  born_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "born_on must be in YYYY-MM-DD format")
    .refine((v) => new Date(v) <= new Date(), { message: "born_on must be in the past" }),
  passport_number: z.string().min(1),
  nationality: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, "nationality must be a 2-letter uppercase ISO code"),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "phone must be E.164 format")
    .optional(),
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
  const startMs = Date.now(); // HARDENED IN STEP 10: request duration tracking
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

  // 2. HARDENED IN STEP 10: rate limiting — 5 requests per 60 s per user
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

  const {
    offerId,
    flightId,
    given_name,
    family_name,
    born_on,
    passport_number,
    nationality,
    phone,
  } = parsed.data;

  initDb();

  // 4. Flight ownership check
  const { getDb } = await import("@/lib/db");
  const flightRow = getDb()
    .prepare<[string], { id: string; departure_airport: string }>(
      "SELECT id, departure_airport FROM flights WHERE id = ?"
    )
    .get(flightId);

  if (!flightRow) {
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 403, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Flight does not belong to your monitored airport" },
      { status: 403, headers: corsHeaders(origin) }
    );
  }

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

  // 5. Insert pending booking row
  const internalReference = crypto.randomUUID();
  let pendingBooking;
  try {
    pendingBooking = createPendingBookingForDuffel({
      id: crypto.randomUUID(),
      user_id: session.user.id,
      flight_id: flightId,
      duffel_offer_id: offerId,
      internal_reference: internalReference,
      passenger_details: JSON.stringify({
        given_name,
        family_name,
        born_on,
        passport_number,
        nationality,
        phone,
      }),
    });
  } catch (err) {
    log("error", "bookings", "DB insert failed for pending booking", { err: String(err) });
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 500, durationMs, session.user.id);
    return NextResponse.json(
      { error: "Failed to create booking record" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }

  // 6. Create Duffel Link for the booking
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const successUrl = `${baseUrl}/bookings/confirm?ref=${pendingBooking.internal_reference}`;
  const abandonUrl = `${baseUrl}/flights`;

  try {
    const link = await createDuffelLink({
      offerId,
      reference: pendingBooking.internal_reference ?? internalReference,
      successUrl,
      abandonUrl,
    });
    const durationMs = Date.now() - startMs;
    logRequest("POST", "/api/bookings", 200, durationMs, session.user.id);
    return NextResponse.json(
      { checkoutUrl: link.url, bookingId: pendingBooking.id },
      { headers: corsHeaders(origin) }
    );
  } catch (err) {
    console.log(err);
    try {
      deletePendingBooking(pendingBooking.id);
    } catch (deleteErr) {
      log("error", "bookings", "Failed to delete orphaned booking", { err: String(deleteErr) });
    }
    const message = err instanceof ApiError ? err.apiMessage : (err as Error).message;
    const durationMs = Date.now() - startMs;

    // Special handling for offer expiry (404 Not Found)
    if (err instanceof ApiError && err.httpStatus === 404) {
      logRequest("POST", "/api/bookings", 400, durationMs, session.user.id);
      return NextResponse.json(
        { error: "This flight offer has expired. Please go back and select the flight again." },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    logRequest("POST", "/api/bookings", 502, durationMs, session.user.id);
    return NextResponse.json(
      { error: message },
      { status: 502, headers: corsHeaders(origin) }
    );
  }
}

// ─── GET /api/bookings ────────────────────────────────────────────────────────

export async function GET(request?: NextRequest) {
  const startMs = Date.now(); // HARDENED IN STEP 10
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
