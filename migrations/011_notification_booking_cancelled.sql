-- Migration 011: Add booking_cancelled to notifications type CHECK constraint
-- SQLite does not support ALTER TABLE MODIFY CONSTRAINT, so we recreate the table.
CREATE TABLE IF NOT EXISTS notifications_new (
  id        TEXT    NOT NULL PRIMARY KEY,
  user_id   TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flight_id TEXT    REFERENCES flights(id) ON DELETE SET NULL,
  type      TEXT    NOT NULL
              CHECK (type IN ('new_flight','status_change','booking_confirmed','booking_failed','flight_cancelled','booking_cancelled')),
  title     TEXT    NOT NULL,
  body      TEXT    NOT NULL,
  sent_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  read_at   INTEGER
);

INSERT INTO notifications_new SELECT * FROM notifications;

DROP TABLE notifications;

ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read
  ON notifications(user_id, read_at);
