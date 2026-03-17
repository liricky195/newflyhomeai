-- Add airport change cooldown tracking
ALTER TABLE users ADD COLUMN last_airport_change TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN airport_change_count INTEGER DEFAULT 0;

-- Create index for airport change tracking
CREATE INDEX idx_users_last_airport_change ON users(last_airport_change);
