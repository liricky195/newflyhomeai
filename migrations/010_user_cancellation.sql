-- Migration 010: User-initiated cancellation fields
ALTER TABLE bookings ADD COLUMN duffel_cancellation_id TEXT;
ALTER TABLE bookings ADD COLUMN refund_amount_cents INTEGER;
ALTER TABLE bookings ADD COLUMN refund_to TEXT;
ALTER TABLE bookings ADD COLUMN stripe_refund_id TEXT;
