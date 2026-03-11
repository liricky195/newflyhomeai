import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getFlightById } from "@/lib/db";
import { searchOffers, ApiError } from "@/lib/duffel";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flightId = new URL(request.url).searchParams.get("flight_id");
  if (!flightId) {
    return NextResponse.json(
      { error: "Missing required query parameter: flight_id" },
      { status: 400 }
    );
  }

  try {
    initDb();
    const flight = getFlightById(flightId);
    if (!flight) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }

    const depDate = new Date(flight.scheduled_departure * 1000)
      .toISOString()
      .slice(0, 10);

    const offers = await searchOffers(
      flight.flight_number,
      depDate,
      flight.departure_airport,
      flight.destination_airport,
      [{ type: "adult" }]
    );

    return NextResponse.json({ offers });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.apiMessage },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
