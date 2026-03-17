/**
 * Single canonical source of truth for tier-to-scan-interval mapping.
 * No other file may hardcode a tier-to-interval value.
 * All files must import getScanInterval() or TIER_INTERVALS from here.
 */
export const TIER_INTERVALS: Record<string, number> = {
  free: 600,     // 10 minutes
  standard: 180,  // 3 minutes
  pro: 60,        // 60 seconds
  ultimate: 30,   // 30 seconds
};

/**
 * Returns the scan interval in seconds for a given tier.
 * Falls back to the free-tier interval (600) for any unknown or null tier.
 * The ?? operator intentionally catches both null and undefined.
 */
export function getScanInterval(tier: string): number {
  return TIER_INTERVALS[tier] ?? TIER_INTERVALS.free;
}
