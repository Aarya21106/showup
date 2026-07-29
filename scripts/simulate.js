#!/usr/bin/env node
// Local conversation simulator - exercises the exact same handleIncomingMessage()
// code path the real Twilio webhook uses, without needing a Twilio account or a
// running HTTP server. Replies print right here (mock-mode Twilio just console.logs).
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const { handleIncomingMessage } = require('../src/conversation/router');
const db = require('../src/db/db');

const TEST_PHONE = process.env.SIMULATE_PHONE || 'whatsapp:+911234567890';

console.log('=== ShowUp local simulator ===');
console.log(`Simulating WhatsApp user: ${TEST_PHONE}`);
console.log('(set SIMULATE_PHONE=whatsapp:+91... to run a second parallel test user)\n');
console.log('Type replies as the user would on WhatsApp. Commands:');
console.log('  /photo <path> [caption]   send a photo (+ optional caption) for a check-in step');
console.log('  /reset                    wipe this test user and start the flow over');
console.log('  /exit                     quit\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt('you> ');

function send(body, media) {
  return handleIncomingMessage({ phone: TEST_PHONE, body, media: media || {} });
}

async function resetUser() {
  const user = db.getUserByPhone(TEST_PHONE);
  if (user) {
    db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(user.id);
    db.db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    console.log('(test user reset)\n');
  }
  // Re-send the "join" trigger so the very next line you type is treated as the
  // answer to Q1, same as the initial kickoff when this script starts.
  await send('Hi');
}

function mimeTypeFor(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function handlePhotoCommand(rest) {
  const firstSpace = rest.indexOf(' ');
  const imgPath = firstSpace === -1 ? rest : rest.slice(0, firstSpace);
  const caption = firstSpace === -1 ? '' : rest.slice(firstSpace + 1).trim();
  const resolved = path.resolve(process.cwd(), imgPath);

  if (!fs.existsSync(resolved)) {
    console.log(`(file not found: ${resolved})\n`);
    return;
  }

  const base64 = fs.readFileSync(resolved).toString('base64');
  const mimeType = mimeTypeFor(path.extname(resolved).toLowerCase());
  await send(caption, { testBase64: base64, mimeType });
}

async function handleLine(trimmed) {
  try {
    if (trimmed === '/exit') {
      rl.close();
      return;
    }
    if (trimmed === '/reset') {
      await resetUser();
    } else if (trimmed.startsWith('/photo')) {
      await handlePhotoCommand(trimmed.slice('/photo'.length).trim());
    } else if (trimmed.length > 0) {
      await send(trimmed);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// Lines can arrive faster than our async handlers finish (e.g. piped/scripted input),
// so queue them and drain strictly one at a time instead of relying on readline's
// own per-call listener, which drops lines that land while a handler is still awaiting.
const queue = [];
let draining = false;
let stdinEnded = false;

async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length > 0) {
    await handleLine(queue.shift().trim());
  }
  draining = false;
  // With piped/scripted input, stdin can hit EOF (and fire 'close') well before
  // slower steps here (poster rendering, Gemini calls) finish draining the queue -
  // only exit once there's truly nothing left in flight.
  if (stdinEnded) {
    process.exit(0);
  } else {
    rl.prompt();
  }
}

rl.on('line', (line) => {
  queue.push(line);
  drain();
});

rl.on('close', () => {
  stdinEnded = true;
  if (!draining && queue.length === 0) process.exit(0);
});

send('Hi').then(() => rl.prompt());
