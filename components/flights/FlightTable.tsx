"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import type { DbFlight } from "@/lib/db";
import { getAirportTimezone } from "@/lib/airportTimezone";
import { useScan } from "@/contexts/ScanContext";
import ScanCountdown from "@/components/dashboard/ScanCountdown";
import FlightRow from "./FlightRow";
import FlightsLoadingSkeleton from "./FlightsLoadingSkeleton";
import FlightsReminderModal from "./FlightsReminderModal";

// BookingModal imports @duffel/components hooks which behave differently during SSR.
// Loading it client-side only prevents the hydration hooks-count mismatch.
const BookingModal = dynamic(() => import("./BookingModal"), { ssr: false });

const AIRPORT_NAMES: Record<string, string> = {
  DXB: "Dubai International",
  AUH: "Abu Dhabi International",
  DOH: "Hamad International",
  BAH: "Bahrain International",
  KWI: "Kuwait International",
};

interface AirportEntry {
  iata: string;
  city: string;
}

type SortKey = keyof Pick<
  DbFlight,
  | "flight_number"
  | "airline"
  | "destination_airport"
  | "scheduled_departure"
  | "status"
  | "lowest_price_cents"
>;

interface SortState {
  col: SortKey;
  dir: "asc" | "desc";
}

interface FlightsResponse {
  flights: DbFlight[];
  nextScanAt: number | null;
}

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) {
      console.error("API error", url, res.status);
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  });

function ChevronIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return <span className="ml-1 text-slate-600">↕</span>;
  return (
    <span className="ml-1 text-accent">{dir === "asc" ? "↑" : "↓"}</span>
  );
}

interface FlightTableProps {
  airportIata: string;
  destinationIata?: string | null;
}

