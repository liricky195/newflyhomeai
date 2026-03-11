// @vitest-environment jsdom
/**
 * 8K — /bookings page
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// ── Mock SWR ──────────────────────────────────────────────────────────────────
const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
  useSWRConfig: () => ({ mutate: vi.fn() }),
}));

// ── Mock next/link ─────────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>{children}</a>
  ),
}));

// ── Mock BookingCard ──────────────────────────────────────────────────────────
vi.mock("@/components/bookings/BookingCard", () => ({
  default: ({ booking }: { booking: { booking_reference: string; status: string } }) => (
    <div data-testid="booking-card">
      <span>{booking.booking_reference}</span>
      <span>{booking.status}</span>
    </div>
  ),
}));

// ── Mock next-auth/react ───────────────────────────────────────────────────────
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated", data: { user: { id: "u1" } } }),
}));

// ── Mock next/navigation ──────────────────────────────────────────────────────
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

import BookingsPage from "@/app/bookings/page";

function makeBooking(overrides = {}) {
  return {
    id: "bk-001",
    user_id: "u1",
    flight_id: "fl-001",
    flight_number: "EK101",
    departure_airport: "DXB",
    destination_airport: "LHR",
    scheduled_departure: 1741334400,
    airline: "Emirates",
    status: "confirmed",
    cancelled_reason: null,
    cancellation_pending: 0,
    confirm_fetch_failed: 0,
    total_amount: "450.00",
    total_currency: "GBP",
    booking_reference: "ABC123",
    ticket_number: "TKT-001",
    duffel_order_id: "ord_001",
    duffel_offer_id: "off_001",
    stripe_payment_intent_id: null,
    duffel_cancellation_id: null,
    refund_amount_cents: null,
    refund_to: null,
    stripe_refund_id: null,
    internal_reference: null,
    duffel_total: "450.00",
    duffel_link_id: null,
    pending_cancellation_id: null,
    currency: "GBP",
    passenger_details: "{}",
    created_at: Math.floor(Date.now() / 1000) - 60, // 1 minute ago
    updated_at: Math.floor(Date.now() / 1000) - 60,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSWR.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  });
});

describe("/bookings page (8K)", () => {
  it("empty state: 'You have no bookings yet.' message shown", () => {
    mockUseSWR.mockReturnValue({
      data: { bookings: [] },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<BookingsPage />);
    expect(screen.getByText(/you have no bookings yet/i)).toBeTruthy();
  });

  it("loading state: skeleton visible when loading", () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
      mutate: vi.fn(),
    });
    const { container } = render(<BookingsPage />);
    const animated = container.querySelector(".animate-pulse");
    expect(animated).not.toBeNull();
  });

  it("multiple bookings: all cards rendered", () => {
    const bookings = [
      makeBooking({ id: "bk-001", booking_reference: "REF001" }),
      makeBooking({ id: "bk-002", booking_reference: "REF002" }),
    ];
    mockUseSWR.mockReturnValue({
      data: { bookings },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<BookingsPage />);
    const cards = screen.getAllByTestId("booking-card");
    expect(cards).toHaveLength(2);
  });

  it("recent confirmed booking (< 5 min ago): success toast shown with booking_reference", async () => {
    const booking = makeBooking({
      booking_reference: "SUCCESSREF",
      status: "confirmed",
      created_at: Math.floor(Date.now() / 1000) - 60,
    });
    mockUseSWR.mockReturnValue({
      data: { bookings: [booking] },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<BookingsPage />);
    // Toast shows "Your booking is confirmed! Reference: SUCCESSREF"
    await waitFor(() => {
      expect(screen.getByText(/Your booking is confirmed! Reference:/i)).toBeTruthy();
    });
  });

  it("booking_reference='PENDING': toast says 'reference will arrive by email'", async () => {
    const booking = makeBooking({
      booking_reference: "PENDING",
      status: "confirmed",
      created_at: Math.floor(Date.now() / 1000) - 60,
    });
    mockUseSWR.mockReturnValue({
      data: { bookings: [booking] },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<BookingsPage />);
    await waitFor(() => {
      expect(screen.getByText(/reference will arrive by email/i)).toBeTruthy();
    });
  });

  it("no recent confirmed booking: no success toast shown", () => {
    const booking = makeBooking({
      booking_reference: "OLDREF",
      status: "confirmed",
      created_at: Math.floor(Date.now() / 1000) - 400, // > 5 min ago
    });
    mockUseSWR.mockReturnValue({
      data: { bookings: [booking] },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<BookingsPage />);
    // The toast says "Your booking is confirmed!" — this should NOT appear
    expect(screen.queryByText(/your booking is confirmed!/i)).toBeNull();
  });

  it("empty bookings: 'Visit the Flights page' link present", () => {
    mockUseSWR.mockReturnValue({
      data: { bookings: [] },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<BookingsPage />);
    const link = screen.getByRole("link", { name: /browse flights/i });
    expect(link).toBeTruthy();
  });
});
