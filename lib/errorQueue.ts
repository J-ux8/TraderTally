/**
 * Error Queue - Offline Error Persistence
 * 
 * Stores errors locally when network is unavailable,
 * and sends them when connection is restored.
 * 
 * SAFE: Completely independent system
 */

import { getDatabase } from './database';
import { NetworkMonitor } from '../sync/NetworkMonitor';

interface QueuedError {
  id: string;
  message: string;
  stack?: string;
  context?: any;
  timestamp: string;
  level: string;
  attempts: number;
  lastAttempt?: string;
}

const MAX_QUEUE_SIZE = 1000;
const MAX_RETRY_ATTEMPTS = 5;

export class ErrorQueue {
  private static initialized = false;
  private static isProcessing = false;

  /**
   * Initialize the error queue system
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[ErrorQueue] Initializing...');

    try {
      const db = await getDatabase();

      // Create queue table if it doesn't exist
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS error_queue (
          id TEXT PRIMARY KEY,
          message TEXT NOT NULL,
          stack TEXT,
          context TEXT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          attempts INTEGER DEFAULT 0,
          last_attempt TEXT,
          created_at TEXT NOT NULL
        );
      `);

      // Create index for efficient queries
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_error_queue_timestamp 
        ON error_queue(timestamp DESC);
      `);

      this.initialized = true;
      console.log('[ErrorQueue] ✅ Initialized');

      // If online, try to process queue
      if (NetworkMonitor.getStatus()) {
        this.processQueue().catch(e => console.error('[ErrorQueue] Process failed:', e));
      }
    } catch (error) {
      console.error('[ErrorQueue] Initialization failed:', error);
    }
  }

  /**
   * Add error to queue
   */
  static async addError(error: {
    id: string;
    message: string;
    stack?: string;
    context?: any;
    timestamp: string;
    level: string;
  }): Promise<void> {
    try {
      const db = await getDatabase();

      await db.runAsync(
        `INSERT INTO error_queue (id, message, stack, context, timestamp, level, attempts, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          error.id,
          error.message,
          error.stack || null,
          error.context ? JSON.stringify(error.context) : null,
          error.timestamp,
          error.level,
          0,
          new Date().toISOString(),
        ]
      );

      // Cleanup old entries if queue is getting too large
      await this.cleanup();

      console.log('[ErrorQueue] Error queued for later sending');
    } catch (error) {
      console.error('[ErrorQueue] Failed to add error:', error);
    }
  }

  /**
   * Process queue - send all queued errors
   */
  static async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('[ErrorQueue] Already processing, skipping');
      return;
    }

    if (!NetworkMonitor.getStatus()) {
      console.log('[ErrorQueue] Offline, deferring queue processing');
      return;
    }

    this.isProcessing = true;

    try {
      const db = await getDatabase();

      // Get all errors that haven't been sent
      const errors = await db.getAllAsync<any>(
        `SELECT * FROM error_queue WHERE attempts < ? ORDER BY created_at ASC LIMIT 50`,
        [MAX_RETRY_ATTEMPTS]
      );

      console.log(`[ErrorQueue] Processing ${errors.length} queued errors...`);

      for (const error of errors) {
        await this.sendError(error);
      }

      // Delete successfully sent errors
      await db.runAsync(
        `DELETE FROM error_queue WHERE attempts >= ?`,
        [MAX_RETRY_ATTEMPTS]
      );

      console.log('[ErrorQueue] ✅ Queue processing complete');
    } catch (error) {
      console.error('[ErrorQueue] Queue processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a single error
   */
  private static async sendError(error: any): Promise<void> {
    try {
      // TODO: Implement actual sending to server/Sentry when API is set up
      console.log('[ErrorQueue] Would send error:', error.message);

      const db = await getDatabase();

      // Update attempt count
      await db.runAsync(
        `UPDATE error_queue SET attempts = attempts + 1, last_attempt = ? WHERE id = ?`,
        [new Date().toISOString(), error.id]
      );

      // In production, mark as sent after successful API call
      // For now, we mark as sent after 1 attempt (to avoid spam)
      if (error.attempts >= 0) {
        await db.runAsync(`UPDATE error_queue SET attempts = ? WHERE id = ?`, [MAX_RETRY_ATTEMPTS, error.id]);
      }
    } catch (error) {
      console.error('[ErrorQueue] Failed to send error:', error);
    }
  }

  /**
   * Get queue size
   */
  static async getQueueSize(): Promise<number> {
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM error_queue`
      );
      return result?.count || 0;
    } catch (error) {
      console.error('[ErrorQueue] Failed to get queue size:', error);
      return 0;
    }
  }

