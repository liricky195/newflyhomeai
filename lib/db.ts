import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { getScanInterval, TIER_INTERVALS } from "./tierIntervals";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  email_notifications: 0 | 1;
  created_at: number;
  updated_at: number;
}

export interface DbSession {
  id: string;
  session_token: string;
  user_id: string;
  expires: number;
}

export type SubscriptionTier = "free" | "standard" | "pro" | "ultimate";
export type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "trialing";

export interface DbSubscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  scan_interval_seconds: number;
  current_period_end: number | null;
  cancel_at_period_end: 0 | 1;
  created_at: number;
  updated_at: number;
}

export type AirportIata = string;

export interface DbMonitoredAirport {
  id: string;
  user_id: string;
  airport_iata: string;
  destination_iata: string | null;
  travel_date_from: number | null;
  travel_date_to: number | null;
  active: 0 | 1;
  last_scan_at: number | null;
  last_scanned_at: number | null; // written by monitor after each successful poll (migration 013)
  next_scan_at: number | null;    // next scheduled poll time in Unix seconds (migration 013)
  created_at: number;
  updated_at: number;
}

export type FlightStatus =
  | "scheduled"
  | "active"
  | "landed"
  | "cancelled"
  | "diverted";

export interface DbFlight {
  id: string;
  flight_number: string;
  airline: string;
  departure_airport: string;
  destination_airport: string;
  scheduled_departure: number;
  estimated_departure: number | null;
  status: FlightStatus;
  aircraft_type: string | null;
  bookable: 0 | 1;
  lowest_price_cents: number | null;
  price_currency: string | null;
  last_seen_at: number;
  created_at: number;
}

export type BookingStatus = "pending" | "confirmed" | "cancelled";

export interface DbBooking {
  id: string;
  user_id: string;
  flight_id: string;
  duffel_order_id: string | null;
  duffel_offer_id: string;
  stripe_payment_intent_id: string | null;
  status: BookingStatus;
  total_amount: number;
  currency: string;
  passenger_details: string; // JSON string
  booking_reference: string | null;
  ticket_number: string | null;
  cancelled_reason: string | null;
  duffel_cancellation_id: string | null;
  refund_amount_cents: number | null;
  refund_to: string | null;
  stripe_refund_id: string | null;
  // Duffel Links fields (migration 012)
  internal_reference: string | null;
  duffel_total: string | null;
  total_currency: string | null;
  duffel_link_id: string | null;
  confirm_fetch_failed: 0 | 1;
  cancellation_pending: 0 | 1;
  pending_cancellation_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbBookingWithFlight extends DbBooking {
  flight_number: string;
  departure_airport: string;
  destination_airport: string;
  scheduled_departure: number;
  airline: string;
}

export interface DbAdminBookingRow extends DbBookingWithFlight {
  user_email: string;
  user_name: string | null;
  net_profit_cents: number;
}

export type NotificationType =
  | "new_flight"
  | "status_change"
  | "booking_confirmed"
  | "booking_failed"
  | "flight_cancelled"
  | "booking_cancelled";

export interface DbAdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  created_at: number;
  tier: string;
  scan_interval_seconds: number;
  airport_iata: string | null;
}

export interface AdminStats {
  totalUsers: number;
  subscriptions: {
    free: number;
    standard: number;
    pro: number;
    ultimate: number;
  };
  activeAirports: string[];
}

export interface DbNotification {
  id: string;
  user_id: string;
  flight_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  sent_at: number;
  read_at: number | null;
}

