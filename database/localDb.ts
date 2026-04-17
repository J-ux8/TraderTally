import { getDatabase } from '../lib/database';
import { supabase } from '../lib/supabase';
import { NetworkMonitor } from '../sync/NetworkMonitor';
import * as Crypto from 'expo-crypto';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface LocalBaseModel {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  sync_status: SyncStatus;
  retry_count: number;
}

/**
 * Local Database access layer
 */
export class LocalDB {
  /**
   * Get current authenticated user ID
   */
  public static async getUserId(): Promise<string | null> {
    try {
      // getSession() checks local storage first and doesn't require network
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) return session.user.id;

      // Only fallback to getUser() if online and we have no session
      if (NetworkMonitor.getStatus()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) return user.id;
      }
    } catch (e) {
      console.log('[LocalDB] Auth check failed:', e);
    }

    return null;
  }

  /**
   * Safe value mapper for SQLite (converts undefined to null)
   */
  private static mapValues(values: any[]): any[] {
    return values.map(v => (v === undefined ? null : v));
  }

  /**
   * Generic Create
   */
  static async create<T extends Record<string, any>>(
    table: string,
    data: Omit<T, keyof LocalBaseModel>
  ): Promise<T & LocalBaseModel> {
    const db = await getDatabase();
    const userId = await this.getUserId();
    if (!userId) throw new Error('Cannot create record: User not authenticated');

    const now = new Date().toISOString();
    
    const record: T & LocalBaseModel = {
      ...data,
      id: data.id || Crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      is_deleted: 0,
      sync_status: 'pending',
      retry_count: 0
    } as any;

    // Only add user_id if the table has that column (profiles uses id as user_id)
    if (table !== 'profiles') {
      (record as any).user_id = userId;
    }

    // Only add user_id to columns if the table has that column (profiles uses id as user_id)
    const dbRecord: any = { ...record };
    if (table === 'profiles') {
      delete dbRecord.user_id;
    } else {
      dbRecord.user_id = userId;
    }

    const columns = Object.keys(dbRecord);
    const placeholders = columns.map(() => '?').join(', ');
    const values = this.mapValues(Object.values(dbRecord));

    await db.runAsync(
      `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      ...values
    );

    // After DB operation, ensure the returned object has user_id for interface compatibility
    if (table === 'profiles') {
      (record as any).user_id = record.id;
    } else {
      (record as any).user_id = userId;
    }

    return record;
  }

  /**
   * Generic Update
   */
  static async update<T extends Record<string, any>>(
    table: string,
    id: string,
    data: Partial<Omit<T, keyof LocalBaseModel>>
  ): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    
    const updates = {
      ...data,
      updated_at: now,
      sync_status: 'pending'
    } as any;

    const columns = Object.keys(updates);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = this.mapValues([...Object.values(updates), id]);

    await db.runAsync(
      `UPDATE ${table} SET ${setClause} WHERE id = ?`,
      ...values
    );
  }

  /**
   * Soft Delete
   */
  static async delete(table: string, id: string): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE ${table} SET is_deleted = 1, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
      now,
      id
    );
  }

  /**
   * Hardware (Force) Delete - only used for actual cleanup after sync
   */
  static async forceDelete(table: string, id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, id);
  }

  /**
   * Get All (User scoped, not deleted)
   */
  static async getAll<T>(table: string): Promise<T[]> {
    const db = await getDatabase();
    const userId = await this.getUserId();
    
    if (!userId) {
      console.log(`[LocalDB] No userId for ${table}, returning empty.`);
      return [];
    }
    
    const idColumn = table === 'profiles' ? 'id' : 'user_id';
    
    const records = await db.getAllAsync<T>(
      `SELECT * FROM ${table} WHERE ${idColumn} = ? AND is_deleted = 0 ORDER BY updated_at DESC`,
      userId
    );

    if (table === 'profiles') {
      records.forEach((r: any) => r.user_id = r.id);
    }

    return records;
  }

  /**
   * Get By ID
   */
  static async getById<T>(table: string, id: string): Promise<T | null> {
    const db = await getDatabase();
    const result = await db.getFirstAsync<T>(
      `SELECT * FROM ${table} WHERE id = ?`,
      id
    );
    
    if (result && table === 'profiles') {
      (result as any).user_id = (result as any).id;
    }
    
    return result;
  }

  /**
   * Mark as syncing
   */
  static async markSyncing(table: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(', ');
    await db.runAsync(
      `UPDATE ${table} SET sync_status = 'syncing' WHERE id IN (${placeholders})`,
      ...ids
    );
  }

  /**
   * Mark as synced
   */
  static async markSynced(table: string, id: string): Promise<void> {
    const db = await getDatabase();
    // Only mark as synced if it hasn't been modified (to 'pending') in the meantime
    await db.runAsync(
      `UPDATE ${table} SET sync_status = 'synced', retry_count = 0 WHERE id = ? AND sync_status = 'syncing'`,
      id
    );
  }

  /**
   * Mark as failed
   */
  static async markFailed(table: string, id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE ${table} SET sync_status = 'failed', retry_count = retry_count + 1 WHERE id = ?`,
      id
    );
  }

  /**
   * Get Pending Sync
   */
  static async getPendingSync<T>(table: string, limit: number = 50): Promise<T[]> {
    const userId = await this.getUserId();
    if (!userId) return [];

    const db = await getDatabase();
    const idColumn = table === 'profiles' ? 'id' : 'user_id';
    
    const records = await db.getAllAsync<T>(
      `SELECT * FROM ${table} WHERE ${idColumn} = ? AND sync_status IN ('pending', 'failed') AND retry_count < 5 LIMIT ?`,
      userId,
      limit
    );

    if (table === 'profiles') {
      records.forEach((r: any) => r.user_id = r.id);
    }

    return records;
  }

  /**
   * Sync Metadata operations
   */
  static async getLastSyncTime(): Promise<string | null> {
    const db = await getDatabase();
    try {
      const userId = await this.getUserId();
      if (!userId) return null;

      const result = await db.getFirstAsync<{ last_sync_time: string }>(
        'SELECT last_sync_time FROM sync_metadata WHERE user_id = ?',
        userId
      );
      return result?.last_sync_time || null;
    } catch (e) {
      return null;
    }
  }

  static async updateLastSyncTime(time: string): Promise<void> {
    const db = await getDatabase();
    const userId = await this.getUserId();
    if (!userId) return;

    await db.runAsync(
      'INSERT OR REPLACE INTO sync_metadata (user_id, last_sync_time) VALUES (?, ?)',
      userId,
      time
    );
  }

  /**
   * Reset Sync Status (for app start recovery)
   */
  static async recoverSyncStatus(): Promise<void> {
    const db = await getDatabase();
    const tables = ['profiles', 'transactions', 'categories', 'debts', 'transaction_templates'];
    for (const table of tables) {
      await db.runAsync(
        `UPDATE ${table} SET sync_status = 'pending' WHERE sync_status = 'syncing'`
      );
    }
  }

  /**
   * Batch upsert from server
   */
  static async upsertFromServer(table: string, records: any[]): Promise<void> {
    const db = await getDatabase();
    
    // Get valid columns for this table to filter out remote-only columns
    const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    const validColumns = tableInfo.map(c => c.name);
    console.log(`[LocalDB] Valid columns for ${table}:`, validColumns.join(', '));

    // Process in a single transaction for performance
    await db.withTransactionAsync(async () => {
      for (const record of records) {
        // Map 'deleted' to 'is_deleted' if necessary
        if (record.deleted !== undefined && !record.is_deleted && validColumns.includes('is_deleted')) {
          record.is_deleted = record.deleted ? 1 : 0;
        }

        // Filter record to only contain columns that exist locally
        const filteredRecord: any = {};
        for (const col of validColumns) {
          if (record[col] !== undefined) {
            filteredRecord[col] = record[col];
          }
        }

        // Special handling for categories: infer type if missing from server
        if (table === 'categories' && filteredRecord.type === undefined) {
          const name = (filteredRecord.name || '').toLowerCase();
          if (
            name.includes('sale') || 
            name.includes('income') || 
            name.includes('revenue') || 
            name.includes('profit')
          ) {
            filteredRecord.type = 'income';
          } else {
            filteredRecord.type = 'expense';
          }
        }

        // Use filteredRecord for the rest of the logic
        const local = await db.getFirstAsync<LocalBaseModel>(
          `SELECT updated_at, sync_status FROM ${table} WHERE id = ?`,
          record.id
        );

        if (local) {
          // Conflict resolution: Latest updated_at wins
          const localTime = new Date(local.updated_at).getTime();
          const serverTime = new Date(record.updated_at).getTime();

          if (serverTime > localTime) {
            // Server version is newer
            const columns = Object.keys(filteredRecord);
            const setClause = columns.map(col => `${col} = ?`).join(', ');
            const values = this.mapValues([...Object.values(filteredRecord), record.id]);
            
            await db.runAsync(
              `UPDATE ${table} SET ${setClause}, sync_status = 'synced' WHERE id = ?`,
              ...values
            );
          }
        } else {
          // New record from server
          filteredRecord.sync_status = 'synced';
          const columns = Object.keys(filteredRecord);
          const placeholders = columns.map(() => '?').join(', ');
          const values = this.mapValues(Object.values(filteredRecord));

          await db.runAsync(
            `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            ...values
          );
        }
      }
    });
  }
}
