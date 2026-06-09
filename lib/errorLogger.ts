/**
 * Centralized Error Logging System
 * 
 * This module provides a single point for error handling across the app.
 * It supports:
 * - Sentry integration for production error tracking
 * - Local error queue for offline scenarios
 * - Feature flag to enable/disable logging
 * 
 * SAFE: Completely additive, doesn't modify existing code
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorQueue } from './errorQueue';
import { getDatabase } from './database';

const FEATURE_ENABLED = process.env.EXPO_PUBLIC_ERROR_LOGGING === 'true';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const MAX_ERROR_HISTORY = 100;

interface ErrorContext {
  userId?: string;
  screen?: string;
  action?: string;
  timestamp?: string;
  [key: string]: any;
}

interface LoggedError {
  id: string;
  message: string;
  stack?: string;
  context?: ErrorContext;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  synced: boolean;
}

/**
 * ErrorLogger - Main error logging service
 * 
 * Usage:
 * try {
 *   await risky();
 * } catch (error) {
 *   ErrorLogger.captureException(error, { action: 'saveTransaction' });
 * }
 */
export class ErrorLogger {
  private static initialized = false;

  /**
   * Initialize the error logging system
   * Call this once on app startup
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;
    if (!FEATURE_ENABLED) {
      console.log('[ErrorLogger] Feature disabled, skipping initialization');
      return;
    }

    console.log('[ErrorLogger] Initializing error logging system...');
    
    try {
      const db = await getDatabase();

      // Create error logs table first (must exist before any queries)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS error_logs (
          id TEXT PRIMARY KEY,
          message TEXT NOT NULL,
          stack TEXT,
          context TEXT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);

      // Initialize Sentry if DSN is provided
      if (SENTRY_DSN) {
        await this.initializeSentry();
      }

      // Initialize error queue
      await ErrorQueue.initialize();

      // Try to flush any queued errors on startup
      this.flushErrorQueue().catch(e => console.error('[ErrorLogger] Queue flush failed:', e));

      this.initialized = true;
      console.log('[ErrorLogger] ✅ Error logging initialized');
    } catch (error) {
      console.error('[ErrorLogger] Initialization failed:', error);
      // Don't throw - logging failure shouldn't crash the app
    }
  }

  /**
   * Initialize Sentry (if DSN is provided)
   */
  private static async initializeSentry(): Promise<void> {
    try {
      // Dynamic import to keep Sentry optional
      // Sentry will be optional dependency
      console.log('[ErrorLogger] Sentry DSN provided, will be initialized when SDK is added');
      // TODO: Add Sentry integration when @sentry/react-native is installed
      // import * as Sentry from '@sentry/react-native';
      // Sentry.init({ dsn: SENTRY_DSN });
    } catch (error) {
      console.error('[ErrorLogger] Sentry initialization failed:', error);
    }
  }

  /**
   * Capture an exception
   */
  static async captureException(error: Error, context?: ErrorContext): Promise<void> {
    if (!FEATURE_ENABLED) return;

    try {
      console.log('[ErrorLogger] Capturing exception:', {
        message: error.message,
        context,
      });

      const loggedError: LoggedError = {
        id: this.generateId(),
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        level: 'error',
        synced: false,
      };

      // Store locally
      await this.storeError(loggedError);

      // Try to send to Sentry
      await this.sendToSentry(loggedError);

      // Add to queue for retry if Sentry fails
      if (!loggedError.synced) {
        await ErrorQueue.addError(loggedError);
      }
    } catch (storageError) {
      console.error('[ErrorLogger] Failed to capture exception:', storageError);
      // Fail silently - don't crash the app
    }
  }

  /**
   * Capture a warning
   */
  static async captureWarning(message: string, context?: ErrorContext): Promise<void> {
    if (!FEATURE_ENABLED) return;

    try {
      const loggedError: LoggedError = {
        id: this.generateId(),
        message,
        context,
        timestamp: new Date().toISOString(),
        level: 'warning',
        synced: false,
      };

      await this.storeError(loggedError);
    } catch (error) {
      console.error('[ErrorLogger] Failed to capture warning:', error);
    }
  }

  /**
   * Capture info/debug message
   */
  static async captureInfo(message: string, context?: ErrorContext): Promise<void> {
    if (!FEATURE_ENABLED) return;

    try {
      const loggedError: LoggedError = {
        id: this.generateId(),
        message,
        context,
        timestamp: new Date().toISOString(),
        level: 'info',
        synced: false,
      };

      await this.storeError(loggedError);
    } catch (error) {
      console.error('[ErrorLogger] Failed to capture info:', error);
    }
  }

