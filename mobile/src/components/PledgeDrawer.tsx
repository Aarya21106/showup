import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  X,
  Flame,
  Award,
  Calendar,
  AlertTriangle,
  TrendingUp,
  CreditCard,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

interface PledgeDrawerProps {
  visible: boolean;
  onClose: () => void;
}

export const PledgeDrawer: React.FC<PledgeDrawerProps> = ({ visible, onClose }) => {
  const { profile } = useAuth();

  const dayCount = profile?.day_count ?? 1;
  const streak = profile?.streak ?? 0;
  const missedCount = profile?.missed_count ?? 0;
  const depositStatus = profile?.deposit_status ?? 'paid';
  const progressPercent = Math.min(100, Math.round((dayCount / 30) * 100));

  // Compute estimated payout
  const estimatedPayout = Math.max(0, 500 - (missedCount * 50));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Award size={20} color={Colors.primary} />
              <Text style={styles.headerTitle}>Your 30-Day Pledge Status</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Main Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressTop}>
                <View>
                  <Text style={styles.progressLabel}>CURRENT PROGRESS</Text>
                  <Text style={styles.dayBig}>Day {dayCount} <Text style={styles.dayTotal}>/ 30</Text></Text>
                </View>
                <View style={styles.percentBadge}>
                  <Text style={styles.percentText}>{progressPercent}%</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>
            </View>

            {/* Financial Stake Balance */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <View style={styles.statIconRow}>
                  <CreditCard size={15} color={Colors.primary} />
                  <Text style={styles.statLabel}>STAKE</Text>
                </View>
                <Text style={styles.statValue}>₹300</Text>
                <Text style={[styles.statStatus, depositStatus === 'paid' ? styles.statusPaid : styles.statusUnpaid]}>
                  {depositStatus === 'paid' ? '● Active' : '○ Unpaid'}
                </Text>
              </View>

              <View style={styles.statBox}>
                <View style={styles.statIconRow}>
                  <TrendingUp size={15} color={Colors.azure} />
                  <Text style={styles.statLabel}>PAYOUT OWED</Text>
                </View>
                <Text style={[styles.statValue, { color: Colors.azure }]}>₹{estimatedPayout}</Text>
                <Text style={styles.statSub}>At Day 30 finish</Text>
              </View>

              <View style={styles.statBox}>
                <View style={styles.statIconRow}>
                  <Flame size={15} color={Colors.amber} />
                  <Text style={styles.statLabel}>STREAK</Text>
                </View>
                <Text style={[styles.statValue, { color: Colors.amber }]}>{streak}</Text>
                <Text style={styles.statSub}>Consecutive</Text>
              </View>
            </View>

            {/* Accountability Penalties & Strikes */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardHeader}>
                <AlertTriangle size={16} color={Colors.coral} />
                <Text style={styles.infoCardTitle}>Accountability Rulebook</Text>
              </View>
              <Text style={styles.infoRow}>• Missed Workouts: <Text style={{ color: Colors.coral, fontWeight: '700' }}>{missedCount} slips</Text></Text>
              <Text style={styles.infoRow}>• Slip Penalty: ₹50 deducted per missed day</Text>
              <Text style={styles.infoRow}>• Free Strikes: 2 emergency buffer days included</Text>
              <Text style={styles.infoRow}>• Clean Week Reward: ₹10 discount bonus per perfect week</Text>
            </View>

            {/* Profile & Program Details */}
            <View style={styles.detailsCard}>
              <View style={styles.infoCardHeader}>
                <Calendar size={16} color={Colors.primary} />
                <Text style={styles.detailsCardTitle}>Pledge Details</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Primary Activity</Text>
                <Text style={styles.detailVal}>{profile?.activity || 'Gym / Strength'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Check-in Deadline</Text>
                <Text style={styles.detailVal}>{profile?.checkin_time || '08:00 AM'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Target Calorie Budget</Text>
                <Text style={styles.detailVal}>{profile?.target_calories || 2000} kcal/day</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Tier Status</Text>
                <Text style={[styles.detailVal, { color: Colors.primary }]}>PRO 1-ON-1 COACH</Text>
              </View>
            </View>
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
  container: {
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
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  progressCard: {
    backgroundColor: Colors.bgCardElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  dayBig: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  dayTotal: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  percentBadge: {
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  percentText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.bgMain,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.bgCardElevated,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.textMuted,
    marginLeft: 4,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    marginVertical: 2,
  },
  statStatus: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusPaid: {
    color: Colors.primary,
  },
  statusUnpaid: {
    color: Colors.coral,
  },
  statSub: {
    fontSize: 9.5,
    color: Colors.textDim,
  },
  infoCard: {
    backgroundColor: 'rgba(251, 113, 133, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.25)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.coral,
    marginLeft: 6,
  },
  infoRow: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  detailsCard: {
    backgroundColor: Colors.bgCardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  detailsCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginLeft: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailKey: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
});
