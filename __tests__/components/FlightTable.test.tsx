/**
 * 5J — FlightTable SWR configuration and nextScanAt handling
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mock SWR ──────────────────────────────────────────────────────────────────

const mockUseSWR = vi.fn();

vi.mock("swr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("swr")>();
  return {
    ...actual,
    default: (...args: unknown[]) => mockUseSWR(...args),
    useSWRConfig: () => ({ mutate: vi.fn() }),
  };
});

// ── Mock ScanContext ──────────────────────────────────────────────────────────

const mockUseScan = vi.fn(() => ({
  nextScanAt: null,
  remaining: null,
  airportIata: "DXB",
  scanIntervalSeconds: 1800,
}));

vi.mock("@/contexts/ScanContext", () => ({
  useScan: () => mockUseScan(),
}));

// ── Mock framer-motion ────────────────────────────────────────────────────────

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    tr: (props: Record<string, unknown>) => <tr {...props} />,
  },
}));

// ── Mock next/dynamic ─────────────────────────────────────────────────────────

vi.mock("next/dynamic", () => ({
  default: (fn: () => Promise<{ default: React.ComponentType }>) => {
    return () => null;
  },
}));

// ── Mock FlightsReminderModal (uses motion.div not in framer-motion mock) ─────

vi.mock("@/components/flights/FlightsReminderModal", () => ({
  default: () => null,
}));

// ── Mock FlightsLoadingSkeleton ────────────────────────────────────────────────

vi.mock("@/components/flights/FlightsLoadingSkeleton", () => ({
  default: () => <div data-testid="loading-skeleton" />,
}));

// ── Mock FlightRow ─────────────────────────────────────────────────────────────

vi.mock("@/components/flights/FlightRow", () => ({
  default: () => null,
}));

// ── Mock ScanCountdown ────────────────────────────────────────────────────────

const mockScanCountdown = vi.fn();

vi.mock("@/components/dashboard/ScanCountdown", () => ({
  default: (props: { nextScanAt: number | null }) => {
    mockScanCountdown(props);
    return <div data-testid="scan-countdown">{props.nextScanAt === null ? "Scanning …" : `${props.nextScanAt}`}</div>;
  },
}));

import FlightTable from "@/components/flights/FlightTable";

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultSWRResult(overrides = {}) {
  return {
    data: undefined,
    error: undefined,
    isLoading: true,
    mutate: vi.fn(),
    isValidating: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Default: loading state
  mockUseSWR.mockReturnValue(defaultSWRResult());
});

describe("FlightTable SWR configuration (5J)", () => {
  it("SWR config: refreshInterval is 0 (no autonomous polling — only ScanContext triggers flights fetches)", () => {
    render(<FlightTable airportIata="DXB" />);

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining("DXB"),
      expect.any(Function),
      expect.objectContaining({ refreshInterval: 0 })
    );
  });

  it("SWR config: revalidateOnMount is false (initial fetch driven by ScanContext, not SWR)", () => {
    render(<FlightTable airportIata="DXB" />);

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ revalidateOnMount: false })
    );
  });

  it("SWR config: revalidateOnFocus is false", () => {
    render(<FlightTable airportIata="DXB" />);

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ revalidateOnFocus: false })
    );
  });

  it("SWR config: revalidateOnReconnect is false (reconnect must not trigger a refetch independently)", () => {
    render(<FlightTable airportIata="DXB" />);

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ revalidateOnReconnect: false })
    );
  });

  it("SWR config: dedupingInterval is 30_000", () => {
    render(<FlightTable airportIata="DXB" />);

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ dedupingInterval: 30_000 })
    );
  });

  it("SWR receives { flights, nextScanAt } shape and passes nextScanAt to ScanCountdown", () => {
    const nextScanAt = 1700100000;
    mockUseSWR.mockReturnValue(
      defaultSWRResult({
        data: { flights: [], nextScanAt },
        isLoading: false,
      })
    );

    render(<FlightTable airportIata="DXB" />);

    expect(mockScanCountdown).toHaveBeenCalledWith(
      expect.objectContaining({ nextScanAt })
    );
  });

  it("SWR config: fallbackData is populated from localStorage when cached data exists for the airport", () => {
    const cachedPayload: { flights: { id: string }[]; nextScanAt: number } = {
      flights: [{ id: "fl-cached-001" }],
      nextScanAt: 1700100000,
    };
    localStorage.setItem("flights:DXB", JSON.stringify(cachedPayload));

    render(<FlightTable airportIata="DXB" />);

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.stringContaining("DXB"),
      expect.any(Function),
      expect.objectContaining({
        fallbackData: expect.objectContaining({
          flights: expect.arrayContaining([
            expect.objectContaining({ id: "fl-cached-001" }),
          ]),
        }),
      })
    );
  });

  it("SWR config: fallbackData is undefined when no localStorage entry exists", () => {
    // localStorage is empty (cleared in beforeEach)
    render(<FlightTable airportIata="DXB" />);

    expect(mockUseSWR).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ fallbackData: undefined })
    );
  });

  it("onSuccess callback writes fresh flights response to localStorage under flights:<airport> key", () => {
    render(<FlightTable airportIata="DXB" />);

    const config = mockUseSWR.mock.calls[0][2] as {
      onSuccess: (data: { flights: { id: string }[]; nextScanAt: number }) => void;
    };
    const freshData = { flights: [{ id: "fl-fresh-001" }], nextScanAt: 1700200000 };
    config.onSuccess(freshData);

    const stored = JSON.parse(localStorage.getItem("flights:DXB") ?? "null");
    expect(stored).not.toBeNull();
    expect(stored.flights[0].id).toBe("fl-fresh-001");
    expect(stored.nextScanAt).toBe(1700200000);
  });

  it("SWR error: FlightTable renders error state; ScanCountdown receives null and shows 'Scanning …'", () => {
    mockUseSWR.mockReturnValue(
      defaultSWRResult({
        data: undefined,
        error: new Error("Network error"),
        isLoading: false,
        isValidating: false,
      })
    );

    render(<FlightTable airportIata="DXB" />);

    // ScanCountdown should receive null on error
    expect(mockScanCountdown).toHaveBeenCalledWith(
      expect.objectContaining({ nextScanAt: null })
    );

    // Error state rendered
    expect(screen.getByText(/Error loading/i)).toBeTruthy();
  });
});

// ─── 8B extensions ────────────────────────────────────────────────────────────

describe("FlightTable 8B extensions", () => {
  it("empty state: shows correct message with interval from ScanContext", () => {
    mockUseScan.mockReturnValue({
      nextScanAt: null,
      remaining: null,
      airportIata: "DXB",
      scanIntervalSeconds: 1800,
    });
    mockUseSWR.mockReturnValue(
      defaultSWRResult({ data: { flights: [], nextScanAt: null }, isLoading: false })
    );
    render(<FlightTable airportIata="DXB" />);
    expect(
      screen.getByText(/no departures found at DXB/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/monitor is active and checking every/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/1800 seconds/i)
    ).toBeTruthy();
  });

  it("error state: Retry button visible; click calls mutate", () => {
    const mutateMock = vi.fn();
    mockUseSWR.mockReturnValue(
      defaultSWRResult({
        data: undefined,
        error: new Error("Network error"),
        isLoading: false,
        mutate: mutateMock,
      })
    );
    render(<FlightTable airportIata="DXB" />);
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
    expect(mutateMock).toHaveBeenCalled();
  });

  it("AIRPORT_NAMES lookup: known DXB → 'Dubai International'", () => {
    mockUseSWR.mockReturnValue(
      defaultSWRResult({ data: { flights: [], nextScanAt: null }, isLoading: false })
    );
    render(<FlightTable airportIata="DXB" />);
    expect(screen.getByText("Dubai International")).toBeTruthy();
  });

  it("loading state: skeleton component rendered", () => {
    mockUseSWR.mockReturnValue(defaultSWRResult({ data: undefined, isLoading: true }));
    render(<FlightTable airportIata="DXB" />);
    // FlightsLoadingSkeleton is mocked to return data-testid="loading-skeleton"
    expect(screen.getByTestId("loading-skeleton")).toBeTruthy();
  });
});
