import { CategoryRepository } from '../CategoryRepository';

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

describe('CategoryRepository - Sync Support', () => {
  let repository: CategoryRepository;
  let mockDb: any;

  beforeEach(() => {
    repository = new CategoryRepository();
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

  describe('findAll - Requirement 13.2', () => {
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

    it('should order by name ASC', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(userId);

      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY name ASC'),
        [userId]
      );
    });
  });

  describe('findByNormalizedName - Requirement 13.3', () => {
    it('should exclude soft-deleted records', async () => {
      const userId = 'user-123';
      const normalizedName = 'food';
      mockDb.getFirstAsync.mockResolvedValue(null);

      await repository.findByNormalizedName(userId, normalizedName);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('is_deleted = 0'),
        [userId, normalizedName]
      );
    });

    it('should filter by user_id and normalized_name', async () => {
      const userId = 'user-123';
      const normalizedName = 'food';
      mockDb.getFirstAsync.mockResolvedValue(null);

      await repository.findByNormalizedName(userId, normalizedName);

      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('user_id = ?'),
        [userId, normalizedName]
      );
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        expect.stringContaining('normalized_name = ?'),
        [userId, normalizedName]
      );
    });
  });

  describe('createCategory - Requirement 13.2', () => {
    it('should use BaseRepository.save() and set sync_status to pending', async () => {
      const userId = 'user-123';
      const name = 'Food';
      mockDb.getFirstAsync.mockResolvedValue(null); // No existing category

      await repository.createCategory(userId, name);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        expect.arrayContaining([
          expect.any(String), // id
          userId,
          'Food',
          'food', // normalized_name
          expect.any(String), // created_at
          expect.any(String), // updated_at
          0, // is_deleted
          'pending', // sync_status
        ])
      );
    });

    it('should return existing category if normalized_name already exists', async () => {
      const userId = 'user-123';
      const name = 'Food';
      const existingCategory = {
        id: 'cat-1',
        user_id: userId,
        name: 'food',
        normalized_name: 'food',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: 0,
        sync_status: 'synced',
        sync_version: 1,
      };
      mockDb.getFirstAsync.mockResolvedValue(existingCategory);

      const result = await repository.createCategory(userId, name);

      expect(result).toEqual(existingCategory);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('should normalize category name to lowercase', async () => {
      const userId = 'user-123';
      const name = 'FOOD';
      mockDb.getFirstAsync.mockResolvedValue(null);

      await repository.createCategory(userId, name);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.any(String),
          userId,
          'FOOD', // original name preserved
          'food', // normalized_name is lowercase
          expect.any(String),
          expect.any(String),
          0,
          'pending',
        ])
      );
    });
  });

  describe('updateCategory - Requirement 13.2', () => {
    it('should use BaseRepository.save() and increment sync_version', async () => {
      const userId = 'user-123';
      const categoryId = 'cat-1';
      const newName = 'Updated Food';
      
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null) // findByNormalizedName check
        .mockResolvedValueOnce({ // existing record check
          created_at: '2024-01-01T00:00:00Z',
          sync_version: 1,
        });

      await repository.updateCategory(userId, categoryId, newName);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE categories'),
        expect.arrayContaining([
          'Updated Food',
          'updated food',
          expect.any(String), // updated_at
          'pending', // sync_status
          2, // sync_version incremented from 1 to 2
          categoryId,
          userId,
        ])
      );
    });

    it('should throw error if category with same normalized_name exists', async () => {
      const userId = 'user-123';
      const categoryId = 'cat-1';
      const newName = 'Food';
      
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'cat-2', // Different ID
        user_id: userId,
        name: 'food',
        normalized_name: 'food',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: 0,
        sync_status: 'synced',
        sync_version: 1,
      });

      await expect(repository.updateCategory(userId, categoryId, newName))
        .rejects.toThrow('A category with this name already exists');
    });

    it('should allow updating to same name (same category)', async () => {
      const userId = 'user-123';
      const categoryId = 'cat-1';
      const newName = 'Food';
      
      mockDb.getFirstAsync
        .mockResolvedValueOnce({ // findByNormalizedName returns same category
          id: categoryId,
          user_id: userId,
          name: 'Food',
          normalized_name: 'food',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_deleted: 0,
          sync_status: 'synced',
          sync_version: 1,
        })
        .mockResolvedValueOnce({ // existing record check
          created_at: '2024-01-01T00:00:00Z',
          sync_version: 1,
        });

      await repository.updateCategory(userId, categoryId, newName);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE categories'),
        expect.any(Array)
      );
    });

    it('should throw error if category not found', async () => {
      const userId = 'user-123';
      const categoryId = 'cat-1';
      const newName = 'Food';
      
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null) // findByNormalizedName check
        .mockResolvedValueOnce(null); // existing record not found

      await expect(repository.updateCategory(userId, categoryId, newName))
        .rejects.toThrow('Category cat-1 not found');
    });
  });

  describe('validateBeforeDelete - Requirement 13.2', () => {
    it('should prevent deletion if category is in use by transactions', async () => {
      const categoryId = 'cat-1';
      mockDb.getAllAsync.mockResolvedValue([{ id: 'txn-1' }]); // Has linked transactions

      await expect(repository['validateBeforeDelete'](categoryId))
        .rejects.toThrow('Cannot delete category: Activity exists');
    });

    it('should allow deletion if category is not in use', async () => {
      const categoryId = 'cat-1';
      mockDb.getAllAsync.mockResolvedValue([]); // No linked transactions

      await expect(repository['validateBeforeDelete'](categoryId))
        .resolves.not.toThrow();
    });
  });

  describe('Requirement 13.1 - Sync Metadata Management', () => {
    it('should initialize sync metadata on category creation', async () => {
      const userId = 'user-123';
      const name = 'Food';
      mockDb.getFirstAsync.mockResolvedValue(null);

      await repository.createCategory(userId, name);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        expect.arrayContaining([
          expect.any(String), // id (UUID)
          userId,
          'Food',
          'food',
          expect.any(String), // created_at (ISO timestamp)
          expect.any(String), // updated_at (ISO timestamp)
          0, // is_deleted
          'pending', // sync_status
        ])
      );
    });

    it('should set sync_version to 1 on creation', async () => {
      const userId = 'user-123';
      const name = 'Food';
      mockDb.getFirstAsync.mockResolvedValue(null);

      await repository.createCategory(userId, name);

      const insertCall = mockDb.runAsync.mock.calls[0];
      const query = insertCall[0];
      
      // Verify sync_version is in the INSERT query
      expect(query).toContain('sync_version');
      // The query should have "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)" where 1 is sync_version
      expect(query).toMatch(/VALUES\s*\([^)]*,\s*1\s*\)/);
    });

    it('should increment sync_version on update', async () => {
      const userId = 'user-123';
      const categoryId = 'cat-1';
      const newName = 'Updated Food';
      
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          created_at: '2024-01-01T00:00:00Z',
          sync_version: 3, // Current version is 3
        });

      await repository.updateCategory(userId, categoryId, newName);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE categories'),
        expect.arrayContaining([
          'Updated Food',
          'updated food',
          expect.any(String),
          'pending',
          4, // sync_version incremented to 4
          categoryId,
          userId,
        ])
      );
    });

    it('should update updated_at timestamp on modification', async () => {
      const userId = 'user-123';
      const categoryId = 'cat-1';
      const newName = 'Updated Food';
      
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          created_at: '2024-01-01T00:00:00Z',
          sync_version: 1,
        });

      const beforeUpdate = new Date().toISOString();
      await repository.updateCategory(userId, categoryId, newName);
      const afterUpdate = new Date().toISOString();

      const updateCall = mockDb.runAsync.mock.calls[0];
      const updatedAt = updateCall[1][2]; // updated_at is 3rd parameter
      
      expect(updatedAt).toBeDefined();
      expect(updatedAt >= beforeUpdate).toBe(true);
      expect(updatedAt <= afterUpdate).toBe(true);
    });
  });

  describe('Requirement 13.3 - User ID Filtering', () => {
    it('should enforce user_id filtering in all queries', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([]);

      await repository.findAll(userId);

      const query = mockDb.getAllAsync.mock.calls[0][0];
      expect(query).toContain('user_id = ?');
      expect(mockDb.getAllAsync.mock.calls[0][1]).toContain(userId);
    });

    it('should prevent cross-user data access in findByNormalizedName', async () => {
      const userId = 'user-123';
      const normalizedName = 'food';
      mockDb.getFirstAsync.mockResolvedValue(null);

      await repository.findByNormalizedName(userId, normalizedName);

      const query = mockDb.getFirstAsync.mock.calls[0][0];
      expect(query).toContain('user_id = ?');
      expect(mockDb.getFirstAsync.mock.calls[0][1][0]).toBe(userId);
    });
  });

  describe('Requirement 13.4 - Normalized Name Uniqueness', () => {
    it('should enforce uniqueness per user during creation', async () => {
      const userId = 'user-123';
      const existingCategory = {
        id: 'cat-1',
        user_id: userId,
        name: 'Food',
        normalized_name: 'food',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: 0,
        sync_status: 'synced',
        sync_version: 1,
      };
      mockDb.getFirstAsync.mockResolvedValue(existingCategory);

      const result = await repository.createCategory(userId, 'FOOD');

      // Should return existing category instead of creating duplicate
      expect(result).toEqual(existingCategory);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('should enforce uniqueness per user during update', async () => {
      const userId = 'user-123';
      const categoryId = 'cat-1';
      
      // Another category with the target name exists
      mockDb.getFirstAsync.mockResolvedValue({
        id: 'cat-2', // Different category
        user_id: userId,
        name: 'Transport',
        normalized_name: 'transport',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: 0,
        sync_status: 'synced',
        sync_version: 1,
      });

      await expect(repository.updateCategory(userId, categoryId, 'Transport'))
        .rejects.toThrow('A category with this name already exists');
    });

    it('should handle case-insensitive uniqueness', async () => {
      const userId = 'user-123';
      const existingCategory = {
        id: 'cat-1',
        user_id: userId,
        name: 'food',
        normalized_name: 'food',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        is_deleted: 0,
        sync_status: 'synced',
        sync_version: 1,
      };
      mockDb.getFirstAsync.mockResolvedValue(existingCategory);

      // Try to create with different case
      const result = await repository.createCategory(userId, 'FOOD');

      expect(result).toEqual(existingCategory);
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('should allow same normalized_name for different users', async () => {
      const user1 = 'user-123';
      const user2 = 'user-456';
      
      // User 1 creates 'Food'
      mockDb.getFirstAsync.mockResolvedValue(null);
      await repository.createCategory(user1, 'Food');
      
      // User 2 should be able to create 'Food' as well
      mockDb.getFirstAsync.mockResolvedValue(null);
      await repository.createCategory(user2, 'Food');

      // Both should have been inserted
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Requirement 13.2 - Soft Delete Support', () => {
    it('should exclude soft-deleted records from findAll', async () => {
      const userId = 'user-123';
      mockDb.getAllAsync.mockResolvedValue([
        {
          id: 'cat-1',
          user_id: userId,
          name: 'Food',
          normalized_name: 'food',
          is_deleted: 0,
          sync_status: 'synced',
          sync_version: 1,
        },
      ]);

      await repository.findAll(userId);

      const query = mockDb.getAllAsync.mock.calls[0][0];
      expect(query).toContain('is_deleted = 0');
    });

    it('should exclude soft-deleted records from findByNormalizedName', async () => {
      const userId = 'user-123';
      mockDb.getFirstAsync.mockResolvedValue(null);

      await repository.findByNormalizedName(userId, 'food');

      const query = mockDb.getFirstAsync.mock.calls[0][0];
      expect(query).toContain('is_deleted = 0');
    });

    it('should allow creating category with same name as soft-deleted one', async () => {
      const userId = 'user-123';
      
      // Soft-deleted category exists but should not be returned
      mockDb.getFirstAsync.mockResolvedValue(null);

      await repository.createCategory(userId, 'Food');

      // Should create new category
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        expect.any(Array)
      );
    });
  });

  describe('Integration - Complete CRUD with Sync', () => {
    it('should handle complete lifecycle: create -> update -> verify sync metadata', async () => {
      const userId = 'user-123';
      
      // Create
      mockDb.getFirstAsync.mockResolvedValue(null);
      await repository.createCategory(userId, 'Food');
      
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        expect.arrayContaining([
          expect.any(String),
          userId,
          'Food',
          'food',
          expect.any(String),
          expect.any(String),
          0,
          'pending',
        ])
      );

      // Update
      mockDb.getFirstAsync
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          created_at: '2024-01-01T00:00:00Z',
          sync_version: 1,
        });

      await repository.updateCategory(userId, 'cat-1', 'Updated Food');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE categories'),
        expect.arrayContaining([
          'Updated Food',
          'updated food',
          expect.any(String),
          'pending',
          2, // sync_version incremented
          'cat-1',
          userId,
        ])
      );
    });
  });
});
