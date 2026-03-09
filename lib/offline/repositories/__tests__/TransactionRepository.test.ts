import { TransactionRepository } from '../TransactionRepository';

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

describe('TransactionRepository - Sync Support', () => {
  let repository: TransactionRepository;
  let mockDb: any;

  beforeEach(() => {
    repository = new TransactionRepository();
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

  describe('findAll - Requirement 14.2', () => {
    it('should exclude soft-deleted records (is_deleted = 1)', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = 0'),
        [userId]
      );
    });

    it('should filter by user_id for security', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('user_id = ?'),
        [userId]
      );
    });

    it('should order by transaction_date DESC, created_at DESC', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY transaction_date DESC, created_at DESC'),
        [userId]
      );
    });

    it('should apply limit when provided', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(userId, 10);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 10'),
        [userId]
      );
    });
  });

  describe('getProfit - Requirement 14.2', () => {
    it('should exclude soft-deleted records', async () => {
      const userId = 'user-123';
      mockDb.getFirstAsync.mockResolvedValue({ total: 1000 });

      await repository.getProfit(userId);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = 0'),
        [userId]
      );
    });

    it('should filter by user_id for security', async () => {
      const userId = 'user-123';
      mockDb.getFirstAsync.mockResolvedValue({ total: 1000 });

      await repository.getProfit(userId);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('user_id = ?'),
        [userId]
      );
    });

    it('should return 0 when no transactions exist', async () => {
      const userId = 'user-123';
      mockDb.getFirstAsync.mockResolvedValue({ total: null });

      const result = await repository.getProfit(userId);

      expect(result).toBe(0);
    });
  });

  describe('record - Requirement 14.1, 14.3', () => {
    it('should use BaseRepository.save() for creating transactions', async () => {
      const userId = 'user-123';
      const data = {
        amount: 100,
        category: 'Food',
        description: 'Lunch',
        transaction_date: '2024-01-15',
      };

      await repository.record(userId, data);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO transactions'),
        expect.arrayContaining([
          expect.any(String), // id
          userId,
          data.amount,
          data.category,
          data.description,
          data.transaction_date,
          expect.any(String), // created_at
          expect.any(String), // updated_at
          0, // is_deleted
          'pending', // sync_status
        ])
      );
    });

    it('should set sync_status to pending', async () => {
      const userId = 'user-123';
      const data = {
        amount: 100,
        category: 'Food',
        description: 'Lunch',
      };

      await repository.record(userId, data);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      expect(callArgs[9]).toBe('pending'); // sync_status
    });

    it('should initialize sync_version to 1', async () => {
      const userId = 'user-123';
      const data = {
        amount: 100,
        category: 'Food',
        description: 'Lunch',
      };

      await repository.record(userId, data);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('sync_version'),
        expect.any(Array)
      );
    });

    it('should use current date when transaction_date not provided', async () => {
      const userId = 'user-123';
      const data = {
        amount: 100,
        category: 'Food',
        description: 'Lunch',
      };

      await repository.record(userId, data);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const transactionDate = callArgs[5];
      
      // Should be in YYYY-MM-DD format
      expect(transactionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should filter by user_id for security', async () => {
      const userId = 'user-123';
      const data = {
        amount: 100,
        category: 'Food',
        description: 'Lunch',
      };

      await repository.record(userId, data);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      expect(callArgs[1]).toBe(userId);
    });
  });

  describe('update - Requirement 14.1, 14.3, 14.4', () => {
    beforeEach(() => {
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T10:00:00.000Z',
        sync_version: 1,
      });
    });

    it('should use BaseRepository.save() for updating transactions', async () => {
      const userId = 'user-123';
      const transactionId = 'txn-456';
      const data = {
        amount: 200,
        category: 'Transport',
        description: 'Taxi',
        transaction_date: '2024-01-15',
      };

      await repository.update(userId, transactionId, data);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE transactions'),
        expect.arrayContaining([
          data.amount,
          data.category,
          data.description,
          data.transaction_date,
          expect.any(String), // updated_at
          'pending', // sync_status
          2, // sync_version (incremented from 1)
          transactionId,
          userId,
        ])
      );
    });

    it('should increment sync_version on update', async () => {
      const userId = 'user-123';
      const transactionId = 'txn-456';
      const data = {
        amount: 200,
        category: 'Transport',
        description: 'Taxi',
        transaction_date: '2024-01-15',
      };

      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T10:00:00.000Z',
        sync_version: 5,
      });

      await repository.update(userId, transactionId, data);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      expect(callArgs[6]).toBe(6); // sync_version incremented from 5 to 6
    });

    it('should set sync_status to pending on update', async () => {
      const userId = 'user-123';
      const transactionId = 'txn-456';
      const data = {
        amount: 200,
        category: 'Transport',
        description: 'Taxi',
        transaction_date: '2024-01-15',
      };

      await repository.update(userId, transactionId, data);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      expect(callArgs[5]).toBe('pending'); // sync_status
    });

    it('should update updated_at timestamp', async () => {
      const userId = 'user-123';
      const transactionId = 'txn-456';
      const data = {
        amount: 200,
        category: 'Transport',
        description: 'Taxi',
        transaction_date: '2024-01-15',
      };

      await repository.update(userId, transactionId, data);

      const callArgs = mockDb.runAsync.mock.calls[0][1];
      const updatedAt = callArgs[4];
      
      // Should be in ISO 8601 format
      expect(updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should filter by user_id for security', async () => {
      const userId = 'user-123';
      const transactionId = 'txn-456';
      const data = {
        amount: 200,
        category: 'Transport',
        description: 'Taxi',
        transaction_date: '2024-01-15',
      };

      await repository.update(userId, transactionId, data);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND user_id = ?'),
        expect.arrayContaining([transactionId, userId])
      );
    });

    it('should throw error when transaction not found', async () => {
      const userId = 'user-123';
      const transactionId = 'non-existent';
      const data = {
        amount: 200,
        category: 'Transport',
        description: 'Taxi',
        transaction_date: '2024-01-15',
      };

      mockDb.getFirstAsync.mockResolvedValue(null);

      await expect(repository.update(userId, transactionId, data)).rejects.toThrow(
        'Transaction non-existent not found'
      );
    });

    it('should preserve created_at timestamp on update', async () => {
      const userId = 'user-123';
      const transactionId = 'txn-456';
      const data = {
        amount: 200,
        category: 'Transport',
        description: 'Taxi',
        transaction_date: '2024-01-15',
      };

      const originalCreatedAt = '2024-01-01T10:00:00.000Z';
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: originalCreatedAt,
        sync_version: 1,
      });

      await repository.update(userId, transactionId, data);

      // Verify that we fetch the existing record to preserve created_at
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT created_at, sync_version'),
        [transactionId, userId]
      );
    });
  });
});
