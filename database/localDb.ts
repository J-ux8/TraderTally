import { getDatabase } from '../lib/database';
import { supabase } from '../lib/supabase';
import { NetworkMonitor } from '../sync/NetworkMonitor';
import { randomUUID } from 'expo-crypto';

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
   * In-memory cache for the authenticated user ID.
   * Avoids repeated async supabase.auth.getSession() calls on every DB operation.
   */
  private static _cachedUserId: string | null = null;

  /**
   * Call on sign-out to clear the cached user ID.
   */
  public static clearUserCache(): void {
    this._cachedUserId = null;
    this._schemaCache = {};
  }

  /**
   * Get current authenticated user ID (cached after first call)
   */
  public static async getUserId(): Promise<string | null> {
    // Return cached value instantly — avoids async auth call on every DB op
    if (this._cachedUserId) return this._cachedUserId;

    try {
      // getSession() checks local storage first and doesn't require network
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        this._cachedUserId = session.user.id;
        return this._cachedUserId;
      }

      // Only fallback to getUser() if online and we have no session
      if (NetworkMonitor.getStatus()) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          this._cachedUserId = user.id;
          return this._cachedUserId;
        }
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
   * Escape a value for use in a SQL string literal.
   * Matches the execAsync escaping pattern from upsertFromServer.
   */
  private static esc(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  /**
   * Enqueue a sync operation into the outbox.
   * Can be called from within or outside a transaction.
   */
  static async enqueue(
    table: string,
    recordId: string,
    operation: 'create' | 'update' | 'delete',
    payload?: any
  ): Promise<void> {
    const db = await getDatabase();
    const userId = await this.getUserId();
    if (!userId) return;

    const now = new Date().toISOString();
    const payloadStr = payload !== undefined ? JSON.stringify(payload) : null;

    await db.runAsync(
      `INSERT INTO sync_queue (user_id, table_name, record_id, operation, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      userId,
      table,
      recordId,
      operation,
      payloadStr,
      now,
      now
    );
  }

  /**
   * Generic Create (atomic: data insert + sync_queue enqueue)
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
      id: data.id || randomUUID(),
      created_at: now,
      updated_at: now,
      is_deleted: 0,
      sync_status: 'pending',
      retry_count: 0
    } as any;

    if (table !== 'profiles') {
      (record as any).user_id = userId;
    }

    const dbRecord: any = { ...record };
    if (table === 'profiles') {
      delete dbRecord.user_id;
    } else {
      dbRecord.user_id = userId;
    }

    const columns = Object.keys(dbRecord);
    const vals = columns.map(c => this.esc(dbRecord[c])).join(', ');
    const payload = JSON.stringify(record);
    const queueUserId = table === 'profiles' ? record.id : userId;

    const sql = [
      'BEGIN TRANSACTION;',
      `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${vals});`,
      `INSERT INTO sync_queue (user_id, table_name, record_id, operation, payload, created_at, updated_at) VALUES (${this.esc(queueUserId)}, ${this.esc(table)}, ${this.esc(record.id)}, 'create', ${this.esc(payload)}, ${this.esc(now)}, ${this.esc(now)});`,
      'COMMIT;'
    ].join('\n');

    await db.execAsync(sql);

    if (table === 'profiles') {
      (record as any).user_id = record.id;
    } else {
      (record as any).user_id = userId;
    }

    return record;
  }

  /**
   * Generic Update (atomic: data update + sync_queue enqueue)
   */
  static async update<T extends Record<string, any>>(
    table: string,
    id: string,
    data: Partial<Omit<T, keyof LocalBaseModel>>
  ): Promise<void> {
    const db = await getDatabase();
    const userId = await this.getUserId();
    if (!userId) throw new Error('Cannot update record: User not authenticated');

    const now = new Date().toISOString();

    // Read existing record for full payload snapshot
    const existing = await db.getFirstAsync<any>(
      `SELECT * FROM ${table} WHERE id = ?`,
      id
    );
    if (!existing) throw new Error(`Record not found: ${table}.${id}`);

    const updates = {
      ...data,
      updated_at: now,
      sync_status: 'pending'
    } as any;

    const columns = Object.keys(updates).filter(c => updates[c] !== undefined);
    const setClause = columns.map(c => `${c} = ${this.esc(updates[c])}`).join(', ');
    const fullRecord = { ...existing, ...updates };
    const payload = JSON.stringify(fullRecord);

    const sql = [
      'BEGIN TRANSACTION;',
      `UPDATE ${table} SET ${setClause} WHERE id = ${this.esc(id)};`,
      `INSERT INTO sync_queue (user_id, table_name, record_id, operation, payload, created_at, updated_at) VALUES (${this.esc(userId)}, ${this.esc(table)}, ${this.esc(id)}, 'update', ${this.esc(payload)}, ${this.esc(now)}, ${this.esc(now)});`,
      'COMMIT;'
    ].join('\n');

    await db.execAsync(sql);
  }

  /**
   * Soft Delete (atomic: data update + sync_queue enqueue)
   */
  static async delete(table: string, id: string): Promise<void> {
    const db = await getDatabase();
    const userId = await this.getUserId();
    if (!userId) throw new Error('Cannot delete record: User not authenticated');

    const now = new Date().toISOString();

    const sql = [
      'BEGIN TRANSACTION;',
      `UPDATE ${table} SET is_deleted = 1, updated_at = ${this.esc(now)}, sync_status = 'pending' WHERE id = ${this.esc(id)};`,
      `INSERT INTO sync_queue (user_id, table_name, record_id, operation, payload, created_at, updated_at) VALUES (${this.esc(userId)}, ${this.esc(table)}, ${this.esc(id)}, 'delete', NULL, ${this.esc(now)}, ${this.esc(now)});`,
      'COMMIT;'
    ].join('\n');

    await db.execAsync(sql);
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
   * Get All by Field (User scoped, not deleted)
   */
  static async getAllByField<T>(table: string, field: string, value: any): Promise<T[]> {
    const db = await getDatabase();
    const userId = await this.getUserId();
    
    if (!userId) return [];
    
    const idColumn = table === 'profiles' ? 'id' : 'user_id';
    
    return await db.getAllAsync<T>(
      `SELECT * FROM ${table} WHERE ${idColumn} = ? AND ${field} = ? AND is_deleted = 0 ORDER BY created_at DESC`,
      userId,
      value
    );
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
   * In-memory schema cache — avoids repeated PRAGMA table_info calls
   */
  private static _schemaCache: Record<string, string[]> = {};

  private static async getValidColumns(db: any, table: string): Promise<string[]> {
    if (this._schemaCache[table]) return this._schemaCache[table];
    const tableInfo = await db.getAllAsync(`PRAGMA table_info(${table})`) as { name: string }[];
    const columns = tableInfo.map((c: { name: string }) => c.name);
    this._schemaCache[table] = columns;
    return columns;
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
    const tables = ['profiles', 'transactions', 'categories', 'debts', 'products', 'sales', 'sale_items'];
    const sql = tables.map(t => `UPDATE ${t} SET sync_status = 'pending' WHERE sync_status = 'syncing'`).join('; ');
    if (sql) {
      await db.execAsync(sql);
    }
  }

  /**
   * Batch upsert from server
   */
  static async upsertFromServer(table: string, records: any[]): Promise<void> {
    if (records.length === 0) return;
    const db = await getDatabase();

    const validColumns = await this.getValidColumns(db, table);

    // Pre-fetch all local records in one query to avoid
    // getFirstAsync inside execAsync (which triggers the NativeStatement GC bug)
    const ids = records.filter(r => r.id).map(r => r.id);
    const existing = ids.length > 0
      ? await db.getAllAsync<{ id: string; updated_at: string }>(
          `SELECT id, updated_at FROM ${table} WHERE id IN (${ids.map(() => '?').join(',')})`,
          ...ids
        )
      : [];
    const existingMap = new Map(existing.map(r => [r.id, r]));

    // Build batch SQL with explicit transaction
    const statements: string[] = ['BEGIN TRANSACTION;'];

    for (const record of records) {
      if (record.deleted !== undefined && !record.is_deleted && validColumns.includes('is_deleted')) {
        record.is_deleted = record.deleted ? 1 : 0;
      }

      const filteredRecord: any = {};
      for (const col of validColumns) {
        if (record[col] !== undefined) {
          filteredRecord[col] = record[col];
        }
      }

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

      const existing = existingMap.get(record.id);
      if (existing) {
        const localTime = new Date(existing.updated_at).getTime();
        const serverTime = new Date(record.updated_at).getTime();
        if (serverTime > localTime) {
          filteredRecord.sync_status = 'synced';
          const setClause = Object.keys(filteredRecord).map(c => {
            const val = filteredRecord[c];
            if (val === null || val === undefined) return `${c} = NULL`;
            if (typeof val === 'number') return `${c} = ${val}`;
            return `${c} = '${String(val).replace(/'/g, "''")}'`;
          }).join(', ');
          statements.push(`UPDATE ${table} SET ${setClause} WHERE id = '${record.id.replace(/'/g, "''")}';`);
        }
      } else {
        filteredRecord.sync_status = 'synced';
        const cols = Object.keys(filteredRecord);
        const vals = cols.map(c => {
          const val = filteredRecord[c];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return String(val);
          return `'${String(val).replace(/'/g, "''")}'`;
        });
        statements.push(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
      }
    }

    statements.push('COMMIT;');
    await db.execAsync(statements.join('\n'));
  }
}
