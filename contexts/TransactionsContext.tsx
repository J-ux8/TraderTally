import { supabase } from '@/lib/supabase';
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
}

interface TransactionsContextType {
  transactions: Transaction[];
  loading: boolean;
  refresh: () => Promise<void>;
  updateTransaction: (id: string, amount: number, category: string | null, description: string | null, date?: string) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  recordSale: (amount: number, category: string | null, description: string | null, transaction_date?: string) => Promise<any>;
  recordExpense: (amount: number, category: string | null, description: string | null, transaction_date?: string) => Promise<any>;
}

const TransactionsContext = createContext<TransactionsContextType | null>(null);

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUserTransactions();
      setTransactions(data as Transaction[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const refresh = useCallback(async () => {
    await loadTransactions();
  }, [loadTransactions]);

  const handleRecordSale = async (amount: number, category: string | null, description: string | null, date?: string) => {
    const result = await recordSale(amount, category, description, date);
    await loadTransactions();
    return result;
  };

  const handleRecordExpense = async (amount: number, category: string | null, description: string | null, date?: string) => {
    const result = await recordExpense(amount, category, description, date);
    await loadTransactions();
    return result;
  };

  const handleUpdateTransaction = async (id: string, amount: number, category: string | null, description: string | null, date?: string) => {
    await updateTxLib(id, amount, category, description, date);
    await loadTransactions();
  };

  const handleRemoveTransaction = async (id: string) => {
    await deleteTxLib(id);
    await loadTransactions();
  };

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        loading,
        refresh,
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
