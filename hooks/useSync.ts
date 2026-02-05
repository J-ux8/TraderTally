import { initLocalDb } from '@/lib/localDb';
import { getPendingCount, processQueueBatch } from '@/lib/sync';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSync(pollIntervalMs = 30000) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const refreshPending = useCallback(async () => {
    try {
      const c = await getPendingCount();
      setPendingCount(c);
    } catch (err) {
      console.error('Error getting pending count', err);
    }
  }, []);

  const runSync = useCallback(async () => {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    setIsSyncing(true);
    try {
      await processQueueBatch(20);
      await refreshPending();
    } catch (err) {
      console.error('Error processing sync queue', err);
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    // initialize local DB
    initLocalDb().catch((err) => console.error('Failed to init local DB', err));

    // On connect, run sync immediately
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        runSync();
      }
    });

    // Polling while online
    (async function startPolling() {
      const state = await NetInfo.fetch();
      if (state.isConnected) {
        intervalRef.current = setInterval(() => {
          runSync();
        }, pollIntervalMs) as unknown as number;
      }
    })();

    // refresh pending count periodically
    const pendingInterval = setInterval(() => refreshPending(), 5000);

    // initial load
    refreshPending();

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current as unknown as number);
      clearInterval(pendingInterval);
    };
  }, [pollIntervalMs, refreshPending, runSync]);

  return { isSyncing, pendingCount, runSync };
}

