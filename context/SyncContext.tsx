import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { SyncEngine } from '../sync/syncEngine';
import { NetworkMonitor } from '../sync/NetworkMonitor';
import { LocalDB } from '../database/localDb';

export type GlobalSyncStatus = 'synced' | 'syncing' | 'offline' | 'failed';

interface SyncContextValue {
  syncStatus: GlobalSyncStatus;
  isOnline: boolean;
  lastSyncedAt: string | null;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

/**
 * Sync Provider
 */
export const SyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState<GlobalSyncStatus>('synced');
  const [isOnline, setIsOnline] = useState<boolean>(NetworkMonitor.getStatus());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

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
      await SyncEngine.syncAll();
      const lastTime = await LocalDB.getLastSyncTime();
      setLastSyncedAt(lastTime);
      setSyncStatus('synced');
    } catch (error) {
      console.error('[SyncContext] Sync error:', error);
      setSyncStatus('failed');
    }
  }, []);

  useEffect(() => {
    // 1. Initialize Network Monitor
    NetworkMonitor.start();

    // 2. Fetch initial state
    LocalDB.getLastSyncTime().then(setLastSyncedAt);

    // 3. Subscribe to network changes
    const unsubscribe = NetworkMonitor.subscribe((online) => {
      setIsOnline(online);
      if (online) {
        // Automatically sync on reconnection
        triggerSync();
      } else {
        setSyncStatus('offline');
      }
    });

    // 4. Initial sync on app start
    triggerSync();

    // 5. Periodic sync (every 60 seconds)
    const interval = setInterval(() => {
      if (NetworkMonitor.getStatus() && !SyncEngine.getProcessingStatus()) {
        triggerSync();
      }
    }, 60000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [triggerSync]);

  return (
    <SyncContext.Provider value={{ syncStatus, isOnline, lastSyncedAt, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};
