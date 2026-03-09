import NetInfo from '@react-native-community/netinfo';
import { SyncEngine } from '@/lib/offline/sync/SyncEngine';
import { networkMonitor } from '@/lib/offline/sync/NetworkMonitor';
import { supabase } from '@/lib/supabase';
import { deleteTransaction as deleteTxLib, getUserTransactions, recordExpense, recordSale, updateTransaction as updateTxLib } from '@/lib/transactions';
import { SyncToast } from '@/components/ui/SyncToast';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [lastSyncedCount, setLastSyncedCount] = useState(0);
  
  // Task 3.5: Sync trigger management
  const syncEngineRef = useRef<SyncEngine | null>(null);
  const debouncedSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastNetworkReconnectSyncRef = useRef<number>(0); // Track last network reconnect sync time

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

  /**
   * Task 3.5: Trigger sync with mutex lock respect
   * Requirements: 9.5
   * 
   * This function triggers a sync cycle but respects the mutex lock.
   * If a sync is already in progress, it skips the trigger.
   */
  const triggerSync = useCallback(async (source: 'user_action' | 'network_reconnect' | 'background_timer' | 'app_start') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Requirement 9.5: Check if sync is already running (respect mutex lock)
      if (syncEngineRef.current?.isSyncing()) {
        console.log(`[TransactionsContext] Sync already in progress, skipping ${source} trigger`);
        return;
      }

      const currentPending = transactions.filter(t => t.sync_status === 'pending').length;
      
      setIsSyncing(true);
      console.log(`[TransactionsContext] Triggering sync from ${source}`);
      
      try {
        await syncEngineRef.current?.sync();
        await loadLocalData(true);
        
        // Show toast if we synced items
        if (currentPending > 0) {
          setLastSyncedCount(currentPending);
          setShowSyncToast(true);
        }
      } catch (syncError) {
        console.log(`[TransactionsContext] Sync failed from ${source}:`, syncError);
      } finally {
        setIsSyncing(false);
      }
    } catch (err) {
      console.log(`[TransactionsContext] Error in ${source} sync trigger:`, err);
      setIsSyncing(false);
    }
  }, [transactions, loadLocalData]);

  /**
   * Task 3.5: Debounced sync trigger for user actions
   * Requirements: 9.3, 9.4
   * 
   * Triggers sync after user actions with 20-second debounce.
   * Maximum 1 sync per 20 seconds to prevent excessive network usage.
   */
  const triggerDebouncedSync = useCallback(() => {
    // Clear existing timer
    if (debouncedSyncTimerRef.current) {
      clearTimeout(debouncedSyncTimerRef.current);
    }

    // Requirement 9.3, 9.4: Debounce to 20 seconds
    debouncedSyncTimerRef.current = setTimeout(() => {
      triggerSync('user_action');
    }, 20000); // 20 second throttle
  }, [triggerSync]);

  const refresh = useCallback(async () => {
    if (!isOnline) {
      console.log('[TransactionsContext] Offline - reloading local data only');
      await loadLocalData(true);
      return;
    }
    
    setRefreshing(true);
    setIsSyncing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          await syncEngineRef.current?.sync();
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
  }, [loadLocalData, isOnline]);

  useEffect(() => {
    // Initialize SyncEngine and load data immediately
    const initSyncEngine = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        syncEngineRef.current = new SyncEngine(user.id);
        
        // Requirement 9.1: Trigger sync on app start
        console.log('[TransactionsContext] Triggering initial sync on app start');
        triggerSync('app_start');
      }
    };

    // Load data immediately - no delay
    loadLocalData();
    initSyncEngine();

    // Task 3.5: Network reconnection listener
    // Requirement 9.2: Trigger sync when network reconnects
    const unsubscribeNetwork = networkMonitor.subscribe((online) => {
      setIsOnline(online);
      
      if (online) {
        // Debounce network reconnect syncs to prevent spam
        // Only trigger if it's been at least 30 seconds since last network reconnect sync
        const now = Date.now();
        const timeSinceLastSync = now - lastNetworkReconnectSyncRef.current;
        
        if (timeSinceLastSync >= 30000) { // 30 seconds
          console.log('[TransactionsContext] Network reconnected, triggering sync');
          lastNetworkReconnectSyncRef.current = now;
          triggerSync('network_reconnect');
        } else {
          console.log(`[TransactionsContext] Network reconnected, but skipping sync (last sync was ${Math.round(timeSinceLastSync / 1000)}s ago)`);
        }
      }
    });

    // Task 3.5: Background timer
    // Requirement 9.4: Trigger sync every 60 seconds while app is active
    backgroundSyncIntervalRef.current = setInterval(async () => {
      try {
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) return; // Skip if offline
        
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isOnline) {
          console.log('[TransactionsContext] Background timer triggering sync');
          triggerSync('background_timer');
        }
      } catch (err) {
        console.log('[TransactionsContext] Background sync error:', err);
      }
    }, 60000); // 60 second interval

    return () => {
      unsubscribeNetwork();
      
      // Clear debounced sync timer
      if (debouncedSyncTimerRef.current) {
        clearTimeout(debouncedSyncTimerRef.current);
      }
      
      // Clear background sync interval
      if (backgroundSyncIntervalRef.current) {
        clearInterval(backgroundSyncIntervalRef.current);
      }
    };
  }, [loadLocalData, isOnline, triggerSync]);

  const addTransaction = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
  };

  const handleRecordSale = async (amount: number, category: string | null, description: string | null, date?: string) => {
    const res = await recordSale(amount, category, description, date);
    await loadLocalData(true);
    
    // Task 3.5: Trigger debounced sync after user action
    // Requirement 9.3: Trigger sync on user create/modify operations
    triggerDebouncedSync();
    
    return res;
  };

  const handleRecordExpense = async (amount: number, category: string | null, description: string | null, date?: string) => {
    const res = await recordExpense(amount, category, description, date);
    await loadLocalData(true);
    
    // Task 3.5: Trigger debounced sync after user action
    // Requirement 9.3: Trigger sync on user create/modify operations
    triggerDebouncedSync();
    
    return res;
  };

  const handleUpdateTransaction = async (id: string, amount: number, category: string | null, description: string | null, date?: string) => {
    await updateTxLib(id, amount, category, description, date);
    await loadLocalData(true);
    
    // Task 3.5: Trigger debounced sync after user action
    // Requirement 9.3: Trigger sync on user create/modify operations
    triggerDebouncedSync();
  };

  const handleRemoveTransaction = async (id: string) => {
    await deleteTxLib(id);
    await loadLocalData(true);
    
    // Task 3.5: Trigger debounced sync after user action
    // Requirement 9.3: Trigger sync on user create/modify operations (includes delete)
    triggerDebouncedSync();
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
      <SyncToast
        visible={showSyncToast}
        message={`✓ ${lastSyncedCount} ${lastSyncedCount === 1 ? 'item' : 'items'} synced to cloud`}
        onHide={() => setShowSyncToast(false)}
      />
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

