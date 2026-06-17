import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { startOfDay, startOfWeek, startOfMonth } from '@/lib/dateUtils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, DollarSign, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { TransactionItem } from '@/components/transactions/TransactionGroupDetail';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAY_MS = 86400000;

const computeSaleProfit = (t: any): number => {
  if (t.sale_items && t.sale_items.length > 0) {
    let total = 0;
    for (const item of t.sale_items) {
      if (item.unit_cost != null) {
        total += (item.unit_price - item.unit_cost) * item.quantity;
      }
    }
    return total;
  }
  return 0;
};

function formatCurrency(amount: number): string {
  return `K ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

export default function PeriodDetailScreen() {
  const { period } = useLocalSearchParams<{ period: 'today' | 'week' | 'month' }>();
  const { transactions } = useTransactionsContext();
  const colors = useThemeColors();

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      default: return 'Report';
    }
  }, [period]);

  const headerSubtitle = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        return formatDate(now);
      case 'week': {
        const start = startOfWeek(now);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return `${formatDate(start)} – ${formatDate(end)}`;
      }
      case 'month': {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[now.getMonth()]} ${now.getFullYear()}`;
      }
      default:
        return '';
    }
  }, [period]);

  const stats = useMemo(() => {
    const nowMs = Date.now();
    const now = new Date(nowMs);
    let startMs: number;

    switch (period) {
      case 'today':
        startMs = startOfDay(now).getTime();
        break;
      case 'week':
        startMs = startOfWeek(now).getTime();
        break;
      case 'month':
        startMs = startOfMonth(now).getTime();
        break;
      default:
        startMs = startOfDay(now).getTime();
    }

    // Local timezone offset in ms (used for day bucketing)
    const tzOffsetMs = -now.getTimezoneOffset() * 60000;

    const dayBuckets = new Map<number, {
      dateMs: number;
      revenue: number;
      expenses: number;
      profit: number;
      count: number;
      transactions: any[];
    }>();

    let revenue = 0;
    let expenses = 0;
    let profit = 0;
    let count = 0;

    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const createdAtMs = new Date(t.created_at).getTime();
      if (createdAtMs < startMs || createdAtMs > nowMs) continue;

      const localMs = createdAtMs + tzOffsetMs;
      const dayKey = Math.floor(localMs / DAY_MS);
      const dateMs = dayKey * DAY_MS - tzOffsetMs;

      let bucket = dayBuckets.get(dayKey);
      if (!bucket) {
        bucket = { dateMs, revenue: 0, expenses: 0, profit: 0, count: 0, transactions: [] };
        dayBuckets.set(dayKey, bucket);
      }

      const amt = Number(t.amount);
      if (amt > 0) {
        revenue += amt;
        bucket.revenue += amt;
        const itemProfit = computeSaleProfit(t);
        profit += itemProfit;
        bucket.profit += itemProfit;
      } else if (amt < 0) {
        const absAmt = Math.abs(amt);
        expenses += absAmt;
        bucket.expenses += absAmt;
      }

      count++;
      bucket.count++;
      bucket.transactions.push(t);
    }

    // Sort each day's transactions newest first
    for (const bucket of dayBuckets.values()) {
      bucket.transactions.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    // Convert to array sorted descending by date
    const dailyBreakdown = Array.from(dayBuckets.values())
      .sort((a, b) => b.dateMs - a.dateMs)
      .map(b => ({ ...b, date: new Date(b.dateMs) }));

    return { revenue, expenses, profit, count, dailyBreakdown };
  }, [period, transactions]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: '#1e3a8a' }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{periodLabel} Summary</Text>
          <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.summaryTitle, { color: colors.textSecondary }]}>
            {periodLabel} Overview
          </Text>

          {/* Total Profits — hero metric */}
          <View style={styles.profitHero}>
            <View style={[styles.profitIconContainer, { backgroundColor: stats.profit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
              <TrendingUp size={24} color={stats.profit >= 0 ? '#10b981' : '#ef4444'} />
            </View>
            <Text style={[styles.profitHeroLabel, { color: colors.textSecondary }]}>Total Profits</Text>
            <Text style={[styles.profitHeroValue, { color: stats.profit >= 0 ? '#10b981' : '#ef4444' }]}>
              {stats.profit < 0 ? '-' : ''}{formatCurrency(stats.profit)}
            </Text>
          </View>

          {/* Revenue & Expenses row */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: 'rgba(59, 130, 246, 0.06)' }]}>
              <View style={styles.statHeader}>
                <DollarSign size={16} color="#3b82f6" />
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
              <Text style={[styles.statValue, { color: '#0f172a' }]}>{formatCurrency(stats.revenue)}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: 'rgba(239, 68, 68, 0.06)' }]}>
              <View style={styles.statHeader}>
                <TrendingDown size={16} color="#ef4444" />
                <Text style={styles.statLabel}>Expenses</Text>
              </View>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{formatCurrency(stats.expenses)}</Text>
            </View>
          </View>

          <View style={[styles.transactionCount, { borderTopColor: colors.borderColor }]}>
            <Calendar size={14} color={colors.textSecondary} />
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {stats.count} transaction{stats.count === 1 ? '' : 's'} in this period
            </Text>
          </View>
        </View>

        {/* Daily Breakdown */}
        {stats.dailyBreakdown.map((day: any) => {
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
                      <Text style={[styles.daySubValue, { color: '#3b82f6' }]}>
                        In: {formatCurrency(day.revenue)}
                      </Text>
                      <Text style={[styles.daySubValue, { color: '#ef4444' }]}>
                        Out: {formatCurrency(day.expenses)}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
              {period === 'today' && (
                <Text style={[styles.sectionTitle, { color: colors.textColor }]}>
                  Today's Transactions
                </Text>
              )}
              <View style={{ gap: 12, marginTop: period === 'today' ? 0 : 12 }}>
                {day.transactions.map((t: any, idx: number) => (
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
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
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
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
  },
  profitHero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  profitHeroLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  profitHeroValue: {
    fontSize: 40,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  transactionCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
  },
  breakdownSection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
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
  },
});
