-- Migration 015: Add user-specific next_scan_at to monitored_airports
-- This ensures timer persistence per user across sessions and logouts
ALTER TABLE monitored_airports ADD COLUMN user_next_scan_at INTEGER;
