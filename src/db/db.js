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
  ['profile_json', "ALTER TABLE users ADD COLUMN profile_json TEXT DEFAULT '{}'"],
  ['cuisine_region', 'ALTER TABLE users ADD COLUMN cuisine_region TEXT'],
  ['fitness_app', 'ALTER TABLE users ADD COLUMN fitness_app TEXT'],
  ['weekly_goal_distance_km', 'ALTER TABLE users ADD COLUMN weekly_goal_distance_km REAL'],
  ['last_goal_review_date', 'ALTER TABLE users ADD COLUMN last_goal_review_date TEXT'],
  ['weekly_plan', "ALTER TABLE users ADD COLUMN weekly_plan TEXT"],
  ['firebase_uid', 'ALTER TABLE users ADD COLUMN firebase_uid TEXT'],
  ['experience_level', 'ALTER TABLE users ADD COLUMN experience_level TEXT'],
  ['supplements', 'ALTER TABLE users ADD COLUMN supplements TEXT'],
  ['diet_summary', 'ALTER TABLE users ADD COLUMN diet_summary TEXT'],
  ['workout_location', "ALTER TABLE users ADD COLUMN workout_location TEXT DEFAULT 'gym'"],
  ['home_equipment', "ALTER TABLE users ADD COLUMN home_equipment TEXT DEFAULT 'none'"],
  ['reminders_sent_log', "ALTER TABLE users ADD COLUMN reminders_sent_log TEXT DEFAULT '{}'"],
  ['sleep_hours', 'ALTER TABLE users ADD COLUMN sleep_hours REAL'],
  ['injuries', 'ALTER TABLE users ADD COLUMN injuries TEXT'],
  ['diet_restrictions', 'ALTER TABLE users ADD COLUMN diet_restrictions TEXT'],
  ['commitment_text', 'ALTER TABLE users ADD COLUMN commitment_text TEXT'],
  ['accountability_mode', "ALTER TABLE users ADD COLUMN accountability_mode TEXT DEFAULT 'accountability'"],
  ['last_day_before_reminder_date', 'ALTER TABLE users ADD COLUMN last_day_before_reminder_date TEXT'],
  ['last_same_day_reminder_date', 'ALTER TABLE users ADD COLUMN last_same_day_reminder_date TEXT'],
  ['last_post_workout_checkin_date', 'ALTER TABLE users ADD COLUMN last_post_workout_checkin_date TEXT'],
  ['post_workout_prompt_date', 'ALTER TABLE users ADD COLUMN post_workout_prompt_date TEXT'],
  ['weekly_checkin_step', 'ALTER TABLE users ADD COLUMN weekly_checkin_step TEXT'],
  ['schedule_overrides', "ALTER TABLE users ADD COLUMN schedule_overrides TEXT DEFAULT '[]'"],
];
for (const [column, sql] of userColumnMigrations) {
  if (!existingUserColumns.has(column)) db.exec(sql);
}

const existingCheckinColumns = new Set(db.prepare('PRAGMA table_info(checkins)').all().map((c) => c.name));
const checkinColumnMigrations = [
  ['photo_hash', 'ALTER TABLE checkins ADD COLUMN photo_hash TEXT'],
  ['gesture', 'ALTER TABLE checkins ADD COLUMN gesture TEXT'],
  ['distance_km', 'ALTER TABLE checkins ADD COLUMN distance_km REAL'],
  ['duration_minutes', 'ALTER TABLE checkins ADD COLUMN duration_minutes REAL'],
  ['pace_min_per_km', 'ALTER TABLE checkins ADD COLUMN pace_min_per_km REAL'],
  ['activity_calories', 'ALTER TABLE checkins ADD COLUMN activity_calories INTEGER'],
  ['activity_type', 'ALTER TABLE checkins ADD COLUMN activity_type TEXT'],
];
for (const [column, sql] of checkinColumnMigrations) {
  if (!existingCheckinColumns.has(column)) db.exec(sql);
}

