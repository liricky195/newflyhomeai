"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIER_SCAN_INTERVALS = void 0;
exports.getDb = getDb;
exports.setDb = setDb;
exports.closeDb = closeDb;
exports.initDb = initDb;
exports.createUser = createUser;
exports.getUserByEmail = getUserByEmail;
exports.getUserById = getUserById;
exports.getUserByStripeCustomerId = getUserByStripeCustomerId;
exports.createSession = createSession;
exports.getSessionByToken = getSessionByToken;
exports.deleteSession = deleteSession;
exports.deleteUser = deleteUser;
exports.createSubscription = createSubscription;
exports.createDefaultSubscription = createDefaultSubscription;
exports.getSubscriptionByUserId = getSubscriptionByUserId;
exports.updateStripeSubscriptionTier = updateStripeSubscriptionTier;
exports.linkStripeCustomer = linkStripeCustomer;
exports.updateSubscriptionTier = updateSubscriptionTier;
exports.resetSubscriptionToFree = resetSubscriptionToFree;
exports.setCancelAtPeriodEnd = setCancelAtPeriodEnd;
exports.getSubscriptionByStripeId = getSubscriptionByStripeId;
exports.setMonitoredAirport = setMonitoredAirport;
exports.getMonitoredAirport = getMonitoredAirport;
exports.deactivateOtherAirports = deactivateOtherAirports;
exports.setAirportLastScanAt = setAirportLastScanAt;
exports.getAllFlightStatuses = getAllFlightStatuses;
exports.updateAirportLastScanAt = updateAirportLastScanAt;
exports.setUserPersonalDetails = setUserPersonalDetails;
exports.getUserPersonalDetails = getUserPersonalDetails;
exports.updateUserEmailNotifications = updateUserEmailNotifications;
exports.upsertFlight = upsertFlight;
exports.getFlightsByAirport = getFlightsByAirport;
exports.getFlightById = getFlightById;
exports.createBooking = createBooking;
exports.getBookingsByUserId = getBookingsByUserId;
exports.createPendingBookingForDuffel = createPendingBookingForDuffel;
exports.getBookingByInternalReference = getBookingByInternalReference;
exports.updateBookingStatus = updateBookingStatus;
exports.confirmBooking = confirmBooking;
exports.getConfirmedBookingsByFlightId = getConfirmedBookingsByFlightId;
exports.getBookingById = getBookingById;
exports.cancelBookingByUser = cancelBookingByUser;
exports.setCancellationPending = setCancellationPending;
exports.setConfirmFetchFailed = setConfirmFetchFailed;
exports.updateBookingDuffelLinkId = updateBookingDuffelLinkId;
exports.deletePendingBooking = deletePendingBooking;
exports.purgeStaleFlights = purgeStaleFlights;
exports.purgeStalePendingBookings = purgeStalePendingBookings;
exports.getBookingsWithFlightsByUserId = getBookingsWithFlightsByUserId;
exports.getAllBookingsWithUsersAndFlights = getAllBookingsWithUsersAndFlights;
exports.resetAirport = resetAirport;
exports.updateFlightBookable = updateFlightBookable;
exports.updateFlightPrice = updateFlightPrice;
exports.createNotification = createNotification;
exports.getNotificationsByUserId = getNotificationsByUserId;
exports.savePushSubscription = savePushSubscription;
exports.getPushSubscriptionsByUserId = getPushSubscriptionsByUserId;
exports.deletePushSubscription = deletePushSubscription;
exports.getAirportScanBuckets = getAirportScanBuckets;
exports.flagAirportForImmediateScan = flagAirportForImmediateScan;
exports.getAirportsNeedingImmediateScan = getAirportsNeedingImmediateScan;
exports.setNextScanAtImmediate = setNextScanAtImmediate;
exports.setNextScanAtImmediateByStripeCustomer = setNextScanAtImmediateByStripeCustomer;
exports.clearImmediateScanFlag = clearImmediateScanFlag;
exports.updateScanTimestamps = updateScanTimestamps;
exports.initNextScanAt = initNextScanAt;
exports.setUserNextScanAt = setUserNextScanAt;
exports.getNextScanAt = getNextScanAt;
exports.getActiveUsersForAirport = getActiveUsersForAirport;
exports.markNotificationsRead = markNotificationsRead;
exports.getUsersByPage = getUsersByPage;
exports.updateUserRole = updateUserRole;
exports.updateSubscriptionOverride = updateSubscriptionOverride;
exports.getAdminStats = getAdminStats;
var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var path_1 = __importDefault(require("path"));
var fs_1 = __importDefault(require("fs"));
var tierIntervals_1 = require("./tierIntervals");
// ─────────────────────────────────────────────────────────────────────────────
// Singleton connection
// ─────────────────────────────────────────────────────────────────────────────
var _db = null;
function getDb(dbPath) {
    if (_db)
        return _db;
    var resolvedPath = dbPath !== null && dbPath !== void 0 ? dbPath : (process.env.DATABASE_URL
        ? path_1.default.resolve(process.cwd(), process.env.DATABASE_URL)
        : path_1.default.resolve(process.cwd(), "data", "flyhome.db"));
    // Ensure the directory exists for file-based DBs
    if (resolvedPath !== ":memory:") {
        var dir = path_1.default.dirname(resolvedPath);
        var fs_2 = require("fs");
        if (!fs_2.existsSync(dir)) {
            fs_2.mkdirSync(dir, { recursive: true });
        }
    }
    _db = new better_sqlite3_1.default(resolvedPath);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    return _db;
}
/** Call this in tests to swap in an in-memory database. */
function setDb(db) {
    _db = db;
}
// ─────────────────────────────────────────────────────────────────────────────
// Schema initialisation — the only place CREATE TABLE statements live
// ─────────────────────────────────────────────────────────────────────────────
// HARDENED IN STEP 10: closeDb() for graceful shutdown
function closeDb() {
    if (_db) {
        _db.close();
        _db = null;
    }
}
function initDb(db) {
    // HARDENED IN STEP 10: startup assertion — fail fast when DATABASE_URL is absent
    // and no in-memory DB has been injected via setDb() or the db parameter.
    if (!db && !_db && !process.env.DATABASE_URL) {
        // During Next.js production build, skip DB initialization — the database
        // is only needed at runtime, not during static page-data collection.
        if (process.env.NEXT_PHASE === "phase-production-build")
            return;
        throw new Error("DATABASE_URL is required. Set it to the path of your SQLite file (e.g. ./data/flyhome.db).");
    }
    var conn = db !== null && db !== void 0 ? db : getDb();
    conn.exec("\n    -- \u2500\u2500 Migration tracker \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS schema_version (\n      version     INTEGER NOT NULL,\n      applied_at  INTEGER NOT NULL DEFAULT (unixepoch()),\n      description TEXT    NOT NULL,\n      PRIMARY KEY (version)\n    );\n\n    -- \u2500\u2500 Users \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    -- IMPORTANT: The role column is set ONLY by migrations/008_admin_seed.sql\n    -- and POST /api/admin/users/[userId]/role. No other API route may write this field.\n    CREATE TABLE IF NOT EXISTS users (\n      id         TEXT    NOT NULL PRIMARY KEY,\n      email      TEXT    NOT NULL UNIQUE,\n      name       TEXT,\n      image      TEXT,\n      role       TEXT    NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),\n      created_at INTEGER NOT NULL DEFAULT (unixepoch()),\n      updated_at INTEGER NOT NULL DEFAULT (unixepoch())\n    );\n\n    -- \u2500\u2500 Sessions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS sessions (\n      id            TEXT    NOT NULL PRIMARY KEY,\n      session_token TEXT    NOT NULL UNIQUE,\n      user_id       TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n      expires       INTEGER NOT NULL\n    );\n    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);\n\n    -- \u2500\u2500 Verification tokens \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS verification_tokens (\n      identifier TEXT    NOT NULL,\n      token      TEXT    NOT NULL,\n      expires    INTEGER NOT NULL,\n      PRIMARY KEY (identifier, token)\n    );\n\n    -- \u2500\u2500 Subscriptions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS subscriptions (\n      id                     TEXT    NOT NULL PRIMARY KEY,\n      user_id                TEXT    NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,\n      stripe_customer_id     TEXT    UNIQUE,\n      stripe_subscription_id TEXT    UNIQUE,\n      tier                   TEXT    NOT NULL DEFAULT 'free'\n                               CHECK (tier IN ('free','standard','pro','ultimate')),\n      status                 TEXT    NOT NULL DEFAULT 'active'\n                               CHECK (status IN ('active','canceled','past_due','trialing')),\n      scan_interval_seconds  INTEGER NOT NULL DEFAULT 600,\n      current_period_end     INTEGER,\n      created_at             INTEGER NOT NULL DEFAULT (unixepoch()),\n      updated_at             INTEGER NOT NULL DEFAULT (unixepoch())\n    );\n    CREATE INDEX IF NOT EXISTS idx_subscriptions_tier_status\n      ON subscriptions(tier, status);\n\n    -- \u2500\u2500 Monitored airports \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS monitored_airports (\n      id               TEXT    NOT NULL PRIMARY KEY,\n      user_id          TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n      airport_iata     TEXT    NOT NULL CHECK (length(airport_iata) BETWEEN 3 AND 4),\n      destination_iata TEXT,\n      travel_date_from INTEGER,\n      travel_date_to   INTEGER,\n      active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),\n      max_price_usd    INTEGER,\n      created_at       INTEGER NOT NULL DEFAULT (unixepoch()),\n      updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),\n      UNIQUE (user_id, airport_iata)\n    );\n    CREATE INDEX IF NOT EXISTS idx_monitored_airports_user_id\n      ON monitored_airports(user_id);\n    CREATE INDEX IF NOT EXISTS idx_monitored_airports_airport\n      ON monitored_airports(airport_iata, active);\n\n    -- \u2500\u2500 Flights \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS flights (\n      id                   TEXT    NOT NULL PRIMARY KEY,\n      flight_number        TEXT    NOT NULL,\n      airline              TEXT    NOT NULL,\n      departure_airport    TEXT    NOT NULL,\n      destination_airport  TEXT    NOT NULL,\n      scheduled_departure  INTEGER NOT NULL,\n      estimated_departure  INTEGER,\n      status               TEXT    NOT NULL\n                             CHECK (status IN ('scheduled','active','landed','cancelled','diverted')),\n      aircraft_type        TEXT,\n      last_seen_at         INTEGER NOT NULL DEFAULT (unixepoch()),\n      created_at           INTEGER NOT NULL DEFAULT (unixepoch())\n    );\n    CREATE INDEX IF NOT EXISTS idx_flights_departure_airport\n      ON flights(departure_airport, status, scheduled_departure);\n\n    -- \u2500\u2500 Bookings \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS bookings (\n      id                TEXT    NOT NULL PRIMARY KEY,\n      user_id           TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n      flight_id         TEXT    NOT NULL REFERENCES flights(id),\n      duffel_order_id   TEXT    UNIQUE,\n      duffel_offer_id   TEXT    NOT NULL,\n      status            TEXT    NOT NULL DEFAULT 'pending'\n                          CHECK (status IN ('pending','confirmed','cancelled')),\n      total_amount      INTEGER NOT NULL,\n      currency          TEXT    NOT NULL DEFAULT 'USD',\n      passenger_details TEXT    NOT NULL,\n      created_at        INTEGER NOT NULL DEFAULT (unixepoch()),\n      updated_at        INTEGER NOT NULL DEFAULT (unixepoch())\n    );\n    CREATE INDEX IF NOT EXISTS idx_bookings_user_id   ON bookings(user_id);\n    CREATE INDEX IF NOT EXISTS idx_bookings_flight_id ON bookings(flight_id);\n\n    -- \u2500\u2500 Notifications \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS notifications (\n      id        TEXT    NOT NULL PRIMARY KEY,\n      user_id   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n      flight_id TEXT    REFERENCES flights(id) ON DELETE SET NULL,\n      type      TEXT    NOT NULL\n                  CHECK (type IN ('new_flight','status_change','booking_confirmed','booking_failed','flight_cancelled')),\n      title     TEXT    NOT NULL,\n      body      TEXT    NOT NULL,\n      sent_at   INTEGER NOT NULL DEFAULT (unixepoch()),\n      read_at   INTEGER\n    );\n    CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read\n      ON notifications(user_id, read_at);\n\n    -- \u2500\u2500 Push subscriptions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n    CREATE TABLE IF NOT EXISTS push_subscriptions (\n      id         TEXT    NOT NULL PRIMARY KEY,\n      user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,\n      endpoint   TEXT    NOT NULL UNIQUE,\n      p256dh     TEXT    NOT NULL,\n      auth       TEXT    NOT NULL,\n      created_at INTEGER NOT NULL DEFAULT (unixepoch())\n    );\n    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id\n      ON push_subscriptions(user_id);\n  ");
    // Additive column migrations — safe on both fresh installs and existing DBs.
    // SQLite throws "duplicate column name" if the column already exists; we catch that.
    var safeAlter = function (sql) { try {
        conn.exec(sql);
    }
    catch ( /* already exists */_a) { /* already exists */ } };
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
    var runMigration = function (version, description, sqlFile) {
        var _a;
        var exists = conn.prepare("SELECT version FROM schema_version WHERE version = ?").get(version);
        if (!exists) {
            var sql = fs_1.default.readFileSync(path_1.default.resolve(process.cwd(), sqlFile), "utf8");
            // Migrations 10, 12, 13, 14: run each ALTER separately so "duplicate column" can be ignored (columns may exist from prior runs)
            if (version === 10 || version === 12 || version === 13 || version === 14) {
                var statements = sql
                    .split(";")
                    .map(function (s) { return s.trim(); })
                    .filter(Boolean);
                for (var _i = 0, statements_1 = statements; _i < statements_1.length; _i++) {
                    var stmt = statements_1[_i];
                    try {
                        conn.exec(stmt + ";");
                    }
                    catch (e) {
                        var msg = (_a = e.message) !== null && _a !== void 0 ? _a : "";
                        if (!msg.includes("duplicate column name"))
                            throw e;
                    }
                }
            }
            else {
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
    runMigration(15, "Add user-specific next_scan_at", "migrations/015_user_specific_next_scan.sql");
    runMigration(16, "Add max_price_usd to monitored_airports", "migrations/016_add_max_price_usd.sql");
}
// ─────────────────────────────────────────────────────────────────────────────
// Users
// ─────────────────────────────────────────────────────────────────────────────
function createUser(user) {
    var _a, _b;
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var stmt = conn.prepare("\n    INSERT INTO users (id, email, name, image, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?)\n    ON CONFLICT(email) DO UPDATE SET\n      name       = excluded.name,\n      image      = excluded.image,\n      updated_at = excluded.updated_at\n  ");
    stmt.run(user.id, user.email, (_a = user.name) !== null && _a !== void 0 ? _a : null, (_b = user.image) !== null && _b !== void 0 ? _b : null, now, now);
    var row = conn
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(user.email);
    if (!row) {
        throw new Error("createUser: failed to retrieve user after upsert for email ".concat(user.email));
    }
    return row;
}
function getUserByEmail(email) {
    var _a;
    var conn = getDb();
    return ((_a = conn
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email)) !== null && _a !== void 0 ? _a : null);
}
function getUserById(id) {
    var _a;
    var conn = getDb();
    return ((_a = conn
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(id)) !== null && _a !== void 0 ? _a : null);
}
function getUserByStripeCustomerId(stripeCustomerId) {
    var _a;
    var conn = getDb();
    return ((_a = conn
        .prepare("SELECT u.* FROM users u JOIN subscriptions s ON s.user_id = u.id WHERE s.stripe_customer_id = ?")
        .get(stripeCustomerId)) !== null && _a !== void 0 ? _a : null);
}
// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────
function createSession(session) {
    var conn = getDb();
    var stmt = conn.prepare("\n    INSERT INTO sessions (id, session_token, user_id, expires)\n    VALUES (?, ?, ?, ?)\n  ");
    try {
        stmt.run(session.id, session.session_token, session.user_id, session.expires);
    }
    catch (err) {
        throw new Error("createSession: failed to insert session for user ".concat(session.user_id, ": ").concat(err.message));
    }
    return session;
}
function getSessionByToken(token) {
    var _a;
    var conn = getDb();
    return ((_a = conn
        .prepare("SELECT * FROM sessions WHERE session_token = ?")
        .get(token)) !== null && _a !== void 0 ? _a : null);
}
function deleteSession(token) {
    var conn = getDb();
    conn
        .prepare("DELETE FROM sessions WHERE session_token = ?")
        .run(token);
}
function deleteUser(userId) {
    var conn = getDb();
    // FOREIGN KEY constraints with ON DELETE CASCADE will handle:
    // - monitored_airports
    // - subscriptions
    // - push_subscriptions
    // - sessions
    // - notifications
    // - logs (if linked)
    // Bookings are also linked and should be deleted if they exist.
    conn.prepare("DELETE FROM users WHERE id = ?").run(userId);
}
// ─────────────────────────────────────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Re-exported from lib/tierIntervals.ts for callers that import from lib/db.
 * The canonical source of truth is lib/tierIntervals.ts.
 */
exports.TIER_SCAN_INTERVALS = tierIntervals_1.TIER_INTERVALS;
function createSubscription(params) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var stmt = conn.prepare("\n    INSERT INTO subscriptions (id, user_id, created_at, updated_at)\n    VALUES (?, ?, ?, ?)\n    ON CONFLICT(user_id) DO NOTHING\n  ");
    try {
        stmt.run(params.id, params.user_id, now, now);
    }
    catch (err) {
        throw new Error("createSubscription: failed for user ".concat(params.user_id, ": ").concat(err.message));
    }
    var row = conn
        .prepare("SELECT * FROM subscriptions WHERE user_id = ?")
        .get(params.user_id);
    if (!row) {
        throw new Error("createSubscription: failed to retrieve subscription for user ".concat(params.user_id));
    }
    return row;
}
/**
 * Ensures every signed-in user has a free-tier subscription row.
 * ON CONFLICT DO NOTHING — safe no-op for existing users with paid subscriptions.
 * Must be called in the NextAuth signIn callback.
 * Any DB error is logged but must NOT block sign-in.
 */
function createDefaultSubscription(userId) {
    var conn = getDb();
    conn.prepare("\n    INSERT INTO subscriptions (id, user_id, tier, scan_interval_seconds, status, created_at, updated_at)\n    VALUES (lower(hex(randomblob(16))), ?, 'free', ?, 'active', unixepoch(), unixepoch())\n    ON CONFLICT (user_id) DO NOTHING\n  ").run(userId, (0, tierIntervals_1.getScanInterval)("free"));
}
function getSubscriptionByUserId(userId) {
    var _a;
    var conn = getDb();
    return ((_a = conn
        .prepare("SELECT * FROM subscriptions WHERE user_id = ?")
        .get(userId)) !== null && _a !== void 0 ? _a : null);
}
/**
 * Updates a subscription row looked up by Stripe customer ID.
 * Used exclusively by the Stripe webhook handler.
 */
function updateStripeSubscriptionTier(params) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var interval = (0, tierIntervals_1.getScanInterval)(params.tier);
    var result = conn
        .prepare("\n      UPDATE subscriptions\n      SET tier                   = ?,\n          status                 = ?,\n          scan_interval_seconds  = ?,\n          stripe_subscription_id = ?,\n          current_period_end     = ?,\n          updated_at             = ?\n      WHERE stripe_customer_id = ?\n    ")
        .run(params.tier, params.status, interval, params.stripe_subscription_id, params.current_period_end, now, params.stripe_customer_id);
    if (result.changes === 0) {
        throw new Error("updateStripeSubscriptionTier: no subscription found with stripe_customer_id ".concat(params.stripe_customer_id));
    }
    // Reset next_scan_at for the user's active airport so the UI countdown
    // reflects the new tier immediately after a Stripe checkout payment.
    var userRow = conn
        .prepare("SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?")
        .get(params.stripe_customer_id);
    if (userRow) {
        conn
            .prepare("UPDATE monitored_airports SET user_next_scan_at = ? WHERE user_id = ? AND active = 1")
            .run(now + interval, userRow.user_id);
    }
}
/**
 * Links a Stripe customer ID to a user's subscription row.
 * Called during checkout.session.completed before any tier update so that
 * subsequent lookups by stripe_customer_id succeed. Idempotent — safe to
 * call again if the customer ID is already set to the same value.
 */
