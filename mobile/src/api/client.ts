import axios, { AxiosInstance } from 'axios';

export interface ChatMessage {
  id: string | number;
  role: 'user' | 'model';
  text: string;
  media_url?: string | null;
  imageUri?: string;
  created_at: string;
  delivered?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'failed';
}

export interface UserProfile {
  id?: number;
  phone: string;
  name?: string;
  activity?: string;
  days_per_week?: number;
  checkin_time?: string;
  state?: string;
  deposit_status?: 'unpaid' | 'paid';
  started_at?: string;
  day_count?: number;
  streak?: number;
  missed_count?: number;
  tier?: string;
  goal?: string;
  current_gesture?: string;
  timetable?: string;
  target_calories?: number;
  height?: number;
  weight?: number;
}

// Default to your PC's IP address on the local network so physical devices connect immediately
export let BASE_URL = 'http://10.131.110.142:3000';

export const setBaseUrl = (url: string) => {
  BASE_URL = url.replace(/\/+$/, '');
};

let authToken: string | null = 'dev_token';
let activePhone: string = '+919500665712';

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const setActivePhone = (phone: string) => {
  activePhone = phone;
};

const getAxiosInstance = (): AxiosInstance => {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
      'x-phone': activePhone,
      Authorization: authToken ? `Bearer ${authToken}` : `Bearer dev_${activePhone}`,
    },
  });
};

import AsyncStorage from '@react-native-async-storage/async-storage';

export const ShowUpApi = {
  // Test connection to backend
  async ping(): Promise<boolean> {
    try {
      const api = getAxiosInstance();
      const res = await api.get('/healthz', { timeout: 4000 });
      return res.status === 200;
    } catch (e) {
      return false;
    }
  },

  // Send 6-digit OTP to phone number
  async sendOtp(phone: string): Promise<{ success: boolean; message?: string; devCode?: string }> {
    const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });
    const response = await api.post('/api/auth/send-otp', { phone });
    return response.data;
  },

  // Verify 6-digit OTP and obtain session token
  async verifyOtp(phone: string, code: string): Promise<{ success: boolean; token: string; phone: string; user: UserProfile }> {
    const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });
    const response = await api.post('/api/auth/verify-otp', { phone, code });
    return response.data;
  },

  // Authenticate with Firebase ID Token
  async loginWithFirebase(idToken: string): Promise<{ success: boolean; token: string; phone: string; user: UserProfile }> {
    const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });
    const response = await api.post('/api/auth/firebase', { idToken });
    return response.data;
  },

  // Send a text message or image check-in to the bot
  async sendMessage(payload: { body: string; imageBase64?: string; mimeType?: string }) {
    const api = getAxiosInstance();
    const response = await api.post('/api/message', payload);
    return response.data;
  },

  // Fetch pending messages (outbox queue from scheduler/Gemini)
  async getPendingMessages(): Promise<ChatMessage[]> {
    const api = getAxiosInstance();
    const response = await api.get('/api/messages');
    return (response.data.messages || []).map((m: any) => ({
      id: m.id,
      role: 'model',
      text: m.body,
      media_url: m.media_url,
      created_at: m.created_at,
      status: 'delivered',
    }));
  },

  // Acknowledge delivered message IDs
  async acknowledgeMessages(messageIds: number[]) {
    if (messageIds.length === 0) return;
    const api = getAxiosInstance();
    await api.post('/api/messages/ack', { messageIds });
  },

  // Fetch authenticated user profile and pledge stats
  async getProfile(): Promise<{ exists: boolean; user?: UserProfile }> {
    const api = getAxiosInstance();
    const response = await api.get('/api/me');
    return response.data;
  },

  // Fetch check-in history
  async getCheckins() {
    const api = getAxiosInstance();
    const response = await api.get('/api/checkins');
    return response.data.checkins || [];
  },
};
