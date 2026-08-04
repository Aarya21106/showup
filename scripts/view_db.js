const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'showup.db');
const db = new Database(dbPath);

console.log('\n==================================================');
console.log('            SHOWUP DATABASE VIEWER                ');
console.log('==================================================\n');

try {
  const users = db.prepare('SELECT id, phone, name, activity, days_per_week, checkin_time, streak, deposit_status, state FROM users').all();
  console.log('--- USERS TABLE ---');
  if (users.length === 0) {
    console.log('(No users in the database yet)\n');
  } else {
    console.table(users);
    console.log();
  }

  const checkins = db.prepare('SELECT id, user_id, date, status, gemini_reason FROM checkins ORDER BY created_at DESC LIMIT 20').all();
  console.log('--- RECENT CHECKINS (Last 20) ---');
  if (checkins.length === 0) {
    console.log('(No check-ins logged yet)\n');
  } else {
    console.table(checkins);
    console.log();
  }
} catch (err) {
  console.error('Error reading database:', err.message);
}

db.close();
