/**
 * Structured logger. Replaces all console.log / console.error calls in
 * lib/ files, API routes, and the monitor daemon.
 *
 * Output format: JSON line to stdout (info/warn/debug) or stderr (error).
 */

// HARDENED IN STEP 10: added 'debug' level with production suppression
export type LogLevel = "info" | "warn" | "error" | "debug";

export function log(
  level: string,
  service: string,
  message: string,
  meta?: object
): void {
  // Suppress debug logs in production
  if (level === "debug" && process.env.NODE_ENV === "production") return;

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...meta,
  });

  if (level === "error") {
    process.stderr.write(entry + "\n");
  } else {
    process.stdout.write(entry + "\n");
  }
}

// HARDENED IN STEP 10: structured HTTP request logging
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  userId?: string
): void {
  log("info", "http", `${method} ${path} ${statusCode}`, {
    method,
    path,
    statusCode,
    durationMs,
    ...(userId !== undefined && { userId }),
  });
}
