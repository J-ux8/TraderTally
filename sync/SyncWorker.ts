import { getDatabase } from '../lib/database';
import { supabase } from '../lib/supabase';
import { NetworkMonitor } from './NetworkMonitor';

const DEBUG = true;
const debug = (...args: any[]) => { if (DEBUG) console.log('[SyncWorker]', ...args); };

// ─── Types ────────────────────────────────────────────────────────────

export interface SyncQueueEntry {
  id: number;
  user_id: string;
  table_name: string;
  record_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: string | null;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  retry_count: number;
  last_error: string | null;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface QueueStats {
  pending: number;
  failed: number;
  completed: number;
  processing: number;
}

export interface RunResult {
  processed: number;
  succeeded: number;
  failed: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const TABLE_PRIORITY: string[] = [
  'categories',
  'customers',
  'products',
  'sales',
  'sale_items',
  'transactions',
  'debts',
  'profiles',
  'transaction_templates',
];

const BACKOFF_DELAYS: number[] = [
  5000,      // attempt 1: 5s
  30000,     // attempt 2: 30s
  120000,    // attempt 3: 2m
  600000,    // attempt 4: 10m
  1800000,   // attempt 5: 30m
  3600000,   // attempt 6: 1h
  7200000,   // attempt 7: 2h
  14400000,  // attempt 8: 4h
];

const MAX_RETRIES = 8;
const BATCH_SIZE = 50;
const LEASE_SECONDS = 60;

// ─── SyncWorker ───────────────────────────────────────────────────────

export class SyncWorker {
  private static isRunning = false;
  private static timerId: ReturnType<typeof setInterval> | null = null;
  private static unsubscribeNetwork: (() => void) | null = null;

  // ─── Public API ─────────────────────────────────────────────────

  static start(): void {
    if (this.timerId) return;

    debug('Starting SyncWorker');

    this.timerId = setInterval(() => {
      this.runOnce().catch(() => {});
    }, 30000);

    this.unsubscribeNetwork = NetworkMonitor.subscribe((online) => {
      if (online) {
        debug('Network restored, triggering drain');
        this.runOnce().catch(() => {});
      }
    });
  }

  static stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }
    debug('Stopped SyncWorker');
  }

