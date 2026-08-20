// Push notification permission + Expo push token registration.
// Kept separate from any UI component so the "Allow" button just calls one function.

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ShowUpApi } from '../api/client';

export type NotificationSetupResult =
  | { status: 'enabled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

/**
 * Requests notification permission (if not already granted), retrieves this
 * device's Expo push token, and registers it with the backend so scheduled
 * reminders (workout, meal, hydration, etc.) can reach the device even when
 * the app is closed or backgrounded.
 */
export async function enablePushNotifications(): Promise<NotificationSetupResult> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'ShowUp Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (finalStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return { status: 'denied' };
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const pushToken = tokenResponse.data;

    await ShowUpApi.registerPushToken(pushToken, Platform.OS === 'ios' ? 'ios' : 'android');

    return { status: 'enabled' };
  } catch (err: any) {
    return { status: 'error', message: err?.message || 'Failed to enable notifications.' };
  }
}

/** Current permission status without prompting — used to reflect state in the UI. */
export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  try {
    const result = await Notifications.getPermissionsAsync();
    return result.status;
  } catch (e) {
    return Notifications.PermissionStatus.UNDETERMINED;
  }
}
