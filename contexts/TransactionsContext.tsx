import NetInfo from '@react-native-community/netinfo';
import { SyncEngine } from '@/lib/offline/sync/SyncEngine';
import { supabase } from '@/lib/supabase';
import { deleteTransaction as deleteTxLib, getUserTransactions, recordExpense, recordSale, updateTransaction as updateTxLib } from '@/lib/transactions';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline';

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
  pendingCount: number;
  syncStatus: SyncStatus;
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);

  // Monitor connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((status) => {
      setIsOnline(status.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  // Load from local SQLite
  const loadLocalData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const txData = await getUserTransactions();
      setTransactions(txData as Transaction[]);
      setLastLoadTime(Date.now());
    } catch (error) {
      console.error('Error loading local transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    // Check if data is fresh (less than 5 minutes old)
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    if (now - lastLoadTime < fiveMinutes && transactions.length > 0) {
      console.log('[TransactionsContext] Data is fresh, skipping refresh');
      return;
    }

    if (!isOnline) {
      console.log('[TransactionsContext] Offline - skipping refresh');
      await loadLocalData(true); // Still reload local data
      return;
    }
    setRefreshing(true);
    setIsSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          await SyncEngine.executeFullSync(user.id);
        } catch (syncError) {
          console.log('[TransactionsContext] Sync failed, but local data is still available');
        }
      }
      await loadLocalData(true);
    } catch (error) {
      console.error('Error refreshing:', error);
      // Still try to load local data even if sync failed
      await loadLocalData(true);
    } finally {
      setRefreshing(false);
      setIsSyncing(false);
    }
  }, [loadLocalData, isOnline, lastLoadTime, transactions.length]);

  useEffect(() => {
    // Delay initial load slightly to allow session cache to be populated
    const timer = setTimeout(() => {
      loadLocalData();
    }, 100);

    // Background sync cycle - Increased to 2 minutes for better performance
    const interval = setInterval(async () => {
      try {
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) return; // Skip if offline
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isOnline) {
          setIsSyncing(true);
          try {
            await SyncEngine.executeFullSync(session.user.id);
            await loadLocalData(true);
          } catch (syncError) {
            console.log('[TransactionsContext] Background sync failed, will retry later');
          } finally {
            setIsSyncing(false);
          }
        }
      } catch (err) {
        console.log('[TransactionsContext] Background sync error:', err);
      }
    }, 120000); // Changed from 60000 (1 min) to 120000 (2 min)

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadLocalData, isOnline]);

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

  const pendingCount = useMemo(() =>
    transactions.filter(t => t.sync_status === 'pending').length
    , [transactions]);

  const syncStatus = useMemo(() => {
    if (!isOnline) return 'offline';
    if (isSyncing) return 'syncing';
    if (pendingCount > 0) return 'pending';
    return 'synced';
  }, [isOnline, isSyncing, pendingCount]);

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        pendingCount,
        syncStatus,
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

