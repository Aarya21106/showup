CREATE TABLE IF NOT EXISTS users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  phone               TEXT UNIQUE NOT NULL,
  name                TEXT,
  language            TEXT DEFAULT 'en',
  language_locked     TEXT DEFAULT NULL,
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
  current_gesture     TEXT,
  onboarding_history  TEXT DEFAULT '[]',
  tier                TEXT DEFAULT 'free',  -- free | pro_120 | pro_350
  height              REAL,
  weight              REAL,
  target_calories     INTEGER,
  target_muscle       TEXT,
  allergy             TEXT,
  timetable           TEXT,
  goal                TEXT,
  water_reminders_sent TEXT,
  workout_reminded_date TEXT,
  workout_acknowledged_date TEXT,
  profile_json        TEXT DEFAULT '{}',
  sleep_hours         REAL,
  injuries            TEXT,
  diet_restrictions   TEXT,
  commitment_text     TEXT,
  accountability_mode TEXT DEFAULT 'accountability',
  nutrition_plan      TEXT,
  nutrition_plan_source TEXT DEFAULT 'none',
  nutrition_photo_ref TEXT,
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
  photo_hash    TEXT,
  gesture       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_date ON checkins(user_id, date);

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,              -- YYYY-MM-DD
  food_item     TEXT NOT NULL,
  weight_g      REAL,
  calories      INTEGER NOT NULL,
  protein       REAL,
  carbs         REAL,
  fat           REAL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_nutrition_user_date ON nutrition_logs(user_id, date);

CREATE TABLE IF NOT EXISTS burned_calories_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  date            TEXT NOT NULL,            -- YYYY-MM-DD
  activity_name   TEXT NOT NULL,
  calories_burned INTEGER NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_burned_user_date ON burned_calories_logs(user_id, date);

CREATE TABLE IF NOT EXISTS chat_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  phone         TEXT,
  role          TEXT NOT NULL,              -- 'user' | 'model'
  text          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

CREATE TABLE IF NOT EXISTS daily_summaries (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  date                TEXT NOT NULL,
  summary             TEXT NOT NULL,
  follow_up_worthy    INTEGER DEFAULT 0,
  follow_up_date      TEXT,
  follow_up_resolved  INTEGER DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON daily_summaries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_followup ON daily_summaries(follow_up_date, follow_up_resolved);

CREATE TABLE IF NOT EXISTS outbox_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  phone       TEXT NOT NULL,
  body        TEXT NOT NULL,
  media_url   TEXT,
  delivered   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_outbox_user_delivered ON outbox_messages(user_id, delivered);

CREATE TABLE IF NOT EXISTS workout_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,              -- YYYY-MM-DD
  exercise_name TEXT NOT NULL,
  sets          INTEGER,
  reps          INTEGER,
  weight_kg     REAL,
  rpe           REAL,
  status        TEXT DEFAULT 'completed',   -- completed | modified | rescheduled | missed | cancelled_valid
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_date ON workout_logs(user_id, date);

CREATE TABLE IF NOT EXISTS weight_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  date          TEXT NOT NULL,              -- YYYY-MM-DD
  weight        REAL NOT NULL,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, date);

CREATE TABLE IF NOT EXISTS workout_schedule_overrides (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  original_date     TEXT NOT NULL,          -- YYYY-MM-DD
  rescheduled_date  TEXT NOT NULL,          -- YYYY-MM-DD
  session_name      TEXT NOT NULL,
  status            TEXT DEFAULT 'rescheduled', -- pending | rescheduled | completed | modified | cancelled_valid | missed
  reason            TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedule_overrides_user ON workout_schedule_overrides(user_id, rescheduled_date);

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  week_number         INTEGER,
  start_date          TEXT,                 -- YYYY-MM-DD
  end_date            TEXT,                 -- YYYY-MM-DD
  weight              REAL,
  workouts_completed  INTEGER,
  workouts_target     INTEGER,
  sleep_avg           REAL,
  recovery_rating     TEXT,
  summary             TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user ON weekly_reviews(user_id, week_number);


