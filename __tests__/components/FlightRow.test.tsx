// @vitest-environment jsdom
/**
 * 8C — FlightRow component
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    tr: ({ children, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { layout?: unknown; layoutId?: unknown; initial?: unknown; animate?: unknown; transition?: unknown }) => {
      const { layout: _l, layoutId: _lid, initial: _i, animate: _a, transition: _t, ...rest } = props as Record<string, unknown>;
      return <tr {...(rest as React.HTMLAttributes<HTMLTableRowElement>)}>{children}</tr>;
    },
  },
}));

import FlightRow from "@/components/flights/FlightRow";
import type { DbFlight } from "@/lib/db";

const BASE_FLIGHT: DbFlight = {
  id: "fl-001",
  flight_number: "EK101",
  airline: "Emirates",
  departure_airport: "DXB",
  destination_airport: "LHR",
  scheduled_departure: 1741334400,
  estimated_departure: null,
  status: "scheduled",
  lowest_price_cents: 45000,
  price_currency: "GBP",
  last_seen_at: 1741330000,
  created_at: 1741330000,
  updated_at: 1741330000,
};

const noop = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FlightRow (8C)", () => {
  it("renders flight number, airline, destination, status label, book button", () => {
    render(
      <table>
        <tbody>
          <FlightRow
            flight={BASE_FLIGHT}
            isNew={false}
            onBook={noop}
          />
        </tbody>
      </table>
    );
    // Flight number rendered
    const allText = document.body.textContent ?? "";
    expect(allText).toContain("EK101");
    expect(allText).toContain("Emirates");
    expect(allText).toContain("LHR");
    expect(allText).toContain("Scheduled");
  });

  it("Book button enabled when hasConfirmedPrice=true; calls onBook with flight on click", () => {
    const onBook = vi.fn();
    render(
      <table>
        <tbody>
          <FlightRow
            flight={{ ...BASE_FLIGHT, lowest_price_cents: 10000, price_currency: "USD" }}
            isNew={false}
            onBook={onBook}
          />
        </tbody>
      </table>
    );
    const bookBtns = screen.getAllByText(/book/i);
    // Click the first visible book button
    fireEvent.click(bookBtns[0]);
    expect(onBook).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fl-001" })
    );
  });

  it("Book button disabled when lowest_price_cents is null", () => {
    render(
      <table>
        <tbody>
          <FlightRow
            flight={{ ...BASE_FLIGHT, lowest_price_cents: null }}
            isNew={false}
            onBook={noop}
          />
        </tbody>
      </table>
    );
    const disabledBtns = document.querySelectorAll("button[disabled]");
    expect(disabledBtns.length).toBeGreaterThan(0);
  });

  it("isPreferred=true: renders 'Direct' badge", () => {
    render(
      <table>
        <tbody>
          <FlightRow
            flight={BASE_FLIGHT}
            isNew={false}
            onBook={noop}
            preferredDest="LHR"
          />
        </tbody>
      </table>
    );
    expect(screen.getAllByText("Direct").length).toBeGreaterThan(0);
  });

  it("isNew=true: row renders without crashing", () => {
    expect(() =>
      render(
        <table>
          <tbody>
            <FlightRow
              flight={BASE_FLIGHT}
              isNew={true}
              onBook={noop}
            />
          </tbody>
        </table>
      )
    ).not.toThrow();
  });

  it("status='active': renders 'Boarding' label", () => {
    render(
      <table>
        <tbody>
          <FlightRow
            flight={{ ...BASE_FLIGHT, status: "active" }}
            isNew={false}
            onBook={noop}
          />
        </tbody>
      </table>
    );
    expect(screen.getAllByText("Boarding").length).toBeGreaterThan(0);
  });

  it("status='cancelled': renders 'Cancelled' label", () => {
    render(
      <table>
        <tbody>
          <FlightRow
            flight={{ ...BASE_FLIGHT, status: "cancelled" }}
            isNew={false}
            onBook={noop}
          />
        </tbody>
      </table>
    );
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0);
  });

  it("status='landed': renders 'Landed' label", () => {
    render(
      <table>
        <tbody>
          <FlightRow
            flight={{ ...BASE_FLIGHT, status: "landed" }}
            isNew={false}
            onBook={noop}
          />
        </tbody>
      </table>
    );
    expect(screen.getAllByText("Landed").length).toBeGreaterThan(0);
  });

  it("price=null: shows '—' placeholder, no price text", () => {
    render(
      <table>
        <tbody>
          <FlightRow
            flight={{ ...BASE_FLIGHT, lowest_price_cents: null }}
            isNew={false}
            onBook={noop}
          />
        </tbody>
      </table>
    );
    const allText = document.body.textContent ?? "";
    expect(allText).toContain("—");
  });

  it("mobile card layout rendered (colSpan=6 cell present)", () => {
    const { container } = render(
      <table>
        <tbody>
          <FlightRow
            flight={BASE_FLIGHT}
            isNew={false}
            onBook={noop}
          />
        </tbody>
      </table>
    );
    const mobileCell = container.querySelector("td[colSpan='6']");
    expect(mobileCell).not.toBeNull();
  });
});
