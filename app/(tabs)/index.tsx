import { QuickActions } from '@/components/dashboard/QuickActions';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { QuickTemplatesSection } from '@/components/templates/QuickTemplatesSection';
import { useTheme } from '@/contexts/ThemeContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useTemplatesContext } from '@/contexts/TemplatesContext';
import { useSummary } from '@/hooks/useSummary';
import { useThemeColors } from '@/hooks/useThemeColors';
import { signOut } from '@/lib/auth';
import { router } from "expo-router";
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { Activity, LogOut, Store, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, AppState } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Template } from '@/lib/templates';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = useThemeColors();
  const { transactions, refresh } = useTransactionsContext();
  const { templates, loading: templatesLoading, deleteTemplate } = useTemplatesContext();
  const [refreshing, setRefreshing] = useState(false);
  const { daily, weekly, monthly } = useSummary(transactions);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const lastDateRef = useRef<string>(new Date().toDateString());

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

  // Template handlers
  const handleTemplatePress = useCallback((template: Template) => {
    // Navigate to transaction form with pre-filled data
    if (template.type === 'sale') {
      router.push({
        pathname: '/modals/record-sale',
        params: {
          templateId: template.id,
          amount: template.default_amount.toString(),
          category: template.category || '',
          description: template.description || '',
        },
      });
    } else {
      router.push({
        pathname: '/modals/record-expense',
        params: {
          templateId: template.id,
          amount: template.default_amount.toString(),
          category: template.category || '',
          description: template.description || '',
        },
      });
    }
  }, []);

  const handleEditTemplate = useCallback((template: Template) => {
    router.push({
      pathname: '/modals/edit-template' as any,
      params: { id: template.id },
    });
  }, []);

  const handleDeleteTemplate = useCallback(async (template: Template) => {
    try {
      await deleteTemplate(template.id);
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  }, [deleteTemplate]);

  const handleCreateTemplate = useCallback(() => {
    router.push('/modals/create-template' as any);
  }, []);

  const dailyTracking = useMemo(() => {
    // Calculate consecutive days with transactions starting from today
    let consecutiveDays = 0;
    const today = new Date();
    
    // Get today's date in local timezone (YYYY-MM-DD format)
    const getLocalDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Check up to 30 days back for consecutive daily tracking
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(checkDate);
      
      // Check if there's a transaction on this date
      const hasTransaction = transactions.some(t => {
        const transactionDate = t.transaction_date.split('T')[0];
        return transactionDate === dateStr;
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
                {dailyTracking === 0 ? 'Ready to track your business today?' :
                 dailyTracking === 1 ? 'Keep the momentum going!' :
                 dailyTracking >= 7 ? 'You\'re building great habits!' :
                 'Your business tracking is on point!'}
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
                  {dailyTracking === 0 ? 'Ready to start tracking today' : 
                   dailyTracking === 1 ? 'Day 1 - Great start!' :
                   dailyTracking === 2 ? 'Day 2 - Building momentum!' :
                   dailyTracking === 3 ? 'Day 3 - You\'re on a roll!' :
                   `${dailyTracking} days in a row - Amazing!`}
                </Text>
              </View>
            </View>
            <View style={[styles.consistencyBadge, { backgroundColor: dailyTracking >= 7 ? 'rgba(16, 185, 129, 0.1)' : dailyTracking >= 3 ? 'rgba(245, 158, 11, 0.1)' : dailyTracking >= 1 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
              <Text style={[styles.consistencyBadgeText, { color: dailyTracking >= 7 ? '#10b981' : dailyTracking >= 3 ? '#f59e0b' : dailyTracking >= 1 ? '#3b82f6' : '#ef4444' }]}>
                {dailyTracking >= 7 ? 'Excellent!' : dailyTracking >= 3 ? 'Keep going!' : dailyTracking >= 1 ? 'Good start' : 'Start today'}
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

          {/* Quick Templates Section */}
          <View style={[styles.templatesContainer, { backgroundColor: cardBackground }]}>
            <View style={styles.templatesHeader}>
              <Text style={[styles.templatesTitle, { color: textColor }]}>Quick Templates</Text>
              <TouchableOpacity
                style={styles.createTemplateButton}
                onPress={handleCreateTemplate}
                activeOpacity={0.7}
              >
                <Plus size={16} color="#1e3a8a" />
                <Text style={styles.createTemplateText}>Create</Text>
              </TouchableOpacity>
            </View>
            <QuickTemplatesSection
              templates={templates}
              onTemplatePress={handleTemplatePress}
              onEditTemplate={handleEditTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              loading={templatesLoading}
            />
          </View>

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
  templatesContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  templatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  templatesTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  createTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(30, 58, 138, 0.1)',
    borderRadius: 8,
  },
  createTemplateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e3a8a',
  },
});
