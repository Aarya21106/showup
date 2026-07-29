const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'showup.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// CREATE TABLE IF NOT EXISTS above is a no-op against an already-created DB file, so
// columns added after someone's first run need to be patched in explicitly here.
const existingUserColumns = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
const userColumnMigrations = [
  ['vision_text', 'ALTER TABLE users ADD COLUMN vision_text TEXT'],
  ['commitment_score', 'ALTER TABLE users ADD COLUMN commitment_score INTEGER'],
];
for (const [column, sql] of userColumnMigrations) {
  if (!existingUserColumns.has(column)) db.exec(sql);
}

function getUserByPhone(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createUser(phone) {
  const info = db.prepare('INSERT INTO users (phone) VALUES (?)').run(phone);
  return getUserById(info.lastInsertRowid);
}

function getOrCreateUser(phone) {
  const existing = getUserByPhone(phone);
  if (existing) return { user: existing, isNew: false };
  return { user: createUser(phone), isNew: true };
}

const USER_FIELDS = new Set([
  'name', 'language', 'activity', 'days_per_week', 'checkin_time', 'blocker_text',
  'vision_text', 'commitment_score',
  'state', 'pending_checkin_id', 'deposit_status', 'started_at', 'day_count',
  'streak', 'missed_count', 'last_prompted_date', 'last_weekly_summary_date', 'poster_path',
]);

function updateUser(id, fields) {
  const keys = Object.keys(fields).filter((k) => USER_FIELDS.has(k));
  if (keys.length === 0) return getUserById(id);
  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE users SET ${setClause} WHERE id = @id`).run({ ...fields, id });
  return getUserById(id);
}

function getActiveUsers() {
  return db.prepare("SELECT * FROM users WHERE state IN ('ACTIVE', 'AWAITING_CHECKIN_FOLLOWUP')").all();
}

function getAllUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
}

function createCheckin({ userId, date, description, photoRef, status, geminiReason }) {
  const info = db.prepare(
    `INSERT INTO checkins (user_id, date, description, photo_ref, status, gemini_reason)
     VALUES (@userId, @date, @description, @photoRef, @status, @geminiReason)`
  ).run({
    userId,
    date,
    description: description || null,
    photoRef: photoRef || null,
    status: status || 'pending',
    geminiReason: geminiReason || null,
  });
  return getCheckinById(info.lastInsertRowid);
}

function getCheckinById(id) {
  return db.prepare('SELECT * FROM checkins WHERE id = ?').get(id);
}

const CHECKIN_FIELDS = new Set(['description', 'photo_ref', 'status', 'gemini_reason']);

function updateCheckin(id, fields) {
  const keys = Object.keys(fields).filter((k) => CHECKIN_FIELDS.has(k));
  if (keys.length === 0) return getCheckinById(id);
  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE checkins SET ${setClause} WHERE id = @id`).run({ ...fields, id });
  return getCheckinById(id);
}

function getCheckinByUserDate(userId, date) {
  return db.prepare('SELECT * FROM checkins WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1').get(userId, date);
}

function getCheckinsForUser(userId) {
  return db.prepare('SELECT * FROM checkins WHERE user_id = ? ORDER BY date ASC').all(userId);
}

module.exports = {
  db,
  getUserByPhone,
  getUserById,
  getOrCreateUser,
  updateUser,
  getActiveUsers,
  getAllUsers,
  createCheckin,
  getCheckinById,
  updateCheckin,
  getCheckinByUserDate,
  getCheckinsForUser,
};
