import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getFlightsByAirport,
  ApiError,
  mapFlight,
  mapStatus,
  type RawAeroDataBoxFlight,
} from "@/lib/aerodatabox";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeRawFlight(
  overrides: Partial<RawAeroDataBoxFlight> = {}
): RawAeroDataBoxFlight {
  return {
    number: "EK101",
    status: "Expected",
    codeshareStatus: "IsOperator",
    isCargo: false,
    movement: {
      airport: { iata: "DXB", name: "Dubai International" },
      scheduledTime: {
        utc: "2026-03-07T10:00:00Z",
        local: "2026-03-07T14:00:00+04:00",
      },
      revisedTime: null,
      quality: ["Basic"],
    },
    arrival: {
      airport: { iata: "LHR", name: "Heathrow" },
      scheduledTime: {
        utc: "2026-03-07T14:30:00Z",
        local: "2026-03-07T14:30:00+00:00",
      },
      quality: ["Basic"],
    },
    aircraft: { model: "Boeing 777-300ER", reg: "A6-EQA" },
    airline: { name: "Emirates", iata: "EK", icao: "UAE" },
    ...overrides,
  };
}

function mockFetch(
  status: number,
  body: unknown,
  ok?: boolean
): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv("AERODATABOX_API_KEY", "test-key-123");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// ─────────────────────────────────────────────────────────────────────────────
// mapStatus
// ─────────────────────────────────────────────────────────────────────────────

