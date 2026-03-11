// @vitest-environment jsdom
/**
 * 8I — UserTable component
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ── Mock SWR ──────────────────────────────────────────────────────────────────
const mockUseSWR = vi.fn();

vi.mock("swr", () => ({
  default: (...args: unknown[]) => mockUseSWR(...args),
}));

// ── Mock fetch ─────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
Object.defineProperty(globalThis, "fetch", { writable: true, value: mockFetch });

import UserTable from "@/components/admin/UserTable";
import type { DbAdminUser } from "@/lib/db";

function makeUser(overrides: Partial<DbAdminUser> = {}): DbAdminUser {
  return {
    id: "user-001",
    email: "test@example.com",
    role: "user",
    tier: "free",
    airport_iata: "DXB",
    scan_interval_seconds: 1800,
    ...overrides,
  };
}

const DEFAULT_RESPONSE = {
  users: [makeUser()],
  total: 1,
  page: 1,
  limit: 50,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSWR.mockReturnValue({
    data: DEFAULT_RESPONSE,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
});

describe("UserTable (8I)", () => {
  it("loading state: skeleton rows visible", () => {
    mockUseSWR.mockReturnValue({ data: undefined, isLoading: true, error: undefined, mutate: vi.fn() });
    const { container } = render(<UserTable currentUserId="admin-1" />);
    const skeleton = container.querySelectorAll("tr td .animate-pulse");
    expect(skeleton.length).toBeGreaterThan(0);
  });

  it("error state: error message and Retry button visible", () => {
    const mutateMock = vi.fn();
    mockUseSWR.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("HTTP 500"),
      mutate: mutateMock,
    });
    render(<UserTable currentUserId="admin-1" />);
    expect(screen.getByText(/HTTP 500/i)).toBeTruthy();
    const retryBtn = screen.getByRole("button", { name: /retry/i });
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
    expect(mutateMock).toHaveBeenCalled();
  });

  it("renders user email and role badge", () => {
    render(<UserTable currentUserId="admin-1" />);
    expect(screen.getByText("test@example.com")).toBeTruthy();
    expect(screen.getByText("User")).toBeTruthy();
  });

  it("Admin badge for role='admin'", () => {
    mockUseSWR.mockReturnValue({
      data: { users: [makeUser({ role: "admin", id: "admin-2" })], total: 1, page: 1, limit: 50 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<UserTable currentUserId="admin-1" />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("User badge for role='user'", () => {
    render(<UserTable currentUserId="admin-1" />);
    expect(screen.getByText("User")).toBeTruthy();
  });

  it("'Make Admin' button shown for role='user' users", () => {
    render(<UserTable currentUserId="admin-1" />);
    expect(screen.getByRole("button", { name: /make admin/i })).toBeTruthy();
  });

  it("'Remove Admin' button shown for role='admin' users", () => {
    mockUseSWR.mockReturnValue({
      data: { users: [makeUser({ role: "admin", id: "admin-2" })], total: 1, page: 1, limit: 50 },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<UserTable currentUserId="admin-1" />);
    expect(screen.getByRole("button", { name: /remove admin/i })).toBeTruthy();
  });

  it("own row (current user): role toggle button absent", () => {
    render(<UserTable currentUserId="user-001" />);
    expect(screen.queryByRole("button", { name: /make admin|remove admin/i })).toBeNull();
    // "You" badge shown
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("Make Admin click → shows confirm dialog", () => {
    render(<UserTable currentUserId="admin-1" />);
    fireEvent.click(screen.getByRole("button", { name: /make admin/i }));
    // Confirm dialog appears
    expect(screen.getByRole("button", { name: /confirm/i })).toBeTruthy();
  });

  it("Make Admin: confirm → POST /api/admin/users/[id]/role called with {role:'admin'}", async () => {
    const mutateMock = vi.fn();
    mockUseSWR.mockReturnValue({
      data: { users: [makeUser({ id: "user-001", role: "user" })], total: 1, page: 1, limit: 50 },
      isLoading: false,
      error: undefined,
      mutate: mutateMock,
    });
    render(<UserTable currentUserId="admin-1" />);

    fireEvent.click(screen.getByRole("button", { name: /make admin/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-001/role",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"admin"'),
        })
      );
    });
    expect(mutateMock).toHaveBeenCalled();
  });

  it("Reset Airport click → confirm dialog; DELETE called on confirm; SWR revalidated", async () => {
    const mutateMock = vi.fn();
    mockUseSWR.mockReturnValue({
      data: { users: [makeUser({ airport_iata: "DXB" })], total: 1, page: 1, limit: 50 },
      isLoading: false,
      error: undefined,
      mutate: mutateMock,
    });
    render(<UserTable currentUserId="admin-1" />);

    fireEvent.click(screen.getByRole("button", { name: /reset airport/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-001/airport",
        expect.objectContaining({ method: "DELETE" })
      );
    });
    expect(mutateMock).toHaveBeenCalled();
  });

  it("Change subscription tier: PATCH called when Apply clicked", async () => {
    render(<UserTable currentUserId="admin-1" />);
    // Change the select to a different tier
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "pro" } });
    // Apply button should appear
    const applyBtn = screen.getByRole("button", { name: /apply/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/users/user-001/subscription",
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });
});
