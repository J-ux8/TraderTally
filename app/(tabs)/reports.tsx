import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useDebts } from '@/hooks/useDebts';
import { useThemeColors } from '@/hooks/useThemeColors';
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
  TrendingUp,
  AlertCircle,
  MessageCircle,
  Zap,
  AlertTriangle
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

interface DailyData {
  date: string;
  revenue: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

interface CategoryMetrics {
  category: string;
  revenue: number;
  expenses: number;
  net: number;
  count: number;
  percentage: number;
}

interface Suggestion {
  id: string;
  type: 'action' | 'warning' | 'opportunity';
  title: string;
  description: string;
  icon: string;
}


export default function ReportsScreen() {
  const colors = useThemeColors();
  const { transactions, refresh } = useTransactionsContext();
  const { debts } = useDebts();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [refreshing, setRefreshing] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const getDateRange = useCallback((period: string) => {
    const now = new Date();
    const start = new Date();
    switch (period) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setDate(now.getDate() - 30);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    start.setHours(0, 0, 0, 0);
    now.setHours(23, 59, 59, 999);
    return { start, end: now };
  }, []);

  const filteredTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions;
    const range = getDateRange(selectedPeriod);
    if (!range) return transactions;
    return transactions.filter(t => {
      const txDate = new Date(t.transaction_date);
      return txDate >= range.start && txDate <= range.end;
    });
  }, [transactions, selectedPeriod, getDateRange]);

  const todayData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTxns = transactions.filter(t => {
      const txDate = new Date(t.transaction_date);
      return txDate >= today && txDate < tomorrow;
    });

    const revenue = todayTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = todayTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    return {
      date: today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      revenue,
      expenses,
      net: revenue - expenses,
      transactionCount: todayTxns.length,
    };
  }, [transactions]);


  const dailyTimeline = useMemo(() => {
    const dayMap = new Map<string, DailyData>();
    filteredTransactions.forEach(t => {
      const date = new Date(t.transaction_date);
      const dateKey = date.toISOString().split('T')[0];

      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { date: dateKey, revenue: 0, expenses: 0, net: 0, transactionCount: 0 });
      }

      const day = dayMap.get(dateKey)!;
      day.transactionCount++;
      if (t.amount > 0) {
        day.revenue += Number(t.amount);
      } else {
        day.expenses += Math.abs(Number(t.amount));
      }
      day.net = day.revenue - day.expenses;
    });

    return Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [filteredTransactions]);

  const salesTrend = useMemo(() => {
    if (dailyTimeline.length < 2) return { trend: 'stable', direction: '→', change: 0 };
    const mid = Math.floor(dailyTimeline.length / 2);
    const firstHalf = dailyTimeline.slice(0, mid).reduce((sum, d) => sum + d.revenue, 0) / mid;
    const secondHalf = dailyTimeline.slice(mid).reduce((sum, d) => sum + d.revenue, 0) / (dailyTimeline.length - mid);
    const change = ((secondHalf - firstHalf) / firstHalf) * 100;
    if (change > 10) return { trend: 'increasing', direction: '📈', change };
    if (change < -10) return { trend: 'declining', direction: '📉', change };
    return { trend: 'stable', direction: '→', change };
  }, [dailyTimeline]);

  const bestSalesDay = useMemo(() => {
    if (dailyTimeline.length === 0) return null;
    return dailyTimeline.reduce((best, day) => day.revenue > best.revenue ? day : best);
  }, [dailyTimeline]);

  const debtRiskData = useMemo(() => {
    const activeDebts = debts.filter(d => !d.is_settled);
    const now = new Date();
    const largestDebts = activeDebts.sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3);
    const overdueDebts = activeDebts.filter(d => {
      if (!d.due_date) return false;
      return new Date(d.due_date) < now;
    });
    return { largestDebts, overdueDebts, totalRisk: activeDebts.reduce((sum, d) => sum + Number(d.amount), 0) };
  }, [debts]);

  const categoryMetrics = useMemo(() => {
    const categoryMap = new Map<string, CategoryMetrics>();
    const totalAmount = filteredTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    filteredTransactions.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, revenue: 0, expenses: 0, net: 0, count: 0, percentage: 0 });
      }

      const cat = categoryMap.get(category)!;
      cat.count++;
      if (t.amount > 0) {
        cat.revenue += Number(t.amount);
      } else {
        cat.expenses += Math.abs(Number(t.amount));
      }
      cat.net = cat.revenue - cat.expenses;
    });

    return Array.from(categoryMap.values())
      .map(cat => ({
        ...cat,
        percentage: totalAmount > 0 ? (((cat.revenue + cat.expenses) / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => (b.revenue + b.expenses) - (a.revenue + a.expenses));
  }, [filteredTransactions]);

  const revenueConcentration = useMemo(() => {
    const totalRevenue = categoryMetrics.reduce((sum, c) => sum + c.revenue, 0);
    if (totalRevenue === 0) return { isConcentrated: false, topCategory: null, percentage: 0 };
    const topCategory = categoryMetrics[0];
    const percentage = (topCategory.revenue / totalRevenue) * 100;
    return { isConcentrated: percentage > 50, topCategory: topCategory.category, percentage };
  }, [categoryMetrics]);

  const healthScore = useMemo(() => {
    const totalRevenue = categoryMetrics.reduce((sum, c) => sum + c.revenue, 0);
    const totalExpenses = categoryMetrics.reduce((sum, c) => sum + c.expenses, 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const profitability = Math.min(25, Math.max(0, (profitMargin / 30) * 25));
    const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 100;
    const expenseControl = Math.min(25, Math.max(0, 25 - (expenseRatio / 4)));
    const revenueGrowth = salesTrend.change > 0 ? Math.min(25, (salesTrend.change / 50) * 25) : 0;
    const debtRisk = Math.max(0, 25 - (debtRiskData.totalRisk / (totalRevenue || 1)) * 25);
    const score = Math.round(profitability + expenseControl + revenueGrowth + debtRisk);
    let status: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (score >= 80) status = 'excellent';
    else if (score >= 60) status = 'good';
    else if (score >= 40) status = 'fair';
    return { score, profitability, expenseControl, revenueGrowth, debtRisk, status };
  }, [categoryMetrics, salesTrend, debtRiskData]);

  const monthlyForecast = useMemo(() => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = today.getDate();
    const dailyProfit = dailyTimeline.length > 0 ? dailyTimeline.reduce((sum, d) => sum + d.net, 0) / dailyTimeline.length : 0;
    const projectedMonthlyProfit = dailyProfit * daysInMonth;
    const currentMonthProfit = dailyTimeline.reduce((sum, d) => sum + d.net, 0);
    return { projectedMonthlyProfit, currentMonthProfit, daysRemaining: daysInMonth - dayOfMonth, dailyAverage: dailyProfit };
  }, [dailyTimeline]);

  const suggestions = useMemo((): Suggestion[] => {
    const sugg: Suggestion[] = [];
    if (debtRiskData.overdueDebts.length > 0) {
      sugg.push({
        id: 'overdue-follow-up',
        type: 'action',
        title: 'Follow Up on Overdue Payments',
        description: `${debtRiskData.overdueDebts.length} customer(s) have overdue payments.`,
        icon: '⏰',
      });
    }
    if (revenueConcentration.isConcentrated) {
      sugg.push({
        id: 'revenue-concentration',
        type: 'warning',
        title: 'Revenue Concentration Risk',
        description: `${revenueConcentration.topCategory} is ${revenueConcentration.percentage.toFixed(0)}% of revenue.`,
        icon: '⚠️',
      });
    }
    const expenseRatio = categoryMetrics.reduce((sum, c) => sum + c.expenses, 0) / (categoryMetrics.reduce((sum, c) => sum + c.revenue, 0) || 1) * 100;
    if (expenseRatio > 60) {
      sugg.push({
        id: 'high-expenses',
        type: 'warning',
        title: 'High Expense Ratio',
        description: `Expenses are ${expenseRatio.toFixed(0)}% of revenue.`,
        icon: '💸',
      });
    }
    if (salesTrend.trend === 'declining') {
      sugg.push({
        id: 'declining-sales',
        type: 'warning',
        title: 'Sales Declining',
        description: `Revenue is down ${Math.abs(salesTrend.change).toFixed(0)}%.`,
        icon: '📉',
      });
    }
    if (healthScore.score >= 80) {
      sugg.push({
        id: 'excellent-health',
        type: 'opportunity',
        title: 'Business is Thriving!',
        description: 'Your business health is excellent.',
        icon: '🚀',
      });
    }
    return sugg;
  }, [debtRiskData, revenueConcentration, categoryMetrics, salesTrend, healthScore]);

  const formatCurrency = useCallback((amount: number) => {
    return `K ${Math.abs(amount).toFixed(2)}`;
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  const handleShareReport = async (type: 'whatsapp' | 'text') => {
    const periodLabel = selectedPeriod === 'all' ? 'All Time' : `Last ${selectedPeriod}`;
    const totalRevenue = categoryMetrics.reduce((sum, c) => sum + c.revenue, 0);
    const totalExpenses = categoryMetrics.reduce((sum, c) => sum + c.expenses, 0);
    const netProfit = totalRevenue - totalExpenses;

    let message = `📊 *MobiBooks Report* (${periodLabel})\n\n`;
    message += `💰 Revenue: ${formatCurrency(totalRevenue)}\n`;
    message += `💸 Expenses: ${formatCurrency(totalExpenses)}\n`;
    message += `📈 Profit: ${formatCurrency(netProfit)}\n`;
    message += `❤️ Health: ${healthScore.score}/100\n\n`;
    message += `_Growing with MobiBooks!_ 🇿🇲`;

    try {
      if (type === 'whatsapp') {
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
        } else {
          await Share.share({ message });
        }
      } else {
        await Share.share({ message });
      }
      setShareModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to share report');
    }
  };


  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerDecoration1} />
        <View style={styles.headerDecoration2} />
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <View style={styles.headerIcon}>
              <BarChart3 size={24} color="#ffffff" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Financial Reports</Text>
              <Text style={styles.headerSubtitle}>Advanced insights</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.periodSelector}>
          {(['week', 'month', 'quarter', 'year', 'all'] as const).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodButton,
                selectedPeriod === period && styles.periodButtonActive,
                { borderColor: colors.borderColor, backgroundColor: selectedPeriod === period ? '#1e3a8a' : colors.cardBackground },
              ]}
              onPress={() => setSelectedPeriod(period)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodButtonText, { color: selectedPeriod === period ? '#ffffff' : colors.textColor }]}>
                {period === 'all' ? 'All' : period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>Business Health</Text>
          <View style={styles.healthScoreContainer}>
            <View style={[styles.healthScoreCircle, { borderColor: healthScore.status === 'excellent' ? '#1e3a8a' : '#f59e0b' }]}>
              <Text style={styles.healthScoreValue}>{healthScore.score}</Text>
              <Text style={styles.healthScoreLabel}>/ 100</Text>
            </View>
            <View style={styles.healthScoreDetails}>
              <Text style={[styles.healthScoreStatus, { color: healthScore.status === 'excellent' ? '#1e3a8a' : '#f59e0b' }]}>
                {healthScore.status.charAt(0).toUpperCase() + healthScore.status.slice(1)}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>Today's Summary</Text>
          <View style={styles.dailySummaryGrid}>
            <View style={styles.dailyItem}>
              <Text style={[styles.dailyLabel, { color: colors.textSecondary }]}>Revenue</Text>
              <Text style={[styles.dailyValue, { color: '#1e3a8a' }]}>{formatCurrency(todayData.revenue)}</Text>
            </View>
            <View style={styles.dailyItem}>
              <Text style={[styles.dailyLabel, { color: colors.textSecondary }]}>Expenses</Text>
              <Text style={[styles.dailyValue, { color: '#ef4444' }]}>{formatCurrency(todayData.expenses)}</Text>
            </View>
            <View style={styles.dailyItem}>
              <Text style={[styles.dailyLabel, { color: colors.textSecondary }]}>Profit</Text>
              <Text style={[styles.dailyValue, { color: todayData.net >= 0 ? '#1e3a8a' : '#ef4444' }]}>{formatCurrency(todayData.net)}</Text>
            </View>
            <View style={styles.dailyItem}>
              <Text style={[styles.dailyLabel, { color: colors.textSecondary }]}>Transactions</Text>
              <Text style={[styles.dailyValue, { color: '#1e3a8a' }]}>{todayData.transactionCount}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>Sales Performance</Text>
          <View style={styles.trendContainer}>
            <View style={styles.trendItem}>
              <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Trend</Text>
              <Text style={styles.trendValue}>{salesTrend.direction}</Text>
              <Text style={[styles.trendStatus, { color: salesTrend.trend === 'increasing' ? '#1e3a8a' : '#ef4444' }]}>
                {salesTrend.trend === 'increasing' ? 'Increasing' : salesTrend.trend === 'declining' ? 'Declining' : 'Stable'}
              </Text>
            </View>
            <View style={styles.trendDivider} />
            <View style={styles.trendItem}>
              <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Best Day</Text>
              <Text style={styles.trendValue}>{bestSalesDay ? formatCurrency(bestSalesDay.revenue) : 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>Monthly Forecast</Text>
          <View style={styles.forecastContainer}>
            <View style={styles.forecastItem}>
              <Text style={[styles.forecastLabel, { color: colors.textSecondary }]}>Projected</Text>
              <Text style={[styles.forecastValue, { color: monthlyForecast.projectedMonthlyProfit >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(monthlyForecast.projectedMonthlyProfit)}
              </Text>
            </View>
            <View style={styles.forecastDivider} />
            <View style={styles.forecastItem}>
              <Text style={[styles.forecastLabel, { color: colors.textSecondary }]}>Daily Avg</Text>
              <Text style={[styles.forecastValue, { color: '#1e3a8a' }]}>
                {formatCurrency(monthlyForecast.dailyAverage)}
              </Text>
            </View>
          </View>
        </View>

        {categoryMetrics.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
            <Text style={[styles.cardTitle, { color: colors.textColor }]}>Profit by Category</Text>
            <View style={styles.categoryList}>
              {categoryMetrics.slice(0, 5).map((cat, idx) => (
                <View key={cat.category} style={[styles.categoryRow, { borderBottomColor: colors.borderColor }]}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.categoryRank, { backgroundColor: idx < 2 ? '#1e3a8a' : 'rgba(16, 185, 129, 0.1)' }]}>
                      <Text style={[styles.categoryRankText, { color: idx < 2 ? '#ffffff' : '#1e3a8a' }]}>#{idx + 1}</Text>
                    </View>
                    <Text style={[styles.categoryName, { color: colors.textColor }]}>{cat.category}</Text>
                  </View>
                  <Text style={[styles.categoryProfit, { color: cat.net >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                    {formatCurrency(cat.net)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {suggestions.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
            <Text style={[styles.cardTitle, { color: colors.textColor }]}>Smart Suggestions</Text>
            <View style={styles.suggestionsList}>
              {suggestions.map((sugg) => (
                <View key={sugg.id} style={[styles.suggestionItem, { backgroundColor: sugg.type === 'warning' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)', borderLeftColor: sugg.type === 'warning' ? '#ef4444' : '#1e3a8a' }]}>
                  <Text style={styles.suggestionIcon}>{sugg.icon}</Text>
                  <View style={styles.suggestionContent}>
                    <Text style={[styles.suggestionTitle, { color: colors.textColor }]}>{sugg.title}</Text>
                    <Text style={[styles.suggestionDesc, { color: colors.textSecondary }]}>{sugg.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.shareButton} onPress={() => setShareModalVisible(true)} activeOpacity={0.8}>
          <ShareIcon size={20} color="#ffffff" />
          <Text style={styles.shareButtonText}>Share Report</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={shareModalVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShareModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.textColor }]}>Share Report</Text>
            <TouchableOpacity style={styles.shareOption} onPress={() => handleShareReport('whatsapp')} activeOpacity={0.7}>
              <MessageCircle size={24} color="#25D366" />
              <Text style={[styles.shareOptionTitle, { color: colors.textColor }]}>WhatsApp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareOption} onPress={() => handleShareReport('text')} activeOpacity={0.7}>
              <ShareIcon size={24} color="#1e3a8a" />
              <Text style={[styles.shareOptionTitle, { color: colors.textColor }]}>Share Text</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.shareOption, styles.shareOptionLast]} onPress={() => setShareModalVisible(false)} activeOpacity={0.7}>
              <Text style={[styles.shareOptionTitle, { color: colors.textColor }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { backgroundColor: '#1e3a8a', paddingTop: 60, paddingBottom: 32, paddingHorizontal: 20, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, position: 'relative', overflow: 'hidden' },
  headerDecoration1: { position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  headerDecoration2: { position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  headerContent: { zIndex: 10 },
  headerIconContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIcon: { width: 56, height: 56, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' },
  periodSelector: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  periodButton: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  periodButtonActive: { backgroundColor: '#1e3a8a' },
  periodButtonText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  healthScoreContainer: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  healthScoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  healthScoreValue: { fontSize: 36, fontWeight: '900', color: '#1e3a8a' },
  healthScoreLabel: { fontSize: 12, fontWeight: '600', color: '#666' },
  healthScoreDetails: { flex: 1 },
  healthScoreStatus: { fontSize: 16, fontWeight: '700' },
  dailySummaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dailyItem: { flex: 1, minWidth: '45%', padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, alignItems: 'center' },
  dailyLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  dailyValue: { fontSize: 16, fontWeight: '700' },
  trendContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trendItem: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12 },
  trendLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  trendValue: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  trendStatus: { fontSize: 12, fontWeight: '600' },
  trendDivider: { width: 1, height: 80, backgroundColor: 'rgba(0, 0, 0, 0.1)' },
  forecastContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  forecastItem: { flex: 1, padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12 },
  forecastLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  forecastValue: { fontSize: 18, fontWeight: '800' },
  forecastDivider: { width: 1, height: 80, backgroundColor: 'rgba(0, 0, 0, 0.1)' },
  categoryList: { gap: 0 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  categoryRank: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  categoryRankText: { fontSize: 12, fontWeight: '700' },
  categoryName: { fontSize: 14, fontWeight: '600' },
  categoryProfit: { fontSize: 14, fontWeight: '700' },
  suggestionsList: { gap: 12 },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 12, borderLeftWidth: 4, gap: 12 },
  suggestionIcon: { fontSize: 20 },
  suggestionContent: { flex: 1 },
  suggestionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  suggestionDesc: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e3a8a', borderRadius: 16, paddingVertical: 18, gap: 12, marginTop: 10, marginBottom: 40, shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  shareButtonText: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  shareOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, marginBottom: 12, gap: 16 },
  shareOptionTitle: { fontSize: 16, fontWeight: '600' },
  shareOptionLast: { justifyContent: 'center' },
});