const existingChatMessageColumns = new Set(db.prepare('PRAGMA table_info(chat_messages)').all().map((c) => c.name));
const chatMessageColumnMigrations = [
  ['phone', 'ALTER TABLE chat_messages ADD COLUMN phone TEXT'],
];
for (const [column, sql] of chatMessageColumnMigrations) {
  if (!existingChatMessageColumns.has(column)) db.exec(sql);
}
db.exec('CREATE INDEX IF NOT EXISTS idx_chat_messages_phone ON chat_messages(phone);');

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
  'profile_json', 'cuisine_region', 'fitness_app', 'weekly_goal_distance_km', 'last_goal_review_date', 'weekly_plan',
  'firebase_uid', 'experience_level', 'supplements', 'diet_summary', 'workout_location', 'home_equipment',
  'reminders_sent_log', 'sleep_hours', 'injuries', 'diet_restrictions', 'commitment_text', 'accountability_mode',
  'last_day_before_reminder_date', 'last_same_day_reminder_date', 'last_post_workout_checkin_date',
  'post_workout_prompt_date', 'weekly_checkin_step', 'schedule_overrides',
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

function createCheckin({ userId, date, description, photoRef, status, geminiReason, photoHash, gesture, distanceKm, durationMinutes, paceMinPerKm, activityCalories, activityType }) {
  const info = db.prepare(
    `INSERT INTO checkins (user_id, date, description, photo_ref, status, gemini_reason, photo_hash, gesture, distance_km, duration_minutes, pace_min_per_km, activity_calories, activity_type)
     VALUES (@userId, @date, @description, @photoRef, @status, @geminiReason, @photoHash, @gesture, @distanceKm, @durationMinutes, @paceMinPerKm, @activityCalories, @activityType)`
  ).run({
    userId,
    date,
    description: description || null,
    photoRef: photoRef || null,
    status: status || 'pending',
    geminiReason: geminiReason || null,
    photoHash: photoHash || null,
    gesture: gesture || null,
    distanceKm: distanceKm || null,
    durationMinutes: durationMinutes || null,
    paceMinPerKm: paceMinPerKm || null,
    activityCalories: activityCalories || null,
    activityType: activityType || null,
  });
  return getCheckinById(info.lastInsertRowid);
}

function getCheckinById(id) {
  return db.prepare('SELECT * FROM checkins WHERE id = ?').get(id);
}

const CHECKIN_FIELDS = new Set(['description', 'photo_ref', 'status', 'gemini_reason', 'photo_hash', 'gesture', 'distance_km', 'duration_minutes', 'pace_min_per_km', 'activity_calories', 'activity_type']);

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
  let phone = null;
  const user = getUserById(userId);
  if (user) {
    phone = user.phone;
  }
  db.prepare('INSERT INTO chat_messages (user_id, phone, role, text) VALUES (?, ?, ?, ?)').run(userId, phone, role, text);
}

