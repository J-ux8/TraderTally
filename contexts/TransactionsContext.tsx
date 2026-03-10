import { supabase } from '@/lib/supabase';
import { deleteTransaction as deleteTxLib, getUserTransactions, recordExpense, recordSale, updateTransaction as updateTxLib } from '@/lib/transactions';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

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
  const isLoadingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const loadTransactions = useCallback(async () => {
    // Prevent concurrent loads
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Only load if user is authenticated
      if (!user) {
        setTransactions([]);
        setLoading(false);
        return;
      }
      
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
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadTransactions();
      } else {
        setTransactions([]);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    isLoadingRef.current = false; // Reset flag to allow refresh
    await loadTransactions();
  }, [loadTransactions]);

  const handleRecordSale = async (amount: number, category: string | null, description: string | null, date?: string) => {
    const result = await recordSale(amount, category, description, date);
    // Update state immediately instead of reloading all
    setTransactions(prev => [result as Transaction, ...prev]);
    return result;
  };

  const handleRecordExpense = async (amount: number, category: string | null, description: string | null, date?: string) => {
    const result = await recordExpense(amount, category, description, date);
    // Update state immediately instead of reloading all
    setTransactions(prev => [result as Transaction, ...prev]);
    return result;
  };

  const handleUpdateTransaction = async (id: string, amount: number, category: string | null, description: string | null, date?: string) => {
    await updateTxLib(id, amount, category, description, date);
    // Update state immediately instead of reloading all
    setTransactions(prev => prev.map(tx =>
      tx.id === id
        ? { ...tx, amount, category, description, transaction_date: date || tx.transaction_date, updated_at: new Date().toISOString() }
        : tx
    ));
  };

  const handleRemoveTransaction = async (id: string) => {
    await deleteTxLib(id);
    // Update state immediately instead of reloading all
    setTransactions(prev => prev.filter(tx => tx.id !== id));
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
