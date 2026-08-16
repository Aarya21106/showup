import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShowUpApi, setAuthToken, setBaseUrl, setActivePhone, UserProfile, BASE_URL } from '../api/client';

const STORAGE_KEYS = {
  PHONE: '@showup_phone',
  TOKEN: '@showup_token',
  SERVER_URL: '@showup_server_url',
};

interface AuthContextType {
  phone: string | null;
  token: string | null;
  profile: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  serverUrl: string;
  isOnline: boolean;
  pendingPhone: string | null;
  sendOtp: (phone: string) => Promise<{ success: boolean; message?: string; devCode?: string }>;
  verifyOtp: (code: string) => Promise<{ success: boolean; message?: string }>;
  loginWithFirebase: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
  checkConnection: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [phone, setPhone] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [serverUrl, setServerUrlState] = useState<string>(BASE_URL);

  const checkConnection = async () => {
    const ready = await ShowUpApi.ping();
    setIsOnline(ready);
    return ready;
  };

  // Restore saved session from AsyncStorage on app launch
  useEffect(() => {
    const bootstrapSession = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
        if (savedUrl) {
          setServerUrlState(savedUrl);
          setBaseUrl(savedUrl);
        }

        const savedPhone = await AsyncStorage.getItem(STORAGE_KEYS.PHONE);
        const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);

        if (savedPhone && savedToken) {
          setPhone(savedPhone);
          setToken(savedToken);
          setAuthToken(savedToken);
          setActivePhone(savedPhone);

          try {
            const res = await ShowUpApi.getProfile();
            if (res.exists && res.user) {
              setProfile(res.user);
            } else {
              setProfile({ phone: savedPhone, streak: 0, day_count: 1, missed_count: 0 });
            }
          } catch (err) {
            setProfile({ phone: savedPhone, streak: 0, day_count: 1, missed_count: 0 });
          }
        }
      } catch (err) {
        console.error('[Auth] Error bootstrapping session:', err);
      } finally {
        setIsLoadingSession(false);
        checkConnection();
      }
    };

    bootstrapSession();
  }, []);

  const updateServerUrl = async (url: string) => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    setServerUrlState(cleanUrl);
    setBaseUrl(cleanUrl);
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, cleanUrl);
    checkConnection();
  };

  const sendOtp = async (rawPhone: string) => {
    let clean = rawPhone.trim().replace(/[^\d+]/g, '');
    if (!clean.startsWith('+')) {
      if (clean.length === 10) clean = '+91' + clean;
      else clean = '+' + clean;
    }
    setPendingPhone(clean);

    const res = await ShowUpApi.sendOtp(clean);
    return res;
  };

  const verifyOtp = async (code: string) => {
    if (!pendingPhone) {
      throw new Error('No pending phone number found');
    }

    const res = await ShowUpApi.verifyOtp(pendingPhone, code);
    if (res.success && res.token) {
      setPhone(res.phone);
      setToken(res.token);
      setProfile(res.user);
      setAuthToken(res.token);
      setActivePhone(res.phone);

      await AsyncStorage.setItem(STORAGE_KEYS.PHONE, res.phone);
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
      return { success: true };
    }
    return { success: false, message: 'Invalid code' };
  };

  const loginWithFirebase = async (idToken: string) => {
    const res = await ShowUpApi.loginWithFirebase(idToken);
    if (res.success && res.token) {
      setPhone(res.phone);
      setToken(res.token);
      setProfile(res.user);
      setAuthToken(res.token);
      setActivePhone(res.phone);

      await AsyncStorage.setItem(STORAGE_KEYS.PHONE, res.phone);
      await AsyncStorage.setItem(STORAGE_KEYS.TOKEN, res.token);
    }
  };

  const logout = async () => {
    setPhone(null);
    setToken(null);
    setPendingPhone(null);
    setProfile(null);
    setAuthToken(null);

    await AsyncStorage.removeItem(STORAGE_KEYS.PHONE);
    await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN);
  };

  const refreshProfile = async () => {
    try {
      const res = await ShowUpApi.getProfile();
      if (res.exists && res.user) {
        setProfile(res.user);
      }
    } catch (e) {}
  };

  return (
    <AuthContext.Provider
      value={{
        phone,
        token,
        profile,
        isAuthenticated: !!phone && !!token,
        isLoadingSession,
        serverUrl,
        isOnline,
        pendingPhone,
        sendOtp,
        verifyOtp,
        loginWithFirebase,
        logout,
        refreshProfile,
        updateServerUrl,
        checkConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
