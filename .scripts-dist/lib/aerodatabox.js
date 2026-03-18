"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
exports.mapStatus = mapStatus;
exports.mapFlight = mapFlight;
exports.getFlightsByAirport = getFlightsByAirport;
var lastRequestTime = 0;
var MIN_DELAY_MS = 2000;
function rateLimit() {
    return __awaiter(this, void 0, void 0, function () {
        var now, elapsed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    elapsed = now - lastRequestTime;
                    if (!(elapsed < MIN_DELAY_MS)) return [3 /*break*/, 2];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, MIN_DELAY_MS - elapsed); })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    lastRequestTime = Date.now();
                    return [2 /*return*/];
            }
        });
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// ApiError
// ─────────────────────────────────────────────────────────────────────────────
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(httpStatus, apiMessage) {
        var _this = _super.call(this, "AeroDataBox API error ".concat(httpStatus, ": ").concat(apiMessage)) || this;
        _this.name = "ApiError";
        _this.httpStatus = httpStatus;
        _this.apiMessage = apiMessage;
        return _this;
    }
    return ApiError;
}(Error));
exports.ApiError = ApiError;
// ─────────────────────────────────────────────────────────────────────────────
// Status mapping
// ─────────────────────────────────────────────────────────────────────────────
var STATUS_MAP = {
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
function mapStatus(raw) {
    var _a;
    return (_a = STATUS_MAP[raw]) !== null && _a !== void 0 ? _a : "scheduled";
}
function mapFlight(raw, airportIata) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    var movement = (_a = raw.movement) !== null && _a !== void 0 ? _a : raw.departure;
    if (!((_b = movement === null || movement === void 0 ? void 0 : movement.scheduledTime) === null || _b === void 0 ? void 0 : _b.utc))
        return null;
    var scheduledEpoch = Math.floor(new Date(movement.scheduledTime.utc).getTime() / 1000);
    if (Number.isNaN(scheduledEpoch))
        return null;
    var estimatedEpoch = ((_c = movement.revisedTime) === null || _c === void 0 ? void 0 : _c.utc)
        ? Math.floor(new Date(movement.revisedTime.utc).getTime() / 1000)
        : null;
    var destinationIata = (_e = (_d = raw.arrival) === null || _d === void 0 ? void 0 : _d.airport) === null || _e === void 0 ? void 0 : _e.iata;
    // Skip flights with no known destination — can't display or book them
    if (!destinationIata)
        return null;
    return {
        id: "".concat(raw.number, "-").concat(movement.scheduledTime.utc),
        flight_number: raw.number,
        airline: (_g = (_f = raw.airline) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : "Unknown",
        departure_airport: (_j = (_h = movement.airport) === null || _h === void 0 ? void 0 : _h.iata) !== null && _j !== void 0 ? _j : airportIata,
        destination_airport: destinationIata,
        scheduled_departure: scheduledEpoch,
        estimated_departure: estimatedEpoch !== null && !Number.isNaN(estimatedEpoch)
            ? estimatedEpoch
            : null,
        status: mapStatus(raw.status),
        aircraft_type: (_l = (_k = raw.aircraft) === null || _k === void 0 ? void 0 : _k.model) !== null && _l !== void 0 ? _l : null,
        bookable: 1,
        lowest_price_cents: null,
        price_currency: null,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
// Trailing slash is required so that new URL('flights/...', BASE_URL) resolves
// to https://prod.api.market/api/v1/aedbx/aerodatabox/flights/... rather than
// stripping the last path segment (standard URL resolution behaviour).
var BASE_URL = "https://prod.api.market/api/v1/aedbx/aerodatabox/";
// AeroDataBox FIDS endpoint enforces a 12-hour max window per call.
// We split the desired +1 h → +48 h range into four consecutive 12-hour slices.
var MAX_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Format a Date as YYYY-MM-DDTHH:mm (no seconds, no timezone suffix). */
function fmtLocal(d) {
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return ("".concat(d.getUTCFullYear(), "-").concat(pad(d.getUTCMonth() + 1), "-").concat(pad(d.getUTCDate())) +
        "T".concat(pad(d.getUTCHours()), ":").concat(pad(d.getUTCMinutes())));
}
function fetchWindowRaw(airportIata, apiKey, from, to) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, body, data;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    url = new URL("flights/airports/iata/".concat(encodeURIComponent(airportIata), "/").concat(fmtLocal(from), "/").concat(fmtLocal(to)), BASE_URL);
                    url.searchParams.set("direction", "Departure");
                    url.searchParams.set("withLeg", "true");
                    url.searchParams.set("withCancelled", "true");
                    url.searchParams.set("withCodeshared", "false");
                    url.searchParams.set("withCargo", "false");
                    url.searchParams.set("withPrivate", "false");
                    return [4 /*yield*/, rateLimit()];
                case 1:
                    _b.sent(); // Rate limit to avoid 429 errors
                    return [4 /*yield*/, fetch(url.toString(), {
                            method: "GET",
                            headers: {
                                "x-magicapi-key": apiKey,
                                Accept: "application/json",
                            },
                        })];
                case 2:
                    res = _b.sent();
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.text().catch(function () { return ""; })];
                case 3:
                    body = _b.sent();
                    throw new ApiError(res.status, body);
                case 4: return [4 /*yield*/, res.json()];
                case 5:
                    data = _b.sent();
                    return [2 /*return*/, (_a = data.departures) !== null && _a !== void 0 ? _a : []];
            }
        });
    });
}
function getFlightsByAirport(airportIata) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, now, rangeStart, rangeEnd, seen, results, cursor, windowEnd, raw, _i, raw_1, entry, flight;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    apiKey = process.env.AERODATABOX_API_KEY;
                    if (!apiKey) {
                        throw new Error("AERODATABOX_API_KEY is not set in environment variables");
                    }
                    now = new Date();
                    rangeStart = now.getTime();
                    rangeEnd = now.getTime() + 48 * 60 * 60 * 1000;
                    seen = new Set();
                    results = [];
                    cursor = rangeStart;
                    _a.label = 1;
                case 1:
                    if (!(cursor < rangeEnd)) return [3 /*break*/, 3];
                    windowEnd = Math.min(cursor + MAX_WINDOW_MS, rangeEnd);
                    return [4 /*yield*/, fetchWindowRaw(airportIata, apiKey, new Date(cursor), new Date(windowEnd))];
                case 2:
                    raw = _a.sent();
                    for (_i = 0, raw_1 = raw; _i < raw_1.length; _i++) {
                        entry = raw_1[_i];
                        flight = mapFlight(entry, airportIata);
                        if (flight && !seen.has(flight.id)) {
                            seen.add(flight.id);
                            results.push(flight);
                        }
                    }
                    cursor = windowEnd;
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/, results];
            }
        });
    });
}
