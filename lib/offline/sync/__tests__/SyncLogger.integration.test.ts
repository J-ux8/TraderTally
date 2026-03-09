import { SyncLogger, SyncResult, ResolvedRecord } from '../SyncLogger';
import { getDatabase } from '@/lib/database';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock the database module
jest.mock('@/lib/database');

describe('SyncLogger Integration Tests', () => {
  let mockDb: any;
  const testDeviceId = 'integration-device-123';
  let logStore: Map<string, any>;

  beforeEach(() => {
    logStore = new Map();

    mockDb = {
      getFirstAsync: jest.fn().mockResolvedValue({ device_id: testDeviceId }),
      runAsync: jest.fn(async (query: string, params: any[]) => {
        if (query.includes('INSERT INTO sync_logs')) {
          const [id, timestamp, operation, status, device_id, user_id, table_name, error_message] = params;
          logStore.set(id, {
            id,
            timestamp,
            operation,
            status,
            device_id,
            user_id,
            table_name,
            error_message,
          });
        } else if (query.includes('DELETE FROM sync_logs')) {
          const cutoffDate = params[0];
          logStore.forEach((log, id) => {
            if (log.timestamp < cutoffDate) {
              logStore.delete(id);
            }
          });
        }
      }),
      getAllAsync: jest.fn(async (query: string, params: any[]) => {
        const limit = params[0];
        const logs = Array.from(logStore.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit);
        return logs;
      }),
    };

    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Sync Workflow', () => {
    it('should log complete sync lifecycle: start -> complete', async () => {
      // Start sync
      const logId = await SyncLogger.logSyncStart();
      expect(logStore.has(logId)).toBe(true);
      expect(logStore.get(logId).operation).toBe('sync_start');

      // Complete sync
      const result: SyncResult = {
        success: true,
        uploadedCount: 15,
        downloadedCount: 10,
        conflictsResolved: 2,
        errors: [],
        duration: 2500,
      };
      await SyncLogger.logSyncComplete(logId, result);

      expect(logStore.has(`${logId}-complete`)).toBe(true);
      const completeLog = logStore.get(`${logId}-complete`);
      expect(completeLog.operation).toBe('sync_complete');
      expect(completeLog.status).toBe('success');
    });

    it('should log complete sync lifecycle: start -> error', async () => {
      // Start sync
      const logId = await SyncLogger.logSyncStart();

      // Sync fails
      const error = new Error('Network connection lost');
      await SyncLogger.logSyncError(logId, error);

      expect(logStore.has(`${logId}-error`)).toBe(true);
      const errorLog = logStore.get(`${logId}-error`);
      expect(errorLog.operation).toBe('sync_error');
      expect(errorLog.status).toBe('error');
      expect(errorLog.error_message).toBe('Network connection lost');
    });

    it('should log multiple conflicts during sync', async () => {
      const conflicts = [
        { recordId: 'record-1', winner: 'server' as const, reason: 'Server newer' },
        { recordId: 'record-2', winner: 'local' as const, reason: 'Local newer' },
        { recordId: 'record-3', winner: 'server' as const, reason: 'Tie-breaker' },
      ];

      for (const conflict of conflicts) {
        const resolution: ResolvedRecord = {
          winner: conflict.winner,
          record: { id: conflict.recordId },
          reason: conflict.reason,
        };
        await SyncLogger.logConflict(conflict.recordId, resolution);
      }

      const conflictLogs = Array.from(logStore.values()).filter(
        log => log.operation === 'conflict'
      );
      expect(conflictLogs).toHaveLength(3);
    });
  });

  describe('Log Retrieval and Export', () => {
    it('should retrieve logs in correct order', async () => {
      // Create logs with different timestamps
      const logs = [
        { id: 'log-1', timestamp: '2024-01-01T10:00:00Z', operation: 'sync_start' },
        { id: 'log-2', timestamp: '2024-01-01T11:00:00Z', operation: 'sync_complete' },
        { id: 'log-3', timestamp: '2024-01-01T09:00:00Z', operation: 'sync_error' },
      ];

      for (const log of logs) {
        logStore.set(log.id, {
          ...log,
          status: 'success',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: '',
        });
      }

      const retrieved = await SyncLogger.getRecentLogs(10);

      // Should be ordered by timestamp descending
      expect(retrieved[0].id).toBe('log-2'); // 11:00
      expect(retrieved[1].id).toBe('log-1'); // 10:00
      expect(retrieved[2].id).toBe('log-3'); // 09:00
    });

    it('should respect limit parameter', async () => {
      // Create 50 logs
      for (let i = 0; i < 50; i++) {
        logStore.set(`log-${i}`, {
          id: `log-${i}`,
          timestamp: new Date(2024, 0, 1, 10, i).toISOString(),
          operation: 'sync_start',
          status: 'success',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: '',
        });
      }

      const retrieved = await SyncLogger.getRecentLogs(20);
      expect(retrieved).toHaveLength(20);
    });

    it('should export all logs as valid JSON', async () => {
      // Create some logs
      await SyncLogger.logSyncStart();
      await SyncLogger.logSyncStart();

      const exported = await SyncLogger.exportLogs();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0]).toHaveProperty('timestamp');
      expect(parsed[0]).toHaveProperty('operation');
    });
  });

  describe('Metadata Handling', () => {
    it('should correctly parse and return metadata from sync_complete logs', async () => {
      const logId = await SyncLogger.logSyncStart();
      const result: SyncResult = {
        success: true,
        uploadedCount: 25,
        downloadedCount: 15,
        conflictsResolved: 5,
        errors: [],
        duration: 3500,
      };
      await SyncLogger.logSyncComplete(logId, result);

      const logs = await SyncLogger.getRecentLogs(10);
      const completeLog = logs.find(log => log.operation === 'sync_complete');

      expect(completeLog).toBeDefined();
      expect(completeLog!.metadata).toEqual({
        uploadedCount: 25,
        downloadedCount: 15,
        conflictsResolved: 5,
        duration_ms: 3500,
      });
      expect(completeLog!.duration_ms).toBe(3500);
    });

    it('should correctly parse and return metadata from conflict logs', async () => {
      const recordId = 'test-record-123';
      const resolution: ResolvedRecord = {
        winner: 'local',
        record: { id: recordId, data: 'test' },
        reason: 'Local version has more recent timestamp',
      };
      await SyncLogger.logConflict(recordId, resolution);

      const logs = await SyncLogger.getRecentLogs(10);
      const conflictLog = logs.find(log => log.operation === 'conflict');

      expect(conflictLog).toBeDefined();
      expect(conflictLog!.metadata).toEqual({
        winner: 'local',
        reason: 'Local version has more recent timestamp',
        recordId: 'test-record-123',
        localVersion: null,
        serverVersion: null,
      });
    });

    it('should handle error messages without metadata', async () => {
      const logId = await SyncLogger.logSyncStart();
      const error = new Error('Database connection failed');
      await SyncLogger.logSyncError(logId, error);

      const logs = await SyncLogger.getRecentLogs(10);
      const errorLog = logs.find(log => log.operation === 'sync_error');

      expect(errorLog).toBeDefined();
      expect(errorLog!.error_message).toBe('Database connection failed');
      expect(errorLog!.metadata).toBeUndefined();
    });
  });

  describe('Log Cleanup', () => {
    it('should delete logs older than 30 days', async () => {
      const now = new Date();
      const thirtyOneDaysAgo = new Date(now);
      thirtyOneDaysAgo.setDate(now.getDate() - 31);
      const twentyNineDaysAgo = new Date(now);
      twentyNineDaysAgo.setDate(now.getDate() - 29);

      // Create old and recent logs
      logStore.set('old-log', {
        id: 'old-log',
        timestamp: thirtyOneDaysAgo.toISOString(),
        operation: 'sync_start',
        status: 'success',
        device_id: testDeviceId,
        user_id: '',
        table_name: '',
        error_message: '',
      });

      logStore.set('recent-log', {
        id: 'recent-log',
        timestamp: twentyNineDaysAgo.toISOString(),
        operation: 'sync_start',
        status: 'success',
        device_id: testDeviceId,
        user_id: '',
        table_name: '',
        error_message: '',
      });

      await SyncLogger.cleanupOldLogs();

      expect(logStore.has('old-log')).toBe(false);
      expect(logStore.has('recent-log')).toBe(true);
    });

    it('should not affect recent logs during cleanup', async () => {
      // Create 10 recent logs
      for (let i = 0; i < 10; i++) {
        logStore.set(`recent-${i}`, {
          id: `recent-${i}`,
          timestamp: new Date().toISOString(),
          operation: 'sync_start',
          status: 'success',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: '',
        });
      }

      const beforeCount = logStore.size;
      await SyncLogger.cleanupOldLogs();
      const afterCount = logStore.size;

      expect(afterCount).toBe(beforeCount);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent log writes', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(SyncLogger.logSyncStart());
      }

      const logIds = await Promise.all(promises);

      expect(logIds).toHaveLength(10);
      expect(new Set(logIds).size).toBe(10); // All unique
      expect(logStore.size).toBe(10);
    });

    it('should handle concurrent conflict logging', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        const resolution: ResolvedRecord = {
          winner: i % 2 === 0 ? 'server' : 'local',
          record: { id: `record-${i}` },
          reason: `Test reason ${i}`,
        };
        promises.push(SyncLogger.logConflict(`record-${i}`, resolution));
      }

      await Promise.all(promises);

      const conflictLogs = Array.from(logStore.values()).filter(
        log => log.operation === 'conflict'
      );
      expect(conflictLogs).toHaveLength(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty log store', async () => {
      const logs = await SyncLogger.getRecentLogs(100);
      expect(logs).toEqual([]);
    });

    it('should handle export with no logs', async () => {
      const exported = await SyncLogger.exportLogs();
      const parsed = JSON.parse(exported);
      expect(parsed).toEqual([]);
    });

    it('should handle malformed JSON in error_message gracefully', async () => {
      logStore.set('malformed-log', {
        id: 'malformed-log',
        timestamp: new Date().toISOString(),
        operation: 'sync_error',
        status: 'error',
        device_id: testDeviceId,
        user_id: '',
        table_name: '',
        error_message: '{invalid json',
      });

      const logs = await SyncLogger.getRecentLogs(10);
      const malformedLog = logs.find(log => log.id === 'malformed-log');

      expect(malformedLog).toBeDefined();
      expect(malformedLog!.error_message).toBe('{invalid json');
      expect(malformedLog!.metadata).toBeUndefined();
    });

    it('should handle very long error messages', async () => {
      const logId = await SyncLogger.logSyncStart();
      const longMessage = 'Error: ' + 'x'.repeat(10000);
      const error = new Error(longMessage);

      await SyncLogger.logSyncError(logId, error);

      const logs = await SyncLogger.getRecentLogs(10);
      const errorLog = logs.find(log => log.operation === 'sync_error');

      expect(errorLog).toBeDefined();
      expect(errorLog!.error_message).toBe(longMessage);
    });
  });
});
