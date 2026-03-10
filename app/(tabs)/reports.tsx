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
  Download,
  MessageCircle
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

interface CategoryBreakdown {
  category: string;
  revenue: number;
  expenses: number;
  count: number;
  percentage: number;
}

interface BusinessMetrics {
  revenue: number;
  expenses: number;
  net: number;
  profitMargin: number;
  revenueGrowth: number;
  expenseGrowth: number;
  profitGrowth: number;
  transactionCount: number;
  transactionGrowth: number;
}

interface CreditHealth {
  totalPending: number;
  overdueCount: number;
  oldestDebtDays: number;
}

interface Insight {
  id: string;
  type: 'positive' | 'warning' | 'neutral';
  message: string;
  icon: string;
}

export default function ReportsScreen() {
  const colors = useThemeColors();
  const { transactions, loading, refresh } = useTransactionsContext();
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
      default:
        return null;
    }

    start.setHours(0, 0, 0, 0);
    now.setHours(23, 59, 59, 999);
    return { start, end: now };
  }, []);

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

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
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

  const previousTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return [];
    const range = getPreviousPeriod(selectedPeriod);
    if (!range) return [];

    return transactions.filter(t => {
      const txDate = new Date(t.transaction_date);
      return txDate >= range.start && txDate <= range.end;
    });
  }, [transactions, selectedPeriod, getPreviousPeriod]);

  const calculateMetrics = useCallback((txns: Transaction[]): Omit<BusinessMetrics, 'revenueGrowth' | 'expenseGrowth' | 'profitGrowth' | 'transactionGrowth'> => {
    const revenue = txns.filter(t => t.amount > 0).reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const net = revenue - expenses;
    const profitMargin = revenue > 0 ? (net / revenue) * 100 : 0;

    return {
      revenue,
      expenses,
      net,
      profitMargin,
      transactionCount: txns.length,
    };
  }, []);

  const metrics = useMemo(() => {
    const current = calculateMetrics(filteredTransactions);
    const previous = calculateMetrics(previousTransactions);

    const revenueGrowth = previous.revenue > 0
      ? ((current.revenue - previous.revenue) / previous.revenue) * 100
      : current.revenue > 0 ? 100 : 0;

    const expenseGrowth = previous.expenses > 0
      ? ((current.expenses - previous.expenses) / previous.expenses) * 100
      : current.expenses > 0 ? 100 : 0;

    const profitGrowth = previous.net > 0
      ? ((current.net - previous.net) / previous.net) * 100
      : current.net > 0 ? 100 : 0;

    const transactionGrowth = previous.transactionCount > 0
      ? ((current.transactionCount - previous.transactionCount) / previous.transactionCount) * 100
      : current.transactionCount > 0 ? 100 : 0;

    return {
      ...current,
      revenueGrowth,
      expenseGrowth,
      profitGrowth,
      transactionGrowth,
    };
  }, [filteredTransactions, previousTransactions, calculateMetrics]);

  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, CategoryBreakdown>();
    const totalAmount = metrics.revenue + metrics.expenses;

    filteredTransactions.forEach(t => {
      const category = t.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { category, revenue: 0, expenses: 0, count: 0, percentage: 0 });
      }

      const cat = categoryMap.get(category)!;
      cat.count++;
      if (t.amount > 0) {
        cat.revenue += Number(t.amount);
      } else {
        cat.expenses += Math.abs(Number(t.amount));
      }
    });

    return Array.from(categoryMap.values())
      .map(cat => ({
        ...cat,
        percentage: totalAmount > 0 ? (((cat.revenue + cat.expenses) / totalAmount) * 100) : 0,
      }))
      .sort((a, b) => (b.revenue + b.expenses) - (a.revenue + a.expenses));
  }, [filteredTransactions, metrics]);

  const creditHealth = useMemo(() => {
    const activeDebts = debts.filter(d => !d.is_settled);
    const totalPending = activeDebts.reduce((sum, d) => sum + Number(d.amount), 0);
    
    const now = new Date();
    let overdueCount = 0;
    let oldestDebtDays = 0;

    activeDebts.forEach(d => {
      if (d.due_date) {
        const dueDate = new Date(d.due_date);
        if (dueDate < now) {
          overdueCount++;
          const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          oldestDebtDays = Math.max(oldestDebtDays, daysDiff);
        }
      }
    });

    return { totalPending, overdueCount, oldestDebtDays };
  }, [debts]);

  const insights = useMemo(() => {
    const insightsList: Insight[] = [];

    if (metrics.revenueGrowth > 10) {
      insightsList.push({
        id: 'revenue-growth',
        type: 'positive',
        message: `Revenue increased ${metrics.revenueGrowth.toFixed(0)}% this period! 🎉`,
        icon: '📈',
      });
    } else if (metrics.revenueGrowth < -10) {
      insightsList.push({
        id: 'revenue-decline',
        type: 'warning',
        message: `Revenue decreased ${Math.abs(metrics.revenueGrowth).toFixed(0)}% compared to last period.`,
        icon: '📉',
      });
    }

    if (metrics.profitMargin > 30) {
      insightsList.push({
        id: 'healthy-margin',
        type: 'positive',
        message: `Profit margin is ${metrics.profitMargin.toFixed(0)}% - excellent efficiency!`,
        icon: '✨',
      });
    } else if (metrics.profitMargin < 10 && metrics.revenue > 0) {
      insightsList.push({
        id: 'low-margin',
        type: 'warning',
        message: `Profit margin is only ${metrics.profitMargin.toFixed(0)}%. Consider reducing expenses.`,
        icon: '⚠️',
      });
    }

    if (categoryBreakdown.length > 0) {
      const topCategory = categoryBreakdown[0];
      insightsList.push({
        id: 'top-category',
        type: 'neutral',
        message: `${topCategory.category} is your top category (${topCategory.percentage.toFixed(0)}% of activity)`,
        icon: '🏆',
      });
    }

    if (creditHealth.overdueCount > 0) {
      insightsList.push({
        id: 'overdue-debts',
        type: 'warning',
        message: `${creditHealth.overdueCount} customer(s) have overdue payments. Follow up needed!`,
        icon: '⏰',
      });
    }

    if (metrics.transactionGrowth > 20) {
      insightsList.push({
        id: 'transaction-growth',
        type: 'positive',
        message: `Transaction volume up ${metrics.transactionGrowth.toFixed(0)}% - more activity!`,
        icon: '📊',
      });
    }

    return insightsList;
  }, [metrics, categoryBreakdown, creditHealth]);

  const formatCurrency = useCallback((amount: number) => {
    return `K ${Math.abs(amount).toFixed(2)}`;
  }, []);

  const formatPercent = useCallback((value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
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
    let message = `📊 *MobiBooks Financial Report* (${periodLabel})\n\n`;
    message += `💰 *Revenue:* ${formatCurrency(metrics.revenue)}\n`;
    message += `💸 *Expenses:* ${formatCurrency(metrics.expenses)}\n`;
    message += `📈 *Net Profit:* ${formatCurrency(metrics.net)}\n`;
    message += `📊 *Profit Margin:* ${metrics.profitMargin.toFixed(1)}%\n\n`;

    if (categoryBreakdown.length > 0) {
      message += `🏆 *Top Categories:*\n`;
      categoryBreakdown.slice(0, 3).forEach(c => {
        message += `• ${c.category}: ${formatCurrency(c.revenue + c.expenses)}\n`;
      });
      message += `\n`;
    }

    if (creditHealth.totalPending > 0) {
      message += `⚠️ *Pending Credits:* ${formatCurrency(creditHealth.totalPending)}\n`;
      if (creditHealth.overdueCount > 0) {
        message += `⏰ *Overdue:* ${creditHealth.overdueCount} customer(s)\n\n`;
      }
    }

    message += `_Growing your business with MobiBooks!_ 🇿🇲`;

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
      {/* Header */}
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
              <Text style={styles.headerSubtitle}>Your business at a glance</Text>
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
        {/* Period Selector */}
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
              <Text
                style={[
                  styles.periodButtonText,
                  { color: selectedPeriod === period ? '#ffffff' : colors.textColor },
                ]}
              >
                {period === 'all' ? 'All' : period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Business Snapshot */}
        <View style={[styles.snapshotCard, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>Business Snapshot</Text>
          <View style={styles.snapshotGrid}>
            <View style={styles.snapshotItem}>
              <Text style={[styles.snapshotLabel, { color: colors.textSecondary }]}>Cash Balance</Text>
              <Text style={[styles.snapshotValue, { color: metrics.net >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(metrics.net)}
              </Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Text style={[styles.snapshotLabel, { color: colors.textSecondary }]}>Customers Owe</Text>
              <Text style={[styles.snapshotValue, { color: '#f59e0b' }]}>
                {formatCurrency(creditHealth.totalPending)}
              </Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Text style={[styles.snapshotLabel, { color: colors.textSecondary }]}>Transactions</Text>
              <Text style={[styles.snapshotValue, { color: '#1e3a8a' }]}>
                {metrics.transactionCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Profit Overview */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <Text style={[styles.cardTitle, { color: colors.textColor }]}>Profit Overview</Text>
          <View style={styles.profitGrid}>
            <View style={styles.profitItem}>
              <View style={[styles.profitIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <ArrowUpRight size={20} color="#1e3a8a" />
              </View>
              <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>Revenue</Text>
              <Text style={[styles.profitValue, { color: '#1e3a8a' }]}>{formatCurrency(metrics.revenue)}</Text>
              {metrics.revenueGrowth !== 0 && (
                <Text style={[styles.profitGrowth, { color: metrics.revenueGrowth > 0 ? '#1e3a8a' : '#ef4444' }]}>
                  {formatPercent(metrics.revenueGrowth)}
                </Text>
              )}
            </View>

            <View style={styles.profitItem}>
              <View style={[styles.profitIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <ArrowDownRight size={20} color="#ef4444" />
              </View>
              <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>Expenses</Text>
              <Text style={[styles.profitValue, { color: '#ef4444' }]}>{formatCurrency(metrics.expenses)}</Text>
              {metrics.expenseGrowth !== 0 && (
                <Text style={[styles.profitGrowth, { color: metrics.expenseGrowth < 0 ? '#1e3a8a' : '#ef4444' }]}>
                  {formatPercent(metrics.expenseGrowth)}
                </Text>
              )}
            </View>

            <View style={styles.profitItem}>
              <View style={[styles.profitIcon, { backgroundColor: metrics.net >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                <DollarSign size={20} color={metrics.net >= 0 ? '#1e3a8a' : '#ef4444'} />
              </View>
              <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>Net Profit</Text>
              <Text style={[styles.profitValue, { color: metrics.net >= 0 ? '#1e3a8a' : '#ef4444' }]}>
                {formatCurrency(metrics.net)}
              </Text>
              {metrics.profitGrowth !== 0 && (
                <Text style={[styles.profitGrowth, { color: metrics.profitGrowth > 0 ? '#1e3a8a' : '#ef4444' }]}>
                  {formatPercent(metrics.profitGrowth)}
                </Text>
              )}
            </View>

            <View style={styles.profitItem}>
              <View style={[styles.profitIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Percent size={20} color="#1e3a8a" />
              </View>
              <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>Profit Margin</Text>
              <Text style={[styles.profitValue, { color: metrics.profitMargin >= 20 ? '#1e3a8a' : '#f59e0b' }]}>
                {metrics.profitMargin.toFixed(1)}%
              </Text>
              <Text style={[styles.profitMeta, { color: colors.textSecondary }]}>
                {metrics.profitMargin >= 30 ? 'Excellent' : metrics.profitMargin >= 20 ? 'Good' : 'Needs work'}
              </Text>
            </View>
          </View>
        </View>

        {/* Credit Health */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
          <View style={styles.cardHeader}>
            <Briefcase size={20} color="#1e3a8a" />
            <Text style={[styles.cardTitle, { color: colors.textColor }]}>Credit Health</Text>
          </View>
          <View style={styles.creditHealthGrid}>
            <View style={[styles.creditHealthItem, { backgroundColor: colors.inputBackground }]}>
              <Text style={[styles.creditHealthLabel, { color: colors.textSecondary }]}>Total Pending</Text>
              <Text style={[styles.creditHealthValue, { color: '#f59e0b' }]}>
                {formatCurrency(creditHealth.totalPending)}
              </Text>
            </View>
            <View style={[styles.creditHealthItem, { backgroundColor: colors.inputBackground }]}>
              <Text style={[styles.creditHealthLabel, { color: colors.textSecondary }]}>Overdue</Text>
              <Text style={[styles.creditHealthValue, { color: creditHealth.overdueCount > 0 ? '#ef4444' : '#1e3a8a' }]}>
                {creditHealth.overdueCount}
              </Text>
            </View>
            <View style={[styles.creditHealthItem, { backgroundColor: colors.inputBackground }]}>
              <Text style={[styles.creditHealthLabel, { color: colors.textSecondary }]}>Oldest Debt</Text>
              <Text style={[styles.creditHealthValue, { color: '#1e3a8a' }]}>
                {creditHealth.oldestDebtDays} days
              </Text>
            </View>
          </View>
        </View>

        {/* Category Analysis */}
        {categoryBreakdown.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
            <View style={styles.cardHeader}>
              <PieChart size={20} color="#1e3a8a" />
              <Text style={[styles.cardTitle, { color: colors.textColor }]}>Category Analysis</Text>
            </View>
            <View style={styles.categoryList}>
              {categoryBreakdown.slice(0, 5).map((cat, idx) => (
                <View key={cat.category} style={[styles.categoryRow, { borderBottomColor: colors.borderColor }]}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.categoryRank, { backgroundColor: idx < 2 ? '#1e3a8a' : 'rgba(16, 185, 129, 0.1)' }]}>
                      <Text style={[styles.categoryRankText, { color: idx < 2 ? '#ffffff' : '#1e3a8a' }]}>
                        #{idx + 1}
                      </Text>
                    </View>
                    <View style={styles.categoryInfo}>
                      <Text style={[styles.categoryName, { color: colors.textColor }]}>{cat.category}</Text>
                      <Text style={[styles.categoryMeta, { color: colors.textSecondary }]}>
                        {cat.count} transaction{cat.count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={[styles.categoryAmount, { color: colors.textColor }]}>
                      {formatCurrency(cat.revenue + cat.expenses)}
                    </Text>
                    <Text style={[styles.categoryPercent, { color: colors.textSecondary }]}>
                      {cat.percentage.toFixed(0)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Smart Insights */}
        {insights.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
            <View style={styles.cardHeader}>
              <AlertCircle size={20} color="#1e3a8a" />
              <Text style={[styles.cardTitle, { color: colors.textColor }]}>Smart Insights</Text>
            </View>
            <View style={styles.insightsList}>
              {insights.map((insight) => (
                <View
                  key={insight.id}
                  style={[
                    styles.insightItem,
                    {
                      backgroundColor: insight.type === 'positive' ? 'rgba(16, 185, 129, 0.05)' : insight.type === 'warning' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                      borderLeftColor: insight.type === 'positive' ? '#1e3a8a' : insight.type === 'warning' ? '#ef4444' : '#f59e0b',
                    },
                  ]}
                >
                  <Text style={styles.insightIcon}>{insight.icon}</Text>
                  <Text style={[styles.insightText, { color: colors.textColor }]}>{insight.message}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Share Report Button */}
        <TouchableOpacity
          style={styles.shareButton}
          onPress={() => setShareModalVisible(true)}
          activeOpacity={0.8}
        >
          <ShareIcon size={20} color="#ffffff" />
          <Text style={styles.shareButtonText}>Share Report</Text>
        </TouchableOpacity>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.textColor }]}>No transactions yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Start recording transactions to see analytics
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Share Modal */}
      <Modal visible={shareModalVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShareModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.textColor }]}>Share Report</Text>
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShareReport('whatsapp')}
              activeOpacity={0.7}
            >
              <MessageCircle size={24} color="#25D366" />
              <View style={styles.shareOptionText}>
                <Text style={[styles.shareOptionTitle, { color: colors.textColor }]}>WhatsApp</Text>
                <Text style={[styles.shareOptionDesc, { color: colors.textSecondary }]}>Send to contacts</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shareOption}
              onPress={() => handleShareReport('text')}
              activeOpacity={0.7}
            >
              <ShareIcon size={24} color="#1e3a8a" />
              <View style={styles.shareOptionText}>
                <Text style={[styles.shareOptionTitle, { color: colors.textColor }]}>Share Text</Text>
                <Text style={[styles.shareOptionDesc, { color: colors.textSecondary }]}>Copy or share</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareOption, styles.shareOptionLast]}
              onPress={() => setShareModalVisible(false)}
              activeOpacity={0.7}
            >
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
  headerContent: { zIndex: 10 },
  headerIconContainer: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerIcon: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  headerSubtitle: { fontSize: 16, color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' },
  periodSelector: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  periodButtonActive: { backgroundColor: '#1e3a8a' },
  periodButtonText: { fontSize: 13, fontWeight: '600' },
  snapshotCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  snapshotGrid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  snapshotItem: { flex: 1, alignItems: 'center' },
  snapshotLabel: { fontSize: 12, fontWeight: '500', marginBottom: 8 },
  snapshotValue: { fontSize: 18, fontWeight: '800' },
  snapshotDivider: { width: 1, height: 50, backgroundColor: 'rgba(0, 0, 0, 0.1)' },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  profitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  profitItem: { flex: 1, minWidth: '45%', alignItems: 'center', padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderRadius: 12 },
  profitIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  profitLabel: { fontSize: 11, fontWeight: '500', marginBottom: 4 },
  profitValue: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  profitGrowth: { fontSize: 11, fontWeight: '600' },
  profitMeta: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  creditHealthGrid: { flexDirection: 'row', gap: 12 },
  creditHealthItem: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  creditHealthLabel: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  creditHealthValue: { fontSize: 18, fontWeight: '800' },
  categoryList: { gap: 0 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  categoryRank: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  categoryRankText: { fontSize: 12, fontWeight: '700' },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  categoryMeta: { fontSize: 11, fontWeight: '500' },
  categoryRight: { alignItems: 'flex-end' },
  categoryAmount: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  categoryPercent: { fontSize: 11, fontWeight: '500' },
  insightsList: { gap: 12 },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    gap: 12,
  },
  insightIcon: { fontSize: 20 },
  insightText: { fontSize: 13, fontWeight: '500', flex: 1 },
  shareButton: {
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
  shareButtonText: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 16,
  },
  shareOptionText: { flex: 1 },
  shareOptionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  shareOptionDesc: { fontSize: 12, fontWeight: '500' },
  shareOptionLast: { justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { fontSize: 14, textAlign: 'center' },
});
