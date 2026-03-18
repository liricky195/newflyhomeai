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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Step2CancellationError = exports.ApiError = void 0;
exports.createDuffelLink = createDuffelLink;
exports.createComponentClientKey = createComponentClientKey;
exports.createOrderWithCard = createOrderWithCard;
exports.fetchDuffelOrder = fetchDuffelOrder;
exports.checkFlightBookable = checkFlightBookable;
exports.searchOffers = searchOffers;
exports.createOrder = createOrder;
exports.validatePassengers = validatePassengers;
exports.requestUserCancellation = requestUserCancellation;
exports.cancelOrder = cancelOrder;
exports.clearBookabilityCache = clearBookabilityCache;
var BASE_URL = "https://api.duffel.com";
// Rate limiting: Duffel API has strict rate limits
var duffelLastRequestTime = 0;
var DUFFEL_MIN_DELAY_MS = 1000; // 500ms between requests (2 req/sec max)
function duffelRateLimit() {
    return __awaiter(this, void 0, void 0, function () {
        var now, elapsed;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    now = Date.now();
                    elapsed = now - duffelLastRequestTime;
                    if (!(elapsed < DUFFEL_MIN_DELAY_MS)) return [3 /*break*/, 2];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, DUFFEL_MIN_DELAY_MS - elapsed); })];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2:
                    duffelLastRequestTime = Date.now();
                    return [2 /*return*/];
            }
        });
    });
}
function getApiKey() {
    // HARDENED IN STEP 10: startup assertion
    var key = process.env.DUFFEL_API_KEY;
    if (!key) {
        throw new Error("DUFFEL_API_KEY is required. Obtain from your Duffel dashboard.");
    }
    return key;
}
function headers() {
    return {
        Authorization: "Bearer ".concat(getApiKey()),
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        Accept: "application/json",
    };
}
// ─── Types ───────────────────────────────────────────────────────────────────
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(httpStatus, apiMessage) {
        var _this = _super.call(this, "Duffel API error ".concat(httpStatus, ": ").concat(apiMessage)) || this;
        _this.httpStatus = httpStatus;
        _this.apiMessage = apiMessage;
        _this.name = "ApiError";
        return _this;
    }
    return ApiError;
}(Error));
exports.ApiError = ApiError;
/**
 * Thrown when step 2 (confirm) of requestUserCancellation fails.
 * Carries the cancellationId from step 1 so the caller can persist it.
 */
