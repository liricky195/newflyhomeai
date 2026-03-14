-- Add max_price_usd column to monitored_airports
-- This allows users to filter notifications by a maximum price.
ALTER TABLE monitored_airports ADD COLUMN max_price_usd INTEGER;
