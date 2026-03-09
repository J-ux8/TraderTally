import { SyncLock } from '../SyncLock';

/**
 * Integration tests for SyncLock demonstrating real-world usage patterns
 * with the sync engine
 */
describe('SyncLock Integration', () => {
  beforeEach(async () => {
    await SyncLock.forceRelease();
  });

  afterEach(async () => {
    await SyncLock.forceRelease();
  });

  describe('sync engine usage pattern', () => {
    it('should prevent concurrent sync cycles', async () => {
      const syncResults: string[] = [];

      // Simulate sync operation
      const performSync = async (syncId: string): Promise<boolean> => {
        const acquired = await SyncLock.acquire();
        
        if (!acquired) {
          syncResults.push(`${syncId}: failed to acquire lock`);
          return false;
        }

        try {
          syncResults.push(`${syncId}: started`);
          
          // Simulate sync work
          await new Promise(resolve => setTimeout(resolve, 50));
          
          syncResults.push(`${syncId}: completed`);
          return true;
        } finally {
          await SyncLock.release();
        }
      };

      // Start two sync operations simultaneously
      const [result1, result2] = await Promise.all([
        performSync('sync1'),
        performSync('sync2')
      ]);

      // One should succeed, one should fail
      expect(result1 !== result2).toBe(true);
      expect(syncResults).toContain('sync1: started');
      expect(syncResults).toContain('sync1: completed');
      
      // The second sync should have failed to acquire lock
      const failedSync = result1 ? 'sync2' : 'sync1';
      expect(syncResults).toContain(`${failedSync}: failed to acquire lock`);
    });

    it('should allow sequential sync operations', async () => {
      const syncResults: string[] = [];

      const performSync = async (syncId: string): Promise<void> => {
        const acquired = await SyncLock.acquire();
        expect(acquired).toBe(true);

        try {
          syncResults.push(`${syncId}: started`);
          await new Promise(resolve => setTimeout(resolve, 10));
          syncResults.push(`${syncId}: completed`);
        } finally {
          await SyncLock.release();
        }
      };

      // Run syncs sequentially
      await performSync('sync1');
      await performSync('sync2');
      await performSync('sync3');

      expect(syncResults).toEqual([
        'sync1: started',
        'sync1: completed',
        'sync2: started',
        'sync2: completed',
        'sync3: started',
        'sync3: completed'
      ]);
    });

    it('should handle error during sync with proper cleanup', async () => {
      const performSyncWithError = async (): Promise<void> => {
        const acquired = await SyncLock.acquire();
        expect(acquired).toBe(true);

        try {
          // Simulate error during sync
          throw new Error('Network error');
        } finally {
          // Lock should be released even on error
          await SyncLock.release();
        }
      };

      // First sync fails
      await expect(performSyncWithError()).rejects.toThrow('Network error');

      // Lock should be released, allowing next sync
      const acquired = await SyncLock.acquire();
      expect(acquired).toBe(true);
    });

    it('should handle stuck sync with force release', async () => {
      // Simulate sync that acquires lock but crashes without releasing
      const acquiredInitial = await SyncLock.acquire();
      expect(acquiredInitial).toBe(true);

      // Simulate crash - no release call
      // In production, this would be detected by monitoring

      // Error recovery mechanism uses forceRelease
      await SyncLock.forceRelease();

      // New sync can now proceed
      const acquiredAfterRecovery = await SyncLock.acquire();
      expect(acquiredAfterRecovery).toBe(true);
    });
  });

  describe('retry mechanism integration', () => {
    it('should allow retry after failed lock acquisition', async () => {
      const syncAttempts: string[] = [];

      const attemptSync = async (attemptId: string): Promise<boolean> => {
        const acquired = await SyncLock.acquire();
        
        if (!acquired) {
          syncAttempts.push(`${attemptId}: lock busy, will retry`);
          return false;
        }

        try {
          syncAttempts.push(`${attemptId}: sync started`);
          await new Promise(resolve => setTimeout(resolve, 20));
          syncAttempts.push(`${attemptId}: sync completed`);
          return true;
        } finally {
          await SyncLock.release();
        }
      };

      // First sync acquires lock
      const sync1Promise = attemptSync('sync1');

      // Second sync tries immediately (will fail)
      await new Promise(resolve => setTimeout(resolve, 5));
      const sync2FirstAttempt = await attemptSync('sync2-attempt1');
      expect(sync2FirstAttempt).toBe(false);

      // Wait for first sync to complete
      await sync1Promise;

      // Second sync retries and succeeds
      const sync2SecondAttempt = await attemptSync('sync2-attempt2');
      expect(sync2SecondAttempt).toBe(true);

      expect(syncAttempts).toContain('sync1: sync started');
      expect(syncAttempts).toContain('sync1: sync completed');
      expect(syncAttempts).toContain('sync2-attempt1: lock busy, will retry');
      expect(syncAttempts).toContain('sync2-attempt2: sync started');
      expect(syncAttempts).toContain('sync2-attempt2: sync completed');
    });
  });

  describe('timeout recovery', () => {
    it('should recover from stuck sync after timeout', async () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);

      // First sync acquires lock but gets stuck
      const acquired1 = await SyncLock.acquire();
      expect(acquired1).toBe(true);

      // Simulate 5 minutes passing
      currentTime += (5 * 60 * 1000) + 1000;

      // New sync should auto-release expired lock and acquire
      const acquired2 = await SyncLock.acquire();
      expect(acquired2).toBe(true);

      // Restore
      Date.now = originalNow;
    });

    it('should not interfere with normal sync within timeout', async () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);

      // First sync acquires lock
      const acquired1 = await SyncLock.acquire();
      expect(acquired1).toBe(true);

      // Simulate 2 minutes passing (less than timeout)
      currentTime += 2 * 60 * 1000;

      // Second sync should still fail to acquire
      const acquired2 = await SyncLock.acquire();
      expect(acquired2).toBe(false);

      // First sync is still valid
      expect(SyncLock.isLocked()).toBe(true);

      // Restore
      Date.now = originalNow;
    });
  });

  describe('multiple trigger sources', () => {
    it('should handle sync triggers from multiple sources', async () => {
      const triggerResults: string[] = [];

      const triggerSync = async (source: string): Promise<void> => {
        const acquired = await SyncLock.acquire();
        
        if (!acquired) {
          triggerResults.push(`${source}: skipped (sync in progress)`);
          return;
        }

        try {
          triggerResults.push(`${source}: sync started`);
          await new Promise(resolve => setTimeout(resolve, 30));
          triggerResults.push(`${source}: sync completed`);
        } finally {
          await SyncLock.release();
        }
      };

      // Simulate multiple trigger sources firing simultaneously
      await Promise.all([
        triggerSync('user-action'),
        triggerSync('network-reconnect'),
        triggerSync('background-timer'),
        triggerSync('app-start')
      ]);

      // Only one sync should have run
      const startedCount = triggerResults.filter(r => r.includes('started')).length;
      const completedCount = triggerResults.filter(r => r.includes('completed')).length;
      const skippedCount = triggerResults.filter(r => r.includes('skipped')).length;

      expect(startedCount).toBe(1);
      expect(completedCount).toBe(1);
      expect(skippedCount).toBe(3);
    });
  });
});
