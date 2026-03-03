import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useDebts } from '@/hooks/useDebts';
import { useThemeColors } from '@/hooks/useThemeColors';
import { supabase } from '@/lib/supabase';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Calendar,
  DollarSign,
  Percent,
  PieChart,
  Share as ShareIcon,
  Target,
  TrendingDown,
  TrendingUp
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

interface CategoryBreakdown {
  category: string;
  revenue: number;
  expenses: number;
  count: number;
  percentage: number;
}

interface MonthlyData {
  month: string;
  monthKey: string;
  revenue: number;
  expenses: number;
  net: number;
  growth?: number;
}

interface AdvancedStats {
  revenue: number;
  expenses: number;
  net: number;
  transactionCount: number;
  avgTransaction: number;
  profitMargin: number;
  expenseRatio: number;
  revenueGrowth: number;
  expenseGrowth: number;
}

export default function ReportsScreen() {
  const colors = useThemeColors();
  const { transactions, loading, refreshing, refresh } = useTransactionsContext();
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'week' | 'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
      setCheckingAuth(false);
    });
  }, []);

  async function onRefresh() {
    await refresh();
  }

  // Get date range for period
  const getDateRange = useCallback((period: string) => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (period) {
      case 'week':
        // Last 7 days
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'month':
        // Last 30 days
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'quarter':
        // Last 3 months
        start.setMonth(now.getMonth() - 3);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'year':
        // Last 12 months
        start.setFullYear(now.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        return null;
    }

    return { start, end };
  }, []);

  // Get previous period for comparison
  const getPreviousPeriod = useCallback((period: string) => {
    const now = new Date();
    const end = new Date();
    const start = new Date();

    switch (period) {
      case 'week':
        end.setDate(now.getDate() - 7);
        start.setDate(now.getDate() - 14);
        break;
      case 'month':
        end.setMonth(now.getMonth() - 1);
        start.setMonth(now.getMonth() - 2);
        break;
      case 'quarter':
        end.setMonth(now.getMonth() - 3);
        start.setMonth(now.getMonth() - 6);
        break;
      case 'year':
        end.setFullYear(now.getFullYear() - 1);
        start.setFullYear(now.getFullYear() - 2);
        break;
      default:
        return null;
    }

    // Normalize times
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, []);

  // Filter transactions based on selected period
  const filteredTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions;

    const range = getDateRange(selectedPeriod);
    if (!range) return transactions;

    // Normalize dates to compare only date part (ignore time)
    const startDateOnly = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
    const endDateOnly = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() + 1);

    return transactions.filter(t => {
      // Parse transaction_date (format: YYYY-MM-DD)
      const transactionDateStr = t.transaction_date.split('T')[0]; // Remove time if present
      const [year, month, day] = transactionDateStr.split('-').map(Number);
      const transactionDateOnly = new Date(year, month - 1, day); // month is 0-indexed

      // Compare dates: transaction must be >= start and < end (exclusive end = includes full end day)
      return transactionDateOnly >= startDateOnly && transactionDateOnly < endDateOnly;
    });
  }, [transactions, selectedPeriod, getDateRange]);

  // Get previous period transactions for comparison
  const previousTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return [];

    const range = getPreviousPeriod(selectedPeriod);
    if (!range) return [];

    // Normalize dates to compare only date part (ignore time)
    const startDateOnly = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
    const endDateOnly = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() + 1);

    return transactions.filter(t => {
      // Parse transaction_date (format: YYYY-MM-DD)
      const transactionDateStr = t.transaction_date.split('T')[0]; // Remove time if present
      const [year, month, day] = transactionDateStr.split('-').map(Number);
      const transactionDateOnly = new Date(year, month - 1, day); // month is 0-indexed

      // Compare dates: transaction must be >= start and < end (exclusive end = includes full end day)
      return transactionDateOnly >= startDateOnly && transactionDateOnly < endDateOnly;
    });
  }, [transactions, selectedPeriod, getPreviousPeriod]);

  // Calculate statistics for a transaction set
  const calculateStats = (txns: Transaction[]): AdvancedStats => {
    // Revenue: sum of all positive amounts (sales)
    const revenue = txns
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Expenses: sum of absolute values of all negative amounts
    const expenses = txns
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    // Net profit: revenue minus expenses
    const net = revenue - expenses;
    const transactionCount = txns.length;

    // Average transaction: average of absolute values of all transactions
    // This gives the average transaction size regardless of type
    const avgTransaction = transactionCount > 0
      ? (revenue + expenses) / transactionCount
      : 0;

    // Profit margin: (net profit / revenue) * 100
    // Shows what percentage of revenue is profit
    const profitMargin = revenue > 0
      ? (net / revenue) * 100
      : 0;

    // Expense ratio: (expenses / revenue) * 100
    // Shows what percentage of revenue goes to expenses
    const expenseRatio = revenue > 0
      ? (expenses / revenue) * 100
      : 0;

    return {
      revenue,
      expenses,
      net,
      transactionCount,
      avgTransaction,
      profitMargin,
      expenseRatio,
      revenueGrowth: 0,
      expenseGrowth: 0,
    };
  };

  // Calculate advanced statistics with growth
  const stats = useMemo(() => {
    const current = calculateStats(filteredTransactions);
    const previous = calculateStats(previousTransactions);

    // Revenue growth: ((current - previous) / previous) * 100
    // Handle edge case: if previous was 0 and current > 0, show 100% growth
    const revenueGrowth = previous.revenue > 0
      ? ((current.revenue - previous.revenue) / previous.revenue) * 100
      : previous.revenue === 0 && current.revenue > 0
        ? 100 // 100% growth if previous was 0 and current > 0
        : 0; // No growth if both are 0 or current decreased

    // Expense growth: ((current - previous) / previous) * 100
    // Handle edge case: if previous was 0 and current > 0, show 100% growth
    const expenseGrowth = previous.expenses > 0
      ? ((current.expenses - previous.expenses) / previous.expenses) * 100
      : previous.expenses === 0 && current.expenses > 0
        ? 100 // 100% growth if previous was 0 and current > 0
        : 0; // No growth if both are 0 or current decreased

    return {
      ...current,
      revenueGrowth,
      expenseGrowth,
    };
  }, [filteredTransactions, previousTransactions]);

  // Category breakdown with percentages
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, CategoryBreakdown>();

    // Calculate totals for percentage calculation
    const totalRevenue = stats.revenue;
    const totalExpenses = stats.expenses;
    const totalAmount = totalRevenue + totalExpenses;

    filteredTransactions.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          revenue: 0,
          expenses: 0,
          count: 0,
          percentage: 0,
        });
      }

      const cat = categoryMap.get(category)!;
      cat.count++;

      // Add to revenue if positive, expenses if negative
      if (t.amount > 0) {
        cat.revenue += Number(t.amount);
      } else {
        cat.expenses += Math.abs(Number(t.amount));
      }
    });

    // Calculate percentage: (category total / overall total) * 100
    return Array.from(categoryMap.values())
      .map(cat => {
        const categoryTotal = cat.revenue + cat.expenses;
        return {
          ...cat,
          percentage: totalAmount > 0
            ? (categoryTotal / totalAmount) * 100
            : 0,
        };
      })
      .sort((a, b) => (b.revenue + b.expenses) - (a.revenue + a.expenses));
  }, [filteredTransactions, stats]);

  // Debt statistics
  const { debts } = useDebts();
  const debtStats = useMemo(() => {
    const active = debts.filter(d => !d.is_settled);
    const totalPending = active.reduce((sum, d) => sum + Number(d.amount), 0);
    return { count: active.length, total: totalPending };
  }, [debts]);

  const handleShareReport = async () => {
    const periodLabel = selectedPeriod === 'all' ? 'All Time' : `Last ${selectedPeriod}`;
    let message = `📊 *MobiBooks Performance Report* (${periodLabel})\n\n`;
    message += `💰 *Revenue:* ${formatCurrency(stats.revenue)}\n`;
    message += `💸 *Expenses:* ${formatCurrency(stats.expenses)}\n`;
    message += `📈 *Net Profit:* ${formatCurrency(stats.net)}\n\n`;

    if (categoryBreakdown.length > 0) {
      message += `🏆 *Top Categories:*\n`;
      categoryBreakdown.slice(0, 3).forEach(c => {
        message += `• ${c.category}: ${formatCurrency(c.revenue + c.expenses)}\n`;
      });
      message += `\n`;
    }

    if (debtStats.total > 0) {
      message += `⚠️ *Pending Credits:* ${formatCurrency(debtStats.total)} (${debtStats.count} people)\n\n`;
    }

    message += `_This business is growing with MobiBooks!_ 🇿🇲`;

    try {
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Share.share({ message });
      }
    } catch (error) {
      await Share.share({ message });
    }
  };

  // Monthly data for trends with growth
  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, MonthlyData>();

    filteredTransactions.forEach(t => {
      const date = new Date(t.transaction_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthLabel,
          monthKey,
          revenue: 0,
          expenses: 0,
          net: 0,
        });
      }

      const month = monthMap.get(monthKey)!;
      if (t.amount > 0) {
        month.revenue += Number(t.amount);
      } else {
        month.expenses += Math.abs(Number(t.amount));
      }
      month.net = month.revenue - month.expenses;
    });

    const sorted = Array.from(monthMap.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      .slice(-6);

    // Calculate month-over-month revenue growth percentage
    return sorted.map((month, index) => {
      if (index > 0) {
        const prevMonth = sorted[index - 1];
        // Growth formula: ((current - previous) / previous) * 100
        // Handle edge cases: if previous was 0 and current > 0, show 100% growth
        const growth = prevMonth.revenue > 0
          ? ((month.revenue - prevMonth.revenue) / prevMonth.revenue) * 100
          : prevMonth.revenue === 0 && month.revenue > 0
            ? 100 // 100% growth if previous was 0 and current > 0
            : 0; // No growth if both are 0 or current is less
        return { ...month, growth };
      }
      return month;
    });
  }, [filteredTransactions]);

  const formatCurrency = useCallback((amount: number) => {
    return `K ${Math.abs(amount).toFixed(2)}`;
  }, []);

  const formatPercent = useCallback((value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  }, []);

  const getPercentage = useCallback((value: number, total: number) => {
    if (total === 0) return 0;
    return (value / total) * 100;
  }, []);

  // Show UI immediately with cached data, don't block on loading
  // Only show loading if we have no data and are actually loading
  if (checkingAuth && !user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.backgroundColor }]}>
        <ActivityIndicator size="large" color="#1e3a8a" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading analytics...</Text>
      </View>
    );
  }

  const dynamicStyles = {
    container: { ...styles.container, backgroundColor: colors.backgroundColor },
    card: { ...styles.card, backgroundColor: colors.cardBackground, borderColor: colors.borderColor },
    statCard: { ...styles.statCard, backgroundColor: colors.cardBackground, borderColor: colors.borderColor },
    statValue: { ...styles.statValue, color: colors.textColor },
    statLabel: { ...styles.statLabel, color: colors.textSecondary },
    sectionTitle: { ...styles.sectionTitle, color: colors.textColor },
    categoryName: { ...styles.categoryName, color: colors.textColor },
    categoryAmount: { ...styles.categoryAmount, color: colors.textColor },
    monthLabel: { ...styles.monthLabel, color: colors.textSecondary },
    emptyText: { ...styles.emptyText, color: colors.textSecondary },
    metricLabel: { ...styles.metricLabel, color: colors.textSecondary },
    metricValue: { ...styles.metricValue, color: colors.textColor },
    healthStats: { ...styles.healthStats, backgroundColor: colors.inputBackground },
    healthLabel: { ...styles.healthLabel, color: colors.textSecondary },
    healthValue: { ...styles.healthValue, color: colors.textColor },
    shareReportButton: { ...styles.shareReportButton },
    shareReportButtonText: { ...styles.shareReportButtonText },
    totalValueCard: { ...styles.totalValueCard },
    totalValueLabel: { ...styles.totalValueLabel },
    totalValueAmount: { ...styles.totalValueAmount },
    totalValueMeta: { ...styles.totalValueMeta },
    healthDivider: { ...styles.healthDivider, backgroundColor: colors.borderColor },
    healthItem: { ...styles.healthItem },
  };

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      {/* Hero Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerDecoration1} />
        <View style={styles.headerDecoration2} />
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <View style={styles.headerIcon}>
              <BarChart3 size={24} color="#ffffff" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Financial Analytics</Text>
              <Text style={styles.headerSubtitle}>
                Comprehensive business insights
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {(['week', 'month', 'quarter', 'year', 'all'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && { backgroundColor: '#1e3a8a' },
                { borderColor: colors.borderColor, backgroundColor: selectedPeriod === period ? '#1e3a8a' : colors.cardBackground },
              ]}
              onPress={() => setSelectedPeriod(period)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  { color: selectedPeriod === period ? '#ffffff' : colors.textColor },
                ]}
              >
                {period === 'all' ? 'All Time' : period === 'week' ? 'Week' : period === 'month' ? 'Month' : period === 'quarter' ? 'Quarter' : 'Year'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Key Performance Indicators */}
        <View style={styles.kpiSection}>
          <Text style={[styles.sectionHeader, { color: colors.textColor }]}>Key Performance Indicators</Text>
          <View style={styles.kpiGrid}>
            <View style={dynamicStyles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <TrendingUp size={20} color="#1e3a8a" />
              </View>
              <Text style={dynamicStyles.statValue}>{formatCurrency(stats.revenue)}</Text>
              <Text style={dynamicStyles.statLabel}>Total Revenue</Text>
              {stats.revenueGrowth !== 0 && (
                <View style={styles.growthIndicator}>
                  {stats.revenueGrowth > 0 ? (
                    <ArrowUpRight size={12} color="#1e3a8a" />
                  ) : (
                    <ArrowDownRight size={12} color="#ef4444" />
                  )}
                  <Text style={[styles.growthText, { color: stats.revenueGrowth > 0 ? '#1e3a8a' : '#ef4444' }]}>
                    {formatPercent(stats.revenueGrowth)}
                  </Text>
                </View>
              )}
            </View>

            <View style={dynamicStyles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <TrendingDown size={20} color="#ef4444" />
              </View>
              <Text style={dynamicStyles.statValue}>{formatCurrency(stats.expenses)}</Text>
              <Text style={dynamicStyles.statLabel}>Total Expenses</Text>
              {stats.expenseGrowth !== 0 && (
                <View style={styles.growthIndicator}>
                  {stats.expenseGrowth < 0 ? (
                    <ArrowDownRight size={12} color="#1e3a8a" />
                  ) : (
                    <ArrowUpRight size={12} color="#ef4444" />
                  )}
                  <Text style={[styles.growthText, { color: stats.expenseGrowth < 0 ? '#1e3a8a' : '#ef4444' }]}>
                    {formatPercent(stats.expenseGrowth)}
                  </Text>
                </View>
              )}
            </View>

            <View style={dynamicStyles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: stats.net >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                <DollarSign size={20} color={stats.net >= 0 ? '#1e3a8a' : '#ef4444'} />
              </View>
              <Text style={[dynamicStyles.statValue, { color: stats.net >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(stats.net)}
              </Text>
              <Text style={dynamicStyles.statLabel}>Net Profit</Text>
            </View>
          </View>
        </View>

        {/* Advanced Metrics */}
        <View style={dynamicStyles.card}>
          <View style={styles.cardHeader}>
            <Activity size={20} color="#1e3a8a" />
            <Text style={dynamicStyles.sectionTitle}>Performance Metrics</Text>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <View style={[styles.metricIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Target size={16} color="#1e3a8a" />
              </View>
              <Text style={dynamicStyles.metricLabel}>Profit Margin</Text>
              <Text style={[dynamicStyles.metricValue, { color: stats.profitMargin >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatPercent(stats.profitMargin)}
              </Text>
            </View>

            <View style={styles.metricItem}>
              <View style={[styles.metricIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Percent size={16} color="#ef4444" />
              </View>
              <Text style={dynamicStyles.metricLabel}>Expense Ratio</Text>
              <Text style={dynamicStyles.metricValue}>{formatPercent(stats.expenseRatio)}</Text>
            </View>

            <View style={styles.metricItem}>
              <View style={[styles.metricIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <DollarSign size={16} color="#1e3a8a" />
              </View>
              <Text style={dynamicStyles.metricLabel}>Avg Transaction</Text>
              <Text style={dynamicStyles.metricValue}>{formatCurrency(stats.avgTransaction)}</Text>
            </View>

            <View style={styles.metricItem}>
              <View style={[styles.metricIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Activity size={16} color="#1e3a8a" />
              </View>
              <Text style={dynamicStyles.metricLabel}>Transactions</Text>
              <Text style={dynamicStyles.metricValue}>{stats.transactionCount}</Text>
            </View>
          </View>
        </View>

        {/* Financial Health / Cash Flow */}
        <View style={dynamicStyles.card}>
          <View style={styles.cardHeader}>
            <Briefcase size={20} color="#1e3a8a" />
            <Text style={dynamicStyles.sectionTitle}>Business Cash Flow</Text>
          </View>
          <View style={dynamicStyles.healthStats}>
            <View style={dynamicStyles.healthItem as any}>
              <Text style={dynamicStyles.healthLabel}>Cash in Hand (Profit)</Text>
              <Text style={[dynamicStyles.healthValue, { color: stats.net >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(stats.net)}
              </Text>
            </View>
            <View style={dynamicStyles.healthDivider} />
            <View style={dynamicStyles.healthItem as any}>
              <Text style={dynamicStyles.healthLabel}>Pending Credits (To Collect)</Text>
              <Text style={[dynamicStyles.healthValue, { color: '#f59e0b' }]}>
                {formatCurrency(debtStats.total)}
              </Text>
            </View>
          </View>
          <View style={dynamicStyles.totalValueCard}>
            <Text style={dynamicStyles.totalValueLabel}>Total Business Value</Text>
            <Text style={dynamicStyles.totalValueAmount}>{formatCurrency(stats.net + debtStats.total)}</Text>
            <Text style={dynamicStyles.totalValueMeta}>Based on your current recorded data</Text>
          </View>
        </View>

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <View style={dynamicStyles.card}>
            <View style={styles.cardHeader}>
              <PieChart size={20} color="#1e3a8a" />
              <Text style={dynamicStyles.sectionTitle}>Category Analysis</Text>
            </View>
            <View style={styles.categoryList}>
              {categoryBreakdown.slice(0, 8).map((cat, index) => {
                const total = cat.revenue + cat.expenses;
                const maxTotal = Math.max(...categoryBreakdown.map(c => c.revenue + c.expenses));
                const percentage = getPercentage(total, maxTotal);

                return (
                  <View key={`category-${cat.category}`} style={styles.categoryItem}>
                    <View style={styles.categoryHeader}>
                      <View style={styles.categoryLeft}>
                        <View style={[styles.categoryRank, { backgroundColor: index < 3 ? '#1e3a8a' : 'rgba(16, 185, 129, 0.1)' }]}>
                          <Text style={[styles.categoryRankText, { color: index < 3 ? '#ffffff' : '#1e3a8a' }]}>
                            #{index + 1}
                          </Text>
                        </View>
                        <View style={styles.categoryInfo}>
                          <Text style={dynamicStyles.categoryName}>{cat.category}</Text>
                          <Text style={[styles.categoryPercentage, { color: colors.textSecondary }]}>
                            {cat.percentage.toFixed(1)}% of total
                          </Text>
                        </View>
                      </View>
                      <Text style={dynamicStyles.categoryAmount}>
                        {formatCurrency(total)}
                      </Text>
                    </View>
                    <View style={styles.categoryBarContainer}>
                      <View style={[styles.categoryBar, { width: `${percentage}%`, backgroundColor: '#1e3a8a' }]} />
                    </View>
                    <View style={styles.categoryDetails}>
                      <Text style={[styles.categoryDetail, { color: '#1e3a8a' }]}>
                        Revenue: {formatCurrency(cat.revenue)}
                      </Text>
                      {cat.expenses > 0 && (
                        <Text style={[styles.categoryDetail, { color: '#ef4444' }]}>
                          Expenses: {formatCurrency(cat.expenses)}
                        </Text>
                      )}
                      <Text style={[styles.categoryDetail, { color: colors.textSecondary }]}>
                        {cat.count} {cat.count === 1 ? 'transaction' : 'transactions'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Monthly Trends */}
        {monthlyData.length > 0 && (
          <View style={dynamicStyles.card}>
            <View style={styles.cardHeader}>
              <Calendar size={20} color="#1e3a8a" />
              <Text style={dynamicStyles.sectionTitle}>Revenue Trends</Text>
            </View>
            <View style={styles.monthlyList}>
              {monthlyData.map((month, index) => {
                const maxRevenue = Math.max(...monthlyData.map(m => m.revenue));
                const maxExpenses = Math.max(...monthlyData.map(m => m.expenses));
                const maxValue = Math.max(maxRevenue, maxExpenses);

                return (
                  <View key={`month-${month.monthKey}`} style={styles.monthlyItem}>
                    <View style={styles.monthlyHeader}>
                      <Text style={dynamicStyles.monthLabel}>{month.month}</Text>
                      {month.growth !== undefined && (
                        <View style={styles.growthIndicator}>
                          {month.growth > 0 ? (
                            <ArrowUpRight size={12} color="#1e3a8a" />
                          ) : (
                            <ArrowDownRight size={12} color="#ef4444" />
                          )}
                          <Text style={[styles.growthText, { color: month.growth > 0 ? '#1e3a8a' : '#ef4444' }]}>
                            {formatPercent(month.growth)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.monthlyBars}>
                      <View style={styles.monthlyBarContainer}>
                        <View style={[styles.monthlyBar, { height: `${getPercentage(month.revenue, maxValue)}%`, backgroundColor: '#1e3a8a' }]} />
                        <Text style={[styles.monthlyBarLabel, { color: colors.textSecondary }]}>
                          {formatCurrency(month.revenue)}
                        </Text>
                      </View>
                      <View style={styles.monthlyBarContainer}>
                        <View style={[styles.monthlyBar, { height: `${getPercentage(month.expenses, maxValue)}%`, backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.monthlyBarLabel, { color: colors.textSecondary }]}>
                          {formatCurrency(month.expenses)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.monthlyNet, { color: month.net >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                      Net: {formatCurrency(month.net)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Share Button Placeholder (since it's moved from Home) */}
        <TouchableOpacity
          style={dynamicStyles.shareReportButton}
          onPress={handleShareReport}
          activeOpacity={0.8}
        >
          <ShareIcon size={20} color="#ffffff" />
          <Text style={dynamicStyles.shareReportButtonText}>Share Performance Report</Text>
        </TouchableOpacity>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={dynamicStyles.emptyText}>No transactions found</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Start recording transactions to see comprehensive analytics
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    backgroundColor: '#1e3a8a',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecoration1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerDecoration2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    zIndex: 10,
  },
  headerIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  kpiSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  growthIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  growthText: {
    fontSize: 11,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  categoryList: {
    gap: 16,
  },
  categoryItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  categoryRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryRankText: {
    fontSize: 12,
    fontWeight: '700',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  categoryBarContainer: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  categoryBar: {
    height: '100%',
    borderRadius: 4,
  },
  categoryDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  categoryDetail: {
    fontSize: 11,
    fontWeight: '500',
  },
  monthlyList: {
    gap: 20,
  },
  monthlyItem: {
    marginBottom: 20,
  },
  monthlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  monthlyBars: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  monthlyBarContainer: {
    flex: 1,
    alignItems: 'center',
    height: 120,
    justifyContent: 'flex-end',
  },
  monthlyBar: {
    width: '100%',
    borderRadius: 8,
    minHeight: 4,
  },
  monthlyBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  monthlyNet: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  healthStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
  },
  healthItem: {
    flex: 1,
    alignItems: 'center',
  },
  healthDivider: {
    width: 1,
    height: '60%',
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  healthLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  healthValue: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  totalValueCard: {
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  totalValueLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  totalValueAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
  },
  totalValueMeta: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  shareReportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e3a8a',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 12,
    marginTop: 10,
    marginBottom: 40,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareReportButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
});