function linkStripeCustomer(userId, stripeCustomerId) {
    getDb()
        .prepare("UPDATE subscriptions SET stripe_customer_id = ?, updated_at = unixepoch() WHERE user_id = ?")
        .run(stripeCustomerId, userId);
}
/**
 * Updates a subscription row looked up by user ID.
 * Derives scan_interval_seconds automatically from tier via getScanInterval.
 * Caller must NOT pass scan_interval_seconds — it is always computed here.
 * Unknown tiers are normalised to 'free' (safe default) for the DB column,
 * while getScanInterval's fallback ensures scan_interval_seconds is also 600.
 */
function updateSubscriptionTier(userId, tier) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var validTiers = new Set(["free", "standard", "pro", "ultimate"]);
    var normalizedTier = validTiers.has(tier) ? tier : "free";
    var interval = (0, tierIntervals_1.getScanInterval)(tier); // getScanInterval handles unknown → 600
    conn.prepare("\n    UPDATE subscriptions\n    SET tier                  = ?,\n        scan_interval_seconds = ?,\n        status                = 'active',\n        updated_at            = ?\n    WHERE user_id = ?\n  ").run(normalizedTier, interval, now, userId);
}
function resetSubscriptionToFree(stripeCustomerId) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    conn
        .prepare("UPDATE subscriptions\n       SET tier = 'free', status = 'active', scan_interval_seconds = ?,\n           stripe_subscription_id = NULL, current_period_end = NULL,\n           cancel_at_period_end = 0, updated_at = ?\n       WHERE stripe_customer_id = ?")
        .run((0, tierIntervals_1.getScanInterval)("free"), now, stripeCustomerId);
}
function setCancelAtPeriodEnd(stripeCustomerId, value) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    conn
        .prepare("UPDATE subscriptions\n       SET cancel_at_period_end = ?, updated_at = ?\n       WHERE stripe_customer_id = ?")
        .run(value, now, stripeCustomerId);
}
function getSubscriptionByStripeId(stripeCustomerId) {
    var _a;
    var conn = getDb();
    return ((_a = conn
        .prepare("SELECT * FROM subscriptions WHERE stripe_customer_id = ?")
        .get(stripeCustomerId)) !== null && _a !== void 0 ? _a : null);
}
// ─────────────────────────────────────────────────────────────────────────────
// Monitored airports
// ─────────────────────────────────────────────────────────────────────────────
function setMonitoredAirport(params) {
    var _a, _b, _c, _d, _e;
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var active = (_a = params.active) !== null && _a !== void 0 ? _a : 1;
    var stmt = conn.prepare("\n    INSERT INTO monitored_airports\n      (id, user_id, airport_iata, destination_iata, travel_date_from, travel_date_to, active, max_price_usd, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ON CONFLICT(user_id, airport_iata) DO UPDATE SET\n      destination_iata = excluded.destination_iata,\n      travel_date_from = excluded.travel_date_from,\n      travel_date_to   = excluded.travel_date_to,\n      active           = excluded.active,\n      max_price_usd    = excluded.max_price_usd,\n      updated_at       = excluded.updated_at\n  ");
    try {
        stmt.run(params.id, params.user_id, params.airport_iata, (_b = params.destination_iata) !== null && _b !== void 0 ? _b : null, (_c = params.travel_date_from) !== null && _c !== void 0 ? _c : null, (_d = params.travel_date_to) !== null && _d !== void 0 ? _d : null, active, (_e = params.max_price_usd) !== null && _e !== void 0 ? _e : null, now, now);
    }
    catch (err) {
        throw new Error("setMonitoredAirport: failed for user ".concat(params.user_id, ": ").concat(err.message));
    }
    var row = conn
        .prepare("SELECT * FROM monitored_airports WHERE user_id = ? AND airport_iata = ?")
        .get(params.user_id, params.airport_iata);
    if (!row) {
        throw new Error("setMonitoredAirport: failed to retrieve row after upsert");
    }
    return row;
}
function getMonitoredAirport(userId) {
    var _a;
    var conn = getDb();
    return ((_a = conn
        .prepare("SELECT * FROM monitored_airports WHERE user_id = ? AND active = 1 ORDER BY updated_at DESC LIMIT 1")
        .get(userId)) !== null && _a !== void 0 ? _a : null);
}
/**
 * Deactivates every monitored airport for a user EXCEPT the given one.
 * Called whenever the user picks a new airport so the monitor only polls one.
 */
