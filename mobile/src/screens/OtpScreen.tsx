import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { KeyRound, ArrowLeft, CheckCircle2, RotateCw } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

interface OtpScreenProps {
  onBack: () => void;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({ onBack }) => {
  const { pendingPhone, verifyOtp, sendOtp } = useAuth();
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (otpCode.trim().length !== 6) {
      Alert.alert('Incomplete Code', 'Please enter the 6-digit verification code.');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const res = await verifyOtp(otpCode.trim());
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Verification Failed', res.message || 'Invalid or expired OTP code.');
      }
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.response?.data?.error || err.message || 'Failed to verify OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || !pendingPhone) return;
    try {
      setResending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const res = await sendOtp(pendingPhone);
      if (res.success) {
        setCountdown(30);
        Alert.alert('OTP Resent', 'A new verification code has been generated.');
      } else {
        Alert.alert('Error', res.message || 'Failed to resend OTP.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#F8FAFC" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>

          {/* Header Icon */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}
            >
              <KeyRound size={28} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.title}>Enter 6-Digit Code</Text>
            <Text style={styles.subtitle}>
              Verification code sent to{' '}
              <Text style={{ color: '#10B981', fontWeight: '700' }}>{pendingPhone}</Text>
            </Text>
          </View>

          {/* OTP Input Card */}
          <View style={styles.card}>
            {/* Hidden Real Input */}
            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={(val) => {
                setOtpCode(val);
                if (val.length === 6) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              autoFocus={true}
            />

            {/* Visual Digit Boxes */}
            <TouchableOpacity
              style={styles.boxesContainer}
              onPress={() => inputRef.current?.focus()}
              activeOpacity={1}
            >
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const char = otpCode[index] || '';
                const isFocused = otpCode.length === index || (otpCode.length === 6 && index === 5);
                return (
                  <View
                    key={index}
                    style={[
                      styles.digitBox,
                      char ? styles.digitBoxFilled : null,
                      isFocused ? styles.digitBoxActive : null,
                    ]}
                  >
                    <Text style={styles.digitText}>{char}</Text>
                  </View>
                );
              })}
            </TouchableOpacity>

            {/* Verify Button */}
            <TouchableOpacity
              style={[styles.submitButton, (loading || otpCode.length !== 6) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading || otpCode.length !== 6}
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
                    <CheckCircle2 size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>Verify & Start Journey</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Resend Row */}
            <View style={styles.resendRow}>
              {countdown > 0 ? (
                <Text style={styles.resendTimerText}>
                  Resend code in <Text style={{ color: '#10B981', fontWeight: '700' }}>{countdown}s</Text>
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resending}
                  style={styles.resendActiveBtn}
                >
                  <RotateCw size={14} color="#10B981" style={{ marginRight: 6 }} />
                  <Text style={styles.resendActiveText}>
                    {resending ? 'Sending...' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 6,
  },
  backBtnText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
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
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  boxesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  digitBox: {
    width: 44,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitBoxFilled: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  digitBoxActive: {
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  digitText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
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
    opacity: 0.5,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 20,
  },
  resendTimerText: {
    fontSize: 13,
    color: '#64748B',
  },
  resendActiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendActiveText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700',
  },
});
