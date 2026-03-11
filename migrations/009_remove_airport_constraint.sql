-- Migration 009: Remove Gulf-only CHECK constraint from monitored_airports.
-- SQLite does not support DROP CONSTRAINT — the table must be recreated.
-- The old constraint was: CHECK (airport_iata IN ('DXB','AUH','DOH','BAH','KWI'))
-- The new constraint only validates IATA code length (3–4 chars).

CREATE TABLE IF NOT EXISTS monitored_airports_v2 (
  id               TEXT    NOT NULL PRIMARY KEY,
  user_id          TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  airport_iata     TEXT    NOT NULL CHECK (length(airport_iata) BETWEEN 3 AND 4),
  destination_iata TEXT,
  travel_date_from INTEGER,
  travel_date_to   INTEGER,
  active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  last_scan_at     INTEGER,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (user_id, airport_iata)
);

INSERT INTO monitored_airports_v2
  SELECT id, user_id, airport_iata, destination_iata,
         travel_date_from, travel_date_to, active,
         last_scan_at, created_at, updated_at
  FROM monitored_airports;

DROP TABLE monitored_airports;
ALTER TABLE monitored_airports_v2 RENAME TO monitored_airports;

CREATE INDEX IF NOT EXISTS idx_monitored_airports_user_id
  ON monitored_airports(user_id);
CREATE INDEX IF NOT EXISTS idx_monitored_airports_airport
  ON monitored_airports(airport_iata, active);
