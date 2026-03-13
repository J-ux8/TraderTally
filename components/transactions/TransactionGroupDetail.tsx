/**
 * TransactionGroupDetail Component
 * 
 * Displays detailed view of a transaction group showing all individual transactions
 * within the group in chronological order with time, description, and amount.
 */

import React, { memo, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity,
  ListRenderItem
} from 'react-native';
import { TransactionGroup, Transaction } from '@/types/grouping';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Props for TransactionGroupDetail component
 */
export interface TransactionGroupDetailProps {
  group: TransactionGroup;
  onTransactionPress?: (transaction: Transaction) => void;
  showHeader?: boolean;
}

/**
 * Props for individual transaction item
 */
interface TransactionItemProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

/**
 * Individual transaction item component
 */
const TransactionItem = memo<TransactionItemProps>(({ 
  transaction, 
  onPress, 
  isFirst = false, 
  isLast = false 
}) => {
  const { theme } = useTheme();

  // Format time from transaction date
  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch (error) {
      return '--:--';
    }
  };

  // Format amount with currency
  const formatAmount = (amount: number): string => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = `K${absAmount.toFixed(0)}`;
    return isNegative ? `-${formatted}` : formatted;
  };

  // Dynamic colors
  const cardBackground = theme === 'dark' ? '#1e293b' : '#ffffff';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';
  const borderColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const amountColor = transaction.amount >= 0 ? '#10b981' : '#ef4444';

  const handlePress = useCallback(() => {
    onPress?.(transaction);
  }, [onPress, transaction]);

  return (
    <TouchableOpacity
      style={[
        styles.transactionItem,
        {
          backgroundColor: cardBackground,
          borderColor: borderColor,
        },
        isFirst && styles.firstTransactionItem,
        isLast && styles.lastTransactionItem,
      ]}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={`${formatTime(transaction.transaction_date)}, ${transaction.description || 'No description'}, ${formatAmount(transaction.amount)}`}
    >
      <View style={styles.transactionContent}>
        <View style={styles.transactionLeft}>
          <Text style={[styles.transactionTime, { color: textSecondary }]}>
            {formatTime(transaction.transaction_date)}
          </Text>
          <Text 
            style={[styles.transactionDescription, { color: textColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {transaction.description || 'No description'}
          </Text>
        </View>
        <Text style={[styles.transactionAmount, { color: amountColor }]}>
          {formatAmount(transaction.amount)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

TransactionItem.displayName = 'TransactionItem';

/**
 * TransactionGroupDetail component
 */
export const TransactionGroupDetail = memo<TransactionGroupDetailProps>(({
  group,
  onTransactionPress,
  showHeader = true
}) => {
  const { theme } = useTheme();

  // Format date for header
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }

      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Format total amount
  const formatTotalAmount = (amount: number): string => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = `K${absAmount.toFixed(0)}`;
    return isNegative ? `-${formatted}` : formatted;
  };

  // Render individual transaction
  const renderTransaction: ListRenderItem<Transaction> = useCallback(({ item, index }) => (
    <TransactionItem
      transaction={item}
      onPress={onTransactionPress}
      isFirst={index === 0}
      isLast={index === group.transactions.length - 1}
    />
  ), [onTransactionPress, group.transactions.length]);

  // Key extractor
  const keyExtractor = useCallback((item: Transaction) => item.id, []);

  // Dynamic colors
  const backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';
  const totalAmountColor = group.totalAmount >= 0 ? '#10b981' : '#ef4444';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={[styles.groupTitle, { color: textColor }]}>
              {group.description || group.category || 'Transaction Group'}
            </Text>
            <Text style={[styles.totalAmount, { color: totalAmountColor }]}>
              {formatTotalAmount(group.totalAmount)}
            </Text>
          </View>
          <View style={styles.headerBottom}>
            <Text style={[styles.dateText, { color: textSecondary }]}>
              {formatDate(group.date)}
            </Text>
            <Text style={[styles.countText, { color: textSecondary }]}>
              {group.transactionCount} {group.transactionCount === 1 ? 'transaction' : 'transactions'}
            </Text>
          </View>
        </View>
      )}

      {/* Transactions list */}
      <FlatList
        data={group.transactions}
        renderItem={renderTransaction}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
});

TransactionGroupDetail.displayName = 'TransactionGroupDetail';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  countText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 8,
  },
  transactionItem: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  firstTransactionItem: {
    // Additional styling for first item if needed
  },
  lastTransactionItem: {
    // Additional styling for last item if needed
  },
  transactionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLeft: {
    flex: 1,
    marginRight: 12,
  },
  transactionTime: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
});

export default TransactionGroupDetail;