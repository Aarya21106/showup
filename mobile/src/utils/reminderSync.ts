// Local on-device reminder scheduling — the device-side half of the backend's
// /api/reminder-plan. Render's free tier sleeps after 15 minutes idle, which
// kills the server's in-process reminder scheduler entirely; local
// notifications scheduled directly on the phone keep firing regardless of
// whether the server (or even the app) is awake at that moment.
//
// "Smart" comes from re-syncing, not from the alarms themselves: every sync
// wipes all previously scheduled local reminders and replaces them with a
// fresh plan computed server-side from current state — so a check-in you
// just did, or a meal you just logged, correctly drops the now-pointless
// reminder next time a sync runs, instead of an alarm firing for something
// already done.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ShowUpApi } from '../api/client';

const CHANNEL_ID = 'showup-reminders';
const SOUND_FILE = 'reminder.wav';

let channelReady = false;

async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'ShowUp Reminders',
    importance: Notifications.AndroidImportance.MAX,
    sound: SOUND_FILE,
    vibrationPattern: [0, 250, 250, 250],
  });
  channelReady = true;
}

/**
 * Fetches today's remaining reminder plan and reschedules local notifications
 * to match. Call this on app foreground/launch and right after any action
 * that could invalidate a pending reminder (a check-in, a logged meal) —
 * every call is a full resync, not an incremental patch.
 */
export async function syncReminderPlan(): Promise<void> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return; // never schedule without permission

    await ensureReminderChannel();

    const { reminders } = await ShowUpApi.getReminderPlan();

    // Full snapshot each sync — clear everything scheduled by this app and
    // rebuild fresh, so completed actions correctly drop from the plan.
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const reminder of reminders) {
      const fireDate = new Date(reminder.fireAt);
      if (Number.isNaN(fireDate.getTime()) || fireDate.getTime() <= Date.now()) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: reminder.title,
          body: reminder.body,
          sound: Platform.OS === 'ios' ? SOUND_FILE : undefined, // Android's sound comes from the channel
        },
        trigger: Platform.OS === 'android'
          ? { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate, channelId: CHANNEL_ID }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
      });
    }
  } catch (e) {
    // Non-fatal — local reminders are a backstop, not a critical path. The
    // next sync (next foreground, or next action) will simply retry.
    console.warn('Reminder sync failed:', e);
  }
}
