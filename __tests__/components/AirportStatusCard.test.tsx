// @vitest-environment jsdom
/**
 * 8H — AirportStatusCard component
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AirportStatusCard from "@/components/dashboard/AirportStatusCard";

describe("AirportStatusCard (8H)", () => {
  it("renders IATA code and airport name for known airport", () => {
    render(<AirportStatusCard airportIata="DXB" />);
    expect(screen.getByText("DXB")).toBeTruthy();
    expect(screen.getByText(/Dubai International/i)).toBeTruthy();
  });

  it("disruption indicator visible", () => {
    const { container } = render(<AirportStatusCard airportIata="DXB" />);
    const indicator = container.querySelector("[data-testid='disruption-indicator']");
    expect(indicator).not.toBeNull();
  });

  it("unknown airport: renders IATA code as fallback", () => {
    render(<AirportStatusCard airportIata="JFK" />);
    // Both the large code span and the fallback name paragraph show JFK
    const allJfk = screen.getAllByText("JFK");
    expect(allJfk.length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain("JFK");
  });

  it("null airport: renders without crashing, no IATA text", () => {
    expect(() => render(<AirportStatusCard airportIata={null} />)).not.toThrow();
    expect(screen.queryByText("DXB")).toBeNull();
  });

  it("undefined airport: renders without crashing", () => {
    expect(() => render(<AirportStatusCard />)).not.toThrow();
  });

  it("renders airport name for AUH", () => {
    render(<AirportStatusCard airportIata="AUH" />);
    expect(screen.getByText(/Abu Dhabi International/i)).toBeTruthy();
  });
});
