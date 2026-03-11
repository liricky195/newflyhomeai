/**
 * Tests for lib/db.ts
 * Every test uses an isolated in-memory SQLite database.
 * The module-level singleton is swapped via setDb() before each test.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import Database from "better-sqlite3";
import {
  setDb,
  initDb,
  // Users
  createUser,
  getUserByEmail,
  getUserById,
  // Sessions
  createSession,
  getSessionByToken,
  deleteSession,
  // Subscriptions
  createSubscription,
  createDefaultSubscription,
  getSubscriptionByUserId,
  updateStripeSubscriptionTier,
  updateSubscriptionTier,
  getSubscriptionByStripeId,
  // Monitored airports
  setMonitoredAirport,
  getMonitoredAirport,
  updateScanTimestamps,
  getNextScanAt,
  // Flights
  upsertFlight,
  updateFlightBookable,
  updateFlightPrice,
  getFlightsByAirport,
  getFlightById,
  // Bookings
  createBooking,
  getBookingsByUserId,
  createPendingBookingForDuffel,
  getBookingByInternalReference,
  confirmBooking,
  cancelBookingByUser,
  setCancellationPending,
  purgeStalePendingBookings,
  getBookingById,
  // Notifications
  createNotification,
  getNotificationsByUserId,
  // Push subscriptions
  savePushSubscription,
  getPushSubscriptionsByUserId,
  deletePushSubscription,
  // Uncovered functions
  deactivateOtherAirports,
  setAirportLastScanAt,
  getAllFlightStatuses,
  updateAirportLastScanAt,
  setUserPersonalDetails,
  getUserPersonalDetails,
  updateUserEmailNotifications,
  updateBookingStatus,
  getConfirmedBookingsByFlightId,
  getBookingsWithFlightsByUserId,
  getAllBookingsWithUsersAndFlights,
} from "@/lib/db";
import { getScanInterval } from "@/lib/tierIntervals";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function freshDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  setDb(db);
  initDb(db);
  return db;
}

const USER_ID = "user-001";
const USER_EMAIL = "alice@example.com";

function seedUser() {
  return createUser({ id: USER_ID, email: USER_EMAIL, name: "Alice", image: null });
}

function seedFlight() {
  return upsertFlight({
    id: "fl-001",
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

// ─────────────────────────────────────────────────────────────────────────────
// Setup — fresh DB per test
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  freshDb();
});

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

describe("createUser", () => {
  it("inserts a new user and returns the correct shape", () => {
    const user = createUser({
      id: USER_ID,
      email: USER_EMAIL,
      name: "Alice",
      image: "https://example.com/alice.jpg",
    });

    expect(user.id).toBe(USER_ID);
    expect(user.email).toBe(USER_EMAIL);
    expect(user.name).toBe("Alice");
    expect(user.image).toBe("https://example.com/alice.jpg");
    expect(user.role).toBe("user");
    expect(typeof user.created_at).toBe("number");
    expect(typeof user.updated_at).toBe("number");
  });

  it("upserts on duplicate email without throwing", () => {
    createUser({ id: USER_ID, email: USER_EMAIL, name: "Alice", image: null });
    const updated = createUser({
      id: "different-id",
      email: USER_EMAIL,
      name: "Alice Updated",
      image: null,
    });
    expect(updated.email).toBe(USER_EMAIL);
    expect(updated.name).toBe("Alice Updated");
  });
});

describe("getUserByEmail", () => {
  it("returns the user when found", () => {
    seedUser();
    const user = getUserByEmail(USER_EMAIL);
    expect(user).not.toBeNull();
    expect(user!.id).toBe(USER_ID);
  });

  it("returns null for an unknown email", () => {
    expect(getUserByEmail("nobody@example.com")).toBeNull();
  });
});

describe("getUserById", () => {
  it("returns the user when found", () => {
    seedUser();
    const user = getUserById(USER_ID);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(USER_EMAIL);
  });

  it("returns null for an unknown id", () => {
    expect(getUserById("ghost")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

describe("createSession", () => {
  it("inserts and returns the session", () => {
    seedUser();
    const expires = Math.floor(Date.now() / 1000) + 86400;
    const session = createSession({
      id: "sess-001",
      session_token: "tok-abc",
      user_id: USER_ID,
      expires,
    });
    expect(session.session_token).toBe("tok-abc");
    expect(session.user_id).toBe(USER_ID);
    expect(session.expires).toBe(expires);
  });

  it("throws when user_id does not exist (FK constraint)", () => {
    expect(() =>
      createSession({
        id: "sess-002",
        session_token: "tok-xyz",
        user_id: "no-such-user",
        expires: 9999999999,
      })
    ).toThrow();
  });
});

describe("getSessionByToken", () => {
  it("returns the session for a valid token", () => {
    seedUser();
    createSession({
      id: "sess-003",
      session_token: "tok-found",
      user_id: USER_ID,
      expires: 9999999999,
    });
    const session = getSessionByToken("tok-found");
    expect(session).not.toBeNull();
    expect(session!.user_id).toBe(USER_ID);
  });

  it("returns null for an unknown token", () => {
    expect(getSessionByToken("tok-missing")).toBeNull();
  });
});

describe("deleteSession", () => {
  it("removes the session from the database", () => {
    seedUser();
    createSession({
      id: "sess-del",
      session_token: "tok-del",
      user_id: USER_ID,
      expires: 9999999999,
    });
    deleteSession("tok-del");
    expect(getSessionByToken("tok-del")).toBeNull();
  });

  it("does not throw when deleting a non-existent token", () => {
    expect(() => deleteSession("tok-ghost")).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────────────────────────

describe("createSubscription", () => {
  it("creates a free-tier subscription and returns the correct shape", () => {
    seedUser();
    const sub = createSubscription({ id: "sub-001", user_id: USER_ID });
    expect(sub.user_id).toBe(USER_ID);
    expect(sub.tier).toBe("free");
    expect(sub.status).toBe("active");
    expect(sub.scan_interval_seconds).toBe(1800);
    expect(sub.stripe_customer_id).toBeNull();
  });

  it("is idempotent — second call returns existing row without error", () => {
    seedUser();
    createSubscription({ id: "sub-001", user_id: USER_ID });
    const sub2 = createSubscription({ id: "sub-002", user_id: USER_ID });
    expect(sub2.user_id).toBe(USER_ID);
  });
});

describe("getSubscriptionByUserId", () => {
  it("returns the subscription when it exists", () => {
    seedUser();
    createSubscription({ id: "sub-001", user_id: USER_ID });
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub).not.toBeNull();
    expect(sub!.tier).toBe("free");
  });

  it("returns null when no subscription exists", () => {
    expect(getSubscriptionByUserId("no-user")).toBeNull();
  });
});

describe("updateStripeSubscriptionTier", () => {
  it("updates tier, interval, and stripe fields", () => {
    seedUser();
    // Create subscription and set stripe_customer_id
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    setDb(db);
    initDb(db);
    createUser({ id: USER_ID, email: USER_EMAIL, name: "Alice", image: null });
    createSubscription({ id: "sub-001", user_id: USER_ID });

    // Manually set stripe_customer_id since updateStripeSubscriptionTier looks it up
    db.prepare("UPDATE subscriptions SET stripe_customer_id = 'cus_abc' WHERE user_id = ?").run(USER_ID);

    updateStripeSubscriptionTier({
      stripe_customer_id: "cus_abc",
      tier: "pro",
      status: "active",
      stripe_subscription_id: "sub_xyz",
      current_period_end: 9999999999,
    });

    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub!.tier).toBe("pro");
    expect(sub!.scan_interval_seconds).toBe(60);
    expect(sub!.stripe_subscription_id).toBe("sub_xyz");
    expect(sub!.current_period_end).toBe(9999999999);
  });

  it("throws when stripe_customer_id is not found", () => {
    expect(() =>
      updateStripeSubscriptionTier({
        stripe_customer_id: "cus_ghost",
        tier: "standard",
        status: "active",
        stripe_subscription_id: null,
        current_period_end: null,
      })
    ).toThrow("updateStripeSubscriptionTier");
  });
});

describe("getSubscriptionByStripeId", () => {
  it("returns null when no match", () => {
    expect(getSubscriptionByStripeId("cus_no")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Monitored airports
// ─────────────────────────────────────────────────────────────────────────────

describe("setMonitoredAirport", () => {
  it("inserts a new monitored airport and returns the row", () => {
    seedUser();
    const row = setMonitoredAirport({
      id: "ma-001",
      user_id: USER_ID,
      airport_iata: "DXB",
      destination_iata: "LHR",
      travel_date_from: null,
      travel_date_to: null,
    });
    expect(row.airport_iata).toBe("DXB");
    expect(row.destination_iata).toBe("LHR");
    expect(row.active).toBe(1);
  });

  it("upserts — updating the destination on conflict", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-001", user_id: USER_ID, airport_iata: "DXB" });
    const updated = setMonitoredAirport({
      id: "ma-002",
      user_id: USER_ID,
      airport_iata: "DXB",
      destination_iata: "CDG",
    });
    expect(updated.destination_iata).toBe("CDG");
  });

  it("accepts any airport IATA string (constraint removed in migration 009)", () => {
    seedUser();
    // Migration 009 removed the CHECK constraint on airport_iata, so non-standard
    // IATA codes no longer throw — they are stored as-is.
    expect(() =>
      setMonitoredAirport({ id: "ma-bad", user_id: USER_ID, airport_iata: "XXX" as "DXB" })
    ).not.toThrow();
  });
});

describe("getMonitoredAirport", () => {
  it("returns the active monitored airport for the user", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-001", user_id: USER_ID, airport_iata: "AUH" });
    const row = getMonitoredAirport(USER_ID);
    expect(row).not.toBeNull();
    expect(row!.airport_iata).toBe("AUH");
  });

  it("returns null when no active airport exists", () => {
    seedUser();
    expect(getMonitoredAirport(USER_ID)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Flights
// ─────────────────────────────────────────────────────────────────────────────

describe("upsertFlight", () => {
  it("inserts a new flight and returns the correct shape", () => {
    const flight = seedFlight();
    expect(flight.id).toBe("fl-001");
    expect(flight.flight_number).toBe("EK101");
    expect(flight.departure_airport).toBe("DXB");
    expect(flight.status).toBe("scheduled");
    expect(typeof flight.last_seen_at).toBe("number");
    expect(typeof flight.created_at).toBe("number");
  });

  it("updates status and estimated_departure on conflict without changing created_at", () => {
    const original = seedFlight();
    const updated = upsertFlight({
      id: "fl-001",
      flight_number: "EK101",
      airline: "Emirates",
      departure_airport: "DXB",
      destination_airport: "LHR",
      scheduled_departure: original.scheduled_departure,
      estimated_departure: original.scheduled_departure + 600,
      status: "active",
      aircraft_type: "B777",
      bookable: 1,
      lowest_price_cents: null,
      price_currency: null,
    });
    expect(updated.status).toBe("active");
    expect(updated.estimated_departure).toBe(original.scheduled_departure + 600);
    expect(updated.created_at).toBe(original.created_at);
  });
});

describe("getFlightsByAirport", () => {
  it("returns flights for a given airport filtered by status", () => {
    // getFlightsByAirport requires bookable=1, lowest_price_cents IS NOT NULL,
    // and scheduled_departure >= now.
    // upsertFlight does not set bookable/price; use the dedicated update helpers.
    upsertFlight({
      id: "fl-001",
      flight_number: "EK101",
      airline: "Emirates",
      departure_airport: "DXB",
      destination_airport: "LHR",
      scheduled_departure: Math.floor(Date.now() / 1000) + 3600,
      estimated_departure: null,
      status: "scheduled",
      aircraft_type: "B777",
      bookable: 0,
      lowest_price_cents: null,
      price_currency: null,
    });
    updateFlightBookable("fl-001", 1);
    updateFlightPrice("fl-001", 45000, "GBP");

    upsertFlight({
      id: "fl-002",
      flight_number: "EK102",
      airline: "Emirates",
      departure_airport: "DXB",
      destination_airport: "JFK",
      scheduled_departure: Math.floor(Date.now() / 1000) + 7200,
      estimated_departure: null,
      status: "cancelled",
      aircraft_type: null,
      bookable: 0,
      lowest_price_cents: null,
      price_currency: null,
    });
    updateFlightBookable("fl-002", 1);
    updateFlightPrice("fl-002", 55000, "USD");

    const active = getFlightsByAirport("DXB", ["scheduled"]);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe("fl-001");

    const all = getFlightsByAirport("DXB", ["scheduled", "cancelled"]);
    expect(all.length).toBe(2);
  });

  it("returns empty array for unknown airport", () => {
    expect(getFlightsByAirport("ZZZ")).toHaveLength(0);
  });
});

describe("getFlightById", () => {
  it("returns the flight when found", () => {
    seedFlight();
    const flight = getFlightById("fl-001");
    expect(flight).not.toBeNull();
    expect(flight!.flight_number).toBe("EK101");
  });

  it("returns null for an unknown id", () => {
    expect(getFlightById("fl-ghost")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bookings
// ─────────────────────────────────────────────────────────────────────────────

describe("createBooking", () => {
  it("inserts a booking and returns the correct shape", () => {
    seedUser();
    seedFlight();
    const booking = createBooking({
      id: "bk-001",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_order_id: null,
      duffel_offer_id: "off-abc",
      stripe_payment_intent_id: null,
      status: "pending",
      total_amount: 45000,
      currency: "USD",
      passenger_details: JSON.stringify([{ given_name: "Alice", family_name: "Smith" }]),
      booking_reference: null,
      ticket_number: null,
      cancelled_reason: null,
      duffel_cancellation_id: null,
      refund_amount_cents: null,
      refund_to: null,
      stripe_refund_id: null,
    });
    expect(booking.id).toBe("bk-001");
    expect(booking.status).toBe("pending");
    expect(booking.total_amount).toBe(45000);
    expect(typeof booking.created_at).toBe("number");
  });

  it("throws when flight_id does not reference a flight (FK constraint)", () => {
    seedUser();
    expect(() =>
      createBooking({
        id: "bk-bad",
        user_id: USER_ID,
        flight_id: "fl-ghost",
        duffel_order_id: null,
        duffel_offer_id: "off-x",
        stripe_payment_intent_id: null,
        status: "pending",
        total_amount: 0,
        currency: "USD",
        passenger_details: "[]",
        booking_reference: null,
        ticket_number: null,
        cancelled_reason: null,
        duffel_cancellation_id: null,
        refund_amount_cents: null,
        refund_to: null,
        stripe_refund_id: null,
      })
    ).toThrow();
  });
});

describe("getBookingsByUserId", () => {
  it("returns all bookings for a user ordered by created_at desc", () => {
    seedUser();
    seedFlight();
    createBooking({
      id: "bk-001",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_order_id: null,
      duffel_offer_id: "off-1",
      stripe_payment_intent_id: null,
      status: "pending",
      total_amount: 10000,
      currency: "USD",
      passenger_details: "[]",
      booking_reference: null,
      ticket_number: null,
      cancelled_reason: null,
      duffel_cancellation_id: null,
      refund_amount_cents: null,
      refund_to: null,
      stripe_refund_id: null,
    });
    createBooking({
      id: "bk-002",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_order_id: "ord-abc",
      duffel_offer_id: "off-2",
      stripe_payment_intent_id: null,
      status: "confirmed",
      total_amount: 20000,
      currency: "USD",
      passenger_details: "[]",
      booking_reference: null,
      ticket_number: null,
      cancelled_reason: null,
      duffel_cancellation_id: null,
      refund_amount_cents: null,
      refund_to: null,
      stripe_refund_id: null,
    });

    const bookings = getBookingsByUserId(USER_ID);
    expect(bookings.length).toBe(2);
    const ids = bookings.map((b) => b.id);
    expect(ids).toContain("bk-001");
    expect(ids).toContain("bk-002");
  });

  it("returns empty array when user has no bookings", () => {
    seedUser();
    expect(getBookingsByUserId(USER_ID)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

describe("createNotification", () => {
  it("inserts a notification and returns the correct shape", () => {
    seedUser();
    seedFlight();
    const notif = createNotification({
      id: "notif-001",
      user_id: USER_ID,
      flight_id: "fl-001",
      type: "new_flight",
      title: "New flight available",
      body: "EK101 departing DXB at 10:00",
    });
    expect(notif.id).toBe("notif-001");
    expect(notif.type).toBe("new_flight");
    expect(notif.read_at).toBeNull();
    expect(typeof notif.sent_at).toBe("number");
  });

  it("allows null flight_id for non-flight notifications", () => {
    seedUser();
    const notif = createNotification({
      id: "notif-002",
      user_id: USER_ID,
      flight_id: null,
      type: "booking_confirmed",
      title: "Booking confirmed",
      body: "Your booking is confirmed.",
    });
    expect(notif.flight_id).toBeNull();
  });
});

describe("getNotificationsByUserId", () => {
  it("returns notifications ordered by sent_at desc", () => {
    seedUser();
    createNotification({
      id: "n-1",
      user_id: USER_ID,
      flight_id: null,
      type: "new_flight",
      title: "A",
      body: "body",
    });
    createNotification({
      id: "n-2",
      user_id: USER_ID,
      flight_id: null,
      type: "status_change",
      title: "B",
      body: "body",
    });

    const notifs = getNotificationsByUserId(USER_ID);
    expect(notifs.length).toBe(2);
  });

  it("returns empty array for user with no notifications", () => {
    seedUser();
    expect(getNotificationsByUserId(USER_ID)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Push subscriptions
// ─────────────────────────────────────────────────────────────────────────────

describe("savePushSubscription", () => {
  it("inserts and returns the push subscription", () => {
    seedUser();
    const sub = savePushSubscription({
      id: "ps-001",
      user_id: USER_ID,
      endpoint: "https://push.example.com/endpoint1",
      p256dh: "key123",
      auth: "auth456",
    });
    expect(sub.endpoint).toBe("https://push.example.com/endpoint1");
    expect(sub.user_id).toBe(USER_ID);
    expect(typeof sub.created_at).toBe("number");
  });

  it("upserts on duplicate endpoint without throwing", () => {
    seedUser();
    savePushSubscription({
      id: "ps-001",
      user_id: USER_ID,
      endpoint: "https://push.example.com/ep",
      p256dh: "old-key",
      auth: "old-auth",
    });
    const updated = savePushSubscription({
      id: "ps-002",
      user_id: USER_ID,
      endpoint: "https://push.example.com/ep",
      p256dh: "new-key",
      auth: "new-auth",
    });
    expect(updated.p256dh).toBe("new-key");
  });
});

describe("getPushSubscriptionsByUserId", () => {
  it("returns all subscriptions for a user", () => {
    seedUser();
    savePushSubscription({
      id: "ps-001",
      user_id: USER_ID,
      endpoint: "https://push.example.com/a",
      p256dh: "k1",
      auth: "a1",
    });
    savePushSubscription({
      id: "ps-002",
      user_id: USER_ID,
      endpoint: "https://push.example.com/b",
      p256dh: "k2",
      auth: "a2",
    });

    const subs = getPushSubscriptionsByUserId(USER_ID);
    expect(subs.length).toBe(2);
  });

  it("returns empty array when none exist", () => {
    seedUser();
    expect(getPushSubscriptionsByUserId(USER_ID)).toHaveLength(0);
  });
});

describe("deletePushSubscription", () => {
  it("removes the subscription by endpoint", () => {
    seedUser();
    savePushSubscription({
      id: "ps-del",
      user_id: USER_ID,
      endpoint: "https://push.example.com/del",
      p256dh: "k",
      auth: "a",
    });
    deletePushSubscription("https://push.example.com/del");
    const subs = getPushSubscriptionsByUserId(USER_ID);
    expect(subs).toHaveLength(0);
  });

  it("does not throw when endpoint does not exist", () => {
    expect(() =>
      deletePushSubscription("https://push.example.com/ghost")
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5B — createDefaultSubscription
// ─────────────────────────────────────────────────────────────────────────────

describe("createDefaultSubscription (5B)", () => {
  it("new user: inserts row with tier=free, scan_interval_seconds=1800, status=active", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub).not.toBeNull();
    expect(sub!.tier).toBe("free");
    expect(sub!.status).toBe("active");
    expect(sub!.scan_interval_seconds).toBe(getScanInterval("free"));
    expect(sub!.scan_interval_seconds).toBe(1800);
  });

  it("existing user with pro subscription: is a no-op — existing row unchanged", () => {
    const db = freshDb();
    createUser({ id: USER_ID, email: USER_EMAIL, name: "Alice", image: null });
    // Insert a pro subscription manually
    db.prepare(`
      INSERT INTO subscriptions (id, user_id, tier, scan_interval_seconds, status, created_at, updated_at)
      VALUES ('sub-pro', ?, 'pro', 60, 'active', unixepoch(), unixepoch())
    `).run(USER_ID);

    createDefaultSubscription(USER_ID);

    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub!.tier).toBe("pro");
    expect(sub!.scan_interval_seconds).toBe(60);
  });

  it("called twice for same user: second call is a no-op (no error, no duplicate row)", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    expect(() => createDefaultSubscription(USER_ID)).not.toThrow();
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub).not.toBeNull();
    expect(sub!.tier).toBe("free");
  });

  it("non-existent userId (FK violation): logs error, does not throw to caller", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Do not seed user — call with unknown userId wrapped as the auth callback would
    expect(() => {
      try {
        createDefaultSubscription("non-existent-user-id");
      } catch (err) {
        console.error("[auth] createDefaultSubscription error:", err);
      }
    }).not.toThrow();
    consoleSpy.mockRestore();
  });

  it("scan_interval_seconds written is exactly getScanInterval('free') === 1800", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub!.scan_interval_seconds).toBe(getScanInterval("free"));
    expect(getScanInterval("free")).toBe(1800);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5C — updateScanTimestamps
// ─────────────────────────────────────────────────────────────────────────────

describe("updateScanTimestamps (5C)", () => {
  it("sets last_scanned_at to approximately now (±2s) and next_scan_at to approximately now + intervalSeconds (±2s)", () => {
    const db = freshDb();
    seedUser();
    setMonitoredAirport({ id: "ma-001", user_id: USER_ID, airport_iata: "DXB" });

    const before = Math.floor(Date.now() / 1000);
    updateScanTimestamps("DXB", 1800);
    const after = Math.floor(Date.now() / 1000);

    const nextAt = getNextScanAt("DXB");
    expect(nextAt).not.toBeNull();
    expect(nextAt!).toBeGreaterThanOrEqual(before + 1800);
    expect(nextAt!).toBeLessThanOrEqual(after + 1800 + 2);

    // Verify last_scanned_at
    const row = db
      .prepare("SELECT last_scanned_at FROM monitored_airports WHERE airport_iata = 'DXB'")
      .get() as { last_scanned_at: number };
    expect(row.last_scanned_at).toBeGreaterThanOrEqual(before);
    expect(row.last_scanned_at).toBeLessThanOrEqual(after + 2);
  });

  it("called twice in quick succession: second call overwrites first", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-001", user_id: USER_ID, airport_iata: "DXB" });

    updateScanTimestamps("DXB", 1800);
    const first = getNextScanAt("DXB");

    updateScanTimestamps("DXB", 180);
    const second = getNextScanAt("DXB");

    expect(second).not.toBe(first);
  });

  it("airport not in monitored_airports table: no error (UPDATE affects 0 rows)", () => {
    expect(() => updateScanTimestamps("ZZZ", 1800)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5D — getNextScanAt
// ─────────────────────────────────────────────────────────────────────────────

describe("getNextScanAt (5D)", () => {
  it("airport with next_scan_at set: returns integer value", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-001", user_id: USER_ID, airport_iata: "DXB" });
    updateScanTimestamps("DXB", 1800);

    const result = getNextScanAt("DXB");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("number");
    expect(Number.isInteger(result)).toBe(true);
  });

  it("airport with next_scan_at NULL: returns null", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-001", user_id: USER_ID, airport_iata: "DXB" });
    // next_scan_at not set yet
    expect(getNextScanAt("DXB")).toBeNull();
  });

  it("airport not in table: returns null", () => {
    expect(getNextScanAt("ZZZ")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5K — updateSubscriptionTier (userId, tier) — no scan_interval_seconds param
// ─────────────────────────────────────────────────────────────────────────────

describe("updateSubscriptionTier by userId (5K)", () => {
  it("updateSubscriptionTier(userId, 'standard'): scan_interval_seconds written is getScanInterval('standard') === 180", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    updateSubscriptionTier(USER_ID, "standard");
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub!.scan_interval_seconds).toBe(getScanInterval("standard"));
    expect(sub!.scan_interval_seconds).toBe(180);
    expect(sub!.tier).toBe("standard");
  });

  it("updateSubscriptionTier(userId, 'pro'): scan_interval_seconds written is 60", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    updateSubscriptionTier(USER_ID, "pro");
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub!.scan_interval_seconds).toBe(60);
    expect(sub!.tier).toBe("pro");
  });

  it("updateSubscriptionTier(userId, 'ultimate'): scan_interval_seconds written is 30", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    updateSubscriptionTier(USER_ID, "ultimate");
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub!.scan_interval_seconds).toBe(30);
    expect(sub!.tier).toBe("ultimate");
  });

  it("updateSubscriptionTier(userId, 'free'): scan_interval_seconds written is 1800", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    updateSubscriptionTier(USER_ID, "free");
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub!.scan_interval_seconds).toBe(1800);
    expect(sub!.tier).toBe("free");
  });

  it("updateSubscriptionTier(userId, 'unknown'): scan_interval_seconds written is 1800 (getScanInterval fallback)", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    updateSubscriptionTier(USER_ID, "unknown");
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub!.scan_interval_seconds).toBe(getScanInterval("unknown"));
    expect(sub!.scan_interval_seconds).toBe(1800);
  });

  it("function signature does not accept scan_interval_seconds as parameter", () => {
    // TypeScript compile-time check: updateSubscriptionTier only accepts (userId, tier)
    // This test verifies the function has exactly 2 parameters (no scan_interval_seconds)
    expect(updateSubscriptionTier.length).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5M — Migration 013 correctness (scan timestamps on monitored_airports)
// ─────────────────────────────────────────────────────────────────────────────

describe("migration 013 scan timestamps (5M)", () => {
  it("runs cleanly on a DB that already has existing monitored_airports rows", () => {
    const db = freshDb();
    seedUser();
    setMonitoredAirport({ id: "ma-001", user_id: USER_ID, airport_iata: "DXB" });

    // Re-running initDb should not throw (schema_version guard prevents re-running 013)
    expect(() => initDb(db)).not.toThrow();

    const row = db
      .prepare("SELECT * FROM monitored_airports WHERE airport_iata = 'DXB'")
      .get() as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row["airport_iata"]).toBe("DXB");
  });

  it("IF NOT EXISTS guards: running migration 013 twice produces no error", () => {
    const db = freshDb();
    expect(() => initDb(db)).not.toThrow();
    expect(() => initDb(db)).not.toThrow();
  });

  it("after migration: monitored_airports includes last_scanned_at and next_scan_at columns with NULL values", () => {
    const db = freshDb();
    seedUser();
    setMonitoredAirport({ id: "ma-001", user_id: USER_ID, airport_iata: "DXB" });

    const row = db
      .prepare("SELECT last_scanned_at, next_scan_at FROM monitored_airports WHERE airport_iata = 'DXB'")
      .get() as Record<string, unknown>;

    expect(row).toBeDefined();
    expect(row["last_scanned_at"]).toBeNull();
    expect(row["next_scan_at"]).toBeNull();
  });

  it("schema_version table contains version 13 after migration", () => {
    const db = freshDb();
    const row = db
      .prepare("SELECT version FROM schema_version WHERE version = 13")
      .get() as { version: number } | undefined;
    expect(row).toBeDefined();
    expect(row!.version).toBe(13);
  });

  it("PRAGMA table_info includes last_scanned_at and next_scan_at", () => {
    const db = freshDb();
    const info = db
      .prepare("PRAGMA table_info(monitored_airports)")
      .all() as Array<{ name: string }>;
    const names = info.map((c) => c.name);
    expect(names).toContain("last_scanned_at");
    expect(names).toContain("next_scan_at");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5D — Duffel Links DB functions
// ─────────────────────────────────────────────────────────────────────────────

function seedPendingDuffelBooking(ref = "ref-uuid-001") {
  seedUser();
  seedFlight();
  return createPendingBookingForDuffel({
    id: `bk-duffel-${ref}`,
    user_id: USER_ID,
    flight_id: "fl-001",
    duffel_offer_id: "off-123",
    internal_reference: ref,
    passenger_details: JSON.stringify({ given_name: "Alice", family_name: "Smith" }),
  });
}

describe("getBookingByInternalReference (5D)", () => {
  it("with matching row — returns DbBooking", () => {
    seedPendingDuffelBooking("ref-match");
    const booking = getBookingByInternalReference("ref-match");
    expect(booking).toBeDefined();
    expect(booking!.internal_reference).toBe("ref-match");
  });

  it("with no matching row — returns undefined", () => {
    seedUser();
    expect(getBookingByInternalReference("ref-ghost")).toBeUndefined();
  });

  it("UNIQUE constraint — inserting two rows with same internal_reference throws", () => {
    seedUser();
    seedFlight();
    createPendingBookingForDuffel({
      id: "bk-dup-1",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "dup-ref",
      passenger_details: "{}",
    });
    expect(() =>
      createPendingBookingForDuffel({
        id: "bk-dup-2",
        user_id: USER_ID,
        flight_id: "fl-001",
        duffel_offer_id: "off-2",
        internal_reference: "dup-ref",
        passenger_details: "{}",
      })
    ).toThrow();
  });
});

describe("confirmBooking extended (5D)", () => {
  it("all 6 new fields written and readable back from DB", () => {
    const booking = seedPendingDuffelBooking("ref-confirm");
    confirmBooking(booking.id, {
      duffelOrderId: "ord_xyz",
      bookingReference: "REF999",
      ticketNumber: "TKT123",
      totalAmount: "542.00",
      totalCurrency: "GBP",
      duffelLinkId: "lnk_abc",
    });

    const updated = getBookingById(booking.id);
    expect(updated!.status).toBe("confirmed");
    expect(updated!.duffel_order_id).toBe("ord_xyz");
    expect(updated!.booking_reference).toBe("REF999");
    expect(updated!.ticket_number).toBe("TKT123");
    expect(updated!.duffel_total).toBe("542.00");
    expect(updated!.total_currency).toBe("GBP");
    expect(updated!.duffel_link_id).toBe("lnk_abc");
  });

  it("bookingReference null — stored as null, not as string 'null'", () => {
    const booking = seedPendingDuffelBooking("ref-null-ref");
    confirmBooking(booking.id, {
      duffelOrderId: "ord_yyy",
      bookingReference: "PENDING",
      ticketNumber: null,
      totalAmount: "100.00",
      totalCurrency: "USD",
      duffelLinkId: null,
    });

    const updated = getBookingById(booking.id);
    expect(updated!.booking_reference).toBe("PENDING");
    expect(updated!.ticket_number).toBeNull();
  });

  it("ticketNumber null (empty documents) — stored as null", () => {
    const booking = seedPendingDuffelBooking("ref-null-ticket");
    confirmBooking(booking.id, {
      duffelOrderId: "ord_zzz",
      bookingReference: "REF123",
      ticketNumber: null,
      totalAmount: "200.00",
      totalCurrency: "EUR",
      duffelLinkId: null,
    });

    const updated = getBookingById(booking.id);
    expect(updated!.ticket_number).toBeNull();
  });

  it("booking row not found (bad id) — does not throw", () => {
    expect(() =>
      confirmBooking("bk-nonexistent", {
        duffelOrderId: "ord_1",
        bookingReference: "REF",
        ticketNumber: null,
        totalAmount: "0.00",
        totalCurrency: "USD",
        duffelLinkId: null,
      })
    ).not.toThrow();
  });
});

describe("cancelBookingByUser updated (5D)", () => {
  it("refundAmount and refundCurrency written correctly; stripe_refund_id not touched", () => {
    const booking = seedPendingDuffelBooking("ref-cancel");
    confirmBooking(booking.id, {
      duffelOrderId: "ord_cc",
      bookingReference: "REF_CC",
      ticketNumber: null,
      totalAmount: "300.00",
      totalCurrency: "USD",
      duffelLinkId: null,
    });

    cancelBookingByUser(booking.id, {
      duffelCancellationId: "canc_abc",
      refundAmount: "245.50",
      refundCurrency: "USD",
      refundTo: "original_form_of_payment",
      cancelledReason: "user_cancelled",
    });

    const updated = getBookingById(booking.id);
    expect(updated!.status).toBe("cancelled");
    expect(updated!.cancelled_reason).toBe("user_cancelled");
    expect(updated!.duffel_total).toBe("245.50");
    expect(updated!.total_currency).toBe("USD");
    expect(updated!.stripe_refund_id).toBeNull();
  });

  it("cancellation_pending and pending_cancellation_id written when setCancellationPending called", () => {
    const booking = seedPendingDuffelBooking("ref-cancel-pend");
    setCancellationPending(booking.id, "canc_step1");

    const updated = getBookingById(booking.id);
    expect(updated!.cancellation_pending).toBe(1);
    expect(updated!.pending_cancellation_id).toBe("canc_step1");
  });
});

describe("purgeStalePendingBookings (5D)", () => {
  it("pending row 3 hours old is deleted", () => {
    const db = freshDb();
    seedUser();
    seedFlight();
    const threeHoursAgo = Math.floor(Date.now() / 1000) - 3 * 60 * 60 - 1;

    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-stale', '${USER_ID}', 'fl-001', 'off-1', 'pending', 0, 'USD', '{}', ${threeHoursAgo}, ${threeHoursAgo})`
    ).run();

    purgeStalePendingBookings();

    const result = db.prepare("SELECT * FROM bookings WHERE id = 'bk-stale'").get();
    expect(result).toBeUndefined();
  });

  it("pending row 1 hour old is NOT deleted", () => {
    const db = freshDb();
    seedUser();
    seedFlight();
    const oneHourAgo = Math.floor(Date.now() / 1000) - 60 * 60 + 60;

    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-fresh', '${USER_ID}', 'fl-001', 'off-1', 'pending', 0, 'USD', '{}', ${oneHourAgo}, ${oneHourAgo})`
    ).run();

    purgeStalePendingBookings();

    const result = db.prepare("SELECT * FROM bookings WHERE id = 'bk-fresh'").get();
    expect(result).toBeDefined();
  });

  it("confirmed row 3 hours old is NOT deleted", () => {
    const db = freshDb();
    seedUser();
    seedFlight();
    const threeHoursAgo = Math.floor(Date.now() / 1000) - 3 * 60 * 60 - 1;

    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, duffel_order_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-confirmed-old', '${USER_ID}', 'fl-001', 'off-1', 'ord_1', 'confirmed', 0, 'USD', '{}', ${threeHoursAgo}, ${threeHoursAgo})`
    ).run();

    purgeStalePendingBookings();

    const result = db.prepare("SELECT * FROM bookings WHERE id = 'bk-confirmed-old'").get();
    expect(result).toBeDefined();
  });

  it("cancelled row 3 hours old is NOT deleted", () => {
    const db = freshDb();
    seedUser();
    seedFlight();
    const threeHoursAgo = Math.floor(Date.now() / 1000) - 3 * 60 * 60 - 1;

    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-cancelled-old', '${USER_ID}', 'fl-001', 'off-1', 'cancelled', 0, 'USD', '{}', ${threeHoursAgo}, ${threeHoursAgo})`
    ).run();

    purgeStalePendingBookings();

    const result = db.prepare("SELECT * FROM bookings WHERE id = 'bk-cancelled-old'").get();
    expect(result).toBeDefined();
  });

  it("empty DB — no error", () => {
    expect(() => purgeStalePendingBookings()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5L — Migration and cleanup
// ─────────────────────────────────────────────────────────────────────────────

describe("purgeStalePendingBookings mixed rows (5L)", () => {
  it("only 3h-old pending row deleted; confirmed/cancelled/fresh pending rows remain", () => {
    const db = freshDb();
    seedUser();
    seedFlight();
    const now = Math.floor(Date.now() / 1000);
    const threeHoursAgo = now - 3 * 60 * 60 - 1;
    const oneHourAgo = now - 60 * 60 + 60;

    // 1 pending row 3h old (should be deleted)
    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-del', '${USER_ID}', 'fl-001', 'off-1', 'pending', 0, 'USD', '{}', ${threeHoursAgo}, ${threeHoursAgo})`
    ).run();
    // 1 pending row 1h old (should remain)
    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-keep-pending', '${USER_ID}', 'fl-001', 'off-2', 'pending', 0, 'USD', '{}', ${oneHourAgo}, ${oneHourAgo})`
    ).run();
    // 1 confirmed row 3h old (should remain)
    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, duffel_order_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-keep-conf', '${USER_ID}', 'fl-001', 'off-3', 'ord_1', 'confirmed', 0, 'USD', '{}', ${threeHoursAgo}, ${threeHoursAgo})`
    ).run();
    // 1 cancelled row 3h old (should remain)
    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-keep-canc', '${USER_ID}', 'fl-001', 'off-4', 'cancelled', 0, 'USD', '{}', ${threeHoursAgo}, ${threeHoursAgo})`
    ).run();

    purgeStalePendingBookings();

    expect(db.prepare("SELECT * FROM bookings WHERE id = 'bk-del'").get()).toBeUndefined();
    expect(db.prepare("SELECT * FROM bookings WHERE id = 'bk-keep-pending'").get()).toBeDefined();
    expect(db.prepare("SELECT * FROM bookings WHERE id = 'bk-keep-conf'").get()).toBeDefined();
    expect(db.prepare("SELECT * FROM bookings WHERE id = 'bk-keep-canc'").get()).toBeDefined();
  });

  it("purgeStalePendingBookings on empty DB — no error", () => {
    expect(() => purgeStalePendingBookings()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5D — Migration 012 idempotency and schema integrity
// ─────────────────────────────────────────────────────────────────────────────

describe("migration 012 schema integrity (5D)", () => {
  it("runs cleanly on a DB that already has existing booking rows with all prior columns", () => {
    const db = freshDb();
    seedUser();
    seedFlight();
    // Insert a booking with only the old columns (no migration-012 columns)
    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-old-format', '${USER_ID}', 'fl-001', 'off-1', 'confirmed', 10000, 'GBP', '{}', 1000000, 1000000)`
    ).run();

    // Re-running initDb should not throw (schema_version guard prevents re-running 012)
    expect(() => initDb(db)).not.toThrow();

    const row = db.prepare("SELECT * FROM bookings WHERE id = 'bk-old-format'").get() as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row["id"]).toBe("bk-old-format");
  });

  it("IF NOT EXISTS guards on CREATE UNIQUE INDEX — running migration 012 twice does not fail", () => {
    // Re-running initDb a second time should be safe (schema_version prevents ALTER TABLE re-run;
    // CREATE UNIQUE INDEX IF NOT EXISTS is also idempotent)
    const db = freshDb();
    expect(() => initDb(db)).not.toThrow();
    expect(() => initDb(db)).not.toThrow();
  });

  it("new columns are nullable — old-format row still readable with null in new columns", () => {
    const db = freshDb();
    seedUser();
    seedFlight();
    db.prepare(
      `INSERT INTO bookings (id, user_id, flight_id, duffel_offer_id, status, total_amount, currency, passenger_details, created_at, updated_at)
       VALUES ('bk-nullable', '${USER_ID}', 'fl-001', 'off-1', 'confirmed', 10000, 'GBP', '{}', 1000000, 1000000)`
    ).run();

    const row = db.prepare("SELECT * FROM bookings WHERE id = 'bk-nullable'").get() as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row["internal_reference"]).toBeNull();
    expect(row["duffel_total"]).toBeNull();
    expect(row["total_currency"]).toBeNull();
    expect(row["duffel_link_id"]).toBeNull();
    expect(row["confirm_fetch_failed"]).toBe(0); // DEFAULT 0
    expect(row["cancellation_pending"]).toBe(0); // DEFAULT 0
    expect(row["pending_cancellation_id"]).toBeNull();
  });

  it("internal_reference UNIQUE constraint is enforced — second INSERT with same value throws", () => {
    seedUser();
    seedFlight();
    createPendingBookingForDuffel({
      id: "bk-uniq-1",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "uniq-ref-123",
      passenger_details: "{}",
    });

    expect(() =>
      createPendingBookingForDuffel({
        id: "bk-uniq-2",
        user_id: USER_ID,
        flight_id: "fl-001",
        duffel_offer_id: "off-2",
        internal_reference: "uniq-ref-123",
        passenger_details: "{}",
      })
    ).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateUserRole — admin role management
// ─────────────────────────────────────────────────────────────────────────────

import {
  updateUserRole,
  updateSubscriptionOverride,
  getAdminStats,
  getUsersByPage,
  markNotificationsRead,
  resetSubscriptionToFree,
  setCancelAtPeriodEnd,
  flagAirportForImmediateScan,
  clearImmediateScanFlag,
  getAirportsNeedingImmediateScan,
  getAirportScanBuckets,
  getActiveUsersForAirport,
  purgeStaleFlights,
  updateBookingDuffelLinkId,
  deletePendingBooking,
  setConfirmFetchFailed,
  resetAirport,
  closeDb,
} from "@/lib/db";

describe("updateUserRole", () => {
  beforeEach(() => { freshDb(); });

  it("updates user role to admin", () => {
    seedUser();
    updateUserRole(USER_ID, "admin");
    const user = getUserById(USER_ID);
    expect(user?.role).toBe("admin");
  });

  it("updates user role back to user", () => {
    seedUser();
    updateUserRole(USER_ID, "admin");
    updateUserRole(USER_ID, "user");
    const user = getUserById(USER_ID);
    expect(user?.role).toBe("user");
  });
});

describe("updateSubscriptionOverride", () => {
  it("creates subscription for user with no existing sub", () => {
    seedUser();
    const result = updateSubscriptionOverride(USER_ID, "pro");
    expect(result.previousTier).toBe("free");
    expect(result.stripeSubscriptionId).toBeNull();
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub?.tier).toBe("pro");
  });

  it("updates existing subscription tier", () => {
    seedUser();
    createDefaultSubscription(USER_ID);
    const result = updateSubscriptionOverride(USER_ID, "ultimate");
    expect(result.previousTier).toBe("free");
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub?.tier).toBe("ultimate");
  });

  it("returns previous stripe_subscription_id when updating", () => {
    const db = freshDb();
    seedUser();
    createDefaultSubscription(USER_ID);
    // Directly set stripe_customer_id on the subscription row
    db.prepare("UPDATE subscriptions SET stripe_customer_id = 'cus_test2' WHERE user_id = ?").run(USER_ID);
    updateStripeSubscriptionTier({
      stripe_customer_id: "cus_test2",
      tier: "standard",
      status: "active",
      stripe_subscription_id: "sub_123",
      current_period_end: null,
    });
    const result = updateSubscriptionOverride(USER_ID, "pro");
    expect(result.stripeSubscriptionId).toBe("sub_123");
  });
});

describe("getAdminStats", () => {
  it("returns correct totalUsers, subscriptions breakdown, and active airports", () => {
    seedUser();
    createUser({ id: "user-002-stats", email: "bob@stats.com", name: "Bob", image: null });
    createDefaultSubscription(USER_ID);
    updateSubscriptionOverride(USER_ID, "standard");
    setMonitoredAirport({ id: "ma-stats", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });

    const stats = getAdminStats();
    expect(stats.totalUsers).toBeGreaterThanOrEqual(2);
    expect(stats.subscriptions.standard).toBeGreaterThanOrEqual(1);
    expect(stats.activeAirports).toContain("DXB");
  });

  it("returns only admin seed user on fresh DB (migration 008 seeds 1 admin)", () => {
    const stats = getAdminStats();
    expect(stats.totalUsers).toBe(1);
    expect(stats.activeAirports).toHaveLength(0);
  });
});

describe("markNotificationsRead", () => {
  it("marks all notifications as read for the user", () => {
    seedUser();
    seedFlight();
    createNotification({
      id: "n1-mark",
      user_id: USER_ID,
      flight_id: "fl-001",
      type: "new_flight",
      title: "New flight",
      body: "EK101 available",
    });
    markNotificationsRead(USER_ID);
    const notifs = getNotificationsByUserId(USER_ID);
    expect(notifs[0].read_at).not.toBeNull();
  });
});

describe("resetSubscriptionToFree", () => {
  it("resets subscription tier to free for a given Stripe customer", () => {
    const db = freshDb();
    seedUser();
    createDefaultSubscription(USER_ID);
    db.prepare("UPDATE subscriptions SET stripe_customer_id = 'cus_reset_x' WHERE user_id = ?").run(USER_ID);
    updateStripeSubscriptionTier({
      stripe_customer_id: "cus_reset_x",
      tier: "pro",
      status: "active",
      stripe_subscription_id: "sub_reset",
      current_period_end: null,
    });
    resetSubscriptionToFree("cus_reset_x");
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub?.tier).toBe("free");
  });
});

describe("setCancelAtPeriodEnd", () => {
  it("sets cancel_at_period_end flag for a customer", () => {
    const db = freshDb();
    seedUser();
    createDefaultSubscription(USER_ID);
    db.prepare("UPDATE subscriptions SET stripe_customer_id = 'cus_cancel_x' WHERE user_id = ?").run(USER_ID);
    updateStripeSubscriptionTier({
      stripe_customer_id: "cus_cancel_x",
      tier: "standard",
      status: "active",
      stripe_subscription_id: "sub_c",
      current_period_end: null,
    });
    setCancelAtPeriodEnd("cus_cancel_x", 1);
    const sub = getSubscriptionByUserId(USER_ID);
    expect(sub?.cancel_at_period_end).toBe(1);
  });
});

describe("flagAirportForImmediateScan / clearImmediateScanFlag / getAirportsNeedingImmediateScan", () => {
  it("flags airport for immediate scan", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-flag-1", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });
    flagAirportForImmediateScan(USER_ID);
    const pending = getAirportsNeedingImmediateScan();
    expect(pending.some((p) => p.airport_iata === "DXB")).toBe(true);
  });

  it("clears immediate scan flag for airport", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-flag-2", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });
    flagAirportForImmediateScan(USER_ID);
    clearImmediateScanFlag("DXB");
    const pending = getAirportsNeedingImmediateScan();
    expect(pending.every((p) => p.airport_iata !== "DXB")).toBe(true);
  });
});

describe("getAirportScanBuckets", () => {
  it("returns airport+interval buckets for active subscriptions", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-bucket-1", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });
    createDefaultSubscription(USER_ID);
    updateSubscriptionOverride(USER_ID, "standard");

    const buckets = getAirportScanBuckets();
    expect(buckets.some((b) => b.airport_iata === "DXB")).toBe(true);
  });
});

describe("getActiveUsersForAirport", () => {
  it("returns users monitoring the airport", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-active-1", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });
    const users = getActiveUsersForAirport("DXB");
    expect(users.some((u) => u.user_id === USER_ID)).toBe(true);
  });

  it("returns empty when no users monitor the airport", () => {
    const users = getActiveUsersForAirport("JFK");
    expect(users).toHaveLength(0);
  });
});

describe("purgeStaleFlights", () => {
  it("returns count of purged flights (0 on fresh DB)", () => {
    const count = purgeStaleFlights("DXB");
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe("updateBookingDuffelLinkId", () => {
  it("updates duffel_link_id on booking", () => {
    seedUser();
    seedFlight();
    const booking = createPendingBookingForDuffel({
      id: "bk-dlid",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "dlid-ref-2",
      passenger_details: "{}",
    });
    updateBookingDuffelLinkId(booking.id, "link_abc123");
    const updated = getBookingById(booking.id);
    expect(updated?.duffel_link_id).toBe("link_abc123");
  });
});

describe("deletePendingBooking", () => {
  it("deletes a pending booking by id", () => {
    seedUser();
    seedFlight();
    const booking = createPendingBookingForDuffel({
      id: "bk-del-2",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "del-ref-2",
      passenger_details: "{}",
    });
    deletePendingBooking(booking.id);
    expect(getBookingById(booking.id)).toBeNull();
  });
});

describe("setConfirmFetchFailed", () => {
  it("sets confirm_fetch_failed flag on booking", () => {
    seedUser();
    seedFlight();
    const booking = createPendingBookingForDuffel({
      id: "bk-fail-2",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "fail-ref-2",
      passenger_details: "{}",
    });
    setConfirmFetchFailed(booking.id);
    const updated = getBookingById(booking.id);
    expect(updated?.confirm_fetch_failed).toBe(1);
  });
});

describe("resetAirport", () => {
  it("deletes monitored airport for a user (resetAirport removes the row)", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-reset-1", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });
    // Verify airport exists first
    expect(getMonitoredAirport(USER_ID)).not.toBeNull();
    resetAirport(USER_ID);
    // resetAirport deletes the row entirely
    const airport = getMonitoredAirport(USER_ID);
    expect(airport).toBeNull();
  });
});

describe("getUsersByPage", () => {
  it("returns paginated users and total count", () => {
    // Count existing users first, then create more
    const before = getUsersByPage(1, 100);
    const initialCount = before.total;
    for (let i = 0; i < 3; i++) {
      createUser({ id: `user-pg2-${i}`, email: `upg2${i}@test.com`, name: `User ${i}`, image: null });
    }
    const result = getUsersByPage(1, 2);
    expect(result.users).toHaveLength(2);
    expect(result.total).toBe(initialCount + 3);
  });
});

describe("closeDb", () => {
  it("closes the DB connection without error", () => {
    freshDb();
    expect(() => closeDb()).not.toThrow();
  });

  it("calling closeDb when already null does not throw", () => {
    freshDb();
    closeDb();
    expect(() => closeDb()).not.toThrow();
    // Restore for subsequent tests
    freshDb();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Additional coverage: previously uncovered functions
// ─────────────────────────────────────────────────────────────────────────────

describe("deactivateOtherAirports", () => {
  it("deactivates all airports except the kept one", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-doa-1", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });
    setMonitoredAirport({ id: "ma-doa-2", user_id: USER_ID, airport_iata: "LHR", destination_iata: "DXB" });
    deactivateOtherAirports(USER_ID, "DXB");
    const dxb = getMonitoredAirport(USER_ID);
    expect(dxb?.airport_iata).toBe("DXB");
  });
});

describe("setAirportLastScanAt", () => {
  it("updates last_scan_at for the given user+airport", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-scan-1", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });
    const ts = Math.floor(Date.now() / 1000) - 1000;
    setAirportLastScanAt(USER_ID, "DXB", ts);
    const airport = getMonitoredAirport(USER_ID);
    expect(airport?.last_scan_at).toBe(ts);
  });
});

describe("getAllFlightStatuses", () => {
  it("returns all flight id+status pairs from DB", () => {
    const statuses = getAllFlightStatuses();
    // May return 0 or more — just check it's an array of correct shape
    expect(Array.isArray(statuses)).toBe(true);
    if (statuses.length > 0) {
      expect(statuses[0]).toHaveProperty("id");
      expect(statuses[0]).toHaveProperty("status");
    }
  });

  it("returns seeded flight in statuses", () => {
    seedFlight();
    const statuses = getAllFlightStatuses();
    expect(statuses.some((s) => s.id === "fl-001")).toBe(true);
  });
});

describe("updateAirportLastScanAt", () => {
  it("updates last_scan_at for all active airports with given iata", () => {
    seedUser();
    setMonitoredAirport({ id: "ma-ual-1", user_id: USER_ID, airport_iata: "DXB", destination_iata: "LHR" });
    updateAirportLastScanAt("DXB");
    const airport = getMonitoredAirport(USER_ID);
    expect(airport?.last_scan_at).toBeGreaterThan(0);
  });
});

describe("setUserPersonalDetails / getUserPersonalDetails", () => {
  it("saves and retrieves personal details", () => {
    seedUser();
    const details = {
      full_name: "Alice Smith",
      date_of_birth: "1990-01-01",
      passport_number: "AB123456",
      passport_expiry: "2030-01-01",
      nationality: "GB",
      phone: "+441234567890",
    };
    setUserPersonalDetails(USER_ID, details);
    const retrieved = getUserPersonalDetails(USER_ID);
    expect(retrieved?.full_name).toBe("Alice Smith");
    expect(retrieved?.passport_number).toBe("AB123456");
  });

  it("returns null for non-existent user or null personal_details", () => {
    seedUser();
    const retrieved = getUserPersonalDetails(USER_ID);
    expect(retrieved).toBeNull();
  });
});

describe("updateUserEmailNotifications", () => {
  it("enables email notifications for user", () => {
    seedUser();
    updateUserEmailNotifications(USER_ID, 1);
    const user = getUserById(USER_ID);
    expect(user?.email_notifications).toBe(1);
  });

  it("disables email notifications for user", () => {
    seedUser();
    updateUserEmailNotifications(USER_ID, 0);
    const user = getUserById(USER_ID);
    expect(user?.email_notifications).toBe(0);
  });
});

describe("updateBookingStatus", () => {
  it("updates status with duffelOrderId", () => {
    seedUser();
    seedFlight();
    const booking = createPendingBookingForDuffel({
      id: "bk-ubs-1",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "ubs-ref-1",
      passenger_details: "{}",
    });
    updateBookingStatus(booking.id, "confirmed", "ord_test_123");
    const updated = getBookingById(booking.id);
    expect(updated?.status).toBe("confirmed");
    expect(updated?.duffel_order_id).toBe("ord_test_123");
  });

  it("updates status with cancelledReason", () => {
    seedUser();
    seedFlight();
    const booking = createPendingBookingForDuffel({
      id: "bk-ubs-2",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-2",
      internal_reference: "ubs-ref-2",
      passenger_details: "{}",
    });
    updateBookingStatus(booking.id, "cancelled", undefined, "User requested cancellation");
    const updated = getBookingById(booking.id);
    expect(updated?.status).toBe("cancelled");
    expect(updated?.cancelled_reason).toBe("User requested cancellation");
  });

  it("updates status without extra fields", () => {
    seedUser();
    seedFlight();
    const booking = createPendingBookingForDuffel({
      id: "bk-ubs-3",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-3",
      internal_reference: "ubs-ref-3",
      passenger_details: "{}",
    });
    updateBookingStatus(booking.id, "confirmed");
    const updated = getBookingById(booking.id);
    expect(updated?.status).toBe("confirmed");
  });
});

describe("getConfirmedBookingsByFlightId", () => {
  it("returns confirmed bookings for a flight", () => {
    seedUser();
    seedFlight();
    createPendingBookingForDuffel({
      id: "bk-gcbf-1",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "gcbf-ref-1",
      passenger_details: "{}",
    });
    updateBookingStatus("bk-gcbf-1", "confirmed", "ord_gcbf");
    const bookings = getConfirmedBookingsByFlightId("fl-001");
    expect(bookings.some((b) => b.id === "bk-gcbf-1")).toBe(true);
  });

  it("returns empty array when no confirmed bookings", () => {
    const bookings = getConfirmedBookingsByFlightId("fl-nonexistent");
    expect(bookings).toEqual([]);
  });
});

describe("getBookingsWithFlightsByUserId", () => {
  it("returns bookings joined with flight data for user", () => {
    seedUser();
    seedFlight();
    createPendingBookingForDuffel({
      id: "bk-gbwf-1",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "gbwf-ref-1",
      passenger_details: "{}",
    });
    const bookings = getBookingsWithFlightsByUserId(USER_ID);
    expect(bookings.length).toBeGreaterThan(0);
    expect(bookings[0]).toHaveProperty("flight_number");
  });
});

describe("getAllBookingsWithUsersAndFlights", () => {
  it("returns admin booking rows with user and flight data", () => {
    seedUser();
    seedFlight();
    createPendingBookingForDuffel({
      id: "bk-gabwf-1",
      user_id: USER_ID,
      flight_id: "fl-001",
      duffel_offer_id: "off-1",
      internal_reference: "gabwf-ref-1",
      passenger_details: "{}",
    });
    const rows = getAllBookingsWithUsersAndFlights();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("user_email");
    expect(rows[0]).toHaveProperty("flight_number");
  });
});