function getChatMessages(userId, limit = 15) {
  return db.prepare('SELECT role, text FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(userId, limit)
    .reverse();
}

// ── Memory layer helpers ──

function getProfileJson(userId) {
  const user = getUserById(userId);
  if (!user || !user.profile_json) return {};
  try {
    return JSON.parse(user.profile_json);
  } catch (err) {
    return {};
  }
}

function updateProfileJson(userId, profileObj) {
  const json = JSON.stringify(profileObj);
  db.prepare('UPDATE users SET profile_json = ? WHERE id = ?').run(json, userId);
}

function createDailySummary({ userId, date, summary, followUpWorthy, followUpDate }) {
  const info = db.prepare(
    `INSERT INTO daily_summaries (user_id, date, summary, follow_up_worthy, follow_up_date)
     VALUES (@userId, @date, @summary, @followUpWorthy, @followUpDate)`
  ).run({
    userId,
    date,
    summary,
    followUpWorthy: followUpWorthy ? 1 : 0,
    followUpDate: followUpDate || null,
  });
  return info.lastInsertRowid;
}

function getRecentDailySummaries(userId, limit = 3) {
  return db.prepare(
    'SELECT * FROM daily_summaries WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT ?'
  ).all(userId, limit).reverse();
}

function getDueFollowUps(today) {
  return db.prepare(
    'SELECT ds.*, u.phone, u.name, u.language, u.activity FROM daily_summaries ds JOIN users u ON ds.user_id = u.id WHERE ds.follow_up_date <= ? AND ds.follow_up_resolved = 0'
  ).all(today);
}

function resolveFollowUp(summaryId) {
  db.prepare('UPDATE daily_summaries SET follow_up_resolved = 1 WHERE id = ?').run(summaryId);
}

function getChatMessagesByDate(userId, date) {
  return db.prepare(
    "SELECT role, text, created_at FROM chat_messages WHERE user_id = ? AND date(created_at) = ? ORDER BY created_at ASC, id ASC"
  ).all(userId, date);
}

function getCheckinsForWeek(userId, startDate, endDate) {
  return db.prepare(
    'SELECT * FROM checkins WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC'
  ).all(userId, startDate, endDate);
}

function getWeekCardioCheckins(userId, weekStart, weekEnd) {
  return db.prepare(
    "SELECT * FROM checkins WHERE user_id = ? AND date >= ? AND date <= ? AND status = 'accepted' AND distance_km IS NOT NULL ORDER BY date ASC"
  ).all(userId, weekStart, weekEnd);
}

function getWeekCardioCheckinsByActivity(userId, weekStart, weekEnd, activityType) {
  return db.prepare(
    "SELECT * FROM checkins WHERE user_id = ? AND date >= ? AND date <= ? AND status = 'accepted' AND distance_km IS NOT NULL AND activity_type = ? ORDER BY date ASC"
  ).all(userId, weekStart, weekEnd, activityType);
}

function getRecentCardioCheckins(userId, limit = 10) {
  return db.prepare(
    "SELECT * FROM checkins WHERE user_id = ? AND status = 'accepted' AND distance_km IS NOT NULL ORDER BY date DESC, id DESC LIMIT ?"
  ).all(userId, limit);
}

function getRecentCardioCheckinsByActivity(userId, activityType, limit = 8) {
  return db.prepare(
    "SELECT * FROM checkins WHERE user_id = ? AND status = 'accepted' AND distance_km IS NOT NULL AND activity_type = ? ORDER BY date DESC, id DESC LIMIT ?"
  ).all(userId, activityType, limit);
}

function getChatMessagesForWeek(userId, startDate, endDate) {
  return db.prepare(
    "SELECT role, text, created_at FROM chat_messages WHERE user_id = ? AND date(created_at) >= ? AND date(created_at) <= ? ORDER BY created_at ASC, id ASC"
  ).all(userId, startDate, endDate);
}

// ── Outbox message queue (for native app) ──

function queueOutboxMessage({ userId, phone, body, mediaUrl }) {
  db.prepare(
    'INSERT INTO outbox_messages (user_id, phone, body, media_url) VALUES (?, ?, ?, ?)'
  ).run(userId, phone, body, mediaUrl || null);
}

function getPendingMessages(userId) {
  return db.prepare(
    'SELECT id, body, media_url, created_at FROM outbox_messages WHERE user_id = ? AND delivered = 0 ORDER BY created_at ASC, id ASC'
  ).all(userId);
}

function markMessagesDelivered(userId, messageIds) {
  if (!messageIds || messageIds.length === 0) return;
  const placeholders = messageIds.map(() => '?').join(',');
  db.prepare(
    `UPDATE outbox_messages SET delivered = 1 WHERE user_id = ? AND id IN (${placeholders})`
  ).run(userId, ...messageIds);
}

// ── Workout, Weight, Schedule Overrides & Weekly Reviews ──

function logWorkout(userId, { date, exerciseName, sets, reps, weightKg, rpe, status, notes }) {
  const info = db.prepare(
    `INSERT INTO workout_logs (user_id, date, exercise_name, sets, reps, weight_kg, rpe, status, notes)
     VALUES (@userId, @date, @exerciseName, @sets, @reps, @weightKg, @rpe, @status, @notes)`
  ).run({
    userId,
    date,
    exerciseName,
    sets: sets || null,
    reps: reps || null,
    weightKg: weightKg || null,
    rpe: rpe || null,
    status: status || 'completed',
    notes: notes || null,
  });
  return info.lastInsertRowid;
}

function getRecentWorkoutLogs(userId, limit = 15) {
  return db.prepare(
    'SELECT * FROM workout_logs WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT ?'
  ).all(userId, limit);
}

function getWorkoutLogsByDate(userId, date) {
  return db.prepare(
    'SELECT * FROM workout_logs WHERE user_id = ? AND date = ? ORDER BY id ASC'
  ).all(userId, date);
}

function logWeight(userId, weight, date, notes) {
  const info = db.prepare(
    `INSERT INTO weight_logs (user_id, date, weight, notes)
     VALUES (@userId, @date, @weight, @notes)`
  ).run({
    userId,
    date,
    weight,
    notes: notes || null,
  });
  updateUser(userId, { weight });
  return info.lastInsertRowid;
}

function getWeightLogs(userId, limit = 15) {
  return db.prepare(
    'SELECT * FROM weight_logs WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT ?'
  ).all(userId, limit);
}

function getLatestWeight(userId) {
  const entry = db.prepare(
    'SELECT weight, date FROM weight_logs WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 1'
  ).get(userId);
  if (entry) return entry.weight;
  const user = getUserById(userId);
  return user ? user.weight : null;
}

function createScheduleOverride(userId, { originalDate, rescheduledDate, sessionName, reason, status }) {
  const info = db.prepare(
    `INSERT INTO workout_schedule_overrides (user_id, original_date, rescheduled_date, session_name, status, reason)
     VALUES (@userId, @originalDate, @rescheduledDate, @sessionName, @status, @reason)`
  ).run({
    userId,
    originalDate,
    rescheduledDate,
    sessionName,
    status: status || 'rescheduled',
    reason: reason || null,
  });
  return info.lastInsertRowid;
}

function getScheduleOverridesForWeek(userId, startDate, endDate) {
  return db.prepare(
    `SELECT * FROM workout_schedule_overrides
     WHERE user_id = ? AND (
       (original_date >= ? AND original_date <= ?) OR
       (rescheduled_date >= ? AND rescheduled_date <= ?)
     ) ORDER BY rescheduled_date ASC, id ASC`
  ).all(userId, startDate, endDate, startDate, endDate);
}

function getScheduleOverrideForDate(userId, date) {
  return db.prepare(
    'SELECT * FROM workout_schedule_overrides WHERE user_id = ? AND rescheduled_date = ? ORDER BY id DESC LIMIT 1'
  ).get(userId, date);
}

function updateScheduleOverride(overrideId, fields) {
  const allowed = ['status', 'rescheduled_date', 'reason', 'session_name'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE workout_schedule_overrides SET ${setClause} WHERE id = @overrideId`).run({ ...fields, overrideId });
}

function createWeeklyReview(userId, data) {
  const info = db.prepare(
    `INSERT INTO weekly_reviews (user_id, week_number, start_date, end_date, weight, workouts_completed, workouts_target, sleep_avg, recovery_rating, summary)
     VALUES (@userId, @weekNumber, @startDate, @endDate, @weight, @workoutsCompleted, @workoutsTarget, @sleepAvg, @recoveryRating, @summary)`
  ).run({
    userId,
    weekNumber: data.weekNumber || 1,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    weight: data.weight || null,
    workoutsCompleted: data.workoutsCompleted || 0,
    workoutsTarget: data.workoutsTarget || 0,
    sleepAvg: data.sleepAvg || null,
    recoveryRating: data.recoveryRating || null,
    summary: data.summary || null,
  });
  return info.lastInsertRowid;
}

function getWeeklyReviews(userId, limit = 5) {
  return db.prepare(
    'SELECT * FROM weekly_reviews WHERE user_id = ? ORDER BY week_number DESC, id DESC LIMIT ?'
  ).all(userId, limit);
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
  getProfileJson,
  updateProfileJson,
  createDailySummary,
  getRecentDailySummaries,
  getDueFollowUps,
  resolveFollowUp,
  getChatMessagesByDate,
  getCheckinsForWeek,
  getChatMessagesForWeek,
  getWeekCardioCheckins,
  getWeekCardioCheckinsByActivity,
  getRecentCardioCheckins,
  getRecentCardioCheckinsByActivity,
  queueOutboxMessage,
  getPendingMessages,
  markMessagesDelivered,
  logWorkout,
  getRecentWorkoutLogs,
  getWorkoutLogsByDate,
  logWeight,
  getWeightLogs,
  getLatestWeight,
  createScheduleOverride,
  getScheduleOverridesForWeek,
  getScheduleOverrideForDate,
  updateScheduleOverride,
  createWeeklyReview,
  getWeeklyReviews,
};
