import { useTheme } from '@/contexts/ThemeContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { startOfDay, startOfWeek, startOfMonth, toLocalTime } from '@/lib/dateUtils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, DollarSign, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { TransactionItem } from '@/components/transactions/TransactionGroupDetail';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PeriodDetailScreen() {
  const { period } = useLocalSearchParams<{ period: 'today' | 'week' | 'month' }>();
  const { transactions } = useTransactionsContext();
  const theme = useTheme();
  const colors = useThemeColors();

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      default: return 'Report';
    }
  }, [period]);

  const stats = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today': startDate = startOfDay(now); break;
      case 'week': startDate = startOfWeek(now); break;
      case 'month': startDate = startOfMonth(now); break;
      default: startDate = startOfDay(now);
    }

    const isStockPurchase = (t: any): boolean =>
      t.category === 'Stock / Inventory' ||
      (t.description && t.description.startsWith('Order:'));

    const computeProfit = (t: any): number => {
      if (t.sale_items && t.sale_items.length > 0) {
        return t.sale_items.reduce((sum: number, item: any) => {
          if (item.unit_cost != null) {
            return sum + (item.unit_price - item.unit_cost) * item.quantity;
          }
          return sum;
        }, 0);
      }
      return 0;
    };

    let revenue = 0;
    let expenses = 0;
    let profit = 0;
    let count = 0;

    transactions.forEach(t => {
      const createdAt = toLocalTime(t.created_at);
      if (createdAt >= startDate && createdAt <= now) {
        const amt = Number(t.amount);
        if (amt > 0) {
          revenue += amt;
          profit += computeProfit(t);
        } else if (amt < 0 && !isStockPurchase(t)) {
          expenses += Math.abs(amt);
        }
        count++;
      }
    });

    // Generate all days in the range
    const dailyBreakdown: Array<{ revenue: number, expenses: number, profit: number, count: number, date: Date, transactions: any[] }> = [];
    let curr = new Date(startDate);
    while (curr <= now) {
      const dayStart = startOfDay(curr);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      let dayRevenue = 0;
      let dayExpenses = 0;
      let dayProfit = 0;
      let dayCount = 0;
      const dayTransactions: any[] = [];

      transactions.forEach(t => {
        const createdAt = toLocalTime(t.created_at);
        if (createdAt >= dayStart && createdAt <= dayEnd) {
          const amt = Number(t.amount);
          if (amt > 0) {
            dayRevenue += amt;
            dayProfit += computeProfit(t);
          } else if (amt < 0 && !isStockPurchase(t)) {
            dayExpenses += Math.abs(amt);
          }
          dayCount++;
          dayTransactions.push(t);
        }
      });

      // Sort transactions newest first
      dayTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      dailyBreakdown.push({
        date: dayStart,
        revenue: dayRevenue,
        expenses: dayExpenses,
        profit: dayProfit,
        count: dayCount,
        transactions: dayTransactions
      });

      curr.setDate(curr.getDate() + 1);
    }

    // Sort descending for better mobile viewing
    const sortedBreakdown = [...dailyBreakdown].sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      revenue,
      expenses,
      profit,
      count,
      dailyBreakdown: sortedBreakdown
    };
  }, [period, transactions]);

  const formatCurrency = (amt: number) => `K${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  const formatDate = (date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{periodLabel} Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.summaryTitle, { color: colors.textColor }]}>Financial Overview</Text>
          <View style={styles.mainProfitContainer}>
            <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>Net Profit</Text>
            <Text style={[styles.profitValue, { color: stats.profit >= 0 ? '#10b981' : '#ef4444' }]}>
              {stats.profit < 0 ? '-' : ''}{formatCurrency(stats.profit)}
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <TrendingUp size={20} color="#10b981" />
              </View>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Revenue</Text>
              <Text style={[styles.statValue, { color: colors.textColor }]}>{formatCurrency(stats.revenue)}</Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <TrendingDown size={20} color="#ef4444" />
              </View>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Expenses</Text>
              <Text style={[styles.statValue, { color: colors.textColor }]}>{formatCurrency(stats.expenses)}</Text>
            </View>
          </View>

          <View style={[styles.transactionCount, { borderColor: colors.borderColor }]}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {stats.count} transactions in this period
            </Text>
          </View>
        </View>

        {/* Daily Breakdown */}
        {stats.dailyBreakdown.map((day) => {
          if (day.count === 0) return null;

          return (
            <View key={day.date.toISOString()} style={styles.breakdownSection}>
              {period !== 'today' && (
                <View style={[styles.dayRow, { backgroundColor: colors.cardBackground }]}>
                  <View style={styles.dayInfo}>
                    <Text style={[styles.dayName, { color: colors.textColor }]}>{formatDate(day.date)}</Text>
                    <Text style={[styles.dayCount, { color: colors.textSecondary }]}>{day.count} items</Text>
                  </View>
                  <View style={styles.dayValues}>
                    <Text style={[styles.dayProfit, { color: day.profit >= 0 ? '#10b981' : '#ef4444' }]}>
                      {day.profit < 0 ? '-' : ''}{formatCurrency(day.profit)}
                    </Text>
                    <View style={styles.daySubValues}>
                      <Text style={[styles.daySubValue, { color: '#10b981' }]}>In: {formatCurrency(day.revenue)}</Text>
                      <Text style={[styles.daySubValue, { color: '#ef4444' }]}>Out: {formatCurrency(day.expenses)}</Text>
                    </View>
                  </View>
                </View>
              )}
              {period === 'today' && (
                <Text style={[styles.sectionTitle, { color: colors.textColor, marginTop: 10, marginBottom: 4 }]}>
                  Today's Transactions
                </Text>
              )}
              <View style={{ gap: 12, marginTop: period === 'today' ? 0 : 12 }}>
                {day.transactions.map((t, idx) => (
                  <TransactionItem 
                    key={t.id} 
                    transaction={t} 
                    isFirst={idx === 0} 
                    isLast={idx === day.transactions.length - 1} 
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  summaryCard: {
    borderRadius: 24,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
    opacity: 0.7,
  },
  mainProfitContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profitLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  profitValue: {
    fontSize: 42,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  transactionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    marginTop: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: '500',
  },
  breakdownSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    marginLeft: 4,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  dayInfo: {
    justifyContent: 'center',
  },
  dayName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  dayCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  dayValues: {
    alignItems: 'flex-end',
  },
  dayProfit: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  daySubValues: {
    gap: 4,
  },
  daySubValue: {
    fontSize: 11,
    fontWeight: '600',
  }
});