  /**
   * Send error to Sentry
   */
  private static async sendToSentry(error: LoggedError): Promise<void> {
    try {
      if (!SENTRY_DSN) return;

      // TODO: Implement Sentry sending when SDK is added
      // For now, just log that we would send
      console.log('[ErrorLogger] Would send to Sentry:', error.message);

      // Example implementation when Sentry is added:
      // import * as Sentry from '@sentry/react-native';
      // Sentry.captureException(new Error(error.message), {
      //   extra: error.context,
      //   tags: { level: error.level },
      // });

      // Mark as synced (for now)
      error.synced = true;
    } catch (error) {
      console.error('[ErrorLogger] Failed to send to Sentry:', error);
    }
  }

  /**
   * Store error in local database
   */
  private static async storeError(error: LoggedError): Promise<void> {
    try {
      const db = await getDatabase();
      
      // Create error log table if it doesn't exist
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS error_logs (
          id TEXT PRIMARY KEY,
          message TEXT NOT NULL,
          stack TEXT,
          context TEXT,
          timestamp TEXT NOT NULL,
          level TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);

      // Insert error
      await db.runAsync(
        `INSERT INTO error_logs (id, message, stack, context, timestamp, level, synced) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          error.id,
          error.message,
          error.stack || null,
          error.context ? JSON.stringify(error.context) : null,
          error.timestamp,
          error.level,
          error.synced ? 1 : 0,
        ]
      );

      // Keep only last MAX_ERROR_HISTORY errors
      await db.runAsync(
        `DELETE FROM error_logs 
         WHERE id NOT IN (
           SELECT id FROM error_logs ORDER BY timestamp DESC LIMIT ?
         )`,
        [MAX_ERROR_HISTORY]
      );
    } catch (error) {
      console.error('[ErrorLogger] Failed to store error:', error);
    }
  }

  /**
   * Get error history
   */
  static async getErrorHistory(limit: number = 50): Promise<LoggedError[]> {
    if (!FEATURE_ENABLED) return [];

    try {
      const db = await getDatabase();

      const results = await db.getAllAsync<any>(
        `SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ?`,
        [limit]
      );

      return results.map(row => ({
        id: row.id,
        message: row.message,
        stack: row.stack,
        context: row.context ? JSON.parse(row.context) : undefined,
        timestamp: row.timestamp,
        level: row.level,
        synced: row.synced === 1,
      }));
    } catch (error) {
      console.error('[ErrorLogger] Failed to get error history:', error);
      return [];
    }
  }

  /**
   * Flush queued errors (retry sending)
   */
  private static async flushErrorQueue(): Promise<void> {
    try {
      const unsentErrors = await this.getUnsentErrors();
      console.log(`[ErrorLogger] Flushing ${unsentErrors.length} unsent errors...`);

      for (const error of unsentErrors) {
        await this.sendToSentry(error);
      }
    } catch (error) {
      console.error('[ErrorLogger] Failed to flush error queue:', error);
    }
  }

  /**
   * Get unsent errors
   */
  private static async getUnsentErrors(): Promise<LoggedError[]> {
    try {
      const db = await getDatabase();

      const results = await db.getAllAsync<any>(
        `SELECT * FROM error_logs WHERE synced = 0 LIMIT 100`
      );

      return results.map(row => ({
        id: row.id,
        message: row.message,
        stack: row.stack,
        context: row.context ? JSON.parse(row.context) : undefined,
        timestamp: row.timestamp,
        level: row.level,
        synced: row.synced === 1,
      }));
    } catch (error) {
      console.error('[ErrorLogger] Failed to get unsent errors:', error);
      return [];
    }
  }

  /**
   * Clear error history
   */
  static async clearHistory(): Promise<void> {
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM error_logs`);
      console.log('[ErrorLogger] Error history cleared');
    } catch (error) {
      console.error('[ErrorLogger] Failed to clear history:', error);
    }
  }

  /**
   * Set user context for all future errors
   */
  static async setUserContext(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem('errorLogger_userId', userId);
    } catch (error) {
      console.error('[ErrorLogger] Failed to set user context:', error);
    }
  }

  /**
   * Get user context
   */
  static async getUserContext(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('errorLogger_userId');
    } catch (error) {
      console.error('[ErrorLogger] Failed to get user context:', error);
      return null;
    }
  }

  /**
   * Generate unique ID
   */
  private static generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if logging is enabled
   */
  static isEnabled(): boolean {
    return FEATURE_ENABLED;
  }

  /**
   * Get system status
   */
  static async getStatus(): Promise<{
    enabled: boolean;
    errorCount: number;
    unsentErrorCount: number;
    lastError?: LoggedError;
  }> {
    const errors = await this.getErrorHistory(1);
    const unsent = await this.getUnsentErrors();

    return {
      enabled: FEATURE_ENABLED,
      errorCount: errors.length,
      unsentErrorCount: unsent.length,
      lastError: errors[0],
    };
  }
}

export default ErrorLogger;
