import { getDatabase } from '@/lib/database';

/**
 * RetryStrategy implements exponential backoff for failed sync operations.
 * Implements requirements 3.2, 3.3, 3.4
 */
export class RetryStrategy {
  // Retry schedule in milliseconds: 10s, 30s, 2m, 10m, 10m
  private static readonly RETRY_DELAYS = [
    10 * 1000,      // 10 seconds
    30 * 1000,      // 30 seconds
    2 * 60 * 1000,  // 2 minutes
    10 * 60 * 1000, // 10 minutes
    10 * 60 * 1000, // 10 minutes (for retry_count >= 4)
  ];

  private static readonly MAX_RETRIES = 10;

  /**
   * Calculate delay before next retry based on retry count
   * Requirement 3.2: Use exponential backoff with specified schedule
   * 
   * @param retryCount - Current retry count (0-based)
   * @returns Delay in milliseconds before next retry
   */
  static getRetryDelay(retryCount: number): number {
    if (retryCount < 0) {
      return 0;
    }

    // For retry_count >= 4, use the last delay (10 minutes)
    const index = Math.min(retryCount, this.RETRY_DELAYS.length - 1);
    return this.RETRY_DELAYS[index];
  }

  /**
   * Check if should retry based on retry count
   * Requirement 3.4: Mark sync_status as "failed" when retry_count reaches 10
   * 
   * @param retryCount - Current retry count
   * @returns True if should retry, false if max retries reached
   */
  static shouldRetry(retryCount: number): boolean {
    return retryCount < this.MAX_RETRIES;
  }

  /**
   * Reset retry count after successful sync
   * Requirement 11.5: Reset retry_count to 0 when sync operation succeeds
   * 
   * @param tableName - Name of the table containing the record
   * @param recordId - ID of the record to reset
   */
  static async resetRetryCount(tableName: string, recordId: string): Promise<void> {
    const db = await getDatabase();
    
    await db.runAsync(
      `UPDATE ${tableName} 
       SET retry_count = 0 
       WHERE id = ?`,
      [recordId]
    );
  }

  /**
   * Get the maximum number of retries allowed
   * 
   * @returns Maximum retry count
   */
  static getMaxRetries(): number {
    return this.MAX_RETRIES;
  }
}
