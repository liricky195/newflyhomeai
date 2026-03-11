-- Migration 013: Add last_scanned_at and next_scan_at to monitored_airports
-- These columns are set by the monitor after each successful poll and read by
-- GET /api/flights to return nextScanAt to the client for server-anchored countdown.
ALTER TABLE monitored_airports ADD COLUMN last_scanned_at INTEGER;
ALTER TABLE monitored_airports ADD COLUMN next_scan_at INTEGER;
