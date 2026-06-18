import { QuickActions } from '@/components/dashboard/QuickActions';
import { SummaryCard } from '@/components/dashboard/SummaryCard';

import { GroupedTransactionsList } from '@/components/transactions/GroupedTransactionsList';
import { useTheme } from '@/contexts/ThemeContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useSummary } from '@/hooks/useSummary';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useGroupNavigation } from '@/hooks/useGroupNavigation';
import { signOut } from '@/lib/auth';
import { getTopProductsByProfit, ProductProfit } from '@/lib/profitCalculations';
import { router } from "expo-router";
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { Activity, LogOut, Store, TrendingUp as TrendUp } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, AppState } from "react-native";
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TransactionGroup } from '@/types/grouping';

import { useCustomAlert } from '@/components/ui/CustomAlertContext';

export default function HomeScreen() {
  const { showAlert } = useCustomAlert();
  const Alert = { alert: showAlert };
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = useThemeColors();
  const { transactions, refresh, groupedTransactions, groupingEnabled, toggleGrouping } = useTransactionsContext();

  const { actions: { navigateToGroup } } = useGroupNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const { daily } = useSummary(transactions);
  const lastDateRef = useRef<string>(new Date().toDateString());
  const [topProduct, setTopProduct] = useState<ProductProfit | null>(null);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // Refresh data at midnight to update daily tracking
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow.getTime() - now.getTime();
    
    const midnightTimer = setTimeout(() => {
      refresh(); // This will update the daily tracking count
    }, timeUntilMidnight);
    
    return () => clearTimeout(midnightTimer);
  }, [refresh]);

  // Force refresh when component mounts to ensure current day calculation
  useEffect(() => {
    // Small delay to ensure transactions are loaded first
    const mountTimer = setTimeout(() => {
      refresh();
    }, 100);
    
    return () => clearTimeout(mountTimer);
  }, []);

  // Load top profitable product
  useEffect(() => {
    let mounted = true;
    getTopProductsByProfit(1).then(prods => {
      if (mounted && prods.length > 0) setTopProduct(prods[0]);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [transactions]);

  // Listen for app state changes to detect day changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        const currentDate = new Date().toDateString();
        if (currentDate !== lastDateRef.current) {
          lastDateRef.current = currentDate;
          // Day has changed, refresh to update daily tracking
          refresh();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [refresh]);

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              router.replace("/Authentication/login");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to logout");
            }
          },
        },
      ]
    );
  };

  const greeting = useMemo<string>(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const formatDate = useCallback((date: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
  }, []);

  const periodTabs = [
    { id: 'today' as const, label: 'Today' },
    { id: 'week' as const, label: 'This Week' },
    { id: 'month' as const, label: 'This Month' },
  ];

  // Handle group press - navigate to group detail
  const handleGroupPress = useCallback((group: TransactionGroup) => {
    navigateToGroup(group);
  }, [navigateToGroup]);

  const dailyTracking = useMemo(() => {
    // Calculate consecutive days with transactions starting from today
    let consecutiveDays = 0;
    const today = new Date();
    
    // Get today's date in local timezone normalized
    const normalizeDate = (date: Date) => {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    };

    const startIdx = 0;
    
    // Check up to 30 days back for consecutive daily tracking
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const checkTime = normalizeDate(checkDate);
      
      // Check if there's a transaction on this date using created_at
      const hasTransaction = transactions.some(t => {
        const txDate = new Date(t.created_at);
        return normalizeDate(txDate) === checkTime;
      });
      
      if (hasTransaction) {
        consecutiveDays++;
      } else {
        // Break if no transaction found for this day
        break;
      }
    }
    
    return consecutiveDays;
  }, [transactions]);

  // Dynamic colors based on theme - navy blue
  const backgroundColor = theme === 'dark' ? '#0f172a' : '#f5f5f5';
  const cardBackground = theme === 'dark' ? '#1e293b' : '#ffffff';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView
        style={[styles.container, { backgroundColor }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Hero Header */}
        <View style={[styles.heroHeader, { backgroundColor: cardBackground, paddingTop: Math.max(10, insets.top + 4) }]}>
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />

          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={styles.heroLeft}>
                <View style={styles.iconContainer}>
                  <Image
                    source={require('../../assets/images/icon.png')}
                    style={{ width: 32, height: 32 }}
                    contentFit="contain"
                  />
                </View>

                <View>
                  <Text style={[styles.heroTitle, { color: textColor }]}>TraderTally</Text>
                  <Text style={[styles.heroDate, { color: textSecondary }]}>{formatDate(new Date())}</Text>
                </View>
              </View>
              <View style={styles.heroRight}>
                <OfflineIndicator alwaysShow compact />
                <TouchableOpacity
                  style={[styles.logoutButton, { backgroundColor: 'rgba(30, 58, 138, 0.08)' }]}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <LogOut size={18} color="#1e3a8a" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroGreeting}>
              <Text style={[styles.greetingText, { color: textColor }]}>{greeting} 👋</Text>
              <Text style={[styles.greetingSubtext, { color: textSecondary }]}>
                {dailyTracking === 0 ? 'Cash flow ready for tracking today.' :
                 dailyTracking === 1 ? 'Solid start to your financial tracking.' :
                 dailyTracking >= 7 ? 'Consistent tracking builds stable businesses.' :
                 'Your financial tracking is healthy.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          {/* Daily Tracking Card */}
          <View style={[styles.consistencyCard, { backgroundColor: cardBackground }]}>
            <View style={styles.consistencyLeft}>
              <View style={styles.consistencyIconContainer}>
                <Activity size={20} color="#1e3a8a" />
              </View>
              <View>
                <Text style={[styles.consistencyTitle, { color: textColor }]}>Daily Tracking</Text>
                <Text style={[styles.consistencyValue, { color: textSecondary }]}>
                  {dailyTracking === 0 ? 'No activity recorded yet' : 
                   dailyTracking === 1 ? '1 day of active tracking' :
                   dailyTracking === 2 ? '2 days of consistent records' :
                   dailyTracking === 3 ? '3 days of stable tracking' :
                   `${dailyTracking} days of financial consistency`}
                </Text>
              </View>
            </View>
            <View style={[styles.consistencyBadge, { backgroundColor: dailyTracking >= 7 ? 'rgba(16, 185, 129, 0.1)' : dailyTracking >= 3 ? 'rgba(245, 158, 11, 0.1)' : dailyTracking >= 1 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
              <Text style={[styles.consistencyBadgeText, { color: dailyTracking >= 7 ? '#10b981' : dailyTracking >= 3 ? '#f59e0b' : dailyTracking >= 1 ? '#3b82f6' : '#ef4444' }]}>
                {dailyTracking >= 7 ? 'Excellent!' : dailyTracking >= 3 ? 'Keep going!' : dailyTracking >= 1 ? 'Good start' : 'Start today'}
              </Text>
            </View>
          </View>

          {/* Period Profit Cards */}
          <View style={styles.tabsContainer}>
            {periodTabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, { backgroundColor: cardBackground }]}
                onPress={() => router.push({
                  pathname: '/modals/period-detail',
                  params: { period: tab.id },
                })}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, { color: textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary Card */}
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/modals/period-detail',
              params: { period: 'today' },
            })}
            activeOpacity={0.9}
          >
            <SummaryCard title="Today's Profit" summary={daily} />
          </TouchableOpacity>

          {/* Most Profitable Product */}
          {topProduct && topProduct.gross_profit > 0 && (
            <TouchableOpacity
              style={[styles.consistencyCard, { backgroundColor: cardBackground }]}
              onPress={() => router.push('/(tabs)/reports')}
              activeOpacity={0.7}
            >
              <View style={styles.consistencyLeft}>
                <View style={[styles.consistencyIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <TrendUp size={20} color="#10b981" />
                </View>
                <View>
                  <Text style={[styles.consistencyTitle, { color: textColor }]}>Top Product: {topProduct.product_name}</Text>
                  <Text style={[styles.consistencyValue, { color: textSecondary }]}>
                    K{topProduct.gross_profit.toFixed(2)} profit · {topProduct.profit_margin.toFixed(0)}% margin
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Quick Actions */}
          <QuickActions />

          {/* Grouped Transactions */}
          <View style={[styles.transactionsContainer, { backgroundColor: cardBackground }]}>
            <View style={styles.transactionsHeader}>
              <Text style={[styles.transactionsTitle, { color: textColor }]}>
                {groupingEnabled ? 'Recent Groups' : 'Recent Transactions'}
              </Text>
              <View style={styles.transactionsActions}>
                <TouchableOpacity
                  style={styles.groupingToggle}
                  onPress={toggleGrouping}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.groupingToggleText, { color: colors.primaryColor }]}>
                    {groupingEnabled ? 'Individual' : 'Grouped'}
                  </Text>
                </TouchableOpacity>
                {groupedTransactions.length > 5 && (
                  <TouchableOpacity
                    onPress={() => router.push('./records')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.viewAllText, { color: colors.primaryColor }]}>View All</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <GroupedTransactionsList
              groups={groupedTransactions.slice(0, 5)}
              onGroupPress={handleGroupPress}
              loading={false}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              emptyMessage="No transactions yet. Start by recording your first sale!"
              showDates={false}
              compact={true}
              maxItems={5}
              scrollable={false}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingBottom: 32,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  loadingText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 50,
  },
  heroHeader: {
    paddingTop: 30,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: "relative",
    overflow: "hidden",
  },
  decorativeCircle1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(30, 58, 138, 0.03)",
  },
  decorativeCircle2: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(30, 58, 138, 0.03)",
  },
  heroContent: {
    position: "relative",
    zIndex: 10,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  heroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  heroRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(30, 58, 138, 0.08)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
  },
  heroDate: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroGreeting: {
    marginTop: 4,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  greetingSubtext: {
    fontSize: 14,
    fontWeight: "500",
  },
  mainContent: {
    padding: 16,
    marginTop: -16,
    gap: 16,
  },
  tabsContainer: {
    flexDirection: "row",
    gap: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.03)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    gap: 16,
  },
  shareIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#1e3a8a',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareTextContainer: {
    flex: 1,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  shareSubtitle: {
    fontSize: 12,
  },
  consistencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  consistencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  consistencyIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consistencyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  consistencyValue: {
    fontSize: 12,
  },
  consistencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  consistencyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  transactionsContainer: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 1,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  transactionsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  transactionsActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupingToggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    borderRadius: 6,
  },
  groupingToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
