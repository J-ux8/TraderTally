import { deleteTransaction as deleteTxLib, getUserTransactions, recordExpense, recordSale, updateTransaction as updateTxLib, batchUpdateTransactions, batchDeleteTransactions } from '@/lib/transactions';
import { TransactionGroup, Transaction as GroupingTransaction } from '@/types/grouping';
import { useTransactionGroups } from '@/hooks/useTransactionGroups';
import { useSync } from '@/context/SyncContext';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  user_id: string;
}

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  refresh: () => Promise<void>;
  updateTransaction: (id: string, amount: number, category: string | null, description: string | null, date?: string) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  recordSale: (amount: number, category: string | null, description: string | null, transaction_date?: string) => Promise<any>;
  recordExpense: (amount: number, category: string | null, description: string | null, transaction_date?: string) => Promise<any>;
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
      setTransactions(data as Transaction[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
      // Don't clear transactions on error - keep existing data
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Only initialize once
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    loadTransactions();
  }, [loadTransactions]);

  const refresh = useCallback(async () => {
    isLoadingRef.current = false; // Reset flag to allow refresh
    await loadTransactions();
    // Manual refresh also triggers sync engine
    triggerSync().catch(console.error);
  }, [loadTransactions, triggerSync]);

  const handleRecordSale = useCallback(async (amount: number, category: string | null, description: string | null, date?: string) => {
    const result = await recordSale(amount, category, description, date);
    // Optimistic UI update
    setTransactions(prev => [result as Transaction, ...prev]);
    return result;
  }, []);

  const handleRecordExpense = useCallback(async (amount: number, category: string | null, description: string | null, date?: string) => {
    const result = await recordExpense(amount, category, description, date);
    // Optimistic UI update
    setTransactions(prev => [result as Transaction, ...prev]);
    return result;
  }, []);

  const handleUpdateTransaction = useCallback(async (id: string, amount: number, category: string | null, description: string | null, date?: string) => {
    // Optimistic UI update
    setTransactions(prev => prev.map(tx =>
      tx.id === id
        ? { ...tx, amount, category, description, transaction_date: date || tx.transaction_date, updated_at: new Date().toISOString() }
        : tx
    ));
    
    // Debounce the actual save
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await updateTxLib(id, amount, category, description, date);
      } catch (error) {
        console.error('Error updating transaction:', error);
        // Reload on error to sync state
        await loadTransactions();
      }
    }, 500);
  }, [loadTransactions]);

  const handleRemoveTransaction = useCallback(async (id: string) => {
    // Optimistic UI update
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    
    try {
      await deleteTxLib(id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      // Reload on error to sync state
      await loadTransactions();
    }
  }, [loadTransactions]);

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
