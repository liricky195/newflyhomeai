-- Migration 007: booking confirmation details + cancel reason
-- These are additive; run via safeAlter in lib/db.ts initDb().
-- This file is for documentation / manual rollout reference.

ALTER TABLE bookings ADD COLUMN booking_reference TEXT;
ALTER TABLE bookings ADD COLUMN ticket_number TEXT;
ALTER TABLE bookings ADD COLUMN cancelled_reason TEXT;

-- One-time: ensure rickygreenplanet@gmail.com is on DOH
UPDATE monitored_airports
  SET airport_iata = 'DOH'
  WHERE user_id = (SELECT id FROM users WHERE email = 'rickygreenplanet@gmail.com');
