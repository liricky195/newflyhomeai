import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { initDb, getAllBookingsWithUsersAndFlights } from "@/lib/db";

// Future extension point: add ?limit=&offset= query params for pagination

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-role check on every request — never rely solely on middleware or page guards
  if (!isAdmin(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    initDb();
    const bookings = getAllBookingsWithUsersAndFlights();
    return NextResponse.json(
      { bookings },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
