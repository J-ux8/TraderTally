import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline';

export function useSync(pendingCount: number = 0) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  const runSync = useCallback(async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    // Simulate sync latency — real sync happens via Supabase on every write
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      setIsSyncing(false);
      setLastSyncedAt(new Date());
    }, 1200);
  }, [isOnline]);

  const markSynced = useCallback(() => {
    setIsSyncing(false);
    setLastSyncedAt(new Date());
  }, []);

  // Derive status
  let status: SyncStatus = 'synced';
  if (!isOnline) {
    status = 'offline';
  } else if (isSyncing) {
    status = 'syncing';
  } else if (pendingCount > 0) {
    status = 'pending';
  } else {
    status = 'synced';
  }

  return {
    status,
    isOnline,
    isSyncing,
    lastSyncedAt,
    runSync,
    markSynced,
  };
}
