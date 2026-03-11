-- Migration 012: Duffel Links checkout fields
-- All columns are nullable so the migration is safe on existing rows.
-- Each ALTER is run individually so duplicate-column errors can be silently ignored.
-- SQLite does not support UNIQUE on ADD COLUMN so uniqueness is enforced via a separate index.
ALTER TABLE bookings ADD COLUMN internal_reference TEXT;
ALTER TABLE bookings ADD COLUMN duffel_total TEXT;
ALTER TABLE bookings ADD COLUMN total_currency TEXT;
ALTER TABLE bookings ADD COLUMN duffel_link_id TEXT;
ALTER TABLE bookings ADD COLUMN confirm_fetch_failed INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN cancellation_pending INTEGER DEFAULT 0;
ALTER TABLE bookings ADD COLUMN pending_cancellation_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uidx_bookings_internal_reference ON bookings (internal_reference) WHERE internal_reference IS NOT NULL;
