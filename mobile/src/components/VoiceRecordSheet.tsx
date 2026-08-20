import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Mic, X, Check, Square, Trash2 } from 'lucide-react-native';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import { File } from 'expo-file-system';
import { Colors, Spacing, BorderRadius } from '../theme/colors';

interface VoiceRecordSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmitVoice: (audioBase64: string, mimeType: string) => Promise<void>;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const VoiceRecordSheet: React.FC<VoiceRecordSheetProps> = ({
  visible,
  onClose,
  onSubmitVoice,
}) => {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!visible) {
      // Reset state each time the sheet closes so re-opening starts fresh.
      setIsRecording(false);
      setHasRecording(false);
      setDurationMs(0);
      if (tickRef.current) clearInterval(tickRef.current);
    }
  }, [visible]);

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        alert('Microphone permission is required to record a voice message!');
        return;
      }

      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAtRef.current = Date.now();
      setIsRecording(true);
      setHasRecording(false);
      setDurationMs(0);

      tickRef.current = setInterval(() => {
        if (startedAtRef.current) {
          setDurationMs(Date.now() - startedAtRef.current);
        }
      }, 200);
    } catch (err) {
      console.error('Voice recording error:', err);
      alert('Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (tickRef.current) clearInterval(tickRef.current);
      await recorder.stop();
      setIsRecording(false);
      setHasRecording(true);
    } catch (err) {
      console.error('Voice stop-recording error:', err);
    }
  };

  const discardRecording = () => {
    setHasRecording(false);
    setDurationMs(0);
  };

  const handleSubmit = async () => {
    if (!recorder.uri) return;
    setIsSubmitting(true);
    try {
      const file = new File(recorder.uri);
      const base64 = await file.base64();
      // expo-audio's HIGH_QUALITY preset records AAC audio (in an .m4a container) —
      // Gemini's API accepts "audio/aac" but not "audio/m4a"/"audio/mp4" as a MIME type.
      await onSubmitVoice(base64, 'audio/aac');
      setHasRecording(false);
      setDurationMs(0);
      onClose();
    } catch (err) {
      console.error('Voice submit error:', err);
      alert('Failed to send voice message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    if (isSubmitting) return;
    if (isRecording) {
      recorder.stop().catch(() => {});
      if (tickRef.current) clearInterval(tickRef.current);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Mic size={18} color={Colors.primary} />
              <Text style={styles.title}>Voice Message</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
              <X size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.helperText}>
            Talk to your coach — record a voice message and I'll listen and reply.
          </Text>

          <View style={styles.recordArea}>
            <View style={[styles.micCircle, isRecording && styles.micCircleActive]}>
              <Mic size={36} color={isRecording ? Colors.bgMain : Colors.primary} />
            </View>
            <Text style={styles.durationText}>{formatDuration(durationMs)}</Text>
            {isRecording && <Text style={styles.recordingLabel}>Recording...</Text>}
            {hasRecording && !isRecording && <Text style={styles.recordingLabel}>Ready to send</Text>}
          </View>

          <View style={styles.controlsRow}>
            {!isRecording && !hasRecording && (
              <TouchableOpacity style={styles.primaryControl} onPress={startRecording} activeOpacity={0.85}>
                <Mic size={20} color={Colors.bgMain} strokeWidth={2.5} />
                <Text style={styles.primaryControlText}>Start Recording</Text>
              </TouchableOpacity>
            )}

            {isRecording && (
              <TouchableOpacity style={[styles.primaryControl, styles.stopControl]} onPress={stopRecording} activeOpacity={0.85}>
                <Square size={18} color={Colors.bgMain} strokeWidth={2.5} fill={Colors.bgMain} />
                <Text style={styles.primaryControlText}>Stop</Text>
              </TouchableOpacity>
            )}

            {hasRecording && !isRecording && (
              <>
                <TouchableOpacity style={styles.discardButton} onPress={discardRecording} activeOpacity={0.8}>
                  <Trash2 size={18} color={Colors.coral} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryControl, isSubmitting && styles.disabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.bgMain} />
                  ) : (
                    <>
                      <Check size={20} color={Colors.bgMain} strokeWidth={2.5} />
                      <Text style={styles.primaryControlText}>Send to Coach</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: Spacing.lg,
  },
  recordArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  micCircle: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySubtle,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  micCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryBright,
  },
  durationText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  recordingLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  primaryControl: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  stopControl: {
    backgroundColor: Colors.coral,
    shadowColor: Colors.coral,
  },
  disabled: {
    opacity: 0.6,
  },
  primaryControlText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.bgMain,
    marginLeft: 6,
  },
  discardButton: {
    width: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.coralSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
