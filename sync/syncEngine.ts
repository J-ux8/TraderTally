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
    'customers',
    'debts', 
    'transaction_templates', 
    'sales',
    'sale_items',
    'stock_batches',
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
   * Push changes for a single table
   */
  private static async pushTable(table: string): Promise<void> {
    if (!NetworkMonitor.getStatus()) return; // Abort if network lost mid-sync

    const pending = await LocalDB.getPendingSync<any>(table, 50);
    if (pending.length === 0) return;

    console.log(`[SyncEngine] Pushing ${pending.length} changes for ${table}...`);
    
    const ids = pending.map(p => p.id);
    await LocalDB.markSyncing(table, ids);

    // Perform batch upsert to Supabase for efficiency
    try {
      const { error } = await supabase
        .from(table)
        .upsert(pending.map(record => ({
          ...record,
          sync_status: 'synced',
          retry_count: 0
        })));

      if (error) {
        console.log(`[SyncEngine] Batch error pushing ${table}:`, error.message);
        // Fallback to individual pushes for problematic records
        for (const record of pending) {
          try {
            const { error: indError } = await supabase.from(table).upsert({ ...record, sync_status: 'synced', retry_count: 0 });
            if (indError) await LocalDB.markFailed(table, record.id);
            else await LocalDB.markSynced(table, record.id);
          } catch (e) {
            await LocalDB.markFailed(table, record.id);
          }
        }
      } else {
        // Success! Mark all as synced
        for (const id of ids) {
          await LocalDB.markSynced(table, id);
        }
      }
    } catch (e) {
      console.log(`[SyncEngine] Unexpected batch error pushing ${table}:`, e);
      for (const id of ids) await LocalDB.markFailed(table, id);
    }
  }

  /**
   * Push local changes to Supabase
   * Parallelizes independent tables to speed up sync
   */
  private static async push(): Promise<void> {
    // Fully sequential to avoid expo-sqlite v16 concurrency crashes
    await this.pushTable('profiles');
    await this.pushTable('categories');
    await this.pushTable('customers');
    await this.pushTable('transaction_templates');
    await this.pushTable('products');
    await this.pushTable('stock_batches');
    await this.pushTable('sales');
    await this.pushTable('sale_items');
    await this.pushTable('transactions');
    await this.pushTable('debts');
  }

  /**
   * Pull changes for a single table
   */
  private static async pullTable(table: string, lastSyncTime: string | null): Promise<void> {
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
        return;
      }

      if (data && data.length > 0) {
        console.log(`[SyncEngine] Pulling ${data.length} records for ${table}...`);
        await LocalDB.upsertFromServer(table, data);
      }
    } catch (e) {
      console.log(`[SyncEngine] Unexpected error pulling ${table}:`, e);
    }
  }

  /**
   * Pull remote changes from Supabase
   * Parallelizes independent tables to speed up sync
   */
  private static async pull(): Promise<void> {
    const lastSyncTime = await LocalDB.getLastSyncTime();
    const now = new Date().toISOString();

    // Fully sequential to avoid expo-sqlite v16 concurrency crashes
    await this.pullTable('profiles', lastSyncTime);
    await this.pullTable('categories', lastSyncTime);
    await this.pullTable('customers', lastSyncTime);
    await this.pullTable('transaction_templates', lastSyncTime);
    await this.pullTable('products', lastSyncTime);
    await this.pullTable('stock_batches', lastSyncTime);
    await this.pullTable('sales', lastSyncTime);
    await this.pullTable('sale_items', lastSyncTime);
    await this.pullTable('transactions', lastSyncTime);
    await this.pullTable('debts', lastSyncTime);

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
