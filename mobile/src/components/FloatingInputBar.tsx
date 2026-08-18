import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Text,
  ActivityIndicator,
} from 'react-native';
import { ArrowUp, Image as ImageIcon, MessageSquare, Utensils, Activity, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, BorderRadius } from '../theme/colors';

interface FloatingInputBarProps {
  onSendMessage: (text: string) => void;
  onAttachPhoto: (caption?: string) => void;
  isLoading?: boolean;
}

const QUICK_ACTIONS = [
  { id: 'diet', label: 'Log Meal', icon: Utensils, prompt: 'I ate: ' },
  { id: 'diet_chart', label: 'Diet Chart', icon: ImageIcon, isAttach: true, caption: 'Here is my diet chart' },
  { id: 'burn', label: 'Log Activity', icon: Activity, prompt: 'I burned calories doing: ' },
  { id: 'schedule', label: 'Timetable', icon: Calendar, prompt: 'Show me my fitness timetable.' },
  { id: 'advice', label: 'Ask Coach', icon: MessageSquare, prompt: 'Coach, ' },
];

export const FloatingInputBar: React.FC<FloatingInputBarProps> = ({
  onSendMessage,
  onAttachPhoto,
  isLoading = false,
}) => {
  const [text, setText] = useState('');

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

  return (
    <View style={styles.container}>
      {/* Quick Action Suggestion Chips */}
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

      {/* Input Row */}
      <View style={styles.inputRow}>
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

        {/* Send Button */}
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
