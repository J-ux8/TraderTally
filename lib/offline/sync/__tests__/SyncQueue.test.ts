import { SyncQueue } from '../SyncQueue';
import { getDatabase } from '@/lib/database';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock the database module
jest.mock('@/lib/database');

describe('SyncQueue', () => {
  let mockDb: any;
  const testUserId = 'test-user-123';
  const testTableName = 'transactions';

  beforeEach(() => {
    // Create a mock database with all required methods
    mockDb = {
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
      runAsync: jest.fn(),
    };

    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getNextBatch', () => {
    it('should fetch up to 50 pending records ordered by updated_at', async () => {
      const mockRecords = [
        {
          id: '1',
          user_id: testUserId,
          sync_status: 'pending',
          sync_version: 1,
          retry_count: 0,
          updated_at: '2024-01-01T10:00:00Z',
          amount: 100,
        },
        {
          id: '2',
          user_id: testUserId,
          sync_status: 'pending',
          sync_version: 1,
          retry_count: 0,
          updated_at: '2024-01-01T11:00:00Z',
          amount: 200,
        },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockRecords);

      const result = await SyncQueue.getNextBatch(testTableName, testUserId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY updated_at ASC'),
        [testUserId, 50]
      );
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[0].table_name).toBe(testTableName);
      expect(result[0].data).toEqual(mockRecords[0]);
    });

    it('should include failed records in the batch', async () => {
      const mockRecords = [
        {
          id: '1',
          user_id: testUserId,
          sync_status: 'failed',
          sync_version: 1,
          retry_count: 3,
          updated_at: '2024-01-01T10:00:00Z',
        },
      ];

      mockDb.getAllAsync.mockResolvedValue(mockRecords);

      const result = await SyncQueue.getNextBatch(testTableName, testUserId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending' OR sync_status = 'failed'"),
        [testUserId, 50]
      );
      expect(result).toHaveLength(1);
      expect(result[0].sync_status).toBe('failed');
    });

    it('should return empty array when no pending records', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      const result = await SyncQueue.getNextBatch(testTableName, testUserId);

      expect(result).toEqual([]);
    });
  });

  describe('markAsSyncing', () => {
    it('should update sync_status to syncing for given record IDs', async () => {
      const recordIds = ['1', '2', '3'];

      await SyncQueue.markAsSyncing(testTableName, recordIds);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = 'syncing'"),
        recordIds
      );
    });

    it('should handle empty record IDs array', async () => {
      await SyncQueue.markAsSyncing(testTableName, []);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('markAsSynced', () => {
    it('should update sync_status to synced and reset retry_count', async () => {
      const recordIds = ['1', '2'];

      await SyncQueue.markAsSynced(testTableName, recordIds);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = 'synced', retry_count = 0"),
        recordIds
      );
    });

    it('should handle empty record IDs array', async () => {
      await SyncQueue.markAsSynced(testTableName, []);

      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('markAsFailed', () => {
    it('should increment retry_count and keep status as pending when retry_count < 10', async () => {
      const recordIds = ['1'];
      mockDb.getFirstAsync.mockResolvedValue({ retry_count: 3 });

      await SyncQueue.markAsFailed(testTableName, recordIds, 'Network error');

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT retry_count'),
        ['1']
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['pending', 4, '1']
      );
    });

    it('should set status to failed when retry_count reaches 10', async () => {
      const recordIds = ['1'];
      mockDb.getFirstAsync.mockResolvedValue({ retry_count: 9 });

      await SyncQueue.markAsFailed(testTableName, recordIds, 'Network error');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['failed', 10, '1']
      );
    });

    it('should log error to sync_logs', async () => {
      const recordIds = ['1'];
      const errorMessage = 'Network timeout';
      mockDb.getFirstAsync.mockResolvedValue({ retry_count: 0 });

      await SyncQueue.markAsFailed(testTableName, recordIds, errorMessage);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_logs'),
        expect.arrayContaining([expect.any(String), '', testTableName, errorMessage, expect.any(String)])
      );
    });

    it('should handle empty record IDs array', async () => {
      await SyncQueue.markAsFailed(testTableName, [], 'Error');

      expect(mockDb.getFirstAsync).not.toHaveBeenCalled();
    });
  });

  describe('getPendingCount', () => {
    it('should return total count of pending records across all tables', async () => {
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ count: 5 })  // transactions
        .mockResolvedValueOnce({ count: 3 })  // categories
        .mockResolvedValueOnce({ count: 2 }); // debts

      const result = await SyncQueue.getPendingCount(testUserId);

      expect(result).toBe(10);
      expect(mockDb.getFirstAsync).toHaveBeenCalledTimes(3);
    });

    it('should include failed and syncing records in count', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 5 });

      await SyncQueue.getPendingCount(testUserId);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending' OR sync_status = 'failed' OR sync_status = 'syncing'"),
        [testUserId]
      );
    });

    it('should return 0 when no pending records', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 0 });

      const result = await SyncQueue.getPendingCount(testUserId);

      expect(result).toBe(0);
    });
  });

  describe('markAsOffline', () => {
    it('should update pending records to offline status', async () => {
      await SyncQueue.markAsOffline(testUserId);

      expect(mockDb.runAsync).toHaveBeenCalledTimes(3); // transactions, categories, debts
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = 'offline'"),
        [testUserId]
      );
    });
  });

  describe('markOfflineAsPending', () => {
    it('should update offline records to pending status', async () => {
      await SyncQueue.markOfflineAsPending(testUserId);

      expect(mockDb.runAsync).toHaveBeenCalledTimes(3); // transactions, categories, debts
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = 'pending'"),
        [testUserId]
      );
    });
  });
});
