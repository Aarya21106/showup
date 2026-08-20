import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { X, Server, Phone, RotateCcw, Check, Sparkles, Bell, BellOff, Trash2 } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { enablePushNotifications, getNotificationPermissionStatus } from '../utils/notifications';

interface UserModalProps {
  visible: boolean;
  onClose: () => void;
  onResetChat?: () => void;
  onClearChat?: () => void;
}

export const UserModal: React.FC<UserModalProps> = ({
  visible,
  onClose,
  onResetChat,
  onClearChat,
}) => {
  const { phone, serverUrl, updateServerUrl, logout } = useAuth();
  const [inputUrl, setInputUrl] = useState(serverUrl || 'http://10.131.110.142:3000');
  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isEnablingNotifs, setIsEnablingNotifs] = useState(false);

  useEffect(() => {
    if (visible) {
      getNotificationPermissionStatus().then((status) => {
        setNotifStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
      });
    }
  }, [visible]);

  const handleSave = () => {
    if (inputUrl.trim()) {
      updateServerUrl(inputUrl.trim());
    }
    onClose();
  };

  const handleEnableNotifications = async () => {
    setIsEnablingNotifs(true);
    const result = await enablePushNotifications();
    setIsEnablingNotifs(false);
    if (result.status === 'enabled') {
      setNotifStatus('granted');
    } else if (result.status === 'denied') {
      setNotifStatus('denied');
      Alert.alert(
        'Notifications Off',
        'You can enable them anytime from your phone Settings > Apps > ShowUp > Notifications.'
      );
    } else {
      Alert.alert('Could Not Enable Notifications', result.message);
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat?',
      'This clears the conversation view on this device only. Your profile, streak, and progress are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            onClearChat && onClearChat();
            onClose();
          },
        },
      ]
    );
  };

  const handleResetConversation = () => {
    Alert.alert(
      'Reset User Progress?',
      'This sends a reset trigger to clear check-ins and restart onboarding from Question 1.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            onResetChat && onResetChat();
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sparkles size={18} color={Colors.primary} />
              <Text style={styles.title}>Account & Server Config</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Active Account Phone Number */}
          <Text style={styles.fieldLabel}>LOGGED IN ACCOUNT</Text>
          <View style={styles.inputBox}>
            <Phone size={16} color={Colors.primary} style={styles.inputIcon} />
            <Text style={[styles.textInput, { paddingTop: 12, fontWeight: '700' }]}>
              {phone || 'Not logged in'}
            </Text>
          </View>

          {/* Backend API Server URL */}
          <Text style={styles.fieldLabel}>BACKEND REST API URL</Text>
          <View style={styles.inputBox}>
            <Server size={16} color={Colors.azure} style={styles.inputIcon} />
            <TextInput
              style={styles.textInput}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="http://10.0.2.2:3000 or tunnel URL"
              placeholderTextColor={Colors.textDim}
              autoCapitalize="none"
            />
          </View>
          <Text style={styles.helperText}>
            • Android Emulator: http://10.0.2.2:3000
            {'\n'}• Physical iPhone/Android: Use your PC IP or Cloudflare/ngrok tunnel URL
          </Text>

          {/* Action Buttons */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.85}>
            <Check size={18} color={Colors.bgMain} strokeWidth={2.5} />
            <Text style={styles.saveButtonText}>Save & Apply</Text>
          </TouchableOpacity>

          {/* Reminders / Push Notifications */}
          <TouchableOpacity
            style={[styles.notifButton, notifStatus === 'granted' && styles.notifButtonEnabled]}
            onPress={handleEnableNotifications}
            activeOpacity={0.85}
            disabled={isEnablingNotifs || notifStatus === 'granted'}
          >
            {isEnablingNotifs ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : notifStatus === 'granted' ? (
              <>
                <Bell size={17} color={Colors.primary} />
                <Text style={styles.notifButtonTextEnabled}>Reminders Enabled</Text>
              </>
            ) : (
              <>
                <BellOff size={17} color={Colors.text} />
                <Text style={styles.notifButtonText}>Allow Reminder Notifications</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign Out / Switch Account */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await logout();
              onClose();
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>Sign Out / Switch Account</Text>
          </TouchableOpacity>

          {/* Clear Chat — local device view only, never touches saved progress */}
          <TouchableOpacity
            style={styles.clearChatButton}
            onPress={handleClearChat}
            activeOpacity={0.8}
          >
            <Trash2 size={15} color={Colors.textSecondary} />
            <Text style={styles.clearChatButtonText}>Clear Chat (this device only)</Text>
          </TouchableOpacity>

          {/* Reset Onboarding / Chat */}
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetConversation}
            activeOpacity={0.8}
          >
            <RotateCcw size={16} color={Colors.coral} />
            <Text style={styles.resetButtonText}>Restart Onboarding (/reset)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 46,
    marginBottom: 4,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  textInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 13.5,
  },
  helperText: {
    fontSize: 10.5,
    color: Colors.textDim,
    lineHeight: 15,
    marginBottom: Spacing.lg,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.bgMain,
    marginLeft: 6,
  },
  notifButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: BorderRadius.md,
    height: 44,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  notifButtonEnabled: {
    backgroundColor: Colors.primarySubtle,
    borderColor: Colors.borderGlow,
  },
  notifButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
    marginLeft: 8,
  },
  notifButtonTextEnabled: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 8,
  },
  clearChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 2,
  },
  clearChatButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: BorderRadius.md,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoutButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  resetButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.coral,
    marginLeft: 6,
  },
});
