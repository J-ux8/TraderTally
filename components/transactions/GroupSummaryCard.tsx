/**
 * GroupSummaryCard Component
 * 
 * Displays a summary card for a transaction group showing description,
 * transaction count, and total amount. Follows the format:
 * "[Description] ([Count] transactions) [Total_Amount]"
 */

import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { TransactionGroup } from '@/types/grouping';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Props for GroupSummaryCard component
 */
export interface GroupSummaryCardProps {
  group: TransactionGroup;
  onPress: () => void;
  style?: ViewStyle;
  showDate?: boolean; // Whether to show the date in the card
  compact?: boolean; // Compact layout for smaller spaces
}

/**
 * GroupSummaryCard component for displaying transaction group summaries
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

  // Format the amount with currency symbol
  const formatAmount = (amount: number): string => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = `K${absAmount.toFixed(0)}`;
    return isNegative ? `-${formatted}` : formatted;
  };

  // Format the transaction count text
  const getCountText = (): string => {
    if (group.transactionCount === 1) {
      return ''; // No count notation for single transactions
    }
    return ` (${group.transactionCount} transactions)`;
  };

  // Get the display description
  const getDisplayDescription = (): string => {
    if (group.description) {
      return group.description;
    }
    if (group.category) {
      return group.category;
    }
    return 'Uncategorized';
  };

  // Format the date for display
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Check if it's today
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }

      // Check if it's yesterday
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }

      // Format as MMM DD
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch (error) {
      return dateString;
    }
  };

  // Determine if this is a sale (positive) or expense (negative)
  const isPositive = group.totalAmount >= 0;
  const amountColor = isPositive ? '#10b981' : '#ef4444'; // Green for sales, red for expenses

  // Dynamic colors based on theme
  const cardBackground = theme === 'dark' ? '#1e293b' : '#ffffff';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';
  const borderColor = theme === 'dark' ? '#334155' : '#e2e8f0';

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.compactContainer,
        {
          backgroundColor: cardBackground,
          borderColor: borderColor,
        },
        style
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${getDisplayDescription()}${getCountText()}, total ${formatAmount(group.totalAmount)}`}
      accessibilityHint="Tap to view transaction details"
    >
      <View style={styles.content}>
        {/* Main content row */}
        <View style={styles.mainRow}>
          <View style={styles.leftContent}>
            {/* Description and count */}
            <Text 
              style={[
                styles.description, 
                compact && styles.compactDescription,
                { color: textColor }
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {getDisplayDescription()}
              <Text style={[styles.countText, { color: textSecondary }]}>
                {getCountText()}
              </Text>
            </Text>

            {/* Category (if different from description) and date */}
            {(group.category && group.category !== group.description) || showDate ? (
              <View style={styles.metadataRow}>
                {group.category && group.category !== group.description && (
                  <Text 
                    style={[styles.category, { color: textSecondary }]}
                    numberOfLines={1}
                  >
                    {group.category}
                  </Text>
                )}
                {showDate && (
                  <Text style={[styles.date, { color: textSecondary }]}>
                    {formatDate(group.date)}
                  </Text>
                )}
              </View>
            ) : null}
          </View>

          {/* Amount */}
          <Text 
            style={[
              styles.amount,
              compact && styles.compactAmount,
              { color: amountColor }
            ]}
          >
            {formatAmount(group.totalAmount)}
          </Text>
        </View>

        {/* Transaction count indicator for compact mode */}
        {compact && group.transactionCount > 1 && (
          <View style={styles.compactCountIndicator}>
            <Text style={[styles.compactCountText, { color: textSecondary }]}>
              {group.transactionCount}×
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

GroupSummaryCard.displayName = 'GroupSummaryCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  compactContainer: {
    marginVertical: 2,
    borderRadius: 8,
  },
  content: {
    padding: 16,
    position: 'relative',
  },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  compactDescription: {
    fontSize: 14,
    marginBottom: 0,
  },
  countText: {
    fontSize: 14,
    fontWeight: '400',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  category: {
    fontSize: 12,
    fontWeight: '500',
    marginRight: 8,
  },
  date: {
    fontSize: 12,
    fontWeight: '400',
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
  compactAmount: {
    fontSize: 16,
  },
  compactCountIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  compactCountText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default GroupSummaryCard;