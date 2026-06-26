import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { SyncEngine } from '../sync/syncEngine';
import { NetworkMonitor } from '../sync/NetworkMonitor';
import { SyncWorker } from '../sync/SyncWorker';
import { LocalDB } from '../database/localDb';
import { supabase } from '../lib/supabase';

export type GlobalSyncStatus = 'synced' | 'syncing' | 'offline' | 'failed';

interface SyncContextValue {
  syncStatus: GlobalSyncStatus;
  isOnline: boolean;
  lastSyncedAt: string | null;
  failedCount: number;
  triggerSync: () => Promise<void>;
  retryFailed: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

/**
 * Sync Provider
 */
export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<GlobalSyncStatus>('synced');
  const [isOnline, setIsOnline] = useState<boolean>(NetworkMonitor.getStatus());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState<number>(0);

  const refreshQueueStats = useCallback(async () => {
    try {
      const stats = await SyncWorker.getQueueStats();
      setFailedCount(stats.failed);
    } catch {}
  }, []);

  const retryFailed = useCallback(async () => {
    if (!NetworkMonitor.getStatus()) {
      setSyncStatus('offline');
      return;
    }
    setSyncStatus('syncing');
    try {
      await SyncWorker.runOnce();
      await refreshQueueStats();
      if (failedCount === 0) {
        setSyncStatus('synced');
      }
    } catch {
      setSyncStatus('failed');
    }
  }, [failedCount, refreshQueueStats]);

  /**
   * Universal Sync Trigger
   */
  const triggerSync = useCallback(async () => {
    if (!NetworkMonitor.getStatus()) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');
    try {
      await SyncWorker.runOnce();
      const success = await SyncEngine.syncAll();
      if (success) {
        const lastTime = await LocalDB.getLastSyncTime();
        setLastSyncedAt(lastTime);
        setSyncStatus('synced');
      } else if (!NetworkMonitor.getStatus()) {
        setSyncStatus('offline');
      } else if (!SyncEngine.getProcessingStatus()) {
        setSyncStatus('synced');
      }
    } finally {
      refreshQueueStats();
    }
  }, [refreshQueueStats]);

  useEffect(() => {
    // 1. Initialize Network Monitor and background SyncWorker
    NetworkMonitor.start();
    SyncWorker.start();

    // 2. Fetch initial state
    LocalDB.getLastSyncTime().then(setLastSyncedAt);

    // 3. Subscribe to network changes
    const unsubscribe = NetworkMonitor.subscribe((online) => {
      setIsOnline(online);
      if (online) {
        triggerSync();
      } else {
        console.log('[SyncContext] Network went offline, updating status');
        setSyncStatus('offline');
      }
    });

    // 4. Debounced initial sync — single call after 2s delay
    const startupTimer = setTimeout(() => {
      if (NetworkMonitor.getStatus()) {
        triggerSync();
      }
    }, 2000);

    // 5. Periodic sync (every 60 seconds)
    const interval = setInterval(() => {
      if (NetworkMonitor.getStatus() && !SyncEngine.getProcessingStatus()) {
        triggerSync();
      }
    }, 60000);

    // 6. Refresh queue stats periodically
    refreshQueueStats();
    const statsInterval = setInterval(refreshQueueStats, 30000);

    // 6. Listen for auth changes to trigger sync
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        console.log('[SyncContext] User signed in, triggering sync...');
        triggerSync();
      }
    });

    return () => {
      SyncWorker.stop();
      unsubscribe();
      clearTimeout(startupTimer);
      clearInterval(interval);
      clearInterval(statsInterval);
      authSub.unsubscribe();
    };
  }, [triggerSync]);

  return (
    <SyncContext.Provider value={{ syncStatus, isOnline, lastSyncedAt, failedCount, triggerSync, retryFailed }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};
