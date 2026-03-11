// @vitest-environment jsdom
/**
 * 5M — BookingCard: all UI states
 * File: __tests__/components/BookingCard.test.tsx
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ── Mock SWR ─────────────────────────────────────────────────────────────────

const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

import BookingCard from "@/components/bookings/BookingCard";

// ── Fixtures ──────────────────────────────────────────────────────────────────

type BookingStatus = "confirmed" | "pending" | "cancelled";

const BOOKING_DEFAULTS = {
  id: "bk-001",
  user_id: "u1",
  flight_id: "fl-001",
  flight_number: "EK101",
  departure_airport: "DXB",
  destination_airport: "LHR",
  scheduled_departure: 1741334400,
  airline: "Emirates",
  status: "confirmed" as BookingStatus,
  cancelled_reason: null as string | null,
  cancellation_pending: 0 as 0 | 1,
  confirm_fetch_failed: 0 as 0 | 1,
  total_amount: "450.00" as string | null,
  total_currency: "GBP" as string | null,
  booking_reference: "ABCREF" as string | null,
  ticket_number: "TKT-12345" as string | null,
  duffel_order_id: "ord_abc",
  duffel_offer_id: "off_1",
  stripe_payment_intent_id: null,
  duffel_cancellation_id: null,
  refund_amount_cents: null,
  refund_to: null,
  stripe_refund_id: null,
  internal_reference: null,
  duffel_total: "450.00" as string | null,
  duffel_link_id: null,
  pending_cancellation_id: null,
  currency: "GBP",
  passenger_details: "{}",
  created_at: 1000000,
  updated_at: 1000000,
};

// Merge overrides while preserving explicit null values (spread alone loses explicit nulls)
function makeBooking(overrides: Partial<typeof BOOKING_DEFAULTS>) {
  return { ...BOOKING_DEFAULTS, ...overrides };
}

const noop = vi.fn();

// ── Default SWR mock: no data, not loading ────────────────────────────────────

beforeEach(() => {
  mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: undefined });
  vi.clearAllMocks();
  mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: undefined });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5M — BookingCard UI states
// ─────────────────────────────────────────────────────────────────────────────

describe("BookingCard (5M)", () => {
  it("status='confirmed', all fields present → renders green Confirmed badge, booking_reference, ticket_number, total_amount", () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", booking_reference: "REF999", ticket_number: "TKT-999", total_amount: "500.00", total_currency: "USD" })}
        onCancelled={noop}
      />
    );

    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("REF999")).toBeInTheDocument();
    expect(screen.getByText("TKT-999")).toBeInTheDocument();
    expect(screen.getByText(/500\.00/)).toBeInTheDocument();
  });

  it("status='confirmed', ticket_number=null → renders '—' for ticket field without crashing", () => {
    expect(() =>
      render(
        <BookingCard
          booking={makeBooking({ status: "confirmed", ticket_number: null })}
          onCancelled={noop}
        />
      )
    ).not.toThrow();

    // Badge rendered correctly
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    // At least one em-dash placeholder is rendered (ticket field)
    const allText = document.body.textContent ?? "";
    expect(allText).toContain("—");
  });

  it("status='confirmed', cancellation_pending=1 → renders yellow warning banner with 'pending manual review'; cancel button absent", () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 1 })}
        onCancelled={noop}
      />
    );

    expect(screen.getByText(/pending manual review/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cancel booking/i })).not.toBeInTheDocument();
  });

  it("status='pending' → renders grey 'Payment in progress' label; cancel button absent", () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "pending", total_amount: null })}
        onCancelled={noop}
      />
    );

    // Multiple elements may contain "Payment in progress" text (badge + body message)
    const matches = screen.getAllByText(/payment in progress/i);
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /cancel booking/i })).not.toBeInTheDocument();
  });

  it("status='cancelled', cancelled_reason='user_cancelled' → renders 'Cancelled by You' badge", () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "cancelled", cancelled_reason: "user_cancelled" })}
        onCancelled={noop}
      />
    );

    expect(screen.getByText("Cancelled by You")).toBeInTheDocument();
  });

  it("status='cancelled', cancelled_reason='flight_cancelled' → renders 'Cancelled by Airline' badge", () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "cancelled", cancelled_reason: "flight_cancelled" })}
        onCancelled={noop}
      />
    );

    expect(screen.getByText("Cancelled by Airline")).toBeInTheDocument();
  });

  it("status='cancelled', cancelled_reason='duffel_failure' → renders 'Booking Failed' badge", () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "cancelled", cancelled_reason: "duffel_failure" })}
        onCancelled={noop}
      />
    );

    expect(screen.getByText("Booking Failed")).toBeInTheDocument();
  });

  it("status='cancelled', cancelled_reason='payment_failed' → renders badge without crashing", () => {
    expect(() =>
      render(
        <BookingCard
          booking={makeBooking({ status: "cancelled", cancelled_reason: "payment_failed" })}
          onCancelled={noop}
        />
      )
    ).not.toThrow();
    // Falls back to the generic "Cancelled" badge
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("conditions load fails (SWR error) → renders 'Policy details unavailable', no crash", () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to fetch"),
    });

    expect(() =>
      render(
        <BookingCard
          booking={makeBooking({ status: "confirmed" })}
          onCancelled={noop}
        />
      )
    ).not.toThrow();

    expect(screen.getByText(/policy details unavailable/i)).toBeInTheDocument();
  });

  it("conditions.available=false → renders 'Policy details unavailable'", () => {
    mockUseSWR.mockReturnValue({
      data: { available: false },
      isLoading: false,
      error: undefined,
    });

    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed" })}
        onCancelled={noop}
      />
    );

    expect(screen.getByText(/policy details unavailable/i)).toBeInTheDocument();
  });

  it("conditions not loaded (refund_before_departure null equivalent) → 'Refund policy information is not available' shown in cancel panel", () => {
    // No conditions data loaded — SWR returns undefined
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: undefined });

    const { getByRole } = render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 0 })}
        onCancelled={noop}
      />
    );

    // Open the cancel panel using fireEvent to ensure React state updates
    const cancelBtn = getByRole("button", { name: /cancel booking/i });
    fireEvent.click(cancelBtn);

    // The cancel panel shows a message containing "Refund policy information is not available"
    // which may span multiple nodes; use a function matcher for robustness
    expect(
      screen.getByText((content) =>
        content.toLowerCase().includes("refund policy information is not available")
      )
    ).toBeInTheDocument();
  });

  it("cancel button present for confirmed booking without cancellation_pending", () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 0 })}
        onCancelled={noop}
      />
    );

    expect(screen.getByRole("button", { name: /cancel booking/i })).toBeInTheDocument();
  });
});

// ─── 8E extensions ────────────────────────────────────────────────────────────

describe("BookingCard conditions display (8E)", () => {
  it("refundable=true, no penalty → 'fully refundable' text", () => {
    mockUseSWR.mockReturnValue({
      data: {
        available: true,
        conditions: {
          refundable: true,
          refundPenalty: null,
          refundPenaltyCurrency: null,
          changeable: false,
          changePenalty: null,
          changePenaltyCurrency: null,
        },
      },
      isLoading: false,
      error: undefined,
    });
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed" })}
        onCancelled={noop}
      />
    );
    expect(screen.getByText(/fully refundable/i)).toBeInTheDocument();
  });

  it("refundable=true, penalty='50.00' → 'cancellation fee is 50.00' text", () => {
    mockUseSWR.mockReturnValue({
      data: {
        available: true,
        conditions: {
          refundable: true,
          refundPenalty: "50.00",
          refundPenaltyCurrency: "GBP",
          changeable: false,
          changePenalty: null,
          changePenaltyCurrency: null,
        },
      },
      isLoading: false,
      error: undefined,
    });
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed" })}
        onCancelled={noop}
      />
    );
    expect(screen.getByText(/cancellation fee is 50\.00/i)).toBeInTheDocument();
  });

  it("refundable=false → 'non-refundable' text", () => {
    mockUseSWR.mockReturnValue({
      data: {
        available: true,
        conditions: {
          refundable: false,
          refundPenalty: null,
          refundPenaltyCurrency: null,
          changeable: false,
          changePenalty: null,
          changePenaltyCurrency: null,
        },
      },
      isLoading: false,
      error: undefined,
    });
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed" })}
        onCancelled={noop}
      />
    );
    expect(screen.getByText(/non-refundable/i)).toBeInTheDocument();
  });

  it("conditions=null → 'Refund policy information is not available' in cancel panel", () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: false, error: undefined });
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 0 })}
        onCancelled={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel booking/i }));
    expect(
      screen.getByText(/refund policy information is not available/i)
    ).toBeInTheDocument();
  });
});

describe("BookingCard cancellation flow (8E)", () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    Object.defineProperty(globalThis, "fetch", { writable: true, value: mockFetch });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        refundAmount: "450.00",
        refundCurrency: "GBP",
        refundTo: "card",
        refundMessage: "Refund processed.",
      }),
    });
  });

  it("Cancel POST 200 → card updates to cancelled status", async () => {
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 0 })}
        onCancelled={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel booking/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm cancellation/i }));
    await waitFor(() => {
      expect(screen.getByText(/cancelled by you/i)).toBeInTheDocument();
    });
  });

  it("Cancel POST 409 → error message shown; card stays confirmed", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Cancellation already in progress" }),
    });
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 0 })}
        onCancelled={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel booking/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm cancellation/i }));
    await waitFor(() => {
      expect(screen.getByText(/cancellation already in progress/i)).toBeInTheDocument();
    });
    // Still confirmed badge
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("Cancel POST 502 → error message shown; card stays confirmed", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "Service unavailable" }),
    });
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 0 })}
        onCancelled={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel booking/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm cancellation/i }));
    await waitFor(() => {
      expect(screen.getByText(/service unavailable/i)).toBeInTheDocument();
    });
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("refund_to='voucher' response → voucher copy shown in toast", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        refundAmount: "450.00",
        refundCurrency: "GBP",
        refundTo: "voucher",
        refundMessage: "",
      }),
    });
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 0 })}
        onCancelled={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel booking/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm cancellation/i }));
    await waitFor(() => {
      const allText = document.body.textContent ?? "";
      expect(allText.toLowerCase()).toContain("voucher");
    });
  });

  it("refund_to='balance' response → balance/operator copy shown in toast", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        refundAmount: "450.00",
        refundCurrency: "GBP",
        refundTo: "balance",
        refundMessage: "",
      }),
    });
    render(
      <BookingCard
        booking={makeBooking({ status: "confirmed", cancellation_pending: 0 })}
        onCancelled={noop}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel booking/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm cancellation/i }));
    await waitFor(() => {
      const allText = document.body.textContent ?? "";
      expect(allText.toLowerCase()).toContain("balance");
    });
  });
});
