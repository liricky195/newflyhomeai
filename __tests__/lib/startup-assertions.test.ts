/**
 * 4G — Startup assertions for lib modules
 * Each test isolates a missing env var and verifies a descriptive error is thrown.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Save original env vars to restore after each test
const ORIG_ENV: Record<string, string | undefined> = {};
const VARS = [
  "DATABASE_URL",
  "DUFFEL_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_ADDRESS",
];

beforeEach(() => {
  for (const v of VARS) ORIG_ENV[v] = process.env[v];
});

afterEach(() => {
  for (const v of VARS) {
    if (ORIG_ENV[v] === undefined) delete process.env[v];
    else process.env[v] = ORIG_ENV[v];
  }
  vi.resetModules();
});

describe("Startup assertions (4G)", () => {
  it("DATABASE_URL missing: initDb() throws message containing 'DATABASE_URL is required'", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { initDb } = await import("@/lib/db");
    expect(() => initDb()).toThrow(/DATABASE_URL is required/);
  });

  it("DATABASE_URL missing error message is descriptive (not just 'undefined')", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { initDb } = await import("@/lib/db");
    try {
      initDb();
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toBe("undefined");
      expect((e as Error).message.length).toBeGreaterThan(20);
    }
  });

  it("DUFFEL_API_KEY missing: duffel module throws on first use", async () => {
    delete process.env.DUFFEL_API_KEY;
    vi.resetModules();
    const duffelModule = await import("@/lib/duffel");
    // createDuffelLink calls headers() → getApiKey() as the very first operation
    await expect(
      duffelModule.createDuffelLink({
        offerId: "offer-1",
        reference: "ref-1",
        successUrl: "https://app.example.com/success",
        abandonUrl: "https://app.example.com/cancel",
      })
    ).rejects.toThrow(/DUFFEL_API_KEY is required/);
  });

  it("STRIPE_SECRET_KEY missing: assertStripeEnvVars() throws", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();
    const stripeModule = await import("@/lib/stripe");
    expect(() => stripeModule.assertStripeEnvVars()).toThrow(/STRIPE_SECRET_KEY is required/);
  });

  it("STRIPE_WEBHOOK_SECRET missing: assertStripeEnvVars() throws", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    vi.resetModules();
    const stripeModule = await import("@/lib/stripe");
    expect(() => stripeModule.assertStripeEnvVars()).toThrow(/STRIPE_WEBHOOK_SECRET is required/);
  });

  it("RESEND_API_KEY missing: sendEmail throws", async () => {
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
    const emailModule = await import("@/lib/email");
    await expect(
      emailModule.sendEmail("test@test.com", "subject", "<p>body</p>")
    ).rejects.toThrow(/RESEND_API_KEY is required/);
  });

  it("RESEND_FROM_ADDRESS missing: sendEmail throws", async () => {
    process.env.RESEND_API_KEY = "re_test_placeholder";
    delete process.env.RESEND_FROM_ADDRESS;
    vi.resetModules();
    const emailModule = await import("@/lib/email");
    await expect(
      emailModule.sendEmail("test@test.com", "subject", "<p>body</p>")
    ).rejects.toThrow(/RESEND_FROM_ADDRESS is required/);
  });

  it("all error messages are descriptive (not just 'undefined')", async () => {
    const cases: Array<{ deleteVar: string; setVars?: Record<string, string>; fn: () => Promise<unknown> }> = [
      {
        deleteVar: "RESEND_API_KEY",
        fn: async () => {
          delete process.env.RESEND_API_KEY;
          vi.resetModules();
          const m = await import("@/lib/email");
          return m.sendEmail("t@t.com", "s", "b");
        },
      },
      {
        deleteVar: "STRIPE_SECRET_KEY",
        fn: async () => {
          delete process.env.STRIPE_SECRET_KEY;
          vi.resetModules();
          const m = await import("@/lib/stripe");
          m.assertStripeEnvVars();
        },
      },
    ];

    for (const c of cases) {
      try {
        await c.fn();
      } catch (e) {
        expect((e as Error).message).not.toBe("undefined");
        expect((e as Error).message.length).toBeGreaterThan(10);
      }
    }
  });
});
