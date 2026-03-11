import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock next-auth ────────────────────────────────────────────────────────────

const mockGetServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Mock lib/auth ─────────────────────────────────────────────────────────────

const mockIsAdmin = vi.fn<[string], boolean>();

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  isAdmin: (userId: string) => mockIsAdmin(userId),
}));

// ── Mock lib/db ───────────────────────────────────────────────────────────────

const mockGetUsersByPage = vi.fn();
const mockGetAdminStats = vi.fn();
const mockUpdateSubscriptionOverride = vi.fn();
const mockUpdateUserRole = vi.fn();
const mockResetAirport = vi.fn();
const mockGetMonitoredAirport = vi.fn();
const mockGetUserById = vi.fn();
const mockUpdateUserEmailNotifications = vi.fn();
const mockFlagAirportForImmediateScan = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: vi.fn(),
  getUsersByPage: (...args: unknown[]) => mockGetUsersByPage(...args),
  getAdminStats: () => mockGetAdminStats(),
  updateSubscriptionOverride: (...args: unknown[]) =>
    mockUpdateSubscriptionOverride(...args),
  updateUserRole: (...args: unknown[]) => mockUpdateUserRole(...args),
  resetAirport: (...args: unknown[]) => mockResetAirport(...args),
  getMonitoredAirport: (...args: unknown[]) => mockGetMonitoredAirport(...args),
  getUserById: (...args: unknown[]) => mockGetUserById(...args),
  updateUserEmailNotifications: (...args: unknown[]) =>
    mockUpdateUserEmailNotifications(...args),
  flagAirportForImmediateScan: (...args: unknown[]) =>
    mockFlagAirportForImmediateScan(...args),
}));

// ── Mock Stripe ───────────────────────────────────────────────────────────────

const mockStripeSubscriptionsCancel = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: {
        cancel: (...args: unknown[]) => mockStripeSubscriptionsCancel(...args),
      },
    })),
  };
});

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { NextRequest } from "next/server";
import { GET as usersGET } from "@/app/api/admin/users/route";
import { GET as statsGET } from "@/app/api/admin/stats/route";
import { PATCH as subscriptionPATCH } from "@/app/api/admin/users/[userId]/subscription/route";
import { DELETE as airportDELETE } from "@/app/api/admin/users/[userId]/airport/route";
import { POST as rolePOST } from "@/app/api/admin/users/[userId]/role/route";
import { POST as resetAirportPOST } from "@/app/api/admin/reset-airport/route";
import { PATCH as preferencesPATCH } from "@/app/api/user/preferences/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(url: string, options: RequestInit = {}): NextRequest {
  // Cast to any to avoid strict signal type mismatch between web RequestInit and NextRequest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(url, options as any);
}

function makeAdminSession(userId = "admin-user-id") {
  return { user: { id: userId, email: "admin@example.com" } };
}

function makeUserSession(userId = "regular-user-id") {
  return { user: { id: userId, email: "user@example.com" } };
}

