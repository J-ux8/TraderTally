import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useDebts } from '@/hooks/useDebts';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  BarChart3,
  Share as ShareIcon,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, Modal, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

interface DebtAging {
  range: string;
  total: number;
  count: number;
}

interface FinancialMetrics {
  revenue: number;
  expenses: number;
  netProfit: number;
  customersOwe: number;
  revenueGrowth: number;
  expenseGrowth: number;
  profitGrowth: number;
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

  const getPreviousPeriodRange = useCallback((period: string) => {
    const range = getDateRange(period);
    const duration = range.end.getTime() - range.start.getTime();
    const prevEnd = new Date(range.start);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start: prevStart, end: prevEnd };
  }, [getDateRange]);

  const filteredTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions;
    const range = getDateRange(selectedPeriod);
    if (!range) return transactions;
    return transactions.filter(t => {
      const txDate = new Date(t.transaction_date);
      return txDate >= range.start && txDate <= range.end;
    });
  }, [transactions, selectedPeriod, getDateRange]);

  const previousPeriodTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return [];
    const range = getPreviousPeriodRange(selectedPeriod);
    return transactions.filter(t => {
      const txDate = new Date(t.transaction_date);
      return txDate >= range.start && txDate <= range.end;
    });
  }, [transactions, selectedPeriod, getPreviousPeriodRange]);

  const currentMetrics = useMemo((): FinancialMetrics => {
    const revenue = filteredTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = filteredTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const netProfit = revenue - expenses;
    const customersOwe = debts.filter(d => !d.is_settled).reduce((sum, d) => sum + Number(d.amount), 0);
    return { revenue, expenses, netProfit, customersOwe, revenueGrowth: 0, expenseGrowth: 0, profitGrowth: 0 };
  }, [filteredTransactions, debts]);

  const previousMetrics = useMemo((): FinancialMetrics => {
    const revenue = previousPeriodTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = previousPeriodTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const netProfit = revenue - expenses;
    return { revenue, expenses, netProfit, customersOwe: 0, revenueGrowth: 0, expenseGrowth: 0, profitGrowth: 0 };
  }, [previousPeriodTransactions]);

  const growthMetrics = useMemo(() => {
    const revenueGrowth = previousMetrics.revenue > 0 ? ((currentMetrics.revenue - previousMetrics.revenue) / previousMetrics.revenue) * 100 : 0;
    const expenseGrowth = previousMetrics.expenses > 0 ? ((currentMetrics.expenses - previousMetrics.expenses) / previousMetrics.expenses) * 100 : 0;
    const profitGrowth = previousMetrics.netProfit !== 0 ? ((currentMetrics.netProfit - previousMetrics.netProfit) / Math.abs(previousMetrics.netProfit)) * 100 : 0;
    return { revenueGrowth, expenseGrowth, profitGrowth };
  }, [currentMetrics, previousMetrics]);

  const cashFlowData = useMemo(() => {
    const totalIn = currentMetrics.revenue;
    const totalOut = currentMetrics.expenses;
    const netCashFlow = totalIn - totalOut;
    const openingBalance = previousMetrics.netProfit;
    const closingBalance = openingBalance + netCashFlow;
    return { totalIn, totalOut, netCashFlow, openingBalance, closingBalance };
  }, [currentMetrics, previousMetrics]);

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
    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredTransactions]);

  const bestSalesDay = useMemo(() => {
    if (dailyTimeline.length === 0) return null;
    return dailyTimeline.reduce((best, day) => day.revenue > best.revenue ? day : best);
  }, [dailyTimeline]);

  const averageDailyRevenue = useMemo(() => {
    return dailyTimeline.length > 0 ? dailyTimeline.reduce((sum, d) => sum + d.revenue, 0) / dailyTimeline.length : 0;
  }, [dailyTimeline]);

  const averageDailyProfit = useMemo(() => {
    return dailyTimeline.length > 0 ? dailyTimeline.reduce((sum, d) => sum + d.net, 0) / dailyTimeline.length : 0;
  }, [dailyTimeline]);

  const debtRiskData = useMemo(() => {
    const activeDebts = debts.filter(d => !d.is_settled);
    const now = new Date();
    const overdueDebts = activeDebts.filter(d => {
      if (!d.due_date) return false;
      return new Date(d.due_date) < now;
    });
    const totalRisk = activeDebts.reduce((sum, d) => sum + Number(d.amount), 0);
    const oldestDebt = activeDebts.length > 0 ? activeDebts.reduce((oldest, d) => {
      const dDate = d.due_date ? new Date(d.due_date) : new Date();
      const oDate = oldest.due_date ? new Date(oldest.due_date) : new Date();
      return dDate < oDate ? d : oldest;
    }) : null;
    return { overdueDebts, totalRisk, oldestDebt };
  }, [debts]);

  const debtAging = useMemo((): DebtAging[] => {
    const activeDebts = debts.filter(d => !d.is_settled);
    const now = new Date();
    const aging = {
      '0-7 days': { total: 0, count: 0 },
      '8-14 days': { total: 0, count: 0 },
      '15-30 days': { total: 0, count: 0 },
      '30+ days': { total: 0, count: 0 },
    };
    activeDebts.forEach(d => {
      if (!d.due_date) return;
      const dueDate = new Date(d.due_date);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = Number(d.amount);
      if (daysOverdue <= 7) {
        aging['0-7 days'].total += amount;
        aging['0-7 days'].count++;
      } else if (daysOverdue <= 14) {
        aging['8-14 days'].total += amount;
        aging['8-14 days'].count++;
      } else if (daysOverdue <= 30) {
        aging['15-30 days'].total += amount;
        aging['15-30 days'].count++;
      } else {
        aging['30+ days'].total += amount;
        aging['30+ days'].count++;
      }
    });
    return Object.entries(aging).map(([range, data]) => ({ range, ...data }));
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
    if (totalRevenue === 0 || categoryMetrics.length === 0) return { isConcentrated: false, topCategory: null, percentage: 0 };
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
    const revenueGrowth = growthMetrics.profitGrowth > 0 ? Math.min(25, (growthMetrics.profitGrowth / 50) * 25) : 0;
    const debtRisk = Math.max(0, 25 - (debtRiskData.totalRisk / (totalRevenue || 1)) * 25);
    const score = Math.round(profitability + expenseControl + revenueGrowth + debtRisk);
    let status: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
    if (score >= 80) status = 'excellent';
    else if (score >= 60) status = 'good';
    else if (score >= 40) status = 'fair';
    return { score, profitability, expenseControl, revenueGrowth, debtRisk, status };
  }, [categoryMetrics, growthMetrics, debtRiskData]);

  const suggestions = useMemo((): Suggestion[] => {
    const sugg: Suggestion[] = [];
    if (growthMetrics.revenueGrowth > 10) {
      sugg.push({
        id: 'revenue-increase',
        type: 'opportunity',
        title: 'Sales Growing Strong',
        description: `Revenue increased by ${growthMetrics.revenueGrowth.toFixed(0)}% compared to last period.`,
        icon: '📈',
      });
    }
    if (categoryMetrics.length > 0 && categoryMetrics[0].revenue > 0) {
      sugg.push({
        id: 'top-category',
        type: 'opportunity',
        title: 'Top Revenue Driver',
        description: `${categoryMetrics[0].category} generates ${categoryMetrics[0].percentage.toFixed(0)}% of your activity.`,
        icon: '⭐',
      });
    }
    const expenseRatio = categoryMetrics.reduce((sum, c) => sum + c.expenses, 0) / (categoryMetrics.reduce((sum, c) => sum + c.revenue, 0) || 1) * 100;
    if (expenseRatio > 60) {
      sugg.push({
        id: 'high-expenses',
        type: 'warning',
        title: 'High Expense Ratio',
        description: `Expenses are ${expenseRatio.toFixed(0)}% of revenue. Consider reducing costs.`,
        icon: '💸',
      });
    }
    if (revenueConcentration.isConcentrated) {
      sugg.push({
        id: 'revenue-concentration',
        type: 'warning',
        title: 'Revenue Concentration Risk',
        description: `${revenueConcentration.topCategory} is ${revenueConcentration.percentage.toFixed(0)}% of revenue. Diversify!`,
        icon: '⚠️',
      });
    }
    if (debtRiskData.overdueDebts.length > 0) {
      sugg.push({
        id: 'overdue-follow-up',
        type: 'action',
        title: 'Follow Up on Overdue Payments',
        description: `${debtRiskData.overdueDebts.length} customer(s) have overdue payments. Collect now!`,
        icon: '⏰',
      });
    }
    return sugg.slice(0, 3);
  }, [growthMetrics, categoryMetrics, revenueConcentration, debtRiskData]);

  const formatCurrency = useCallback((amount: number) => {
    return `K ${Math.abs(amount).toFixed(2)}`;
  }, []);

  const formatGrowth = useCallback((value: number) => {
    if (value > 0) return `+${value.toFixed(1)}%`;
    return `${value.toFixed(1)}%`;
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
    const topCategory = categoryMetrics.length > 0 ? categoryMetrics[0].category : 'N/A';
    let message = `📊 *MobiBooks Financial Report* (${periodLabel})\n\n`;
    message += `💰 Revenue: ${formatCurrency(currentMetrics.revenue)}\n`;
    message += `💸 Expenses: ${formatCurrency(currentMetrics.expenses)}\n`;
    message += `📈 Net Profit: ${formatCurrency(currentMetrics.netProfit)}\n`;
    message += `💳 Customers Owe: ${formatCurrency(currentMetrics.customersOwe)}\n`;
    message += `💧 Cash Flow: ${formatCurrency(cashFlowData.netCashFlow)}\n`;
    message += `⭐ Top Category: ${topCategory}\n`;
    message += `❤️ Business Health: ${healthScore.score}/100\n\n`;
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
              <Text style={styles.headerSubtitle}>Professional Dashboard</Text>
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

        {/* SECTION 1: BUSINESS OVERVIEW */}
        <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Business Overview</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <View style={styles.metricsGrid}>
            <View style={styles.metricBox}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Revenue</Text>
              <Text style={[styles.metricValue, { color: '#1e3a8a' }]}>{formatCurrency(currentMetrics.revenue)}</Text>
              <View style={styles.growthBadge}>
                <Text style={[styles.growthText, { color: growthMetrics.revenueGrowth >= 0 ? '#10b981' : '#ef4444' }]}>
                  {formatGrowth(growthMetrics.revenueGrowth)}
                </Text>
              </View>
            </View>

            <View style={styles.metricBox}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Expenses</Text>
              <Text style={[styles.metricValue, { color: '#ef4444' }]}>{formatCurrency(currentMetrics.expenses)}</Text>
              <View style={styles.growthBadge}>
                <Text style={[styles.growthText, { color: growthMetrics.expenseGrowth <= 0 ? '#10b981' : '#ef4444' }]}>
                  {formatGrowth(growthMetrics.expenseGrowth)}
                </Text>
              </View>
            </View>

            <View style={styles.metricBox}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Net Profit</Text>
              <Text style={[styles.metricValue, { color: currentMetrics.netProfit >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(currentMetrics.netProfit)}
              </Text>
              <View style={styles.growthBadge}>
                <Text style={[styles.growthText, { color: growthMetrics.profitGrowth >= 0 ? '#10b981' : '#ef4444' }]}>
                  {formatGrowth(growthMetrics.profitGrowth)}
                </Text>
              </View>
            </View>

            <View style={styles.metricBox}>
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Customers Owe</Text>
              <Text style={[styles.metricValue, { color: '#f59e0b' }]}>{formatCurrency(currentMetrics.customersOwe)}</Text>
              <View style={styles.growthBadge}>
                <Text style={[styles.growthText, { color: '#666' }]}>Pending</Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 2: CASH FLOW ANALYSIS */}
        <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Cash Flow Analysis</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <View style={styles.cashFlowGrid}>
            <View style={styles.cashFlowItem}>
              <Text style={[styles.cashFlowLabel, { color: colors.textSecondary }]}>Money In</Text>
              <Text style={[styles.cashFlowValue, { color: '#10b981' }]}>{formatCurrency(cashFlowData.totalIn)}</Text>
            </View>
            <View style={styles.cashFlowDivider} />
            <View style={styles.cashFlowItem}>
              <Text style={[styles.cashFlowLabel, { color: colors.textSecondary }]}>Money Out</Text>
              <Text style={[styles.cashFlowValue, { color: '#ef4444' }]}>{formatCurrency(cashFlowData.totalOut)}</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

          <View style={styles.cashFlowGrid}>
            <View style={styles.cashFlowItem}>
              <Text style={[styles.cashFlowLabel, { color: colors.textSecondary }]}>Net Cash Flow</Text>
              <Text style={[styles.cashFlowValue, { color: cashFlowData.netCashFlow >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(cashFlowData.netCashFlow)}
              </Text>
            </View>
            <View style={styles.cashFlowDivider} />
            <View style={styles.cashFlowItem}>
              <Text style={[styles.cashFlowLabel, { color: colors.textSecondary }]}>Closing Balance</Text>
              <Text style={[styles.cashFlowValue, { color: cashFlowData.closingBalance >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(cashFlowData.closingBalance)}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 3: FINANCIAL TRENDS */}
        <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Financial Trends</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <View style={styles.trendsGrid}>
            <View style={styles.trendItem}>
              <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Best Sales Day</Text>
              <Text style={styles.trendValue}>{bestSalesDay ? formatCurrency(bestSalesDay.revenue) : 'N/A'}</Text>
              <Text style={[styles.trendDate, { color: colors.textSecondary }]}>
                {bestSalesDay ? bestSalesDay.date : 'No data'}
              </Text>
            </View>

            <View style={styles.trendItem}>
              <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Avg Daily Revenue</Text>
              <Text style={styles.trendValue}>{formatCurrency(averageDailyRevenue)}</Text>
              <Text style={[styles.trendDate, { color: colors.textSecondary }]}>Per day</Text>
            </View>

            <View style={styles.trendItem}>
              <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Avg Daily Profit</Text>
              <Text style={[styles.trendValue, { color: averageDailyProfit >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(averageDailyProfit)}
              </Text>
              <Text style={[styles.trendDate, { color: colors.textSecondary }]}>Per day</Text>
            </View>
          </View>
        </View>

        {/* SECTION 4: CATEGORY PERFORMANCE */}
        {categoryMetrics.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Category Performance</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
              <View style={styles.categoryList}>
                {categoryMetrics.slice(0, 5).map((cat, idx) => (
                  <View key={cat.category} style={[styles.categoryRow, { borderBottomColor: colors.borderColor }]}>
                    <View style={styles.categoryLeft}>
                      <View style={[styles.categoryRank, { backgroundColor: idx < 2 ? '#1e3a8a' : 'rgba(16, 185, 129, 0.1)' }]}>
                        <Text style={[styles.categoryRankText, { color: idx < 2 ? '#ffffff' : '#1e3a8a' }]}>#{idx + 1}</Text>
                      </View>
                      <View style={styles.categoryInfo}>
                        <Text style={[styles.categoryName, { color: colors.textColor }]}>{cat.category}</Text>
                        <Text style={[styles.categoryPercent, { color: colors.textSecondary }]}>{cat.percentage.toFixed(1)}% of activity</Text>
                      </View>
                    </View>
                    <View style={styles.categoryRight}>
                      <Text style={[styles.categoryProfit, { color: cat.net >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                        {formatCurrency(cat.net)}
                      </Text>
                      <Text style={[styles.categoryRevenue, { color: colors.textSecondary }]}>
                        Rev: {formatCurrency(cat.revenue)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* SECTION 5: CREDIT & DEBT ANALYSIS */}
        <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Credit & Debt Analysis</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <View style={styles.debtSummary}>
            <View style={styles.debtSummaryItem}>
              <Text style={[styles.debtLabel, { color: colors.textSecondary }]}>Total Pending</Text>
              <Text style={[styles.debtValue, { color: '#f59e0b' }]}>{formatCurrency(debtRiskData.totalRisk)}</Text>
            </View>
            <View style={styles.debtSummaryItem}>
              <Text style={[styles.debtLabel, { color: colors.textSecondary }]}>Overdue Customers</Text>
              <Text style={[styles.debtValue, { color: debtRiskData.overdueDebts.length > 0 ? '#ef4444' : '#10b981' }]}>
                {debtRiskData.overdueDebts.length}
              </Text>
            </View>
            <View style={styles.debtSummaryItem}>
              <Text style={[styles.debtLabel, { color: colors.textSecondary }]}>Oldest Debt</Text>
              <Text style={[styles.debtValue, { color: '#666' }]}>
                {debtRiskData.oldestDebt ? debtRiskData.oldestDebt.due_date?.split('T')[0] : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

          <Text style={[styles.debtAgingTitle, { color: colors.textColor }]}>Debt Aging Report</Text>
          <View style={styles.debtAgingList}>
            {debtAging.map((aging) => (
              <View key={aging.range} style={[styles.debtAgingRow, { borderBottomColor: colors.borderColor }]}>
                <View style={styles.debtAgingLeft}>
                  <Text style={[styles.debtAgingRange, { color: colors.textColor }]}>{aging.range}</Text>
                  <Text style={[styles.debtAgingCount, { color: colors.textSecondary }]}>{aging.count} debt(s)</Text>
                </View>
                <Text style={[styles.debtAgingAmount, { color: aging.range === '30+ days' ? '#ef4444' : '#f59e0b' }]}>
                  {formatCurrency(aging.total)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* SECTION 6: BUSINESS HEALTH DIAGNOSTICS */}
        <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Business Health Diagnostics</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <View style={styles.healthScoreContainer}>
            <View style={[styles.healthScoreCircle, { borderColor: healthScore.status === 'excellent' ? '#1e3a8a' : '#f59e0b' }]}>
              <Text style={styles.healthScoreValue}>{healthScore.score}</Text>
              <Text style={styles.healthScoreLabel}>/ 100</Text>
            </View>
            <View style={styles.healthScoreDetails}>
              <Text style={[styles.healthScoreStatus, { color: healthScore.status === 'excellent' ? '#1e3a8a' : '#f59e0b' }]}>
                {healthScore.status.charAt(0).toUpperCase() + healthScore.status.slice(1)}
              </Text>
              <Text style={[styles.healthScoreSubtext, { color: colors.textSecondary }]}>Overall Health</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

          <View style={styles.scoreBreakdown}>
            <View style={styles.scoreItem}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Profitability</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: `${(healthScore.profitability / 25) * 100}%`, backgroundColor: '#1e3a8a' }]} />
              </View>
              <Text style={[styles.scoreValue, { color: colors.textColor }]}>{healthScore.profitability.toFixed(1)}/25</Text>
            </View>

            <View style={styles.scoreItem}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Expense Control</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: `${(healthScore.expenseControl / 25) * 100}%`, backgroundColor: '#10b981' }]} />
              </View>
              <Text style={[styles.scoreValue, { color: colors.textColor }]}>{healthScore.expenseControl.toFixed(1)}/25</Text>
            </View>

            <View style={styles.scoreItem}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Revenue Growth</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: `${(healthScore.revenueGrowth / 25) * 100}%`, backgroundColor: '#f59e0b' }]} />
              </View>
              <Text style={[styles.scoreValue, { color: colors.textColor }]}>{healthScore.revenueGrowth.toFixed(1)}/25</Text>
            </View>

            <View style={styles.scoreItem}>
              <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Debt Risk</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: `${(healthScore.debtRisk / 25) * 100}%`, backgroundColor: '#ef4444' }]} />
              </View>
              <Text style={[styles.scoreValue, { color: colors.textColor }]}>{healthScore.debtRisk.toFixed(1)}/25</Text>
            </View>
          </View>
        </View>

        {/* SECTION 7: INTELLIGENT INSIGHTS */}
        {suggestions.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Intelligent Insights</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
              <View style={styles.suggestionsList}>
                {suggestions.map((sugg) => (
                  <View key={sugg.id} style={[styles.suggestionItem, { backgroundColor: sugg.type === 'warning' ? 'rgba(239, 68, 68, 0.05)' : sugg.type === 'action' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(16, 185, 129, 0.05)', borderLeftColor: sugg.type === 'warning' ? '#ef4444' : sugg.type === 'action' ? '#3b82f6' : '#10b981' }]}>
                    <Text style={styles.suggestionIcon}>{sugg.icon}</Text>
                    <View style={styles.suggestionContent}>
                      <Text style={[styles.suggestionTitle, { color: colors.textColor }]}>{sugg.title}</Text>
                      <Text style={[styles.suggestionDesc, { color: colors.textSecondary }]}>{sugg.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </>
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
  sectionHeader: { borderBottomWidth: 2, paddingBottom: 12, marginTop: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  card: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricBox: { flex: 1, minWidth: '45%', padding: 16, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, alignItems: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  metricValue: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  growthBadge: { paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 6 },
  growthText: { fontSize: 11, fontWeight: '600' },
  cashFlowGrid: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  cashFlowItem: { flex: 1, padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12 },
  cashFlowLabel: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  cashFlowValue: { fontSize: 18, fontWeight: '800' },
  cashFlowDivider: { width: 1, height: 60, backgroundColor: 'rgba(0, 0, 0, 0.1)' },
  divider: { height: 1, marginVertical: 16 },
  trendsGrid: { flexDirection: 'row', gap: 12 },
  trendItem: { flex: 1, padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12, alignItems: 'center' },
  trendLabel: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  trendValue: { fontSize: 18, fontWeight: '800', marginBottom: 4, color: '#1e3a8a' },
  trendDate: { fontSize: 10, fontWeight: '500' },
  categoryList: { gap: 0 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  categoryRank: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  categoryRankText: { fontSize: 12, fontWeight: '700' },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  categoryPercent: { fontSize: 11, fontWeight: '500' },
  categoryRight: { alignItems: 'flex-end' },
  categoryProfit: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  categoryRevenue: { fontSize: 11, fontWeight: '500' },
  debtSummary: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  debtSummaryItem: { alignItems: 'center' },
  debtLabel: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  debtValue: { fontSize: 18, fontWeight: '800' },
  debtAgingTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  debtAgingList: { gap: 0 },
  debtAgingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  debtAgingLeft: { flex: 1 },
  debtAgingRange: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  debtAgingCount: { fontSize: 11, fontWeight: '500' },
  debtAgingAmount: { fontSize: 14, fontWeight: '700' },
  healthScoreContainer: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 16 },
  healthScoreCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  healthScoreValue: { fontSize: 36, fontWeight: '900', color: '#1e3a8a' },
  healthScoreLabel: { fontSize: 12, fontWeight: '600', color: '#666' },
  healthScoreDetails: { flex: 1 },
  healthScoreStatus: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  healthScoreSubtext: { fontSize: 12, fontWeight: '500' },
  scoreBreakdown: { gap: 16 },
  scoreItem: { gap: 8 },
  scoreLabel: { fontSize: 12, fontWeight: '600' },
  scoreBar: { height: 8, backgroundColor: 'rgba(0, 0, 0, 0.1)', borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: 4 },
  scoreValue: { fontSize: 11, fontWeight: '600' },
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
