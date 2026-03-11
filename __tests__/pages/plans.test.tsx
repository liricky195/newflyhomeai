// @vitest-environment jsdom
/**
 * 8L — /plans page (PricingGrid + PricingCard)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Mock SWR ──────────────────────────────────────────────────────────────────
const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

// ── Mock framer-motion ─────────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Mock next/navigation ──────────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockPush, refresh: vi.fn() }),
}));

// ── Mock fetch ─────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
Object.defineProperty(globalThis, "fetch", { writable: true, value: mockFetch });

import PricingGrid from "@/components/plans/PricingGrid";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: undefined });
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
});

describe("PricingGrid / /plans page (8L)", () => {
  it("all 4 tiers rendered: Free, Standard, Pro, Ultimate", () => {
    render(
      <PricingGrid
        userId="u1"
        currentTier="free"
        currentPeriodEnd={null}
        cancelAtPeriodEnd={0}
        hasActiveStripeSubscription={false}
      />
    );
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Standard")).toBeTruthy();
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.getByText("Ultimate")).toBeTruthy();
  });

  it("prices shown correctly (£0, £19.99, £39.99, £69.99 / $0, $19.99, $39.99, $69.99 per week)", () => {
    render(
      <PricingGrid
        userId="u1"
        currentTier="free"
        currentPeriodEnd={null}
        cancelAtPeriodEnd={0}
        hasActiveStripeSubscription={false}
      />
    );
    // Prices shown ($ variants used in this codebase)
    expect(screen.getByText("$0")).toBeTruthy();
    expect(screen.getByText("$19.99/wk")).toBeTruthy();
    expect(screen.getByText("$39.99/wk")).toBeTruthy();
    expect(screen.getByText("$69.99/wk")).toBeTruthy();
  });

  it("scan intervals shown correctly per tier", () => {
    render(
      <PricingGrid
        userId="u1"
        currentTier="free"
        currentPeriodEnd={null}
        cancelAtPeriodEnd={0}
        hasActiveStripeSubscription={false}
      />
    );
    expect(screen.getByText(/30-min scans/i)).toBeTruthy();
    expect(screen.getByText(/3-min scans/i)).toBeTruthy();
    expect(screen.getByText(/1-min scans/i)).toBeTruthy();
    expect(screen.getByText(/30-sec scans/i)).toBeTruthy();
  });

  it("no 'service fee' or 'booking margin' text anywhere", () => {
    render(
      <PricingGrid
        userId="u1"
        currentTier="free"
        currentPeriodEnd={null}
        cancelAtPeriodEnd={0}
        hasActiveStripeSubscription={false}
      />
    );
    const allText = document.body.textContent ?? "";
    expect(allText.toLowerCase()).not.toContain("service fee");
    expect(allText.toLowerCase()).not.toContain("booking margin");
  });

  it("unauthenticated (userId=null): Get Started links shown", () => {
    render(
      <PricingGrid
        userId={null}
        currentTier="free"
        currentPeriodEnd={null}
        cancelAtPeriodEnd={0}
        hasActiveStripeSubscription={false}
      />
    );
    const startLinks = screen.getAllByRole("link", { name: /get started/i });
    // At least one for non-free tiers
    expect(startLinks.length).toBeGreaterThan(0);
  });

  it("current plan badge shown on current tier", () => {
    render(
      <PricingGrid
        userId="u1"
        currentTier="pro"
        currentPeriodEnd={null}
        cancelAtPeriodEnd={0}
        hasActiveStripeSubscription={false}
      />
    );
    expect(screen.getByText("Current Plan")).toBeTruthy();
  });

  it("Upgrade button shown for higher tiers when current is free", () => {
    render(
      <PricingGrid
        userId="u1"
        currentTier="free"
        currentPeriodEnd={null}
        cancelAtPeriodEnd={0}
        hasActiveStripeSubscription={false}
      />
    );
    const upgradeBtns = screen.getAllByRole("button", { name: /upgrade/i });
    expect(upgradeBtns.length).toBeGreaterThan(0);
  });
});
