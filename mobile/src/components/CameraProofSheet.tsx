import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Camera, Image as ImageIcon, X, Sparkles, AlertCircle, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

interface CameraProofSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmitProof: (imageBase64: string, caption: string, imageUri: string) => Promise<void>;
}

export const CameraProofSheet: React.FC<CameraProofSheetProps> = ({
  visible,
  onClose,
  onSubmitProof,
}) => {
  const { profile } = useAuth();
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const gestureName = profile?.current_gesture
    ? profile.current_gesture.replace('-', ' ').toUpperCase()
    : 'PEACE SIGN';

  const handleTakePic = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        alert('Camera permission is required to take workout proof!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        setSelectedImage({
          uri: result.assets[0].uri,
          base64: result.assets[0].base64,
        });
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const handlePickGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alert('Gallery permission is required to upload screenshots!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0].base64) {
        setSelectedImage({
          uri: result.assets[0].uri,
          base64: result.assets[0].base64,
        });
      }
    } catch (err) {
      console.error('Gallery picker error:', err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage) return;
    setIsSubmitting(true);
    try {
      await onSubmitProof(selectedImage.base64, caption.trim(), selectedImage.uri);
      setSelectedImage(null);
      setCaption('');
      onClose();
    } catch (e) {
      alert('Failed to submit proof. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDismiss = () => {
    if (isSubmitting) return;
    setSelectedImage(null);
    setCaption('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Sparkles size={18} color={Colors.primary} />
              <Text style={styles.title}>Submit Daily Check-in</Text>
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
              <X size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Gesture / Requirement Banner */}
            <View style={styles.gestureBanner}>
              <View style={styles.gestureIconCircle}>
                <Text style={styles.gestureEmoji}>✌️</Text>
              </View>
              <View style={styles.gestureContent}>
                <Text style={styles.gestureTitle}>TODAY'S GESTURE: {gestureName}</Text>
                <Text style={styles.gestureSubtitle}>
                  For Gym/Home: Hold up the gesture in your photo.
                  {'\n'}For Running/Cycling: Upload your Strava/Fit screenshot.
                </Text>
              </View>
            </View>

            {/* Selected Image Preview */}
            {selectedImage ? (
              <View style={styles.previewContainer}>
                <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setSelectedImage(null)}
                >
                  <X size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              /* Selection Actions */
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handleTakePic}
                  activeOpacity={0.8}
                >
                  <View style={styles.iconCircle}>
                    <Camera size={26} color={Colors.primary} />
                  </View>
                  <Text style={styles.actionTitle}>Take Selfie</Text>
                  <Text style={styles.actionSub}>With gesture proof</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={handlePickGallery}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { borderColor: Colors.azure }]}>
                    <ImageIcon size={26} color={Colors.azure} />
                  </View>
                  <Text style={styles.actionTitle}>Cardio Screenshot</Text>
                  <Text style={styles.actionSub}>Strava / Apple Fit</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Optional Caption */}
            {selectedImage && (
              <View style={styles.captionContainer}>
                <TextInput
                  style={styles.captionInput}
                  placeholder="Add note (e.g., Chest & Triceps completed, 45 mins)..."
                  placeholderTextColor={Colors.textDim}
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                />
              </View>
            )}

            {/* Submit Button */}
            {selectedImage && (
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={Colors.bgMain} />
                ) : (
                  <>
                    <Check size={18} color={Colors.bgMain} strokeWidth={2.5} />
                    <Text style={styles.submitButtonText}>Verify & Send Check-in</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
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
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
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
  gestureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCardElevated,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  gestureIconCircle: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  gestureEmoji: {
    fontSize: 20,
  },
  gestureContent: {
    flex: 1,
  },
  gestureTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  gestureSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.bgCardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgMain,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  actionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  previewContainer: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: BorderRadius.full,
    padding: 6,
  },
  captionContainer: {
    marginBottom: Spacing.md,
  },
  captionInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 13.5,
    minHeight: 60,
  },
  submitButton: {
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
    marginBottom: Spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.bgMain,
    marginLeft: 6,
  },
});
