/**
 * 4W — GET /api/health (existing tests)
 * 4L — logRequest assertions (added in Step 10)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetDb = vi.fn();
const mockInitDb = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  getDb: () => mockGetDb(),
}));

// HARDENED IN STEP 10: mock logger to capture logRequest calls
const mockLogRequest = vi.fn();
vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
  logRequest: (...a: unknown[]) => mockLogRequest(...a),
}));

import { GET, OPTIONS } from "@/app/api/health/route";

function makeReq() {
  return new Request("http://localhost/api/health") as any;
}

function makeDbWithQuery(impl: () => unknown) {
  return {
    prepare: () => ({ get: impl }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInitDb.mockReturnValue(undefined);
});

describe("GET /api/health (4W)", () => {
  it("DB reachable -> 200 { status: 'ok', db: 'connected', timestamp: ISO string }", async () => {
    mockGetDb.mockReturnValue(makeDbWithQuery(() => ({ version: 14 })));

    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.db).toBe("connected");
    expect(typeof body.timestamp).toBe("string");
  });

  it("timestamp is a valid ISO 8601 string", async () => {
    mockGetDb.mockReturnValue(makeDbWithQuery(() => ({ version: 14 })));

    const res = await GET(makeReq());
    const body = await res.json();

    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });

  it("DB unreachable (mock throws) -> 503 { status: 'error', db: 'disconnected', error: message }", async () => {
    mockGetDb.mockReturnValue(makeDbWithQuery(() => {
      throw new Error("SQLITE_CANTOPEN: unable to open database file");
    }));

    const res = await GET(makeReq());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("error");
    expect(body.db).toBe("disconnected");
    expect(typeof body.error).toBe("string");
  });

  it("DB throws -> error message included in response", async () => {
    mockGetDb.mockReturnValue(makeDbWithQuery(() => {
      throw new Error("Connection refused");
    }));

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.error).toBe("Connection refused");
  });

  it("No auth required -- unauthenticated request -> 200 (health check is always public)", async () => {
    mockGetDb.mockReturnValue(makeDbWithQuery(() => ({ version: 14 })));

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
  });
});

// ── 4L: logRequest assertions ────────────────────────────────────────────────

describe("GET /api/health logRequest (4L)", () => {
  it("200 response: logRequest called with method=GET, path=/api/health, statusCode=200, durationMs >= 0", async () => {
    mockGetDb.mockReturnValue(makeDbWithQuery(() => ({ version: 14 })));

    await GET(makeReq());

    expect(mockLogRequest).toHaveBeenCalledWith(
      "GET",
      "/api/health",
      200,
      expect.any(Number),
    );
    const durationMs = mockLogRequest.mock.calls[0][3] as number;
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it("503 response: logRequest called with statusCode=503", async () => {
    mockGetDb.mockReturnValue(makeDbWithQuery(() => {
      throw new Error("DB down");
    }));

    await GET(makeReq());

    expect(mockLogRequest).toHaveBeenCalledWith(
      "GET",
      "/api/health",
      503,
      expect.any(Number),
    );
  });

  it("logRequest called on every response (success and error)", async () => {
    // Success
    mockGetDb.mockReturnValue(makeDbWithQuery(() => ({ version: 14 })));
    await GET(makeReq());
    expect(mockLogRequest).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();

    // Error
    mockGetDb.mockReturnValue(makeDbWithQuery(() => { throw new Error("err"); }));
    await GET(makeReq());
    expect(mockLogRequest).toHaveBeenCalledTimes(1);
  });
});

describe("OPTIONS /api/health (CORS preflight)", () => {
  it("returns 200 with CORS headers", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/health", { method: "OPTIONS", headers: { origin: "https://example.com" } });
    const res = await OPTIONS(req);
    expect(res.status).toBe(200);
  });
});
