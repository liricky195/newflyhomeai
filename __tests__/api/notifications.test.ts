/**
 * 4J — GET /api/notifications
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetServerSession = vi.fn();

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

const mockGetNotificationsByUserId = vi.fn();
const mockMarkNotificationsRead = vi.fn();
const mockInitDb = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  getNotificationsByUserId: (...args: unknown[]) => mockGetNotificationsByUserId(...args),
  markNotificationsRead: (...args: unknown[]) => mockMarkNotificationsRead(...args),
}));

import { GET } from "@/app/api/notifications/route";

function makeSession(userId = "user-001") {
  return { user: { id: userId } };
}

function makeNotification(id: string, read = false) {
  return {
    id,
    user_id: "user-001",
    flight_id: "fl-001",
    type: "new_flight",
    title: "New flight",
    body: "A new flight is available",
    read_at: read ? 1000000 : null,
    sent_at: 999999,
    created_at: 999999,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(makeSession());
  mockInitDb.mockReturnValue(undefined);
  mockMarkNotificationsRead.mockReturnValue(undefined);
});

describe("GET /api/notifications (4J)", () => {
  it("authenticated user with unread notifications -> 200; notifications returned", async () => {
    const notifs = [makeNotification("n1"), makeNotification("n2")];
    mockGetNotificationsByUserId.mockReturnValue(notifs);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notifications).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it("read_at set on unread items (filters out already-read)", async () => {
    const notifs = [
      makeNotification("n1", false),
      makeNotification("n2", true),
    ];
    mockGetNotificationsByUserId.mockReturnValue(notifs);

    const res = await GET();
    const body = await res.json();

    // Only unread returned
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0].id).toBe("n1");
    expect(body.total).toBe(1);
  });

  it("authenticated user with no unread notifications -> 200 with empty array", async () => {
    mockGetNotificationsByUserId.mockReturnValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notifications).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("all notifications already read -> empty array returned", async () => {
    const notifs = [makeNotification("n1", true), makeNotification("n2", true)];
    mockGetNotificationsByUserId.mockReturnValue(notifs);

    const res = await GET();
    const body = await res.json();

    expect(body.notifications).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("DB error -> 500", async () => {
    mockGetNotificationsByUserId.mockImplementation(() => {
      throw new Error("DB error");
    });

    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("unauthenticated -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications — mark all read
// ─────────────────────────────────────────────────────────────────────────────

import { POST } from "@/app/api/notifications/route";

describe("POST /api/notifications", () => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue(makeSession());
    mockMarkNotificationsRead.mockReturnValue(undefined);
  });

  it("marks all notifications read and returns ok:true", async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(mockMarkNotificationsRead).toHaveBeenCalledWith("user-001");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 500 on DB error", async () => {
    mockMarkNotificationsRead.mockImplementationOnce(() => { throw new Error("DB error"); });
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
