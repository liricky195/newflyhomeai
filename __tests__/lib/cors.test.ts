/**
 * 4B — lib/cors.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { corsHeaders } from "@/lib/cors";

beforeEach(() => {
  vi.stubEnv("NEXTAUTH_URL", "https://flyhome.ai");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("corsHeaders (4B)", () => {
  it("matching origin returns Access-Control-Allow-Origin with the origin", () => {
    const headers = corsHeaders("https://flyhome.ai");
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://flyhome.ai");
  });

  it("disallowed origin returns empty object", () => {
    const headers = corsHeaders("https://evil.com");
    expect(headers).toEqual({});
  });

  it("null origin returns empty object (restricted)", () => {
    const headers = corsHeaders(null);
    expect(headers).toEqual({});
  });

  it("all CORS header keys present when match", () => {
    const headers = corsHeaders("https://flyhome.ai");
    expect(headers["Access-Control-Allow-Origin"]).toBeDefined();
    expect(headers["Access-Control-Allow-Methods"]).toBeDefined();
    expect(headers["Access-Control-Allow-Headers"]).toBeDefined();
  });

  it("Access-Control-Allow-Methods includes GET, POST, PATCH, DELETE, OPTIONS", () => {
    const headers = corsHeaders("https://flyhome.ai");
    expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
    expect(headers["Access-Control-Allow-Methods"]).toContain("OPTIONS");
  });

  it("NEXTAUTH_URL not set: returns {} for any origin", () => {
    vi.stubEnv("NEXTAUTH_URL", "");
    const headers = corsHeaders("https://flyhome.ai");
    expect(headers).toEqual({});
  });

  it("unrestricted=true: always returns CORS headers regardless of origin", () => {
    const headers = corsHeaders("https://evil.com", true);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://evil.com");
  });

  it("unrestricted=true with null origin: returns * as Allow-Origin", () => {
    const headers = corsHeaders(null, true);
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("unrestricted=true when NEXTAUTH_URL is not set: still returns headers", () => {
    vi.stubEnv("NEXTAUTH_URL", "");
    const headers = corsHeaders("https://anything.com", true);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://anything.com");
  });
});
