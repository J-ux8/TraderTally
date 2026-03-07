import { supabase } from '@/lib/supabase';
import { getDatabase } from '@/lib/database';
import { ConflictResolver } from './ConflictResolver';
import NetInfo from '@react-native-community/netinfo';

export class SyncEngine {
    private static isSyncing = false;
    private static BATCH_SIZE = 100;

    /**
     * Executes the strict deterministic offline-first sync process.
     */
    static async executeFullSync(userId: string) {
        if (this.isSyncing) return;
        
        // Check network connectivity first
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
            console.log('[SyncEngine] Offline - skipping sync');
            return;
        }
        
        this.isSyncing = true;
        console.log('[SyncEngine] Starting full sync for user:', userId);

        try {
            // Priority 1: Push local changes to establish user intent in the cloud
            await this.pushTable(userId, 'categories');
            await this.pushTable(userId, 'transactions');
            await this.pushTable(userId, 'debts');

            // Priority 2: Pull cloud changes to sync with other devices
            await this.pullPhase(userId, 'categories');
            await this.pullPhase(userId, 'transactions');
            await this.pullPhase(userId, 'debts');

            // Update metadata after successful full pass
            const db = await getDatabase();
            const now = new Date().toISOString();
            await db.runAsync(
                `INSERT INTO sync_metadata (user_id, last_sync_time) VALUES (?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET last_sync_time = EXCLUDED.last_sync_time`,
                [userId, now]
            );

            console.log('[SyncEngine] Sync completed successfully.');
        } catch (error) {
            console.error('[SyncEngine] Critical sync failure:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    private static async pullPhase(userId: string, tableName: string) {
        try {
            const db = await getDatabase();
            const metadata = await db.getFirstAsync(
                'SELECT last_sync_time FROM sync_metadata WHERE user_id = ?',
                [userId]
            ) as { last_sync_time: string } | null;

            let query = supabase.from(tableName).select('*').eq('user_id', userId);

            // INCREMENTAL SYNC: Only pull what changed since last time
            if (metadata?.last_sync_time) {
                query = query.gt('updated_at', metadata.last_sync_time);
            }

            const { data: serverRecords, error } = await query;

            if (error) {
                console.error(`[SyncEngine] Pull failed for ${tableName}:`, error);
                return;
            }

            if (!serverRecords || serverRecords.length === 0) return;

            for (const serverItem of serverRecords) {
                const localItem = await db.getFirstAsync(
                    `SELECT * FROM ${tableName} WHERE id = ?`,
                    [serverItem.id]
                ) as any;

                if (!localItem) {
                    // New item from server
                    await this.applyServerRecord(db, tableName, serverItem);
                    continue;
                }

                // Conflict detected: Resolve using ConflictResolver
                const decision = ConflictResolver.resolveUpdateConflict(localItem, serverItem);

                if (decision === 'ACCEPT_SERVER') {
                    await this.applyServerRecord(db, tableName, serverItem);
                }
            }
        } catch (networkError) {
            console.log('[SyncEngine] Network error during pull phase:', networkError);
            return;
        }
    }

    private static readonly TABLE_COLUMNS: Record<string, string[]> = {
        categories: ['id', 'user_id', 'name', 'normalized_name', 'created_at', 'updated_at', 'deleted'],
        transactions: ['id', 'user_id', 'amount', 'category', 'description', 'transaction_date', 'created_at', 'updated_at', 'deleted'],
        debts: ['id', 'user_id', 'customer_name', 'amount', 'due_date', 'note', 'is_settled', 'created_at', 'updated_at', 'deleted']
    };

    private static async pushTable(userId: string, tableName: string) {
        try {
            const db = await getDatabase();
            let offset = 0;
            let hasMore = true;
            const allowedColumns = this.TABLE_COLUMNS[tableName];

            while (hasMore) {
                const records = await db.getAllAsync(
                    `SELECT * FROM ${tableName} WHERE sync_status = 'pending' AND user_id = ? LIMIT ? OFFSET ?`,
                    [userId, this.BATCH_SIZE, offset]
                );

                if (records.length === 0) {
                    hasMore = false;
                    break;
                }

                const payload = records.map((r: any) => {
                    const cleanRecord: any = {};
                    allowedColumns.forEach(col => {
                        if (r[col] !== undefined) cleanRecord[col] = r[col];
                    });
                    return cleanRecord;
                });

                const { error } = await supabase.from(tableName).upsert(payload, {
                    onConflict: 'id',
                });

                if (error) {
                    console.error(`[SyncEngine] Push failed on ${tableName}. Supabase Error Details:`, {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code
                    });
                    throw new Error(`Sync Push Aborted on ${tableName}: ${error.message}`);
                }

                const ids = records.map((r: any) => r.id);
                const placeholders = ids.map(() => '?').join(',');
                await db.runAsync(`UPDATE ${tableName} SET sync_status = 'synced' WHERE id IN (${placeholders})`, ids);

                offset += this.BATCH_SIZE;
            }
        } catch (networkError) {
            console.log('[SyncEngine] Network error during push phase:', networkError);
            return;
        }
    }

    private static async applyServerRecord(db: any, tableName: string, record: any) {
        const allowedColumns = this.TABLE_COLUMNS[tableName];
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
}
