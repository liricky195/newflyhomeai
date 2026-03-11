-- Migration 014: Add needs_immediate_scan flag to monitored_airports
-- Set to 1 by the API on two events:
--   1. A user's airport is set for the first time (or re-set after an admin reset).
--   2. A user upgrades their subscription tier.
-- The monitor's fast-check loop polls these airports within ~5 s and then clears
-- the flag so regular interval-based polling takes over.
ALTER TABLE monitored_airports ADD COLUMN needs_immediate_scan INTEGER NOT NULL DEFAULT 0;
