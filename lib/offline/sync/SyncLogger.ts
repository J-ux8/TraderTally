import { getDatabase } from '@/lib/database';

export interface SyncLog {
  id: string;
  timestamp: string;
  operation: 'sync_start' | 'sync_complete' | 'sync_error' | 'conflict';
  record_type?: string;
  record_id?: string;
  status: 'success' | 'error';
  error_message?: string;
  device_id: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  uploadedCount: number;
  downloadedCount: number;
  conflictsResolved: number;
  errors: Array<{ recordId: string; error: string }>;
  duration: number;
}

export interface ResolvedRecord {
  winner: 'local' | 'server';
  record: any;
  reason: string;
}

/**
 * SyncLogger provides observability and debugging capabilities for the sync system.
 * Implements requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.7
 */
export class SyncLogger {
  /**
   * Get device ID from sync_metadata or return empty string
   * This is a helper to avoid requiring userId for logging operations
   */
  private static async getDeviceIdSafe(): Promise<string> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync(
        'SELECT device_id FROM sync_metadata LIMIT 1'
      ) as { device_id: string } | null;
      return result?.device_id || 'unknown-device';
    } catch {
      return 'unknown-device';
    }
  }

  /**
   * Log sync operation start
   * Requirement 12.2: Log operation start when sync cycle begins
   * 
   * @returns Log ID for tracking this sync operation
   */
  static async logSyncStart(): Promise<string> {
    const db = await getDatabase();
    const deviceId = await this.getDeviceIdSafe();
    const logId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO sync_logs (id, timestamp, operation, status, device_id, user_id, table_name, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, timestamp, 'sync_start', 'success', deviceId, '', '', '']
    );

    return logId;
  }

  /**
   * Log sync operation completion
   * Requirement 12.3: Log success with record details when upload succeeds
   * 
   * @param logId - ID from logSyncStart
   * @param result - Sync operation result
   */
  static async logSyncComplete(logId: string, result: SyncResult): Promise<void> {
    const db = await getDatabase();
    const deviceId = await this.getDeviceIdSafe();
    const timestamp = new Date().toISOString();
    
    const completeLogId = `${logId}-complete`;
    const metadata = JSON.stringify({
      uploadedCount: result.uploadedCount,
      downloadedCount: result.downloadedCount,
      conflictsResolved: result.conflictsResolved,
      duration_ms: result.duration,
    });

    await db.runAsync(
      `INSERT INTO sync_logs (id, timestamp, operation, status, device_id, user_id, table_name, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [completeLogId, timestamp, 'sync_complete', 'success', deviceId, '', '', metadata]
    );
  }

  /**
   * Log sync error
   * Requirement 12.4: Log failure with error message when upload fails
   * 
   * @param logId - ID from logSyncStart
   * @param error - Error that occurred
   */
  static async logSyncError(logId: string, error: Error): Promise<void> {
    const db = await getDatabase();
    const deviceId = await this.getDeviceIdSafe();
    const timestamp = new Date().toISOString();
    
    const errorLogId = `${logId}-error`;
    const errorMessage = error.message || 'Unknown error';

    await db.runAsync(
      `INSERT INTO sync_logs (id, timestamp, operation, status, device_id, user_id, table_name, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [errorLogId, timestamp, 'sync_error', 'error', deviceId, '', '', errorMessage]
    );
  }

  /**
   * Log conflict resolution
   * Requirement 12.5: Log conflict resolution decision
   * 
   * @param recordId - ID of the conflicted record
   * @param resolution - Resolution details
   * @param localVersion - Local version of the record for debugging
   * @param serverVersion - Server version of the record for debugging
   */
  static async logConflict(
    recordId: string, 
    resolution: ResolvedRecord,
    localVersion?: any,
    serverVersion?: any
  ): Promise<void> {
    const db = await getDatabase();
    const deviceId = await this.getDeviceIdSafe();
    const timestamp = new Date().toISOString();
    
    const logId = `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const metadata = JSON.stringify({
      winner: resolution.winner,
      reason: resolution.reason,
      recordId: recordId,
      localVersion: localVersion || null,
      serverVersion: serverVersion || null,
    });

    await db.runAsync(
      `INSERT INTO sync_logs (id, timestamp, operation, status, device_id, user_id, table_name, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [logId, timestamp, 'conflict', 'success', deviceId, '', '', metadata]
    );
  }

  /**
   * Get recent logs for debugging
   * Requirement 12.7: Provide method to export sync log entries
   * 
   * @param limit - Maximum number of logs to retrieve
   * @returns Array of sync logs
   */
  static async getRecentLogs(limit: number = 100): Promise<SyncLog[]> {
    const db = await getDatabase();
    
    const rows = await db.getAllAsync(
      `SELECT id, timestamp, operation, status, device_id, user_id as record_type, 
              table_name as record_id, error_message
       FROM sync_logs
       ORDER BY timestamp DESC
       LIMIT ?`,
      [limit]
    ) as any[];

    return rows.map(row => {
      let metadata: Record<string, any> | undefined;
      let duration_ms: number | undefined;
      
      // Parse metadata from error_message field if it's JSON
      if (row.error_message && row.error_message.startsWith('{')) {
        try {
          metadata = JSON.parse(row.error_message);
          if (metadata) {
            duration_ms = metadata.duration_ms;
          }
        } catch {
          // Not JSON, treat as error message
        }
      }

      return {
        id: row.id,
        timestamp: row.timestamp,
        operation: row.operation as SyncLog['operation'],
        record_type: row.record_type || undefined,
        record_id: row.record_id || undefined,
        status: row.status as 'success' | 'error',
        error_message: metadata ? undefined : (row.error_message || undefined),
        device_id: row.device_id,
        duration_ms,
        metadata,
      };
    });
  }

  /**
   * Export logs for debugging
   * Requirement 12.7: Provide method to export sync log entries for debugging
   * 
   * @returns JSON string of all logs
   */
  static async exportLogs(): Promise<string> {
    const logs = await this.getRecentLogs(1000);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Clean up old logs (older than 30 days)
   * Requirement 12.6: Retain sync log entries for 30 days
   */
  static async cleanupOldLogs(): Promise<void> {
    const db = await getDatabase();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    await db.runAsync(
      `DELETE FROM sync_logs WHERE timestamp < ?`,
      [cutoffDate]
    );
  }
}
