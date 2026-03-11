// HARDENED IN STEP 10: CORS origin validation

/**
 * Returns CORS response headers.
 *
 * @param origin  The request Origin header value (null if absent).
 * @param unrestricted  When true, always return CORS headers regardless of
 *                      origin (used for /api/health, /api/auth/*, /api/webhooks/stripe).
 *                      When false (default), only return headers when origin
 *                      exactly matches NEXTAUTH_URL.
 */
export function corsHeaders(
  origin: string | null,
  unrestricted = false
): Record<string, string> {
  const allowed = process.env.NEXTAUTH_URL;

  if (!unrestricted && (!allowed || !origin || origin !== allowed)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}
