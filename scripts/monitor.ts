// Load .env file before anything else — ts-node does not do this automatically.
// Uses only Node built-ins; no dotenv dependency required.
import fs from "fs";
import path from "path";
(function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    // strip inline comments
    const ci = val.indexOf(" #");
    if (ci !== -1) val = val.slice(0, ci).trim();
    // strip surrounding quotes
    if (/^["'].*["']$/.test(val)) val = val.slice(1, -1);
    if (key && !(key in process.env)) process.env[key] = val;
  }
})();

import {
  initDb,
  getDb,
  closeDb,
  getAirportScanBuckets,
  getActiveUsersForAirport,
  upsertFlight,
  updateScanTimestamps,
  updateFlightBookable,
  updateFlightPrice,
  getAllFlightStatuses,
  createNotification,
  purgeStalePendingBookings,
  purgeStaleFlights,
  getAirportsNeedingImmediateScan,
  clearImmediateScanFlag,
  type FlightStatus,
  type DbFlight,
} from "../lib/db";
import { getFlightsByAirport } from "../lib/aerodatabox";
import { checkFlightBookable } from "../lib/duffel";
import { handleFlightCancellation } from "../lib/bookings";
import { sendPushNotification } from "../lib/push";
import { log } from "../lib/logger"; // HARDENED IN STEP 10: all output via logger
import crypto from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory state for change detection
// ─────────────────────────────────────────────────────────────────────────────

export const previousStatuses = new Map<string, FlightStatus>();

// ─────────────────────────────────────────────────────────────────────────────
// In-memory airport group state (exported for testing)
// ─────────────────────────────────────────────────────────────────────────────

/** Maps each interval (seconds) → set of airport IATAs being polled at that rate. */
export const airportGroups = new Map<number, Set<string>>();

/** Maps each interval (seconds) → the active NodeJS.Timeout for that bucket. */
export const activeTimers = new Map<number, NodeJS.Timeout>();

