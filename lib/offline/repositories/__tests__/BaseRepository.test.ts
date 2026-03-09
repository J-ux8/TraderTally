import * as SQLite from 'expo-sqlite';
import { BaseRepository } from '../BaseRepository';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock database module
jest.mock('../../../database', () => ({
  getDatabase: jest.fn(),
}));

// Mock db-transaction module
jest.mock('../../db-transaction', () => ({
  withTransaction: jest.fn((db, callback) => callback()),
}));

// Concrete implementation for testing
class TestRepository extends BaseRepository<{ id?: string; name: string }> {
  constructor() {
    super('test_table');
  }

  async create(userId: string, data: { name: string }): Promise<string> {
    return this.save(userId, data, async (dbObj) => {
      // Mock implementation
    });
  }

  // Expose getPendingSync for testing
  async testGetPendingSync(userId: string) {
    return this.getPendingSync(userId);
  }

  // Expose updateSyncStatus for testing
  async testUpdateSyncStatus(
    id: string,
    userId: string,
    status: 'pending' | 'syncing' | 'synced' | 'failed' | 'offline'
  ) {
    return this.updateSyncStatus(id, userId, status);
  }
}

describe('BaseRepository', () => {
  let repository: TestRepository;
  let mockDb: any;

  beforeEach(() => {
    repository = new TestRepository();
    mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    };

    const { getDatabase } = require('../../../database');
    getDatabase.mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('softDelete', () => {
    it('should set is_deleted = 1', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.softDelete(recordId, userId);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('SET is_deleted = 1'),
        expect.arrayContaining([expect.any(String), recordId, userId])
      );
    });

    it('should set sync_status = pending', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.softDelete(recordId, userId);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending'"),
        expect.arrayContaining([expect.any(String), recordId, userId])
      );
    });

    it('should increment sync_version', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.softDelete(recordId, userId);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('sync_version = sync_version + 1'),
        expect.arrayContaining([expect.any(String), recordId, userId])
      );
    });

    it('should update updated_at timestamp', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.softDelete(recordId, userId);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('updated_at = ?'),
        expect.arrayContaining([expect.any(String), recordId, userId])
      );
    });

    it('should filter by user_id for security', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.softDelete(recordId, userId);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND user_id = ?'),
        expect.arrayContaining([expect.any(String), recordId, userId])
      );
    });

    it('should use ISO timestamp format', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.softDelete(recordId, userId);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const timestamp = callArgs[0];

      // Verify ISO 8601 format
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('getPendingSync', () => {
    it('should query records with sync_status = pending or failed', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.testGetPendingSync(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending' OR sync_status = 'failed'"),
        [userId]
      );
    });

    it('should exclude soft-deleted records', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.testGetPendingSync(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = 0'),
        [userId]
      );
    });

    it('should order by updated_at ascending (oldest first)', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.testGetPendingSync(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY updated_at ASC'),
        [userId]
      );
    });

    it('should filter by user_id for security', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.testGetPendingSync(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ?'),
        [userId]
      );
    });

    it('should return pending records', async () => {
      const userId = 'user-123';
      const mockRecords = [
        { id: '1', name: 'Record 1', sync_status: 'pending', updated_at: '2024-01-01T10:00:00.000Z' },
        { id: '2', name: 'Record 2', sync_status: 'failed', updated_at: '2024-01-01T09:00:00.000Z' },
      ];
      mockDb.getAllAsync.mockResolvedValue(mockRecords);

      const result = await repository.testGetPendingSync(userId);

      expect(result).toEqual(mockRecords);
    });

    it('should return empty array when no pending records', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      const result = await repository.testGetPendingSync(userId);

      expect(result).toEqual([]);
    });
  });

  describe('updateSyncStatus', () => {
    it('should update sync_status to pending', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.testUpdateSyncStatus(recordId, userId, 'pending');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = ?"),
        ['pending', recordId, userId]
      );
    });

    it('should update sync_status to syncing', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.testUpdateSyncStatus(recordId, userId, 'syncing');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = ?"),
        ['syncing', recordId, userId]
      );
    });

    it('should update sync_status to synced', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.testUpdateSyncStatus(recordId, userId, 'synced');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = ?"),
        ['synced', recordId, userId]
      );
    });

    it('should update sync_status to failed', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.testUpdateSyncStatus(recordId, userId, 'failed');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = ?"),
        ['failed', recordId, userId]
      );
    });

    it('should update sync_status to offline', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.testUpdateSyncStatus(recordId, userId, 'offline');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = ?"),
        ['offline', recordId, userId]
      );
    });

    it('should filter by user_id for security', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.testUpdateSyncStatus(recordId, userId, 'synced');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND user_id = ?'),
        ['synced', recordId, userId]
      );
    });

    it('should use correct table name', async () => {
      const recordId = 'test-id-123';
      const userId = 'user-456';

      await repository.testUpdateSyncStatus(recordId, userId, 'synced');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE test_table'),
        ['synced', recordId, userId]
      );
    });
  });
});