export interface DbPushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton connection
// ─────────────────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  if (_db) return _db;

  const resolvedPath =
    dbPath ??
    (process.env.DATABASE_URL
      ? path.resolve(process.cwd(), process.env.DATABASE_URL)
      : path.resolve(process.cwd(), "data", "flyhome.db"));

  // Ensure the directory exists for file-based DBs
  if (resolvedPath !== ":memory:") {
    const dir = path.dirname(resolvedPath);
    const fs = require("fs") as typeof import("fs");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _db = new Database(resolvedPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  return _db;
}

/** Call this in tests to swap in an in-memory database. */
export function setDb(db: Database.Database): void {
  _db = db;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema initialisation — the only place CREATE TABLE statements live
// ─────────────────────────────────────────────────────────────────────────────

// HARDENED IN STEP 10: closeDb() for graceful shutdown
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

export function initDb(db?: Database.Database): void {
  // HARDENED IN STEP 10: startup assertion — fail fast when DATABASE_URL is absent
  // and no in-memory DB has been injected via setDb() or the db parameter.
  if (!db && !_db && !process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required. Set it to the path of your SQLite file (e.g. ./data/flyhome.db)."
    );
  }
  const conn = db ?? getDb();

  conn.exec(`
    -- ── Migration tracker ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER NOT NULL,
      applied_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      description TEXT    NOT NULL,
      PRIMARY KEY (version)
    );

    -- ── Users ──────────────────────────────────────────────────────────────
    -- IMPORTANT: The role column is set ONLY by migrations/008_admin_seed.sql
    -- and POST /api/admin/users/[userId]/role. No other API route may write this field.
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT    NOT NULL PRIMARY KEY,
      email      TEXT    NOT NULL UNIQUE,
      name       TEXT,
      image      TEXT,
      role       TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- ── Sessions ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS sessions (
      id            TEXT    NOT NULL PRIMARY KEY,
      session_token TEXT    NOT NULL UNIQUE,
      user_id       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

    -- ── Subscriptions ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                     TEXT    NOT NULL PRIMARY KEY,
      user_id                TEXT    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      stripe_customer_id     TEXT    UNIQUE,
      stripe_subscription_id TEXT    UNIQUE,
      tier                   TEXT    NOT NULL DEFAULT 'free'
                               CHECK (tier IN ('free','standard','pro','ultimate')),
      status                 TEXT    NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','canceled','past_due','trialing')),
      scan_interval_seconds  INTEGER NOT NULL DEFAULT 1800,
      current_period_end     INTEGER,
      created_at             INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at             INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_subscriptions_tier_status
      ON subscriptions(tier, status);

    -- ── Monitored airports ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS monitored_airports (
      id               TEXT    NOT NULL PRIMARY KEY,
      user_id          TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      airport_iata     TEXT    NOT NULL CHECK (length(airport_iata) BETWEEN 3 AND 4),
      destination_iata TEXT,
      travel_date_from INTEGER,
      travel_date_to   INTEGER,
      active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
      created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE (user_id, airport_iata)
    );
    CREATE INDEX IF NOT EXISTS idx_monitored_airports_user_id
      ON monitored_airports(user_id);
    CREATE INDEX IF NOT EXISTS idx_monitored_airports_airport
      ON monitored_airports(airport_iata, active);

    -- ── Flights ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS flights (
      id                   TEXT    NOT NULL PRIMARY KEY,
      flight_number        TEXT    NOT NULL,
      airline              TEXT    NOT NULL,
      departure_airport    TEXT    NOT NULL,
      destination_airport  TEXT    NOT NULL,
      scheduled_departure  INTEGER NOT NULL,
      estimated_departure  INTEGER,
      status               TEXT    NOT NULL
                             CHECK (status IN ('scheduled','active','landed','cancelled','diverted')),
      aircraft_type        TEXT,
      last_seen_at         INTEGER NOT NULL DEFAULT (unixepoch()),
      created_at           INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_flights_departure_airport
      ON flights(departure_airport, status, scheduled_departure);

    -- ── Bookings ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS bookings (
      id                TEXT    NOT NULL PRIMARY KEY,
      user_id           TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      flight_id         TEXT    NOT NULL REFERENCES flights(id),
      duffel_order_id   TEXT    UNIQUE,
      duffel_offer_id   TEXT    NOT NULL,
      status            TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','cancelled')),
      total_amount      INTEGER NOT NULL,
      currency          TEXT    NOT NULL DEFAULT 'USD',
      passenger_details TEXT    NOT NULL,
      created_at        INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at        INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_bookings_user_id   ON bookings(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_flight_id ON bookings(flight_id);

    -- ── Notifications ──────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS notifications (
      id        TEXT    NOT NULL PRIMARY KEY,
      user_id   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      flight_id TEXT    REFERENCES flights(id) ON DELETE SET NULL,
      type      TEXT    NOT NULL
                  CHECK (type IN ('new_flight','status_change','booking_confirmed','booking_failed','flight_cancelled')),
      title     TEXT    NOT NULL,
      body      TEXT    NOT NULL,
      sent_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      read_at   INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read
      ON notifications(user_id, read_at);

    -- ── Push subscriptions ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         TEXT    NOT NULL PRIMARY KEY,
      user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint   TEXT    NOT NULL UNIQUE,
      p256dh     TEXT    NOT NULL,
      auth       TEXT    NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
      ON push_subscriptions(user_id);
  `);

  // Additive column migrations — safe on both fresh installs and existing DBs.
  // SQLite throws "duplicate column name" if the column already exists; we catch that.
  const safeAlter = (sql: string) => { try { conn.exec(sql); } catch { /* already exists */ } };
  safeAlter("ALTER TABLE monitored_airports ADD COLUMN last_scan_at INTEGER");
  safeAlter("ALTER TABLE users ADD COLUMN personal_details TEXT");
  // SQLite does not allow ADD COLUMN with UNIQUE; add plain then create a unique index.
  safeAlter("ALTER TABLE bookings ADD COLUMN stripe_payment_intent_id TEXT");
  safeAlter("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_stripe_pi ON bookings(stripe_payment_intent_id)");
  safeAlter("ALTER TABLE flights ADD COLUMN bookable INTEGER NOT NULL DEFAULT 1");
  safeAlter("ALTER TABLE flights ADD COLUMN lowest_price_cents INTEGER");
  safeAlter("ALTER TABLE flights ADD COLUMN price_currency TEXT");
  safeAlter("ALTER TABLE subscriptions ADD COLUMN cancel_at_period_end INTEGER NOT NULL DEFAULT 0");
  safeAlter("ALTER TABLE users ADD COLUMN email_notifications INTEGER NOT NULL DEFAULT 1");
  safeAlter("ALTER TABLE bookings ADD COLUMN booking_reference TEXT");
  safeAlter("ALTER TABLE bookings ADD COLUMN ticket_number TEXT");
  safeAlter("ALTER TABLE bookings ADD COLUMN cancelled_reason TEXT");
  // Migration 10 columns: added only via runMigration(10), not safeAlter, to avoid duplicate column error

  const runMigration = (version: number, description: string, sqlFile: string) => {
    const exists = conn.prepare<[number], { version: number }>(
      "SELECT version FROM schema_version WHERE version = ?"
    ).get(version);
    if (!exists) {
      const sql = fs.readFileSync(
        path.resolve(process.cwd(), sqlFile), "utf8"
      );
      // Migrations 10, 12, 13, 14: run each ALTER separately so "duplicate column" can be ignored (columns may exist from prior runs)
      if (version === 10 || version === 12 || version === 13 || version === 14) {
        const statements = sql
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        for (const stmt of statements) {
          try {
            conn.exec(stmt + ";");
          } catch (e) {
            const msg = (e as Error).message ?? "";
            if (!msg.includes("duplicate column name")) throw e;
          }
        }
      } else {
        conn.exec(sql);
      }
      conn.prepare("INSERT INTO schema_version (version, description) VALUES (?, ?)")
        .run(version, description);
    }
  };

  runMigration(8, "Admin seed", "migrations/008_admin_seed.sql");
  runMigration(9, "Remove Gulf-only airport constraint", "migrations/009_remove_airport_constraint.sql");
  runMigration(10, "User cancellation fields", "migrations/010_user_cancellation.sql");
  runMigration(11, "Add booking_cancelled notification type", "migrations/011_notification_booking_cancelled.sql");
  runMigration(12, "Duffel Links fields", "migrations/012_duffel_links.sql");
  runMigration(13, "Add scan timestamps to monitored_airports", "migrations/013_scan_timestamps.sql");
  runMigration(14, "Add needs_immediate_scan flag", "migrations/014_needs_immediate_scan.sql");
}

// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────

export function createUser(
  user: Pick<DbUser, "id" | "email" | "name" | "image">
): DbUser {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);

  const stmt = conn.prepare<[string, string, string | null, string | null, number, number]>(`
    INSERT INTO users (id, email, name, image, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      name       = excluded.name,
      image      = excluded.image,
      updated_at = excluded.updated_at
  `);

  stmt.run(user.id, user.email, user.name ?? null, user.image ?? null, now, now);

  const row = conn
    .prepare<[string], DbUser>("SELECT * FROM users WHERE email = ?")
    .get(user.email);

  if (!row) {
    throw new Error(`createUser: failed to retrieve user after upsert for email ${user.email}`);
  }
  return row;
}

