/**
 * 5I — ScanCountdown.tsx: server-anchored countdown using nextScanAt prop
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import ScanCountdown from "@/components/dashboard/ScanCountdown";

// Use fake timers for all tests
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

describe("ScanCountdown (5I)", () => {
  it("nextScanAt set to 60 seconds in the future: renders '01:00'", () => {
    const nextScanAt = nowSeconds() + 60;
    const { container } = render(<ScanCountdown nextScanAt={nextScanAt} />);

    act(() => {
      vi.advanceTimersByTime(100); // let first tick fire
    });

    expect(screen.getByText("01:00")).toBeTruthy();
  });

  it("nextScanAt set to 1800 seconds in the future: renders '30:00'", () => {
    const nextScanAt = nowSeconds() + 1800;
    render(<ScanCountdown nextScanAt={nextScanAt} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText("30:00")).toBeTruthy();
  });

  it("nextScanAt set to 90 seconds in the future: renders '01:30'", () => {
    const nextScanAt = nowSeconds() + 90;
    render(<ScanCountdown nextScanAt={nextScanAt} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText("01:30")).toBeTruthy();
  });

  it("nextScanAt set to 9 seconds in the future: renders '00:09' (leading zeros on both MM and SS)", () => {
    const nextScanAt = nowSeconds() + 9;
    render(<ScanCountdown nextScanAt={nextScanAt} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText("00:09")).toBeTruthy();
  });

  it("advance fake timer by 1 second: countdown shows 1 second less (not reset to full)", () => {
    const nextScanAt = nowSeconds() + 60;
    render(<ScanCountdown nextScanAt={nextScanAt} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("01:00")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1000); // advance 1 second
    });
    expect(screen.getByText("00:59")).toBeTruthy();
  });

  it("advance fake timer by 30 seconds: countdown shows 30 seconds less", () => {
    const nextScanAt = nowSeconds() + 1800;
    render(<ScanCountdown nextScanAt={nextScanAt} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("30:00")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(30 * 1000);
    });
    expect(screen.getByText("29:30")).toBeTruthy();
  });

  it("advance fake timer past nextScanAt: display shows 'Scanning …' (not negative time, not '00:00' frozen)", () => {
    const nextScanAt = nowSeconds() + 5;
    render(<ScanCountdown nextScanAt={nextScanAt} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    act(() => {
      vi.advanceTimersByTime(10_000); // advance past expiry
    });

    expect(screen.getByText(/Scanning/i)).toBeTruthy();
    expect(screen.queryByText("00:00")).toBeNull();
  });

  it("nextScanAt is null: display shows 'Scanning …' with pulse indicator", () => {
    render(<ScanCountdown nextScanAt={null} />);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText(/Scanning/i)).toBeTruthy();
    // Pulse indicator should be present (animate-pulse class)
    const pulseEl = document.querySelector(".animate-pulse");
    expect(pulseEl).not.toBeNull();
  });

  it("page 'reload' (component unmount + remount) with same nextScanAt: countdown continues from correct value, not reset to 30:00", () => {
    // Simulate mid-cycle: 15 minutes remaining
    const nextScanAt = nowSeconds() + 15 * 60;

    const { unmount } = render(<ScanCountdown nextScanAt={nextScanAt} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText("15:00")).toBeTruthy();

    // Advance 2 minutes
    act(() => { vi.advanceTimersByTime(2 * 60 * 1000); });
    expect(screen.getByText("13:00")).toBeTruthy();

    // Unmount (simulate page reload)
    unmount();

    // Remount with same nextScanAt — should show ~13:00, not 15:00 or 30:00
    render(<ScanCountdown nextScanAt={nextScanAt} />);
    act(() => { vi.advanceTimersByTime(100); });

    // Accept 13:00 or 12:59 depending on millisecond boundary alignment at test start
    const remountDisplay = screen.getByText(/^\d{2}:\d{2}$/).textContent!;
    const remountMinutes = parseInt(remountDisplay.split(":")[0]);
    expect(remountMinutes).toBeGreaterThanOrEqual(12);
    expect(remountMinutes).toBeLessThanOrEqual(13);
    // Must not show the original full interval (15:00) or any longer reset
    expect(screen.queryByText("15:00")).toBeNull();
    expect(screen.queryByText("30:00")).toBeNull();
  });

  it("no scanIntervalMs or tier prop: component renders without these (absent from prop interface)", () => {
    // This is a TypeScript compile-time check verified by the type of the props.
    // At runtime, just verify it renders correctly with only nextScanAt.
    const nextScanAt = nowSeconds() + 60;
    render(<ScanCountdown nextScanAt={nextScanAt} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByText("01:00")).toBeTruthy();
  });

  it("Server render (SSR): renders 'Scanning …' as initial value — no hydration mismatch", () => {
    // Before useEffect fires (simulating SSR state), the component renders "Scanning …"
    // We verify by checking that the initial render (before timers advance) shows scanning.
    const nextScanAt = nowSeconds() + 1800;
    render(<ScanCountdown nextScanAt={nextScanAt} />);

    // Don't advance timers — check SSR/initial state
    expect(screen.getByText(/Scanning/i)).toBeTruthy();
  });

  it("container has fixed CSS dimensions: no layout shift when digits change (tabular-nums or min-width)", () => {
    const nextScanAt = nowSeconds() + 60;
    const { container } = render(<ScanCountdown nextScanAt={nextScanAt} />);
    act(() => { vi.advanceTimersByTime(100); });

    // Verify the countdown span has tabular-nums class or style for fixed width
    const countdownSpan = container.querySelector(".tabular-nums, [style*='min-width']");
    expect(countdownSpan).not.toBeNull();
  });
});
