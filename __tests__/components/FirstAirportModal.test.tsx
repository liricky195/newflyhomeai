/**
 * FirstAirportModal — Case 2 white-box test.
 *
 * GET /api/flights?airport=<iata> MUST be triggered exactly 3 seconds after
 * the user confirms their stranded airport in the FirstAirportModal popup.
 * It MUST NOT be triggered before those 3 seconds have elapsed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Mock next-auth ─────────────────────────────────────────────────────────────

vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated" }),
}));

// ── Mock SWR ──────────────────────────────────────────────────────────────────

const mockGlobalMutate = vi.fn();
const mockLocalMutate = vi.fn();

vi.mock("swr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("swr")>();
  return {
    ...actual,
    default: (key: string) => {
      if (key === "/api/monitored-airports") {
        // No airport set yet — modal should be visible
        return {
          data: { airport: null },
          isLoading: false,
          mutate: mockLocalMutate,
        };
      }
      return { data: undefined, isLoading: false, mutate: vi.fn() };
    },
    useSWRConfig: () => ({ mutate: mockGlobalMutate }),
  };
});

// ── Mock AirportCombobox ───────────────────────────────────────────────────────
// Renders a simple button that, when clicked, calls onChange with "DXB".

vi.mock("@/components/shared/AirportCombobox", () => ({
  default: ({
    onChange,
  }: {
    value: string | null;
    onChange: (iata: string) => void;
    placeholder?: string;
    required?: boolean;
  }) => (
    <button
      type="button"
      data-testid="airport-select-btn"
      onClick={() => onChange("DXB")}
    >
      Select DXB
    </button>
  ),
}));

// ── Mock global fetch ──────────────────────────────────────────────────────────

const mockFetch = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).fetch = mockFetch;

import FirstAirportModal from "@/components/onboarding/FirstAirportModal";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();

  // Default: POST /api/monitored-airports succeeds
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ ok: true }),
  });

  // After mutate() is called (modal's local SWR refresh), keep data unchanged
  // so the component's dismissed state is the only thing hiding it.
  mockLocalMutate.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("FirstAirportModal — Case 2: 3-second GET /api/flights trigger", () => {
  it("fires GET /api/flights for the confirmed airport exactly 3 seconds after submission", async () => {
    render(<FirstAirportModal />);

    // Select an airport via the combobox
    await act(async () => {
      fireEvent.click(screen.getByTestId("airport-select-btn"));
    });

    // Submit the form — Confirm My Airport button must now be enabled
    const confirmBtn = screen.getByRole("button", { name: /Confirm My Airport/i });
    await act(async () => {
      fireEvent.submit(confirmBtn.closest("form")!);
    });

    // Flush the fetch promise and React state updates
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Before 3 seconds: GET /api/flights must NOT have been triggered
    expect(mockGlobalMutate).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/flights")
    );

    // Advance exactly 3 seconds
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Now the trigger must have fired for the confirmed airport
    expect(mockGlobalMutate).toHaveBeenCalledWith("/api/flights?airport=DXB");
  });

  it("does NOT fire GET /api/flights before 3 seconds have elapsed", async () => {
    render(<FirstAirportModal />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("airport-select-btn"));
    });

    const confirmBtn = screen.getByRole("button", { name: /Confirm My Airport/i });
    await act(async () => {
      fireEvent.submit(confirmBtn.closest("form")!);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Advance only 2 seconds — not yet
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockGlobalMutate).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/flights")
    );
  });

  it("also refreshes /api/scan-status at the same 3-second mark", async () => {
    render(<FirstAirportModal />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("airport-select-btn"));
    });

    const confirmBtn = screen.getByRole("button", { name: /Confirm My Airport/i });
    await act(async () => {
      fireEvent.submit(confirmBtn.closest("form")!);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockGlobalMutate).toHaveBeenCalledWith("/api/scan-status");
  });

  it("does NOT fire if the form is never submitted (no airport selected)", async () => {
    render(<FirstAirportModal />);

    // Do not interact with the form
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(mockGlobalMutate).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/flights")
    );
  });

  it("does NOT fire if the POST request fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    render(<FirstAirportModal />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("airport-select-btn"));
    });

    const confirmBtn = screen.getByRole("button", { name: /Confirm My Airport/i });
    await act(async () => {
      fireEvent.submit(confirmBtn.closest("form")!);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockGlobalMutate).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/flights")
    );
  });
});
