CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  phone               TEXT UNIQUE NOT NULL,
  name                TEXT,
  language             TEXT DEFAULT 'en',
  activity            TEXT,
  days_per_week       INTEGER,
  checkin_time        TEXT,                 -- 'HH:MM' 24h, in the program timezone
  blocker_text        TEXT,
  vision_text         TEXT,
  commitment_score    INTEGER,
  state               TEXT NOT NULL DEFAULT 'ONBOARD_NAME',
  pending_checkin_id  INTEGER,
  deposit_status      TEXT NOT NULL DEFAULT 'unpaid',   -- unpaid | paid
  started_at          TEXT,                 -- YYYY-MM-DD, day 1 of the pledge
  day_count           INTEGER NOT NULL DEFAULT 0,
  streak              INTEGER NOT NULL DEFAULT 0,
  missed_count        INTEGER NOT NULL DEFAULT 0,
  last_prompted_date  TEXT,
  last_weekly_summary_date TEXT,
  poster_path         TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checkins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,              -- YYYY-MM-DD program date this checkin covers
  description   TEXT,
  photo_ref     TEXT,                       -- twilio media URL (or local test path)
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | failed | missed
  gemini_reason TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON checkins(user_id, date);
