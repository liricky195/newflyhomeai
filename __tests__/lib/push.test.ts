import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock web-push ────────────────────────────────────────────────────────────

const mockSetVapidDetails = vi.fn();
const mockSendNotification = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}));

// ── Mock DB ──────────────────────────────────────────────────────────────────

const mockGetPushSubscriptions = vi.fn();
const mockDeletePushSubscription = vi.fn();

vi.mock("@/lib/db", () => ({
  getPushSubscriptionsByUserId: (...args: unknown[]) => mockGetPushSubscriptions(...args),
  deletePushSubscription: (...args: unknown[]) => mockDeletePushSubscription(...args),
}));

beforeEach(() => {
  vi.stubEnv("VAPID_PUBLIC_KEY", "test-public-key");
  vi.stubEnv("VAPID_PRIVATE_KEY", "test-private-key");
  vi.stubEnv("VAPID_SUBJECT", "mailto:test@test.com");
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  // Reset module registry so initVapid re-runs
  vi.resetModules();
});

describe("sendPushNotification", () => {
  it("sends with correct endpoint, p256dh, and auth", async () => {
    mockGetPushSubscriptions.mockReturnValue([
      {
        id: "ps_1",
        user_id: "u1",
        endpoint: "https://push.example.com/1",
        p256dh: "key123",
        auth: "auth123",
        created_at: 0,
      },
    ]);
    mockSendNotification.mockResolvedValue({});

    const { sendPushNotification } = await import("@/lib/push");
    await sendPushNotification("u1", { title: "Test", body: "Hello" });

    expect(mockSendNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://push.example.com/1",
        keys: { p256dh: "key123", auth: "auth123" },
      },
      JSON.stringify({ title: "Test", body: "Hello" })
    );
  });

  it("calls deletePushSubscription on 410 Gone", async () => {
    mockGetPushSubscriptions.mockReturnValue([
      {
        id: "ps_2",
        user_id: "u1",
        endpoint: "https://push.example.com/gone",
        p256dh: "key",
        auth: "auth",
        created_at: 0,
      },
    ]);
    mockSendNotification.mockRejectedValue({ statusCode: 410 });

    const { sendPushNotification } = await import("@/lib/push");
    await sendPushNotification("u1", { title: "Test", body: "Gone" });

    expect(mockDeletePushSubscription).toHaveBeenCalledWith(
      "https://push.example.com/gone"
    );
  });

  it("throws on non-410 errors", async () => {
    mockGetPushSubscriptions.mockReturnValue([
      {
        id: "ps_3",
        user_id: "u1",
        endpoint: "https://push.example.com/err",
        p256dh: "key",
        auth: "auth",
        created_at: 0,
      },
    ]);
    mockSendNotification.mockRejectedValue({ statusCode: 500, message: "Server error" });

    const { sendPushNotification } = await import("@/lib/push");
    await expect(
      sendPushNotification("u1", { title: "Test", body: "Err" })
    ).rejects.toEqual({ statusCode: 500, message: "Server error" });
  });
});

describe("initVapid", () => {
  it("throws when VAPID env vars are missing", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.stubEnv("VAPID_SUBJECT", "");

    const { initVapid } = await import("@/lib/push");
    expect(() => initVapid()).toThrow("Missing VAPID configuration");
  });
});
