/**
 * SyncLock ensures only one sync process runs at a time using mutex pattern.
 * Implements requirement 9.5: Prevent concurrent synchronization cycles using a mutex lock
 */
export class SyncLock {
  private static locked: boolean = false;
  private static lockTimestamp: number | null = null;
  private static readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Acquire the sync lock
   * Returns true if lock was acquired, false if already locked
   * Requirement 9.5: Prevent concurrent synchronization cycles
   */
  static async acquire(): Promise<boolean> {
    // Check if lock has expired
    if (this.locked && this.lockTimestamp) {
      const now = Date.now();
      const elapsed = now - this.lockTimestamp;
      
      if (elapsed >= this.LOCK_TIMEOUT_MS) {
        // Auto-release expired lock to prevent deadlock
        console.warn('[SyncLock] Lock expired after 5 minutes, auto-releasing');
        await this.forceRelease();
      }
    }

    // Try to acquire lock
    if (this.locked) {
      return false;
    }

    this.locked = true;
    this.lockTimestamp = Date.now();
    return true;
  }

  /**
   * Release the sync lock
   * Requirement 9.5: Allow sync process to release lock after completion
   */
  static async release(): Promise<void> {
    this.locked = false;
    this.lockTimestamp = null;
  }

  /**
   * Check if sync lock is currently held
   * Requirement 9.5: Allow checking lock status
   */
  static isLocked(): boolean {
    // Check if lock has expired
    if (this.locked && this.lockTimestamp) {
      const now = Date.now();
      const elapsed = now - this.lockTimestamp;
      
      if (elapsed >= this.LOCK_TIMEOUT_MS) {
        // Lock has expired but hasn't been released yet
        return false;
      }
    }

    return this.locked;
  }

  /**
   * Force release the lock for error recovery
   * Requirement 9.5: Provide mechanism to recover from stuck locks
   */
  static async forceRelease(): Promise<void> {
    if (this.locked) {
      console.warn('[SyncLock] Force releasing lock');
    }
    this.locked = false;
    this.lockTimestamp = null;
  }
}
