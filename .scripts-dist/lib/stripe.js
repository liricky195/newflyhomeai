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
exports.assertStripeEnvVars = assertStripeEnvVars;
exports.getStripe = getStripe;
exports.createSubscriptionCheckout = createSubscriptionCheckout;
exports.createPortalSession = createPortalSession;
exports.upgradeSubscription = upgradeSubscription;
exports.downgradeSubscription = downgradeSubscription;
exports.cancelSubscription = cancelSubscription;
exports.reactivateSubscription = reactivateSubscription;
exports.getProrationPreview = getProrationPreview;
exports.handleWebhook = handleWebhook;
var stripe_1 = __importDefault(require("stripe"));
var db_1 = require("./db");
var logger_1 = require("./logger");
// ─── Stripe client ───────────────────────────────────────────────────────────
// HARDENED IN STEP 10: startup assertions
function assertStripeEnvVars() {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is required. Obtain from your Stripe dashboard (Developers → API keys).");
    }
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        throw new Error("STRIPE_WEBHOOK_SECRET is required. Obtain from your Stripe dashboard (Developers → Webhooks).");
    }
}
function getStripe() {
    var key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
        throw new Error("STRIPE_SECRET_KEY is required. Obtain from your Stripe dashboard (Developers → API keys).");
    }
    return new stripe_1.default(key, { apiVersion: "2024-04-10" });
}
// ─── Price ID → tier mapping ─────────────────────────────────────────────────
var PRICE_TIER_MAP = {};
function ensurePriceMap() {
    var std = process.env.STRIPE_PRICE_STANDARD;
    var pro = process.env.STRIPE_PRICE_PRO;
    var ult = process.env.STRIPE_PRICE_ULTIMATE;
    if (std)
        PRICE_TIER_MAP[std] = { tier: "standard" };
    if (pro)
        PRICE_TIER_MAP[pro] = { tier: "pro" };
    if (ult)
        PRICE_TIER_MAP[ult] = { tier: "ultimate" };
}
// ─── Subscription checkout ───────────────────────────────────────────────────
var TIER_PRICE_ENV = {
    standard: "STRIPE_PRICE_STANDARD",
    pro: "STRIPE_PRICE_PRO",
    ultimate: "STRIPE_PRICE_ULTIMATE",
};
function createSubscriptionCheckout(userId, tier) {
    return __awaiter(this, void 0, void 0, function () {
        var stripe, envVar, priceRef, baseUrl, lineItem, session;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    stripe = getStripe();
                    envVar = TIER_PRICE_ENV[tier];
                    priceRef = process.env[envVar];
                    if (!priceRef)
                        throw new Error("".concat(envVar, " is not set"));
                    baseUrl = (_a = process.env.NEXTAUTH_URL) !== null && _a !== void 0 ? _a : "http://localhost:3001";
                    lineItem = priceRef.startsWith("price_")
                        ? { price: priceRef, quantity: 1 }
                        : {
                            price_data: {
                                currency: "usd",
                                unit_amount: Math.round(parseFloat(priceRef) * 100),
                                recurring: { interval: "week" },
                                product_data: {
                                    name: "flyhome.ai ".concat(tier.charAt(0).toUpperCase() + tier.slice(1)),
                                },
                            },
                            quantity: 1,
                        };
                    return [4 /*yield*/, stripe.checkout.sessions.create({
                            mode: "subscription",
                            line_items: [lineItem],
                            success_url: "".concat(baseUrl, "/plans?session_id={CHECKOUT_SESSION_ID}"),
                            cancel_url: "".concat(baseUrl, "/plans"),
                            metadata: { userId: userId, tier: tier },
                            subscription_data: {
                                metadata: { userId: userId, tier: tier },
                            },
                        })];
                case 1:
                    session = _b.sent();
                    if (!session.url)
                        throw new Error("Stripe did not return a checkout URL");
                    return [2 /*return*/, session.url];
            }
        });
    });
}
// ─── Customer portal ─────────────────────────────────────────────────────────
function createPortalSession(stripeCustomerId) {
    return __awaiter(this, void 0, void 0, function () {
        var stripe, baseUrl, session;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    stripe = getStripe();
                    baseUrl = (_a = process.env.NEXTAUTH_URL) !== null && _a !== void 0 ? _a : "http://localhost:3001";
                    return [4 /*yield*/, stripe.billingPortal.sessions.create({
                            customer: stripeCustomerId,
                            return_url: "".concat(baseUrl, "/plans"),
                        })];
                case 1:
                    session = _b.sent();
                    return [2 /*return*/, session.url];
            }
        });
    });
}
// ─── Subscription lifecycle ──────────────────────────────────────────────────
function upgradeSubscription(stripeSubscriptionId, newPriceId) {
    return __awaiter(this, void 0, void 0, function () {
        var stripe, existing, itemId, updated, customerId, mapped, periodEnd;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    stripe = getStripe();
                    ensurePriceMap();
                    return [4 /*yield*/, stripe.subscriptions
                            .retrieve(stripeSubscriptionId)
                            .catch(rethrowIfNotSubscriptionMissing)];
                case 1:
                    existing = _c.sent();
                    itemId = (_a = existing.items.data[0]) === null || _a === void 0 ? void 0 : _a.id;
                    if (!itemId)
                        throw new Error("Subscription has no items");
                    return [4 /*yield*/, stripe.subscriptions.update(stripeSubscriptionId, {
                            items: [{ id: itemId, price: newPriceId }],
                            proration_behavior: "always_invoice",
                            billing_cycle_anchor: "unchanged",
                        })];
                case 2:
                    updated = _c.sent();
                    customerId = typeof updated.customer === "string" ? updated.customer : updated.customer.id;
                    mapped = PRICE_TIER_MAP[newPriceId];
                    if (!mapped)
                        throw new Error("No tier mapping for price ".concat(newPriceId));
                    periodEnd = (_b = updated.current_period_end) !== null && _b !== void 0 ? _b : null;
                    (0, db_1.initDb)();
                    (0, db_1.updateStripeSubscriptionTier)({
                        stripe_customer_id: customerId,
                        tier: mapped.tier,
                        status: "active",
                        stripe_subscription_id: updated.id,
                        current_period_end: periodEnd,
                    });
                    (0, db_1.setNextScanAtImmediateByStripeCustomer)(customerId);
                    return [2 /*return*/];
            }
        });
    });
}
function downgradeSubscription(stripeSubscriptionId, newPriceId) {
    return __awaiter(this, void 0, void 0, function () {
        var stripe, existing, itemId;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    stripe = getStripe();
                    return [4 /*yield*/, stripe.subscriptions
                            .retrieve(stripeSubscriptionId)
                            .catch(rethrowIfNotSubscriptionMissing)];
                case 1:
                    existing = _b.sent();
                    itemId = (_a = existing.items.data[0]) === null || _a === void 0 ? void 0 : _a.id;
                    if (!itemId)
                        throw new Error("Subscription has no items");
                    // DB is intentionally NOT updated here — the invoice.paid webhook finalises
                    // the tier change at the start of the next billing period.
                    return [4 /*yield*/, stripe.subscriptions.update(stripeSubscriptionId, {
                            items: [{ id: itemId, price: newPriceId }],
                            proration_behavior: "none",
                            billing_cycle_anchor: "unchanged",
                        })];
                case 2:
                    // DB is intentionally NOT updated here — the invoice.paid webhook finalises
                    // the tier change at the start of the next billing period.
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function rethrowIfNotSubscriptionMissing(err) {
    var stripeErr = err;
    if ((stripeErr === null || stripeErr === void 0 ? void 0 : stripeErr.code) === "resource_missing") {
        throw new Error("Subscription not found in Stripe — it may have been manually seeded for testing. " +
            "Use the Stripe Dashboard or CLI to create a real test subscription.");
    }
    throw err;
}
function cancelSubscription(stripeSubscriptionId) {
    return __awaiter(this, void 0, void 0, function () {
        var stripe, updated, customerId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    stripe = getStripe();
                    return [4 /*yield*/, stripe.subscriptions
                            .update(stripeSubscriptionId, { cancel_at_period_end: true })
                            .catch(rethrowIfNotSubscriptionMissing)];
                case 1:
                    updated = _a.sent();
                    customerId = typeof updated.customer === "string" ? updated.customer : updated.customer.id;
                    (0, db_1.initDb)();
                    (0, db_1.setCancelAtPeriodEnd)(customerId, 1);
                    return [2 /*return*/];
            }
        });
    });
}
function reactivateSubscription(stripeSubscriptionId) {
    return __awaiter(this, void 0, void 0, function () {
        var stripe, updated, customerId;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    stripe = getStripe();
                    return [4 /*yield*/, stripe.subscriptions
                            .update(stripeSubscriptionId, { cancel_at_period_end: false })
                            .catch(rethrowIfNotSubscriptionMissing)];
                case 1:
                    updated = _a.sent();
                    customerId = typeof updated.customer === "string" ? updated.customer : updated.customer.id;
                    (0, db_1.initDb)();
                    (0, db_1.setCancelAtPeriodEnd)(customerId, 0);
                    return [2 /*return*/];
            }
        });
    });
}
function getProrationPreview(stripeSubscriptionId, newPriceId) {
    return __awaiter(this, void 0, void 0, function () {
        var stripe, sub, customerId, itemId, upcoming;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    stripe = getStripe();
                    return [4 /*yield*/, stripe.subscriptions.retrieve(stripeSubscriptionId)];
                case 1:
                    sub = _b.sent();
                    customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
                    itemId = (_a = sub.items.data[0]) === null || _a === void 0 ? void 0 : _a.id;
                    if (!itemId)
                        throw new Error("Subscription has no items");
                    return [4 /*yield*/, stripe.invoices.createPreview({
                            customer: customerId,
                            subscription: stripeSubscriptionId,
                            subscription_details: {
                                items: [{ id: itemId, price: newPriceId }],
                                proration_date: Math.floor(Date.now() / 1000),
                            },
                        })];
                case 2:
                    upcoming = _b.sent();
                    return [2 /*return*/, { amountDueCents: upcoming.amount_due, currency: upcoming.currency }];
            }
        });
    });
}
// ─── Webhook handler ─────────────────────────────────────────────────────────
// HARDENED IN STEP 10 (1F): accepts string | Buffer — route uses request.text()
function handleWebhook(rawBody, signature) {
    return __awaiter(this, void 0, void 0, function () {
        var stripe, webhookSecret, event, _a, session, customerId, subscriptionId, userId, sub, _b, priceId, mapped, tier, periodEnd, sub, customerId, priceId, mapped, tier, subPeriodEnd, sub, customerId, inv, invParent, subscriptionRef, subscriptionId, customerId, lineItem, linePrice, priceId, mapped, sub, periodEnd;
        var _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
        return __generator(this, function (_v) {
            switch (_v.label) {
                case 0:
                    stripe = getStripe();
                    webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
                    if (!webhookSecret)
                        throw new Error("STRIPE_WEBHOOK_SECRET is not set");
                    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
                    (0, db_1.initDb)();
                    ensurePriceMap();
                    _a = event.type;
                    switch (_a) {
                        case "checkout.session.completed": return [3 /*break*/, 1];
                        case "customer.subscription.updated": return [3 /*break*/, 5];
                        case "customer.subscription.deleted": return [3 /*break*/, 6];
                        case "invoice.paid": return [3 /*break*/, 7];
                    }
                    return [3 /*break*/, 9];
                case 1:
                    session = event.data.object;
                    if (session.mode !== "subscription")
                        return [3 /*break*/, 10];
                    customerId = typeof session.customer === "string"
                        ? session.customer
                        : (_c = session.customer) === null || _c === void 0 ? void 0 : _c.id;
                    subscriptionId = typeof session.subscription === "string"
                        ? session.subscription
                        : (_d = session.subscription) === null || _d === void 0 ? void 0 : _d.id;
                    if (!customerId)
                        return [3 /*break*/, 10];
                    userId = (_e = session.metadata) === null || _e === void 0 ? void 0 : _e.userId;
                    if (userId) {
                        (0, db_1.linkStripeCustomer)(userId, customerId);
                    }
                    if (!subscriptionId) return [3 /*break*/, 3];
                    return [4 /*yield*/, stripe.subscriptions.retrieve(subscriptionId)];
                case 2:
                    _b = _v.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _b = null;
                    _v.label = 4;
                case 4:
                    sub = _b;
                    priceId = (_f = sub === null || sub === void 0 ? void 0 : sub.items.data[0]) === null || _f === void 0 ? void 0 : _f.price.id;
                    mapped = priceId ? PRICE_TIER_MAP[priceId] : undefined;
                    tier = (_g = mapped === null || mapped === void 0 ? void 0 : mapped.tier) !== null && _g !== void 0 ? _g : ((_j = (_h = session.metadata) === null || _h === void 0 ? void 0 : _h.tier) !== null && _j !== void 0 ? _j : "standard");
                    periodEnd = (_k = sub === null || sub === void 0 ? void 0 : sub.current_period_end) !== null && _k !== void 0 ? _k : null;
                    (0, db_1.updateStripeSubscriptionTier)({
                        stripe_customer_id: customerId,
                        tier: tier,
                        status: "active",
                        stripe_subscription_id: subscriptionId !== null && subscriptionId !== void 0 ? subscriptionId : null,
                        current_period_end: periodEnd,
                    });
                    (0, db_1.setNextScanAtImmediateByStripeCustomer)(customerId);
                    return [3 /*break*/, 10];
                case 5:
                    {
                        sub = event.data.object;
                        customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
                        priceId = (_l = sub.items.data[0]) === null || _l === void 0 ? void 0 : _l.price.id;
                        mapped = priceId ? PRICE_TIER_MAP[priceId] : undefined;
                        tier = (_m = mapped === null || mapped === void 0 ? void 0 : mapped.tier) !== null && _m !== void 0 ? _m : ((_p = (_o = sub.metadata) === null || _o === void 0 ? void 0 : _o.tier) !== null && _p !== void 0 ? _p : "standard");
                        subPeriodEnd = (_q = sub.current_period_end) !== null && _q !== void 0 ? _q : null;
                        (0, db_1.updateStripeSubscriptionTier)({
                            stripe_customer_id: customerId,
                            tier: tier,
                            status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled",
                            stripe_subscription_id: sub.id,
                            current_period_end: subPeriodEnd,
                        });
                        (0, db_1.setNextScanAtImmediateByStripeCustomer)(customerId);
                        return [3 /*break*/, 10];
                    }
                    _v.label = 6;
                case 6:
                    {
                        sub = event.data.object;
                        customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
                        (0, db_1.resetSubscriptionToFree)(customerId);
                        return [3 /*break*/, 10];
                    }
                    _v.label = 7;
                case 7:
                    inv = event.data.object;
                    invParent = inv.parent;
                    subscriptionRef = (_r = invParent === null || invParent === void 0 ? void 0 : invParent.subscription_details) === null || _r === void 0 ? void 0 : _r.subscription;
                    subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef === null || subscriptionRef === void 0 ? void 0 : subscriptionRef.id;
                    // Only process subscription invoices — skip one-time charges.
                    if (!subscriptionId)
                        return [3 /*break*/, 10];
                    customerId = typeof inv.customer === "string"
                        ? inv.customer
                        : (_s = inv.customer) === null || _s === void 0 ? void 0 : _s.id;
                    if (!customerId)
                        return [3 /*break*/, 10];
                    lineItem = inv.lines.data[0];
                    linePrice = (_t = lineItem === null || lineItem === void 0 ? void 0 : lineItem.pricing) === null || _t === void 0 ? void 0 : _t.price;
                    priceId = typeof linePrice === "string" ? linePrice : linePrice === null || linePrice === void 0 ? void 0 : linePrice.id;
                    ensurePriceMap();
                    mapped = priceId ? PRICE_TIER_MAP[priceId] : undefined;
                    // If the price isn't one of our known tiers, skip (e.g. one-time add-ons).
                    if (!mapped)
                        return [3 /*break*/, 10];
                    return [4 /*yield*/, stripe.subscriptions.retrieve(subscriptionId)];
                case 8:
                    sub = _v.sent();
                    periodEnd = (_u = sub.current_period_end) !== null && _u !== void 0 ? _u : null;
                    (0, db_1.updateStripeSubscriptionTier)({
                        stripe_customer_id: customerId,
                        tier: mapped.tier,
                        status: "active",
                        stripe_subscription_id: sub.id,
                        current_period_end: periodEnd,
                    });
                    (0, db_1.setNextScanAtImmediateByStripeCustomer)(customerId);
                    return [3 /*break*/, 10];
                case 9:
                    {
                        (0, logger_1.log)("info", "stripe", "Unhandled event type: ".concat(event.type));
                        return [3 /*break*/, 10];
                    }
                    _v.label = 10;
                case 10: return [2 /*return*/];
            }
        });
    });
}
