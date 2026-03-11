// @vitest-environment jsdom
/**
 * 8J — /edit-details page
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mock next-auth/react ───────────────────────────────────────────────────────
vi.mock("next-auth/react", () => ({
  useSession: () => ({ status: "authenticated", data: { user: { id: "u1" } } }),
}));

// ── Mock next/navigation ──────────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, refresh: vi.fn() }),
  usePathname: () => "/edit-details",
  useSearchParams: () => new URLSearchParams(),
}));

// ── Mock PageTransition ────────────────────────────────────────────────────────
vi.mock("@/components/shared/PageTransition", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Mock AirportCombobox ──────────────────────────────────────────────────────
vi.mock("@/components/shared/AirportCombobox", () => ({
  default: ({ label, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void; placeholder?: string }) => (
    <div>
      <label>{label}</label>
      <input
        data-testid="airport-combobox"
        placeholder={label}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}));

// ── Mock fetch ─────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
Object.defineProperty(globalThis, "fetch", { writable: true, value: mockFetch });

import EditDetailsPage from "@/app/edit-details/page";

function setupFetch(airportData: unknown = null, personalData: unknown = null) {
  mockFetch.mockImplementation((url: string) => {
    if (url === "/api/monitored-airports") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ airport: airportData, personal: personalData }),
      });
    }
    if (url === "/data/airports.json") {
      return Promise.resolve({
        ok: true,
        json: async () => [
          { iata: "DXB", name: "Dubai International", city: "Dubai", country: "UAE" },
        ],
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupFetch(null, null);
});

describe("/edit-details page (8J)", () => {
  it("GET returns airport=null: airport displayed as 'Not yet configured'", async () => {
    setupFetch(null, null);
    render(<EditDetailsPage />);
    await waitFor(() => {
      expect(screen.getByText(/not yet configured/i)).toBeTruthy();
    });
  });

  it("GET returns airport with airport_iata: airport IATA displayed as read-only", async () => {
    setupFetch({ airport_iata: "DXB", destination_iata: null }, null);
    render(<EditDetailsPage />);
    await waitFor(() => {
      // The airport IATA or name should be visible
      const allText = document.body.textContent ?? "";
      expect(allText).toContain("DXB");
    });
  });

  it("locked airport: 'Cannot be changed' text visible", async () => {
    setupFetch({ airport_iata: "DXB", destination_iata: null }, null);
    render(<EditDetailsPage />);
    await waitFor(() => {
      expect(screen.getByText(/cannot be changed/i)).toBeTruthy();
    });
  });

  it("submit button: disabled and shows spinner while submitting", async () => {
    setupFetch({ airport_iata: "DXB", destination_iata: null }, null);
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/monitored-airports" && !url.includes("POST")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ airport: { airport_iata: "DXB" }, personal: null }),
        });
      }
      // Delay POST to keep button disabled
      return new Promise(() => {}); // never resolves
    });
    render(<EditDetailsPage />);
    await waitFor(() => screen.getByRole("button", { name: /save/i }));

    const submitBtn = screen.getByRole("button", { name: /save/i });
    fireEvent.click(submitBtn);

    // Button disabled while submitting
    await waitFor(() => {
      expect(submitBtn).toHaveProperty("disabled", true);
    });
  });

  it("valid submission: POST /api/monitored-airports called; redirect to /dashboard", async () => {
    setupFetch({ airport_iata: "DXB", destination_iata: null }, null);
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/monitored-airports") {
        if (options?.method === "POST") {
          return Promise.resolve({ ok: true, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ airport: { airport_iata: "DXB" }, personal: null }),
        });
      }
      if (url === "/data/airports.json") {
        return Promise.resolve({
          ok: true,
          json: async () => [{ iata: "DXB", name: "Dubai International", city: "Dubai", country: "UAE" }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<EditDetailsPage />);
    await waitFor(() => screen.getByRole("button", { name: /save/i }));

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/monitored-airports",
        expect.objectContaining({ method: "POST" })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("locked airport: POST body does NOT include airport_iata", async () => {
    setupFetch({ airport_iata: "DXB", destination_iata: null }, null);
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/monitored-airports") {
        if (options?.method === "POST") {
          return Promise.resolve({ ok: true, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ airport: { airport_iata: "DXB" }, personal: null }),
        });
      }
      if (url === "/data/airports.json") {
        return Promise.resolve({
          ok: true,
          json: async () => [{ iata: "DXB", name: "Dubai International", city: "Dubai", country: "UAE" }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<EditDetailsPage />);
    await waitFor(() => screen.getByRole("button", { name: /save/i }));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      mockFetch.mock.calls.some(([u, o]) => u === "/api/monitored-airports" && (o as RequestInit)?.method === "POST")
    );

    const postCall = mockFetch.mock.calls.find(
      ([u, o]) => u === "/api/monitored-airports" && (o as RequestInit)?.method === "POST"
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body).not.toHaveProperty("airport_iata");
  });

  it("API returns 403: error shown inline", async () => {
    setupFetch({ airport_iata: "DXB", destination_iata: null }, null);
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/monitored-airports") {
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: false,
            json: async () => ({ error: "Your stranded airport cannot be changed" }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ airport: { airport_iata: "DXB" }, personal: null }),
        });
      }
      if (url === "/data/airports.json") {
        return Promise.resolve({
          ok: true,
          json: async () => [{ iata: "DXB", name: "Dubai International", city: "Dubai", country: "UAE" }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(<EditDetailsPage />);
    await waitFor(() => screen.getByRole("button", { name: /save/i }));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot be changed/i)).toBeTruthy();
    });
  });
});
