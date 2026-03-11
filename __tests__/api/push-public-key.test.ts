/**
 * GET /api/push/public-key — returns VAPID public key
 * File: __tests__/api/push-public-key.test.ts
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("GET /api/push/public-key", () => {
  const ORIGINAL_KEY = process.env.VAPID_PUBLIC_KEY;

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.VAPID_PUBLIC_KEY;
    } else {
      process.env.VAPID_PUBLIC_KEY = ORIGINAL_KEY;
    }
  });

  it("returns the VAPID public key when set", async () => {
    process.env.VAPID_PUBLIC_KEY = "test-vapid-public-key-abc123";
    const { GET } = await import("@/app/api/push/public-key/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.publicKey).toBe("test-vapid-public-key-abc123");
  });

  it("returns 500 when VAPID_PUBLIC_KEY is not set", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    const { GET } = await import("@/app/api/push/public-key/route");
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain("VAPID_PUBLIC_KEY");
  });
});
