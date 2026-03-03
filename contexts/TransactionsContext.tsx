import { pullCloudChanges, pushPendingChanges } from '@/lib/sync';
import { deleteTransaction as deleteTxLib, getUserTransactions, recordExpense, recordSale, updateTransaction as updateTxLib } from '@/lib/transactions';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  user_id: string;
  sync_status?: string;
}

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, amount: number, category: string | null, description: string | null, date?: string) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  recordSale: (amount: number, category: string | null, description: string | null, transaction_date?: string) => Promise<any>;
  recordExpense: (amount: number, category: string | null, description: string | null, transaction_date?: string) => Promise<any>;
}

const TransactionsContext = createContext<TransactionsContextType | null>(null);

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load from local SQLite
  const loadLocalData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const txData = await getUserTransactions();
      setTransactions(txData as Transaction[]);
    } catch (error) {
      console.error('Error loading local transactions:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Background sync
      await pushPendingChanges().catch(console.error);
      await pullCloudChanges().catch(console.error);
      await loadLocalData();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadLocalData]);

  useEffect(() => {
    loadLocalData();
    const interval = setInterval(() => {
      pushPendingChanges().catch(err => console.error('Background Push Error:', err));
    }, 60000);
    return () => clearInterval(interval);
  }, [loadLocalData]);

  const addTransaction = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
  };

  const handleRecordSale = async (amount: number, category: string | null, description: string | null, date?: string) => {
    const res = await recordSale(amount, category, description, date);
    await loadLocalData(true);
    return res;
  };

  const handleRecordExpense = async (amount: number, category: string | null, description: string | null, date?: string) => {
    const res = await recordExpense(amount, category, description, date);
    await loadLocalData(true);
    return res;
  };

  const handleUpdateTransaction = async (id: string, amount: number, category: string | null, description: string | null, date?: string) => {
    await updateTxLib(id, amount, category, description, date);
    await loadLocalData(true);
  };

  const handleRemoveTransaction = async (id: string) => {
    await deleteTxLib(id);
    await loadLocalData(true);
  };

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        loading,
        refreshing,
        refresh,
        addTransaction,
        updateTransaction: handleUpdateTransaction,
        removeTransaction: handleRemoveTransaction,
        recordSale: handleRecordSale,
        recordExpense: handleRecordExpense,
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

