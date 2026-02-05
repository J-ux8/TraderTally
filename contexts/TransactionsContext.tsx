import { supabase } from '@/lib/supabase';
import { getUserCategories, getUserTransactions, recordExpense, recordSale } from '@/lib/transactions';
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

interface Category {
  id: string;
  name: string;
}

interface TransactionsContextType {
  transactions: Transaction[];
  categories: Category[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  loadMore: () => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;
  addCategory: (category: Category) => void;
  recordSale: (amount: number, category: string | null, description: string | null, transaction_date?: string) => Promise<any>;
  recordExpense: (amount: number, category: string | null, description: string | null, transaction_date?: string) => Promise<any>;
}

const TransactionsContext = createContext<TransactionsContextType | null>(null);

const PAGE_SIZE = 20; // Reduced for faster initial load
const INITIAL_PAGE_SIZE = 20; // Even smaller for first load

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial data (server-only)
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setLoading(false);
        setTransactions([]);
        setCategories([]);
        return;
      }

      // Load categories from server (small, fast)
      const categoriesData = await getUserCategories(user.id).catch(err => {
        console.error('Error loading categories:', err);
        return [];
      });
      setCategories(categoriesData || []);

      // Load transactions from server
      const txData = await getUserTransactions(INITIAL_PAGE_SIZE);
      setTransactions(txData || []);

      setPage(0);
      setHasMore(true);
      setIsInitialized(true);
    } catch (error) {
      console.error('Error loading data:', error);
      setTransactions([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh data (reload from beginning) - optimized for speed
  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setTransactions([]);
        setCategories([]);
        setRefreshing(false);
        return;
      }

      const categoriesData = await getUserCategories(user.id).catch(err => {
        console.error('Error loading categories:', err);
        return [];
      });
      setCategories(categoriesData || []);

      const txData = await getUserTransactions(INITIAL_PAGE_SIZE);
      setTransactions(txData || []);
      setHasMore(true);
    } catch (error) {
      console.error('Error refreshing transactions:', error);
      // Set empty arrays on error
      setTransactions([]);
      setCategories([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Load more transactions (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || refreshing || !isInitialized) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const nextPage = page + 1;
      const offset = nextPage * PAGE_SIZE;

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        setTransactions(prev => [...prev, ...data]);
        setPage(nextPage);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
    }
  }, [hasMore, loading, refreshing, page, isInitialized]);

  // Add transaction optimistically
  const addTransaction = useCallback((transaction: Transaction) => {
    setTransactions(prev => {
      // Avoid duplicates - check if transaction with same ID already exists
      const exists = prev.some(t => t.id === transaction.id);
      if (exists) {
        // Transaction already exists, return new array reference to ensure React detects change
        // This ensures useMemo dependencies trigger even if we don't add a new transaction
        return [...prev];
      }
      // Add to beginning and sort by date (newest first)
      // Create new array to ensure React detects the change
      const updated = [transaction, ...prev];
      return updated.sort((a, b) => {
        const dateA = new Date(a.transaction_date).getTime();
        const dateB = new Date(b.transaction_date).getTime();
        if (dateA !== dateB) {
          return dateB - dateA; // Newest first
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
  }, []);

  // Update transaction
  const updateTransaction = useCallback((id: string, updates: Partial<Transaction>) => {
    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  // Remove transaction
  const removeTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  // Refresh categories only
  const refreshCategories = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setCategories([]);
        return;
      }

      const categoriesData = await getUserCategories(user.id).catch(err => {
        console.error('Error loading categories:', err);
        return [];
      });

      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Error refreshing categories:', error);
    }
  }, []);

  // Add category optimistically
  const addCategory = useCallback((category: Category) => {
    setCategories(prev => {
      // Check if category already exists
      const exists = prev.some(c => c.id === category.id || c.name.toLowerCase() === category.name.toLowerCase());
      if (exists) {
        return prev; // Return same array if exists
      }
      // Add to beginning and sort alphabetically
      const updated = [category, ...prev];
      return updated.sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  // Initialize on mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && !isInitialized) {
        loadInitialData();
      } else if (!session?.user) {
        setTransactions([]);
        setCategories([]);
        setIsInitialized(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadInitialData, isInitialized]);

  async function recordSaleLocal(amount: number, category: string | null, description: string | null, transaction_date?: string) {
    const tx = await recordSale(amount, category, description, transaction_date);
    addTransaction(tx as any);
    return tx;
  }

  async function recordExpenseLocal(amount: number, category: string | null, description: string | null, transaction_date?: string) {
    const tx = await recordExpense(amount, category, description, transaction_date);
    addTransaction(tx as any);
    return tx;
  }

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        categories,
        loading,
        refreshing,
        hasMore,
        refresh,
        refreshCategories,
        loadMore,
        addTransaction,
        updateTransaction,
        removeTransaction,
        addCategory,
        recordSale: recordSaleLocal,
        recordExpense: recordExpenseLocal,
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

