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
  ['onboarding_history', "ALTER TABLE users ADD COLUMN onboarding_history TEXT DEFAULT '[]'"],
  ['current_gesture', 'ALTER TABLE users ADD COLUMN current_gesture TEXT'],
  ['tier', "ALTER TABLE users ADD COLUMN tier TEXT DEFAULT 'free'"],
  ['height', 'ALTER TABLE users ADD COLUMN height REAL'],
  ['weight', 'ALTER TABLE users ADD COLUMN weight REAL'],
  ['target_calories', 'ALTER TABLE users ADD COLUMN target_calories INTEGER'],
  ['target_muscle', 'ALTER TABLE users ADD COLUMN target_muscle TEXT'],
  ['allergy', 'ALTER TABLE users ADD COLUMN allergy TEXT'],
  ['timetable', 'ALTER TABLE users ADD COLUMN timetable TEXT'],
  ['goal', 'ALTER TABLE users ADD COLUMN goal TEXT'],
  ['water_reminders_sent', 'ALTER TABLE users ADD COLUMN water_reminders_sent TEXT'],
  ['workout_reminded_date', 'ALTER TABLE users ADD COLUMN workout_reminded_date TEXT'],
  ['workout_acknowledged_date', 'ALTER TABLE users ADD COLUMN workout_acknowledged_date TEXT'],
];
for (const [column, sql] of userColumnMigrations) {
  if (!existingUserColumns.has(column)) db.exec(sql);
}

const existingCheckinColumns = new Set(db.prepare('PRAGMA table_info(checkins)').all().map((c) => c.name));
const checkinColumnMigrations = [
  ['photo_hash', 'ALTER TABLE checkins ADD COLUMN photo_hash TEXT'],
  ['gesture', 'ALTER TABLE checkins ADD COLUMN gesture TEXT'],
];
for (const [column, sql] of checkinColumnMigrations) {
  if (!existingCheckinColumns.has(column)) db.exec(sql);
}

// We no longer force activity = 'gym' on startup or insert so users can choose running/walking/cycling.

function getUserByPhone(phone) {
  return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function createUser(phone) {
  const info = db.prepare("INSERT INTO users (phone, activity) VALUES (?, NULL)").run(phone);
  return getUserById(info.lastInsertRowid);
}

function getOrCreateUser(phone) {
  const existing = getUserByPhone(phone);
  if (existing) return { user: existing, isNew: false };
  return { user: createUser(phone), isNew: true };
}

const USER_FIELDS = new Set([
  'name', 'language', 'activity', 'days_per_week', 'checkin_time', 'blocker_text',
  'vision_text', 'commitment_score', 'onboarding_history', 'current_gesture',
  'state', 'pending_checkin_id', 'deposit_status', 'started_at', 'day_count',
  'streak', 'missed_count', 'last_prompted_date', 'last_weekly_summary_date', 'poster_path',
  'tier', 'height', 'weight', 'target_calories', 'target_muscle', 'allergy',
  'timetable', 'goal', 'water_reminders_sent', 'workout_reminded_date', 'workout_acknowledged_date',
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

function createCheckin({ userId, date, description, photoRef, status, geminiReason, photoHash, gesture }) {
  const info = db.prepare(
    `INSERT INTO checkins (user_id, date, description, photo_ref, status, gemini_reason, photo_hash, gesture)
     VALUES (@userId, @date, @description, @photoRef, @status, @geminiReason, @photoHash, @gesture)`
  ).run({
    userId,
    date,
    description: description || null,
    photoRef: photoRef || null,
    status: status || 'pending',
    geminiReason: geminiReason || null,
    photoHash: photoHash || null,
    gesture: gesture || null,
  });
  return getCheckinById(info.lastInsertRowid);
}

function getCheckinById(id) {
  return db.prepare('SELECT * FROM checkins WHERE id = ?').get(id);
}

const CHECKIN_FIELDS = new Set(['description', 'photo_ref', 'status', 'gemini_reason', 'photo_hash', 'gesture']);

function updateCheckin(id, fields) {
  const keys = Object.keys(fields).filter((k) => CHECKIN_FIELDS.has(k));
  if (keys.length === 0) return getCheckinById(id);
  const setClause = keys.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE checkins SET ${setClause} WHERE id = @id`).run({ ...fields, id });
  return getCheckinById(id);
}

function getLastAcceptedCheckin(userId) {
  return db.prepare("SELECT * FROM checkins WHERE user_id = ? AND status = 'accepted' ORDER BY date DESC, id DESC LIMIT 1").get(userId);
}

function getCheckinByUserDate(userId, date) {
  return db.prepare('SELECT * FROM checkins WHERE user_id = ? AND date = ? ORDER BY id DESC LIMIT 1').get(userId, date);
}

function getCheckinsForUser(userId) {
  return db.prepare('SELECT * FROM checkins WHERE user_id = ? ORDER BY date ASC').all(userId);
}

function hasDuplicatePhotoHash(userId, hash) {
  if (!hash) return false;
  const row = db.prepare(
    "SELECT 1 FROM checkins WHERE user_id = ? AND photo_hash = ? AND status = 'accepted' LIMIT 1"
  ).get(userId, hash);
  return !!row;
}

function logNutrition({ userId, date, foodItem, weightG, calories, protein, carbs, fat }) {
  const info = db.prepare(
    `INSERT INTO nutrition_logs (user_id, date, food_item, weight_g, calories, protein, carbs, fat)
     VALUES (@userId, @date, @foodItem, @weightG, @calories, @protein, @carbs, @fat)`
  ).run({ userId, date, foodItem, weightG: weightG || null, calories, protein: protein || null, carbs: carbs || null, fat: fat || null });
  return info.lastInsertRowid;
}

function getNutritionLogsToday(userId, date) {
  return db.prepare('SELECT * FROM nutrition_logs WHERE user_id = ? AND date = ?').all(userId, date);
}

function logBurnedCalories({ userId, date, activityName, caloriesBurned }) {
  const info = db.prepare(
    `INSERT INTO burned_calories_logs (user_id, date, activity_name, calories_burned)
     VALUES (@userId, @date, @activityName, @caloriesBurned)`
  ).run({ userId, date, activityName, caloriesBurned });
  return info.lastInsertRowid;
}

function getBurnedCaloriesLogsToday(userId, date) {
  return db.prepare('SELECT * FROM burned_calories_logs WHERE user_id = ? AND date = ?').all(userId, date);
}

function saveChatMessage(userId, role, text) {
  db.prepare('INSERT INTO chat_messages (user_id, role, text) VALUES (?, ?, ?)').run(userId, role, text);
}

function getChatMessages(userId, limit = 15) {
  return db.prepare('SELECT role, text FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(userId, limit)
    .reverse();
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
  hasDuplicatePhotoHash,
  getLastAcceptedCheckin,
  logNutrition,
  getNutritionLogsToday,
  logBurnedCalories,
  getBurnedCaloriesLogsToday,
  saveChatMessage,
  getChatMessages,
};
