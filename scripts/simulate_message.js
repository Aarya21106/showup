#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

process.env.MOCK_WHATSAPP = 'true';

// Load config first to set up environment
require('../src/config');
const { handleIncomingMessage } = require('../src/conversation/router');
const db = require('../src/db/db');

async function main() {
  const args = process.argv.slice(2);
  const action = args[0]; // "send" or "reset"
  const phone = args[1];

  if (!phone) {
    console.error('Error: Missing phone number');
    process.exit(1);
  }

  if (action === 'reset') {
    const user = db.getUserByPhone(phone);
    if (user) {
      db.db.exec('PRAGMA foreign_keys = OFF;');
      try {
        db.db.prepare('DELETE FROM checkins WHERE user_id = ?').run(user.id);
        db.db.prepare('DELETE FROM nutrition_logs WHERE user_id = ?').run(user.id);
        db.db.prepare('DELETE FROM burned_calories_logs WHERE user_id = ?').run(user.id);
        db.db.prepare('DELETE FROM chat_messages WHERE user_id = ?').run(user.id);
        db.db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
      } finally {
        db.db.exec('PRAGMA foreign_keys = ON;');
      }
      console.log('RESET_SUCCESS');
    } else {
      console.log('NO_USER_TO_RESET');
    }
    process.exit(0);
  }

  if (action === 'reminder') {
    const reminderType = args[2] || 'workout';
    const user = db.getUserByPhone(phone);
    if (!user) {
      console.error('Error: User not found for phone', phone);
      process.exit(1);
    }
    const scheduler = require('../src/scheduler');
    try {
      await scheduler.triggerUserReminder(user, reminderType);
      console.log(`REMINDER_SUCCESS_${reminderType.toUpperCase()}`);
    } catch (err) {
      console.error('Error triggering reminder:', err);
      process.exit(1);
    }
    process.exit(0);
  }

  if (action === 'tick') {
    const scheduler = require('../src/scheduler');
    try {
      scheduler.tick();
      console.log('TICK_SUCCESS');
    } catch (err) {
      console.error('Error running scheduler tick:', err);
      process.exit(1);
    }
    process.exit(0);
  }

  if (action === 'send') {
    const body = args[2] || '';
    const mediaPath = args[3] || '';
    
    const media = {};
    if (mediaPath) {
      media.mediaUrl = mediaPath;
      const ext = path.extname(mediaPath).toLowerCase();
      media.mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    }

    try {
      await handleIncomingMessage({ phone, body, media });
      console.log('SEND_SUCCESS');
    } catch (err) {
      console.error('Error handling message:', err);
      process.exit(1);
    }
    process.exit(0);
  }

  console.error('Unknown action:', action);
  process.exit(1);
}

main();
