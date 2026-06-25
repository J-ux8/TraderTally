import { deleteTransaction as deleteTxLib, getUserTransactions, getTransactionsInRange, recordExpense, recordSale, updateTransaction as updateTxLib, batchUpdateTransactions, batchDeleteTransactions, getSaleItemsBatch } from '@/lib/transactions';
import { getUserDebts } from '@/lib/debts';
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
  has_outstanding_debt?: boolean;
}

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  refresh: () => Promise<void>;
  loadTransactionsInRange: (startMs: number, endMs: number) => Promise<Transaction[]>;
  updateTransaction: (id: string, amount: number, category: string | null, description: string | null, date?: string, customerId?: string) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  recordSale: (amount: number, category: string | null, description: string | null, transaction_date?: string, customerId?: string, linkedSaleId?: string) => Promise<any>;
  recordExpense: (amount: number, category: string | null, description: string | null, transaction_date?: string, customerId?: string, linkedSaleId?: string) => Promise<any>;
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

      // Batch-fetch all sale items in ONE query
      const linkedSaleIds = (data as Transaction[])
        .map(tx => tx.linked_sale_id)
        .filter((id): id is string => !!id);

      const saleItemsMap = await getSaleItemsBatch(linkedSaleIds);

      // Fetch unsettled debts to flag transactions with outstanding balance
      let unsettledSaleIds = new Set<string>();
      try {
        const debts = await getUserDebts();
        debts
          .filter(d => !d.is_settled && d.linked_sale_id)
          .forEach(d => unsettledSaleIds.add(d.linked_sale_id!));
      } catch (e) {
        console.warn('[Transactions] Failed to fetch debts for outstanding flag:', e);
      }

      // Deduplicate sale_items: only attach to the first transaction per linked_sale_id
      // (sorted oldest-first so the original "Sale" transaction gets them)
      const usedSaleIds = new Set<string>();
      const sorted = [...(data as Transaction[])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const enrichedMap = new Map<string, Transaction>();
      for (const tx of sorted) {
        let sale_items: any[] | undefined;
        if (tx.linked_sale_id) {
          if (!usedSaleIds.has(tx.linked_sale_id)) {
            sale_items = saleItemsMap[tx.linked_sale_id] || undefined;
            usedSaleIds.add(tx.linked_sale_id);
          }
        }
        enrichedMap.set(tx.id, {
          ...tx,
          sale_items,
          has_outstanding_debt: tx.linked_sale_id ? unsettledSaleIds.has(tx.linked_sale_id) : false,
        });
      }

      // Restore original order (newest first)
      const enrichedData = sorted
        .map(tx => enrichedMap.get(tx.id)!)
        .reverse();

      setTransactions(enrichedData);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  const loadTransactionsInRange = useCallback(async (startMs: number, endMs: number): Promise<Transaction[]> => {
    try {
      const data = await getTransactionsInRange(startMs, endMs);

      const linkedSaleIds = (data as Transaction[])
        .map(tx => tx.linked_sale_id)
        .filter((id): id is string => !!id);

      const saleItemsMap = await getSaleItemsBatch(linkedSaleIds);

      let unsettledSaleIds = new Set<string>();
      try {
        const debts = await getUserDebts();
        debts
          .filter(d => !d.is_settled && d.linked_sale_id)
          .forEach(d => unsettledSaleIds.add(d.linked_sale_id!));
      } catch (e) {
        console.warn('[Transactions] Failed to fetch debts for outstanding flag:', e);
      }

      const usedSaleIds = new Set<string>();
      const sorted = [...(data as Transaction[])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const enrichedMap = new Map<string, Transaction>();
      for (const tx of sorted) {
        let sale_items: any[] | undefined;
        if (tx.linked_sale_id) {
          if (!usedSaleIds.has(tx.linked_sale_id)) {
            sale_items = saleItemsMap[tx.linked_sale_id] || undefined;
            usedSaleIds.add(tx.linked_sale_id);
          }
        }
        enrichedMap.set(tx.id, {
          ...tx,
          sale_items,
          has_outstanding_debt: tx.linked_sale_id ? unsettledSaleIds.has(tx.linked_sale_id) : false,
        });
      }

      return sorted.map(tx => enrichedMap.get(tx.id)!).reverse();
    } catch (error) {
      console.error('Error loading transactions in range:', error);
      return [];
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
        loadTransactionsInRange,
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