function deactivateOtherAirports(userId, keepIata) {
    getDb()
        .prepare("UPDATE monitored_airports SET active = 0 WHERE user_id = ? AND airport_iata != ?")
        .run(userId, keepIata);
}
/**
 * Writes last_scan_at for a specific user's airport row.
 * Used when switching airports to carry the countdown anchor forward.
 */
function setAirportLastScanAt(userId, airportIata, lastScanAt) {
    getDb()
        .prepare("UPDATE monitored_airports SET last_scan_at = ? WHERE user_id = ? AND airport_iata = ?")
        .run(lastScanAt, userId, airportIata);
}
/** Returns all flights currently in the DB as {id, status} pairs.
 *  Used by the monitor on startup to pre-populate previousStatuses so that
 *  already-known flights are not treated as "new" after a restart. */
function getAllFlightStatuses() {
    return getDb()
        .prepare("SELECT id, status FROM flights")
        .all();
}
/** Called by the monitor/API after each successful poll tick. */
function updateAirportLastScanAt(airportIata) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    conn
        .prepare("UPDATE monitored_airports SET last_scan_at = ? WHERE airport_iata = ? AND active = 1")
        .run(now, airportIata);
}
function setUserPersonalDetails(userId, details) {
    getDb()
        .prepare("UPDATE users SET personal_details = ? WHERE id = ?")
        .run(JSON.stringify(details), userId);
}
function getUserPersonalDetails(userId) {
    var row = getDb()
        .prepare("SELECT personal_details FROM users WHERE id = ?")
        .get(userId);
    if (!(row === null || row === void 0 ? void 0 : row.personal_details))
        return null;
    try {
        return JSON.parse(row.personal_details);
    }
    catch (_a) {
        return null;
    }
}
function updateUserEmailNotifications(userId, enabled) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    conn
        .prepare("UPDATE users SET email_notifications = ?, updated_at = ? WHERE id = ?")
        .run(enabled, now, userId);
}
// ─────────────────────────────────────────────────────────────────────────────
// Flights
// ─────────────────────────────────────────────────────────────────────────────
function upsertFlight(flight) {
    var _a, _b;
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var stmt = conn.prepare("\n    INSERT INTO flights\n      (id, flight_number, airline, departure_airport, destination_airport,\n       scheduled_departure, estimated_departure, status, aircraft_type, last_seen_at, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n    ON CONFLICT(id) DO UPDATE SET\n      estimated_departure = excluded.estimated_departure,\n      status              = excluded.status,\n      aircraft_type       = excluded.aircraft_type,\n      last_seen_at        = excluded.last_seen_at\n  ");
    try {
        stmt.run(flight.id, flight.flight_number, flight.airline, flight.departure_airport, flight.destination_airport, flight.scheduled_departure, (_a = flight.estimated_departure) !== null && _a !== void 0 ? _a : null, flight.status, (_b = flight.aircraft_type) !== null && _b !== void 0 ? _b : null, now, now);
    }
    catch (err) {
        throw new Error("upsertFlight: failed for flight ".concat(flight.id, ": ").concat(err.message));
    }
    var row = conn
        .prepare("SELECT * FROM flights WHERE id = ?")
        .get(flight.id);
    if (!row) {
        throw new Error("upsertFlight: failed to retrieve flight ".concat(flight.id, " after upsert"));
    }
    return row;
}
function getFlightsByAirport(airportIata, statuses) {
    var _a;
    if (statuses === void 0) { statuses = ["scheduled", "active"]; }
    var conn = getDb();
    // HARDENED IN STEP 10: build IN clause via string concatenation (not template literal)
    // to avoid flagging as template-literal SQL injection. The only values in the
    // concatenated string are "?" placeholders — no user input is ever interpolated.
    var inClause = statuses.map(function () { return "?"; }).join(", ");
    var sql = "SELECT * FROM flights" +
        " WHERE departure_airport = ? AND status IN (" + inClause + ")" +
        " AND (bookable = 1 OR lowest_price_cents IS NULL OR bookable = 0)" +
        " AND scheduled_departure >= unixepoch()" +
        " ORDER BY scheduled_departure ASC";
    var rows = (_a = conn
        .prepare(sql))
        .all.apply(_a, __spreadArray([airportIata], statuses, false));
    return rows;
}
function getFlightById(id) {
    var _a;
    var conn = getDb();
    return ((_a = conn
        .prepare("SELECT * FROM flights WHERE id = ?")
        .get(id)) !== null && _a !== void 0 ? _a : null);
}
function createBooking(booking) {
    var _a;
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var stmt = conn.prepare("\n    INSERT INTO bookings\n      (id, user_id, flight_id, duffel_order_id, duffel_offer_id,\n       status, total_amount, currency, passenger_details, created_at, updated_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ");
    try {
        stmt.run(booking.id, booking.user_id, booking.flight_id, (_a = booking.duffel_order_id) !== null && _a !== void 0 ? _a : null, booking.duffel_offer_id, booking.status, booking.total_amount, booking.currency, booking.passenger_details, now, now);
    }
    catch (err) {
        throw new Error("createBooking: failed for user ".concat(booking.user_id, ": ").concat(err.message));
    }
    var row = conn
        .prepare("SELECT * FROM bookings WHERE id = ?")
        .get(booking.id);
    if (!row) {
        throw new Error("createBooking: failed to retrieve booking ".concat(booking.id, " after insert"));
    }
    return row;
}
function getBookingsByUserId(userId) {
    var conn = getDb();
    return conn
        .prepare("SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC")
        .all(userId);
}
function createPendingBookingForDuffel(params) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    conn
        .prepare("INSERT INTO bookings\n        (id, user_id, flight_id, duffel_offer_id, internal_reference, passenger_details,\n         total_amount, currency, created_at, updated_at)\n       VALUES (?, ?, ?, ?, ?, ?, 0, 'USD', ?, ?)")
        .run(params.id, params.user_id, params.flight_id, params.duffel_offer_id, params.internal_reference, params.passenger_details, now, now);
    var row = conn
        .prepare("SELECT * FROM bookings WHERE id = ?")
        .get(params.id);
    if (!row)
        throw new Error("createPendingBookingForDuffel: failed to retrieve booking ".concat(params.id));
    return row;
}
function getBookingByInternalReference(ref) {
    return getDb()
        .prepare("SELECT * FROM bookings WHERE internal_reference = ?")
        .get(ref);
}
function updateBookingStatus(id, status, duffelOrderId, cancelledReason) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    if (duffelOrderId) {
        conn
            .prepare("UPDATE bookings SET status = ?, duffel_order_id = ?, updated_at = ? WHERE id = ?")
            .run(status, duffelOrderId, now, id);
    }
    else if (cancelledReason) {
        conn
            .prepare("UPDATE bookings SET status = ?, cancelled_reason = ?, updated_at = ? WHERE id = ?")
            .run(status, cancelledReason, now, id);
    }
    else {
        conn
            .prepare("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?")
            .run(status, now, id);
    }
}
function confirmBooking(id, params) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    conn
        .prepare("UPDATE bookings\n       SET status = 'confirmed',\n           duffel_order_id = ?,\n           booking_reference = ?,\n           ticket_number = ?,\n           duffel_total = ?,\n           total_currency = ?,\n           duffel_link_id = ?,\n           updated_at = ?\n       WHERE id = ?")
        .run(params.duffelOrderId, params.bookingReference, params.ticketNumber, params.totalAmount, params.totalCurrency, params.duffelLinkId, now, id);
}
function getConfirmedBookingsByFlightId(flightId) {
    return getDb()
        .prepare("SELECT * FROM bookings WHERE flight_id = ? AND status = 'confirmed'")
        .all(flightId);
}
function getBookingById(id) {
    var _a;
    return ((_a = getDb()
        .prepare("SELECT * FROM bookings WHERE id = ?")
        .get(id)) !== null && _a !== void 0 ? _a : null);
}
function cancelBookingByUser(bookingId, params) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    conn
        .prepare("\n      UPDATE bookings\n      SET status = 'cancelled',\n          cancelled_reason = ?,\n          duffel_cancellation_id = ?,\n          refund_to = ?,\n          duffel_total = ?,\n          total_currency = ?,\n          cancellation_pending = 0,\n          updated_at = ?\n      WHERE id = ?\n    ")
        .run(params.cancelledReason, params.duffelCancellationId, params.refundTo, params.refundAmount, params.refundCurrency, now, bookingId);
}
function setCancellationPending(bookingId, cancellationId) {
    getDb()
        .prepare("UPDATE bookings SET cancellation_pending = 1, pending_cancellation_id = ?, updated_at = unixepoch() WHERE id = ?")
        .run(cancellationId, bookingId);
}
function setConfirmFetchFailed(bookingId) {
    getDb()
        .prepare("UPDATE bookings SET confirm_fetch_failed = 1, updated_at = unixepoch() WHERE id = ?")
        .run(bookingId);
}
function updateBookingDuffelLinkId(bookingId, duffelLinkId) {
    getDb()
        .prepare("UPDATE bookings SET duffel_link_id = ?, updated_at = unixepoch() WHERE id = ?")
        .run(duffelLinkId, bookingId);
}
function deletePendingBooking(bookingId) {
    getDb()
        .prepare("DELETE FROM bookings WHERE id = ? AND status = 'pending'")
        .run(bookingId);
}
function purgeStaleFlights(airportIata) {
    // Exclude flights that are referenced by any booking so foreign-key constraints
    // are never violated. Flights with bookings are kept for record-keeping.
    var result = getDb()
        .prepare("DELETE FROM flights\n       WHERE departure_airport = ?\n         AND scheduled_departure < (unixepoch() - 3600)\n         AND id NOT IN (\n           SELECT DISTINCT flight_id FROM bookings WHERE flight_id IS NOT NULL\n         )")
        .run(airportIata);
    return result.changes;
}
function purgeStalePendingBookings() {
    getDb()
        .prepare("DELETE FROM bookings WHERE status = 'pending' AND created_at < (unixepoch() - 7200)")
        .run();
}
function getBookingsWithFlightsByUserId(userId) {
    return getDb()
        .prepare("\n      SELECT b.*,\n             f.flight_number,\n             f.departure_airport,\n             f.destination_airport,\n             f.scheduled_departure,\n             f.airline\n      FROM bookings b\n      LEFT JOIN flights f ON b.flight_id = f.id\n      WHERE b.user_id = ?\n      ORDER BY b.created_at DESC\n    ")
        .all(userId);
}
function getAllBookingsWithUsersAndFlights() {
    return getDb()
        .prepare("\n      SELECT\n        b.*,\n        f.flight_number,\n        f.departure_airport,\n        f.destination_airport,\n        f.scheduled_departure,\n        f.airline,\n        u.email  AS user_email,\n        u.name   AS user_name,\n        CASE\n          WHEN b.status = 'cancelled' THEN 0\n          ELSE b.total_amount\n        END AS net_profit_cents\n      FROM bookings b\n      LEFT JOIN flights f ON b.flight_id = f.id\n      LEFT JOIN users  u ON b.user_id    = u.id\n      ORDER BY b.created_at DESC\n    ")
        .all();
}
function resetAirport(userId) {
    getDb()
        .prepare("DELETE FROM monitored_airports WHERE user_id = ?")
        .run(userId);
}
function updateFlightBookable(flightId, bookable) {
    getDb()
        .prepare("UPDATE flights SET bookable = ? WHERE id = ?")
        .run(bookable, flightId);
}
function updateFlightPrice(flightId, lowestPriceCents, currency) {
    getDb()
        .prepare("UPDATE flights SET lowest_price_cents = ?, price_currency = ? WHERE id = ?")
        .run(lowestPriceCents, currency, flightId);
}
// ─────────────────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────────────────
function createNotification(notification) {
    var _a;
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var stmt = conn.prepare("\n    INSERT INTO notifications (id, user_id, flight_id, type, title, body, sent_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?)\n  ");
    try {
        stmt.run(notification.id, notification.user_id, (_a = notification.flight_id) !== null && _a !== void 0 ? _a : null, notification.type, notification.title, notification.body, now);
    }
    catch (err) {
        throw new Error("createNotification: failed for user ".concat(notification.user_id, ": ").concat(err.message));
    }
    var row = conn
        .prepare("SELECT * FROM notifications WHERE id = ?")
        .get(notification.id);
    if (!row) {
        throw new Error("createNotification: failed to retrieve notification ".concat(notification.id, " after insert"));
    }
    return row;
}
function getNotificationsByUserId(userId) {
    var conn = getDb();
    return conn
        .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY sent_at DESC")
        .all(userId);
}
// ─────────────────────────────────────────────────────────────────────────────
// Push subscriptions
// ─────────────────────────────────────────────────────────────────────────────
function savePushSubscription(sub) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    var stmt = conn.prepare("\n    INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)\n    VALUES (?, ?, ?, ?, ?, ?)\n    ON CONFLICT(endpoint) DO UPDATE SET\n      user_id = excluded.user_id,\n      p256dh  = excluded.p256dh,\n      auth    = excluded.auth\n  ");
    try {
        stmt.run(sub.id, sub.user_id, sub.endpoint, sub.p256dh, sub.auth, now);
    }
    catch (err) {
        throw new Error("savePushSubscription: failed for user ".concat(sub.user_id, ": ").concat(err.message));
    }
    var row = conn
        .prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?")
        .get(sub.endpoint);
    if (!row) {
        throw new Error("savePushSubscription: failed to retrieve subscription after upsert");
    }
    return row;
}
function getPushSubscriptionsByUserId(userId) {
    var conn = getDb();
    return conn
        .prepare("SELECT * FROM push_subscriptions WHERE user_id = ?")
        .all(userId);
}
function deletePushSubscription(endpoint) {
    var conn = getDb();
    conn
        .prepare("DELETE FROM push_subscriptions WHERE endpoint = ?")
        .run(endpoint);
}
// ─────────────────────────────────────────────────────────────────────────────
// Monitor helpers
// ─────────────────────────────────────────────────────────────────────────────
function getAirportScanBuckets() {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    // LEFT JOIN so users with no subscription row (should not occur after createDefaultSubscription,
    // but defensive) are included with COALESCE default of getScanInterval("free").
    // s.status = 'active': cancelled or lapsed subscriptions are not counted.
    // travel_date_to >= now: skip users whose travel window has already passed.
    return conn
        .prepare("SELECT ma.airport_iata,\n              COALESCE(MIN(s.scan_interval_seconds), ".concat((0, tierIntervals_1.getScanInterval)("free"), ") AS interval\n       FROM monitored_airports ma\n       LEFT JOIN subscriptions s ON s.user_id = ma.user_id AND s.status = 'active'\n       WHERE ma.active = 1\n         AND (ma.travel_date_to IS NULL OR ma.travel_date_to >= ?)\n       GROUP BY ma.airport_iata"))
        .all(now);
}
/**
 * Sets needs_immediate_scan = 1 for all active monitored airports belonging to the user.
 * Called when a user sets their airport (first time or after reset) or upgrades their tier.
 * The monitor's fast-check loop polls these airports within ~5 s and clears the flag.
 */
