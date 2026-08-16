/**
 * =========================================================================
 * ShowUp Reminder Test GUI
 * =========================================================================
 * A standalone web UI to test all scheduler reminder scenarios with
 * fake/mock time controls. Captures every outgoing WhatsApp message
 * and displays it in the browser.
 *
 * Usage:  node scripts/test_reminders_gui.js
 * Then open http://localhost:4444 in your browser.
 * =========================================================================
 */

const path = require('path');
const http = require('http');

// ─── 1. Mock WhatsApp service BEFORE anything else loads ────────────────
const outbox = []; // Stores every outgoing message for the GUI

const whatsappMock = {
  sendText: async (to, body) => {
    const entry = { type: 'text', to, body, ts: new Date().toISOString() };
    outbox.push(entry);
    console.log(`[OUTBOX] Text → ${to}: ${body.slice(0, 80)}...`);
    try {
      const db = require('../src/db/db');
      const user = db.getUserByPhone(to);
      if (user) db.saveChatMessage(user.id, 'model', body);
    } catch (err) {}
    return { success: true };
  },
  sendMedia: async (to, body, url) => {
    const entry = { type: 'media', to, body, url, ts: new Date().toISOString() };
    outbox.push(entry);
    console.log(`[OUTBOX] Media → ${to}: ${body.slice(0, 80)}...`);
    try {
      const db = require('../src/db/db');
      const user = db.getUserByPhone(to);
      if (user) db.saveChatMessage(user.id, 'model', body);
    } catch (err) {}
    return { success: true };
  },
  fetchInboundMedia: async () => Buffer.from(''),
  isMock: true,
  getLatestQrDataUrl: () => null,
  getIsConnected: () => false,
};

const whatsappPath = path.resolve(__dirname, '../src/services/whatsapp.js');
require.cache[whatsappPath] = {
  id: whatsappPath, filename: whatsappPath, loaded: true, exports: whatsappMock,
};

// ─── 2. Mock poster service ─────────────────────────────────────────────
const posterPath = path.resolve(__dirname, '../src/services/poster.js');
require.cache[posterPath] = {
  id: posterPath, filename: posterPath, loaded: true,
  exports: {
    renderPlanPoster: async () => ({ publicUrl: 'http://mock/plan.png' }),
    renderFinalPoster: async () => ({ publicUrl: 'http://mock/final.png' }),
  },
};

// ─── 3. Controllable date utilities ─────────────────────────────────────
const dateUtils = require('../src/utils/date');
let mockTime = null;
let mockDate = null;

const originalNowHHMM = dateUtils.nowHHMM;
const originalTodayStr = dateUtils.todayStr;
dateUtils.nowHHMM = (tz) => mockTime || originalNowHHMM(tz);
dateUtils.todayStr = (tz) => mockDate || originalTodayStr(tz);

// ─── 4. Load the real modules ───────────────────────────────────────────
const db = require('../src/db/db');
const scheduler = require('../src/scheduler');
const config = require('../src/config');

// ─── 5. Test user setup ────────────────────────────────────────────────
const TEST_PHONE = 'whatsapp:+919999999999';

function resetTestUser() {
  db.db.exec('PRAGMA foreign_keys = OFF;');
  try {
    const existing = db.getUserByPhone(TEST_PHONE);
    if (existing) {
      db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM nutrition_logs WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM daily_summaries WHERE user_id = ?').run(existing.id);
      db.db.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
    }
  } finally {
    db.db.exec('PRAGMA foreign_keys = ON;');
  }

  const { user } = db.getOrCreateUser(TEST_PHONE);

  const timetable = {
    Monday: 'Legs Day (Squats focus)',
    Tuesday: 'Rest',
    Wednesday: 'Push Day (Chest & Triceps)',
    Thursday: 'Rest',
    Friday: 'Pull Day (Back & Biceps)',
    Saturday: 'Cardio & Core',
    Sunday: 'Rest',
  };

  db.updateUser(user.id, {
    name: 'TestUser',
    language: 'en',
    tier: 'pro_120',
    activity: 'gym',
    checkin_time: '07:00',
    timetable: JSON.stringify(timetable),
    goal: 'muscle_gain',
    state: 'ACTIVE',
    day_count: 5,
    streak: 4,
    missed_count: 1,
    started_at: '2026-08-01',
    deposit_status: 'paid',
    days_per_week: 4,
  });

  outbox.length = 0;
  return db.getUserById(user.id);
}

