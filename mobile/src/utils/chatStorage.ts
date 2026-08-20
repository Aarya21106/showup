// On-device chat history persistence. Keyed per phone number so switching
// accounts (logout/login) never bleeds one user's chat into another's, and so
// "Clear Chat" only ever touches the currently active account's cache.
//
// This is deliberately separate from the backend: the backend's chat_messages
// table is the permanent record (used for AI context, memory, etc.) and is never
// touched by anything in this file — "Clear Chat" is local-display-only by design.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../api/client';

const keyFor = (phone: string) => `@showup_chat_cache_${phone}`;

export async function loadCachedMessages(phone: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(phone));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export async function saveCachedMessages(phone: string, messages: ChatMessage[]): Promise<void> {
  try {
    // Cap what we persist so the cache can't grow unbounded on a very long-lived install.
    const trimmed = messages.slice(-500);
    await AsyncStorage.setItem(keyFor(phone), JSON.stringify(trimmed));
  } catch (e) {
    // Non-fatal — worst case the next app launch re-seeds from backend history.
  }
}

// "Clear Chat" — wipes only the local on-device cache for this account.
// Never touches the backend; server-side history, profile, streak, etc. are untouched.
export async function clearCachedMessages(phone: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(phone));
  } catch (e) {}
}
