"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_INTERVALS = void 0;
exports.getScanInterval = getScanInterval;
/**
 * Single canonical source of truth for tier-to-scan-interval mapping.
 * No other file may hardcode a tier-to-interval value.
 * All files must import getScanInterval() or TIER_INTERVALS from here.
 */
exports.TIER_INTERVALS = {
    free: 600, // 10 minutes
    standard: 180, // 3 minutes
    pro: 60, // 60 seconds
    ultimate: 30, // 30 seconds
};
/**
 * Returns the scan interval in seconds for a given tier.
 * Falls back to the free-tier interval (600) for any unknown or null tier.
 * The ?? operator intentionally catches both null and undefined.
 */
function getScanInterval(tier) {
    var _a;
    return (_a = exports.TIER_INTERVALS[tier]) !== null && _a !== void 0 ? _a : exports.TIER_INTERVALS.free;
}
