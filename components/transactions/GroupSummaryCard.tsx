/**
 * GroupSummaryCard Component
 * 
 * Displays a premium summary card for a transaction group.
 * Optimized for readability and professional aesthetics.
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, Platform } from 'react-native';
import { TransactionGroup } from '@/types/grouping';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { ChevronRight, Layers, FileText } from 'lucide-react-native';

/**
 * Props for GroupSummaryCard component
 */
export interface GroupSummaryCardProps {
  group: TransactionGroup;
  onPress: () => void;
  style?: ViewStyle;
  showDate?: boolean;
  compact?: boolean;
}

/**
 * GroupSummaryCard component
 */
export const GroupSummaryCard = memo<GroupSummaryCardProps>(({
  group,
  onPress,
  style,
  showDate = false,
  compact = false
}) => {
  const { theme } = useTheme();
  const colors = useThemeColors();

  const formatAmount = (amount: number): string => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = `K${absAmount.toLocaleString()}`;
    return isNegative ? `-${formatted}` : formatted;
  };

  const getDisplayDescription = (): string => {
    return group.description || group.category || 'Uncategorized';
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    } catch (error) {
      return dateString;
    }
  };

  const isPositive = group.totalAmount >= 0;
  const amountColor = isPositive ? '#10b981' : '#ef4444';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.compactContainer,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.borderColor,
        },
        style
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.mainContent}>
          <View style={styles.leftSection}>
            <View style={styles.titleContainer}>
              <Text 
                style={[
                  styles.description, 
                  compact && styles.compactDescription,
                  { color: colors.textColor }
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {getDisplayDescription()}
              </Text>
              
              {!compact && group.transactionCount > 1 && (
                <View style={styles.badge}>
                  <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                    {group.transactionCount}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.metadataRow}>
              {group.category && group.category !== group.description && (
                <Text style={[styles.category, { color: colors.textSecondary }]} numberOfLines={1}>
                  {group.category}
                </Text>
              )}
              {showDate && (
                <>
                  {group.category && group.category !== group.description && (
                    <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
                  )}
                  <Text style={[styles.date, { color: colors.textSecondary }]}>
                    {formatDate(group.date)}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.rightSection}>
            <Text 
              style={[
                styles.amount,
                compact && styles.compactAmount,
                { color: amountColor }
              ]}
            >
              {formatAmount(group.totalAmount)}
            </Text>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={3} />
          </View>
        </View>

        {compact && group.transactionCount > 1 && (
          <View style={[styles.multiBadge, { backgroundColor: colors.backgroundColor }]}>
            <Layers size={8} color={colors.textSecondary} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

GroupSummaryCard.displayName = 'GroupSummaryCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  compactContainer: {
    marginVertical: 4,
    borderRadius: 12,
  },
  content: {
    padding: 16,
  },
  mainContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flex: 1,
    marginRight: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  description: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  compactDescription: {
    fontSize: 15,
    marginBottom: 0,
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  category: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  dot: {
    fontSize: 10,
    opacity: 0.5,
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  compactAmount: {
    fontSize: 16,
  },
  multiBadge: {
    position: 'absolute',
    top: -6,
    left: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});

export default GroupSummaryCard;