import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {
  CheckCheck,
  Camera,
  ExternalLink,
  Flame,
  Utensils,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { ChatMessage } from '../api/client';

interface MessageBubbleProps {
  message: ChatMessage;
  onOpenCheckinCamera?: () => void;
  onImagePress?: (url: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onOpenCheckinCamera,
  onImagePress,
}) => {
  const isUser = message.role === 'user';
  const text = message.text;

  // Format time (e.g., 07:18)
  const formattedTime = (() => {
    try {
      const d = new Date(message.created_at || Date.now());
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      return '';
    }
  })();

  // Detect special cards
  const isPaymentLink = !isUser && (text.includes('razorpay.me') || text.includes('deposit'));
  const isGesturePrompt =
    !isUser &&
    (text.includes('Daily reminder: Please submit your workout proof') ||
      (text.toLowerCase().includes('workout proof') &&
        (text.includes('finger') ||
          text.includes('hand sign') ||
          text.includes('sign') ||
          text.includes('pose') ||
          text.includes('holding up'))) ||
      (text.toLowerCase().includes('daily gesture') && text.toLowerCase().includes('weights')));
  const isDietLog = !isUser && text.includes('Diet Logged') && text.includes('kcal');
  const isBurnLog = !isUser && text.includes('Activity Logged') && text.includes('Burned');

  const paymentUrlMatch = text.match(/(https?:\/\/[^\s]+(?:razorpay|pay)[^\s]*)/i);
  const paymentUrl = paymentUrlMatch ? paymentUrlMatch[1] : null;

  // Clean raw payment URL from text so only the clean card button is shown
  const displayBodyText = paymentUrl
    ? text.replace(paymentUrl, '').replace(/\n\s*\n\s*\n/g, '\n\n').trim()
    : text;

  const gestureMatch = text.match(/(one-finger|two-fingers|three-fingers|four-fingers|open-palm|thumbs-up|fist|yo-yo|spiderman|peace-sign|ok-sign|rock-on|gun-finger|crossed-fingers|l-shape|1 finger|2 fingers|3 fingers|4 fingers|5 fingers)/i);
  const gestureName = gestureMatch ? gestureMatch[1].replace('-', ' ').toUpperCase() : null;

  const handleOpenPayment = () => {
    if (paymentUrl) {
      Linking.openURL(paymentUrl).catch(() => {});
    }
  };

  return (
    <View style={[styles.container, isUser ? styles.userAlign : styles.botAlign]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
        
        {/* Attached Photo Preview */}
        {(message.imageUri || message.media_url) && (
          <TouchableOpacity
            style={styles.imageContainer}
            onPress={() => onImagePress && onImagePress(message.imageUri || message.media_url || '')}
            activeOpacity={0.85}
          >
            <Image
              source={{ uri: message.imageUri || message.media_url || '' }}
              style={styles.attachedImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        )}

        {/* Message Body Text */}
        {displayBodyText ? (
          <Text style={[styles.bodyText, isUser ? styles.userText : styles.botText]}>
            {displayBodyText}
          </Text>
        ) : null}

        {/* Action Card: Payment Link */}
        {isPaymentLink && paymentUrl && (
          <TouchableOpacity
            style={styles.cardCTA}
            onPress={handleOpenPayment}
            activeOpacity={0.85}
          >
            <View style={styles.cardCTAContent}>
              <Text style={styles.cardCTATitle}>Pay ₹300 Refundable Deposit</Text>
              <Text style={styles.cardCTASubtitle}>Tap to open secure payment</Text>
            </View>
            <ExternalLink size={17} color={Colors.bgMain} />
          </TouchableOpacity>
        )}

        {/* Action Card: Gesture Check-in */}
        {isGesturePrompt && onOpenCheckinCamera && (
          <TouchableOpacity
            style={styles.cardGesture}
            onPress={onOpenCheckinCamera}
            activeOpacity={0.8}
          >
            <Camera size={16} color={Colors.primary} />
            <View style={styles.cardGestureContent}>
              <Text style={styles.cardGestureTitle}>
                {gestureName ? `Pose with ${gestureName}` : 'Submit Check-in Proof'}
              </Text>
              <Text style={styles.cardGestureSubtitle}>Tap to open camera</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Action Card: Nutrition Badge */}
        {isDietLog && (
          <View style={styles.cardDiet}>
            <Utensils size={14} color={Colors.primary} />
            <Text style={styles.cardDietText}>Nutrition Logged</Text>
          </View>
        )}

        {/* Action Card: Burn Badge */}
        {isBurnLog && (
          <View style={styles.cardBurn}>
            <Flame size={14} color={Colors.amber} />
            <Text style={styles.cardBurnText}>Activity Recorded</Text>
          </View>
        )}

        {/* Footer: Timestamp & Checkmarks */}
        <View style={styles.footerRow}>
          <Text style={styles.timeText}>{formattedTime}</Text>
          {isUser && (
            <CheckCheck
              size={13}
              color={message.status === 'delivered' ? Colors.tickActive : Colors.tickSent}
            />
          )}
        </View>

      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 3,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
  },
  userAlign: {
    justifyContent: 'flex-end',
  },
  botAlign: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
  },
  userBubble: {
    backgroundColor: Colors.userBubbleBg,
    borderWidth: 1,
    borderColor: Colors.userBubbleBorder,
    borderBottomRightRadius: 2,
  },
  botBubble: {
    backgroundColor: Colors.botBubbleBg,
    borderWidth: 1,
    borderColor: Colors.botBubbleBorder,
    borderBottomLeftRadius: 2,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCardElevated,
  },
  attachedImage: {
    width: '100%',
    height: '100%',
  },
  bodyText: {
    fontSize: 14.5,
    lineHeight: 20.5,
  },
  userText: {
    color: Colors.text,
    fontWeight: '400',
  },
  botText: {
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: Colors.textDim,
    marginRight: 4,
  },
  cardCTA: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardCTAContent: {
    flex: 1,
  },
  cardCTATitle: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.bgMain,
  },
  cardCTASubtitle: {
    fontSize: 10.5,
    color: '#064E3B',
    marginTop: 1,
  },
  cardGesture: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgCardElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardGestureContent: {
    marginLeft: Spacing.sm,
  },
  cardGestureTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  cardGestureSubtitle: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  cardDiet: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  cardDietText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primary,
    marginLeft: 6,
  },
  cardBurn: {
    marginTop: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.amberSubtle,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  cardBurnText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.amber,
    marginLeft: 6,
  },
});
