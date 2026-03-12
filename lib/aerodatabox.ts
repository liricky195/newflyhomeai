import type { DbFlight, FlightStatus } from "./db";

let lastRequestTime = 0;
const MIN_DELAY_MS = 2000;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ─────────────────────────────────────────────────────────────────────────────
// AeroDataBox raw response types (matches OpenAPI AirportFlightContract)
// ─────────────────────────────────────────────────────────────────────────────

interface DateTimeContract {
  utc: string;
  local: string;
}

interface ListingAirport {
  icao?: string | null;
  iata?: string | null;
  name: string;
}

interface FlightAirportMovement {
  airport?: ListingAirport | null; // absent on some AeroDataBox responses
  scheduledTime?: DateTimeContract | null;
  revisedTime?: DateTimeContract | null;
  terminal?: string | null;
  gate?: string | null;
  quality: string[];
}

interface FlightAircraft {
  reg?: string | null;
  modeS?: string | null;
  model?: string | null;
}

interface FlightAirline {
  name: string;
  iata?: string | null;
  icao?: string | null;
}

type AeroDataBoxFlightStatus =
  | "Unknown"
  | "Expected"
  | "EnRoute"
  | "CheckIn"
  | "Boarding"
  | "GateClosed"
  | "Departed"
  | "Delayed"
  | "Approaching"
  | "Arrived"
  | "Canceled"
  | "Diverted"
  | "CanceledUncertain";

export interface RawAeroDataBoxFlight {
  number: string;
  callSign?: string | null;
  status: AeroDataBoxFlightStatus;
  codeshareStatus: string;
  isCargo: boolean;
  movement?: FlightAirportMovement;
  departure?: FlightAirportMovement;
  arrival?: FlightAirportMovement;
  aircraft?: FlightAircraft | null;
  airline?: FlightAirline | null;
}

interface AirportFidsResponse {
  departures?: RawAeroDataBoxFlight[] | null;
  arrivals?: RawAeroDataBoxFlight[] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ApiError
// ─────────────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  public readonly httpStatus: number;
  public readonly apiMessage: string;

  constructor(httpStatus: number, apiMessage: string) {
    super(`AeroDataBox API error ${httpStatus}: ${apiMessage}`);
    this.name = "ApiError";
    this.httpStatus = httpStatus;
    this.apiMessage = apiMessage;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status mapping
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<AeroDataBoxFlightStatus, FlightStatus> = {
  Unknown: "scheduled",
  Expected: "scheduled",
  CheckIn: "scheduled",
  Boarding: "scheduled",
  GateClosed: "scheduled",
  Delayed: "scheduled",
  Departed: "active",
  EnRoute: "active",
  Approaching: "active",
  Arrived: "landed",
  Canceled: "cancelled",
  CanceledUncertain: "cancelled",
  Diverted: "diverted",
};

export function mapStatus(raw: string): FlightStatus {
  return STATUS_MAP[raw as AeroDataBoxFlightStatus] ?? "scheduled";
}

// ─────────────────────────────────────────────────────────────────────────────
// Field mapping
// ─────────────────────────────────────────────────────────────────────────────

type FlightForUpsert = Omit<DbFlight, "created_at" | "last_seen_at">;

export function mapFlight(
  raw: RawAeroDataBoxFlight,
  airportIata: string
): FlightForUpsert | null {
  const movement = raw.movement ?? raw.departure;
  if (!movement?.scheduledTime?.utc) return null;

  const scheduledEpoch = Math.floor(
    new Date(movement.scheduledTime.utc).getTime() / 1000
  );
  if (Number.isNaN(scheduledEpoch)) return null;

  const estimatedEpoch = movement.revisedTime?.utc
    ? Math.floor(new Date(movement.revisedTime.utc).getTime() / 1000)
    : null;

  const destinationIata = raw.arrival?.airport?.iata;
  // Skip flights with no known destination — can't display or book them
  if (!destinationIata) return null;

  return {
    id: `${raw.number}-${movement.scheduledTime.utc}`,
    flight_number: raw.number,
    airline: raw.airline?.name ?? "Unknown",
    departure_airport: movement.airport?.iata ?? airportIata,
    destination_airport: destinationIata,
    scheduled_departure: scheduledEpoch,
    estimated_departure:
      estimatedEpoch !== null && !Number.isNaN(estimatedEpoch)
        ? estimatedEpoch
        : null,
    status: mapStatus(raw.status),
    aircraft_type: raw.aircraft?.model ?? null,
    bookable: 1 as const,
    lowest_price_cents: null,
    price_currency: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://aerodatabox.p.rapidapi.com";

// AeroDataBox FIDS endpoint enforces a 12-hour max window per call.
// We split the desired +1 h → +48 h range into four consecutive 12-hour slices.
const MAX_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Format a Date as YYYY-MM-DDTHH:mm (no seconds, no timezone suffix). */
function fmtLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  );
}

async function fetchWindowRaw(
  airportIata: string,
  apiKey: string,
  from: Date,
  to: Date
): Promise<RawAeroDataBoxFlight[]> {
  const url = new URL(
    `/flights/airports/iata/${encodeURIComponent(airportIata)}/${fmtLocal(from)}/${fmtLocal(to)}`,
    BASE_URL
  );
  url.searchParams.set("direction", "Departure");
  url.searchParams.set("withLeg", "true");
  url.searchParams.set("withCancelled", "true");
  url.searchParams.set("withCodeshared", "false");
  url.searchParams.set("withCargo", "false");
  url.searchParams.set("withPrivate", "false");

  await rateLimit(); // Rate limit to avoid 429 errors

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body);
  }

  const data: AirportFidsResponse = await res.json();
  return data.departures ?? [];
}

export async function getFlightsByAirport(
  airportIata: string
): Promise<FlightForUpsert[]> {
  const apiKey = process.env.AERODATABOX_API_KEY;
  if (!apiKey) {
    throw new Error("AERODATABOX_API_KEY is not set in environment variables");
  }

  // Cover now → +48 h from now, sliced into ≤12 h windows to satisfy the API limit.
  const now = new Date();
  const rangeStart = now.getTime();                       // now (was +1 h, fixes missing immediate departures)
  const rangeEnd   = now.getTime() + 48 * 60 * 60 * 1000; // +48 h

  const seen = new Set<string>();
  const results: FlightForUpsert[] = [];

  let cursor = rangeStart;
  while (cursor < rangeEnd) {
    const windowEnd = Math.min(cursor + MAX_WINDOW_MS, rangeEnd);
    const raw = await fetchWindowRaw(airportIata, apiKey, new Date(cursor), new Date(windowEnd));

    for (const entry of raw) {
      const flight = mapFlight(entry, airportIata);
      if (flight && !seen.has(flight.id)) {
        seen.add(flight.id);
        results.push(flight);
      }
    }

    cursor = windowEnd;
  }

  return results;
}