export default function FlightTable({
  airportIata: initialAirportIata,
  destinationIata,
}: FlightTableProps) {
  // ── Scan context ───────────────────────────────────────────────────────────
  // globalMutate fires at the scan boundary to revalidate the flights SWR key.
  const { remaining, airportIata: contextAirportIata, scanIntervalSeconds, nextScanAt: contextNextScanAt } = useScan();

  const REMINDER_KEY = "flyhome_reminder_dismissed_v1";
  const [reminderOpen, setReminderOpen] = useState(false);

  // Auto-open on first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem(REMINDER_KEY)) setReminderOpen(true);
    } catch {
      setReminderOpen(true);
    }
  }, []);

  function closeReminder() {
    try { localStorage.setItem(REMINDER_KEY, "1"); } catch { /* ignore */ }
    setReminderOpen(false);
  }

  const [sort, setSort] = useState<SortState>({
    col: "scheduled_departure",
    dir: "asc",
  });
  const [selectedFlight, setSelectedFlight] = useState<DbFlight | null>(null);
  const [clock, setClock] = useState("");
  const [cityMap, setCityMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch("/data/airports.json")
      .then((r) => r.json())
      .then((entries: AirportEntry[]) => {
        const map = new Map<string, string>();
        for (const e of entries) {
          if (e.iata && e.city) map.set(e.iata, e.city);
        }
        setCityMap(map);
      })
      .catch(() => {});
  }, []);

  // lockedAirport: the airport whose results are currently being displayed.
  // It only switches at the scan boundary (remaining === 0) so that a mid-timer
  // airport change in another tab doesn't immediately replace the results shown here.
  const [lockedAirport, setLockedAirport] = useState(initialAirportIata);

  const lastUpdateRef = useRef<number>(Date.now());
  const prevIdsRef = useRef<Set<string>>(new Set());
  // Tracks the last airport for which we triggered a bootstrap fetch, so that
  // remounts of FlightTable (reload, re-login, new tab) with the same airport
  // do not re-fire the fetch. The localStorage check is the primary guard;
  // prevAirportRef prevents even the storage look-up when the airport has not
  // changed within a single React tree lifetime.
  const prevAirportRef = useRef<string | null>(null);

  // Fire exactly ONE bootstrap fetch per airport, and only when there is no
  // cached result in localStorage yet (i.e. the user's very first visit for
  // this airport, or after storage was cleared).
  //
  // All subsequent fetches are driven exclusively by ScanContext at the scan
  // boundary. This effect must NOT run on: page reload, new tab, re-login, or
  // any other remount where localStorage already holds valid flight data.
  useEffect(() => {
    if (!initialAirportIata) return;
    if (prevAirportRef.current === initialAirportIata) return;
    prevAirportRef.current = initialAirportIata;

    const hasCache = (() => {
      try { return !!localStorage.getItem(`flights:${initialAirportIata}`); }
      catch { return false; }
    })();

    if (!hasCache) {
      globalMutate(`/api/flights?airport=${initialAirportIata}`).catch(() => {});
    }
  }, [initialAirportIata]);

  // Switch the locked airport only when the global scan boundary fires.
  // ScanContext has already called globalMutate for the new airport at this point,
  // so when the SWR key changes below, SWR deduplicates against the in-flight
  // request — producing exactly ONE HTTP GET per cycle.
  useEffect(() => {
    if (remaining === 0 && contextAirportIata) {
      setLockedAirport(contextAirportIata);
    }
  }, [remaining, contextAirportIata]);

  // SWR subscription — key is locked to the current display airport.
  // All flights fetches are driven exclusively by ScanContext (the nextScanAt
  // infrastructure). SWR's autonomous revalidation is fully disabled so that
  // page reload, new tab, re-login, network reconnect, and tab focus cannot
  // trigger /api/flights independently of the scan schedule.
  //
  // revalidateOnMount: false  — initial fetch is triggered by ScanContext, not SWR mount.
  // refreshInterval: 0        — no periodic polling; only scan-boundary globalMutate fires.
  // revalidateOnFocus: false  — tab switch must NOT trigger a refetch.
  // revalidateOnReconnect: false — reconnect must NOT trigger a refetch.
  // dedupingInterval: 30_000  — prevents duplicate requests within 30 s.
  const { data, error, isLoading, mutate, isValidating } = useSWR<FlightsResponse>(
    `/api/flights?airport=${lockedAirport}`,
    fetcher,
    {
      revalidateOnMount: false,
      refreshInterval: 0,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
      onSuccess: (newData) => {
        lastUpdateRef.current = Date.now();
        try {
          localStorage.setItem(`flights:${lockedAirport}`, JSON.stringify(newData));
        } catch { /* storage quota or private-browsing — degrade gracefully */ }
      },
    }
  );


  // Seed SWR from localStorage after hydration. Using useEffect (not useMemo)
  // ensures this only runs on the client after the server-rendered HTML has
  // already been reconciled — preventing the SSR/CSR mismatch that occurs when
  // typeof window checks appear in useMemo during the synchronous render pass.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`flights:${lockedAirport}`);
      if (stored) {
        const parsed = JSON.parse(stored) as FlightsResponse;
        mutate(parsed, { revalidate: false });
      }
    } catch { /* ignore */ }
  }, [lockedAirport, mutate]);

  // Clock display — shows current time in the departure airport's local timezone.
  useEffect(() => {
    const tz = getAirportTimezone(lockedAirport);
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedAirport]);

  // Track which flight IDs are new since last render
  const newIds = useMemo(() => {
    if (!data?.flights) return new Set<string>();
    const newSet = new Set<string>();
    for (const f of data.flights) {
      if (!prevIdsRef.current.has(f.id)) newSet.add(f.id);
    }
    return newSet;
  }, [data]);

  // Update prevIds after computing newIds
  useEffect(() => {
    if (!data?.flights) return;
    prevIdsRef.current = new Set(data.flights.map((f) => f.id));
  }, [data]);

  const sortedData = useMemo(() => {
    if (!data?.flights) return [];
    return [...data.flights].sort((a, b) => {
      // Priority: direct flights to user's preferred destination always bubble to top
      if (destinationIata) {
        const aMatch = a.destination_airport === destinationIata ? 0 : 1;
        const bMatch = b.destination_airport === destinationIata ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }

      const av = a[sort.col];
      const bv = b[sort.col];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sort, destinationIata]);

  const handleSort = useCallback(
    (col: SortKey) => {
      setSort((prev) =>
        prev.col === col
          ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
          : { col, dir: "asc" }
      );
    },
    []
  );
  // CHANGED IN STEP 9: Fall back to cityMap for airports not in AIRPORT_NAMES
  const airportName = AIRPORT_NAMES[lockedAirport] ?? cityMap.get(lockedAirport) ?? lockedAirport;
  if (!data && !error) return (
    <>
      <FlightsReminderModal open={reminderOpen} onClose={closeReminder} />
      <FlightsLoadingSkeleton />
    </>
  );

  return (
    <>
      <FlightsReminderModal open={reminderOpen} onClose={closeReminder} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-2xl font-bold text-white">
              {lockedAirport}
            </span>
            <span className="text-base text-slate-400">{airportName}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {error ? (
              <span className="text-red-400">Error loading</span>
            ) : isValidating ? (
              <span className="text-accent">Refreshing…</span>
            ) : null}
            <button
              onClick={() => setReminderOpen(true)}
              title="Notification setup & keep-awake guide"
              className="flex items-center gap-1.5 rounded-md border border-border/60 bg-navy-700/40 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-accent/40 hover:text-accent"
            >
              <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5A1 1 0 0 0 3.4 15H16.6a1 1 0 0 0 .9-1.5L16 11V8a6 6 0 0 0-6-6z"/>
                <path d="M8 15a2 2 0 0 0 4 0"/>
              </svg>
              Alerts
            </button>
            <ScanCountdown nextScanAt={error ? null : (data?.nextScanAt ?? contextNextScanAt)} airportIata={lockedAirport} />
            <span className="font-mono text-white">{clock}</span>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-400">
              {error instanceof Error ? error.message : "Failed to load flights"}
            </p>
            <button
              onClick={() => mutate()}
              className="ml-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!error && data && sortedData.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-navy-700 py-20 text-center">
            <div className="mb-4 h-3 w-3 rounded-full bg-accent animate-radar" />
            <p className="text-sm text-slate-400">
              No departures found at {lockedAirport}. The monitor is active and checking every {scanIntervalSeconds ?? 1800} seconds.
            </p>
          </div>
        )}

        {/* Table */}
        {sortedData.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-navy-700">
            <table className="w-full">
              <thead className="hidden border-b border-border md:table-header-group">
                <tr>
                  {(
                    [
                      { key: "flight_number", label: "Flight №" },
                      { key: "airline", label: "Airline" },
                      { key: "destination_airport", label: "Destination" },
                      { key: "scheduled_departure", label: "Scheduled Dep." },
                      { key: "status", label: "Status" },
                      { key: "lowest_price_cents", label: "Price" },
                      { key: null, label: "Action" },
                    ] as { key: SortKey | null; label: string }[]
                  ).map(({ key, label }) => (
                    <th
                      key={label}
                      onClick={key ? () => handleSort(key) : undefined}
                      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 ${
                        key
                          ? "cursor-pointer select-none hover:text-slate-300"
                          : ""
                      }`}
                    >
                      {label}
                      {key && (
                        <ChevronIcon
                          dir={sort.col === key ? sort.dir : null}
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {sortedData.map((flight) => (
                    <FlightRow
                      key={flight.id}
                      flight={flight}
                      isNew={newIds.has(flight.id)}
                      onBook={setSelectedFlight}
                      preferredDest={destinationIata}
                      cityMap={cityMap}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking modal */}
      <BookingModal
        flight={selectedFlight}
        onClose={() => setSelectedFlight(null)}
      />
    </>
  );
}
