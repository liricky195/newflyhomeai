// @vitest-environment jsdom
/**
 * 8F — AlertFeed component
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Mock SWR ──────────────────────────────────────────────────────────────────
const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

// ── Mock next/link ─────────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import AlertFeed from "@/components/dashboard/AlertFeed";
import type { DbNotification } from "@/lib/db";

function makeNotification(overrides: Partial<DbNotification> = {}): DbNotification {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    user_id: "u1",
    type: "new_flight",
    title: "New flight available",
    body: "EK101 is now available",
    sent_at: Math.floor(Date.now() / 1000) - 120,
    read_at: null,
    push_sent: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: undefined, mutate: vi.fn() });
});

describe("AlertFeed (8F)", () => {
  it("loading state: skeleton rows visible when isLoading=true", () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true, error: undefined, mutate: vi.fn() });
    const { container } = render(<AlertFeed />);
    // Skeleton elements have shimmer class
    const shimmerEls = container.querySelectorAll(".shimmer");
    expect(shimmerEls.length).toBeGreaterThan(0);
  });

  it("error state: error message and Retry button visible", () => {
    const mutateMock = vi.fn();
    mockUseSWR.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("HTTP 500"),
      mutate: mutateMock,
    });
    render(<AlertFeed />);
    expect(screen.getByText(/HTTP 500/i)).toBeTruthy();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
    expect(mutateMock).toHaveBeenCalled();
  });

  it("empty state: 'No alerts yet. Monitoring is active.' with amber pulse", () => {
    mockUseSWR.mockReturnValue({
      data: { notifications: [], total: 0 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<AlertFeed />);
    expect(screen.getByText(/no alerts yet\. monitoring is active\./i)).toBeTruthy();
    // Pulse indicator
    const pulse = document.querySelector(".animate-radar");
    expect(pulse).not.toBeNull();
  });

  it("with notifications: each shows icon, title, body, timestamp", () => {
    const n = makeNotification({ title: "Flight alert", body: "Seats available", sent_at: Math.floor(Date.now() / 1000) - 60 });
    mockUseSWR.mockReturnValue({
      data: { notifications: [n], total: 1 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<AlertFeed />);
    expect(screen.getByText("Flight alert")).toBeTruthy();
    expect(screen.getByText("Seats available")).toBeTruthy();
    // Relative timestamp ("1 min ago")
    expect(screen.getByText(/min ago|just now/i)).toBeTruthy();
  });

  it("unread notification: dot visible", () => {
    const n = makeNotification({ read_at: null });
    mockUseSWR.mockReturnValue({
      data: { notifications: [n], total: 1 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<AlertFeed />);
    const dot = document.querySelector("[data-testid='unread-dot']");
    expect(dot).not.toBeNull();
  });

  it("read notification (read_at set): dot not visible", () => {
    const n = makeNotification({ read_at: Math.floor(Date.now() / 1000) - 300 });
    mockUseSWR.mockReturnValue({
      data: { notifications: [n], total: 1 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<AlertFeed />);
    const dot = document.querySelector("[data-testid='unread-dot']");
    expect(dot).toBeNull();
  });

  it("exactly 20 notifications: all shown; no 'View all' link", () => {
    const notifications = Array.from({ length: 20 }, (_, i) =>
      makeNotification({ id: `n-${i}`, title: `Alert ${i}` })
    );
    mockUseSWR.mockReturnValue({
      data: { notifications, total: 20 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<AlertFeed />);
    // All 20 visible
    for (let i = 0; i < 20; i++) {
      expect(screen.getByText(`Alert ${i}`)).toBeTruthy();
    }
    // No "View all" link
    expect(screen.queryByText(/view all/i)).toBeNull();
  });

  it("more than 20 notifications: only 20 shown; 'View all' link visible", () => {
    const notifications = Array.from({ length: 25 }, (_, i) =>
      makeNotification({ id: `n-${i}`, title: `Alert ${i}` })
    );
    mockUseSWR.mockReturnValue({
      data: { notifications, total: 25 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<AlertFeed />);
    // 20th item visible
    expect(screen.getByText("Alert 19")).toBeTruthy();
    // 21st item not visible
    expect(screen.queryByText("Alert 20")).toBeNull();
    // "View all" link visible
    expect(screen.getByText(/view all/i)).toBeTruthy();
  });

  it("timestamp: relative format ('2 min ago', '1h ago', etc.)", () => {
    const twoMinsAgo = Math.floor(Date.now() / 1000) - 120;
    const n = makeNotification({ sent_at: twoMinsAgo });
    mockUseSWR.mockReturnValue({
      data: { notifications: [n], total: 1 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<AlertFeed />);
    expect(screen.getByText(/2 min ago/i)).toBeTruthy();
  });
});
