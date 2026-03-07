import { DebtItem } from '@/components/debts/DebtItem';
import { DebtSummary } from '@/components/debts/DebtSummary';
import { EditDebtSheet } from '@/components/debts/EditDebtSheet';
import { useDebts } from '@/hooks/useDebts';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useAuth } from '@/hooks/useAuth';
import { Debt } from '@/lib/debts';
import { getUserProfile, UserProfile } from '@/lib/profile';
import { router, useFocusEffect } from 'expo-router';
import { Plus, Store } from 'lucide-react-native';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DebtsScreen() {
  const colors = useThemeColors();
  const { user, loading: authLoading } = useAuth();
  const { debts, updateDebt, settleDebt, deleteDebt, refresh, loading, error } = useDebts();
  const [activeTab, setActiveTab] = useState<'active' | 'settled'>('active');
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user) {
      getUserProfile().then(setProfile).catch(err => {
        console.log('[debts] Could not load profile:', err);
      });
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      // Only refresh if debts are empty - otherwise use pull-to-refresh
      if (debts.length === 0 && !loading) {
        refresh();
      }
    }, [debts.length, loading, refresh])
  );

  const activeDebts = useMemo(() => debts.filter(d => !d.is_settled), [debts]);
  const settledDebts = useMemo(() => debts.filter(d => d.is_settled), [debts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh(true); // Force refresh
    setRefreshing(false);
  }, [refresh]);

  const handleSave = (id: string, data: {
    customer_name: string;
    amount: number;
    due_date: string | null;
    note: string | null;
  }) => {
    updateDebt(id, data);
  };

  // Show loading only on initial auth check
  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Please log in</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
        {/* Hero Header */}
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <View style={styles.headerDecoration1} />
          <View style={styles.headerDecoration2} />
          <View style={styles.headerContent}>
            <View style={styles.headerIconContainer}>
              <View style={styles.headerIcon}>
                <Store size={24} color="#ffffff" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Credit Book</Text>
                <Text style={styles.headerSubtitle}>People who owe you money</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Debt Summary */}
          <DebtSummary debts={debts} />

          {/* Tabs */}
          <View style={[styles.tabsContainer, { backgroundColor: colors.cardBackground }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'active' && { backgroundColor: '#1e3a8a' }]}
              onPress={() => setActiveTab('active')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive, { color: activeTab === 'active' ? '#ffffff' : colors.textSecondary }]}>
                Active ({activeDebts.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'settled' && { backgroundColor: '#1e3a8a' }]}
              onPress={() => setActiveTab('settled')}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === 'settled' && styles.tabTextActive, { color: activeTab === 'settled' ? '#ffffff' : colors.textSecondary }]}>
                Settled ({settledDebts.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          {error && debts.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>⚠️</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textColor }]}>Unable to load debts</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: '#1e3a8a' }]}
                onPress={() => refresh(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : activeTab === 'active' ? (
            activeDebts.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Text style={styles.emptyIcon}>🤝</Text>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textColor }]}>No active debts</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>That&apos;s great!</Text>
              </View>
            ) : (
              <View style={styles.debtsList}>
                {activeDebts.map(d => (
                  <DebtItem
                    key={d.id}
                    debt={d}
                    onSettle={() => settleDebt(d.id)}
                    onClick={() => setEditingDebt(d)}
                    businessName={profile?.full_name}
                  />
                ))}
              </View>
            )
          ) : (
            settledDebts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>No settled debts</Text>
              </View>
            ) : (
              <View style={styles.debtsList}>
                {settledDebts.map(d => (
                  <DebtItem
                    key={d.id}
                    debt={d}
                    onClick={() => setEditingDebt(d)}
                    businessName={profile?.full_name}
                  />
                ))}
              </View>
            )
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('./add-debt')}
          activeOpacity={0.8}
        >
          <Plus size={28} color="#ffffff" />
        </TouchableOpacity>

        {/* Edit Sheet */}
        <EditDebtSheet
          debt={editingDebt}
          open={!!editingDebt}
          onOpenChange={(open) => !open && setEditingDebt(null)}
          onSave={handleSave}
          onDelete={deleteDebt}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  content: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 100,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#999',
  },
  tabTextActive: {
    color: '#333',
  },
  debtsList: {
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
});