describe("mapStatus", () => {
  it("maps ground-phase statuses to 'scheduled'", () => {
    for (const s of [
      "Unknown",
      "Expected",
      "CheckIn",
      "Boarding",
      "GateClosed",
      "Delayed",
    ]) {
      expect(mapStatus(s)).toBe("scheduled");
    }
  });

  it("maps airborne statuses to 'active'", () => {
    for (const s of ["Departed", "EnRoute", "Approaching"]) {
      expect(mapStatus(s)).toBe("active");
    }
  });

  it("maps Arrived to 'landed'", () => {
    expect(mapStatus("Arrived")).toBe("landed");
  });

  it("maps cancellation statuses to 'cancelled'", () => {
    expect(mapStatus("Canceled")).toBe("cancelled");
    expect(mapStatus("CanceledUncertain")).toBe("cancelled");
  });

  it("maps Diverted to 'diverted'", () => {
    expect(mapStatus("Diverted")).toBe("diverted");
  });

  it("falls back to 'scheduled' for unknown values", () => {
    expect(mapStatus("SomethingNew")).toBe("scheduled");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mapFlight
// ─────────────────────────────────────────────────────────────────────────────

describe("mapFlight", () => {
  it("maps all fields correctly from raw AeroDataBox shape to DbFlight", () => {
    const raw = makeRawFlight();
    const result = mapFlight(raw, "DXB");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("EK101-2026-03-07T10:00:00Z");
    expect(result!.flight_number).toBe("EK101");
    expect(result!.airline).toBe("Emirates");
    expect(result!.departure_airport).toBe("DXB");
    expect(result!.destination_airport).toBe("LHR");
    expect(result!.scheduled_departure).toBe(
      Math.floor(new Date("2026-03-07T10:00:00Z").getTime() / 1000)
    );
    expect(result!.estimated_departure).toBeNull();
    expect(result!.status).toBe("scheduled");
    expect(result!.aircraft_type).toBe("Boeing 777-300ER");
  });

  it("uses revisedTime for estimated_departure when present", () => {
    const raw = makeRawFlight({
      movement: {
        airport: { iata: "DXB", name: "Dubai" },
        scheduledTime: {
          utc: "2026-03-07T10:00:00Z",
          local: "2026-03-07T14:00:00+04:00",
        },
        revisedTime: {
          utc: "2026-03-07T10:15:00Z",
          local: "2026-03-07T14:15:00+04:00",
        },
        quality: ["Basic", "Live"],
      },
    });
    const result = mapFlight(raw, "DXB");
    expect(result!.estimated_departure).toBe(
      Math.floor(new Date("2026-03-07T10:15:00Z").getTime() / 1000)
    );
  });

  it("returns null when scheduledTime is missing", () => {
    const raw = makeRawFlight({
      movement: {
        airport: { iata: "DXB", name: "Dubai" },
        scheduledTime: null,
        quality: ["Basic"],
      },
    });
    expect(mapFlight(raw, "DXB")).toBeNull();
  });

  it("defaults airline to 'Unknown' when absent", () => {
    const raw = makeRawFlight({ airline: null });
    const result = mapFlight(raw, "DXB");
    expect(result!.airline).toBe("Unknown");
  });

  it("returns null (skips flight) when arrival leg is absent", () => {
    // The function was updated to return null rather than "Unknown" for unknown
    // destinations, since such flights cannot be booked or searched on Duffel.
    const raw = makeRawFlight({ arrival: undefined });
    const result = mapFlight(raw, "DXB");
    expect(result).toBeNull();
  });

  it("defaults aircraft_type to null when aircraft is absent", () => {
    const raw = makeRawFlight({ aircraft: null });
    const result = mapFlight(raw, "DXB");
    expect(result!.aircraft_type).toBeNull();
  });

  it("falls back to departure field when movement is undefined", () => {
    const raw = makeRawFlight({
      movement: undefined,
      departure: {
        airport: { iata: "DXB", name: "Dubai" },
        scheduledTime: {
          utc: "2026-03-07T10:00:00Z",
          local: "2026-03-07T14:00:00+04:00",
        },
        quality: ["Basic"],
      },
    });
    const result = mapFlight(raw, "DXB");
    expect(result).not.toBeNull();
    expect(result!.departure_airport).toBe("DXB");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getFlightsByAirport
// ─────────────────────────────────────────────────────────────────────────────

describe("getFlightsByAirport", () => {
  it("returns mapped flights on 200 response", async () => {
    const raw = makeRawFlight();
    mockFetch(200, { departures: [raw] });

    const flights = await getFlightsByAirport("DXB");
    expect(flights).toHaveLength(1);
    expect(flights[0].flight_number).toBe("EK101");
    expect(flights[0].departure_airport).toBe("DXB");
    expect(flights[0].destination_airport).toBe("LHR");
  });

  it("sends correct headers", async () => {
    const fetchMock = mockFetch(200, { departures: [] });

    await getFlightsByAirport("DXB");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("aerodatabox.p.rapidapi.com");
    expect(url).toContain("/flights/airports/iata/DXB");
    expect(opts.headers["X-RapidAPI-Key"]).toBe("test-key-123");
    expect(opts.headers["X-RapidAPI-Host"]).toBe(
      "aerodatabox.p.rapidapi.com"
    );
  });

  it("returns empty array when departures is null", async () => {
    mockFetch(200, { departures: null });
    const flights = await getFlightsByAirport("DXB");
    expect(flights).toEqual([]);
  });

  it("returns empty array when departures is empty", async () => {
    mockFetch(200, { departures: [] });
    const flights = await getFlightsByAirport("DXB");
    expect(flights).toEqual([]);
  });

  it("throws ApiError with correct httpStatus on non-200", async () => {
    mockFetch(403, { message: "Forbidden" }, false);

    await expect(getFlightsByAirport("DXB")).rejects.toThrow(ApiError);

    try {
      await getFlightsByAirport("DXB");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).httpStatus).toBe(403);
      expect((err as ApiError).apiMessage).toContain("Forbidden");
    }
  });

  it("throws ApiError on 500 server error", async () => {
    mockFetch(500, "Internal Server Error", false);

    await expect(getFlightsByAirport("DXB")).rejects.toThrow(ApiError);
  });

  it("filters out flights missing scheduledTime", async () => {
    const good = makeRawFlight({ number: "EK101" });
    const bad = makeRawFlight({
      number: "EK999",
      movement: {
        airport: { iata: "DXB", name: "Dubai" },
        scheduledTime: null,
        quality: [],
      },
    });
    mockFetch(200, { departures: [good, bad] });

    const flights = await getFlightsByAirport("DXB");
    expect(flights).toHaveLength(1);
    expect(flights[0].flight_number).toBe("EK101");
  });

  it("throws when AERODATABOX_API_KEY is not set", async () => {
    vi.stubEnv("AERODATABOX_API_KEY", "");
    await expect(getFlightsByAirport("DXB")).rejects.toThrow(
      "AERODATABOX_API_KEY"
    );
  });
});

describe("mapFlight — additional branch coverage", () => {
  it("returns null when scheduledTime.utc is not a valid date (NaN epoch)", () => {
    const raw = makeRawFlight({
      movement: {
        airport: { iata: "DXB", name: "Dubai" },
        scheduledTime: {
          utc: "not-a-valid-date",
          local: "not-a-valid-date",
        },
        revisedTime: null,
        quality: ["Basic"],
      },
    });
    expect(mapFlight(raw, "DXB")).toBeNull();
  });

  it("falls back to airportIata when movement.airport.iata is not set", () => {
    const raw = makeRawFlight({
      movement: {
        airport: null as any,
        scheduledTime: {
          utc: "2026-03-07T10:00:00Z",
          local: "2026-03-07T14:00:00+04:00",
        },
        revisedTime: null,
        quality: ["Basic"],
      },
    });
    const result = mapFlight(raw, "DXB");
    expect(result?.departure_airport).toBe("DXB");
  });
});
