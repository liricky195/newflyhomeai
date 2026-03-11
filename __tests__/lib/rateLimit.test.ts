/**
 * 4A — lib/rateLimit.ts
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, resetRateLimitStore } from "@/lib/rateLimit";

beforeEach(() => {
  resetRateLimitStore();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit (4A)", () => {
  it("first call within window: { allowed: true, retryAfterMs: 0 }", () => {
    const result = rateLimit("test:user1", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("calls up to maxRequests within window: all allowed", () => {
    for (let i = 0; i < 5; i++) {
      const result = rateLimit("test:user2", 5, 60_000);
      expect(result.allowed).toBe(true);
    }
  });

  it("call at maxRequests + 1 within window: { allowed: false, retryAfterMs > 0 }", () => {
    for (let i = 0; i < 5; i++) {
      rateLimit("test:user3", 5, 60_000);
    }
    const result = rateLimit("test:user3", 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("retryAfterMs is a positive integer approximately equal to remaining window time", () => {
    vi.setSystemTime(0);
    for (let i = 0; i < 3; i++) rateLimit("test:user4", 3, 60_000);
    const result = rateLimit("test:user4", 3, 60_000);
    expect(result.allowed).toBe(false);
    // Window started at 0, windowMs = 60_000, oldest = 0
    // retryAfterMs should be approximately 60_000 - elapsed
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("after window expires: same key allowed again", () => {
    vi.setSystemTime(0);
    for (let i = 0; i < 5; i++) rateLimit("test:expire", 5, 60_000);
    expect(rateLimit("test:expire", 5, 60_000).allowed).toBe(false);

    // Advance past window
    vi.advanceTimersByTime(60_001);
    const result = rateLimit("test:expire", 5, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("two different keys: independent limits", () => {
    for (let i = 0; i < 5; i++) rateLimit("test:keyA", 5, 60_000);
    expect(rateLimit("test:keyA", 5, 60_000).allowed).toBe(false);
    expect(rateLimit("test:keyB", 5, 60_000).allowed).toBe(true);
  });

  it("maxRequests = 1: first call allowed, second call rejected", () => {
    expect(rateLimit("test:single", 1, 60_000).allowed).toBe(true);
    expect(rateLimit("test:single", 1, 60_000).allowed).toBe(false);
  });

  it("sliding window: 5 requests at t=0,10,20,30,40s (window=60s); at t=61s first expires; 6th request allowed", () => {
    vi.setSystemTime(0);
    rateLimit("test:slide", 5, 60_000); // t=0
    vi.setSystemTime(10_000);
    rateLimit("test:slide", 5, 60_000); // t=10
    vi.setSystemTime(20_000);
    rateLimit("test:slide", 5, 60_000); // t=20
    vi.setSystemTime(30_000);
    rateLimit("test:slide", 5, 60_000); // t=30
    vi.setSystemTime(40_000);
    rateLimit("test:slide", 5, 60_000); // t=40

    // At t=61s, request at t=0 has expired (61 - 0 = 61 > 60)
    vi.setSystemTime(61_000);
    const result = rateLimit("test:slide", 5, 60_000);
    expect(result.allowed).toBe(true);
  });
});