function getTestUser() {
  const u = db.getUserByPhone(TEST_PHONE);
  if (!u) return null;
  return {
    id: u.id, name: u.name, phone: u.phone, state: u.state,
    checkin_time: u.checkin_time, day_count: u.day_count,
    streak: u.streak, missed_count: u.missed_count,
    current_gesture: u.current_gesture, tier: u.tier,
    timetable: u.timetable, last_prompted_date: u.last_prompted_date,
    workout_reminded_date: u.workout_reminded_date,
    workout_acknowledged_date: u.workout_acknowledged_date,
    water_reminders_sent: u.water_reminders_sent,
  };
}

function getDayNameForDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(d);
}

// ─── 6. HTTP server (GUI) ───────────────────────────────────────────────
const PORT = 4444;

function buildHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ShowUp Reminder Tester</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #0f0f1a; color: #e0e0e0; min-height: 100vh; }

  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px 32px;
    border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 16px; }
  .header h1 { font-size: 22px; font-weight: 700; background: linear-gradient(90deg, #00f5a0, #00d9f5);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .header .badge { background: #00f5a033; color: #00f5a0; font-size: 11px; padding: 3px 10px;
    border-radius: 50px; font-weight: 600; }

  .main { display: grid; grid-template-columns: 340px 1fr; height: calc(100vh - 68px); }

  /* ── Controls Panel ── */
  .controls { background: #12121f; border-right: 1px solid rgba(255,255,255,0.06); padding: 20px;
    overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
  .card { background: #1a1a2e; border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.05); }
  .card h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
    color: #8888aa; margin-bottom: 12px; }
  .row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
  .row label { font-size: 12px; color: #aaa; min-width: 50px; }
  input[type="text"], input[type="date"], input[type="time"], select {
    background: #0f0f1a; border: 1px solid #333; color: #e0e0e0; padding: 8px 12px;
    border-radius: 8px; font-size: 13px; font-family: 'Inter', sans-serif; flex: 1; }
  input:focus, select:focus { outline: none; border-color: #00f5a0; }

  button { cursor: pointer; border: none; border-radius: 8px; padding: 10px 16px; font-size: 13px;
    font-weight: 600; font-family: 'Inter', sans-serif; transition: all 0.15s ease; }
  .btn-primary { background: linear-gradient(135deg, #00f5a0, #00d9f5); color: #0f0f1a; }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,245,160,0.3); }
  .btn-danger { background: #f5004f33; color: #f5004f; border: 1px solid #f5004f55; }
  .btn-danger:hover { background: #f5004f55; }
  .btn-warning { background: #f5a00033; color: #f5a000; border: 1px solid #f5a00055; }
  .btn-warning:hover { background: #f5a00055; }
  .btn-secondary { background: #ffffff11; color: #aaa; border: 1px solid #333; }
  .btn-secondary:hover { background: #ffffff22; color: #fff; }
  .btn-sm { padding: 6px 12px; font-size: 12px; }

  .btn-group { display: flex; flex-wrap: wrap; gap: 6px; }

  /* ── User State ── */
  .state-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .state-item { font-size: 11px; padding: 6px 8px; background: #0f0f1a; border-radius: 6px; }
  .state-item .label { color: #666; display: block; margin-bottom: 2px; }
  .state-item .value { color: #00f5a0; font-weight: 600; font-family: monospace; }

  /* ── Message Log ── */
  .log-panel { display: flex; flex-direction: column; }
  .log-header { padding: 16px 24px; border-bottom: 1px solid rgba(255,255,255,0.06);
    display: flex; justify-content: space-between; align-items: center; }
  .log-header h2 { font-size: 16px; font-weight: 600; }
  .log-body { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex;
    flex-direction: column; gap: 12px; }
  .msg-card { background: #1a1a2e; border-radius: 12px; padding: 14px 16px;
    border-left: 3px solid #00f5a0; animation: slideIn 0.3s ease; }
  .msg-card.media { border-left-color: #f5a000; }
  .msg-card .msg-meta { font-size: 11px; color: #666; margin-bottom: 6px;
    display: flex; justify-content: space-between; }
  .msg-card .msg-body { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
  .msg-card .msg-tag { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 50px;
    font-weight: 600; margin-right: 6px; }
  .tag-text { background: #00f5a022; color: #00f5a0; }
  .tag-media { background: #f5a00022; color: #f5a000; }
  .empty-state { flex: 1; display: flex; align-items: center; justify-content: center;
    color: #444; font-size: 14px; }

  @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .quick-tests { display: flex; flex-direction: column; gap: 6px; }
  .quick-tests button { text-align: left; padding: 8px 12px; }

  #status-bar { padding: 8px 16px; font-size: 11px; color: #666; text-align: center;
    border-top: 1px solid rgba(255,255,255,0.06); background: #0f0f1a; }
</style>
</head>
<body>
<div class="header">
  <h1>ShowUp Reminder Tester</h1>
  <span class="badge">MOCK MODE</span>
</div>

<div class="main">
  <div class="controls">
    <!-- Time Controls -->
    <div class="card">
      <h3>⏰ Time Controls</h3>
      <div class="row">
        <label>Date</label>
        <input type="date" id="mockDate" value="2026-08-03">
      </div>
      <div class="row">
        <label>Time</label>
        <input type="time" id="mockTime" value="07:00">
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn-primary" onclick="runTick()" style="flex:1">▶ Run Tick</button>
      </div>
      <div id="dayInfo" style="font-size:11px;color:#888;margin-top:6px;text-align:center;">Monday — Legs Day (Squats focus)</div>
    </div>

    <!-- Quick Time Jumps -->
    <div class="card">
      <h3>⚡ Quick Time Jumps</h3>
      <div class="btn-group">
        <button class="btn-secondary btn-sm" onclick="setTime('07:00')">07:00</button>
        <button class="btn-secondary btn-sm" onclick="setTime('09:00')">09:00</button>
        <button class="btn-secondary btn-sm" onclick="setTime('10:00')">10:00</button>
        <button class="btn-secondary btn-sm" onclick="setTime('14:00')">14:00</button>
        <button class="btn-secondary btn-sm" onclick="setTime('18:00')">18:00</button>
      </div>
    </div>

    <!-- Quick Date Jumps -->
    <div class="card">
      <h3>📅 Quick Dates</h3>
      <div class="btn-group">
        <button class="btn-secondary btn-sm" onclick="setDate('2026-08-03')">Mon 8/3</button>
        <button class="btn-secondary btn-sm" onclick="setDate('2026-08-04')">Tue 8/4</button>
        <button class="btn-secondary btn-sm" onclick="setDate('2026-08-05')">Wed 8/5</button>
        <button class="btn-secondary btn-sm" onclick="setDate('2026-08-06')">Thu 8/6</button>
        <button class="btn-secondary btn-sm" onclick="setDate('2026-08-07')">Fri 8/7</button>
        <button class="btn-secondary btn-sm" onclick="setDate('2026-08-08')">Sat 8/8</button>
        <button class="btn-secondary btn-sm" onclick="setDate('2026-08-09')">Sun 8/9</button>
      </div>
    </div>

    <!-- Automated Tests -->
    <div class="card">
      <h3>🧪 Automated Tests</h3>
      <div class="quick-tests">
        <button class="btn-primary btn-sm" onclick="runFullSequence()">▶ Full Day Sequence (auto)</button>
        <button class="btn-warning btn-sm" onclick="runMultiDaySequence()">▶ Multi-Day Test (3 days)</button>
        <button class="btn-danger btn-sm" onclick="runEdgeCaseTests()">▶ Edge Case Tests</button>
      </div>
    </div>

    <!-- User DB Controls -->
    <div class="card">
      <h3>👤 Test User</h3>
      <div class="btn-group" style="margin-bottom:10px">
        <button class="btn-danger btn-sm" onclick="resetUser()">Reset User</button>
        <button class="btn-secondary btn-sm" onclick="refreshState()">Refresh</button>
      </div>
      <div class="btn-group" style="margin-bottom:10px">
        <button class="btn-secondary btn-sm" onclick="setUserField('workout_acknowledged_date', document.getElementById('mockDate').value)">Set Acknowledged</button>
        <button class="btn-secondary btn-sm" onclick="setUserField('workout_acknowledged_date', '')">Clear Acknowledged</button>
      </div>
      <div class="btn-group" style="margin-bottom:10px">
        <button class="btn-secondary btn-sm" onclick="createCheckin('accepted')">Add Accepted Checkin</button>
        <button class="btn-secondary btn-sm" onclick="createCheckin('pending')">Add Pending Checkin</button>
      </div>
      <div class="state-grid" id="userState">
        <div class="state-item"><span class="label">Loading...</span></div>
      </div>
    </div>

    <!-- Outbox Controls -->
    <div class="card">
      <h3>📤 Outbox</h3>
      <div class="btn-group">
        <button class="btn-danger btn-sm" onclick="clearLog()">Clear Log</button>
        <button class="btn-secondary btn-sm" onclick="refreshLog()">Refresh</button>
      </div>
    </div>
  </div>

  <div class="log-panel">
    <div class="log-header">
      <h2>📨 Message Outbox</h2>
      <span id="msgCount" style="font-size:12px;color:#666">0 messages</span>
    </div>
    <div class="log-body" id="logBody">
      <div class="empty-state">No messages yet. Set a time and run a tick!</div>
    </div>
  </div>
</div>

<div id="status-bar">Ready. Test user: whatsapp:+919999999999 | Timetable: Mon=Legs, Wed=Push, Fri=Pull, Sat=Cardio</div>

<script>
const API = '';

async function api(endpoint, body = {}) {
  const res = await fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

function setTime(t) {
  document.getElementById('mockTime').value = t;
  updateDayInfo();
}
function setDate(d) {
  document.getElementById('mockDate').value = d;
  updateDayInfo();
}

function updateDayInfo() {
  const d = document.getElementById('mockDate').value;
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const date = new Date(d + 'T00:00:00Z');
  const dayName = days[date.getUTCDay()];

  const timetable = {
    Monday: 'Legs Day (Squats focus)',
    Tuesday: 'Rest',
    Wednesday: 'Push Day (Chest & Triceps)',
    Thursday: 'Rest',
    Friday: 'Pull Day (Back & Biceps)',
    Saturday: 'Cardio & Core',
    Sunday: 'Rest'
  };
  const focus = timetable[dayName] || '?';
  const isRest = focus.toLowerCase() === 'rest';
  document.getElementById('dayInfo').innerHTML =
    dayName + ' — ' + (isRest ? '<span style="color:#f5a000">REST DAY</span>' : '<span style="color:#00f5a0">' + focus + '</span>');
}

async function runTick() {
  const d = document.getElementById('mockDate').value;
  const t = document.getElementById('mockTime').value;
  document.getElementById('status-bar').textContent = 'Running tick at ' + d + ' ' + t + '...';
  const result = await api('/api/tick', { date: d, time: t });
  document.getElementById('status-bar').textContent = 'Tick complete. ' + (result.messagesSent || 0) + ' new message(s).';
  await refreshLog();
  await refreshState();
}

async function resetUser() {
  await api('/api/reset');
  document.getElementById('status-bar').textContent = 'User reset. Outbox cleared.';
  await refreshLog();
  await refreshState();
}

async function refreshState() {
  const res = await fetch('/api/state');
  const data = await res.json();
  if (!data.user) return;
  const u = data.user;
  const grid = document.getElementById('userState');
  grid.innerHTML = [
    field('State', u.state), field('Day', u.day_count),
    field('Streak', u.streak), field('Missed', u.missed_count),
    field('Gesture', u.current_gesture || '—'), field('Tier', u.tier),
    field('Prompted', u.last_prompted_date || '—'), field('Reminded', u.workout_reminded_date || '—'),
    field('Ack\'d', u.workout_acknowledged_date || '—'), field('Water', u.water_reminders_sent || '—'),
  ].join('');
}

function field(label, value) {
  return '<div class="state-item"><span class="label">' + label + '</span><span class="value">' + value + '</span></div>';
}

async function refreshLog() {
  const res = await fetch('/api/outbox');
  const data = await res.json();
  const body = document.getElementById('logBody');
  document.getElementById('msgCount').textContent = data.messages.length + ' messages';
  if (data.messages.length === 0) {
    body.innerHTML = '<div class="empty-state">No messages yet. Set a time and run a tick!</div>';
    return;
  }
  body.innerHTML = data.messages.map((m, i) => {
    const isMedia = m.type === 'media';
    const tag = isMedia ? '<span class="msg-tag tag-media">MEDIA</span>' : '<span class="msg-tag tag-text">TEXT</span>';
    return '<div class="msg-card ' + (isMedia ? 'media' : '') + '">' +
      '<div class="msg-meta">' + tag + '<span>#' + (i+1) + '</span><span>' + m.ts + '</span></div>' +
      '<div class="msg-body">' + escHtml(m.body) + '</div>' +
      (isMedia ? '<div style="font-size:11px;color:#f5a000;margin-top:6px">📎 ' + m.url + '</div>' : '') +
    '</div>';
  }).join('');
  body.scrollTop = body.scrollHeight;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function clearLog() {
  await api('/api/clearOutbox');
  await refreshLog();
}

async function setUserField(field, value) {
  await api('/api/setField', { field, value });
  await refreshState();
}

async function createCheckin(status) {
  const d = document.getElementById('mockDate').value;
  await api('/api/createCheckin', { date: d, status });
  await refreshState();
  document.getElementById('status-bar').textContent = 'Created ' + status + ' checkin for ' + d;
}

// ── Automated test sequences ──

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runFullSequence() {
  document.getElementById('status-bar').textContent = 'Running full day sequence...';
  await api('/api/reset');
  await refreshLog();

  // 1. Daily prompt at 07:00 on Monday
  setDate('2026-08-03'); setTime('07:00');
  await runTick(); await sleep(3000);

  // 2. Water reminder at 10:00
  setTime('10:00');
  await runTick(); await sleep(1500);

  // 3. 2-hour followup at 09:00 (no ack)
  setTime('09:00');
  await runTick(); await sleep(1500);

  // 4. 3-hour gesture nudge at 10:00
  setTime('10:00');
  await runTick(); await sleep(1500);

  // 5. Water reminder at 14:00
  setTime('14:00');
  await runTick(); await sleep(1500);

  // 6. Water reminder at 18:00
  setTime('18:00');
  await runTick(); await sleep(1500);

  document.getElementById('status-bar').textContent = 'Full day sequence complete!';
}

async function runMultiDaySequence() {
  document.getElementById('status-bar').textContent = 'Running multi-day sequence...';
  await api('/api/reset');
  await refreshLog();

  const dates = ['2026-08-03', '2026-08-04', '2026-08-05'];
  for (const d of dates) {
    setDate(d);
    setTime('07:00');
    await runTick(); await sleep(3000);
    setTime('09:00');
    await runTick(); await sleep(1500);
    setTime('10:00');
    await runTick(); await sleep(1500);
  }
  document.getElementById('status-bar').textContent = 'Multi-day sequence complete!';
}

async function runEdgeCaseTests() {
  document.getElementById('status-bar').textContent = 'Running edge case tests...';
  await api('/api/reset');
  await refreshLog();

  // Test 1: Tick at non-checkin time — should produce NO messages
  setDate('2026-08-03'); setTime('12:00');
  await runTick(); await sleep(1000);

  // Test 2: Double-tick at checkin time — should NOT duplicate
  setTime('07:00');
  await runTick(); await sleep(3000);
  await runTick(); await sleep(1000);

  // Test 3: 2-hour followup with acknowledged date set
  await api('/api/setField', { field: 'workout_acknowledged_date', value: '2026-08-03' });
  setTime('09:00');
  await runTick(); await sleep(1500);

  // Test 4: 2-hour followup with an accepted checkin (should NOT fire)
  await api('/api/createCheckin', { date: '2026-08-03', status: 'accepted' });
  setTime('09:00');
  await runTick(); await sleep(1500);

  document.getElementById('status-bar').textContent = 'Edge case tests complete!';
}

// Init
updateDayInfo();
refreshState();
refreshLog();
document.getElementById('mockDate').addEventListener('change', updateDayInfo);
</script>
</body>
</html>`;
}

// ─── 7. API routes ──────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // Serve HTML GUI
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(buildHTML());
    return;
  }

  // JSON API endpoints
  if (req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};

    if (req.url === '/api/tick') {
      mockDate = data.date || null;
      mockTime = data.time || null;
      const beforeCount = outbox.length;
      scheduler.tick();
      // Wait for async messages
      await new Promise(r => setTimeout(r, 2500));
      const messagesSent = outbox.length - beforeCount;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, messagesSent }));
      return;
    }

    if (req.url === '/api/reset') {
      resetTestUser();
      mockDate = null;
      mockTime = null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === '/api/clearOutbox') {
      outbox.length = 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === '/api/setField') {
      const user = db.getUserByPhone(TEST_PHONE);
      if (user) {
        const update = {};
        update[data.field] = data.value || null;
        db.updateUser(user.id, update);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === '/api/createCheckin') {
      const user = db.getUserByPhone(TEST_PHONE);
      if (user) {
        // Remove existing checkin for this date first
        const existing = db.getCheckinByUserDate(user.id, data.date);
        if (existing) {
          db.updateCheckin(existing.id, { status: data.status });
        } else {
          db.createCheckin({
            userId: user.id,
            date: data.date,
            description: 'Test checkin',
            status: data.status,
          });
        }
        // If accepted, also update streak
        if (data.status === 'accepted') {
          db.updateUser(user.id, { streak: user.streak + 1 });
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
  }

  if (req.method === 'GET' && req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: getTestUser(), mockDate, mockTime }));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/outbox') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages: outbox }));
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// ─── 8. Start ───────────────────────────────────────────────────────────
resetTestUser();
server.listen(PORT, () => {
  console.log(`\n=========================================`);
  console.log(`  ShowUp Reminder Test GUI`);
  console.log(`  Open http://localhost:${PORT}`);
  console.log(`=========================================\n`);
});