var Step2CancellationError = /** @class */ (function (_super) {
    __extends(Step2CancellationError, _super);
    function Step2CancellationError(cancellationId, cause) {
        var _a;
        var _this = _super.call(this, (_a = cause === null || cause === void 0 ? void 0 : cause.message) !== null && _a !== void 0 ? _a : "Cancellation confirmation failed") || this;
        _this.cancellationId = cancellationId;
        _this.cause = cause;
        _this.name = "Step2CancellationError";
        return _this;
    }
    return Step2CancellationError;
}(Error));
exports.Step2CancellationError = Step2CancellationError;
// Persist the cache across Next.js hot-reloads in development.
// In production each worker process keeps its own Map, which is fine.
var _g = globalThis;
(_a = _g._bookabilityCache) !== null && _a !== void 0 ? _a : (_g._bookabilityCache = new Map());
var bookabilityCache = _g._bookabilityCache;
var CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
// ─── API helpers ─────────────────────────────────────────────────────────────
function duffelFetch(path_1) {
    return __awaiter(this, arguments, void 0, function (path, options) {
        var res, text;
        var _a;
        if (options === void 0) { options = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, duffelRateLimit()];
                case 1:
                    _b.sent(); // Rate limit to avoid 429 errors
                    return [4 /*yield*/, fetch("".concat(BASE_URL).concat(path), __assign(__assign({}, options), { headers: __assign(__assign({}, headers()), ((_a = options.headers) !== null && _a !== void 0 ? _a : {})) }))];
                case 2:
                    res = _b.sent();
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.text().catch(function () { return "Unknown error"; })];
                case 3:
                    text = _b.sent();
                    throw new ApiError(res.status, text);
                case 4: return [4 /*yield*/, res.json()];
                case 5: return [2 /*return*/, (_b.sent())];
            }
        });
    });
}
// ─── Public functions ────────────────────────────────────────────────────────
function createDuffelLink(params) {
    return __awaiter(this, void 0, void 0, function () {
        var expiresAt, res;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                    return [4 /*yield*/, duffelFetch("/links/sessions", {
                            method: "POST",
                            body: JSON.stringify({
                                data: {
                                    offer_id: params.offerId,
                                    reference: params.reference,
                                    expires_at: expiresAt,
                                    success_url: params.successUrl,
                                    abandon_url: params.abandonUrl,
                                },
                            }),
                        })];
                case 1:
                    res = _b.sent();
                    if (!((_a = res.data) === null || _a === void 0 ? void 0 : _a.url)) {
                        throw new ApiError(0, "Malformed Duffel Links response");
                    }
                    return [2 /*return*/, {
                            id: res.data.id,
                            url: res.data.url,
                            expiresAt: res.data.expires_at,
                        }];
            }
        });
    });
}
function createComponentClientKey() {
    return __awaiter(this, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, duffelFetch("/identity/component_client_keys", { method: "POST", body: "{}" })];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res.data.component_client_key];
            }
        });
    });
}
function createOrderWithCard(params) {
    return __awaiter(this, void 0, void 0, function () {
        var data;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, duffelFetch("/air/orders", {
                        method: "POST",
                        body: JSON.stringify({
                            data: {
                                type: "instant",
                                selected_offers: [params.offerId],
                                passengers: params.passengers.map(function (p, i) {
                                    var _a, _b, _c, _d;
                                    return (__assign(__assign({ id: "pas_".concat(i), type: p.type, given_name: p.given_name, family_name: p.family_name, born_on: p.born_on, gender: (_a = p.gender) !== null && _a !== void 0 ? _a : "m", title: (_b = p.title) !== null && _b !== void 0 ? _b : "mr" }, (p.phone_number ? { phone_number: p.phone_number } : {})), (p.passport_number
                                        ? {
                                            identity_documents: [
                                                {
                                                    type: "passport",
                                                    unique_identifier: p.passport_number,
                                                    issuing_country_code: (_c = p.nationality) !== null && _c !== void 0 ? _c : "GB",
                                                    expires_on: (_d = p.passport_expiry) !== null && _d !== void 0 ? _d : "2030-01-01",
                                                },
                                            ],
                                        }
                                        : {})));
                                }),
                                payments: [
                                    {
                                        type: "card",
                                        amount: params.amount,
                                        currency: params.currency,
                                        three_d_secure_session_id: params.threeDSecureSessionId,
                                    },
                                ],
                            },
                        }),
                    })];
                case 1:
                    data = _d.sent();
                    return [2 /*return*/, {
                            id: data.data.id,
                            booking_reference: data.data.booking_reference,
                            ticket_number: (_c = (_b = (_a = data.data.documents) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.document_number) !== null && _c !== void 0 ? _c : null,
                            status: data.data.status,
                        }];
            }
        });
    });
}
function fetchDuffelOrder(orderId) {
    return __awaiter(this, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, duffelFetch("/air/orders/".concat(orderId))];
                case 1:
                    res = _a.sent();
                    return [2 /*return*/, res.data];
            }
        });
    });
}
function checkFlightBookable(flightNumber, departureDate, origin, destination) {
    return __awaiter(this, void 0, void 0, function () {
        var today, cacheKey, cached, normalize, data, allOffers, targetFlight_1, offers, bookable, prices, lowestPriceCents, currency, result, err_1, msg;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    // Skip flights with no known destination — cannot search Duffel without one.
                    if (destination === "Unknown") {
                        return [2 /*return*/, { bookable: false, lowestPriceCents: null, currency: null }];
                    }
                    today = new Date().toISOString().slice(0, 10);
                    if (departureDate <= today) {
                        return [2 /*return*/, { bookable: false, lowestPriceCents: null, currency: null }];
                    }
                    cacheKey = "".concat(flightNumber, "-").concat(departureDate);
                    cached = bookabilityCache.get(cacheKey);
                    if (cached && Date.now() < cached.expiresAt) {
                        return [2 /*return*/, { bookable: cached.bookable, lowestPriceCents: cached.lowestPriceCents, currency: cached.currency }];
                    }
                    normalize = function (s) { return s.trim().toUpperCase().replace(/\s+/g, ""); };
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, duffelFetch("/air/offer_requests", {
                            method: "POST",
                            body: JSON.stringify({
                                data: {
                                    slices: [{ origin: origin, destination: destination, departure_date: departureDate }],
                                    passengers: [{ type: "adult" }],
                                    cabin_class: "economy",
                                    return_offers: true,
                                },
                            }),
                        })];
                case 2:
                    data = _c.sent();
                    allOffers = Array.isArray(data.data.offers) ? data.data.offers : [];
                    targetFlight_1 = normalize(flightNumber);
                    offers = allOffers.filter(function (o) {
                        var _a, _b, _c;
                        var segs = (_c = (_b = (_a = o.slices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.segments) !== null && _c !== void 0 ? _c : [];
                        if (segs.length !== 1)
                            return false; // nonstop only
                        var seg = segs[0];
                        var marketing = normalize("".concat(seg.marketing_carrier.iata_code).concat(seg.marketing_carrier_flight_number));
                        var operating = seg.operating_carrier && seg.operating_carrier_flight_number
                            ? normalize("".concat(seg.operating_carrier.iata_code).concat(seg.operating_carrier_flight_number))
                            : null;
                        return marketing === targetFlight_1 || operating === targetFlight_1;
                    });
                    bookable = offers.length > 0;
                    prices = offers
                        .map(function (o) { return Math.round(parseFloat(o.total_amount) * 100); })
                        .filter(function (p) { return !isNaN(p); });
                    lowestPriceCents = prices.length > 0 ? Math.min.apply(Math, prices) : null;
                    currency = (_b = (_a = offers[0]) === null || _a === void 0 ? void 0 : _a.total_currency) !== null && _b !== void 0 ? _b : null;
                    result = { bookable: bookable, lowestPriceCents: lowestPriceCents, currency: currency };
                    // Only cache confirmed results (successful Duffel response).
                    bookabilityCache.set(cacheKey, __assign(__assign({}, result), { expiresAt: Date.now() + CACHE_TTL_MS }));
                    return [2 /*return*/, result];
                case 3:
                    err_1 = _c.sent();
                    // 429 rate-limit: Duffel could not confirm bookability. Fail closed so the flight
                    // is hidden rather than shown with no price. Do NOT cache — retry on next scan.
                    if (err_1 instanceof ApiError && err_1.httpStatus === 429) {
                        console.warn("[bookabilityCheck] Rate-limited for ".concat(flightNumber, " \u2014 marking non-bookable until next scan."));
                        return [2 /*return*/, { bookable: false, lowestPriceCents: null, currency: null }];
                    }
                    // Duffel rejects same-day searches with 422 on some routes. Treat as non-bookable.
                    if (err_1 instanceof ApiError && err_1.httpStatus === 422) {
                        msg = err_1.apiMessage.toLowerCase();
                        if (msg.includes("past") || msg.includes("today") || msg.includes("future")) {
                            return [2 /*return*/, { bookable: false, lowestPriceCents: null, currency: null }];
                        }
                    }
                    // All other errors (network timeout, 5xx): fail open so a transient outage does not
                    // hide potentially bookable flights. Do NOT cache — retry on next scan.
                    console.error("[bookabilityCheck] Error for ".concat(flightNumber, ":"), err_1.message);
                    return [2 /*return*/, { bookable: true, lowestPriceCents: null, currency: null }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function searchOffers(flightNumber, departureDate, origin, destination, passengers) {
    return __awaiter(this, void 0, void 0, function () {
        var offerReqRes, allOffersList, nonstopOffers, normalize, targetFlight, fnFilteredOffers, offersList;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    return [4 /*yield*/, duffelFetch("/air/offer_requests", {
                            method: "POST",
                            body: JSON.stringify({
                                data: {
                                    slices: [{ origin: origin, destination: destination, departure_date: departureDate }],
                                    passengers: passengers.map(function (p) { return ({ type: p.type }); }),
                                    cabin_class: "economy",
                                    return_offers: true,
                                },
                            }),
                        })];
                case 1:
                    offerReqRes = _b.sent();
                    allOffersList = (_a = offerReqRes.data.offers) !== null && _a !== void 0 ? _a : [];
                    nonstopOffers = allOffersList.filter(function (o) { var _a, _b, _c, _d; return ((_d = (_c = (_b = (_a = o.slices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.segments) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0 ? _d : 1) === 1; });
                    normalize = function (s) { return s.trim().toUpperCase().replace(/\s+/g, ""); };
                    targetFlight = normalize(flightNumber);
                    fnFilteredOffers = nonstopOffers.filter(function (o) {
                        var _a, _b, _c;
                        var seg = (_c = (_b = (_a = o.slices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.segments) === null || _c === void 0 ? void 0 : _c[0];
                        if (!seg)
                            return false;
                        var marketing = normalize("".concat(seg.marketing_carrier.iata_code).concat(seg.marketing_carrier_flight_number));
                        var operating = seg.operating_carrier && seg.operating_carrier_flight_number
                            ? normalize("".concat(seg.operating_carrier.iata_code).concat(seg.operating_carrier_flight_number))
                            : null;
                        return marketing === targetFlight || operating === targetFlight;
                    });
                    offersList = fnFilteredOffers;
                    return [2 /*return*/, offersList.map(function (offer) {
                            var _a, _b, _c, _d, _e, _f, _h, _j, _k, _l, _m;
                            var firstSlice = offer.slices[0];
                            var firstSeg = firstSlice === null || firstSlice === void 0 ? void 0 : firstSlice.segments[0];
                            var lastSeg = firstSlice === null || firstSlice === void 0 ? void 0 : firstSlice.segments[firstSlice.segments.length - 1];
                            // Cancellation / change conditions — present on inline offers; may have null penalty
                            // amounts on some carriers even when `allowed` is known.
                            var cond = offer.conditions;
                            var conditions = {
                                refund_before_departure: (cond === null || cond === void 0 ? void 0 : cond.refund_before_departure)
                                    ? {
                                        allowed: cond.refund_before_departure.allowed,
                                        penalty_amount: (_a = cond.refund_before_departure.penalty_amount) !== null && _a !== void 0 ? _a : null,
                                        penalty_currency: (_b = cond.refund_before_departure.penalty_currency) !== null && _b !== void 0 ? _b : null,
                                    }
                                    : null,
                                change_before_departure: (cond === null || cond === void 0 ? void 0 : cond.change_before_departure)
                                    ? {
                                        allowed: cond.change_before_departure.allowed,
                                        penalty_amount: (_c = cond.change_before_departure.penalty_amount) !== null && _c !== void 0 ? _c : null,
                                        penalty_currency: (_d = cond.change_before_departure.penalty_currency) !== null && _d !== void 0 ? _d : null,
                                    }
                                    : null,
                            };
                            // Baggage — Duffel path: slices[].segments[].passengers[].baggages[]
                            // For a nonstop single-adult search we aggregate across all segments so the
                            // displayed allowance reflects the full journey (not just the first leg).
                            // Quantities are summed per type; weight is taken from the first occurrence.
                            var bagMap = new Map();
                            for (var _i = 0, _o = offer.slices; _i < _o.length; _i++) {
                                var slice = _o[_i];
                                for (var _p = 0, _q = slice.segments; _p < _q.length; _p++) {
                                    var seg = _q[_p];
                                    for (var _r = 0, _s = (_e = seg.passengers) !== null && _e !== void 0 ? _e : []; _r < _s.length; _r++) {
                                        var pax = _s[_r];
                                        for (var _t = 0, _u = (_f = pax.baggages) !== null && _f !== void 0 ? _f : []; _t < _u.length; _t++) {
                                            var b = _u[_t];
                                            var existing = bagMap.get(b.type);
                                            if (existing) {
                                                existing.quantity += b.quantity;
                                                if (existing.max_weight_kg === null && b.max_weight_kg != null) {
                                                    existing.max_weight_kg = b.max_weight_kg;
                                                }
                                            }
                                            else {
                                                bagMap.set(b.type, {
                                                    quantity: b.quantity,
                                                    max_weight_kg: (_h = b.max_weight_kg) !== null && _h !== void 0 ? _h : null,
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            var baggages = Array.from(bagMap.entries()).map(function (_a) {
                                var type = _a[0], v = _a[1];
                                return ({
                                    type: type,
                                    quantity: v.quantity,
                                    max_weight_kg: v.max_weight_kg,
                                });
                            });
                            return {
                                id: offer.id,
                                airline: offer.owner.iata_code,
                                airline_name: offer.owner.name,
                                departure_time: (_j = firstSeg === null || firstSeg === void 0 ? void 0 : firstSeg.departing_at) !== null && _j !== void 0 ? _j : "",
                                arrival_time: (_k = lastSeg === null || lastSeg === void 0 ? void 0 : lastSeg.arriving_at) !== null && _k !== void 0 ? _k : "",
                                duration: (_l = firstSlice === null || firstSlice === void 0 ? void 0 : firstSlice.duration) !== null && _l !== void 0 ? _l : "",
                                cabin_class: "economy",
                                amount: offer.total_amount,
                                currency: offer.total_currency,
                                stops: Math.max(0, ((_m = firstSlice === null || firstSlice === void 0 ? void 0 : firstSlice.segments.length) !== null && _m !== void 0 ? _m : 1) - 1),
                                conditions: conditions,
                                baggages: baggages,
                            };
                        })];
            }
        });
    });
}
function createOrder(offerId, passengers) {
    return __awaiter(this, void 0, void 0, function () {
        var data;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, duffelFetch("/air/orders", {
                        method: "POST",
                        body: JSON.stringify({
                            data: {
                                type: "instant",
                                selected_offers: [offerId],
                                passengers: passengers.map(function (p, i) {
                                    var _a, _b, _c, _d;
                                    return (__assign(__assign({ id: "pas_".concat(i), type: p.type, given_name: p.given_name, family_name: p.family_name, born_on: p.born_on, gender: (_a = p.gender) !== null && _a !== void 0 ? _a : "m", title: (_b = p.title) !== null && _b !== void 0 ? _b : "mr" }, (p.phone_number ? { phone_number: p.phone_number } : {})), (p.passport_number
                                        ? {
                                            identity_documents: [
                                                {
                                                    type: "passport",
                                                    unique_identifier: p.passport_number,
                                                    issuing_country_code: (_c = p.nationality) !== null && _c !== void 0 ? _c : "GB",
                                                    expires_on: (_d = p.passport_expiry) !== null && _d !== void 0 ? _d : "2030-01-01",
                                                },
                                            ],
                                        }
                                        : {})));
                                }),
                                payments: [
                                    {
                                        type: "balance",
                                        amount: "0",
                                        currency: "GBP",
                                    },
                                ],
                            },
                        }),
                    })];
                case 1:
                    data = _d.sent();
                    return [2 /*return*/, {
                            id: data.data.id,
                            booking_reference: data.data.booking_reference,
                            ticket_number: (_c = (_b = (_a = data.data.documents) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.document_number) !== null && _c !== void 0 ? _c : null,
                            status: data.data.status,
                        }];
            }
        });
    });
}
/**
 * Dry-run passenger validation against Duffel sandbox.
 * Only executes if DUFFEL_API_KEY starts with "duffel_test_".
 * In production, Zod is the gate — live order creation must not happen here.
 */
function validatePassengers(offerId, passengers) {
    return __awaiter(this, void 0, void 0, function () {
        var key, err_2, msgs, parsed;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    key = (_a = process.env.DUFFEL_API_KEY) !== null && _a !== void 0 ? _a : "";
                    if (!key.startsWith("duffel_test_")) {
                        return [2 /*return*/, { valid: true, errors: [] }];
                    }
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, duffelFetch("/air/orders", {
                            method: "POST",
                            body: JSON.stringify({
                                data: {
                                    type: "instant",
                                    selected_offers: [offerId],
                                    passengers: passengers.map(function (p, i) {
                                        var _a, _b, _c, _d;
                                        return (__assign(__assign({ id: "pas_".concat(i), type: p.type, given_name: p.given_name, family_name: p.family_name, born_on: p.born_on, gender: (_a = p.gender) !== null && _a !== void 0 ? _a : "m", title: (_b = p.title) !== null && _b !== void 0 ? _b : "mr" }, (p.phone_number ? { phone_number: p.phone_number } : {})), (p.passport_number
                                            ? {
                                                identity_documents: [
                                                    {
                                                        type: "passport",
                                                        unique_identifier: p.passport_number,
                                                        issuing_country_code: (_c = p.nationality) !== null && _c !== void 0 ? _c : "GB",
                                                        expires_on: (_d = p.passport_expiry) !== null && _d !== void 0 ? _d : "2030-01-01",
                                                    },
                                                ],
                                            }
                                            : {})));
                                    }),
                                    payments: [{ type: "balance", amount: "0", currency: "GBP" }],
                                },
                            }),
                        })];
                case 2:
                    _c.sent();
                    return [2 /*return*/, { valid: true, errors: [] }];
                case 3:
                    err_2 = _c.sent();
                    if (err_2 instanceof ApiError && err_2.httpStatus === 422) {
                        msgs = [];
                        try {
                            parsed = JSON.parse(err_2.apiMessage);
                            msgs = ((_b = parsed.errors) !== null && _b !== void 0 ? _b : [])
                                .map(function (e) { var _a; return (_a = e.message) !== null && _a !== void 0 ? _a : ""; })
                                .filter(Boolean);
                        }
                        catch (_d) {
                            msgs = [err_2.apiMessage];
                        }
                        return [2 /*return*/, { valid: false, errors: msgs }];
                    }
                    // Non-422 errors (network, auth, etc.) — fail open so the booking can proceed
                    console.error("[validatePassengers] Non-422 error:", err_2);
                    return [2 /*return*/, { valid: true, errors: [] }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * User-initiated cancellation: two-step quote-then-confirm flow.
 * Step 1: POST /air/order_cancellations — creates a cancellation quote.
 * Step 2: POST /air/order_cancellations/{id}/actions/confirm — confirms the cancellation.
 * Returns the confirmed DuffelOrderCancellation. Never swallows errors.
 * Do NOT use this for airline-initiated cancellations — use cancelOrder for those.
 */
function requestUserCancellation(duffelOrderId) {
    return __awaiter(this, void 0, void 0, function () {
        var quoteRes, cancellationId, confirmRes, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, duffelFetch("/air/order_cancellations", {
                        method: "POST",
                        body: JSON.stringify({ data: { order_id: duffelOrderId } }),
                    })];
                case 1:
                    quoteRes = _a.sent();
                    cancellationId = quoteRes.data.id;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, duffelFetch("/air/order_cancellations/".concat(cancellationId, "/actions/confirm"), {
                            method: "POST",
                            body: JSON.stringify({}),
                        })];
                case 3:
                    confirmRes = _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_3 = _a.sent();
                    throw new Step2CancellationError(cancellationId, err_3);
                case 5: return [2 /*return*/, confirmRes.data];
            }
        });
    });
}
/**
 * Cancels a Duffel order. Ignores 404 (already cancelled), re-throws on other errors.
 */
function cancelOrder(duffelOrderId) {
    return __awaiter(this, void 0, void 0, function () {
        var err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, duffelFetch("/air/orders/".concat(duffelOrderId), { method: "DELETE" })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_4 = _a.sent();
                    if (err_4 instanceof ApiError && err_4.httpStatus === 404) {
                        console.warn("[cancelOrder] Order ".concat(duffelOrderId, " not found \u2014 already cancelled."));
                        return [2 /*return*/];
                    }
                    throw err_4;
                case 3: return [2 /*return*/];
            }
        });
    });
}
/** Clears the bookability cache — useful for tests. */
function clearBookabilityCache() {
    bookabilityCache.clear();
}
