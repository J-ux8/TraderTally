import { getDatabase } from '@/lib/database';

export interface SyncRecord {
  id: string;
  user_id: string;
  table_name: string;
  sync_status: 'pending' | 'syncing' | 'synced' | 'failed' | 'offline';
  sync_version: number;
  retry_count: number;
  updated_at: string;
  data: Record<string, any>;
}

/**
 * SyncQueue manages batching and ordering of records for upload.
 * Implements requirements 6.1, 6.2, 6.4, 8.2, 8.3, 8.4
 */
export class SyncQueue {
  private static readonly BATCH_SIZE = 50;

  /**
   * Get next batch of pending records (max 50) ordered by updated_at
   * Requirement 6.1: Group records into batches of 50 records
   * Requirement 6.4: Prioritize records by updated_at timestamp, oldest first
   */
  static async getNextBatch(tableName: string, userId: string): Promise<SyncRecord[]> {
    const db = await getDatabase();
    
    const records = await db.getAllAsync(
      `SELECT * FROM ${tableName} 
       WHERE (sync_status = 'pending' OR sync_status = 'failed') 
       AND user_id = ? 
       ORDER BY updated_at ASC 
       LIMIT ?`,
      [userId, this.BATCH_SIZE]
    ) as any[];

    return records.map(record => ({
      id: record.id,
      user_id: record.user_id,
      table_name: tableName,
      sync_status: record.sync_status,
      sync_version: record.sync_version,
      retry_count: record.retry_count,
      updated_at: record.updated_at,
      data: record
    }));
  }

  /**
   * Mark records as syncing
   * Requirement 8.3: Set sync_status to "syncing" when upload begins
   */
  static async markAsSyncing(tableName: string, recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;

    const db = await getDatabase();
    const placeholders = recordIds.map(() => '?').join(',');
    
    await db.runAsync(
      `UPDATE ${tableName} 
       SET sync_status = 'syncing' 
       WHERE id IN (${placeholders})`,
      recordIds
    );
  }

  /**
   * Mark records as synced and reset retry_count
   * Requirement 8.4: Set sync_status to "synced" when upload completes successfully
   */
  static async markAsSynced(tableName: string, recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) return;

    const db = await getDatabase();
    const placeholders = recordIds.map(() => '?').join(',');
    
    await db.runAsync(
      `UPDATE ${tableName} 
       SET sync_status = 'synced', retry_count = 0 
       WHERE id IN (${placeholders})`,
      recordIds
    );
  }

  /**
   * Mark records as failed and increment retry_count
   * Requirement 8.2: Set sync_status to "pending" for retry or "failed" after max retries
   */
  static async markAsFailed(tableName: string, recordIds: string[], error: string): Promise<void> {
    if (recordIds.length === 0) return;

    const db = await getDatabase();
    
    // Increment retry_count and set status to 'failed' if retry_count >= 10
    for (const recordId of recordIds) {
      const record = await db.getFirstAsync(
        `SELECT retry_count FROM ${tableName} WHERE id = ?`,
        [recordId]
      ) as { retry_count: number } | null;

      if (!record) continue;

      const newRetryCount = record.retry_count + 1;
      const newStatus = newRetryCount >= 10 ? 'failed' : 'pending';

      await db.runAsync(
        `UPDATE ${tableName} 
         SET sync_status = ?, retry_count = ? 
         WHERE id = ?`,
        [newStatus, newRetryCount, recordId]
      );
    }

    // Log the error to sync_logs
    const timestamp = new Date().toISOString();
    for (const recordId of recordIds) {
      const logId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await db.runAsync(
        `INSERT INTO sync_logs (id, user_id, table_name, error_message, timestamp) 
         VALUES (?, ?, ?, ?, ?)`,
        [logId, '', tableName, error, timestamp]
      );
    }
  }

  /**
   * Get count of pending records for UI status indicators
   * Requirement 8.2: Track sync_status for each record
   */
  static async getPendingCount(userId: string): Promise<number> {
    const db = await getDatabase();
    
    const tables = ['transactions', 'categories', 'debts'];
    let totalCount = 0;

    for (const table of tables) {
      const result = await db.getFirstAsync(
        `SELECT COUNT(*) as count FROM ${table} 
         WHERE (sync_status = 'pending' OR sync_status = 'failed' OR sync_status = 'syncing') 
         AND user_id = ?`,
        [userId]
      ) as { count: number } | null;

      if (result) {
        totalCount += result.count;
      }
    }

    return totalCount;
  }

  /**
   * Mark records as offline when no network connectivity
   * Requirement 8.6: Set sync_status to "offline" for pending records when no connectivity
   */
  static async markAsOffline(userId: string): Promise<void> {
    const db = await getDatabase();
    const tables = ['transactions', 'categories', 'debts'];

    for (const table of tables) {
      await db.runAsync(
        `UPDATE ${table} 
         SET sync_status = 'offline' 
         WHERE sync_status = 'pending' AND user_id = ?`,
        [userId]
      );
    }
  }

  /**
   * Mark offline records as pending when network reconnects
   * Requirement 3.5: Trigger synchronization when network reconnects
   */
  static async markOfflineAsPending(userId: string): Promise<void> {
    const db = await getDatabase();
    const tables = ['transactions', 'categories', 'debts'];

    for (const table of tables) {
      await db.runAsync(
        `UPDATE ${table} 
         SET sync_status = 'pending' 
         WHERE sync_status = 'offline' AND user_id = ?`,
        [userId]
      );
    }
  }
}
