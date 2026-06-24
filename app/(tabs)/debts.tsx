import { DebtItem } from '@/components/debts/DebtItem';
import { DebtSummary } from '@/components/debts/DebtSummary';
import { EditDebtSheet } from '@/components/debts/EditDebtSheet';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useDebts } from '@/hooks/useDebts';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Debt } from '@/lib/debts';
import { router, useFocusEffect } from 'expo-router';
import { Plus, Store } from 'lucide-react-native';
import React, { useCallback, useState, useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default React.memo(function DebtsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { debts, updateDebt, settleDebt, deleteDebt, refresh, loading, error } = useDebts();
  const [activeTab, setActiveTab] = useState<'active' | 'settled'>('active');
  const [mainTab, setMainTab] = useState<'receivable' | 'payable'>('receivable');
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Always try to refresh debts when screen is focused
      refresh(true);
    }, [refresh])
  );

  const activeDebts = useMemo(() => debts.filter(d => !d.is_settled && (d.type || 'receivable') === mainTab), [debts, mainTab]);
  const settledDebts = useMemo(() => debts.filter(d => d.is_settled && (d.type || 'receivable') === mainTab), [debts, mainTab]);

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

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.backgroundColor }]}>
      <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
        {/* Hero Header */}
        <View style={[styles.header, { backgroundColor: colors.cardBackground, paddingTop: Math.max(10, insets.top + 4) }]}>
          <View style={styles.headerDecoration1} />
          <View style={styles.headerDecoration2} />
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <Store size={22} color="#1e3a8a" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: colors.textColor }]}>Credit Book</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Manage money owed to you and money you owe</Text>
              </View>
            </View>
            <OfflineIndicator alwaysShow compact />
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
          <DebtSummary debts={debts.filter(d => (d.type || 'receivable') === mainTab)} />

          {/* Type Tabs */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, mainTab === 'receivable' && styles.typeButtonActive]}
              onPress={() => setMainTab('receivable')}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeButtonText, mainTab === 'receivable' && styles.typeButtonTextActive]}>
                Money Owed To Me
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, mainTab === 'payable' && styles.typeButtonActivePayable]}
              onPress={() => setMainTab('payable')}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeButtonText, mainTab === 'payable' && styles.typeButtonTextActive]}>
                Money I Owe
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status Tabs */}
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
          {loading && debts.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1e3a8a" />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading debts...</Text>
            </View>
          ) : error && debts.length === 0 ? (
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
                  />
                ))}
              </View>
            )
          )}
        </ScrollView>

        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.fab, mainTab === 'payable' && { backgroundColor: '#ef4444', shadowColor: '#ef4444' }]}
          onPress={() => router.push({ pathname: '/modals/add-debt', params: { type: mainTab } })}
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
    </View>
  );
});

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
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
    backgroundColor: 'rgba(30, 58, 138, 0.03)',
  },
  headerDecoration2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(30, 58, 138, 0.03)',
  },
  headerContent: {
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  headerIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
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
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: '#10b981', // green for receivable
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typeButtonActivePayable: {
    backgroundColor: '#ef4444', // red for payable
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeButtonTextActive: {
    color: '#ffffff',
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

