"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeIntervals = exports.activeTimers = exports.airportGroups = exports.previousStatuses = void 0;
exports.notifyUsersOfNewFlight = notifyUsersOfNewFlight;
exports.pollAirport = pollAirport;
exports.readCurrentIntervals = readCurrentIntervals;
exports.reconcileAirports = reconcileAirports;
exports.startIntervalForBucket = startIntervalForBucket;
exports.startHeartbeat = startHeartbeat;
exports.gracefulShutdown = gracefulShutdown;
exports.handleUnhandledRejection = handleUnhandledRejection;
exports.main = main;
// Load .env file before anything else — ts-node does not do this automatically.
// Uses only Node built-ins; no dotenv dependency required.
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
(function loadEnv() {
    var envPath = path_1.default.resolve(process.cwd(), ".env");
    if (!fs_1.default.existsSync(envPath))
        return;
    for (var _i = 0, _a = fs_1.default.readFileSync(envPath, "utf8").split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        var t = line.trim();
        if (!t || t.startsWith("#"))
            continue;
        var eq = t.indexOf("=");
        if (eq === -1)
            continue;
        var key = t.slice(0, eq).trim();
        var val = t.slice(eq + 1).trim();
        // strip inline comments
        var ci = val.indexOf(" #");
        if (ci !== -1)
            val = val.slice(0, ci).trim();
        // strip surrounding quotes
        if (/^["'].*["']$/.test(val))
            val = val.slice(1, -1);
        if (key && !(key in process.env))
            process.env[key] = val;
    }
})();
var db_1 = require("../lib/db");
var aerodatabox_1 = require("../lib/aerodatabox");
var duffel_1 = require("../lib/duffel");
var bookings_1 = require("../lib/bookings");
var push_1 = require("../lib/push");
var logger_1 = require("../lib/logger"); // HARDENED IN STEP 10: all output via logger
var crypto_1 = __importDefault(require("crypto"));
// ─────────────────────────────────────────────────────────────────────────────
// In-memory state for change detection
// ─────────────────────────────────────────────────────────────────────────────
exports.previousStatuses = new Map();
// ─────────────────────────────────────────────────────────────────────────────
// In-memory airport group state (exported for testing)
// ─────────────────────────────────────────────────────────────────────────────
/** Maps each interval (seconds) → set of airport IATAs being polled at that rate. */
exports.airportGroups = new Map();
/** Maps each interval (seconds) → the active NodeJS.Timeout for that bucket. */
exports.activeTimers = new Map();
/** All timers started by this monitor process — cleared on shutdown. */
exports.activeIntervals = [];
// ─────────────────────────────────────────────────────────────────────────────
// Notification helper
// ─────────────────────────────────────────────────────────────────────────────
function notifyUsersOfNewFlight(flight, airportIata, eventType) {
    return __awaiter(this, void 0, void 0, function () {
        var users, title, body, _i, users_1, _a, user_id, max_price_usd, flightPriceUsd;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    users = (0, db_1.getActiveUsersForAirport)(airportIata);
                    title = eventType === "new"
                        ? "New flight: ".concat(flight.flight_number)
                        : "Status update: ".concat(flight.flight_number);
                    body = eventType === "new"
                        ? "".concat(flight.airline, " ").concat(flight.flight_number, " ").concat(airportIata, " \u2192 ").concat(flight.destination_airport, " (").concat(flight.status, ")")
                        : "".concat(flight.flight_number, " is now ").concat(flight.status);
                    _i = 0, users_1 = users;
                    _b.label = 1;
                case 1:
                    if (!(_i < users_1.length)) return [3 /*break*/, 4];
                    _a = users_1[_i], user_id = _a.user_id, max_price_usd = _a.max_price_usd;
                    // Only notify if the flight has a Duffel price
                    if (flight.lowest_price_cents == null || flight.lowest_price_cents <= 0) {
                        (0, logger_1.log)("debug", "monitor", "Skipping notification for user ".concat(user_id, ": flight has no price"), {
                            user_id: user_id,
                            flight_id: flight.id,
                        });
                        return [3 /*break*/, 3];
                    }
                    // If user has a max price set, enforce it
                    if (max_price_usd !== null) {
                        flightPriceUsd = flight.lowest_price_cents / 100;
                        if (flightPriceUsd > max_price_usd) {
                            (0, logger_1.log)("debug", "monitor", "Skipping notification for user ".concat(user_id, ": flight price ").concat(flightPriceUsd, " USD > max price ").concat(max_price_usd, " USD"), {
                                user_id: user_id,
                                flight_id: flight.id,
                                price: flightPriceUsd,
                                max_price: max_price_usd,
                            });
                            return [3 /*break*/, 3];
                        }
                    }
                    return [4 /*yield*/, (0, push_1.sendPushNotification)(user_id, { title: title, body: body })];
                case 2:
                    _b.sent();
                    (0, db_1.createNotification)({
                        id: crypto_1.default.randomUUID(),
                        user_id: user_id,
                        flight_id: flight.id,
                        type: eventType === "new" ? "new_flight" : "status_change",
                        title: title,
                        body: body,
                    });
                    _b.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Single poll tick for one airport
// HARDENED IN STEP 10 (2C): AbortController with 10 s timeout
// ─────────────────────────────────────────────────────────────────────────────
function pollAirport(airportIata, intervalSeconds) {
    return __awaiter(this, void 0, void 0, function () {
        var controller, startMs, timeout, abortPromise, flights, err_1, newCount, _loop_1, _i, flights_1, flight;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    controller = new AbortController();
                    startMs = Date.now();
                    timeout = setTimeout(function () { return controller.abort(); }, 10000);
                    abortPromise = new Promise(function (_, reject) {
                        controller.signal.addEventListener("abort", function () {
                            reject(new DOMException("AeroDataBox poll timed out", "AbortError"));
                        });
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, Promise.race([(0, aerodatabox_1.getFlightsByAirport)(airportIata), abortPromise])];
                case 2:
                    flights = _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    console.error(err_1);
                    if (err_1 instanceof Error && err_1.name === "AbortError") {
                        return [2 /*return*/];
                        // HARDENED IN STEP 10: timeout — skip tick, do not retry, do not crash
                        (0, logger_1.log)("warn", "monitor", "AeroDataBox poll timed out", {
                            airport: airportIata,
                            elapsedMs: Date.now() - startMs,
                        });
                    }
                    return [2 /*return*/];
                case 4:
                    clearTimeout(timeout);
                    return [7 /*endfinally*/];
                case 5:
                    (0, db_1.purgeStaleFlights)(airportIata);
                    newCount = 0;
                    if (flights.length === 0) {
                        (0, logger_1.log)("debug", "monitor", "".concat(airportIata, " | ").concat(intervalSeconds, "s | 0 flights"), {
                            airport: airportIata,
                            intervalSeconds: intervalSeconds,
                        });
                        // Still update timestamps on a successful (empty) poll
                        (0, db_1.updateScanTimestamps)(airportIata, intervalSeconds);
                        return [2 /*return*/];
                    }
                    _loop_1 = function (flight) {
                        var upserted, prevStatus, firstSeen, statusChanged, isAlertable, depDate, bookable, result, _b;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    upserted = (0, db_1.upsertFlight)(flight);
                                    prevStatus = exports.previousStatuses.get(flight.id);
                                    firstSeen = prevStatus === undefined;
                                    statusChanged = !firstSeen && prevStatus !== flight.status;
                                    isAlertable = flight.status !== "cancelled" && flight.status !== "diverted";
                                    depDate = new Date(flight.scheduled_departure * 1000)
                                        .toISOString()
                                        .slice(0, 10);
                                    bookable = upserted.bookable === 1;
                                    _c.label = 1;
                                case 1:
                                    _c.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, (0, duffel_1.checkFlightBookable)(flight.flight_number, depDate, flight.departure_airport, flight.destination_airport)];
                                case 2:
                                    result = _c.sent();
                                    bookable = result.bookable;
                                    (0, db_1.updateFlightBookable)(flight.id, bookable ? 1 : 0);
                                    if (result.lowestPriceCents !== null && result.currency) {
                                        (0, db_1.updateFlightPrice)(flight.id, result.lowestPriceCents, result.currency);
                                    }
                                    return [3 /*break*/, 4];
                                case 3:
                                    _b = _c.sent();
                                    return [3 /*break*/, 4];
                                case 4:
                                    if (!((firstSeen || statusChanged) && isAlertable && bookable)) return [3 /*break*/, 6];
                                    newCount++;
                                    return [4 /*yield*/, notifyUsersOfNewFlight(flight, airportIata, firstSeen ? "new" : "status_change")];
                                case 5:
                                    _c.sent();
                                    _c.label = 6;
                                case 6:
                                    exports.previousStatuses.set(flight.id, flight.status);
                                    // Detect transition to cancelled — trigger cancellation fallback for confirmed bookings
                                    if (flight.status === "cancelled" && prevStatus !== undefined && prevStatus !== "cancelled") {
                                        (0, bookings_1.handleFlightCancellation)(flight.id).catch(function (err) {
                                            return (0, logger_1.log)("error", "monitor", "handleFlightCancellation failed for ".concat(flight.id), {
                                                err: String(err),
                                            });
                                        });
                                    }
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, flights_1 = flights;
                    _a.label = 6;
                case 6:
                    if (!(_i < flights_1.length)) return [3 /*break*/, 9];
                    flight = flights_1[_i];
                    return [5 /*yield**/, _loop_1(flight)];
                case 7:
                    _a.sent();
                    _a.label = 8;
                case 8:
                    _i++;
                    return [3 /*break*/, 6];
                case 9:
                    // Only update scan timestamps on successful poll completion
                    (0, db_1.updateScanTimestamps)(airportIata, intervalSeconds);
                    (0, logger_1.log)("debug", "monitor", "".concat(airportIata, " | ").concat(intervalSeconds, "s | ").concat(flights.length, " flights | ").concat(newCount, " new/changed"), {
                        airport: airportIata,
                        intervalSeconds: intervalSeconds,
                        flightCount: flights.length,
                        newOrChangedCount: newCount,
                    });
                    return [2 /*return*/];
            }
        });
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// Dynamic airport management helpers
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Reads the current airport-to-interval mapping from the DB.
 * Returns a Map of airportIata → intervalSeconds.
 */
function readCurrentIntervals() {
    var buckets = (0, db_1.getAirportScanBuckets)();
    return new Map(buckets.map(function (b) { return [b.airport_iata, b.interval]; }));
}
/**
 * Reconciles the in-memory airportGroups with the live DB state.
 * Detects new airports, removed airports, and interval changes.
 * Must be called at the start of every tick.
 */
function reconcileAirports(liveIntervals) {
    // Detect removed airports and interval changes
    Array.from(exports.airportGroups.entries()).forEach(function (_a) {
        var intervalSec = _a[0], airports = _a[1];
        Array.from(airports).forEach(function (iata) {
            var _a;
            var liveInterval = liveIntervals.get(iata);
            if (liveInterval === undefined) {
                airports.delete(iata);
                (0, logger_1.log)("info", "monitor", "Stopped monitoring ".concat(iata, " (deactivated)"), { airport: iata });
            }
            else if (liveInterval !== intervalSec) {
                airports.delete(iata);
                var newGroup = (_a = exports.airportGroups.get(liveInterval)) !== null && _a !== void 0 ? _a : new Set();
                newGroup.add(iata);
                exports.airportGroups.set(liveInterval, newGroup);
                (0, logger_1.log)("info", "monitor", "".concat(iata, " interval changed: ").concat(intervalSec, "s \u2192 ").concat(liveInterval, "s"), {
                    airport: iata,
                    oldInterval: intervalSec,
                    newInterval: liveInterval,
                });
            }
        });
    });
    // Detect new airports
    Array.from(liveIntervals.entries()).forEach(function (_a) {
        var _b;
        var iata = _a[0], intervalSec = _a[1];
        var found = Array.from(exports.airportGroups.values()).some(function (airports) {
            return airports.has(iata);
        });
        if (!found) {
            var group = (_b = exports.airportGroups.get(intervalSec)) !== null && _b !== void 0 ? _b : new Set();
            group.add(iata);
            exports.airportGroups.set(intervalSec, group);
            (0, logger_1.log)("info", "monitor", "New airport detected: ".concat(iata, " at ").concat(intervalSec, "s"), {
                airport: iata,
                intervalSeconds: intervalSec,
            });
            if (!exports.activeTimers.has(intervalSec)) {
                startIntervalForBucket(intervalSec);
            }
            pollAirport(iata, intervalSec).catch(function (err) {
                return (0, logger_1.log)("error", "monitor", "Unhandled error on first scan of new airport ".concat(iata), {
                    airport: iata,
                    err: String(err),
                });
            });
        }
    });
}
/**
 * Starts a setInterval for a given interval bucket.
 * On each tick, reconciles the live DB state then polls all airports in the bucket.
 */
function startIntervalForBucket(intervalSec) {
    var _a;
    (0, logger_1.log)("info", "monitor", "Starting ".concat(intervalSec, "s interval"), {
        airports: Array.from((_a = exports.airportGroups.get(intervalSec)) !== null && _a !== void 0 ? _a : []).join(", "),
        intervalSeconds: intervalSec,
    });
    var tick = function () {
        var liveIntervals = readCurrentIntervals();
        reconcileAirports(liveIntervals);
        var airports = exports.airportGroups.get(intervalSec);
        if (!airports || airports.size === 0)
            return;
        airports.forEach(function (iata) {
            pollAirport(iata, intervalSec).catch(function (err) {
                (0, logger_1.log)("error", "monitor", "Unhandled error polling ".concat(iata), {
                    airport: iata,
                    err: String(err),
                });
            });
        });
    };
    var id = setInterval(tick, intervalSec * 1000);
    exports.activeTimers.set(intervalSec, id);
    exports.activeIntervals.push(id);
}
// ─────────────────────────────────────────────────────────────────────────────
// HARDENED IN STEP 10 (2D): Heartbeat logging every 60 s
// ─────────────────────────────────────────────────────────────────────────────
function startHeartbeat() {
    var id = setInterval(function () {
        var airportsMonitored = Array.from(exports.airportGroups.values()).reduce(function (sum, set) { return sum + set.size; }, 0);
        (0, logger_1.log)("info", "monitor", "heartbeat", {
            uptime_seconds: Math.floor(process.uptime()),
            airports_monitored: airportsMonitored,
        });
    }, 60000);
    exports.activeIntervals.push(id);
    return id;
}
// ─────────────────────────────────────────────────────────────────────────────
// HARDENED IN STEP 10 (2D): Graceful shutdown
// ─────────────────────────────────────────────────────────────────────────────
function gracefulShutdown() {
    (0, logger_1.log)("info", "monitor", "monitor shutting down gracefully");
    for (var _i = 0, activeIntervals_1 = exports.activeIntervals; _i < activeIntervals_1.length; _i++) {
        var id = activeIntervals_1[_i];
        clearInterval(id);
    }
    exports.activeIntervals.length = 0;
    // Close SQLite DB connection
    try {
        (0, db_1.closeDb)();
    }
    catch (_a) {
        // Ignore if DB was never initialized
    }
    process.exit(0);
}
// HARDENED IN STEP 10 (2D): process lifecycle handlers
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
// HARDENED IN STEP 10: exported for testing — log but do NOT process.exit
function handleUnhandledRejection(reason) {
    (0, logger_1.log)("error", "monitor", "Unhandled rejection", { reason: String(reason) });
}
process.on("unhandledRejection", handleUnhandledRejection);
// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
function main() {
    var _this = this;
    var _a;
    (0, db_1.initDb)();
    // Pre-populate previousStatuses from the DB so that flights already present
    // before this monitor instance started are NOT re-notified as "new".
    var known = (0, db_1.getAllFlightStatuses)();
    for (var _i = 0, known_1 = known; _i < known_1.length; _i++) {
        var _b = known_1[_i], id = _b.id, status_1 = _b.status;
        exports.previousStatuses.set(id, status_1);
    }
    (0, logger_1.log)("info", "monitor", "Pre-loaded ".concat(known.length, " known flight(s) into previousStatuses"), {
        count: known.length,
    });
    // HARDENED IN STEP 10 (2D): start heartbeat
    startHeartbeat();
    // ── Immediate scan loop ────────────────────────────────────────────────────
    var runImmediateScans = function () { return __awaiter(_this, void 0, void 0, function () {
        var pending, _i, pending_1, _a, airport_iata, interval, err_2;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    pending = (0, db_1.getAirportsNeedingImmediateScan)();
                    if (pending.length === 0)
                        return [2 /*return*/];
                    reconcileAirports(readCurrentIntervals());
                    _i = 0, pending_1 = pending;
                    _b.label = 1;
                case 1:
                    if (!(_i < pending_1.length)) return [3 /*break*/, 6];
                    _a = pending_1[_i], airport_iata = _a.airport_iata, interval = _a.interval;
                    (0, db_1.clearImmediateScanFlag)(airport_iata);
                    (0, logger_1.log)("info", "monitor", "Priority scan triggered for ".concat(airport_iata), {
                        airport: airport_iata,
                    });
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, pollAirport(airport_iata, interval)];
                case 3:
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _b.sent();
                    (0, logger_1.log)("error", "monitor", "[immediate] Error scanning ".concat(airport_iata), {
                        airport: airport_iata,
                        err: String(err_2),
                    });
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var immediateId = setInterval(function () { runImmediateScans().catch(function (err) { return (0, logger_1.log)("error", "monitor", "runImmediateScans error", { err: String(err) }); }); }, 10000);
    exports.activeIntervals.push(immediateId);
    var buckets = (0, db_1.getAirportScanBuckets)();
    if (buckets.length === 0) {
        (0, logger_1.log)("info", "monitor", "No active airport subscriptions found. Monitor idle — waiting for immediate-scan flags.");
        return;
    }
    // Build the initial airportGroups from startup buckets
    for (var _c = 0, buckets_1 = buckets; _c < buckets_1.length; _c++) {
        var _d = buckets_1[_c], airport_iata = _d.airport_iata, interval = _d.interval;
        var group = (_a = exports.airportGroups.get(interval)) !== null && _a !== void 0 ? _a : new Set();
        group.add(airport_iata);
        exports.airportGroups.set(interval, group);
    }
    // Start one setInterval per unique interval bucket
    Array.from(exports.airportGroups.keys()).forEach(function (intervalSec) {
        startIntervalForBucket(intervalSec);
        var airports = exports.airportGroups.get(intervalSec);
        if (airports) {
            airports.forEach(function (iata) {
                pollAirport(iata, intervalSec).catch(function (err) {
                    return (0, logger_1.log)("error", "monitor", "Unhandled error on startup poll of ".concat(iata), {
                        airport: iata,
                        err: String(err),
                    });
                });
            });
        }
    });
    // Hourly AeroDataBox time refresh — REMOVED: excessive API calls
    // The regular scan intervals already keep flight data current
    // Purge stale pending bookings every 30 minutes
    (0, db_1.purgeStalePendingBookings)();
    var purgeId = setInterval(function () {
        try {
            (0, db_1.purgeStalePendingBookings)();
        }
        catch (err) {
            (0, logger_1.log)("error", "monitor", "purgeStalePendingBookings error", { err: String(err) });
        }
    }, 30 * 60 * 1000);
    exports.activeIntervals.push(purgeId);
}
// Only auto-run when executed directly (not when imported by tests)
if (require.main === module) {
    main();
}
