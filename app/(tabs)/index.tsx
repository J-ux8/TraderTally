import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { useTheme } from '@/contexts/ThemeContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useSummary } from '@/hooks/useSummary';
import { useSync } from '@/hooks/useSync';
import { useThemeColors } from '@/hooks/useThemeColors';
import { signOut } from '@/lib/auth';
import { getCachedSession } from '@/lib/session-cache';
import { supabase } from "@/lib/supabase";
import { router, useFocusEffect } from "expo-router";
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { Activity, LogOut, Store } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = useThemeColors();
  const { transactions, pendingCount, refresh, refreshing } = useTransactionsContext();
  const { status: syncStatus } = useSync(pendingCount);
  const { daily, weekly, monthly } = useSummary(transactions);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          return;
        }
      } catch (error) {
        console.log('[home] Supabase auth failed, checking cache');
      }

      // Fallback to cached session
      try {
        const cached = await getCachedSession();
        if (cached) {
          setUser({ id: cached.userId, email: cached.email });
          console.log('[home] Using cached session');
        }
      } catch (error) {
        console.error('[home] Failed to get cached session:', error);
      }
    };

    initUser();
  }, []);


  // Only refresh if data is stale (not on every focus)
  useFocusEffect(
    useCallback(() => {
      // Don't refresh on every focus - context already manages data freshness
      // User can pull-to-refresh if needed
    }, [])
  );


  const handleRefresh = useCallback(async () => {
    await refresh();
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


  const tabs = useMemo(() => [
    { id: 'daily' as const, label: 'Today', summary: daily, title: "Today's Profit" },
    { id: 'weekly' as const, label: 'Week', summary: weekly, title: "This Week's Profit" },
    { id: 'monthly' as const, label: 'Month', summary: monthly, title: "This Month's Profit" },
  ], [daily, weekly, monthly]);

  const activeTabInfo = useMemo(() =>
    tabs.find((t) => t.id === activeTab) || tabs[0],
    [tabs, activeTab]
  );

  const activeSummary = useMemo(() => activeTabInfo.summary, [activeTabInfo]);

  const consistency = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    });
    const daysWithData = last7Days.filter(date =>
      transactions.some(t => t.transaction_date.split('T')[0] === date)
    ).length;
    return daysWithData;
  }, [transactions]);

  // Dynamic colors based on theme - navy blue
  const backgroundColor = theme === 'dark' ? '#0f172a' : '#f5f5f5';
  const cardBackground = theme === 'dark' ? '#1e293b' : '#ffffff';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';


  // Show UI immediately with session data
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={[styles.loadingText, { color: textSecondary }]}>Loading MobiBooks...</Text>
        </View>
      </View>
    );
  }

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
        <View style={[styles.heroHeader, { backgroundColor: colors.headerBackground, paddingTop: Math.max(20, insets.top + 10) }]}>
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />

          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={styles.heroLeft}>
                <View style={styles.iconContainer}>
                  <Store size={24} color="#ffffff" />
                </View>
                <View>
                  <Text style={styles.heroTitle}>MobiBooks</Text>
                  <Text style={styles.heroDate}>{formatDate(new Date())}</Text>
                </View>
              </View>
              <View style={styles.heroRight}>
                <OfflineIndicator alwaysShow compact />
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <LogOut size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroGreeting}>
              <Text style={styles.greetingText}>{greeting} 👋</Text>
              <Text style={styles.greetingSubtext}>
                Ready to record your sales today?
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.mainContent}>
          {/* Consistency Tracker */}
          <View style={[styles.consistencyCard, { backgroundColor: cardBackground }]}>
            <View style={styles.consistencyLeft}>
              <View style={styles.consistencyIconContainer}>
                <Activity size={20} color="#1e3a8a" />
              </View>
              <View>
                <Text style={[styles.consistencyTitle, { color: textColor }]}>Consistency Score</Text>
                <Text style={[styles.consistencyValue, { color: textSecondary }]}>
                  {consistency}/7 days recorded
                </Text>
              </View>
            </View>
            <View style={[styles.consistencyBadge, { backgroundColor: consistency >= 5 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
              <Text style={[styles.consistencyBadgeText, { color: consistency >= 5 ? '#1e3a8a' : '#f59e0b' }]}>
                {consistency >= 5 ? 'Strong' : 'Keep it up'}
              </Text>
            </View>
          </View>

          {/* Period Tabs */}
          <View style={[styles.tabsContainer, { backgroundColor: colors.cardBackground }]}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id && { backgroundColor: '#1e3a8a' },
                ]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive,
                    { color: activeTab === tab.id ? '#ffffff' : textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary Card */}
          <SummaryCard
            title={activeTabInfo.title}
            summary={activeSummary}
          />

          {/* Removed share card from here, moved to Reports */}

          {/* Quick Actions */}
          <QuickActions />

          {/* Recent Transactions */}
          <RecentTransactions transactions={transactions} />
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
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  decorativeCircle2: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  heroContent: {
    position: "relative",
    zIndex: 10,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
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
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#ffffff",
  },
  heroDate: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "600",
    marginTop: 2,
  },
  logoutButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  pendingBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  heroGreeting: {
    marginTop: 8,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 4,
  },
  greetingSubtext: {
    fontSize: 16,
    color: "#ffffff",
  },
  mainContent: {
    padding: 16,
    marginTop: -16,
    gap: 16,
  },
  tabsContainer: {
    flexDirection: "row",
    padding: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#1e3a8a",
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#ffffff",
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
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
});
