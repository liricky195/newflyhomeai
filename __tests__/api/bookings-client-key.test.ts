/**
 * GET /api/bookings/client-key — returns Duffel component client key
 * File: __tests__/api/bookings-client-key.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const mockCreateComponentClientKey = vi.fn();
vi.mock("@/lib/duffel", () => ({
  createComponentClientKey: (...a: unknown[]) => mockCreateComponentClientKey(...a),
  ApiError: class ApiError extends Error {
    constructor(public httpStatus: number, public apiMessage: string) { super(apiMessage); }
  },
}));

import { getServerSession } from "next-auth";

const SESSION = { user: { id: "u1", email: "u1@test.com" }, expires: "" };

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION);
  mockCreateComponentClientKey.mockResolvedValue("client_key_abc123");
});

describe("GET /api/bookings/client-key", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/bookings/client-key/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns client key for authenticated user", async () => {
    const { GET } = await import("@/app/api/bookings/client-key/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.clientKey).toBe("client_key_abc123");
  });

  it("returns 502 on ApiError", async () => {
    const { ApiError } = await import("@/lib/duffel");
    mockCreateComponentClientKey.mockRejectedValueOnce(
      new ApiError(502, "Duffel API error")
    );
    const { GET } = await import("@/app/api/bookings/client-key/route");
    const res = await GET();
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("Duffel API error");
  });

  it("returns 502 on generic error", async () => {
    mockCreateComponentClientKey.mockRejectedValueOnce(new Error("Network failure"));
    const { GET } = await import("@/app/api/bookings/client-key/route");
    const res = await GET();
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("Network failure");
  });
});
