/**
 * TransactionGroupDetail Component
 * 
 * Displays a premium, modern detailed view of a transaction group showing
 * all individual transactions within the group with enhanced visual hierarchy.
 */

import React, { memo, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity,
  ListRenderItem,
  Platform
} from 'react-native';
import { TransactionGroup, Transaction } from '@/types/grouping';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { 
  Clock, 
  ShoppingBag, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  ChevronRight,
  ChevronLeft,
  FileText,
  Tag
} from 'lucide-react-native';

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
export interface TransactionItemProps {
  transaction: Transaction;
  onPress?: (transaction: Transaction) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

/**
 * Individual transaction item component
 */
export const TransactionItem = memo<TransactionItemProps>(({ 
  transaction, 
  onPress, 
  isFirst = false, 
  isLast = false 
}) => {
  const { theme } = useTheme();
  const colors = useThemeColors();

  // Format time from transaction date
  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '--:--';
      
      // Use local format
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return '--:--';
    }
  };

  // Format amount with currency
  const formatAmount = (amount: number): string => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = `K${absAmount.toLocaleString()}`;
    return isNegative ? `-${formatted}` : formatted;
  };

  const isSale = transaction.amount >= 0;
  const amountColor = isSale ? '#10b981' : '#ef4444';
  const typeIconColor = isSale ? '#059669' : '#dc2626';
  const typeBgColor = isSale ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  const handlePress = useCallback(() => {
    onPress?.(transaction);
  }, [onPress, transaction]);

  return (
    <TouchableOpacity
      style={[
        styles.transactionItem,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.borderColor,
        },
      ]}
      onPress={handlePress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.transactionContent}>
        <View style={[styles.typeIconContainer, { backgroundColor: typeBgColor }]}>
          {isSale ? (
            <TrendingUp size={20} color={typeIconColor} />
          ) : (
            <TrendingDown size={20} color={typeIconColor} />
          )}
        </View>

        <View style={styles.transactionMain}>
          <View style={styles.transactionHeaderRow}>
            <Text 
              style={[styles.transactionDescription, { color: colors.textColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {transaction.description || (transaction.linked_sale_id ? 'Sale' : transaction.category) || 'No description'}
            </Text>
            <Text style={[styles.transactionAmount, { color: amountColor }]}>
              {formatAmount(transaction.amount)}
            </Text>
          </View>
          
          <View style={styles.transactionFooterRow}>
            <View style={styles.timeContainer}>
              <Clock size={12} color={colors.textSecondary} />
              <Text style={[styles.transactionTime, { color: colors.textSecondary }]}>
                {formatTime(transaction.transaction_date)}
              </Text>
            </View>
            
            {(transaction.category || transaction.linked_sale_id) && (
              <View style={styles.categoryBadge}>
                <Tag size={10} color={colors.textSecondary} />
                <Text style={[styles.categoryText, { color: colors.textSecondary }]}>
                  {transaction.linked_sale_id ? 'Sale' : transaction.category}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }} />

            <View style={styles.txnIdBadge}>
              <Text style={[styles.txnIdText, { color: colors.textSecondary }]}>
                #{transaction.id ? transaction.id.split('-')[0].substring(0, 8).toUpperCase() : 'UNKNOWN'}
              </Text>
            </View>
          </View>

          {/* Itemized Breakdown for Sales */}
          {transaction.sale_items && transaction.sale_items.length > 0 && (
            <View style={[styles.itemizedBreakdown, { borderTopColor: colors.borderColor }]}>
              {transaction.sale_items.map((item, idx) => {
                const profit = item.unit_cost != null
                  ? (item.unit_price - item.unit_cost) * item.quantity
                  : null;
                return (
                  <View key={item.id || idx}>
                    <View style={styles.itemRow}>
                      <Text style={[styles.itemName, { color: colors.textColor }]} numberOfLines={1}>
                        {item.quantity}x {item.product_name}
                      </Text>
                      <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                        {item.quantity > 1 ? `@ K${item.unit_price.toLocaleString()} = ` : ''}
                        K{item.total_price.toLocaleString()}
                      </Text>
                    </View>
                    {item.category_name && (
                      <Text style={{ fontSize: 10, color: '#999', marginLeft: 28, marginTop: 1 }}>
                        {item.category_name}
                      </Text>
                    )}
                    {profit != null && (
                      <Text style={{ fontSize: 11, fontWeight: '600', color: profit >= 0 ? '#10b981' : '#ef4444', marginTop: 2, marginLeft: 28 }}>
                        Profit: K{profit.toFixed(2)}
                      </Text>
                    )}
                  </View>
                );
              })}
              {/* Per-category profit breakdown */}
              {(() => {
                const itemsWithCost = transaction.sale_items.filter((i: any) => i.unit_cost != null);
                if (itemsWithCost.length === 0) return null;
                const groups = new Map<string, number>();
                for (const item of itemsWithCost) {
                  const cat = item.category_name || 'Uncategorized';
                  groups.set(cat, (groups.get(cat) || 0) + (item.unit_price - item.unit_cost) * item.quantity);
                }
                const totalProfit = Array.from(groups.values()).reduce((s, v) => s + v, 0);
                return (
                  <View style={{ borderTopWidth: 1, borderTopColor: colors.borderColor, paddingTop: 8, marginTop: 4 }}>
                    {Array.from(groups.entries()).map(([cat, profit]) => (
                      <View key={cat} style={[styles.itemRow, { marginTop: 2 }]}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textColor }}>{cat}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: profit >= 0 ? '#10b981' : '#ef4444' }}>
                          K{profit.toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    {groups.size > 1 && (
                      <View style={[styles.itemRow, { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 4, marginTop: 4 }]}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textColor }}>Total Profit</Text>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                          K{totalProfit.toFixed(2)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          )}
        </View>

        {onPress && (
          <View style={styles.chevronContainer}>
            <ChevronRight size={18} color={colors.textSecondary} strokeWidth={2.5} />
          </View>
        )}
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
  const colors = useThemeColors();

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

      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${daysOfWeek[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    } catch (error) {
      return dateString;
    }
  };

  // Format total amount
  const formatTotalAmount = (amount: number): string => {
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);
    const formatted = `K${absAmount.toLocaleString()}`;
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

  // Performance - total sales and expenses in group
  const salesTotal = group.transactions.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0);
  const expensesTotal = group.transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      {/* Enhanced Header Section */}
      {showHeader && (
        <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.headerTitleContainer}>
            <View style={[styles.titleIcon, { backgroundColor: 'rgba(30, 58, 138, 0.1)' }]}>
              <ShoppingBag size={24} color={colors.primaryColor} />
            </View>
            <View style={styles.titleTextContainer}>
              <Text style={[styles.groupTitle, { color: colors.textColor }]} numberOfLines={2}>
                {group.description || group.category || 'Transaction Group'}
              </Text>
              <View style={styles.dateBadge}>
                <Calendar size={12} color={colors.textSecondary} />
                <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                  {formatDate(group.date)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryContainer}>
            <View style={styles.totalSection}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total Balance</Text>
              <Text style={[styles.totalAmountText, { color: group.totalAmount >= 0 ? '#10b981' : '#ef4444' }]}>
                {formatTotalAmount(group.totalAmount)}
              </Text>
            </View>
            
            <View style={styles.summaryStatsRow}>
              <View style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: '#10b981' }]} />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>In: </Text>
                <Text style={[styles.statValue, { color: colors.textColor }]}>K{salesTotal.toLocaleString()}</Text>
              </View>
              <View style={styles.statItem}>
                <View style={[styles.statDot, { backgroundColor: '#ef4444' }]} />
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Out: </Text>
                <Text style={[styles.statValue, { color: colors.textColor }]}>K{expensesTotal.toLocaleString()}</Text>
              </View>
              <View style={styles.statItem}>
                <FileText size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                <Text style={[styles.statValue, { color: colors.textColor }]}>{group.transactionCount}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Transactions list header */}
      <View style={styles.listHeader}>
        <Text style={[styles.listHeaderTitle, { color: colors.textSecondary }]}>
          TRANSACTION HISTORY
        </Text>
      </View>

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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  titleIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleTextContainer: {
    flex: 1,
  },
  groupTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryContainer: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  totalSection: {
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  totalAmountText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  listHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  separator: {
    height: 12,
  },
  transactionItem: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  transactionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionMain: {
    flex: 1,
  },
  transactionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  transactionAmount: {
    fontSize: 17,
    fontWeight: '800',
  },
  transactionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  transactionTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.03)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txnIdBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  txnIdText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chevronContainer: {
    marginLeft: 4,
  },
  itemizedBreakdown: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TransactionGroupDetail;