import { useThemeColors } from '@/hooks/useThemeColors';
import { startOfDay, startOfWeek, startOfMonth } from '@/lib/dateUtils';
import { usePeriodStats } from '@/hooks/usePeriodStats';
import { router, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Calendar, DollarSign, TrendingDown, TrendingUp } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { TransactionItem } from '@/components/transactions/TransactionGroupDetail';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatCurrency(amount: number): string {
  return `K ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function ShimmerBlock({ width, height, style }: { width: number | string; height: number; style?: any }) {
  return (
    <View
      style={[{ width, height, borderRadius: 6, backgroundColor: 'rgba(150,150,150,0.15)' }, style]}
    />
  );
}

function SummarySkeleton() {
  return (
    <View style={{ alignItems: 'center' }}>
      <ShimmerBlock width={48} height={48} style={{ borderRadius: 24, marginBottom: 8 }} />
      <ShimmerBlock width={80} height={14} style={{ marginBottom: 8 }} />
      <ShimmerBlock width={180} height={40} style={{ marginBottom: 24 }} />
      <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        <ShimmerBlock width="48%" height={80} style={{ borderRadius: 16 }} />
        <ShimmerBlock width="48%" height={80} style={{ borderRadius: 16 }} />
      </View>
    </View>
  );
}

const INITIAL_DAYS_VISIBLE = 7;

export default function PeriodDetailScreen() {
  const { period } = useLocalSearchParams<{ period: 'today' | 'week' | 'month' }>();
  const navigation = useNavigation();
  const colors = useThemeColors();
  const [showAllDays, setShowAllDays] = useState(false);

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

  const periodRange = useMemo(() => {
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
    return { startMs, endMs: nowMs };
  }, [period]);

  const cacheKey = `${period}-${periodRange.startMs}`;
  const { stats, loading } = usePeriodStats(cacheKey, periodRange.startMs, periodRange.endMs);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: '#1e3a8a' }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (navigation.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        }}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{periodLabel} Summary</Text>
          <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.summaryTitle, { color: colors.textSecondary }]}>
            {periodLabel} Overview
          </Text>

          {loading && stats.count === 0 ? (
            <SummarySkeleton />
          ) : (
            <>
              <View style={styles.profitHero}>
                <View style={[styles.profitIconContainer, { backgroundColor: stats.profit >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                  <TrendingUp size={24} color={stats.profit >= 0 ? '#10b981' : '#ef4444'} />
                </View>
                <Text style={[styles.profitHeroLabel, { color: colors.textSecondary }]}>Total Profits</Text>
                <Text style={[styles.profitHeroValue, { color: stats.profit >= 0 ? '#10b981' : '#ef4444' }]}>
                  {stats.profit < 0 ? '-' : ''}{formatCurrency(stats.profit)}
                </Text>
              </View>

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
            </>
          )}
        </View>

        {(() => {
          const visibleDays = showAllDays
            ? stats.dailyBreakdown
            : stats.dailyBreakdown.slice(0, INITIAL_DAYS_VISIBLE);
          const hiddenCount = stats.dailyBreakdown.length - INITIAL_DAYS_VISIBLE;

          return (
            <>
              {visibleDays.map((day: any) => {
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
                  Today&apos;s Transactions
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
              {!showAllDays && hiddenCount > 0 && (
                <TouchableOpacity
                  onPress={() => setShowAllDays(true)}
                  style={{
                    alignItems: 'center',
                    paddingVertical: 14,
                    borderRadius: 16,
                    backgroundColor: colors.cardBackground,
                    marginTop: 4,
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.primaryColor ?? '#1e3a8a', fontWeight: '700', fontSize: 14 }}>
                    Show {hiddenCount} more day{hiddenCount !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          );
        })()}
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
