import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Text,
  ActivityIndicator,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';
import { ArrowUp, Image as ImageIcon, MessageSquare, Utensils, Activity, Calendar, Mic, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAudioRecorder, AudioModule } from 'expo-audio';
import { File } from 'expo-file-system';
import { Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../theme/useTheme';
import { VOICE_RECORDING_OPTIONS, voiceMimeTypeForPlatform } from '../utils/voiceRecordingOptions';

interface FloatingInputBarProps {
  onSendMessage: (text: string) => void;
  onAttachPhoto: (caption?: string) => void;
  onSubmitVoice?: (audioBase64: string, mimeType: string) => Promise<void>;
  canUseVoice?: boolean;
  isLoading?: boolean;
}

const QUICK_ACTIONS = [
  { id: 'diet', label: 'Log Meal', icon: Utensils, prompt: 'I ate: ' },
  { id: 'diet_chart', label: 'Diet Chart', icon: ImageIcon, isAttach: true, caption: 'Here is my diet chart' },
  { id: 'burn', label: 'Log Activity', icon: Activity, prompt: 'I burned calories doing: ' },
  { id: 'schedule', label: 'Timetable', icon: Calendar, prompt: 'Show me my fitness timetable.' },
  { id: 'advice', label: 'Ask Coach', icon: MessageSquare, prompt: 'Coach, ' },
];

// Below this, a press is treated as accidental (a stray tap) and discarded
// instead of sending a near-silent blip of audio.
const MIN_RECORDING_MS = 400;
// Sliding the finger this far up from the mic button arms cancel-on-release,
// matching the WhatsApp "slide up to cancel" convention.
const CANCEL_DRAG_THRESHOLD = 60;

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const FloatingInputBar: React.FC<FloatingInputBarProps> = ({
  onSendMessage,
  onAttachPhoto,
  onSubmitVoice,
  canUseVoice = false,
  isLoading = false,
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [isSubmittingVoice, setIsSubmittingVoice] = useState(false);
  const Colors = useTheme();
  const styles = getStyles(Colors);

  const recorder = useAudioRecorder(VOICE_RECORDING_OPTIONS);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [isRecording]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {}

    onSendMessage(trimmed);
    setText('');
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    if (action.isAttach) {
      onAttachPhoto(action.caption);
      return;
    }
    setText(action.prompt || '');
  };

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone permission needed', 'Enable microphone access to send voice messages.');
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      cancelledRef.current = false;
      setIsCancelling(false);
      setDurationMs(0);
      setIsRecording(true);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (e) {}
      tickRef.current = setInterval(() => {
        if (startedAtRef.current) setDurationMs(Date.now() - startedAtRef.current);
      }, 200);
    } catch (err) {
      console.error('Voice recording error:', err);
      setIsRecording(false);
    }
  };

  const finishRecording = async (cancelled: boolean) => {
    if (tickRef.current) clearInterval(tickRef.current);
    const finalDuration = startedAtRef.current ? Date.now() - startedAtRef.current : 0;
    setIsRecording(false);
    setIsCancelling(false);

    try {
      await recorder.stop();
    } catch (err) {
      console.error('Voice stop-recording error:', err);
      return;
    }

    if (cancelled || finalDuration < MIN_RECORDING_MS) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch (e) {}
      return;
    }

    if (!recorder.uri || !onSubmitVoice) return;

    setIsSubmittingVoice(true);
    try {
      const file = new File(recorder.uri);
      const base64 = await file.base64();
      await onSubmitVoice(base64, voiceMimeTypeForPlatform());
    } catch (err) {
      console.error('Voice submit error:', err);
      Alert.alert('Failed to send voice message', 'Please try again.');
    } finally {
      setIsSubmittingVoice(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => canUseVoice && !isLoading && !isSubmittingVoice,
      onPanResponderGrant: () => {
        startRecording();
      },
      onPanResponderMove: (_evt, gestureState) => {
        const shouldCancel = gestureState.dy < -CANCEL_DRAG_THRESHOLD;
        cancelledRef.current = shouldCancel;
        setIsCancelling(shouldCancel);
      },
      onPanResponderRelease: () => {
        finishRecording(cancelledRef.current);
      },
      onPanResponderTerminate: () => {
        finishRecording(true);
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      {/* Quick Action Suggestion Chips */}
      {!isRecording && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <TouchableOpacity
                key={action.id}
                style={styles.chip}
                onPress={() => handleQuickAction(action)}
                activeOpacity={0.7}
              >
                <Icon size={12} color={Colors.textSecondary} style={styles.chipIcon} />
                <Text style={styles.chipText}>{action.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Input Row */}
      <View style={styles.inputRow}>
        {isRecording ? (
          <View style={[styles.recordingBar, isCancelling && styles.recordingBarCancelling]}>
            <Animated.View style={[styles.recDot, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.recordingTime}>{formatDuration(durationMs)}</Text>
            {isCancelling ? (
              <View style={styles.cancelHintRow}>
                <Trash2 size={13} color={Colors.coral} />
                <Text style={styles.cancelHintText}>Release to cancel</Text>
              </View>
            ) : (
              <Text style={styles.recordingHint}>Slide up to cancel</Text>
            )}
          </View>
        ) : (
          <>
            {/* Attach Photo Button */}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => onAttachPhoto()}
              activeOpacity={0.7}
              accessibilityLabel="Attach Photo"
            >
              <ImageIcon size={19} color={Colors.primary} strokeWidth={2} />
            </TouchableOpacity>

            {/* Text Input */}
            <TextInput
              style={styles.input}
              placeholder="Message Coach..."
              placeholderTextColor={Colors.textDim}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
            />
          </>
        )}

        {/* Voice Message Button — Pro only. Hold to record, release to send,
            slide up to cancel — matches WhatsApp's press-and-hold convention. */}
        {canUseVoice && text.trim().length === 0 && (
          <View
            style={[styles.cameraButton, isRecording && styles.micButtonActive]}
            {...panResponder.panHandlers}
            accessibilityLabel="Hold to record a voice message"
          >
            {isSubmittingVoice ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Mic size={19} color={isRecording ? Colors.bgMain : Colors.primary} strokeWidth={2} />
            )}
          </View>
        )}

        {/* Send Button */}
        {!isRecording && (
          <TouchableOpacity
            style={[
              styles.sendButton,
              text.trim().length > 0 ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={text.trim().length === 0 || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.bgMain} />
            ) : (
              <ArrowUp
                size={17}
                color={text.trim().length > 0 ? Colors.bgMain : Colors.textDim}
                strokeWidth={2.5}
              />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const getStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    backgroundColor: Colors.bgGlass,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 16,
    paddingTop: 6,
  },
  chipsScroll: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 6,
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCardElevated,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipIcon: {
    marginRight: 5,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgCardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  micButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    transform: [{ scale: 1.15 }],
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  recordingBarCancelling: {
    borderColor: Colors.coral,
  },
  recDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.coral,
    marginRight: 10,
  },
  recordingTime: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
    marginRight: 12,
  },
  recordingHint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  cancelHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cancelHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.coral,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.bgCardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