  /**
   * Get queued errors
   */
  static async getQueuedErrors(limit: number = 50): Promise<QueuedError[]> {
    try {
      const db = await getDatabase();
      const errors = await db.getAllAsync<any>(
        `SELECT * FROM error_queue ORDER BY created_at DESC LIMIT ?`,
        [limit]
      );

      return errors.map(e => ({
        id: e.id,
        message: e.message,
        stack: e.stack,
        context: e.context ? JSON.parse(e.context) : undefined,
        timestamp: e.timestamp,
        level: e.level,
        attempts: e.attempts,
        lastAttempt: e.last_attempt,
      }));
    } catch (error) {
      console.error('[ErrorQueue] Failed to get queued errors:', error);
      return [];
    }
  }

  /**
   * Clear the queue
   */
  static async clear(): Promise<void> {
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM error_queue`);
      console.log('[ErrorQueue] ✅ Queue cleared');
    } catch (error) {
      console.error('[ErrorQueue] Failed to clear queue:', error);
    }
  }

  /**
   * Cleanup old/failed errors
   */
  private static async cleanup(): Promise<void> {
    try {
      const db = await getDatabase();

      // Get current size
      const current = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM error_queue`
      );

      if ((current?.count || 0) > MAX_QUEUE_SIZE) {
        // Delete oldest failed attempts first
        await db.runAsync(
          `DELETE FROM error_queue 
           WHERE id NOT IN (
             SELECT id FROM error_queue 
             ORDER BY created_at DESC LIMIT ?
           )`,
          [MAX_QUEUE_SIZE - 100] // Keep 100 under limit
        );

        console.log('[ErrorQueue] Cleaned up old errors');
      }

      // Delete errors that exceeded max attempts and are old
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await db.runAsync(
        `DELETE FROM error_queue 
         WHERE attempts >= ? AND created_at < ?`,
        [MAX_RETRY_ATTEMPTS, thirtyDaysAgo.toISOString()]
      );
    } catch (error) {
      console.error('[ErrorQueue] Cleanup failed:', error);
    }
  }

  /**
   * Get queue stats
   */
  static async getStats(): Promise<{
    totalErrors: number;
    failedErrors: number;
    oldestError?: string;
    newestError?: string;
  }> {
    try {
      const db = await getDatabase();

      const totalResult = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM error_queue`
      );

      const failedResult = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM error_queue WHERE attempts > 3`
      );

      const oldestResult = await db.getFirstAsync<{ created_at: string }>(
        `SELECT created_at FROM error_queue ORDER BY created_at ASC LIMIT 1`
      );

      const newestResult = await db.getFirstAsync<{ created_at: string }>(
        `SELECT created_at FROM error_queue ORDER BY created_at DESC LIMIT 1`
      );

      return {
        totalErrors: totalResult?.count || 0,
        failedErrors: failedResult?.count || 0,
        oldestError: oldestResult?.created_at,
        newestError: newestResult?.created_at,
      };
    } catch (error) {
      console.error('[ErrorQueue] Failed to get stats:', error);
      return { totalErrors: 0, failedErrors: 0 };
    }
  }

  /**
   * Set up network change listener to auto-process queue
   */
  static setupNetworkListener(): void {
    try {
      // This will be called from the main app initialization
      // When network comes online, process the queue
      console.log('[ErrorQueue] Network listener setup ready (to be called from app)');
    } catch (error) {
      console.error('[ErrorQueue] Failed to setup network listener:', error);
    }
  }
}

export default ErrorQueue;
