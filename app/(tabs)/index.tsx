import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { useTheme } from '@/contexts/ThemeContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSummary } from '@/hooks/useSummary';
import { useSync } from '@/hooks/useSync';
import { useThemeColors } from '@/hooks/useThemeColors';
import { signOut } from '@/lib/auth';
import { supabase } from "@/lib/supabase";
import { router, useFocusEffect } from "expo-router";
import { Cloud, CloudOff, LogOut, RefreshCw, Store } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { theme } = useTheme();
  const colors = useThemeColors();
  const { transactions, categories, loading, refresh, refreshing } = useTransactionsContext();
  const { daily, weekly, monthly } = useSummary(transactions);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [user, setUser] = useState<any>(null);
  const isOnline = useOnlineStatus();
  const { isSyncing, pendingCount } = useSync();
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [isSyncing, spinAnim]);

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
        router.replace("/Authentication/login");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Only refresh if data is stale (not on every focus)
  useFocusEffect(
    useCallback(() => {
      // Don't refresh on every focus - context already has data
      // Only refresh if user just logged in
      if (user && transactions.length === 0 && !loading) {
        refresh();
      }
    }, [user, transactions.length, loading, refresh])
  );

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      } else {
        router.replace("/Authentication/login");
      }
    } catch (error) {
      console.error("Error checking session:", error);
    }
  }

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
    { id: 'daily' as const, label: 'Today', summary: daily },
    { id: 'weekly' as const, label: 'Week', summary: weekly },
    { id: 'monthly' as const, label: 'Month', summary: monthly },
  ], [daily, weekly, monthly]);

  const activeSummary = useMemo(() => 
    tabs.find((t) => t.id === activeTab)?.summary || daily,
    [tabs, activeTab, daily]
  );

  // Dynamic colors based on theme
  const backgroundColor = theme === 'dark' ? '#151718' : '#f5f5f5';
  const cardBackground = theme === 'dark' ? '#1f2937' : '#ffffff';
  const textColor = theme === 'dark' ? '#ECEDEE' : '#333';
  const textSecondary = theme === 'dark' ? '#9BA1A6' : '#666';

  // Show UI immediately with cached data, don't block on loading
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={[styles.loadingText, { color: textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top']}>
      <ScrollView
        style={[styles.container, { backgroundColor }]}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
      {/* Hero Header */}
      <View style={[styles.heroHeader, { backgroundColor: colors.headerBackground }]}>
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
              <View style={[styles.statusBadge, !isOnline && styles.statusBadgeOffline]}>
                {isSyncing ? (
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: spinAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <RefreshCw size={16} color="#ffffff" />
                  </Animated.View>
                ) : isOnline ? (
                  <Cloud size={16} color="#ffffff" />
                ) : (
                  <CloudOff size={16} color="#ffffff" />
                )}
                <Text style={styles.statusText}>
                  {isSyncing ? 'Syncing' : isOnline ? 'Online' : 'Offline'}
                </Text>
                {pendingCount > 0 && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>{pendingCount} pending</Text>
                  </View>
                )}
      </View>
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
        {/* Period Tabs */}
        <View style={[styles.tabsContainer, { backgroundColor: colors.cardBackground }]}>
          {tabs.map((tab) => (
        <TouchableOpacity 
              key={tab.id}
              style={[
                styles.tab,
                activeTab === tab.id && { backgroundColor: '#10b981' },
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
          title={`${tabs.find((t) => t.id === activeTab)?.label}'s Summary`}
          summary={activeSummary}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* Recent Transactions */}
        <RecentTransactions transactions={transactions} categories={categories} />
      </View>
    </ScrollView>
    </SafeAreaView>
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
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  statusBadgeOffline: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
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
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
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
});
