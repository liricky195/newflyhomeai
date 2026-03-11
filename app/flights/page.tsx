export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { initDb, getMonitoredAirport } from "@/lib/db";
import FlightTable from "@/components/flights/FlightTable";
import PageTransition from "@/components/shared/PageTransition";

export default async function FlightsPage() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) redirect("/auth");

	initDb();
	const airport = getMonitoredAirport(session.user.id);
	if (!airport) redirect("/edit-details");
	return (
		<PageTransition>
		  <FlightTable
		    airportIata={airport.airport_iata}
		    destinationIata={airport.destination_iata ?? null}
		  />
		</PageTransition>
	);
}
