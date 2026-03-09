import { SyncLogger, SyncResult, ResolvedRecord } from '../SyncLogger';
import { getDatabase } from '@/lib/database';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock the database module
jest.mock('@/lib/database');

describe('SyncLogger', () => {
  let mockDb: any;
  const testDeviceId = 'test-device-123';

  beforeEach(() => {
    mockDb = {
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn().mockResolvedValue({ device_id: testDeviceId }),
    };

    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logSyncStart', () => {
    it('should create a sync_start log entry and return log ID', async () => {
      const logId = await SyncLogger.logSyncStart();

      expect(logId).toMatch(/^sync-\d+-[a-z0-9]+$/);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_logs'),
        expect.arrayContaining([
          logId,
          expect.any(String), // timestamp
          'sync_start',
          'success',
          testDeviceId,
          '',
          '',
          '',
        ])
      );
    });

    it('should use current timestamp', async () => {
      const beforeTime = Date.now();
      await SyncLogger.logSyncStart();
      const afterTime = Date.now();

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const timestamp = new Date(callArgs[1]).getTime();

      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should include device ID in log entry', async () => {
      await SyncLogger.logSyncStart();

      expect(mockDb.getFirstAsync).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([testDeviceId])
      );
    });
  });

  describe('logSyncComplete', () => {
    it('should log successful sync completion with result details', async () => {
      const logId = 'sync-123';
      const result: SyncResult = {
        success: true,
        uploadedCount: 10,
        downloadedCount: 5,
        conflictsResolved: 2,
        errors: [],
        duration: 1500,
      };

      await SyncLogger.logSyncComplete(logId, result);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_logs'),
        expect.arrayContaining([
          `${logId}-complete`,
          expect.any(String), // timestamp
          'sync_complete',
          'success',
          testDeviceId,
          '',
          '',
          expect.stringContaining('"uploadedCount":10'),
        ])
      );
    });

    it('should include all result metrics in metadata', async () => {
      const logId = 'sync-456';
      const result: SyncResult = {
        success: true,
        uploadedCount: 25,
        downloadedCount: 15,
        conflictsResolved: 3,
        errors: [],
        duration: 2500,
      };

      await SyncLogger.logSyncComplete(logId, result);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const metadata = JSON.parse(callArgs[7]);

      expect(metadata).toEqual({
        uploadedCount: 25,
        downloadedCount: 15,
        conflictsResolved: 3,
        duration_ms: 2500,
      });
    });

    it('should append -complete to log ID', async () => {
      const logId = 'sync-789';
      const result: SyncResult = {
        success: true,
        uploadedCount: 0,
        downloadedCount: 0,
        conflictsResolved: 0,
        errors: [],
        duration: 100,
      };

      await SyncLogger.logSyncComplete(logId, result);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      expect(callArgs[0]).toBe('sync-789-complete');
    });
  });

  describe('logSyncError', () => {
    it('should log sync error with error message', async () => {
      const logId = 'sync-error-123';
      const error = new Error('Network timeout');

      await SyncLogger.logSyncError(logId, error);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_logs'),
        expect.arrayContaining([
          `${logId}-error`,
          expect.any(String), // timestamp
          'sync_error',
          'error',
          testDeviceId,
          '',
          '',
          'Network timeout',
        ])
      );
    });

    it('should handle errors without message', async () => {
      const logId = 'sync-error-456';
      const error = new Error();

      await SyncLogger.logSyncError(logId, error);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      expect(callArgs[7]).toBe('Unknown error');
    });

    it('should append -error to log ID', async () => {
      const logId = 'sync-789';
      const error = new Error('Test error');

      await SyncLogger.logSyncError(logId, error);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      expect(callArgs[0]).toBe('sync-789-error');
    });

    it('should set status to error', async () => {
      const logId = 'sync-fail';
      const error = new Error('Database error');

      await SyncLogger.logSyncError(logId, error);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      expect(callArgs[3]).toBe('error');
    });
  });

  describe('logConflict', () => {
    it('should log conflict resolution with winner and reason', async () => {
      const recordId = 'record-123';
      const resolution: ResolvedRecord = {
        winner: 'server',
        record: { id: recordId, data: 'test' },
        reason: 'Server version is newer',
      };

      await SyncLogger.logConflict(recordId, resolution);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_logs'),
        expect.arrayContaining([
          expect.stringMatching(/^conflict-\d+-[a-z0-9]+$/),
          expect.any(String), // timestamp
          'conflict',
          'success',
          testDeviceId,
          '',
          '',
          expect.stringContaining('"winner":"server"'),
        ])
      );
    });

    it('should include resolution details in metadata', async () => {
      const recordId = 'record-456';
      const resolution: ResolvedRecord = {
        winner: 'local',
        record: { id: recordId },
        reason: 'Local version is newer',
      };

      await SyncLogger.logConflict(recordId, resolution);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const metadata = JSON.parse(callArgs[7]);

      expect(metadata).toEqual({
        winner: 'local',
        reason: 'Local version is newer',
        recordId: 'record-456',
        localVersion: null,
        serverVersion: null,
      });
    });

    it('should include both local and server versions in metadata for debugging', async () => {
      const recordId = 'record-789';
      const localVersion = {
        id: recordId,
        updated_at: '2024-01-01T10:00:00Z',
        data: 'local data',
      };
      const serverVersion = {
        id: recordId,
        updated_at: '2024-01-01T11:00:00Z',
        data: 'server data',
      };
      const resolution: ResolvedRecord = {
        winner: 'server',
        record: serverVersion,
        reason: 'Server version is newer',
      };

      await SyncLogger.logConflict(recordId, resolution, localVersion, serverVersion);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const metadata = JSON.parse(callArgs[7]);

      expect(metadata.localVersion).toEqual(localVersion);
      expect(metadata.serverVersion).toEqual(serverVersion);
      expect(metadata.winner).toBe('server');
      expect(metadata.reason).toBe('Server version is newer');
    });

    it('should handle missing version parameters gracefully', async () => {
      const recordId = 'record-999';
      const resolution: ResolvedRecord = {
        winner: 'local',
        record: { id: recordId },
        reason: 'Test reason',
      };

      await SyncLogger.logConflict(recordId, resolution);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const metadata = JSON.parse(callArgs[7]);

      expect(metadata.localVersion).toBeNull();
      expect(metadata.serverVersion).toBeNull();
    });

    it('should generate unique log ID for each conflict', async () => {
      const recordId = 'record-789';
      const resolution: ResolvedRecord = {
        winner: 'server',
        record: { id: recordId },
        reason: 'Tie-breaker',
      };

      await SyncLogger.logConflict(recordId, resolution);
      await SyncLogger.logConflict(recordId, resolution);

      const firstCallId = mockDb.runAsync.mock.calls[0][1][0];
      const secondCallId = mockDb.runAsync.mock.calls[1][1][0];

      expect(firstCallId).not.toBe(secondCallId);
    });
  });

  describe('getRecentLogs', () => {
    it('should retrieve logs ordered by timestamp descending', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: '2024-01-01T12:00:00Z',
          operation: 'sync_start',
          status: 'success',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: '',
        },
        {
          id: 'log-2',
          timestamp: '2024-01-01T11:00:00Z',
          operation: 'sync_complete',
          status: 'success',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: '{"duration_ms":1500}',
        },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockLogs);

      const logs = await SyncLogger.getRecentLogs(100);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY timestamp DESC'),
        [100]
      );
      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe('log-1');
    });

    it('should parse metadata from JSON error_message', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: '2024-01-01T12:00:00Z',
          operation: 'sync_complete',
          status: 'success',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: '{"uploadedCount":10,"duration_ms":2000}',
        },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockLogs);

      const logs = await SyncLogger.getRecentLogs(10);

      expect(logs[0].metadata).toEqual({
        uploadedCount: 10,
        duration_ms: 2000,
      });
      expect(logs[0].duration_ms).toBe(2000);
      expect(logs[0].error_message).toBeUndefined();
    });

    it('should handle non-JSON error messages', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: '2024-01-01T12:00:00Z',
          operation: 'sync_error',
          status: 'error',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: 'Network timeout',
        },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockLogs);

      const logs = await SyncLogger.getRecentLogs(10);

      expect(logs[0].error_message).toBe('Network timeout');
      expect(logs[0].metadata).toBeUndefined();
    });

    it('should default to 100 logs if no limit specified', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await SyncLogger.getRecentLogs();

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.any(String),
        [100]
      );
    });

    it('should handle empty result set', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const logs = await SyncLogger.getRecentLogs(50);

      expect(logs).toEqual([]);
    });
  });

  describe('exportLogs', () => {
    it('should export logs as JSON string', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: '2024-01-01T12:00:00Z',
          operation: 'sync_start',
          status: 'success',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: '',
        },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockLogs);

      const exported = await SyncLogger.exportLogs();

      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].id).toBe('log-1');
    });

    it('should format JSON with indentation', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          timestamp: '2024-01-01T12:00:00Z',
          operation: 'sync_start',
          status: 'success',
          device_id: testDeviceId,
          user_id: '',
          table_name: '',
          error_message: '',
        },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockLogs);

      const exported = await SyncLogger.exportLogs();

      // Check for indentation (pretty-printed JSON)
      expect(exported).toContain('\n');
    });

    it('should retrieve up to 1000 logs for export', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await SyncLogger.exportLogs();

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.any(String),
        [1000]
      );
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete logs older than 30 days', async () => {
      await SyncLogger.cleanupOldLogs();

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM sync_logs WHERE timestamp < ?'),
        expect.arrayContaining([expect.any(String)])
      );
    });

    it('should calculate cutoff date as 30 days ago', async () => {
      const beforeCleanup = new Date();
      beforeCleanup.setDate(beforeCleanup.getDate() - 30);

      await SyncLogger.cleanupOldLogs();

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const cutoffDate = new Date(callArgs[0]);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 30);

      // Allow 1 second tolerance for test execution time
      expect(Math.abs(cutoffDate.getTime() - expectedDate.getTime())).toBeLessThan(1000);
    });
  });
});