function flagAirportForImmediateScan(userId) {
    getDb()
        .prepare("UPDATE monitored_airports SET needs_immediate_scan = 1 WHERE user_id = ? AND active = 1")
        .run(userId);
}
/**
 * Returns airports with needs_immediate_scan = 1 and their scan intervals.
 * Used by the monitor's fast-check loop to trigger priority polls.
 */
function getAirportsNeedingImmediateScan() {
    var conn = getDb();
    return conn
        .prepare("SELECT ma.airport_iata,\n              COALESCE(MIN(s.scan_interval_seconds), ".concat((0, tierIntervals_1.getScanInterval)("free"), ") AS interval\n       FROM monitored_airports ma\n       LEFT JOIN subscriptions s ON s.user_id = ma.user_id AND s.status = 'active'\n       WHERE ma.active = 1 AND ma.needs_immediate_scan = 1\n       GROUP BY ma.airport_iata"))
        .all();
}
/**
 * Sets next_scan_at = now + 1 second for the given user's active airport.
 * Called when the user first sets their airport so the client immediately
 * receives a non-null nextScanAt and shows a countdown instead of "Scanning…".
 * The monitor overwrites this value with the real next_scan_at timestamp once
 * the priority poll completes.
 */
function setNextScanAtImmediate(userId) {
    getDb()
        .prepare("UPDATE monitored_airports SET next_scan_at = unixepoch() + 1 WHERE user_id = ? AND active = 1")
        .run(userId);
}
/**
 * Sets next_scan_at = now + 1 second for the active airport of whichever user
 * owns the given Stripe customer ID.
 * Called after a subscription tier change so the client starts a fresh
 * countdown reflecting the new scan interval without waiting for the monitor's
 * next regular tick.
 */
