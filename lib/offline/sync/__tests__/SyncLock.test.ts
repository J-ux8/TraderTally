import { SyncLock } from '../SyncLock';

describe('SyncLock', () => {
  beforeEach(async () => {
    // Reset lock state before each test
    await SyncLock.forceRelease();
  });

  afterEach(async () => {
    // Clean up after each test
    await SyncLock.forceRelease();
  });

  describe('acquire()', () => {
    it('should acquire lock when not locked', async () => {
      const acquired = await SyncLock.acquire();
      expect(acquired).toBe(true);
      expect(SyncLock.isLocked()).toBe(true);
    });

    it('should fail to acquire lock when already locked', async () => {
      const firstAcquire = await SyncLock.acquire();
      expect(firstAcquire).toBe(true);

      const secondAcquire = await SyncLock.acquire();
      expect(secondAcquire).toBe(false);
      expect(SyncLock.isLocked()).toBe(true);
    });

    it('should auto-release lock after 5 minutes', async () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);

      const acquired = await SyncLock.acquire();
      expect(acquired).toBe(true);

      // Advance time by 5 minutes + 1 second
      currentTime += (5 * 60 * 1000) + 1000;

      // Should be able to acquire again after timeout
      const reacquired = await SyncLock.acquire();
      expect(reacquired).toBe(true);

      // Restore original Date.now
      Date.now = originalNow;
    });

    it('should not auto-release lock before 5 minutes', async () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);

      const acquired = await SyncLock.acquire();
      expect(acquired).toBe(true);

      // Advance time by 4 minutes (less than timeout)
      currentTime += 4 * 60 * 1000;

      // Should still be locked
      const reacquired = await SyncLock.acquire();
      expect(reacquired).toBe(false);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('release()', () => {
    it('should release acquired lock', async () => {
      await SyncLock.acquire();
      expect(SyncLock.isLocked()).toBe(true);

      await SyncLock.release();
      expect(SyncLock.isLocked()).toBe(false);
    });

    it('should allow reacquiring after release', async () => {
      await SyncLock.acquire();
      await SyncLock.release();

      const reacquired = await SyncLock.acquire();
      expect(reacquired).toBe(true);
      expect(SyncLock.isLocked()).toBe(true);
    });

    it('should be safe to call when not locked', async () => {
      expect(SyncLock.isLocked()).toBe(false);
      await expect(SyncLock.release()).resolves.not.toThrow();
      expect(SyncLock.isLocked()).toBe(false);
    });
  });

  describe('isLocked()', () => {
    it('should return false when not locked', () => {
      expect(SyncLock.isLocked()).toBe(false);
    });

    it('should return true when locked', async () => {
      await SyncLock.acquire();
      expect(SyncLock.isLocked()).toBe(true);
    });

    it('should return false after release', async () => {
      await SyncLock.acquire();
      await SyncLock.release();
      expect(SyncLock.isLocked()).toBe(false);
    });

    it('should return false for expired lock', async () => {
      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);

      await SyncLock.acquire();
      expect(SyncLock.isLocked()).toBe(true);

      // Advance time by 5 minutes + 1 second
      currentTime += (5 * 60 * 1000) + 1000;

      // Should return false for expired lock
      expect(SyncLock.isLocked()).toBe(false);

      // Restore original Date.now
      Date.now = originalNow;
    });
  });

  describe('forceRelease()', () => {
    it('should force release locked state', async () => {
      await SyncLock.acquire();
      expect(SyncLock.isLocked()).toBe(true);

      await SyncLock.forceRelease();
      expect(SyncLock.isLocked()).toBe(false);
    });

    it('should allow reacquiring after force release', async () => {
      await SyncLock.acquire();
      await SyncLock.forceRelease();

      const reacquired = await SyncLock.acquire();
      expect(reacquired).toBe(true);
      expect(SyncLock.isLocked()).toBe(true);
    });

    it('should be safe to call when not locked', async () => {
      expect(SyncLock.isLocked()).toBe(false);
      await expect(SyncLock.forceRelease()).resolves.not.toThrow();
      expect(SyncLock.isLocked()).toBe(false);
    });

    it('should be safe to call multiple times', async () => {
      await SyncLock.acquire();
      await SyncLock.forceRelease();
      await SyncLock.forceRelease();
      await SyncLock.forceRelease();
      expect(SyncLock.isLocked()).toBe(false);
    });
  });

  describe('concurrent sync prevention', () => {
    it('should prevent concurrent sync operations', async () => {
      // Simulate two sync operations trying to run simultaneously
      const sync1Acquired = await SyncLock.acquire();
      expect(sync1Acquired).toBe(true);

      const sync2Acquired = await SyncLock.acquire();
      expect(sync2Acquired).toBe(false);

      // First sync completes
      await SyncLock.release();

      // Second sync can now proceed
      const sync2Retry = await SyncLock.acquire();
      expect(sync2Retry).toBe(true);
    });

    it('should handle error recovery scenario', async () => {
      // Sync operation acquires lock
      await SyncLock.acquire();

      // Simulate error - sync crashes without releasing
      // (no release call)

      // Error recovery uses forceRelease
      await SyncLock.forceRelease();

      // New sync can now proceed
      const newSyncAcquired = await SyncLock.acquire();
      expect(newSyncAcquired).toBe(true);
    });
  });

  describe('timeout behavior', () => {
    it('should log warning when auto-releasing expired lock', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock Date.now to simulate time passing
      const originalNow = Date.now;
      let currentTime = Date.now();
      Date.now = jest.fn(() => currentTime);

      await SyncLock.acquire();

      // Advance time by 5 minutes + 1 second
      currentTime += (5 * 60 * 1000) + 1000;

      // Try to acquire again - should auto-release and log warning
      await SyncLock.acquire();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SyncLock] Lock expired after 5 minutes, auto-releasing'
      );

      // Restore
      Date.now = originalNow;
      consoleWarnSpy.mockRestore();
    });

    it('should log warning when force releasing', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await SyncLock.acquire();
      await SyncLock.forceRelease();

      expect(consoleWarnSpy).toHaveBeenCalledWith('[SyncLock] Force releasing lock');

      consoleWarnSpy.mockRestore();
    });
  });
});
