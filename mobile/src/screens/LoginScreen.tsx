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
  Image,
  useColorScheme,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { Server } from 'lucide-react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/useTheme';

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
  const Colors = useTheme();
  const styles = getStyles(Colors);
  const isDark = useColorScheme() === 'dark';

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
            <Image
              source={isDark ? require('../../assets/logo-white.png') : require('../../assets/logo-black.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandSubtitle}>Your AI accountability coach</Text>
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
            <View style={[styles.statusDot, { backgroundColor: isOnline ? Colors.online : Colors.offline }]} />
            <Server size={14} color={Colors.textMuted} />
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
                placeholderTextColor={Colors.textDim}
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

const getStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 176,
    height: 68,
  },
  brandSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 16,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  cardSubheading: {
    fontSize: 13,
    color: Colors.textMuted,
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
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
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
    color: Colors.textMuted,
  },
  serverConfigCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serverConfigLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  serverInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: 10,
    padding: 10,
    color: Colors.text,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  serverBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  serverSaveBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.bgCardElevated,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  serverTestBtnText: {
    color: Colors.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  footerText: {
    textAlign: 'center',
    color: Colors.textDim,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 24,
  },
});