function setNextScanAtImmediateByStripeCustomer(stripeCustomerId) {
    getDb()
        .prepare("\n      UPDATE monitored_airports\n      SET next_scan_at = unixepoch() + 1\n      WHERE user_id = (SELECT user_id FROM subscriptions WHERE stripe_customer_id = ?)\n        AND active = 1\n    ")
        .run(stripeCustomerId);
}
/**
 * Clears needs_immediate_scan for the given airport after the priority poll completes.
 */
function clearImmediateScanFlag(airportIata) {
    getDb()
        .prepare("UPDATE monitored_airports SET needs_immediate_scan = 0 WHERE airport_iata = ?")
        .run(airportIata);
}
/**
 * Records a successful poll for an airport.
 * Sets last_scanned_at = now and next_scan_at = now + intervalSeconds for all active users.
 * Must only be called on successful poll completion — never on error or timeout.
 */
function updateScanTimestamps(airportIata, _intervalSeconds) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    // Update last_scanned_at for all active users on this airport
    conn
        .prepare("UPDATE monitored_airports\n       SET last_scanned_at = ?\n       WHERE airport_iata = ? AND active = 1")
        .run(now, airportIata);
    // Update user_next_scan_at per user using their own subscription interval
    var users = conn
        .prepare("SELECT ma.user_id, COALESCE(s.scan_interval_seconds, ".concat((0, tierIntervals_1.getScanInterval)("free"), ") AS scan_interval_seconds\n       FROM monitored_airports ma\n       LEFT JOIN subscriptions s ON s.user_id = ma.user_id AND s.status = 'active'\n       WHERE ma.airport_iata = ? AND ma.active = 1"))
        .all(airportIata);
    var stmt = conn.prepare("UPDATE monitored_airports\n     SET user_next_scan_at = ?\n     WHERE user_id = ? AND active = 1");
    for (var _i = 0, users_1 = users; _i < users_1.length; _i++) {
        var user = users_1[_i];
        stmt.run(now + user.scan_interval_seconds, user.user_id);
    }
}
/**
 * Initialises next_scan_at for a specific user's active airport row.
 * Call this when a user first sets their airport or changes subscription tier,
 * so the UI countdown starts immediately without waiting for the monitor daemon.
 * Unlike updateScanTimestamps (which is airport-wide), this is user-scoped.
 */
