import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { ShieldCheck, Server } from 'lucide-react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  onOtpSent: () => void;
}

const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;

let googleConfigured = false;
function ensureGoogleConfigured() {
  if (googleConfigured) return;
  if (GOOGLE_WEB_CLIENT_ID && !GOOGLE_WEB_CLIENT_ID.startsWith('REPLACE_WITH_')) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    googleConfigured = true;
  }
}

export const LoginScreen: React.FC<LoginScreenProps> = () => {
  const { loginWithGoogle, serverUrl, updateServerUrl, isOnline, checkConnection } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(serverUrl);

  useEffect(() => {
    ensureGoogleConfigured();
  }, []);

  const handleGoogleSignIn = async () => {
    if (!GOOGLE_WEB_CLIENT_ID || GOOGLE_WEB_CLIENT_ID.startsWith('REPLACE_WITH_')) {
      Alert.alert(
        'Google Sign-In Not Configured',
        'The app is missing its Google Web Client ID. Set extra.googleWebClientId in app.json.'
      );
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      ensureGoogleConfigured();

      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();

      if (response.type !== 'success' || !response.data?.idToken) {
        setLoading(false);
        return; // user cancelled or dismissed
      }

      await loginWithGoogle(response.data.idToken);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
        // silent — user backed out
      } else if (err?.code === statusCodes.IN_PROGRESS) {
        // a sign-in is already in flight — ignore
      } else {
        Alert.alert('Sign-In Failed', err?.message || 'Could not sign in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServerUrl = async () => {
    if (!customUrl.trim()) return;
    await updateServerUrl(customUrl);
    setShowServerConfig(false);
    Alert.alert('Server Updated', `Connecting to ${customUrl}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header Brand */}
          <View style={styles.brandContainer}>
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <ShieldCheck size={32} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.brandTitle}>ShowUp</Text>
            <Text style={styles.brandSubtitle}>Your AI Accountability Coach</Text>
            <View style={styles.tagBadge}>
              <Text style={styles.tagText}>30-Day Fitness Pledge</Text>
            </View>
          </View>

          {/* Login Card */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Sign In</Text>
            <Text style={styles.cardSubheading}>
              Sign in with your Google account to log in or create your profile.
            </Text>

            <TouchableOpacity
              style={[styles.googleButton, loading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#1F2937" />
              ) : (
                <>
                  <View style={styles.googleIconCircle}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Server Config Toggle */}
          <TouchableOpacity
            style={styles.serverToggle}
            onPress={() => setShowServerConfig(!showServerConfig)}
          >
            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]} />
            <Server size={14} color="#94A3B8" />
            <Text style={styles.serverToggleText}>
              Backend: {isOnline ? 'Connected' : 'Offline'} ({serverUrl.replace(/https?:\/\//, '').slice(0, 24)}...)
            </Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverConfigCard}>
              <Text style={styles.serverConfigLabel}>Server Backend URL:</Text>
              <TextInput
                style={styles.serverInput}
                value={customUrl}
                onChangeText={setCustomUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://10.131.110.142:3000"
                placeholderTextColor="#64748B"
              />
              <View style={styles.serverBtnRow}>
                <TouchableOpacity style={styles.serverSaveBtn} onPress={handleSaveServerUrl}>
                  <Text style={styles.serverSaveBtnText}>Save & Reconnect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.serverTestBtn} onPress={checkConnection}>
                  <Text style={styles.serverTestBtnText}>Test Ping</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Footer Notice */}
          <Text style={styles.footerText}>
            By continuing, you agree to ShowUp's 30-day accountability rules and deposit terms.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    marginTop: 4,
  },
  tagBadge: {
    marginTop: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  tagText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  cardSubheading: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  googleIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  googleIconText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
  },
  serverToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  serverToggleText: {
    fontSize: 12,
    color: '#64748B',
  },
  serverConfigCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  serverConfigLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
  },
  serverInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 10,
    color: '#F8FAFC',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 10,
  },
  serverBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  serverSaveBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  serverSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  serverTestBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  serverTestBtnText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 12,
  },
  footerText: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 24,
  },
});
