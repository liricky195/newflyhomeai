/**
 * lib/email.ts tests
 * File: __tests__/lib/email.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock Resend SDK ────────────────────────────────────────────────────────────
const mockEmailsSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_key_123");
  vi.stubEnv("RESEND_FROM_ADDRESS", "alerts@flyhome.ai");
  mockEmailsSend.mockResolvedValue({ error: null });
  // Reset the singleton so each test starts fresh
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sendEmail", () => {
  it("sends email successfully", async () => {
    const { sendEmail } = await import("@/lib/email");
    await expect(sendEmail("user@example.com", "Test Subject", "<p>Hello</p>")).resolves.toBeUndefined();
    expect(mockEmailsSend).toHaveBeenCalledWith({
      from: "alerts@flyhome.ai",
      to: "user@example.com",
      subject: "Test Subject",
      html: "<p>Hello</p>",
    });
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    vi.unstubAllEnvs();
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await import("@/lib/email");
    await expect(sendEmail("u@test.com", "S", "<p>B</p>")).rejects.toThrow("RESEND_API_KEY is required");
    vi.stubEnv("RESEND_API_KEY", "re_test_key_123");
    vi.stubEnv("RESEND_FROM_ADDRESS", "alerts@flyhome.ai");
  });

  it("throws when RESEND_FROM_ADDRESS is missing", async () => {
    delete process.env.RESEND_FROM_ADDRESS;
    const { sendEmail } = await import("@/lib/email");
    await expect(sendEmail("u@test.com", "S", "<p>B</p>")).rejects.toThrow("RESEND_FROM_ADDRESS is required");
  });

  it("throws when Resend returns an error object", async () => {
    mockEmailsSend.mockResolvedValueOnce({ error: { message: "Invalid recipient" } });
    const { sendEmail } = await import("@/lib/email");
    await expect(sendEmail("bad@example.com", "S", "<p>B</p>")).rejects.toThrow("Resend error: Invalid recipient");
  });
});
