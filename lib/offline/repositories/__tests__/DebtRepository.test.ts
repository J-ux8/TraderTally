import { DebtRepository } from '../DebtRepository';

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

describe('DebtRepository - Sync Support', () => {
  let repository: DebtRepository;
  let mockDb: any;

  beforeEach(() => {
    repository = new DebtRepository();
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

  describe('findAll - Requirement 15.1', () => {
    it('should exclude soft-deleted records (is_deleted = 0)', async () => {
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

    it('should order by created_at DESC', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [userId]
      );
    });
  });

  describe('create - Requirement 15.2', () => {
    it('should use BaseRepository.save() and set sync_status to pending', async () => {
      const userId = 'user-123';
      const debtData = {
        customer_name: 'John Doe',
        amount: 100.50,
        due_date: '2024-12-31',
        note: 'Payment for services',
      };

      await repository.create(userId, debtData);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO debts'),
        expect.arrayContaining([
          expect.any(String), // id
          userId,
          'John Doe',
          100.50,
          '2024-12-31',
          'Payment for services',
          0, // is_settled
          expect.any(String), // created_at
          expect.any(String), // updated_at
          0, // is_deleted
          'pending', // sync_status
        ])
      );
    });

    it('should initialize is_settled to 0', async () => {
      const userId = 'user-123';
      const debtData = {
        customer_name: 'Jane Smith',
        amount: 250,
        due_date: null,
        note: null,
      };

      const result = await repository.create(userId, debtData);

      expect(result.is_settled).toBe(0);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([0]) // is_settled = 0
      );
    });

    it('should trim customer_name and note', async () => {
      const userId = 'user-123';
      const debtData = {
        customer_name: '  John Doe  ',
        amount: 100,
        due_date: null,
        note: '  Some note  ',
      };

      await repository.create(userId, debtData);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          userId,
          'John Doe', // trimmed
          100,
          null,
          'Some note', // trimmed
          expect.any(Number),
          expect.any(String),
          expect.any(String),
          expect.any(Number),
          'pending',
        ])
      );
    });

    it('should convert negative amounts to positive', async () => {
      const userId = 'user-123';
      const debtData = {
        customer_name: 'John Doe',
        amount: -100,
        due_date: null,
        note: null,
      };

      const result = await repository.create(userId, debtData);

      expect(result.amount).toBe(100);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([100])
      );
    });

    it('should set sync_version to 1 on creation', async () => {
      const userId = 'user-123';
      const debtData = {
        customer_name: 'John Doe',
        amount: 100,
        due_date: null,
        note: null,
      };

      await repository.create(userId, debtData);

      const insertCall = mockDb.runAsync.mock.calls[0];
      const query = insertCall[0];
      
      expect(query).toContain('sync_version');
      expect(query).toMatch(/VALUES\s*\([^)]*,\s*1\s*\)/);
    });
  });

  describe('update - Requirement 15.2, 15.3', () => {
    it('should use BaseRepository.save() and increment sync_version', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      const updateData = {
        customer_name: 'Updated Name',
        amount: 200,
        due_date: '2025-01-15',
        note: 'Updated note',
      };
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 2,
        is_settled: 0,
      });

      await repository.update(userId, debtId, updateData);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE debts'),
        expect.arrayContaining([
          'Updated Name',
          200,
          '2025-01-15',
          'Updated note',
          expect.any(String), // updated_at
          'pending', // sync_status
          3, // sync_version incremented from 2 to 3
          debtId,
          userId,
        ])
      );
    });

    it('should preserve is_settled status during update', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      const updateData = {
        customer_name: 'Updated Name',
        amount: 200,
        due_date: null,
        note: null,
      };
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
        is_settled: 1, // Already settled
      });

      await repository.update(userId, debtId, updateData);

      // Verify the UPDATE query doesn't modify is_settled
      const updateCall = mockDb.runAsync.mock.calls[0];
      const query = updateCall[0];
      expect(query).not.toContain('is_settled');
    });

    it('should throw error if debt not found', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      const updateData = {
        customer_name: 'Updated Name',
        amount: 200,
        due_date: null,
        note: null,
      };
      
      mockDb.getFirstAsync.mockResolvedValue(null);

      await expect(repository.update(userId, debtId, updateData))
        .rejects.toThrow('Debt debt-1 not found');
    });

    it('should trim customer_name and note on update', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      const updateData = {
        customer_name: '  Updated Name  ',
        amount: 200,
        due_date: null,
        note: '  Updated note  ',
      };
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
        is_settled: 0,
      });

      await repository.update(userId, debtId, updateData);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'Updated Name', // trimmed
          200,
          null,
          'Updated note', // trimmed
          expect.any(String),
          'pending',
          2,
          debtId,
          userId,
        ])
      );
    });

    it('should convert negative amounts to positive on update', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      const updateData = {
        customer_name: 'Updated Name',
        amount: -300,
        due_date: null,
        note: null,
      };
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
        is_settled: 0,
      });

      await repository.update(userId, debtId, updateData);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'Updated Name',
          300, // converted to positive
          null,
          null,
          expect.any(String),
          'pending',
          2,
          debtId,
          userId,
        ])
      );
    });
  });

  describe('settle - Requirement 15.3, 15.4', () => {
    it('should use BaseRepository.save() and set is_settled to 1', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
      });

      await repository.settle(userId, debtId);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE debts'),
        expect.arrayContaining([
          expect.any(String), // updated_at (settlement timestamp)
          'pending', // sync_status
          2, // sync_version incremented
          debtId,
          userId,
        ])
      );

      const updateCall = mockDb.runAsync.mock.calls[0];
      const query = updateCall[0];
      expect(query).toContain('is_settled = 1');
    });

    it('should increment sync_version when settling', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 5,
      });

      await repository.settle(userId, debtId);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          'pending',
          6, // sync_version incremented from 5 to 6
          debtId,
          userId,
        ])
      );
    });

    it('should update settlement timestamp', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
      });

      const beforeSettle = new Date().toISOString();
      await repository.settle(userId, debtId);
      const afterSettle = new Date().toISOString();

      const updateCall = mockDb.runAsync.mock.calls[0];
      const updatedAt = updateCall[1][0]; // updated_at is first parameter
      
      expect(updatedAt).toBeDefined();
      expect(updatedAt >= beforeSettle).toBe(true);
      expect(updatedAt <= afterSettle).toBe(true);
    });

    it('should throw error if debt not found', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      
      mockDb.getFirstAsync.mockResolvedValue(null);

      await expect(repository.settle(userId, debtId))
        .rejects.toThrow('Debt debt-1 not found');
    });
  });

  describe('Requirement 15.1 - Sync Metadata Management', () => {
    it('should initialize sync metadata on debt creation', async () => {
      const userId = 'user-123';
      const debtData = {
        customer_name: 'John Doe',
        amount: 100,
        due_date: null,
        note: null,
      };

      await repository.create(userId, debtData);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO debts'),
        expect.arrayContaining([
          expect.any(String), // id (UUID)
          userId,
          'John Doe',
          100,
          null,
          null,
          0, // is_settled
          expect.any(String), // created_at (ISO timestamp)
          expect.any(String), // updated_at (ISO timestamp)
          0, // is_deleted
          'pending', // sync_status
        ])
      );
    });

    it('should update updated_at timestamp on modification', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      const updateData = {
        customer_name: 'Updated Name',
        amount: 200,
        due_date: null,
        note: null,
      };
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
        is_settled: 0,
      });

      const beforeUpdate = new Date().toISOString();
      await repository.update(userId, debtId, updateData);
      const afterUpdate = new Date().toISOString();

      const updateCall = mockDb.runAsync.mock.calls[0];
      const updatedAt = updateCall[1][4]; // updated_at is 5th parameter
      
      expect(updatedAt).toBeDefined();
      expect(updatedAt >= beforeUpdate).toBe(true);
      expect(updatedAt <= afterUpdate).toBe(true);
    });
  });

  describe('Requirement 15.1 - User ID Filtering', () => {
    it('should enforce user_id filtering in all queries', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(userId);

      const query = mockDb.getAllAsync.mock.calls[0][0];
      expect(query).toContain('user_id = ?');
      expect(mockDb.getAllAsync.mock.calls[0][1]).toContain(userId);
    });

    it('should prevent cross-user data access in updates', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      const updateData = {
        customer_name: 'Updated Name',
        amount: 200,
        due_date: null,
        note: null,
      };
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
        is_settled: 0,
      });

      await repository.update(userId, debtId, updateData);

      const query = mockDb.runAsync.mock.calls[0][0];
      expect(query).toContain('user_id = ?');
      expect(mockDb.runAsync.mock.calls[0][1]).toContain(userId);
    });

    it('should prevent cross-user data access in settle', async () => {
      const userId = 'user-123';
      const debtId = 'debt-1';
      
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
      });

      await repository.settle(userId, debtId);

      const query = mockDb.runAsync.mock.calls[0][0];
      expect(query).toContain('user_id = ?');
      expect(mockDb.runAsync.mock.calls[0][1]).toContain(userId);
    });
  });

  describe('Requirement 15.2 - Soft Delete Support', () => {
    it('should exclude soft-deleted records from findAll', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([
        {
          id: 'debt-1',
          user_id: userId,
          customer_name: 'John Doe',
          amount: 100,
          is_deleted: 0,
          sync_status: 'synced',
          sync_version: 1,
        },
      ]);

      await repository.findAll(userId);

      const query = mockDb.getAllAsync.mock.calls[0][0];
      expect(query).toContain('is_deleted = 0');
    });
  });

  describe('Integration - Complete CRUD with Sync', () => {
    it('should handle complete lifecycle: create -> update -> settle -> verify sync metadata', async () => {
      const userId = 'user-123';
      
      // Create
      const debtData = {
        customer_name: 'John Doe',
        amount: 100,
        due_date: '2024-12-31',
        note: 'Initial debt',
      };
      await repository.create(userId, debtData);
      
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO debts'),
        expect.arrayContaining([
          expect.any(String),
          userId,
          'John Doe',
          100,
          '2024-12-31',
          'Initial debt',
          0, // is_settled
          expect.any(String),
          expect.any(String),
          0, // is_deleted
          'pending',
        ])
      );

      // Update
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 1,
        is_settled: 0,
      });

      const updateData = {
        customer_name: 'John Doe Updated',
        amount: 150,
        due_date: '2025-01-15',
        note: 'Updated debt',
      };
      await repository.update(userId, 'debt-1', updateData);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE debts'),
        expect.arrayContaining([
          'John Doe Updated',
          150,
          '2025-01-15',
          'Updated debt',
          expect.any(String),
          'pending',
          2, // sync_version incremented
          'debt-1',
          userId,
        ])
      );

      // Settle
      mockDb.getFirstAsync.mockResolvedValue({
        created_at: '2024-01-01T00:00:00Z',
        sync_version: 2,
      });

      await repository.settle(userId, 'debt-1');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE debts'),
        expect.arrayContaining([
          expect.any(String),
          'pending',
          3, // sync_version incremented again
          'debt-1',
          userId,
        ])
      );
    });
  });
});
