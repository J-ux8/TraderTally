import { supabase } from '../lib/supabase';
import { LocalDB, SyncStatus } from '../database/localDb';
import { NetworkMonitor } from './NetworkMonitor';

console.log('>>> [SYNC] ENGINE LOADED - STACK VERSION: 5.0 <<<');

/**
 * Sync Engine
 * 
 * Orchestrates data synchronization between Local SQLite and Supabase
 */
export class SyncEngine {
  private static isSyncing: boolean = false;
  private static syncTables = [
    'profiles', 
    'categories', 
    'products', 
    'debts', 
    'customers', 
    'transaction_templates', 
    'sales', 
    'sale_items', 
    'transactions'
  ];

  /**
   * Main sync orchestration
   */
  static async syncAll(): Promise<boolean> {
    // 1. Acquire global lock
    if (this.isSyncing) {
      return false;
    }
    
    // 2. Check online status
    if (!NetworkMonitor.getStatus()) {
      return false;
    }

    // 2.5 Check authentication
    const userId = await LocalDB.getUserId();
    if (!userId) {
      return false;
    }

    try {
      this.isSyncing = true;
      console.log('[SyncEngine] Starting sync process...');

      // 3. Recovery: reset 'syncing' records from previous session
      await LocalDB.recoverSyncStatus();

      // 4. Push local changes (Write-Ahead)
      await this.push();

      // 5. Pull remote changes
      await this.pull();

      console.log('[SyncEngine] Sync completed successfully');
      return true;
      
      // Notify listeners (will be handled by context)
    } catch (error) {
      console.error('[SyncEngine] Sync failed:', error);
      throw error;
    } finally {
      // 6. Release lock
      this.isSyncing = false;
    }
  }

  /**
   * Push local changes to Supabase
   * LIMIT 50 per table per cycle
   */
  private static async push(): Promise<void> {
    for (const table of this.syncTables) {
      if (!NetworkMonitor.getStatus()) return; // Abort if network lost mid-sync

      const pending = await LocalDB.getPendingSync<any>(table, 50);
      if (pending.length === 0) continue;

      console.log(`[SyncEngine] Pushing ${pending.length} changes for ${table}...`);
      
      const ids = pending.map(p => p.id);
      await LocalDB.markSyncing(table, ids);

      for (const record of pending) {
        try {
          // Conflict resolution: Latest update at wins on server too.
          // Upsert handles both new records and updates.
          const { error } = await supabase
            .from(table)
            .upsert({
              ...record,
              sync_status: 'synced', // Mark as synced on server
              retry_count: 0
            });

          if (error) {
            console.log(`[SyncEngine] Error pushing record ${record.id} in ${table}:`, error.message);
            await LocalDB.markFailed(table, record.id);
          } else {
            await LocalDB.markSynced(table, record.id);
          }
        } catch (e) {
          console.log(`[SyncEngine] Unexpected error pushing record ${record.id}:`, e);
          await LocalDB.markFailed(table, record.id);
        }
      }
    }
  }

  /**
   * Pull remote changes from Supabase
   */
  private static async pull(): Promise<void> {
    const lastSyncTime = await LocalDB.getLastSyncTime();
    const now = new Date().toISOString();

    for (const table of this.syncTables) {
      if (!NetworkMonitor.getStatus()) return; // Abort if network lost mid-sync
      try {
        let query = supabase
          .from(table)
          .select('*');

        if (lastSyncTime) {
          // Fetch only records updated since last sync
          query = query.gt('updated_at', lastSyncTime);
        }

        const { data, error } = await query;

        if (error) {
          console.log(`[SyncEngine] Error pulling data for ${table}:`, error.message);
          continue;
        }

        if (data && data.length > 0) {
          console.log(`[SyncEngine] Pulling ${data.length} records for ${table}...`);
          await LocalDB.upsertFromServer(table, data);
        }
      } catch (e) {
        console.log(`[SyncEngine] Unexpected error pulling ${table}:`, e);
      }
    }

    // Update last sync time on success
    await LocalDB.updateLastSyncTime(now);
  }

  /**
   * Get current sync status
   */
  static getProcessingStatus(): boolean {
    return this.isSyncing;
  }
}
