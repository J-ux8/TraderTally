import { deleteTransaction as deleteTxLib, getUserTransactions, recordExpense, recordSale, updateTransaction as updateTxLib, batchUpdateTransactions, batchDeleteTransactions, getSaleItemsBatch } from '@/lib/transactions';
import { TransactionGroup, Transaction as GroupingTransaction } from '@/types/grouping';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useSync } from '@/context/SyncContext';
import { supabase } from '@/lib/supabase';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  user_id: string;
  customer_id: string | null;
  linked_sale_id: string | null;
  sale_items?: any[];
}

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  refresh: () => Promise<void>;
  updateTransaction: (id: string, amount: number, category: string | null, description: string | null, date?: string, customerId?: string) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  recordSale: (amount: number, category: string | null, description: string | null, transaction_date?: string, customerId?: string) => Promise<any>;
  recordExpense: (amount: number, category: string | null, description: string | null, transaction_date?: string, customerId?: string) => Promise<any>;
  totalProfit: number;

  // New grouping functionality
  groupedTransactions: TransactionGroup[];
  groupingEnabled: boolean;
  toggleGrouping: () => void;
  setGroupingEnabled: (enabled: boolean) => void;
  getGroupById: (id: string) => TransactionGroup | undefined;
  getGroupByKey: (key: string) => TransactionGroup | undefined;
  groupingMetrics: {
    totalGroups: number;
    averageGroupSize: number;
    groupingEfficiency: number;
    processingTime: number;
  };
}

const TransactionsContext = createContext<TransactionsContextType | null>(null);

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupingEnabled, setGroupingEnabled] = useState(true); // Default to enabled
  const isLoadingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use the transaction grouping hook
  const {
    groupedTransactions,
    loading: groupingLoading,
    metrics: groupingMetrics,
    actions: groupingActions
  } = useTransactionGroups(transactions, {
    initialGroupingEnabled: groupingEnabled,
    caseSensitive: true,
    minGroupSize: 1
  });

  // Sync grouping enabled state with hook
  useEffect(() => {
    groupingActions.setGroupingEnabled(groupingEnabled);
  }, [groupingEnabled, groupingActions]);

  // Memoize profit calculation
  const totalProfit = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [transactions]);

  const { triggerSync } = useSync();

  const loadTransactions = useCallback(async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      setLoading(true);
      const data = await getUserTransactions();

      // Batch-fetch all sale items in ONE query instead of N+1 individual queries
      const linkedSaleIds = (data as Transaction[])
        .map(tx => tx.linked_sale_id)
        .filter((id): id is string => !!id);

      const saleItemsMap = await getSaleItemsBatch(linkedSaleIds);

      const enrichedData = (data as Transaction[]).map(tx => ({
        ...tx,
        sale_items: tx.linked_sale_id ? (saleItemsMap[tx.linked_sale_id] || []) : undefined,
      }));

      setTransactions(enrichedData);
    } catch (error) {
      console.error('Error loading transactions:', error);
      // Don't clear transactions on error - keep existing data
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // 1. Initial load
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      loadTransactions();
    }

    // 2. Listen for auth changes to reload transactions
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        console.log('[Transactions] Auth changed, reloading transactions...');
        loadTransactions();
      } else if (event === 'SIGNED_OUT') {
        setTransactions([]);
      }
    });

    return () => authSub.unsubscribe();
  }, [loadTransactions]);

  const refresh = useCallback(async () => {
    isLoadingRef.current = false; // Reset flag to allow refresh
    await loadTransactions();
    // Manual refresh also triggers sync engine
    triggerSync().catch(console.error);
  }, [loadTransactions, triggerSync]);

  const handleRecordSale = useCallback(async (amount: number, category: string | null, description: string | null, date?: string, customerId?: string, linkedSaleId?: string) => {
    const result = await recordSale(amount, category, description, date, customerId, linkedSaleId);
    // Optimistic UI update
    setTransactions(prev => [result as Transaction, ...prev]);
    // Trigger background sync push
    triggerSync().catch(console.error);
    return result;
  }, [triggerSync]);

  const handleRecordExpense = useCallback(async (amount: number, category: string | null, description: string | null, date?: string, customerId?: string, linkedSaleId?: string) => {
    const result = await recordExpense(amount, category, description, date, customerId, linkedSaleId);
    // Optimistic UI update
    setTransactions(prev => [result as Transaction, ...prev]);
    // Trigger background sync push
    triggerSync().catch(console.error);
    return result;
  }, [triggerSync]);

  const handleUpdateTransaction = useCallback(async (id: string, amount: number, category: string | null, description: string | null, date?: string, customerId?: string) => {
    // Optimistic UI update
    setTransactions(prev => prev.map(tx =>
      tx.id === id
        ? { ...tx, amount, category, description, transaction_date: date || tx.transaction_date, customer_id: customerId || tx.customer_id, updated_at: new Date().toISOString() }
        : tx
    ));

    // Debounce the actual save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await updateTxLib(id, amount, category, description, date, customerId);
        // Trigger background sync push
        triggerSync().catch(console.error);
      } catch (error) {
        console.error('Error updating transaction:', error);
      }
    }, 1000);
  }, [triggerSync]);

  const handleRemoveTransaction = useCallback(async (id: string) => {
    // Optimistic UI update
    setTransactions(prev => prev.filter(tx => tx.id !== id));

    try {
      await deleteTxLib(id);
      // Trigger background sync push
      triggerSync().catch(console.error);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    }
  }, [triggerSync]);

  // Toggle grouping functionality
  const toggleGrouping = useCallback(() => {
    setGroupingEnabled(prev => !prev);
  }, []);

  // Get group by ID
  const getGroupById = useCallback((id: string) => {
    return groupingActions.getGroupById(id);
  }, [groupingActions]);

  // Get group by key
  const getGroupByKey = useCallback((key: string) => {
    return groupingActions.getGroupByKey(key);
  }, [groupingActions]);

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        loading: loading || groupingLoading,
        refresh,
        updateTransaction: handleUpdateTransaction,
        removeTransaction: handleRemoveTransaction,
        recordSale: handleRecordSale,
        recordExpense: handleRecordExpense,
        totalProfit,

        // Grouping functionality
        groupedTransactions,
        groupingEnabled,
        toggleGrouping,
        setGroupingEnabled,
        getGroupById,
        getGroupByKey,
        groupingMetrics,
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactionsContext() {
  const context = useContext(TransactionsContext);
  if (!context) {
    throw new Error('useTransactionsContext must be used within TransactionsProvider');
  }
  return context;
}
