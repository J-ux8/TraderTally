/**
 * Integration test for TransactionRepository sync support
 * Validates Requirements 14.1, 14.2, 14.3, 14.4
 */

import { TransactionRepository } from '../TransactionRepository';

// Mock database module
jest.mock('../../../database', () => ({
  getDatabase: jest.fn(),
}));

// Mock db-transaction module
jest.mock('../../db-transaction', () => ({
  withTransaction: jest.fn((db, callback) => callback()),
}));

describe('TransactionRepository Integration - Sync Support', () => {
  let repository: TransactionRepository;
  let mockDb: any;
  const testUserId = 'test-user-integration';

  beforeAll(async () => {
    repository = new TransactionRepository();
    
    // Set up mock database
    mockDb = {
      runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
      getFirstAsync: jest.fn(),
      getAllAsync: jest.fn(),
    };

    const { getDatabase } = require('../../../database');
    getDatabase.mockResolvedValue(mockDb);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CRUD operations with sync support', () => {
    it('should create transaction with sync metadata (Req 14.1)', async () => {
      const transactionId = await repository.record(testUserId, {
        amount: 100,
        category: 'Food',
        description: 'Test transaction',
        transaction_date: '2024-01-15',
      });

      expect(transactionId).toBeDefined();
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining([
          expect.any(String), // id
          testUserId,
          100,
          'Food',
          'Test transaction',
          '2024-01-15',
          expect.any(String), // created_at
          expect.any(String), // updated_at
          0, // is_deleted
          'pending', // sync_status
        ])
      );
    });

    it('should update transaction and increment sync_version (Req 14.4)', async () => {
      const transactionId = 'test-txn-123';
      
      // Mock existing transaction
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T10:00:00.000Z',
        sync_version: 3,
      });

      await repository.update(testUserId, transactionId, {
        amount: 200,
        category: 'Transport',
        description: 'Updated',
        transaction_date: '2024-01-16',
      });

      // Verify sync_version was incremented
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE transactions'),
        expect.arrayContaining([
          200,
          'Transport',
          'Updated',
          '2024-01-16',
          expect.any(String), // updated_at
          'pending', // sync_status
          4, // sync_version (incremented from 3)
          transactionId,
          testUserId,
        ])
      );
    });

    it('should exclude soft-deleted records from findAll (Req 14.2)', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        { id: '1', amount: 100, is_deleted: 0 },
        { id: '2', amount: 200, is_deleted: 0 },
      ]);

      await repository.findAll(testUserId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = 0'),
        [testUserId]
      );
    });

    it('should filter by user_id for security (Req 14.3)', async () => {
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(testUserId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('user_id = ?'),
        [testUserId]
      );
    });

    it('should exclude soft-deleted records from getProfit (Req 14.2)', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ total: 100 });

      await repository.getProfit(testUserId);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = 0'),
        [testUserId]
      );
    });

    it('should handle multiple updates with sync_version increments (Req 14.4)', async () => {
      const transactionId = 'test-txn-multi';

      // Simulate multiple updates
      for (let i = 1; i <= 5; i++) {
        mockDb.getFirstAsync.mockResolvedValue({
          created_at: '2024-01-01T10:00:00.000Z',
          sync_version: i,
        });

        await repository.update(testUserId, transactionId, {
          amount: 100 + i * 10,
          category: 'Food',
          description: `Update ${i}`,
          transaction_date: '2024-01-15',
        });

        const lastCall = mockDb.runAsync.mock.calls[mockDb.runAsync.mock.calls.length - 1];
        expect(lastCall[1][6]).toBe(i + 1); // sync_version should be incremented
      }
    });
  });

  describe('Sync status management', () => {
    it('should support updateSyncStatus from BaseRepository', async () => {
      const transactionId = 'test-txn-status';

      // Update sync status to syncing
      await repository.updateSyncStatus(transactionId, testUserId, 'syncing');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = ?"),
        ['syncing', transactionId, testUserId]
      );

      // Update sync status to synced
      await repository.updateSyncStatus(transactionId, testUserId, 'synced');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("SET sync_status = ?"),
        ['synced', transactionId, testUserId]
      );
    });

    it('should support getPendingSync from BaseRepository', async () => {
      mockDb.getAllAsync.mockResolvedValue([
        { id: '1', sync_status: 'pending', is_deleted: 0 },
        { id: '2', sync_status: 'failed', is_deleted: 0 },
      ]);

      const pendingRecords = await repository.getPendingSync(testUserId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending' OR sync_status = 'failed'"),
        [testUserId]
      );
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = 0'),
        [testUserId]
      );
      expect(pendingRecords.length).toBe(2);
    });
  });
});
