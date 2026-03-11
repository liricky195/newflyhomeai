/**
 * 4O — POST /api/push/subscribe and DELETE /api/push/unsubscribe
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

const mockSavePushSubscription = vi.fn();
const mockDeletePushSubscription = vi.fn();
const mockInitDb = vi.fn();

vi.mock("@/lib/db", () => ({
  initDb: () => mockInitDb(),
  savePushSubscription: (...args: unknown[]) => mockSavePushSubscription(...args),
  deletePushSubscription: (...args: unknown[]) => mockDeletePushSubscription(...args),
}));

import { POST } from "@/app/api/push/subscribe/route";
import { DELETE } from "@/app/api/push/unsubscribe/route";

function makeSession(userId = "user-001") {
  return { user: { id: userId } };
}

const VALID_SUBSCRIBE_BODY = {
  endpoint: "https://push.example.com/sub1",
  p256dh: "p256dh_key_abc",
  auth: "auth_token_xyz",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(makeSession());
  mockInitDb.mockReturnValue(undefined);
  mockSavePushSubscription.mockReturnValue({ id: "ps-1", ...VALID_SUBSCRIBE_BODY });
  mockDeletePushSubscription.mockReturnValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/push/subscribe
// ─────────────────────────────────────────────────────────────────────────────

describe("POST /api/push/subscribe (4O)", () => {
  function makeSubscribeReq(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("valid subscribe body -> 200; row upserted in push_subscriptions", async () => {
    const res = await POST(makeSubscribeReq(VALID_SUBSCRIBE_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("ps-1");
    expect(mockSavePushSubscription).toHaveBeenCalledOnce();
  });

  it("invalid endpoint URL -> 400", async () => {
    const res = await POST(makeSubscribeReq({ ...VALID_SUBSCRIBE_BODY, endpoint: "not-a-url" }));
    expect(res.status).toBe(400);
    expect(mockSavePushSubscription).not.toHaveBeenCalled();
  });

  it("missing p256dh -> 400", async () => {
    const { p256dh: _p, ...rest } = VALID_SUBSCRIBE_BODY;
    const res = await POST(makeSubscribeReq(rest));
    expect(res.status).toBe(400);
    expect(mockSavePushSubscription).not.toHaveBeenCalled();
  });

  it("missing auth -> 400", async () => {
    const { auth: _a, ...rest } = VALID_SUBSCRIBE_BODY;
    const res = await POST(makeSubscribeReq(rest));
    expect(res.status).toBe(400);
    expect(mockSavePushSubscription).not.toHaveBeenCalled();
  });

  it("empty p256dh -> 400", async () => {
    const res = await POST(makeSubscribeReq({ ...VALID_SUBSCRIBE_BODY, p256dh: "" }));
    expect(res.status).toBe(400);
  });

  it("duplicate endpoint -> 200; existing row updated (savePushSubscription handles upsert)", async () => {
    mockSavePushSubscription.mockReturnValue({ id: "ps-existing" });

    const res = await POST(makeSubscribeReq(VALID_SUBSCRIBE_BODY));
    expect(res.status).toBe(200);
    expect(mockSavePushSubscription).toHaveBeenCalledOnce();
  });

  it("unauthenticated subscribe -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await POST(makeSubscribeReq(VALID_SUBSCRIBE_BODY));
    expect(res.status).toBe(401);
    expect(mockSavePushSubscription).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/push/unsubscribe
// ─────────────────────────────────────────────────────────────────────────────

describe("DELETE /api/push/unsubscribe (4O)", () => {
  function makeUnsubscribeReq(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/push/unsubscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("valid unsubscribe -> 200; row deleted", async () => {
    const res = await DELETE(makeUnsubscribeReq({ endpoint: "https://push.example.com/sub1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockDeletePushSubscription).toHaveBeenCalledWith("https://push.example.com/sub1");
  });

  it("unsubscribe with unknown endpoint -> 200 (idempotent)", async () => {
    mockDeletePushSubscription.mockReturnValue(undefined);

    const res = await DELETE(makeUnsubscribeReq({ endpoint: "https://push.example.com/unknown" }));
    expect(res.status).toBe(200);
  });

  it("invalid endpoint URL -> 400", async () => {
    const res = await DELETE(makeUnsubscribeReq({ endpoint: "not-a-url" }));
    expect(res.status).toBe(400);
    expect(mockDeletePushSubscription).not.toHaveBeenCalled();
  });

  it("unauthenticated unsubscribe -> 401", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const res = await DELETE(makeUnsubscribeReq({ endpoint: "https://push.example.com/sub1" }));
    expect(res.status).toBe(401);
    expect(mockDeletePushSubscription).not.toHaveBeenCalled();
  });

  it("invalid JSON body for unsubscribe -> 400", async () => {
    const req = new NextRequest("http://localhost/api/push/unsubscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("DB error on unsubscribe -> 500", async () => {
    mockDeletePushSubscription.mockImplementationOnce(() => { throw new Error("DB failure"); });
    const res = await DELETE(makeUnsubscribeReq({ endpoint: "https://push.example.com/sub1" }));
    expect(res.status).toBe(500);
  });
});

// Add missing subscribe error cases
describe("POST /api/push/subscribe — additional coverage", () => {
  function makeSubscribeReq(body: unknown): NextRequest {
    return new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("invalid JSON body for subscribe -> 400", async () => {
    const req = new NextRequest("http://localhost/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const { POST: subscribePOST } = await import("@/app/api/push/subscribe/route");
    const res = await subscribePOST(req);
    expect(res.status).toBe(400);
  });

  it("DB error on subscribe -> 500", async () => {
    mockSavePushSubscription.mockImplementationOnce(() => { throw new Error("DB failure"); });
    const VALID_BODY = {
      endpoint: "https://push.example.com/subscribe-db-error",
      p256dh: "abc123",
      auth: "authkey",
    };
    const { POST: subscribePOST } = await import("@/app/api/push/subscribe/route");
    const res = await subscribePOST(makeSubscribeReq(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
