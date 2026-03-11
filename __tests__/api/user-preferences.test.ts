/**
 * 4P — PATCH /api/user/preferences
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const mockUpdateUserEmailNotifications = vi.fn();
const mockUpdateUserRole = vi.fn();
const mockInitDb = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  updateUserEmailNotifications: (...args: unknown[]) => mockUpdateUserEmailNotifications(...args),
  updateUserRole: (...args: unknown[]) => mockUpdateUserRole(...args),
}));

import { PATCH } from "@/app/api/user/preferences/route";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/user/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSession(userId = "user-001") {
  return { user: { id: userId } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(makeSession());
  mockInitDb.mockReturnValue(undefined);
  mockUpdateUserEmailNotifications.mockReturnValue(undefined);
});

describe("PATCH /api/user/preferences (4P)", () => {
  it("emailNotifications: true -> 200; DB updated with 1", async () => {
    const res = await PATCH(makeReq({ emailNotifications: true }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateUserEmailNotifications).toHaveBeenCalledWith("user-001", 1);
  });

  it("emailNotifications: false -> 200; DB updated with 0", async () => {
    const res = await PATCH(makeReq({ emailNotifications: false }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdateUserEmailNotifications).toHaveBeenCalledWith("user-001", 0);
  });

  it("body includes role: 'admin' -> ignored; role NOT written to DB; user role unchanged", async () => {
    const res = await PATCH(makeReq({ emailNotifications: true, role: "admin" }));
    expect(res.status).toBe(200);
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
    expect(mockUpdateUserEmailNotifications).toHaveBeenCalledWith("user-001", 1);
  });

  it("body includes id: 'someotherid' -> ignored; user ID unchanged in call", async () => {
    const res = await PATCH(makeReq({ emailNotifications: false, id: "someotherid" }));
    expect(res.status).toBe(200);
    // updateUserEmailNotifications called with the session user's ID, not the body id
    expect(mockUpdateUserEmailNotifications).toHaveBeenCalledWith("user-001", 0);
  });

  it("missing emailNotifications -> 400", async () => {
    const res = await PATCH(makeReq({}));
    expect(res.status).toBe(400);
    expect(mockUpdateUserEmailNotifications).not.toHaveBeenCalled();
  });

  it("emailNotifications: 'yes' (string not boolean) -> 400", async () => {
    const res = await PATCH(makeReq({ emailNotifications: "yes" }));
    expect(res.status).toBe(400);
    expect(mockUpdateUserEmailNotifications).not.toHaveBeenCalled();
  });

  it("emailNotifications: 1 (number not boolean) -> 400", async () => {
    const res = await PATCH(makeReq({ emailNotifications: 1 }));
    expect(res.status).toBe(400);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await PATCH(makeReq({ emailNotifications: true }));
    expect(res.status).toBe(401);
    expect(mockUpdateUserEmailNotifications).not.toHaveBeenCalled();
  });
});