/** All timers started by this monitor process — cleared on shutdown. */
export const activeIntervals: NodeJS.Timeout[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Notification helper
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyUsersOfNewFlight(
  flight: Omit<DbFlight, "created_at" | "last_seen_at">,
  airportIata: string,
  eventType: "new" | "status_change"
): Promise<void> {
  const users = getActiveUsersForAirport(airportIata);

  const title =
    eventType === "new"
      ? `New flight: ${flight.flight_number}`
      : `Status update: ${flight.flight_number}`;

  const body =
    eventType === "new"
      ? `${flight.airline} ${flight.flight_number} ${airportIata} → ${flight.destination_airport} (${flight.status})`
      : `${flight.flight_number} is now ${flight.status}`;

  for (const { user_id } of users) {
    await sendPushNotification(user_id, { title, body });

    createNotification({
      id: crypto.randomUUID(),
      user_id,
      flight_id: flight.id,
      type: eventType === "new" ? "new_flight" : "status_change",
      title,
      body,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single poll tick for one airport
// HARDENED IN STEP 10 (2C): AbortController with 10 s timeout
// ─────────────────────────────────────────────────────────────────────────────

export async function pollAirport(
  airportIata: string,
  intervalSeconds: number
): Promise<void> {
  // HARDENED IN STEP 10: wrap every AeroDataBox call in a 10 s AbortController
  const controller = new AbortController();
  const startMs = Date.now();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  // Abort-aware race: resolves to flights or rejects with AbortError
  const abortPromise = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => {
      reject(new DOMException("AeroDataBox poll timed out", "AbortError"));
    });
  });

  let flights: Awaited<ReturnType<typeof getFlightsByAirport>>;
  try {
    flights = await Promise.race([getFlightsByAirport(airportIata), abortPromise]);
  } catch (err) {
    console.error(err);
    if (err instanceof Error && err.name === "AbortError") {
      return;
      // HARDENED IN STEP 10: timeout — skip tick, do not retry, do not crash
      log("warn", "monitor", "AeroDataBox poll timed out", {
        airport: airportIata,
        elapsedMs: Date.now() - startMs,
      });
    }
    return;
    log("error", "monitor", "AeroDataBox poll error", {
      airport: airportIata,
      err: String(err),
    });
  } finally {
    clearTimeout(timeout);
  }

  purgeStaleFlights(airportIata);
  let newCount = 0;

  if (flights.length === 0) {
    log("debug", "monitor", `${airportIata} | ${intervalSeconds}s | 0 flights`, {
      airport: airportIata,
      intervalSeconds,
    });
    // Still update timestamps on a successful (empty) poll
    updateScanTimestamps(airportIata, intervalSeconds);
    return;
  }

  for (const flight of flights) {
    const upserted = upsertFlight(flight);

    const prevStatus = previousStatuses.get(flight.id);
    const firstSeen = prevStatus === undefined;
    const statusChanged = !firstSeen && prevStatus !== flight.status;

    // Never alert for cancelled or diverted flights — not actionable for stranded passengers
    const isAlertable = flight.status !== "cancelled" && flight.status !== "diverted";

    // Check bookability on every flight every poll. The 5-minute in-memory cache in
    // checkFlightBookable prevents redundant Duffel calls within a single scan cycle.
    // This ensures flights that previously got a null price due to a transient Duffel
    // error are retried on the next poll rather than staying invisible indefinitely.
    const depDate = new Date(flight.scheduled_departure * 1000)
      .toISOString()
      .slice(0, 10);
    let bookable = upserted.bookable === 1;
    try {
      const result = await checkFlightBookable(
        flight.flight_number,
        depDate,
        flight.departure_airport,
        flight.destination_airport
      );
      bookable = result.bookable;
      updateFlightBookable(flight.id, bookable ? 1 : 0);
      if (result.lowestPriceCents !== null && result.currency) {
        updateFlightPrice(flight.id, result.lowestPriceCents, result.currency);
      }
    } catch {
      // Unexpected error: retain whatever bookable state is already in the DB.
    }

    if ((firstSeen || statusChanged) && isAlertable && bookable) {
      newCount++;
      await notifyUsersOfNewFlight(flight, airportIata, firstSeen ? "new" : "status_change");
    }

    previousStatuses.set(flight.id, flight.status);

    // Detect transition to cancelled — trigger cancellation fallback for confirmed bookings
    if (flight.status === "cancelled" && prevStatus !== undefined && prevStatus !== "cancelled") {
      handleFlightCancellation(flight.id).catch((err) =>
        log("error", "monitor", `handleFlightCancellation failed for ${flight.id}`, {
          err: String(err),
        })
      );
    }
  }

  // Only update scan timestamps on successful poll completion
  updateScanTimestamps(airportIata, intervalSeconds);

  log("debug", "monitor", `${airportIata} | ${intervalSeconds}s | ${flights.length} flights | ${newCount} new/changed`, {
    airport: airportIata,
    intervalSeconds,
    flightCount: flights.length,
    newOrChangedCount: newCount,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic airport management helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reads the current airport-to-interval mapping from the DB.
 * Returns a Map of airportIata → intervalSeconds.
 */
export function readCurrentIntervals(): Map<string, number> {
  const buckets = getAirportScanBuckets();
  return new Map(buckets.map((b) => [b.airport_iata, b.interval]));
}

/**
 * Reconciles the in-memory airportGroups with the live DB state.
 * Detects new airports, removed airports, and interval changes.
 * Must be called at the start of every tick.
 */
export function reconcileAirports(liveIntervals: Map<string, number>): void {
  // Detect removed airports and interval changes
  Array.from(airportGroups.entries()).forEach(([intervalSec, airports]) => {
    Array.from(airports).forEach((iata) => {
      const liveInterval = liveIntervals.get(iata);

      if (liveInterval === undefined) {
        airports.delete(iata);
        log("info", "monitor", `Stopped monitoring ${iata} (deactivated)`, { airport: iata });
      } else if (liveInterval !== intervalSec) {
        airports.delete(iata);
        const newGroup = airportGroups.get(liveInterval) ?? new Set<string>();
        newGroup.add(iata);
        airportGroups.set(liveInterval, newGroup);
        log("info", "monitor", `${iata} interval changed: ${intervalSec}s → ${liveInterval}s`, {
          airport: iata,
          oldInterval: intervalSec,
          newInterval: liveInterval,
        });
      }
    });
  });

  // Detect new airports
  Array.from(liveIntervals.entries()).forEach(([iata, intervalSec]) => {
    const found = Array.from(airportGroups.values()).some((airports) =>
      airports.has(iata)
    );
    if (!found) {
      const group = airportGroups.get(intervalSec) ?? new Set<string>();
      group.add(iata);
      airportGroups.set(intervalSec, group);
      log("info", "monitor", `New airport detected: ${iata} at ${intervalSec}s`, {
        airport: iata,
        intervalSeconds: intervalSec,
      });

      if (!activeTimers.has(intervalSec)) {
        startIntervalForBucket(intervalSec);
      }

      pollAirport(iata, intervalSec).catch((err) =>
        log("error", "monitor", `Unhandled error on first scan of new airport ${iata}`, {
          airport: iata,
          err: String(err),
        })
      );
    }
  });
}

/**
 * Starts a setInterval for a given interval bucket.
 * On each tick, reconciles the live DB state then polls all airports in the bucket.
 */
export function startIntervalForBucket(intervalSec: number): void {
  log("info", "monitor", `Starting ${intervalSec}s interval`, {
    airports: Array.from(airportGroups.get(intervalSec) ?? []).join(", "),
    intervalSeconds: intervalSec,
  });

  const tick = () => {
    const liveIntervals = readCurrentIntervals();
    reconcileAirports(liveIntervals);

    const airports = airportGroups.get(intervalSec);
    if (!airports || airports.size === 0) return;

    airports.forEach((iata) => {
      pollAirport(iata, intervalSec).catch((err) => {
        log("error", "monitor", `Unhandled error polling ${iata}`, {
          airport: iata,
          err: String(err),
        });
      });
    });
  };

  const id = setInterval(tick, intervalSec * 1000);
  activeTimers.set(intervalSec, id);
  activeIntervals.push(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// HARDENED IN STEP 10 (2D): Heartbeat logging every 60 s
// ─────────────────────────────────────────────────────────────────────────────

export function startHeartbeat(): NodeJS.Timeout {
  const id = setInterval(() => {
    const airportsMonitored = Array.from(airportGroups.values()).reduce(
      (sum, set) => sum + set.size,
      0
    );
    log("info", "monitor", "heartbeat", {
      uptime_seconds: Math.floor(process.uptime()),
      airports_monitored: airportsMonitored,
    });
  }, 60_000);
  activeIntervals.push(id);
  return id;
}

// ─────────────────────────────────────────────────────────────────────────────
// HARDENED IN STEP 10 (2D): Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────

export function gracefulShutdown(): void {
  log("info", "monitor", "monitor shutting down gracefully");
  for (const id of activeIntervals) {
    clearInterval(id);
  }
  activeIntervals.length = 0;
  // Close SQLite DB connection
  try {
    closeDb();
  } catch {
    // Ignore if DB was never initialized
  }
  process.exit(0);
}

// HARDENED IN STEP 10 (2D): process lifecycle handlers
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
// HARDENED IN STEP 10: exported for testing — log but do NOT process.exit
export function handleUnhandledRejection(reason: unknown): void {
  log("error", "monitor", "Unhandled rejection", { reason: String(reason) });
}
process.on("unhandledRejection", handleUnhandledRejection);

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export function main(): void {
  initDb();

  // Pre-populate previousStatuses from the DB so that flights already present
  // before this monitor instance started are NOT re-notified as "new".
  const known = getAllFlightStatuses();
  for (const { id, status } of known) {
    previousStatuses.set(id, status);
  }
  log("info", "monitor", `Pre-loaded ${known.length} known flight(s) into previousStatuses`, {
    count: known.length,
  });

  // HARDENED IN STEP 10 (2D): start heartbeat
  startHeartbeat();

  // ── Immediate scan loop ────────────────────────────────────────────────────
  const runImmediateScans = async (): Promise<void> => {
    const pending = getAirportsNeedingImmediateScan();
    if (pending.length === 0) return;

    reconcileAirports(readCurrentIntervals());

    for (const { airport_iata, interval } of pending) {
      clearImmediateScanFlag(airport_iata);
      log("info", "monitor", `Priority scan triggered for ${airport_iata}`, {
        airport: airport_iata,
      });
      try {
        await pollAirport(airport_iata, interval);
      } catch (err) {
        log("error", "monitor", `[immediate] Error scanning ${airport_iata}`, {
          airport: airport_iata,
          err: String(err),
        });
      }
    }
  };

  const immediateId = setInterval(
    () => { runImmediateScans().catch((err) => log("error", "monitor", "runImmediateScans error", { err: String(err) })); },
    5000
  );
  activeIntervals.push(immediateId);

  const buckets = getAirportScanBuckets();

  if (buckets.length === 0) {
    log("info", "monitor", "No active airport subscriptions found. Monitor idle — waiting for immediate-scan flags.");
    return;
  }

  // Build the initial airportGroups from startup buckets
  for (const { airport_iata, interval } of buckets) {
    const group = airportGroups.get(interval) ?? new Set<string>();
    group.add(airport_iata);
    airportGroups.set(interval, group);
  }

  // Start one setInterval per unique interval bucket
  Array.from(airportGroups.keys()).forEach((intervalSec) => {
    startIntervalForBucket(intervalSec);

    const airports = airportGroups.get(intervalSec);
    if (airports) {
      airports.forEach((iata) => {
        pollAirport(iata, intervalSec).catch((err) =>
          log("error", "monitor", `Unhandled error on startup poll of ${iata}`, {
            airport: iata,
            err: String(err),
          })
        );
      });
    }
  });

  // Hourly AeroDataBox time refresh — ensures estimated_departure stays current
  const allAirports = buckets.map((b) => b.airport_iata);
  const hourlyRefresh = async () => {
    for (const iata of allAirports) {
      try {
        const fresh = await getFlightsByAirport(iata);
        purgeStaleFlights(iata);
        for (const flight of fresh) {
          upsertFlight(flight);
        }
        log("info", "monitor", `[hourly-refresh] ${iata}: ${fresh.length} flights refreshed`, {
          airport: iata,
          count: fresh.length,
        });
      } catch (err) {
        log("error", "monitor", `[hourly-refresh] ${iata} error`, {
          airport: iata,
          err: String(err),
        });
      }
    }
  };
  const hourlyId = setInterval(hourlyRefresh, 60 * 60 * 1000);
  activeIntervals.push(hourlyId);

  // Purge stale pending bookings every 30 minutes
  purgeStalePendingBookings();
  const purgeId = setInterval(() => {
    try {
      purgeStalePendingBookings();
    } catch (err) {
      log("error", "monitor", "purgeStalePendingBookings error", { err: String(err) });
    }
  }, 30 * 60 * 1000);
  activeIntervals.push(purgeId);
}

// Only auto-run when executed directly (not when imported by tests)
if (require.main === module) {
  main();
}