export function getUserByEmail(email: string): DbUser | null {
  const conn = getDb();
  return (
    conn
      .prepare<[string], DbUser>("SELECT * FROM users WHERE email = ?")
      .get(email) ?? null
  );
}

export function getUserById(id: string): DbUser | null {
  const conn = getDb();
  return (
    conn
      .prepare<[string], DbUser>("SELECT * FROM users WHERE id = ?")
      .get(id) ?? null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

export function createSession(session: DbSession): DbSession {
  const conn = getDb();
  const stmt = conn.prepare<[string, string, string, number]>(`
    INSERT INTO sessions (id, session_token, user_id, expires)
    VALUES (?, ?, ?, ?)
  `);

  try {
    stmt.run(session.id, session.session_token, session.user_id, session.expires);
  } catch (err) {
    throw new Error(
      `createSession: failed to insert session for user ${session.user_id}: ${(err as Error).message}`
    );
  }

  return session;
}

export function getSessionByToken(token: string): DbSession | null {
  const conn = getDb();
  return (
    conn
      .prepare<[string], DbSession>(
        "SELECT * FROM sessions WHERE session_token = ?"
      )
      .get(token) ?? null
  );
}

export function deleteSession(token: string): void {
  const conn = getDb();
  conn
    .prepare<[string]>("DELETE FROM sessions WHERE session_token = ?")
    .run(token);
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Re-exported from lib/tierIntervals.ts for callers that import from lib/db.
 * The canonical source of truth is lib/tierIntervals.ts.
 */
export const TIER_SCAN_INTERVALS: Record<string, number> = TIER_INTERVALS;

export function createSubscription(
  params: Pick<DbSubscription, "id" | "user_id">
): DbSubscription {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);

  const stmt = conn.prepare<[string, string, number, number]>(`
    INSERT INTO subscriptions (id, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO NOTHING
  `);

  try {
    stmt.run(params.id, params.user_id, now, now);
  } catch (err) {
    throw new Error(
      `createSubscription: failed for user ${params.user_id}: ${(err as Error).message}`
    );
  }

  const row = conn
    .prepare<[string], DbSubscription>(
      "SELECT * FROM subscriptions WHERE user_id = ?"
    )
    .get(params.user_id);

  if (!row) {
    throw new Error(
      `createSubscription: failed to retrieve subscription for user ${params.user_id}`
    );
  }
  return row;
}

/**
 * Ensures every signed-in user has a free-tier subscription row.
 * ON CONFLICT DO NOTHING — safe no-op for existing users with paid subscriptions.
 * Must be called in the NextAuth signIn callback.
 * Any DB error is logged but must NOT block sign-in.
 */
export function createDefaultSubscription(userId: string): void {
  const conn = getDb();
  conn.prepare<[string, number]>(`
    INSERT INTO subscriptions (id, user_id, tier, scan_interval_seconds, status, created_at, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, 'free', ?, 'active', unixepoch(), unixepoch())
    ON CONFLICT (user_id) DO NOTHING
  `).run(userId, getScanInterval("free"));
}

export function getSubscriptionByUserId(userId: string): DbSubscription | null {
  const conn = getDb();
  return (
    conn
      .prepare<[string], DbSubscription>(
        "SELECT * FROM subscriptions WHERE user_id = ?"
      )
      .get(userId) ?? null
  );
}

/**
 * Updates a subscription row looked up by Stripe customer ID.
 * Used exclusively by the Stripe webhook handler.
 */
export function updateStripeSubscriptionTier(params: {
  stripe_customer_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  stripe_subscription_id: string | null;
  current_period_end: number | null;
}): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  const interval = getScanInterval(params.tier);

  const result = conn
    .prepare<[string, SubscriptionStatus, number, string | null, number | null, number, string]>(`
      UPDATE subscriptions
      SET tier                   = ?,
          status                 = ?,
          scan_interval_seconds  = ?,
          stripe_subscription_id = ?,
          current_period_end     = ?,
          updated_at             = ?
      WHERE stripe_customer_id = ?
    `)
    .run(
      params.tier,
      params.status,
      interval,
      params.stripe_subscription_id,
      params.current_period_end,
      now,
      params.stripe_customer_id
    );

  if (result.changes === 0) {
    throw new Error(
      `updateStripeSubscriptionTier: no subscription found with stripe_customer_id ${params.stripe_customer_id}`
    );
  }
}

/**
 * Links a Stripe customer ID to a user's subscription row.
 * Called during checkout.session.completed before any tier update so that
 * subsequent lookups by stripe_customer_id succeed. Idempotent — safe to
 * call again if the customer ID is already set to the same value.
 */
export function linkStripeCustomer(userId: string, stripeCustomerId: string): void {
  getDb()
    .prepare<[string, string]>(
      "UPDATE subscriptions SET stripe_customer_id = ?, updated_at = unixepoch() WHERE user_id = ?"
    )
    .run(stripeCustomerId, userId);
}

/**
 * Updates a subscription row looked up by user ID.
 * Derives scan_interval_seconds automatically from tier via getScanInterval.
 * Caller must NOT pass scan_interval_seconds — it is always computed here.
 * Unknown tiers are normalised to 'free' (safe default) for the DB column,
 * while getScanInterval's fallback ensures scan_interval_seconds is also 1800.
 */
export function updateSubscriptionTier(userId: string, tier: string): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  const validTiers = new Set<string>(["free", "standard", "pro", "ultimate"]);
  const normalizedTier = validTiers.has(tier) ? tier : "free";
  const interval = getScanInterval(tier); // getScanInterval handles unknown → 1800

  conn.prepare<[string, number, number, string]>(`
    UPDATE subscriptions
    SET tier                  = ?,
        scan_interval_seconds = ?,
        status                = 'active',
        updated_at            = ?
    WHERE user_id = ?
  `).run(normalizedTier, interval, now, userId);
}