function makeParams(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

// ── Global setup — clear mocks before every test across all describe blocks ───

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults for common mocks
  mockGetUsersByPage.mockReturnValue({ users: [], total: 0 });
  mockGetUserById.mockReturnValue(null);
  mockUpdateSubscriptionOverride.mockReturnValue({ stripeSubscriptionId: null, previousTier: "free" });
  mockFlagAirportForImmediateScan.mockReturnValue(undefined);
  mockResetAirport.mockReturnValue(undefined);
  mockUpdateUserRole.mockReturnValue(undefined);
  mockGetAdminStats.mockReturnValue({
    userCount: 0,
    subscriptionBreakdown: { free: 0, standard: 0, pro: 0, ultimate: 0 },
    activeMonitoredAirports: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Admin API security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsersByPage.mockReturnValue({ users: [], total: 0 });
  });

  // Test 1: Admin session → 200 with user list
  it("GET /api/admin/users — admin session returns 200 with user list", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockGetUsersByPage.mockReturnValue({
      users: [
        {
          id: "u1",
          email: "test@example.com",
          name: "Test",
          role: "user",
          created_at: 1000000,
          tier: "free",
          scan_interval_seconds: 3600,
          airport_iata: "DXB",
        },
      ],
      total: 1,
    });

    const req = makeReq("http://localhost/api/admin/users");
    const res = await usersGET(req as Parameters<typeof usersGET>[0]);
    const body = await res.json() as { users: unknown[]; total: number };

    expect(res.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.users).toHaveLength(1);
  });

  // Test 2: Non-admin session → 403
  it("GET /api/admin/users — non-admin session returns 403", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockIsAdmin.mockReturnValue(false);

    const req = makeReq("http://localhost/api/admin/users");
    const res = await usersGET(req as Parameters<typeof usersGET>[0]);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  // Test 3: No session → 401
  it("GET /api/admin/users — no session returns 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = makeReq("http://localhost/api/admin/users");
    const res = await usersGET(req as Parameters<typeof usersGET>[0]);
    const body = await res.json() as { error: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  // Test 4: Session with valid user ID but DB returns role="user" → 403 (DB is gate, not session)
  it("PATCH /api/admin/users/[userId]/subscription — session present but DB role=user returns 403", async () => {
    // Session claims a user ID (simulating a JWT spoofing attempt)
    mockGetServerSession.mockResolvedValue({
      user: { id: "attacker-id", email: "attacker@example.com" },
    });
    // DB lookup returns non-admin
    mockIsAdmin.mockReturnValue(false);

    const req = makeReq(
      "http://localhost/api/admin/users/victim-id/subscription",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "pro" }),
      }
    );
    const res = await subscriptionPATCH(
      req as Parameters<typeof subscriptionPATCH>[0],
      makeParams({ userId: "victim-id" }) as Parameters<typeof subscriptionPATCH>[1]
    );
    const body = await res.json() as { error: string };

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(mockUpdateSubscriptionOverride).not.toHaveBeenCalled();
  });

  // Test 5: PATCH /api/user/preferences with role in body → role is stripped, not applied
  it("PATCH /api/user/preferences — body with role=admin is stripped; updateUserRole never called", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockUpdateUserEmailNotifications.mockReturnValue(undefined);

    const req = makeReq("http://localhost/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin", emailNotifications: true }),
    });
    const res = await preferencesPATCH(req as Parameters<typeof preferencesPATCH>[0]);

    expect(res.status).toBe(200);
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
    expect(mockUpdateUserEmailNotifications).toHaveBeenCalledWith(
      "regular-user-id",
      1  // route converts boolean true → integer 1
    );
  });

  // Test 6: Admin cannot change their own role → 403
  it("POST /api/admin/users/[adminId]/role — admin cannot change own role, returns 403", async () => {
    const adminId = "admin-user-id";
    mockGetServerSession.mockResolvedValue(makeAdminSession(adminId));
    mockIsAdmin.mockReturnValue(true);

    const req = makeReq(`http://localhost/api/admin/users/${adminId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: adminId }) as Parameters<typeof rolePOST>[1]
    );
    const body = await res.json() as { error: string };

    expect(res.status).toBe(403);
    expect(body.error).toBe("Cannot modify your own role");
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });

  // Test 7: Non-admin cannot change roles → 403
  it("POST /api/admin/users/[userId]/role — non-admin session returns 403", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockIsAdmin.mockReturnValue(false);

    const req = makeReq("http://localhost/api/admin/users/target-user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: "target-user" }) as Parameters<typeof rolePOST>[1]
    );
    const body = await res.json() as { error: string };

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4Q — GET /api/admin/stats
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/stats (4Q)", () => {
  it("admin session -> 200 with stats shape", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockGetAdminStats.mockReturnValue({
      userCount: 5,
      subscriptionBreakdown: { free: 3, standard: 1, pro: 1, ultimate: 0 },
      activeMonitoredAirports: ["DXB", "AUH"],
    });

    const req = makeReq("http://localhost/api/admin/stats");
    const res = await statsGET(req as Parameters<typeof statsGET>[0]);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userCount).toBe(5);
    expect(body.subscriptionBreakdown).toEqual({ free: 3, standard: 1, pro: 1, ultimate: 0 });
    expect(Array.isArray(body.activeMonitoredAirports)).toBe(true);
  });

  it("all subscription breakdown counts are non-negative integers", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockGetAdminStats.mockReturnValue({
      userCount: 10,
      subscriptionBreakdown: { free: 8, standard: 1, pro: 1, ultimate: 0 },
      activeMonitoredAirports: [],
    });

    const req = makeReq("http://localhost/api/admin/stats");
    const res = await statsGET(req as Parameters<typeof statsGET>[0]);
    const body = await res.json();

    const { free, standard, pro, ultimate } = body.subscriptionBreakdown;
    [free, standard, pro, ultimate].forEach((v: number) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  it("non-admin session -> 403", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockIsAdmin.mockReturnValue(false);

    const req = makeReq("http://localhost/api/admin/stats");
    const res = await statsGET(req as Parameters<typeof statsGET>[0]);
    expect(res.status).toBe(403);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = makeReq("http://localhost/api/admin/stats");
    const res = await statsGET(req as Parameters<typeof statsGET>[0]);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4R — GET /api/admin/users (extended)
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/users (4R)", () => {
  it("admin session -> 200 with array of users including subscription tier and role", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockGetUsersByPage.mockReturnValue({
      users: [
        { id: "u1", email: "a@example.com", name: "A", role: "user", tier: "standard", scan_interval_seconds: 180 },
        { id: "u2", email: "b@example.com", name: "B", role: "admin", tier: "pro", scan_interval_seconds: 60 },
      ],
      total: 2,
    });

    const req = makeReq("http://localhost/api/admin/users");
    const res = await usersGET(req as Parameters<typeof usersGET>[0]);
    const body = await res.json() as { users: Array<{ role: string; tier: string }>; total: number };

    expect(res.status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.users[0].tier).toBe("standard");
    expect(body.users[0].role).toBe("user");
  });

  it("user with no subscription row -> subscription fields null in response", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockGetUsersByPage.mockReturnValue({
      users: [
        { id: "u3", email: "c@example.com", name: "C", role: "user", tier: null, scan_interval_seconds: null },
      ],
      total: 1,
    });

    const req = makeReq("http://localhost/api/admin/users");
    const res = await usersGET(req as Parameters<typeof usersGET>[0]);
    const body = await res.json() as { users: Array<{ tier: unknown }> };

    expect(res.status).toBe(200);
    expect(body.users[0].tier).toBeNull();
  });

  it("non-admin session -> 403", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockIsAdmin.mockReturnValue(false);

    const req = makeReq("http://localhost/api/admin/users");
    const res = await usersGET(req as Parameters<typeof usersGET>[0]);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4S — PATCH /api/admin/users/[userId]/subscription (extended)
// ─────────────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/users/[userId]/subscription (4S)", () => {
  beforeEach(() => {
    mockUpdateSubscriptionOverride.mockReturnValue({ stripeSubscriptionId: null, previousTier: "free" });
    mockFlagAirportForImmediateScan.mockReturnValue(undefined);
  });

  it("admin session, valid tier -> 200; subscription tier updated in DB", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockUpdateSubscriptionOverride.mockReturnValue({ stripeSubscriptionId: null, previousTier: "free" });

    const req = makeReq("http://localhost/api/admin/users/user-target/subscription", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "pro" }),
    });
    const res = await subscriptionPATCH(
      req as Parameters<typeof subscriptionPATCH>[0],
      makeParams({ userId: "user-target" }) as Parameters<typeof subscriptionPATCH>[1]
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tier).toBe("pro");
    expect(mockUpdateSubscriptionOverride).toHaveBeenCalledWith("user-target", "pro");
  });

  it("invalid tier -> 400", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);

    const req = makeReq("http://localhost/api/admin/users/user-target/subscription", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "platinum" }),
    });
    const res = await subscriptionPATCH(
      req as Parameters<typeof subscriptionPATCH>[0],
      makeParams({ userId: "user-target" }) as Parameters<typeof subscriptionPATCH>[1]
    );
    expect(res.status).toBe(400);
    expect(mockUpdateSubscriptionOverride).not.toHaveBeenCalled();
  });

  it("non-existent userId -> DB throws -> 500", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockUpdateSubscriptionOverride.mockImplementation(() => {
      throw new Error("User not found");
    });

    const req = makeReq("http://localhost/api/admin/users/ghost-user/subscription", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "standard" }),
    });
    const res = await subscriptionPATCH(
      req as Parameters<typeof subscriptionPATCH>[0],
      makeParams({ userId: "ghost-user" }) as Parameters<typeof subscriptionPATCH>[1]
    );
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4T — DELETE /api/admin/users/[userId]/airport
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/admin/users/[userId]/airport (4T)", () => {
  it("admin session -> 200; monitored_airports rows deleted for userId", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockResetAirport.mockReturnValue(undefined);

    const req = makeReq("http://localhost/api/admin/users/user-001/airport", { method: "DELETE" });
    const res = await airportDELETE(
      req as Parameters<typeof airportDELETE>[0],
      makeParams({ userId: "user-001" }) as Parameters<typeof airportDELETE>[1]
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockResetAirport).toHaveBeenCalledWith("user-001");
  });

  it("userId with no airport row -> 200 (idempotent)", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockResetAirport.mockReturnValue(undefined);

    const req = makeReq("http://localhost/api/admin/users/no-airport-user/airport", { method: "DELETE" });
    const res = await airportDELETE(
      req as Parameters<typeof airportDELETE>[0],
      makeParams({ userId: "no-airport-user" }) as Parameters<typeof airportDELETE>[1]
    );
    expect(res.status).toBe(200);
  });

  it("non-admin session -> 403", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockIsAdmin.mockReturnValue(false);

    const req = makeReq("http://localhost/api/admin/users/user-001/airport", { method: "DELETE" });
    const res = await airportDELETE(
      req as Parameters<typeof airportDELETE>[0],
      makeParams({ userId: "user-001" }) as Parameters<typeof airportDELETE>[1]
    );
    expect(res.status).toBe(403);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = makeReq("http://localhost/api/admin/users/user-001/airport", { method: "DELETE" });
    const res = await airportDELETE(
      req as Parameters<typeof airportDELETE>[0],
      makeParams({ userId: "user-001" }) as Parameters<typeof airportDELETE>[1]
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4U — POST /api/admin/users/[userId]/role (extended)
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/users/[userId]/role (4U)", () => {
  it("admin session, valid role 'admin' -> 200; target user role updated in DB", async () => {
    const adminId = "admin-user-id";
    mockGetServerSession.mockResolvedValue(makeAdminSession(adminId));
    mockIsAdmin.mockReturnValue(true);
    mockGetUserById.mockReturnValue({ id: "other-user", role: "user" });

    const req = makeReq("http://localhost/api/admin/users/other-user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: "other-user" }) as Parameters<typeof rolePOST>[1]
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.role).toBe("admin");
    expect(mockUpdateUserRole).toHaveBeenCalledWith("other-user", "admin");
  });

  it("admin session, valid role 'user' -> 200; target user role updated", async () => {
    const adminId = "admin-user-id";
    mockGetServerSession.mockResolvedValue(makeAdminSession(adminId));
    mockIsAdmin.mockReturnValue(true);
    mockGetUserById.mockReturnValue({ id: "other-user", role: "admin" });

    const req = makeReq("http://localhost/api/admin/users/other-user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: "other-user" }) as Parameters<typeof rolePOST>[1]
    );
    expect(res.status).toBe(200);
    expect(mockUpdateUserRole).toHaveBeenCalledWith("other-user", "user");
  });

  it("admin session, target userId === own userId -> 403 'Cannot modify your own role'", async () => {
    const adminId = "admin-user-id";
    mockGetServerSession.mockResolvedValue(makeAdminSession(adminId));
    mockIsAdmin.mockReturnValue(true);

    const req = makeReq(`http://localhost/api/admin/users/${adminId}/role`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: adminId }) as Parameters<typeof rolePOST>[1]
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Cannot modify your own role");
    expect(mockUpdateUserRole).not.toHaveBeenCalled();
  });

  it("invalid role value -> 400", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);

    const req = makeReq("http://localhost/api/admin/users/other-user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "superuser" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: "other-user" }) as Parameters<typeof rolePOST>[1]
    );
    expect(res.status).toBe(400);
  });

  it("non-existent userId -> 404", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockGetUserById.mockReturnValue(null);

    const req = makeReq("http://localhost/api/admin/users/ghost-user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: "ghost-user" }) as Parameters<typeof rolePOST>[1]
    );
    expect(res.status).toBe(404);
  });

  it("non-admin session -> 403", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockIsAdmin.mockReturnValue(false);

    const req = makeReq("http://localhost/api/admin/users/other-user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: "other-user" }) as Parameters<typeof rolePOST>[1]
    );
    expect(res.status).toBe(403);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = makeReq("http://localhost/api/admin/users/other-user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user" }),
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: "other-user" }) as Parameters<typeof rolePOST>[1]
    );
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4V — POST /api/admin/reset-airport
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/admin/reset-airport (4V)", () => {
  it("admin session, valid userId -> 200; resetAirport called", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockResetAirport.mockReturnValue(undefined);

    const req = makeReq("http://localhost/api/admin/reset-airport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-001" }),
    });
    const res = await resetAirportPOST(req as Parameters<typeof resetAirportPOST>[0]);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockResetAirport).toHaveBeenCalledWith("user-001");
  });

  it("missing userId in body -> 400", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);

    const req = makeReq("http://localhost/api/admin/reset-airport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await resetAirportPOST(req as Parameters<typeof resetAirportPOST>[0]);
    expect(res.status).toBe(400);
    expect(mockResetAirport).not.toHaveBeenCalled();
  });

  it("non-existent userId -> 200 (idempotent; resetAirport is a DELETE that succeeds even if absent)", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockResetAirport.mockReturnValue(undefined);

    const req = makeReq("http://localhost/api/admin/reset-airport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "nonexistent-user" }),
    });
    const res = await resetAirportPOST(req as Parameters<typeof resetAirportPOST>[0]);
    expect(res.status).toBe(200);
  });

  it("non-admin session -> 403", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockIsAdmin.mockReturnValue(false);

    const req = makeReq("http://localhost/api/admin/reset-airport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-001" }),
    });
    const res = await resetAirportPOST(req as Parameters<typeof resetAirportPOST>[0]);
    expect(res.status).toBe(403);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = makeReq("http://localhost/api/admin/reset-airport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-001" }),
    });
    const res = await resetAirportPOST(req as Parameters<typeof resetAirportPOST>[0]);
    expect(res.status).toBe(401);
  });
});

