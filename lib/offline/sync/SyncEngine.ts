import { supabase } from '@/lib/supabase';
import { getDatabase } from '@/lib/database';
import { ConflictResolver } from './ConflictResolver';
import { SyncQueue } from './SyncQueue';
import { SyncLock } from './SyncLock';
import { SyncLogger, SyncResult } from './SyncLogger';
import { networkMonitor } from './NetworkMonitor';
import { notifyRLSIssueOnce } from '@/lib/rls-notification';

export class SyncEngine {
    private userId: string;
    private static readonly SYNC_TABLES = ['categories', 'transactions', 'debts'];

    constructor(userId: string) {
        this.userId = userId;
    }

    /**
     * Main sync orchestration method
     * Implements Task 3.1: sync() orchestration with mutex lock, upload/download phases, and error handling
     * Requirements: 1.2, 9.5, 17.1
     */
    async sync(): Promise<SyncResult> {
        const startTime = Date.now();
        let logId: string | null = null;

        // Requirement 9.5: Acquire mutex lock at start (fail fast if locked)
        const lockAcquired = await SyncLock.acquire();
        if (!lockAcquired) {
            console.log('[SyncEngine] Sync already in progress, skipping');
            return {
                success: false,
                uploadedCount: 0,
                downloadedCount: 0,
                conflictsResolved: 0,
                errors: [{ recordId: 'sync', error: 'Sync already in progress' }],
                duration: Date.now() - startTime,
            };
        }

        try {
            // Initialize device_id in sync_metadata if not exists
            const db = await getDatabase();
            const { getOrCreateDeviceId } = await import('@/database/device-id');
            await getOrCreateDeviceId(db, this.userId);

            // Check network connectivity before attempting sync
            const isOnline = await networkMonitor.isOnline();
            if (!isOnline) {
                console.log('[SyncEngine] Offline - skipping sync');
                // Requirement 3.1: Mark pending records as 'offline' when no connectivity
                await SyncQueue.markAsOffline(this.userId);
                return {
                    success: false,
                    uploadedCount: 0,
                    downloadedCount: 0,
                    conflictsResolved: 0,
                    errors: [{ recordId: 'sync', error: 'Device is offline' }],
                    duration: Date.now() - startTime,
                };
            }

            // Requirement 12.2: Log sync operation start
            logId = await SyncLogger.logSyncStart();
            console.log('[SyncEngine] Starting sync for user:', this.userId);

            let totalUploaded = 0;
            let totalDownloaded = 0;
            let totalConflicts = 0;
            const allErrors: Array<{ recordId: string; error: string }> = [];

            // Requirement 1.2: Upload phase - push local changes to cloud
            console.log('[SyncEngine] Starting upload phase');
            for (const tableName of SyncEngine.SYNC_TABLES) {
                const uploadResult = await this.uploadPendingRecords(tableName);
                totalUploaded += uploadResult.uploadedCount;
                allErrors.push(...uploadResult.errors);
            }

            // Download phase - pull cloud changes and merge
            console.log('[SyncEngine] Starting download phase');
            for (const tableName of SyncEngine.SYNC_TABLES) {
                const downloadResult = await this.downloadServerUpdates(tableName);
                totalDownloaded += downloadResult.downloadedCount;
                totalConflicts += downloadResult.conflictsResolved;
            }

            // Update sync_metadata.last_sync_time after successful completion
            const now = new Date().toISOString();
            await db.runAsync(
                `INSERT INTO sync_metadata (user_id, last_sync_time, last_push_time, device_id) 
                 VALUES (?, ?, ?, COALESCE((SELECT device_id FROM sync_metadata WHERE user_id = ?), 'unknown'))
                 ON CONFLICT(user_id) DO UPDATE SET 
                   last_sync_time = EXCLUDED.last_sync_time,
                   last_push_time = EXCLUDED.last_push_time`,
                [this.userId, now, now, this.userId]
            );

            const result: SyncResult = {
                success: allErrors.length === 0,
                uploadedCount: totalUploaded,
                downloadedCount: totalDownloaded,
                conflictsResolved: totalConflicts,
                errors: allErrors,
                duration: Date.now() - startTime,
            };

            // Requirement 12.3: Log sync completion
            if (logId) {
                await SyncLogger.logSyncComplete(logId, result);
            }

            console.log('[SyncEngine] Sync completed:', {
                uploaded: totalUploaded,
                downloaded: totalDownloaded,
                conflicts: totalConflicts,
                errors: allErrors.length,
                duration: result.duration,
            });

            return result;
        } catch (error) {
            // Requirement 12.4: Log sync error
            console.error('[SyncEngine] Sync failed:', error);
            if (logId) {
                await SyncLogger.logSyncError(logId, error as Error);
            }

            return {
                success: false,
                uploadedCount: 0,
                downloadedCount: 0,
                conflictsResolved: 0,
                errors: [{ recordId: 'sync', error: (error as Error).message }],
                duration: Date.now() - startTime,
            };
        } finally {
            // Requirement 9.5: Release mutex lock in finally block
            await SyncLock.release();
        }
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use sync() instead
     */
    static async executeFullSync(userId: string) {
        const engine = new SyncEngine(userId);
        await engine.sync();
    }

    /**
     * Download and merge server updates for a specific table
     * Implements Task 3.3: downloadServerUpdates() with incremental sync
     * Requirements: 4.2, 4.3, 4.5, 6.5
     */
    private async downloadServerUpdates(tableName: string): Promise<{
        downloadedCount: number;
        conflictsResolved: number;
    }> {
        try {
            const db = await getDatabase();
            const metadata = await db.getFirstAsync(
                'SELECT last_sync_time FROM sync_metadata WHERE user_id = ?',
                [this.userId]
            ) as { last_sync_time: string } | null;

            let query = supabase.from(tableName).select('*').eq('user_id', this.userId);

            // INCREMENTAL SYNC: Only pull what changed since last time
            if (metadata?.last_sync_time) {
                query = query.gt('updated_at', metadata.last_sync_time);
            }

            // Requirement 6.5: Fetch in batches of 50 records
            query = query.order('updated_at', { ascending: true }).limit(50);

            const { data: serverRecords, error } = await query;

            if (error) {
                console.error(`[SyncEngine] Download failed for ${tableName}:`, error);
                return { downloadedCount: 0, conflictsResolved: 0 };
            }

            if (!serverRecords || serverRecords.length === 0) {
                return { downloadedCount: 0, conflictsResolved: 0 };
            }

            let downloadedCount = 0;
            let conflictsResolved = 0;

            for (const serverItem of serverRecords) {
                const localItem = await db.getFirstAsync(
                    `SELECT * FROM ${tableName} WHERE id = ?`,
                    [serverItem.id]
                ) as any;

                if (!localItem) {
                    // Requirement 4.2: New record from server - insert with sync_status = 'synced'
                    await this.applyServerRecord(db, tableName, serverItem);
                    downloadedCount++;
                    continue;
                }

                // Check if local record has pending changes
                if (localItem.sync_status === 'synced') {
                    // No conflict - server update for synced record
                    await this.applyServerRecord(db, tableName, serverItem);
                    downloadedCount++;
                } else {
                    // Requirement 4.3, 4.5: Conflict detected - resolve using ConflictResolver
                    const decision = ConflictResolver.resolveUpdateConflict(localItem, serverItem);

                    if (decision === 'ACCEPT_SERVER') {
                        await this.applyServerRecord(db, tableName, serverItem);
                        conflictsResolved++;
                        
                        // Requirement 12.5: Log conflict resolution with both versions for debugging
                        await SyncLogger.logConflict(serverItem.id, {
                            winner: 'server',
                            record: serverItem,
                            reason: 'Server version is newer',
                        }, localItem, serverItem);
                    } else {
                        conflictsResolved++;
                        
                        // Log that local version won with both versions for debugging
                        await SyncLogger.logConflict(localItem.id, {
                            winner: 'local',
                            record: localItem,
                            reason: 'Local version is newer',
                        }, localItem, serverItem);
                    }
                }
            }

            return { downloadedCount, conflictsResolved };
        } catch (networkError) {
            console.log('[SyncEngine] Network error during download phase:', networkError);
            return { downloadedCount: 0, conflictsResolved: 0 };
        }
    }

    private static readonly TABLE_COLUMNS: Record<string, string[]> = {
        categories: ['id', 'user_id', 'name', 'normalized_name', 'created_at', 'updated_at', 'is_deleted'],
        transactions: ['id', 'user_id', 'amount', 'category', 'description', 'transaction_date', 'created_at', 'updated_at', 'is_deleted'],
        debts: ['id', 'user_id', 'customer_name', 'amount', 'due_date', 'note', 'is_settled', 'created_at', 'updated_at', 'is_deleted']
    };

    /**
     * Upload pending records for a specific table
     * Implements Task 3.2: uploadPendingRecords() with batching
     * Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 8.3, 8.4
     */
    private async uploadPendingRecords(tableName: string): Promise<{
        uploadedCount: number;
        errors: Array<{ recordId: string; error: string }>;
    }> {
        try {
            const allowedColumns = SyncEngine.TABLE_COLUMNS[tableName];
            let totalUploaded = 0;
            const allErrors: Array<{ recordId: string; error: string }> = [];
            let hasMore = true;

            while (hasMore) {
                // Requirement 6.1: Use SyncQueue to get next batch of pending records (max 50)
                const batch = await SyncQueue.getNextBatch(tableName, this.userId);

                if (batch.length === 0) {
                    hasMore = false;
                    break;
                }

                // Requirement 8.3: Mark records as syncing before upload
                const recordIds = batch.map(r => r.id);
                await SyncQueue.markAsSyncing(tableName, recordIds);

                // Prepare payload with only allowed columns
                const payload = batch.map(record => {
                    const cleanRecord: any = {};
                    allowedColumns.forEach(col => {
                        if (record.data[col] !== undefined) {
                            cleanRecord[col] = record.data[col];
                        }
                    });
                    return cleanRecord;
                });

                // Requirement 2.1, 2.2: Perform batch upsert to Supabase with onConflict: 'id'
                const { error } = await supabase.from(tableName).upsert(payload, {
                    onConflict: 'id',
                });

                if (error) {
                    // Check if it's an RLS error (code 42501)
                    if (error.code === '42501') {
                        console.log(`[SyncEngine] RLS policy error on ${tableName} - data saved locally, will retry when policies are fixed`);
                        // Notify user once about the setup requirement
                        notifyRLSIssueOnce();
                        // Requirement 8.4: Mark records as failed for retry
                        await SyncQueue.markAsFailed(tableName, recordIds, 'RLS policy error');
                        
                        recordIds.forEach(id => {
                            allErrors.push({ recordId: id, error: 'RLS policy error' });
                        });
                        return { uploadedCount: totalUploaded, errors: allErrors };
                    }
                    
                    console.error(`[SyncEngine] Upload failed on ${tableName}. Supabase Error Details:`, {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code
                    });
                    
                    // Requirement 6.3: On batch failure, retry individual records
                    const retryResult = await this.retryIndividualRecords(batch, tableName, allowedColumns);
                    totalUploaded += retryResult.uploadedCount;
                    allErrors.push(...retryResult.errors);
                    continue;
                }

                // Requirement 8.4: Mark records as synced on success
                await SyncQueue.markAsSynced(tableName, recordIds);
                totalUploaded += batch.length;
            }

            return { uploadedCount: totalUploaded, errors: allErrors };
        } catch (networkError: any) {
            console.log('[SyncEngine] Network error during upload phase:', networkError);
            return { uploadedCount: 0, errors: [{ recordId: tableName, error: networkError.message }] };
        }
    }

    /**
     * Retry individual records when batch upload fails
     * Requirement 6.3: Retry individual records on batch failure
     */
    private async retryIndividualRecords(
        batch: Array<{ id: string; data: any }>,
        tableName: string,
        allowedColumns: string[]
    ): Promise<{
        uploadedCount: number;
        errors: Array<{ recordId: string; error: string }>;
    }> {
        let uploadedCount = 0;
        const errors: Array<{ recordId: string; error: string }> = [];

        for (const record of batch) {
            try {
                const cleanRecord: any = {};
                allowedColumns.forEach(col => {
                    if (record.data[col] !== undefined) {
                        cleanRecord[col] = record.data[col];
                    }
                });

                const { error } = await supabase.from(tableName).upsert(cleanRecord, {
                    onConflict: 'id',
                });

                if (error) throw error;

                // Success - mark as synced
                await SyncQueue.markAsSynced(tableName, [record.id]);
                uploadedCount++;
            } catch (error: any) {
                // Failure - mark as failed and increment retry_count
                await SyncQueue.markAsFailed(tableName, [record.id], error.message);
                errors.push({ recordId: record.id, error: error.message });
            }
        }

        return { uploadedCount, errors };
    }

    /**
     * Apply server record to local database
     * Inserts new record or updates existing record with sync_status = 'synced'
     */
    private async applyServerRecord(db: any, tableName: string, record: any): Promise<void> {
        const allowedColumns = SyncEngine.TABLE_COLUMNS[tableName];
        if (!allowedColumns) return;

        const validData: any = {};
        allowedColumns.forEach(col => {
            if (record[col] !== undefined) {
                validData[col] = record[col];
            }
        });

        const columns = Object.keys(validData);
        if (columns.length === 0) return;

        const placeholders = columns.map(() => '?').join(',');
        const values = Object.values(validData);

        const setClause = columns.map(col => `${col} = ?`).join(',');

        await db.runAsync(`
            INSERT INTO ${tableName} (${columns.join(',')}, sync_status) 
            VALUES (${placeholders}, 'synced')
            ON CONFLICT(id) DO UPDATE SET ${setClause}, sync_status = 'synced'
        `, [...values, ...values]);
    }

    /**
     * Check if sync is currently running
     * @returns True if sync is in progress
     */
    isSyncing(): boolean {
        return SyncLock.isLocked();
    }

    /**
     * Get current sync status
     * @returns Sync status: 'idle', 'syncing', or 'error'
     */
    getStatus(): 'idle' | 'syncing' | 'error' {
        return SyncLock.isLocked() ? 'syncing' : 'idle';
    }
}
