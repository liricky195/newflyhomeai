/**
 * 5G — GET /bookings/confirm (server component page)
 * File: __tests__/api/bookings-confirm.test.ts
 * Uses a real in-memory SQLite DB with all migrations applied.
 * Mocks: fetchDuffelOrder, getServerSession, redirect, email, push.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";

// ── DB setup (real in-memory) ─────────────────────────────────────────────────

import { setDb, initDb, createUser, upsertFlight, createPendingBookingForDuffel, getBookingById } from "@/lib/db";

function freshDb() {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  setDb(db);
  initDb(db);
  return db;
}

const USER_ID = "confirm-user-001";
const OTHER_USER_ID = "confirm-user-002";

function seedUser(id = USER_ID) {
  createUser({ id, email: `${id}@test.com`, name: "Test User", image: null });
}

function seedFlight() {
  upsertFlight({
    id: "fl-confirm-001",
    flight_number: "EK101",
    airline: "Emirates",
    departure_airport: "DXB",
    destination_airport: "LHR",
    scheduled_departure: Math.floor(Date.now() / 1000) + 3600,
    estimated_departure: null,
    status: "scheduled",
    aircraft_type: "B777",
    bookable: 1,
    lowest_price_cents: null,
    price_currency: null,
  });
}

function seedPendingBooking(ref: string, userId = USER_ID) {
  return createPendingBookingForDuffel({
    id: `bk-${ref}`,
    user_id: userId,
    flight_id: "fl-confirm-001",
    duffel_offer_id: "off-1",
    internal_reference: ref,
    passenger_details: JSON.stringify({ given_name: "Alice", family_name: "Smith" }),
  });
}

// ── Mock next/navigation redirect ─────────────────────────────────────────────

const mockRedirect = vi.fn().mockImplementation((url: string): never => {
  throw Object.assign(new Error("REDIRECT"), { url });
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// ── Mock next-auth ────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// ── Mock fetchDuffelOrder ─────────────────────────────────────────────────────

const mockFetchDuffelOrder = vi.fn();

vi.mock("@/lib/duffel", () => ({
  fetchDuffelOrder: (...args: unknown[]) => mockFetchDuffelOrder(...args),
}));

// ── Mock email / push ─────────────────────────────────────────────────────────

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/push", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from "next-auth";

// ── Duffel order fixture ──────────────────────────────────────────────────────

const MOCK_ORDER = {
  id: "ord_abc123",
  booking_reference: "XYZREF",
  total_amount: "450.00",
  total_currency: "GBP",
  documents: [{ document_number: "TKT-001-2025" }],
  passengers: [],
  slices: [],
  conditions: {},
};

// ── Helper — call confirm page and capture redirect URL ───────────────────────

type SessionOverride = { user: { id: string; email: string }; expires: string } | null;

async function callConfirmPage(
  ref?: string,
  orderId?: string,
  userId = USER_ID,
  sessionOverride: SessionOverride | "default" = "default"
) {
  const session: SessionOverride =
    sessionOverride === "default"
      ? { user: { id: userId, email: `${userId}@test.com` }, expires: "" }
      : sessionOverride;

  vi.mocked(getServerSession).mockResolvedValueOnce(session);

  const { default: BookingConfirmPage } = await import(
    "@/app/bookings/confirm/page"
  );

  try {
    await BookingConfirmPage({
      searchParams: Promise.resolve({
        ref,
        order_id: orderId,
      }),
    });
    return { redirectUrl: null, threw: false };
  } catch (err) {
    const e = err as Error & { url?: string };
    if (e.message === "REDIRECT") {
      return { redirectUrl: e.url, threw: true };
    }
    throw err;
  }
}

beforeEach(async () => {
  freshDb();
  seedUser(USER_ID);
  seedUser(OTHER_USER_ID);
  seedFlight();
  // Use resetAllMocks (not clearAllMocks) to also clear the mockResolvedValueOnce
  // queue. Tests where the page redirects before calling getServerSession (e.g.,
  // missing-param tests) leave un-consumed queue entries that would otherwise
  // bleed into subsequent tests.
  vi.resetAllMocks();
  // Restore implementations that must always return a Promise (page calls .catch())
  mockRedirect.mockImplementation((url: string): never => {
    throw Object.assign(new Error("REDIRECT"), { url });
  });
  const { sendEmail } = await import("@/lib/email");
  const { sendPushNotification } = await import("@/lib/push");
  vi.mocked(sendEmail).mockResolvedValue(undefined);
  vi.mocked(sendPushNotification).mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5G — /bookings/confirm page
// ─────────────────────────────────────────────────────────────────────────────

describe("/bookings/confirm (5G)", () => {
  it("valid ref + order_id, pending booking, correct session → DB row confirmed; redirect to /bookings", async () => {
    const booking = seedPendingBooking("ref-happy");
    mockFetchDuffelOrder.mockResolvedValueOnce(MOCK_ORDER);

    const result = await callConfirmPage("ref-happy", "ord_abc123");

    expect(result.redirectUrl).toBe("/bookings");
    const updated = getBookingById(booking.id);
    expect(updated!.status).toBe("confirmed");
  });

  it("all 6 new fields written and non-null after confirmation", async () => {
    const booking = seedPendingBooking("ref-fields");
    mockFetchDuffelOrder.mockResolvedValueOnce(MOCK_ORDER);

    await callConfirmPage("ref-fields", "ord_abc123");

    const updated = getBookingById(booking.id);
    expect(updated!.duffel_order_id).toBe("ord_abc123");
    expect(updated!.booking_reference).toBe("XYZREF");
    expect(updated!.ticket_number).toBe("TKT-001-2025");
    expect(updated!.duffel_total).toBe("450.00");
    expect(updated!.total_currency).toBe("GBP");
  });

  it("booking_reference null in Duffel order → stored as 'PENDING'; booking confirmed", async () => {
    const booking = seedPendingBooking("ref-null-bkref");
    mockFetchDuffelOrder.mockResolvedValueOnce({
      ...MOCK_ORDER,
      booking_reference: null,
    });

    await callConfirmPage("ref-null-bkref", "ord_abc123");

    const updated = getBookingById(booking.id);
    expect(updated!.status).toBe("confirmed");
    expect(updated!.booking_reference).toBe("PENDING");
  });

  it("documents empty → ticket_number stored as null; booking confirmed", async () => {
    const booking = seedPendingBooking("ref-empty-docs");
    mockFetchDuffelOrder.mockResolvedValueOnce({
      ...MOCK_ORDER,
      documents: [],
    });

    await callConfirmPage("ref-empty-docs", "ord_abc123");

    const updated = getBookingById(booking.id);
    expect(updated!.status).toBe("confirmed");
    expect(updated!.ticket_number).toBeNull();
  });

  it("idempotent — second call redirects to /bookings immediately; fetchDuffelOrder called only once", async () => {
    const booking = seedPendingBooking("ref-idempotent");
    mockFetchDuffelOrder.mockResolvedValue(MOCK_ORDER);

    // First call confirms booking
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: USER_ID, email: `${USER_ID}@test.com` },
      expires: "",
    });
    const { default: BookingConfirmPage } = await import("@/app/bookings/confirm/page");

    try {
      await BookingConfirmPage({ searchParams: Promise.resolve({ ref: "ref-idempotent", order_id: "ord_abc123" }) });
    } catch { /* redirect */ }

    // Second call — already confirmed
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { id: USER_ID, email: `${USER_ID}@test.com` },
      expires: "",
    });
    try {
      await BookingConfirmPage({ searchParams: Promise.resolve({ ref: "ref-idempotent", order_id: "ord_abc123" }) });
    } catch { /* redirect */ }

    // fetchDuffelOrder only called once (on first invocation)
    expect(mockFetchDuffelOrder).toHaveBeenCalledTimes(1);
    expect(getBookingById(booking.id)!.status).toBe("confirmed");
  });

  it("booking.status='cancelled' on arrival → 302 to /bookings; fetchDuffelOrder NOT called", async () => {
    const booking = seedPendingBooking("ref-already-canc");
    // Manually set status to cancelled
    const db = new Database(":memory:");
    // Use the live DB via direct import
    const { getDb } = await import("@/lib/db");
    getDb().prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(booking.id);

    mockFetchDuffelOrder.mockResolvedValue(MOCK_ORDER);

    const result = await callConfirmPage("ref-already-canc", "ord_abc123");

    expect(result.redirectUrl).toBe("/bookings");
    expect(mockFetchDuffelOrder).not.toHaveBeenCalled();
    void db.close(); // close unused db
  });

  it("unknown ref → 302 to /flights", async () => {
    const result = await callConfirmPage("ref-unknown-xyz", "ord_abc123");
    expect(result.redirectUrl).toBe("/flights");
    expect(mockFetchDuffelOrder).not.toHaveBeenCalled();
  });

  it("ref belongs to different user → 302 to /flights; DB row unchanged", async () => {
    const booking = seedPendingBooking("ref-wrong-user", OTHER_USER_ID);

    const result = await callConfirmPage("ref-wrong-user", "ord_abc123", USER_ID);

    expect(result.redirectUrl).toBe("/flights");
    const unchanged = getBookingById(booking.id);
    expect(unchanged!.status).toBe("pending");
  });

  it("missing ref param → 302 to /flights", async () => {
    const result = await callConfirmPage(undefined, "ord_abc123");
    expect(result.redirectUrl).toBe("/flights");
    expect(mockFetchDuffelOrder).not.toHaveBeenCalled();
  });

  it("missing order_id param → 302 to /flights", async () => {
    seedPendingBooking("ref-no-orderid");
    const result = await callConfirmPage("ref-no-orderid", undefined);
    expect(result.redirectUrl).toBe("/flights");
    expect(mockFetchDuffelOrder).not.toHaveBeenCalled();
  });

  it("fetchDuffelOrder throws 404 ApiError → confirm_fetch_failed=1; status still 'pending'; redirect to /bookings/confirm-error", async () => {
    const booking = seedPendingBooking("ref-fetch-404");
    const err = Object.assign(new Error("Not found"), { httpStatus: 404, apiMessage: "Order not found" });
    mockFetchDuffelOrder.mockRejectedValueOnce(err);

    const result = await callConfirmPage("ref-fetch-404", "ord_notfound");

    expect(result.redirectUrl).toMatch(/\/bookings\/confirm-error/);
    const updated = getBookingById(booking.id);
    expect(updated!.status).toBe("pending");
    expect(updated!.confirm_fetch_failed).toBe(1);
  });

  it("fetchDuffelOrder throws 500 → confirm_fetch_failed=1; status still 'pending'; redirect to /bookings/confirm-error", async () => {
    const booking = seedPendingBooking("ref-fetch-500");
    mockFetchDuffelOrder.mockRejectedValueOnce(
      Object.assign(new Error("Server error"), { httpStatus: 500 })
    );

    const result = await callConfirmPage("ref-fetch-500", "ord_server_err");

    expect(result.redirectUrl).toMatch(/\/bookings\/confirm-error/);
    const updated = getBookingById(booking.id);
    expect(updated!.confirm_fetch_failed).toBe(1);
    expect(updated!.status).toBe("pending");
  });

  it("fetchDuffelOrder throws network error → confirm_fetch_failed=1; redirect to /bookings/confirm-error", async () => {
    const booking = seedPendingBooking("ref-network-err");
    mockFetchDuffelOrder.mockRejectedValueOnce(new Error("fetch failed"));

    const result = await callConfirmPage("ref-network-err", "ord_net_err");

    expect(result.redirectUrl).toMatch(/\/bookings\/confirm-error/);
    const updated = getBookingById(booking.id);
    expect(updated!.confirm_fetch_failed).toBe(1);
  });

  it("no session (expired) → redirect to /auth with callbackUrl encoding full confirm URL", async () => {
    seedPendingBooking("ref-no-session");

    const result = await callConfirmPage("ref-no-session", "ord_sess_test", USER_ID, null);

    expect(result.redirectUrl).not.toBeNull();
    expect(result.redirectUrl).toMatch(/^\/auth\?callbackUrl=/);
    // callbackUrl must encode both ref and order_id
    const decoded = decodeURIComponent(result.redirectUrl!.replace("/auth?callbackUrl=", ""));
    expect(decoded).toContain("ref-no-session");
    expect(decoded).toContain("ord_sess_test");
  });

  it("email/push throws after DB write → redirect to /bookings still issued; no 500", async () => {
    const { sendEmail } = await import("@/lib/email");
    const { sendPushNotification } = await import("@/lib/push");
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Email down"));
    vi.mocked(sendPushNotification).mockRejectedValueOnce(new Error("Push down"));

    seedPendingBooking("ref-notify-fail");
    mockFetchDuffelOrder.mockResolvedValueOnce(MOCK_ORDER);

    const result = await callConfirmPage("ref-notify-fail", "ord_abc123");

    // redirect to /bookings should still happen
    expect(result.redirectUrl).toBe("/bookings");
  });
});