  /**
   * Drain one batch of queue entries. Processes one table at a time in
   * dependency order (parents before children), FIFO within each table.
   */
  static async runOnce(): Promise<RunResult> {
    if (this.isRunning) {
      debug('Already running, skipping');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!NetworkMonitor.getStatus()) {
      debug('Offline, skipping drain');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const userId = await this.getUserId();
    if (!userId) {
      debug('No authenticated user, skipping');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isRunning = true;

    const result: RunResult = { processed: 0, succeeded: 0, failed: 0 };

    try {
      for (const table of TABLE_PRIORITY) {
        if (!NetworkMonitor.getStatus()) {
          debug('Lost connectivity mid-drain, stopping');
          break;
        }

        const { processed, succeeded, failed } = await this.processTable(table, userId);
        result.processed += processed;
        result.succeeded += succeeded;
        result.failed += failed;
      }

      if (result.processed > 0) {
        debug(`Drain complete — processed=${result.processed} succeeded=${result.succeeded} failed=${result.failed}`);
      }
    } finally {
      this.isRunning = false;
    }

    return result;
  }

  static async getQueueStats(): Promise<QueueStats> {
    const db = await getDatabase();
    const userId = await this.getUserId();
    if (!userId) return { pending: 0, failed: 0, completed: 0, processing: 0 };

    const rows = await db.getAllAsync<{ status: string; count: number }>(
      `SELECT status, COUNT(*) as count FROM sync_queue WHERE user_id = ? GROUP BY status`,
      userId
    );

    const stats: QueueStats = { pending: 0, failed: 0, completed: 0, processing: 0 };
    for (const row of rows) {
      if (row.status === 'pending') stats.pending = row.count;
      else if (row.status === 'failed') stats.failed = row.count;
      else if (row.status === 'completed') stats.completed = row.count;
      else if (row.status === 'processing') stats.processing = row.count;
    }
    return stats;
  }

  // ─── Table Processing ──────────────────────────────────────────

  private static async processTable(table: string, userId: string): Promise<RunResult> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const result: RunResult = { processed: 0, succeeded: 0, failed: 0 };

    // 1. Fetch eligible entries (pending, or failed/processing with expired lock)
    const eligible = await db.getAllAsync<SyncQueueEntry>(
      `SELECT * FROM sync_queue
       WHERE user_id = ?
         AND table_name = ?
         AND (
           status = 'pending'
           OR (status = 'failed' AND retry_count < ? AND (locked_until IS NULL OR locked_until < ?))
           OR (status = 'processing' AND locked_until < ?)
         )
       ORDER BY id ASC
       LIMIT ?`,
      userId,
      table,
      MAX_RETRIES,
      now,
      now,
      BATCH_SIZE
    );

    if (eligible.length === 0) return result;

    // 2. Lease-lock atomically (prevent other workers from picking same rows)
    const ids = eligible.map(e => e.id);
    const lockUntil = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();

    await db.runAsync(
      `UPDATE sync_queue SET status = 'processing', locked_until = ? WHERE id IN (${ids.map(() => '?').join(',')}) AND status != 'completed'`,
      lockUntil,
      ...ids
    );

    // 3. Process each entry
    for (const entry of eligible) {
      try {
        await this.processEntry(entry, db);
        // Success
        await db.runAsync(
          `UPDATE sync_queue SET status = 'completed', locked_until = NULL, last_error = NULL, updated_at = ? WHERE id = ?`,
          new Date().toISOString(),
          entry.id
        );
        result.succeeded++;
      } catch (error: any) {
        const isPermanent = this.isPermanentError(error);
        const newRetryCount = entry.retry_count + 1;

        if (isPermanent || newRetryCount >= MAX_RETRIES) {
          // Dead-letter: mark permanently failed
          await db.runAsync(
            `UPDATE sync_queue SET status = 'failed', retry_count = ?, last_error = ?, locked_until = NULL, updated_at = ? WHERE id = ?`,
            newRetryCount,
            error?.message || String(error),
            new Date().toISOString(),
            entry.id
          );
          result.failed++;
          debug(`Entry ${entry.id} (${entry.table_name}/${entry.record_id}) DEAD-LETTER: ${error?.message}`);
        } else {
          // Retry later with backoff
          const backoffMs = BACKOFF_DELAYS[Math.min(newRetryCount - 1, BACKOFF_DELAYS.length - 1)];
          const retryAt = new Date(Date.now() + backoffMs).toISOString();
          await db.runAsync(
            `UPDATE sync_queue SET status = 'failed', retry_count = ?, last_error = ?, locked_until = ?, updated_at = ? WHERE id = ?`,
            newRetryCount,
            error?.message || String(error),
            retryAt,
            new Date().toISOString(),
            entry.id
          );
          result.failed++;
          debug(`Entry ${entry.id} (${entry.table_name}/${entry.record_id}) will retry in ${backoffMs}ms: ${error?.message}`);
        }
      }
      result.processed++;
    }

    return result;
  }

  // ─── Per-Entry Push ────────────────────────────────────────────

  private static async processEntry(entry: SyncQueueEntry, db: any): Promise<void> {
    const { table_name, record_id, operation, payload } = entry;

    if (operation === 'delete') {
      const { error } = await supabase
        .from(table_name)
        .update({
          is_deleted: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record_id);

      if (error) throw error;
      return;
    }

    // create / update
    if (!payload) {
      throw new Error(`No payload for ${operation} on ${table_name}/${record_id}`);
    }

    const record = JSON.parse(payload);
    const cleanRecord = this.stripLocalColumns(record);

    const { data, error } = await supabase
      .from(table_name)
      .upsert(cleanRecord, { onConflict: 'id' })
      .select();

    if (error) throw error;

    // Sync back the server-authoritative updated_at so the next pull
    // doesn't re-fetch this record (eliminates the single-cycle ping-pong).
    if (data && data.length > 0 && data[0].updated_at) {
      await db.runAsync(
        `UPDATE ${table_name} SET updated_at = ? WHERE id = ?`,
        data[0].updated_at,
        record_id
      );
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /**
   * Strip local-only state columns before sending to Supabase.
   * Keeps ALL business columns intact.
   */
  private static stripLocalColumns(record: Record<string, any>): Record<string, any> {
    const { sync_status, retry_count, updated_at, ...clean } = record;
    return clean;
  }

  /**
   * Classify errors into permanent (dead-letter) vs retryable.
   */
  private static isPermanentError(error: any): boolean {
    if (!error) return false;

    // Supabase/HTTP status
    if (error.status) {
      // 4xx client errors
      if (error.status === 400 || error.status === 422) return true;
      if (error.status === 401 || error.status === 403) return true;
      if (error.status === 404) return true;
      // 409 conflict — retry (race with another client)
      if (error.status === 409) return false;
      // 429 rate-limited — retry
      if (error.status === 429) return false;
      // 5xx server errors — retry
      if (error.status >= 500) return false;
    }

    // Network errors — always retry
    const msg = (error?.message || '').toLowerCase();
    if (
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('dns')
    ) {
      return false;
    }

    // PostgreSQL error codes via Supabase
    const code = error.code || '';
    // Class 23 — integrity constraint violation → permanent
    if (code.startsWith('23')) return true;
    // Class 42 — syntax or access violation → permanent
    if (code.startsWith('42')) return true;
    // Class 53 — insufficient resources → retry
    if (code.startsWith('53')) return false;
    // Class 57 — operator intervention → retry
    if (code.startsWith('57')) return false;
    // Class 58 — system error → retry
    if (code.startsWith('58')) return false;
    // Supabase pg code prefix
    if (code.startsWith('P')) return false;

    // Default: retry (conservative)
    return false;
  }

  /**
   * Get current user ID from LocalDB cache.
   */
  private static async getUserId(): Promise<string | null> {
    try {
      const { LocalDB } = require('../database/localDb');
      return await LocalDB.getUserId();
    } catch {
      return null;
    }
  }
}
