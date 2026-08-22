import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Shield, Flame, ChevronRight, Activity } from 'lucide-react-native';
import { Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../theme/useTheme';
import { useAuth } from '../context/AuthContext';

interface CustomHeaderProps {
  onOpenPledgeDrawer: () => void;
  onOpenUserModal: () => void;
}

export const CustomHeader: React.FC<CustomHeaderProps> = ({
  onOpenPledgeDrawer,
  onOpenUserModal,
}) => {
  const { profile, isOnline } = useAuth();
  const streak = profile?.streak ?? 0;
  const dayCount = profile?.day_count ?? 1;
  const Colors = useTheme();
  const styles = getStyles(Colors);

  return (
    <View style={styles.container}>
      {/* Coach Avatar & Info */}
      <TouchableOpacity
        style={styles.coachInfo}
        onPress={onOpenUserModal}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Activity size={18} color={Colors.primary} strokeWidth={2.2} />
          </View>
          <View style={[styles.onlineDot, { backgroundColor: isOnline ? Colors.online : Colors.offline }]} />
        </View>

        <View style={styles.titleGroup}>
          <View style={styles.nameRow}>
            <Text style={styles.coachName}>ShowUp Coach</Text>
            <Shield size={13} color={Colors.primary} style={styles.verifiedIcon} />
          </View>
          <Text style={styles.statusText}>
            {isOnline ? 'Online • Active' : 'Connecting to server...'}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Streak & Pledge Progress Pill */}
      <TouchableOpacity
        style={styles.pledgePill}
        onPress={onOpenPledgeDrawer}
        activeOpacity={0.7}
      >
        <View style={styles.streakRow}>
          <Flame
            size={13}
            color={streak > 0 ? Colors.amber : Colors.textMuted}
            fill={streak > 0 ? Colors.amber : 'transparent'}
          />
          <Text style={[styles.streakText, streak > 0 && styles.streakActive]}>
            {streak}
          </Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.dayText}>Day {dayCount}/30</Text>
        <ChevronRight size={12} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (Colors: ReturnType<typeof useTheme>) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 10,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bgGlass,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  coachInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgCardElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.bgCard,
  },
  titleGroup: {
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 0.1,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  statusText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  pledgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCardElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginLeft: 3,
  },
  streakActive: {
    color: Colors.amber,
  },
  divider: {
    width: 1,
    height: 10,
    backgroundColor: Colors.borderLight,
    marginRight: 6,
  },
  dayText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: Colors.primary,
    marginRight: 2,
  },
});