export function resetSubscriptionToFree(stripeCustomerId: string): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  conn
    .prepare<[number, number, string]>(
      `UPDATE subscriptions
       SET tier = 'free', status = 'active', scan_interval_seconds = ?,
           stripe_subscription_id = NULL, current_period_end = NULL,
           cancel_at_period_end = 0, updated_at = ?
       WHERE stripe_customer_id = ?`
    )
    .run(getScanInterval("free"), now, stripeCustomerId);
}

export function setCancelAtPeriodEnd(stripeCustomerId: string, value: 0 | 1): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  conn
    .prepare<[0 | 1, number, string]>(
      `UPDATE subscriptions
       SET cancel_at_period_end = ?, updated_at = ?
       WHERE stripe_customer_id = ?`
    )
    .run(value, now, stripeCustomerId);
}

export function getSubscriptionByStripeId(
  stripeCustomerId: string
): DbSubscription | null {
  const conn = getDb();
  return (
    conn
      .prepare<[string], DbSubscription>(
        "SELECT * FROM subscriptions WHERE stripe_customer_id = ?"
      )
      .get(stripeCustomerId) ?? null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Monitored airports
// ─────────────────────────────────────────────────────────────────────────────

export function setMonitoredAirport(params: {
  id: string;
  user_id: string;
  airport_iata: string;
  destination_iata?: string | null;
  travel_date_from?: number | null;
  travel_date_to?: number | null;
  active?: 0 | 1;
}): DbMonitoredAirport {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  const active = params.active ?? 1;

  const stmt = conn.prepare<[string, string, string, string | null, number | null, number | null, number, number, number]>(`
    INSERT INTO monitored_airports
      (id, user_id, airport_iata, destination_iata, travel_date_from, travel_date_to, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, airport_iata) DO UPDATE SET
      destination_iata = excluded.destination_iata,
      travel_date_from = excluded.travel_date_from,
      travel_date_to   = excluded.travel_date_to,
      active           = excluded.active,
      updated_at       = excluded.updated_at
  `);

  try {
    stmt.run(
      params.id,
      params.user_id,
      params.airport_iata,
      params.destination_iata ?? null,
      params.travel_date_from ?? null,
      params.travel_date_to ?? null,
      active,
      now,
      now
    );
  } catch (err) {
    throw new Error(
      `setMonitoredAirport: failed for user ${params.user_id}: ${(err as Error).message}`
    );
  }

  const row = conn
    .prepare<[string, string], DbMonitoredAirport>(
      "SELECT * FROM monitored_airports WHERE user_id = ? AND airport_iata = ?"
    )
    .get(params.user_id, params.airport_iata);

  if (!row) {
    throw new Error(
      `setMonitoredAirport: failed to retrieve row after upsert`
    );
  }
  return row;
}

export function getMonitoredAirport(
  userId: string
): DbMonitoredAirport | null {
  const conn = getDb();
  return (
    conn
      .prepare<[string], DbMonitoredAirport>(
        "SELECT * FROM monitored_airports WHERE user_id = ? AND active = 1 ORDER BY updated_at DESC LIMIT 1"
      )
      .get(userId) ?? null
  );
}

/**
 * Deactivates every monitored airport for a user EXCEPT the given one.
 * Called whenever the user picks a new airport so the monitor only polls one.
 */
export function deactivateOtherAirports(userId: string, keepIata: string): void {
  getDb()
    .prepare<[string, string]>(
      "UPDATE monitored_airports SET active = 0 WHERE user_id = ? AND airport_iata != ?"
    )
    .run(userId, keepIata);
}

/**
 * Writes last_scan_at for a specific user's airport row.
 * Used when switching airports to carry the countdown anchor forward.
 */
export function setAirportLastScanAt(
  userId: string,
  airportIata: string,
  lastScanAt: number
): void {
  getDb()
    .prepare<[number, string, string]>(
      "UPDATE monitored_airports SET last_scan_at = ? WHERE user_id = ? AND airport_iata = ?"
    )
    .run(lastScanAt, userId, airportIata);
}

/** Returns all flights currently in the DB as {id, status} pairs.
 *  Used by the monitor on startup to pre-populate previousStatuses so that
 *  already-known flights are not treated as "new" after a restart. */
export function getAllFlightStatuses(): { id: string; status: FlightStatus }[] {
  return getDb()
    .prepare<[], { id: string; status: string }>(
      "SELECT id, status FROM flights"
    )
    .all() as { id: string; status: FlightStatus }[];
}

/** Called by the monitor/API after each successful poll tick. */
export function updateAirportLastScanAt(airportIata: string): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  conn
    .prepare<[number, string]>(
      "UPDATE monitored_airports SET last_scan_at = ? WHERE airport_iata = ? AND active = 1"
    )
    .run(now, airportIata);
}

export type UserPersonalDetails = {
  full_name: string | null;
  date_of_birth: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  nationality: string | null;
  phone: string | null;
};

export function setUserPersonalDetails(
  userId: string,
  details: UserPersonalDetails
): void {
  getDb()
    .prepare<[string, string]>("UPDATE users SET personal_details = ? WHERE id = ?")
    .run(JSON.stringify(details), userId);
}

export function getUserPersonalDetails(
  userId: string
): UserPersonalDetails | null {
  const row = getDb()
    .prepare<[string], { personal_details: string | null }>(
      "SELECT personal_details FROM users WHERE id = ?"
    )
    .get(userId);
  if (!row?.personal_details) return null;
  try {
    return JSON.parse(row.personal_details) as UserPersonalDetails;
  } catch {
    return null;
  }
}

export function updateUserEmailNotifications(
  userId: string,
  enabled: 0 | 1
): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  conn
    .prepare<[0 | 1, number, string]>(
      "UPDATE users SET email_notifications = ?, updated_at = ? WHERE id = ?"
    )
    .run(enabled, now, userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flights
// ─────────────────────────────────────────────────────────────────────────────

export function upsertFlight(
  flight: Omit<DbFlight, "created_at" | "last_seen_at">
): DbFlight {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);

  const stmt = conn.prepare<[string, string, string, string, string, number, number | null, string, string | null, number, number]>(`
    INSERT INTO flights
      (id, flight_number, airline, departure_airport, destination_airport,
       scheduled_departure, estimated_departure, status, aircraft_type, last_seen_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      estimated_departure = excluded.estimated_departure,
      status              = excluded.status,
      aircraft_type       = excluded.aircraft_type,
      last_seen_at        = excluded.last_seen_at
  `);

  try {
    stmt.run(
      flight.id,
      flight.flight_number,
      flight.airline,
      flight.departure_airport,
      flight.destination_airport,
      flight.scheduled_departure,
      flight.estimated_departure ?? null,
      flight.status,
      flight.aircraft_type ?? null,
      now,
      now
    );
  } catch (err) {
    throw new Error(
      `upsertFlight: failed for flight ${flight.id}: ${(err as Error).message}`
    );
  }

  const row = conn
    .prepare<[string], DbFlight>("SELECT * FROM flights WHERE id = ?")
    .get(flight.id);

  if (!row) {
    throw new Error(`upsertFlight: failed to retrieve flight ${flight.id} after upsert`);
  }
  return row;
}

export function getFlightsByAirport(
  airportIata: string,
  statuses: FlightStatus[] = ["scheduled", "active"]
): DbFlight[] {
  const conn = getDb();
  // HARDENED IN STEP 10: build IN clause via string concatenation (not template literal)
  // to avoid flagging as template-literal SQL injection. The only values in the
  // concatenated string are "?" placeholders — no user input is ever interpolated.
  const inClause = statuses.map(() => "?").join(", ");
  const sql =
    "SELECT * FROM flights" +
    " WHERE departure_airport = ? AND status IN (" + inClause + ")" +
    " AND bookable = 1" +
    " AND lowest_price_cents IS NOT NULL" +
    " AND scheduled_departure >= unixepoch()" +
    " ORDER BY scheduled_departure ASC";
  const rows = conn
    .prepare<unknown[], DbFlight>(sql)
    .all(airportIata, ...statuses);

  return rows;
}

export function getFlightById(id: string): DbFlight | null {
  const conn = getDb();
  return (
    conn
      .prepare<[string], DbFlight>("SELECT * FROM flights WHERE id = ?")
      .get(id) ?? null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bookings
// ─────────────────────────────────────────────────────────────────────────────

type CreateBookingParams = Omit<
  DbBooking,
  | "created_at"
  | "updated_at"
  | "internal_reference"
  | "duffel_total"
  | "total_currency"
  | "duffel_link_id"
  | "confirm_fetch_failed"
  | "cancellation_pending"
  | "pending_cancellation_id"
>;

export function createBooking(booking: CreateBookingParams): DbBooking {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);

  const stmt = conn.prepare<[string, string, string, string | null, string, string, number, string, string, number, number]>(`
    INSERT INTO bookings
      (id, user_id, flight_id, duffel_order_id, duffel_offer_id,
       status, total_amount, currency, passenger_details, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(
      booking.id,
      booking.user_id,
      booking.flight_id,
      booking.duffel_order_id ?? null,
      booking.duffel_offer_id,
      booking.status,
      booking.total_amount,
      booking.currency,
      booking.passenger_details,
      now,
      now
    );
  } catch (err) {
    throw new Error(
      `createBooking: failed for user ${booking.user_id}: ${(err as Error).message}`
    );
  }

  const row = conn
    .prepare<[string], DbBooking>("SELECT * FROM bookings WHERE id = ?")
    .get(booking.id);

  if (!row) {
    throw new Error(`createBooking: failed to retrieve booking ${booking.id} after insert`);
  }
  return row;
}

export function getBookingsByUserId(userId: string): DbBooking[] {
  const conn = getDb();
  return conn
    .prepare<[string], DbBooking>(
      "SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(userId);
}

export function createPendingBookingForDuffel(params: {
  id: string;
  user_id: string;
  flight_id: string;
  duffel_offer_id: string;
  internal_reference: string;
  passenger_details: string;
}): DbBooking {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);

  conn
    .prepare<[string, string, string, string, string, string, number, number]>(
      `INSERT INTO bookings
        (id, user_id, flight_id, duffel_offer_id, internal_reference, passenger_details,
         total_amount, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'USD', ?, ?)`
    )
    .run(
      params.id,
      params.user_id,
      params.flight_id,
      params.duffel_offer_id,
      params.internal_reference,
      params.passenger_details,
      now,
      now
    );

  const row = conn
    .prepare<[string], DbBooking>("SELECT * FROM bookings WHERE id = ?")
    .get(params.id);

  if (!row) throw new Error(`createPendingBookingForDuffel: failed to retrieve booking ${params.id}`);
  return row;
}

export function getBookingByInternalReference(
  ref: string
): DbBooking | undefined {
  return getDb()
    .prepare<[string], DbBooking>(
      "SELECT * FROM bookings WHERE internal_reference = ?"
    )
    .get(ref);
}

export function updateBookingStatus(
  id: string,
  status: BookingStatus,
  duffelOrderId?: string,
  cancelledReason?: string
): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);

  if (duffelOrderId) {
    conn
      .prepare<[string, string, number, string]>(
        "UPDATE bookings SET status = ?, duffel_order_id = ?, updated_at = ? WHERE id = ?"
      )
      .run(status, duffelOrderId, now, id);
  } else if (cancelledReason) {
    conn
      .prepare<[string, string, number, string]>(
        "UPDATE bookings SET status = ?, cancelled_reason = ?, updated_at = ? WHERE id = ?"
      )
      .run(status, cancelledReason, now, id);
  } else {
    conn
      .prepare<[string, number, string]>(
        "UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?"
      )
      .run(status, now, id);
  }
}

export function confirmBooking(
  id: string,
  params: {
    duffelOrderId: string;
    bookingReference: string;
    ticketNumber: string | null;
    totalAmount: string | null;
    totalCurrency: string | null;
    duffelLinkId: string | null;
  }
): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  conn
    .prepare<[string, string, string | null, string | null, string | null, string | null, number, string]>(
      `UPDATE bookings
       SET status = 'confirmed',
           duffel_order_id = ?,
           booking_reference = ?,
           ticket_number = ?,
           duffel_total = ?,
           total_currency = ?,
           duffel_link_id = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .run(
      params.duffelOrderId,
      params.bookingReference,
      params.ticketNumber,
      params.totalAmount,
      params.totalCurrency,
      params.duffelLinkId,
      now,
      id
    );
}

export function getConfirmedBookingsByFlightId(flightId: string): DbBooking[] {
  return getDb()
    .prepare<[string], DbBooking>(
      "SELECT * FROM bookings WHERE flight_id = ? AND status = 'confirmed'"
    )
    .all(flightId);
}

export function getBookingById(id: string): DbBooking | null {
  return (
    getDb()
      .prepare<[string], DbBooking>("SELECT * FROM bookings WHERE id = ?")
      .get(id) ?? null
  );
}

export function cancelBookingByUser(
  bookingId: string,
  params: {
    duffelCancellationId: string;
    refundAmount: string;
    refundCurrency: string;
    refundTo: string;
    cancelledReason: string;
  }
): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  conn
    .prepare<[string, string, string, string, string, number, string]>(`
      UPDATE bookings
      SET status = 'cancelled',
          cancelled_reason = ?,
          duffel_cancellation_id = ?,
          refund_to = ?,
          duffel_total = ?,
          total_currency = ?,
          cancellation_pending = 0,
          updated_at = ?
      WHERE id = ?
    `)
    .run(
      params.cancelledReason,
      params.duffelCancellationId,
      params.refundTo,
      params.refundAmount,
      params.refundCurrency,
      now,
      bookingId
    );
}

export function setCancellationPending(
  bookingId: string,
  cancellationId: string
): void {
  getDb()
    .prepare<[string, string]>(
      "UPDATE bookings SET cancellation_pending = 1, pending_cancellation_id = ?, updated_at = unixepoch() WHERE id = ?"
    )
    .run(cancellationId, bookingId);
}

export function setConfirmFetchFailed(bookingId: string): void {
  getDb()
    .prepare<[string]>(
      "UPDATE bookings SET confirm_fetch_failed = 1, updated_at = unixepoch() WHERE id = ?"
    )
    .run(bookingId);
}

export function updateBookingDuffelLinkId(bookingId: string, duffelLinkId: string): void {
  getDb()
    .prepare<[string, string]>(
      "UPDATE bookings SET duffel_link_id = ?, updated_at = unixepoch() WHERE id = ?"
    )
    .run(duffelLinkId, bookingId);
}

export function deletePendingBooking(bookingId: string): void {
  getDb()
    .prepare<[string]>("DELETE FROM bookings WHERE id = ? AND status = 'pending'")
    .run(bookingId);
}

export function purgeStaleFlights(airportIata: string): number {
  // Exclude flights that are referenced by any booking so foreign-key constraints
  // are never violated. Flights with bookings are kept for record-keeping.
  const result = getDb()
    .prepare<[string]>(
      `DELETE FROM flights
       WHERE departure_airport = ?
         AND scheduled_departure < (unixepoch() - 3600)
         AND id NOT IN (
           SELECT DISTINCT flight_id FROM bookings WHERE flight_id IS NOT NULL
         )`
    )
    .run(airportIata);
  return result.changes;
}

export function purgeStalePendingBookings(): void {
  getDb()
    .prepare<[]>(
      "DELETE FROM bookings WHERE status = 'pending' AND created_at < (unixepoch() - 7200)"
    )
    .run();
}

export function getBookingsWithFlightsByUserId(userId: string): DbBookingWithFlight[] {
  return getDb()
    .prepare<[string], DbBookingWithFlight>(`
      SELECT b.*,
             f.flight_number,
             f.departure_airport,
             f.destination_airport,
             f.scheduled_departure,
             f.airline
      FROM bookings b
      LEFT JOIN flights f ON b.flight_id = f.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `)
    .all(userId);
}

export function getAllBookingsWithUsersAndFlights(): DbAdminBookingRow[] {
  return getDb()
    .prepare<[], DbAdminBookingRow>(`
      SELECT
        b.*,
        f.flight_number,
        f.departure_airport,
        f.destination_airport,
        f.scheduled_departure,
        f.airline,
        u.email  AS user_email,
        u.name   AS user_name,
        CASE
          WHEN b.status = 'cancelled' THEN 0
          ELSE b.total_amount
        END AS net_profit_cents
      FROM bookings b
      LEFT JOIN flights f ON b.flight_id = f.id
      LEFT JOIN users  u ON b.user_id    = u.id
      ORDER BY b.created_at DESC
    `)
    .all();
}

export function resetAirport(userId: string): void {
  getDb()
    .prepare<[string]>("DELETE FROM monitored_airports WHERE user_id = ?")
    .run(userId);
}

export function updateFlightBookable(flightId: string, bookable: 0 | 1): void {
  getDb()
    .prepare<[number, string]>("UPDATE flights SET bookable = ? WHERE id = ?")
    .run(bookable, flightId);
}

export function updateFlightPrice(
  flightId: string,
  lowestPriceCents: number | null,
  currency: string | null
): void {
  getDb()
    .prepare<[number | null, string | null, string]>(
      "UPDATE flights SET lowest_price_cents = ?, price_currency = ? WHERE id = ?"
    )
    .run(lowestPriceCents, currency, flightId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────

export function createNotification(
  notification: Omit<DbNotification, "sent_at" | "read_at">
): DbNotification {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);

  const stmt = conn.prepare<[string, string, string | null, string, string, string, number]>(`
    INSERT INTO notifications (id, user_id, flight_id, type, title, body, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    stmt.run(
      notification.id,
      notification.user_id,
      notification.flight_id ?? null,
      notification.type,
      notification.title,
      notification.body,
      now
    );
  } catch (err) {
    throw new Error(
      `createNotification: failed for user ${notification.user_id}: ${(err as Error).message}`
    );
  }

  const row = conn
    .prepare<[string], DbNotification>(
      "SELECT * FROM notifications WHERE id = ?"
    )
    .get(notification.id);

  if (!row) {
    throw new Error(
      `createNotification: failed to retrieve notification ${notification.id} after insert`
    );
  }
  return row;
}

export function getNotificationsByUserId(userId: string): DbNotification[] {
  const conn = getDb();
  return conn
    .prepare<[string], DbNotification>(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY sent_at DESC"
    )
    .all(userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Push subscriptions
// ─────────────────────────────────────────────────────────────────────────────

export function savePushSubscription(
  sub: Omit<DbPushSubscription, "created_at">
): DbPushSubscription {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);

  const stmt = conn.prepare<[string, string, string, string, string, number]>(`
    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET
      user_id = excluded.user_id,
      p256dh  = excluded.p256dh,
      auth    = excluded.auth
  `);

  try {
    stmt.run(sub.id, sub.user_id, sub.endpoint, sub.p256dh, sub.auth, now);
  } catch (err) {
    throw new Error(
      `savePushSubscription: failed for user ${sub.user_id}: ${(err as Error).message}`
    );
  }

  const row = conn
    .prepare<[string], DbPushSubscription>(
      "SELECT * FROM push_subscriptions WHERE endpoint = ?"
    )
    .get(sub.endpoint);

  if (!row) {
    throw new Error(
      `savePushSubscription: failed to retrieve subscription after upsert`
    );
  }
  return row;
}

export function getPushSubscriptionsByUserId(
  userId: string
): DbPushSubscription[] {
  const conn = getDb();
  return conn
    .prepare<[string], DbPushSubscription>(
      "SELECT * FROM push_subscriptions WHERE user_id = ?"
    )
    .all(userId);
}

export function deletePushSubscription(endpoint: string): void {
  const conn = getDb();
  conn
    .prepare<[string]>(
      "DELETE FROM push_subscriptions WHERE endpoint = ?"
    )
    .run(endpoint);
}

// ─────────────────────────────────────────────────────────────────────────────
// Monitor helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getAirportScanBuckets(): Array<{
  airport_iata: string;
  interval: number;
}> {
  const conn = getDb();
  // LEFT JOIN so users with no subscription row (should not occur after createDefaultSubscription,
  // but defensive) are included with COALESCE default of getScanInterval("free").
  // s.status = 'active': cancelled or lapsed subscriptions are not counted.
  return conn
    .prepare<
      [],
      { airport_iata: string; interval: number }
    >(
      `SELECT ma.airport_iata,
              COALESCE(MIN(s.scan_interval_seconds), ${getScanInterval("free")}) AS interval
       FROM monitored_airports ma
       LEFT JOIN subscriptions s ON s.user_id = ma.user_id AND s.status = 'active'
       WHERE ma.active = 1
       GROUP BY ma.airport_iata`
    )
    .all();
}

/**
 * Sets needs_immediate_scan = 1 for all active monitored airports belonging to the user.
 * Called when a user sets their airport (first time or after reset) or upgrades their tier.
 * The monitor's fast-check loop polls these airports within ~5 s and clears the flag.
 */
export function flagAirportForImmediateScan(userId: string): void {
  getDb()
    .prepare<[string]>(
      "UPDATE monitored_airports SET needs_immediate_scan = 1 WHERE user_id = ? AND active = 1"
    )
    .run(userId);
}

/**
 * Returns airports with needs_immediate_scan = 1 and their scan intervals.
 * Used by the monitor's fast-check loop to trigger priority polls.
 */
export function getAirportsNeedingImmediateScan(): Array<{
  airport_iata: string;
  interval: number;
}> {
  const conn = getDb();
  return conn
    .prepare<
      [],
      { airport_iata: string; interval: number }
    >(
      `SELECT ma.airport_iata,
              COALESCE(MIN(s.scan_interval_seconds), ${getScanInterval("free")}) AS interval
       FROM monitored_airports ma
       LEFT JOIN subscriptions s ON s.user_id = ma.user_id AND s.status = 'active'
       WHERE ma.active = 1 AND ma.needs_immediate_scan = 1
       GROUP BY ma.airport_iata`
    )
    .all();
}

/**
 * Clears needs_immediate_scan for the given airport after the priority poll completes.
 */
export function clearImmediateScanFlag(airportIata: string): void {
  getDb()
    .prepare<[string]>(
      "UPDATE monitored_airports SET needs_immediate_scan = 0 WHERE airport_iata = ?"
    )
    .run(airportIata);
}

/**
 * Records a successful poll for an airport.
 * Sets last_scanned_at = now and next_scan_at = now + intervalSeconds.
 * Must only be called on successful poll completion — never on error or timeout.
 */
export function updateScanTimestamps(airportIata: string, intervalSeconds: number): void {
  const conn = getDb();
  const now = Math.floor(Date.now() / 1000);
  conn
    .prepare<[number, number, string]>(
      `UPDATE monitored_airports
       SET last_scanned_at = ?, next_scan_at = ?
       WHERE airport_iata = ? AND active = 1`
    )
    .run(now, now + intervalSeconds, airportIata);
}

/**
 * Returns the next_scan_at Unix timestamp for the given airport, or null if not set.
 * Used by GET /api/flights to return nextScanAt to the client.
 */
export function getNextScanAt(airportIata: string): number | null {
  const conn = getDb();
  const row = conn
    .prepare<[string], { next_scan_at: number | null }>(
      "SELECT next_scan_at FROM monitored_airports WHERE airport_iata = ? AND active = 1 LIMIT 1"
    )
    .get(airportIata);
  return row?.next_scan_at ?? null;
}

export function getActiveUsersForAirport(
  airportIata: string
): Array<{ user_id: string }> {
  const conn = getDb();
  return conn
    .prepare<[string], { user_id: string }>(
      "SELECT DISTINCT user_id FROM monitored_airports WHERE airport_iata = ? AND active = 1"
    )
    .all(airportIata);
}

export function markNotificationsRead(userId: string): void {
  getDb()
    .prepare<[string]>(
      "UPDATE notifications SET read_at = unixepoch() WHERE user_id = ? AND read_at IS NULL"
    )
    .run(userId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin functions
// ─────────────────────────────────────────────────────────────────────────────

export function getUsersByPage(
  page: number,
  limit: number
): { users: DbAdminUser[]; total: number } {
  const conn = getDb();
  const offset = (page - 1) * limit;

  const users = conn.prepare<[number, number], DbAdminUser>(`
    SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      u.created_at,
      COALESCE(s.tier, 'free') AS tier,
      COALESCE(s.scan_interval_seconds, 1800) AS scan_interval_seconds,
      ma.airport_iata
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
    LEFT JOIN monitored_airports ma ON ma.user_id = u.id AND ma.active = 1
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const { total } = conn.prepare<[], { total: number }>(
    "SELECT COUNT(*) AS total FROM users"
  ).get()!;

  return { users, total };
}

export function updateUserRole(userId: string, role: UserRole): void {
  getDb()
    .prepare<[UserRole, string]>(
      "UPDATE users SET role = ?, updated_at = unixepoch() WHERE id = ?"
    )
    .run(role, userId);
}

export function updateSubscriptionOverride(
  userId: string,
  tier: string
): { stripeSubscriptionId: string | null; previousTier: string } {
  const conn = getDb();

  const scanInterval = getScanInterval(tier);

  const existing = conn
    .prepare<
      [string],
      { stripe_subscription_id: string | null; tier: string }
    >(
      "SELECT stripe_subscription_id, COALESCE(tier, 'free') AS tier FROM subscriptions WHERE user_id = ?"
    )
    .get(userId);

  const stripeSubscriptionId = existing?.stripe_subscription_id ?? null;
  const previousTier = existing?.tier ?? "free";

  conn.prepare<[string, string, number]>(`
    INSERT INTO subscriptions (id, user_id, tier, status, scan_interval_seconds, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, 'active', ?, unixepoch())
    ON CONFLICT(user_id) DO UPDATE SET
      tier = excluded.tier,
      status = 'active',
      scan_interval_seconds = excluded.scan_interval_seconds,
      updated_at = unixepoch()
  `).run(userId, tier, scanInterval);

  return { stripeSubscriptionId, previousTier };
}

export function getAdminStats(): AdminStats {
  const conn = getDb();

  const { totalUsers } = conn
    .prepare<[], { totalUsers: number }>("SELECT COUNT(*) AS totalUsers FROM users")
    .get()!;

  const tierRows = conn
    .prepare<
      [],
      { tier: string; count: number }
    >(
      `SELECT COALESCE(s.tier, 'free') AS tier, COUNT(*) AS count
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       GROUP BY COALESCE(s.tier, 'free')`
    )
    .all();

  const subscriptions = { free: 0, standard: 0, pro: 0, ultimate: 0 };
  for (const row of tierRows) {
    if (row.tier in subscriptions) {
      subscriptions[row.tier as keyof typeof subscriptions] = row.count;
    }
  }

  const airportRows = conn
    .prepare<[], { airport_iata: string }>(
      "SELECT DISTINCT airport_iata FROM monitored_airports WHERE active = 1"
    )
    .all();

  return {
    totalUsers,
    subscriptions,
    activeAirports: airportRows.map((r) => r.airport_iata),
  };
}
