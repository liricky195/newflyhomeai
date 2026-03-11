/**
 * GET /api/admin/bookings — admin route returning all bookings
 * File: __tests__/api/admin-bookings.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authOptions: {},
  isAdmin: vi.fn(),
}));

const mockGetAllBookings = vi.fn();
const mockInitDb = vi.fn();
vi.mock("@/lib/db", () => ({
  initDb: (...a: unknown[]) => mockInitDb(...a),
  getAllBookingsWithUsersAndFlights: (...a: unknown[]) => mockGetAllBookings(...a),
}));

import { getServerSession } from "next-auth";
import { isAdmin } from "@/lib/auth";

const SESSION = { user: { id: "admin1", email: "admin@test.com" }, expires: "" };

beforeEach(() => {
  vi.mocked(getServerSession).mockResolvedValue(SESSION);
  vi.mocked(isAdmin).mockReturnValue(true);
  mockInitDb.mockReturnValue(undefined);
  mockGetAllBookings.mockReturnValue([
    { id: "bk1", user_email: "u@test.com", status: "confirmed" },
  ]);
});

describe("GET /api/admin/bookings", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const { GET } = await import("@/app/api/admin/bookings/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when non-admin", async () => {
    vi.mocked(isAdmin).mockReturnValueOnce(false);
    const { GET } = await import("@/app/api/admin/bookings/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns bookings list for admin user", async () => {
    const { GET } = await import("@/app/api/admin/bookings/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bookings).toHaveLength(1);
    expect(json.bookings[0].id).toBe("bk1");
  });

  it("returns Cache-Control: no-store header", async () => {
    const { GET } = await import("@/app/api/admin/bookings/route");
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 500 on DB error", async () => {
    mockGetAllBookings.mockImplementationOnce(() => { throw new Error("DB error"); });
    const { GET } = await import("@/app/api/admin/bookings/route");
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB error");
  });
});
