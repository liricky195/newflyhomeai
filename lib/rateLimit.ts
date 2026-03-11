// HARDENED IN STEP 10: in-memory sliding window rate limiter
// No Redis or Upstash required — single-instance deployment.
// The map is module-level (process lifetime). On cold start the window resets.

const requests = new Map<string, number[]>();

/**
 * Sliding-window rate limiter keyed by an arbitrary string.
 * Key format: "routeName:identifier" — e.g. "bookings_post:userId_abc"
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const timestamps = requests.get(key) ?? [];

  // Drop timestamps outside the current window
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= maxRequests) {
    const oldest = valid[0];
    return { allowed: false, retryAfterMs: oldest + windowMs - now };
  }

  valid.push(now);
  requests.set(key, valid);
  return { allowed: true, retryAfterMs: 0 };
}

/** Exposed for testing — clears all rate limit state. */
export function resetRateLimitStore(): void {
  requests.clear();
}
