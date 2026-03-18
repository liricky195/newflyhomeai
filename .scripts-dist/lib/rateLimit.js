"use strict";
// HARDENED IN STEP 10: in-memory sliding window rate limiter
// No Redis or Upstash required — single-instance deployment.
// The map is module-level (process lifetime). On cold start the window resets.
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
exports.resetRateLimitStore = resetRateLimitStore;
var requests = new Map();
/**
 * Sliding-window rate limiter keyed by an arbitrary string.
 * Key format: "routeName:identifier" — e.g. "bookings_post:userId_abc"
 */
function rateLimit(key, maxRequests, windowMs) {
    var _a;
    var now = Date.now();
    var timestamps = (_a = requests.get(key)) !== null && _a !== void 0 ? _a : [];
    // Drop timestamps outside the current window
    var valid = timestamps.filter(function (t) { return now - t < windowMs; });
    if (valid.length >= maxRequests) {
        var oldest = valid[0];
        return { allowed: false, retryAfterMs: oldest + windowMs - now };
    }
    valid.push(now);
    requests.set(key, valid);
    return { allowed: true, retryAfterMs: 0 };
}
/** Exposed for testing — clears all rate limit state. */
function resetRateLimitStore() {
    requests.clear();
}
