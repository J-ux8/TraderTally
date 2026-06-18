import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useDebts } from '@/hooks/useDebts';
import { useThemeColors } from '@/hooks/useThemeColors';
import { getProductProfits, ProductProfit } from '@/lib/profitCalculations';
import {
  BarChart3,
  Share as ShareIcon,
  MessageCircle,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View, Modal, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

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
  revenueShare: number;
  marginPct: number;
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
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { 
    transactions, 
    refresh, 
    groupedTransactions, 
    groupingEnabled,
    groupingMetrics 
  } = useTransactionsContext();
  const { debts, refresh: refreshDebts } = useDebts();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [refreshing, setRefreshing] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [productProfits, setProductProfits] = useState<ProductProfit[]>([]);
  const [productProfitsLoading, setProductProfitsLoading] = useState(true);
  const [totalCOGS, setTotalCOGS] = useState(0);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshDebts();
      refresh();
    }, [refreshDebts, refresh])
  );

  // Refresh data at midnight to update daily metrics
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const midnightTimer = setTimeout(() => {
      refreshDebts();
      refresh();
      
      // Set up recurring daily refresh
      const dailyRefreshInterval = setInterval(() => {
        refreshDebts();
        refresh();
      }, 24 * 60 * 60 * 1000); // Every 24 hours
      
      return () => clearInterval(dailyRefreshInterval);
    }, timeUntilMidnight);
    
    return () => clearTimeout(midnightTimer);
  }, [refreshDebts, refresh]);

  const getDateRange = useCallback((period: string) => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    switch (period) {
      case 'week': {
        const day = now.getDay();
        start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        break;
      }
      case 'month':
        start.setDate(1);
        break;
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3) * 3;
        start.setMonth(q, 1);
        break;
      }
      case 'year':
        start.setMonth(0, 1);
        break;
      case 'all':
        return null;
    }
    return { start, end };
  }, []);

  const getPreviousPeriodRange = useCallback((period: string) => {
    const range = getDateRange(period);
    if (!range) return null;
    const duration = range.end.getTime() - range.start.getTime();
    const prevEnd = new Date(range.start);
    const prevStart = new Date(prevEnd.getTime() - duration);
    return { start: prevStart, end: prevEnd };
  }, [getDateRange]);

  const fmtDate = useCallback((d: Date) => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const filteredTransactions = useMemo(() => {
    const range = getDateRange(selectedPeriod);
    if (!range) return transactions;

    const rangeStart = fmtDate(range.start);
    const rangeEnd = fmtDate(range.end);

    return transactions.filter(t => {
      const txDate = (t.transaction_date || '').split('T')[0];
      return txDate >= rangeStart && txDate <= rangeEnd;
    });
  }, [transactions, selectedPeriod, getDateRange, fmtDate]);

  const previousPeriodTransactions = useMemo(() => {
    const range = getPreviousPeriodRange(selectedPeriod);
    if (!range) return [];

    const rangeStart = fmtDate(range.start);
    const rangeEnd = fmtDate(range.end);

    return transactions.filter(t => {
      const txDate = (t.transaction_date || '').split('T')[0];
      return txDate >= rangeStart && txDate <= rangeEnd;
    });
  }, [transactions, selectedPeriod, getPreviousPeriodRange, fmtDate]);

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

  const grossProfit = useMemo(() => currentMetrics.revenue - totalCOGS, [currentMetrics.revenue, totalCOGS]);

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
      const dateKey = (t.transaction_date || '').split('T')[0];
      if (!dateKey) return;
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

  const chartData = useMemo(() => {
    if (dailyTimeline.length === 0) return [];

    if (selectedPeriod === 'week') {
      return dailyTimeline.map(d => ({
        label: new Date(d.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }),
        revenue: d.revenue,
        expenses: d.expenses,
        net: d.net,
      }));
    }

    if (selectedPeriod === 'month') {
      return dailyTimeline.map(d => ({
        label: String(parseInt(d.date.split('-')[2], 10)),
        revenue: d.revenue,
        expenses: d.expenses,
        net: d.net,
      }));
    }

    const monthMap = new Map<string, { revenue: number; expenses: number }>();
    dailyTimeline.forEach(d => {
      const monthKey = d.date.substring(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { revenue: 0, expenses: 0 });
      }
      const m = monthMap.get(monthKey)!;
      m.revenue += d.revenue;
      m.expenses += d.expenses;
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Array.from(monthMap.entries()).map(([key, val]) => ({
      label: months[parseInt(key.split('-')[1], 10) - 1] || key,
      revenue: val.revenue,
      expenses: val.expenses,
      net: val.revenue - val.expenses,
    }));
  }, [dailyTimeline, selectedPeriod]);

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

  // Load product profits for current period
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setProductProfitsLoading(true);
      try {
        const range = getDateRange(selectedPeriod);
        const startDate = range ? range.start.toISOString() : undefined;
        const endDate = range ? range.end.toISOString() : undefined;
        const data = await getProductProfits(startDate, endDate);
        if (mounted) {
          setProductProfits(data);
          setTotalCOGS(data.reduce((sum, p) => sum + p.total_cost, 0));
        }
      } catch (e) {
        console.error('Failed to load product profits:', e);
      } finally {
        if (mounted) setProductProfitsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedPeriod, getDateRange]);

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

    if (groupingEnabled) {
      groupedTransactions.forEach(group => {
        const category = group.category || 'Uncategorized';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { category, revenue: 0, expenses: 0, net: 0, count: 0, revenueShare: 0, marginPct: 0 });
        }
        const cat = categoryMap.get(category)!;

        group.transactions.forEach((tx: any) => {
          cat.count++;
          if (tx.amount > 0) {
            cat.revenue += Number(tx.amount);
          } else {
            cat.expenses += Math.abs(Number(tx.amount));
          }
        });
        cat.net = cat.revenue - cat.expenses;
      });
    } else {
      filteredTransactions.forEach(t => {
        const category = t.category || 'Uncategorized';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { category, revenue: 0, expenses: 0, net: 0, count: 0, revenueShare: 0, marginPct: 0 });
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
    }

    const totalRevenue = Array.from(categoryMap.values()).reduce((s, c) => s + c.revenue, 0);

    return Array.from(categoryMap.values())
      .map(cat => ({
        ...cat,
        revenueShare: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0,
        marginPct: cat.revenue > 0 ? (cat.net / cat.revenue) * 100 : 0,
      }))
      .filter(cat => cat.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredTransactions, groupedTransactions, groupingEnabled]);

  const revenueConcentration = useMemo(() => {
    const totalRevenue = categoryMetrics.reduce((sum, c) => sum + c.revenue, 0);
    if (totalRevenue === 0 || categoryMetrics.length === 0) return { isConcentrated: false, topCategory: null, percentage: 0 };
    const topCategory = categoryMetrics[0];
    return { isConcentrated: topCategory.revenueShare > 50, topCategory: topCategory.category, percentage: topCategory.revenueShare };
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
    
    // Grouping-specific insights
    if (groupingEnabled && groupingMetrics.averageGroupSize > 3) {
      sugg.push({
        id: 'frequent-products',
        type: 'opportunity',
        title: 'High-Frequency Products',
        description: `You're selling ${groupingMetrics.averageGroupSize.toFixed(1)} of the same items on average. Consider bulk pricing!`,
        icon: '🔄',
      });
    }
    
    if (categoryMetrics.length > 0 && categoryMetrics[0].revenue > 0) {
      sugg.push({
        id: 'top-category',
        type: 'opportunity',
        title: 'Top Revenue Driver',
        description: `${categoryMetrics[0].category} generates ${categoryMetrics[0].revenueShare.toFixed(0)}% of revenue.`,
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
  }, [growthMetrics, categoryMetrics, revenueConcentration, debtRiskData, groupingEnabled, groupingMetrics]);

  const formatCurrency = useCallback((amount: number) => {
    if (privacyMode) return '****';
    return `K ${Math.abs(amount).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [privacyMode]);

  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString('en-ZM', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const periodDateRangeDisplay = useMemo(() => {
    const range = getDateRange(selectedPeriod);
    if (!range) return 'All Recorded Activity';
    return `${formatDate(range.start)} - ${formatDate(range.end)}`;
  }, [selectedPeriod, getDateRange, formatDate]);

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
    let message = `📊 *TraderBooks Financial Report* (${periodLabel})\n\n`;
    message += `💰 Revenue: ${formatCurrency(currentMetrics.revenue)}\n`;
    message += `💸 Expenses: ${formatCurrency(currentMetrics.expenses)}\n`;
    message += `📈 Net Profit: ${formatCurrency(currentMetrics.netProfit)}\n`;
    message += `💳 Customers Owe: ${formatCurrency(currentMetrics.customersOwe)}\n`;
    message += `💧 Cash Flow: ${formatCurrency(cashFlowData.netCashFlow)}\n`;
    message += `⭐ Top Category: ${topCategory}\n`;
    message += `❤️ Business Health: ${healthScore.score}/100\n\n`;
    message += `_Growing with TraderBooks!_ 🇿🇲`;
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
    <View style={[styles.safeArea, { backgroundColor: colors.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground, paddingTop: Math.max(10, insets.top + 4) }]}>
        <View style={styles.headerDecoration1} />
        <View style={styles.headerDecoration2} />
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <BarChart3 size={22} color="#1e3a8a" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: colors.textColor }]}>Financial Reports</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Professional Dashboard</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.privacyToggle, { backgroundColor: 'rgba(30, 58, 138, 0.08)' }]} 
              onPress={() => setPrivacyMode(!privacyMode)}
              activeOpacity={0.7}
            >
              {privacyMode ? <EyeOff size={22} color="#1e3a8a" /> : <Eye size={22} color="#1e3a8a" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodSelectorContent}
          style={styles.periodSelector}
        >
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
        </ScrollView>

        <View style={styles.dateRangeIndicator}>
          <Text style={[styles.dateRangeText, { color: colors.textSecondary }]}>
            {periodDateRangeDisplay}
          </Text>
        </View>

        {/* SECTION 1: PERFORMANCE OVERVIEW */}
        <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Performance Overview</Text>
        </View>

        {/* REVENUE TREND CHART */}
        <View style={[styles.card, styles.chartCard, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.chartTitle, { color: colors.textColor }]}>Revenue Trend</Text>
              <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
                {selectedPeriod === 'all' ? 'Lifetime' : selectedPeriod === 'week' ? 'This Week' : selectedPeriod === 'month' ? 'This Month' : selectedPeriod === 'quarter' ? 'This Quarter' : 'This Year'}
              </Text>
            </View>
            <View style={[styles.chartMetric, { backgroundColor: 'rgba(30, 58, 138, 0.1)' }]}>
              <TrendingUp size={16} color="#1e3a8a" />
              <Text style={styles.chartMetricText}>{formatGrowth(growthMetrics.revenueGrowth)}</Text>
            </View>
          </View>

          <View style={styles.visualChartContainer}>
            {chartData.length < 2 ? (
              <View style={styles.noDataChart}>
                <BarChart3 size={40} color={colors.borderColor} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Need more data for trends</Text>
              </View>
            ) : (
              <View style={styles.barChart}>
                {chartData.map((d, idx) => {
                  const maxVal = Math.max(...chartData.map(x => Math.max(x.revenue, x.expenses)), 1);
                  const revHeight = Math.max(3, (d.revenue / maxVal) * 100);
                  const expHeight = Math.max(3, (d.expenses / maxVal) * 100);
                  const showLabel = selectedPeriod === 'month'
                    ? parseInt(d.label, 10) % 5 === 0 || idx === chartData.length - 1
                    : true;
                  return (
                    <View key={`${d.label}-${idx}`} style={styles.barGroup}>
                      <View style={styles.barPair}>
                        <View style={[styles.barFill, styles.barRevenue, { height: `${revHeight}%` }]} />
                        <View style={[styles.barFill, styles.barExpense, { height: `${expHeight}%` }]} />
                      </View>
                      {showLabel && (
                        <Text style={[styles.barLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                          {d.label}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {chartData.length >= 2 && (
            <View style={styles.chartLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#1e3a8a' }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Revenue</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Expenses</Text>
              </View>
            </View>
          )}
        </View>

        {/* KPI GRID */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <View style={styles.kpiGrid}>
            <View style={styles.kpiBox}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Revenue</Text>
              <Text style={[styles.kpiValue, { color: '#1e3a8a' }]}>{formatCurrency(currentMetrics.revenue)}</Text>
              <View style={styles.kpiChange}>
                <TrendingUp size={12} color={growthMetrics.revenueGrowth >= 0 ? '#10b981' : '#ef4444'} />
                <Text style={[styles.kpiChangeText, { color: growthMetrics.revenueGrowth >= 0 ? '#10b981' : '#ef4444' }]}>
                  {formatGrowth(growthMetrics.revenueGrowth)}
                </Text>
              </View>
            </View>

            <View style={styles.kpiBox}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Expenses</Text>
              <Text style={[styles.kpiValue, { color: '#ef4444' }]}>{formatCurrency(currentMetrics.expenses)}</Text>
              <View style={styles.kpiChange}>
                <TrendingDown size={12} color={growthMetrics.expenseGrowth <= 0 ? '#10b981' : '#ef4444'} />
                <Text style={[styles.kpiChangeText, { color: growthMetrics.expenseGrowth <= 0 ? '#10b981' : '#ef4444' }]}>
                  {formatGrowth(growthMetrics.expenseGrowth)}
                </Text>
              </View>
            </View>

            <View style={styles.kpiBox}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Net Profit</Text>
              <Text style={[styles.kpiValue, { color: currentMetrics.netProfit >= 0 ? '#059669' : '#dc2626' }]}>
                {formatCurrency(currentMetrics.netProfit)}
              </Text>
              <View style={styles.kpiChange}>
                <TrendingUp size={12} color={growthMetrics.profitGrowth >= 0 ? '#10b981' : '#ef4444'} />
                <Text style={[styles.kpiChangeText, { color: growthMetrics.profitGrowth >= 0 ? '#10b981' : '#ef4444' }]}>
                  {formatGrowth(growthMetrics.profitGrowth)}
                </Text>
              </View>
            </View>

            <View style={styles.kpiBox}>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Profit Margin</Text>
              <Text style={[styles.kpiValue, { color: currentMetrics.revenue > 0 ? (currentMetrics.netProfit / currentMetrics.revenue >= 0.2 ? '#059669' : '#f59e0b') : '#666' }]}>
                {currentMetrics.revenue > 0 ? `${((currentMetrics.netProfit / currentMetrics.revenue) * 100).toFixed(1)}%` : '—'}
              </Text>
              <View style={styles.kpiChange}>
                <Text style={[styles.kpiChangeText, { color: colors.textSecondary }]}>
                  of revenue
                </Text>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

          {/* COGS & GROSS PROFIT */}
          <View style={styles.subMetricRow}>
            <View style={styles.subMetricItem}>
              <Text style={[styles.subMetricLabel, { color: colors.textSecondary }]}>Cost of Goods Sold</Text>
              <Text style={[styles.subMetricValue, { color: '#dc2626' }]}>{formatCurrency(totalCOGS)}</Text>
              <Text style={[styles.subMetricCaption, { color: colors.textSecondary }]}>
                {totalCOGS > 0 ? 'Inventory cost of products sold' : 'No product sales'}
              </Text>
            </View>
            <View style={[styles.subMetricDivider, { backgroundColor: colors.borderColor }]} />
            <View style={styles.subMetricItem}>
              <Text style={[styles.subMetricLabel, { color: colors.textSecondary }]}>Gross Profit</Text>
              <Text style={[styles.subMetricValue, { color: grossProfit >= 0 ? '#059669' : '#dc2626' }]}>{formatCurrency(grossProfit)}</Text>
              <Text style={[styles.subMetricCaption, { color: colors.textSecondary }]}>
                {currentMetrics.revenue > 0
                  ? `${((grossProfit / Math.abs(currentMetrics.revenue)) * 100).toFixed(0)}% margin`
                  : '—'}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />

          {/* KEY TRENDS */}
          <View style={styles.trendRow}>
            <View style={styles.trendItem}>
              <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Best Day</Text>
              <Text style={styles.trendValue}>{bestSalesDay ? formatCurrency(bestSalesDay.revenue) : 'K 0.00'}</Text>
              <Text style={[styles.trendCaption, { color: colors.textSecondary }]}>
                {bestSalesDay ? bestSalesDay.date : 'No data'}
              </Text>
            </View>
            <View style={styles.trendItem}>
              <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Avg Daily Revenue</Text>
              <Text style={styles.trendValue}>{formatCurrency(averageDailyRevenue)}</Text>
              <Text style={[styles.trendCaption, { color: colors.textSecondary }]}>per day</Text>
            </View>
            <View style={styles.trendItem}>
              <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>Avg Daily Profit</Text>
              <Text style={[styles.trendValue, { color: averageDailyProfit >= 0 ? '#059669' : '#dc2626' }]}>
                {formatCurrency(averageDailyProfit)}
              </Text>
              <Text style={[styles.trendCaption, { color: colors.textSecondary }]}>per day</Text>
            </View>
          </View>
        </View>






        {/* SECTION 2: CATEGORY PERFORMANCE */}
        {categoryMetrics.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Category Performance</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
              <View style={styles.catPerfList}>
                {categoryMetrics.slice(0, 5).map((cat, idx) => {
                  const barWidth = categoryMetrics[0].revenue > 0
                    ? `${Math.max(4, (cat.revenue / categoryMetrics[0].revenue) * 100)}%`
                    : '0%';
                  const marginColor = cat.marginPct >= 20 ? '#059669' : cat.marginPct >= 0 ? '#d97706' : '#dc2626';
                  return (
                    <View key={cat.category} style={[styles.catPerfRow, idx < categoryMetrics.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }]}>
                      <View style={styles.catPerfHeader}>
                        <View style={styles.catPerfRankWrap}>
                          <View style={[styles.catPerfRank, { backgroundColor: idx === 0 ? '#1e3a8a' : 'rgba(30, 58, 138, 0.08)' }]}>
                            <Text style={[styles.catPerfRankText, { color: idx === 0 ? '#ffffff' : '#1e3a8a' }]}>#{idx + 1}</Text>
                          </View>
                          <Text style={[styles.catPerfName, { color: colors.textColor }]} numberOfLines={1}>{cat.category}</Text>
                        </View>
                        <Text style={[styles.catPerfRevenue, { color: '#0f172a' }]}>{formatCurrency(cat.revenue)}</Text>
                      </View>

                      {/* Horizontal bar */}
                      <View style={styles.catPerfBarTrack}>
                        <View style={[styles.catPerfBarFill, {
                          width: barWidth as any,
                          backgroundColor: idx === 0 ? '#1e3a8a' : idx === 1 ? '#3b82f6' : '#93c5fd',
                        }]} />
                      </View>

                      {/* Stats row */}
                      <View style={styles.catPerfStats}>
                        <Text style={[styles.catPerfShare, { color: colors.textSecondary }]}>
                          {cat.revenueShare.toFixed(0)}% of revenue
                        </Text>
                        <View style={styles.catPerfStatsRight}>
                          <Text style={[styles.catPerfNet, { color: cat.net >= 0 ? '#059669' : '#dc2626' }]}>
                            {cat.net >= 0 ? '+' : ''}{formatCurrency(cat.net)}
                          </Text>
                          <Text style={[styles.catPerfMargin, { color: marginColor }]}>
                            {cat.marginPct.toFixed(0)}% margin
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
        {/* SECTION 3: PRODUCT PROFITABILITY */}
        {productProfits.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Product Profitability</Text>
            </View>

            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
              {productProfitsLoading ? (
                <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 20 }}>Loading...</Text>
              ) : (
                <View style={styles.productProfitList}>
                  {productProfits.slice(0, 5).map((prod, idx) => (
                    <View key={`${prod.product_id}-${idx}`} style={[styles.productProfitRow, { borderBottomColor: colors.borderColor }]}>
                      <View style={styles.productProfitLeft}>
                        <View style={[styles.productProfitRank, { backgroundColor: idx === 0 ? '#1e3a8a' : 'rgba(16, 185, 129, 0.1)' }]}>
                          <Text style={[styles.productProfitRankText, { color: idx === 0 ? '#ffffff' : '#1e3a8a' }]}>#{idx + 1}</Text>
                        </View>
                        <View style={styles.productProfitInfo}>
                          <Text style={[styles.productProfitName, { color: colors.textColor }]}>{prod.product_name}</Text>
                          <Text style={[styles.productProfitMeta, { color: colors.textSecondary }]}>
                            {prod.units_sold} sold · K{prod.revenue.toLocaleString()} rev
                          </Text>
                        </View>
                      </View>
                      <View style={styles.productProfitRight}>
                        <Text style={[styles.productProfitAmount, { color: prod.gross_profit >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                          K{prod.gross_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                        <Text style={[styles.productProfitMargin, { color: prod.profit_margin >= 20 ? '#10b981' : prod.profit_margin >= 0 ? '#f59e0b' : '#ef4444' }]}>
                          {prod.profit_margin.toFixed(0)}% margin
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
        {/* SECTION 4: CREDIT & DEBT ANALYSIS */}
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

        {/* SECTION 5: BUSINESS HEALTH */}
        <View style={[styles.sectionHeader, { borderBottomColor: colors.borderColor }]}>
          <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Business Health</Text>
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

          {suggestions.length > 0 && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />
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
            </>
          )}
        </View>

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
    </View>
  );
}


const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  headerDecoration1: { position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(30, 58, 138, 0.03)' },
  headerDecoration2: { position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(30, 58, 138, 0.03)' },
  headerContent: { zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 16 },
  headerIcon: { width: 48, height: 48, backgroundColor: 'rgba(30, 58, 138, 0.08)', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, fontWeight: '500' },
  headerRight: { justifyContent: 'center', alignItems: 'center' },
  periodSelector: { marginBottom: 24 },
  periodSelectorContent: { gap: 8 },
  periodButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  periodButtonActive: { backgroundColor: '#1e3a8a' },
  periodButtonText: { fontSize: 13, fontWeight: '600' },
  sectionHeader: { borderBottomWidth: 2, paddingBottom: 12, marginTop: 24, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  card: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiBox: { width: '48%', padding: 16, backgroundColor: 'rgba(16, 185, 129, 0.04)', borderRadius: 12 },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiValue: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  kpiChange: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiChangeText: { fontSize: 12, fontWeight: '600' },
  subMetricRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  subMetricItem: { flex: 1, padding: 12, backgroundColor: 'rgba(30, 58, 138, 0.04)', borderRadius: 10 },
  subMetricLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
  subMetricValue: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  subMetricCaption: { fontSize: 11, fontWeight: '500' },
  subMetricDivider: { width: 1, height: 48 },
  trendRow: { flexDirection: 'row', gap: 10 },
  trendItem: { flex: 1, padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.04)', borderRadius: 10 },
  trendLabel: { fontSize: 10, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3, color: '#64748b' },
  catPerfList: { gap: 0 },
  catPerfRow: { paddingVertical: 14 },
  catPerfHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  catPerfRankWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  catPerfRank: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  catPerfRankText: { fontSize: 11, fontWeight: '700' },
  catPerfName: { fontSize: 14, fontWeight: '600', flex: 1 },
  catPerfRevenue: { fontSize: 16, fontWeight: '800' },
  catPerfBarTrack: { height: 6, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  catPerfBarFill: { height: '100%', borderRadius: 3 },
  catPerfStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catPerfShare: { fontSize: 11, fontWeight: '500' },
  catPerfStatsRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catPerfNet: { fontSize: 12, fontWeight: '700' },
  catPerfMargin: { fontSize: 11, fontWeight: '600' },
  debtSummary: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  debtSummaryItem: { alignItems: 'center' },
  debtLabel: { fontSize: 11, fontWeight: '500', marginBottom: 8 },
  footer: { marginTop: 8, marginBottom: 40, alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12, fontWeight: '500', opacity: 0.8 },
  dateRangeIndicator: { alignItems: 'center', marginBottom: 20 },
  dateRangeText: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
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
  divider: { height: 1, marginVertical: 16 },
  trendValue: { fontSize: 18, fontWeight: '800', marginBottom: 4, color: '#1e3a8a' },
  trendCaption: { fontSize: 10, fontWeight: '500' },
  productProfitList: { gap: 0 },
  productProfitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  productProfitLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  productProfitRank: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  productProfitRankText: { fontSize: 12, fontWeight: '700' },
  productProfitInfo: { flex: 1 },
  productProfitName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  productProfitMeta: { fontSize: 11, fontWeight: '500' },
  productProfitRight: { alignItems: 'flex-end' },
  productProfitAmount: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  productProfitMargin: { fontSize: 11, fontWeight: '700' },
  privacyToggle: { padding: 8, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12 },
  chartCard: { paddingBottom: 15 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  chartTitle: { fontSize: 16, fontWeight: '700' },
  chartSubtitle: { fontSize: 12, marginTop: 2 },
  chartMetric: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  chartMetricText: { fontSize: 13, fontWeight: '700', color: '#1e3a8a' },
  visualChartContainer: { height: 160, justifyContent: 'center' },
  noDataChart: { alignItems: 'center', justifyContent: 'center', height: '100%' },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: '85%', gap: 3 },
  barGroup: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  barPair: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%', height: '85%', gap: 2 },
  barFill: { borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 3 },
  barRevenue: { flex: 1, backgroundColor: '#1e3a8a' },
  barExpense: { flex: 1, backgroundColor: '#ef4444' },
  barLabel: { fontSize: 8, fontWeight: '500', marginTop: 4, textAlign: 'center' },
  chartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '500' },
});
