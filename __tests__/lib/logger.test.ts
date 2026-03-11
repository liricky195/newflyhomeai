/**
 * Tests for lib/logger.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/logger.ts", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stdoutSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stderrSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    vi.resetModules();
  });

  it("log('info', ...) writes JSON to stdout", async () => {
    const { log } = await import("@/lib/logger");
    log("info", "test-service", "hello info");

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const written = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.level).toBe("info");
    expect(parsed.service).toBe("test-service");
    expect(parsed.message).toBe("hello info");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("log('warn', ...) writes JSON to stdout", async () => {
    const { log } = await import("@/lib/logger");
    log("warn", "test-service", "hello warn");

    expect(stdoutSpy).toHaveBeenCalledOnce();
    const written = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.level).toBe("warn");
  });

  it("log('error', ...) writes JSON to stderr, not stdout", async () => {
    const { log } = await import("@/lib/logger");
    log("error", "test-service", "hello error");

    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stdoutSpy).not.toHaveBeenCalled();
    const written = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.level).toBe("error");
  });

  it("context fields are merged into the JSON output", async () => {
    const { log } = await import("@/lib/logger");
    log("info", "test-service", "with context", { userId: "u1", count: 5 });

    const written = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    expect(parsed.userId).toBe("u1");
    expect(parsed.count).toBe(5);
  });

  it("timestamp is a valid ISO 8601 string", async () => {
    const { log } = await import("@/lib/logger");
    log("info", "test-service", "timestamp check");

    const written = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(written.trim());
    const ts = new Date(parsed.timestamp);
    expect(ts.toISOString()).toBe(parsed.timestamp);
  });

  it("log without context does not throw", async () => {
    const { log } = await import("@/lib/logger");
    expect(() => log("info", "svc", "no context")).not.toThrow();
  });
});