// ── Additional branch coverage ────────────────────────────────────────────────

describe("POST /api/admin/reset-airport — additional branches", () => {
  it("invalid JSON body -> 400", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);

    const req = new NextRequest("http://localhost/api/admin/reset-airport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{{invalid-json",
    });
    const res = await resetAirportPOST(req as Parameters<typeof resetAirportPOST>[0]);
    expect(res.status).toBe(400);
  });

  it("DB throws on resetAirport -> 500", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockResetAirport.mockImplementation(() => { throw new Error("DB locked"); });

    const req = makeReq("http://localhost/api/admin/reset-airport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-001" }),
    });
    const res = await resetAirportPOST(req as Parameters<typeof resetAirportPOST>[0]);
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/user/preferences — additional branches", () => {
  it("invalid JSON body -> 400", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());

    const req = new NextRequest("http://localhost/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await preferencesPATCH(req as Parameters<typeof preferencesPATCH>[0]);
    expect(res.status).toBe(400);
  });

  it("invalid body schema -> 400", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());

    const req = makeReq("http://localhost/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailNotifications: "yes" }),
    });
    const res = await preferencesPATCH(req as Parameters<typeof preferencesPATCH>[0]);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/users/[userId]/subscription — additional branches", () => {
  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = makeReq("http://localhost/api/admin/users/user-target/subscription", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "pro" }),
    });
    const res = await subscriptionPATCH(
      req as Parameters<typeof subscriptionPATCH>[0],
      makeParams({ userId: "user-target" }) as Parameters<typeof subscriptionPATCH>[1]
    );
    expect(res.status).toBe(401);
  });

  it("invalid JSON body -> 400", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);

    const req = new NextRequest("http://localhost/api/admin/users/user-target/subscription", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "bad-json",
    });
    const res = await subscriptionPATCH(
      req as Parameters<typeof subscriptionPATCH>[0],
      makeParams({ userId: "user-target" }) as Parameters<typeof subscriptionPATCH>[1]
    );
    expect(res.status).toBe(400);
  });

  it("tier='free' with stripeSubscriptionId -> cancels Stripe subscription", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockUpdateSubscriptionOverride.mockReturnValue({ stripeSubscriptionId: "sub_cancel_123", previousTier: "pro" });
    mockStripeSubscriptionsCancel.mockResolvedValueOnce({ id: "sub_cancel_123" });

    const req = makeReq("http://localhost/api/admin/users/user-target/subscription", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "free" }),
    });
    const res = await subscriptionPATCH(
      req as Parameters<typeof subscriptionPATCH>[0],
      makeParams({ userId: "user-target" }) as Parameters<typeof subscriptionPATCH>[1]
    );
    expect(res.status).toBe(200);
    expect(mockStripeSubscriptionsCancel).toHaveBeenCalledWith("sub_cancel_123", expect.anything());
  });

  it("tier='free' with Stripe cancel throwing -> logs error, returns 200", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);
    mockUpdateSubscriptionOverride.mockReturnValue({ stripeSubscriptionId: "sub_cancel_err", previousTier: "pro" });
    mockStripeSubscriptionsCancel.mockRejectedValueOnce(new Error("Stripe timeout"));

    const req = makeReq("http://localhost/api/admin/users/user-target/subscription", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "free" }),
    });
    const res = await subscriptionPATCH(
      req as Parameters<typeof subscriptionPATCH>[0],
      makeParams({ userId: "user-target" }) as Parameters<typeof subscriptionPATCH>[1]
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/admin/users/[userId]/role — invalid JSON -> 400", () => {
  it("invalid JSON body -> 400", async () => {
    mockGetServerSession.mockResolvedValue(makeAdminSession());
    mockIsAdmin.mockReturnValue(true);

    const req = new NextRequest("http://localhost/api/admin/users/other-user/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    const res = await rolePOST(
      req as Parameters<typeof rolePOST>[0],
      makeParams({ userId: "other-user" }) as Parameters<typeof rolePOST>[1]
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/user/preferences — DB error -> 500", () => {
  it("updateUserEmailNotifications throws -> 500", async () => {
    mockGetServerSession.mockResolvedValue(makeUserSession());
    mockUpdateUserEmailNotifications.mockImplementationOnce(() => {
      throw new Error("DB locked");
    });

    const req = makeReq("http://localhost/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailNotifications: true }),
    });
    const res = await preferencesPATCH(req as Parameters<typeof preferencesPATCH>[0]);
    expect(res.status).toBe(500);
  });
});
