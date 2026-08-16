import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Smartphone, ArrowRight, ShieldCheck, Server, Globe } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';

interface LoginScreenProps {
  onOtpSent: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOtpSent }) => {
  const { sendOtp, serverUrl, updateServerUrl, isOnline, checkConnection } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customUrl, setCustomUrl] = useState(serverUrl);

  const handleSendOtp = async () => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length < 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const formatted = cleaned.length === 10 ? `+91${cleaned}` : `+${cleaned}`;
      const res = await sendOtp(formatted);

      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onOtpSent();
      } else {
        Alert.alert('Error', res.message || 'Failed to send OTP. Please check your connection.');
      }
    } catch (err: any) {
      Alert.alert('Connection Error', err.response?.data?.error || err.message || 'Failed to connect to ShowUp server.');
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
            <Text style={styles.cardHeading}>Enter Mobile Number</Text>
            <Text style={styles.cardSubheading}>
              We will send you a 6-digit verification code to log in or create your profile.
            </Text>

            {/* Phone Input */}
            <View style={styles.inputRow}>
              <View style={styles.countryCodeBadge}>
                <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="98765 43210"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                maxLength={10}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                autoFocus={true}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>Get Verification Code</Text>
                    <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                  </>
                )}
              </LinearGradient>
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  countryCodeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  countryCodeText: {
    color: '#E2E8F0',
    fontWeight: '600',
    fontSize: 15,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    color: '#F8FAFC',
    fontWeight: '600',
    letterSpacing: 1,
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
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