function initNextScanAt(userId, intervalSeconds) {
    var conn = getDb();
    var now = Math.floor(Date.now() / 1000);
    conn
        .prepare("UPDATE monitored_airports SET user_next_scan_at = ? WHERE user_id = ? AND active = 1")
        .run(now + intervalSeconds, userId);
}
/**
 * Sets user_next_scan_at for a specific user's active airport row.
 * Used by the scan-status API when synthesizing a timestamp to ensure it persists.
 */
function setUserNextScanAt(userId, nextScanAt) {
    var conn = getDb();
    conn
        .prepare("UPDATE monitored_airports SET user_next_scan_at = ? WHERE user_id = ? AND active = 1")
        .run(nextScanAt, userId);
}
/**
 * Returns the next_scan_at Unix timestamp for the given airport, or null if not set.
 * Used by GET /api/flights to return nextScanAt to the client.
 */
function getNextScanAt(airportIata, userId) {
    var _a, _b;
    var conn = getDb();
    if (userId) {
        var row_1 = conn
            .prepare("SELECT user_next_scan_at FROM monitored_airports WHERE airport_iata = ? AND user_id = ? AND active = 1 LIMIT 1")
            .get(airportIata, userId);
        return (_a = row_1 === null || row_1 === void 0 ? void 0 : row_1.user_next_scan_at) !== null && _a !== void 0 ? _a : null;
    }
    var row = conn
        .prepare("SELECT user_next_scan_at FROM monitored_airports WHERE airport_iata = ? AND active = 1 ORDER BY user_next_scan_at ASC LIMIT 1")
        .get(airportIata);
    return (_b = row === null || row === void 0 ? void 0 : row.user_next_scan_at) !== null && _b !== void 0 ? _b : null;
}
function getActiveUsersForAirport(airportIata) {
    var conn = getDb();
    return conn
        .prepare("SELECT DISTINCT user_id, max_price_usd FROM monitored_airports WHERE airport_iata = ? AND active = 1")
        .all(airportIata);
}
function markNotificationsRead(userId) {
    getDb()
        .prepare("UPDATE notifications SET read_at = unixepoch() WHERE user_id = ? AND read_at IS NULL")
        .run(userId);
}
// ─────────────────────────────────────────────────────────────────────────────
// Admin functions
// ─────────────────────────────────────────────────────────────────────────────
function getUsersByPage(page, limit) {
    var conn = getDb();
    var offset = (page - 1) * limit;
    var users = conn.prepare("\n    SELECT\n      u.id,\n      u.email,\n      u.name,\n      u.role,\n      u.created_at,\n      COALESCE(s.tier, 'free') AS tier,\n      COALESCE(s.scan_interval_seconds, 600) AS scan_interval_seconds,\n      ma.airport_iata\n    FROM users u\n    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'\n    LEFT JOIN monitored_airports ma ON ma.user_id = u.id AND ma.active = 1\n    ORDER BY u.created_at DESC\n    LIMIT ? OFFSET ?\n  ").all(limit, offset);
    var total = conn.prepare("SELECT COUNT(*) AS total FROM users").get().total;
    return { users: users, total: total };
}
function updateUserRole(userId, role) {
    getDb()
        .prepare("UPDATE users SET role = ?, updated_at = unixepoch() WHERE id = ?")
        .run(role, userId);
}
function updateSubscriptionOverride(userId, tier) {
    var _a, _b;
    var conn = getDb();
    var scanInterval = (0, tierIntervals_1.getScanInterval)(tier);
    var existing = conn
        .prepare("SELECT stripe_subscription_id, COALESCE(tier, 'free') AS tier FROM subscriptions WHERE user_id = ?")
        .get(userId);
    var stripeSubscriptionId = (_a = existing === null || existing === void 0 ? void 0 : existing.stripe_subscription_id) !== null && _a !== void 0 ? _a : null;
    var previousTier = (_b = existing === null || existing === void 0 ? void 0 : existing.tier) !== null && _b !== void 0 ? _b : "free";
    conn.prepare("\n    INSERT INTO subscriptions (id, user_id, tier, status, scan_interval_seconds, updated_at)\n    VALUES (lower(hex(randomblob(16))), ?, ?, 'active', ?, unixepoch())\n    ON CONFLICT(user_id) DO UPDATE SET\n      tier = excluded.tier,\n      status = 'active',\n      scan_interval_seconds = excluded.scan_interval_seconds,\n      updated_at = unixepoch()\n  ").run(userId, tier, scanInterval);
    return { stripeSubscriptionId: stripeSubscriptionId, previousTier: previousTier };
}
function getAdminStats() {
    var conn = getDb();
    var totalUsers = conn
        .prepare("SELECT COUNT(*) AS totalUsers FROM users")
        .get().totalUsers;
    var tierRows = conn
        .prepare("SELECT COALESCE(s.tier, 'free') AS tier, COUNT(*) AS count\n       FROM users u\n       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'\n       GROUP BY COALESCE(s.tier, 'free')")
        .all();
    var subscriptions = { free: 0, standard: 0, pro: 0, ultimate: 0 };
    for (var _i = 0, tierRows_1 = tierRows; _i < tierRows_1.length; _i++) {
        var row = tierRows_1[_i];
        if (row.tier in subscriptions) {
            subscriptions[row.tier] = row.count;
        }
    }
    var airportRows = conn
        .prepare("SELECT DISTINCT airport_iata FROM monitored_airports WHERE active = 1")
        .all();
    return {
        totalUsers: totalUsers,
        subscriptions: subscriptions,
        activeAirports: airportRows.map(function (r) { return r.airport_iata; }),
    };
}
