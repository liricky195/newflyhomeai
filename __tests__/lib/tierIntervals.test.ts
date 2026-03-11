/**
 * 5A — lib/tierIntervals.ts: single source of truth for scan intervals
 */
import { describe, it, expect } from "vitest";
import { TIER_INTERVALS, getScanInterval } from "@/lib/tierIntervals";

describe("TIER_INTERVALS (5A)", () => {
  it("free tier is 1800 seconds (30 minutes)", () => {
    expect(TIER_INTERVALS.free).toBe(1800);
  });

  it("standard tier is 180 seconds (3 minutes)", () => {
    expect(TIER_INTERVALS.standard).toBe(180);
  });

  it("pro tier is 60 seconds (1 minute)", () => {
    expect(TIER_INTERVALS.pro).toBe(60);
  });

  it("ultimate tier is 30 seconds", () => {
    expect(TIER_INTERVALS.ultimate).toBe(30);
  });

  it("exports exactly 4 tier entries", () => {
    expect(Object.keys(TIER_INTERVALS)).toHaveLength(4);
  });
});

describe("getScanInterval (5A)", () => {
  it("returns 1800 for 'free'", () => {
    expect(getScanInterval("free")).toBe(1800);
  });

  it("returns 180 for 'standard'", () => {
    expect(getScanInterval("standard")).toBe(180);
  });

  it("returns 60 for 'pro'", () => {
    expect(getScanInterval("pro")).toBe(60);
  });

  it("returns 30 for 'ultimate'", () => {
    expect(getScanInterval("ultimate")).toBe(30);
  });

  it("returns 1800 (free default) for unknown tier", () => {
    expect(getScanInterval("unknown")).toBe(1800);
  });

  it("returns 1800 (free default) for null-like empty string", () => {
    expect(getScanInterval("")).toBe(1800);
  });

  it("free is the safe default — getScanInterval fallback equals TIER_INTERVALS.free", () => {
    expect(getScanInterval("nonexistent")).toBe(TIER_INTERVALS.free);
  });
});
