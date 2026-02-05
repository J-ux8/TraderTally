import { useCallback, useState } from 'react';

export function useSync(pollIntervalMs = 30000) {
  const [isSyncing, setIsSyncing] = useState(false);

  const runSync = useCallback(async () => {
    // Offline mode disabled - no sync needed
    console.log('Offline sync disabled');
  }, []);

  return {
    isSyncing,
    runSync,
  };
}
