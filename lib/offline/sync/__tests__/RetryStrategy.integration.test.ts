import { RetryStrategy } from '../RetryStrategy';
import { getDatabase } from '@/lib/database';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock the database module
jest.mock('@/lib/database');

/**
 * Integration tests for RetryStrategy
 * Tests database interactions with realistic mock behavior
 */
describe('RetryStrategy Integration Tests', () => {
  let mockDb: any;
  const testUserId = 'test-user-integration';
  const testTableName = 'transactions';

  beforeEach(async () => {
    // Create a realistic mock database with in-memory record storage
    const records = new Map<string, any>();

    mockDb = {
      getFirstAsync: jest.fn(async (query: string, params: any[]) => {
        return records.get(params[0]) || null;
      }),
      runAsync: jest.fn(async (query: string, params: any[]) => {
        if (query.includes('INSERT')) {
          const [id, userId, amount, category, description, transactionDate, createdAt, updatedAt, retryCount, syncStatus] = params;
          records.set(id, {
            id,
            user_id: userId,
            amount,
            category,
            description,
            transaction_date: transactionDate,
            created_at: createdAt,
            updated_at: updatedAt,
            retry_count: retryCount,
            sync_status: syncStatus,
          });
        } else if (query.includes('UPDATE') && query.includes('retry_count = 0')) {
          const [recordId] = params;
          const record = records.get(recordId);
          if (record) {
            record.retry_count = 0;
          }
        } else if (query.includes('UPDATE') && query.includes('retry_count = retry_count + 1')) {
          const [recordId] = params;
          const record = records.get(recordId);
          if (record) {
            record.retry_count += 1;
          }
        } else if (query.includes('DELETE')) {
          const [userId] = params;
          const toDelete: string[] = [];
          records.forEach((record, id) => {
            if (record.user_id === userId) {
              toDelete.push(id);
            }
          });
          toDelete.forEach(id => records.delete(id));
        }
      }),
    };

    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resetRetryCount', () => {
    it('should reset retry_count to 0 in the database', async () => {
      const recordId = 'test-record-1';
      
      // Insert a record with retry_count = 5
      await mockDb.runAsync(
        `INSERT INTO ${testTableName} 
         (id, user_id, amount, category, description, transaction_date, created_at, updated_at, retry_count, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          testUserId,
          100.50,
          'Food',
          'Test transaction',
          '2024-01-01',
          '2024-01-01T10:00:00Z',
          '2024-01-01T10:00:00Z',
          5,
          'failed'
        ]
      );

      // Verify initial retry_count
      const beforeReset = await mockDb.getFirstAsync(
        `SELECT retry_count FROM ${testTableName} WHERE id = ?`,
        [recordId]
      );
      expect(beforeReset.retry_count).toBe(5);

      // Reset retry count
      await RetryStrategy.resetRetryCount(testTableName, recordId);

      // Verify retry_count is now 0
      const afterReset = await mockDb.getFirstAsync(
        `SELECT retry_count FROM ${testTableName} WHERE id = ?`,
        [recordId]
      );
      expect(afterReset.retry_count).toBe(0);
    });

    it('should handle non-existent record gracefully', async () => {
      const nonExistentId = 'non-existent-record';
      
      // Should not throw error
      await expect(
        RetryStrategy.resetRetryCount(testTableName, nonExistentId)
      ).resolves.not.toThrow();
    });

    it('should only reset the specified record', async () => {
      const recordId1 = 'test-record-1';
      const recordId2 = 'test-record-2';
      
      // Insert two records with different retry counts
      await mockDb.runAsync(
        `INSERT INTO ${testTableName} 
         (id, user_id, amount, category, description, transaction_date, created_at, updated_at, retry_count, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [recordId1, testUserId, 100, 'Food', 'Test 1', '2024-01-01', '2024-01-01T10:00:00Z', '2024-01-01T10:00:00Z', 3, 'failed']
      );
      
      await mockDb.runAsync(
        `INSERT INTO ${testTableName} 
         (id, user_id, amount, category, description, transaction_date, created_at, updated_at, retry_count, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [recordId2, testUserId, 200, 'Transport', 'Test 2', '2024-01-02', '2024-01-02T10:00:00Z', '2024-01-02T10:00:00Z', 7, 'failed']
      );

      // Reset only the first record
      await RetryStrategy.resetRetryCount(testTableName, recordId1);

      // Verify first record is reset
      const record1 = await mockDb.getFirstAsync(
        `SELECT retry_count FROM ${testTableName} WHERE id = ?`,
        [recordId1]
      );
      expect(record1.retry_count).toBe(0);

      // Verify second record is unchanged
      const record2 = await mockDb.getFirstAsync(
        `SELECT retry_count FROM ${testTableName} WHERE id = ?`,
        [recordId2]
      );
      expect(record2.retry_count).toBe(7);
    });
  });

  describe('retry schedule validation', () => {
    it('should provide correct delays for the full retry cycle', () => {
      const expectedSchedule = [
        { retryCount: 0, delay: 10 * 1000, description: '10 seconds' },
        { retryCount: 1, delay: 30 * 1000, description: '30 seconds' },
        { retryCount: 2, delay: 2 * 60 * 1000, description: '2 minutes' },
        { retryCount: 3, delay: 10 * 60 * 1000, description: '10 minutes' },
        { retryCount: 4, delay: 10 * 60 * 1000, description: '10 minutes' },
        { retryCount: 5, delay: 10 * 60 * 1000, description: '10 minutes' },
        { retryCount: 6, delay: 10 * 60 * 1000, description: '10 minutes' },
        { retryCount: 7, delay: 10 * 60 * 1000, description: '10 minutes' },
        { retryCount: 8, delay: 10 * 60 * 1000, description: '10 minutes' },
        { retryCount: 9, delay: 10 * 60 * 1000, description: '10 minutes' },
      ];

      expectedSchedule.forEach(({ retryCount, delay, description }) => {
        const actualDelay = RetryStrategy.getRetryDelay(retryCount);
        expect(actualDelay).toBe(delay);
        expect(RetryStrategy.shouldRetry(retryCount)).toBe(true);
      });

      // After 10 retries, should not retry
      expect(RetryStrategy.shouldRetry(10)).toBe(false);
    });
  });

  describe('integration with SyncQueue workflow', () => {
    it('should support the full retry workflow', async () => {
      const recordId = 'test-record-workflow';
      
      // 1. Create a record with initial retry_count
      await mockDb.runAsync(
        `INSERT INTO ${testTableName} 
         (id, user_id, amount, category, description, transaction_date, created_at, updated_at, retry_count, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [recordId, testUserId, 100, 'Food', 'Test', '2024-01-01', '2024-01-01T10:00:00Z', '2024-01-01T10:00:00Z', 0, 'pending']
      );

      // 2. Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        const record = await mockDb.getFirstAsync(
          `SELECT retry_count FROM ${testTableName} WHERE id = ?`,
          [recordId]
        );
        
        // Check if should retry
        expect(RetryStrategy.shouldRetry(record.retry_count)).toBe(true);
        
        // Get retry delay
        const delay = RetryStrategy.getRetryDelay(record.retry_count);
        expect(delay).toBeGreaterThan(0);
        
        // Increment retry count (simulating failure)
        await mockDb.runAsync(
          `UPDATE ${testTableName} SET retry_count = retry_count + 1 WHERE id = ?`,
          [recordId]
        );
      }

      // 3. Verify retry count increased
      const afterFailures = await mockDb.getFirstAsync(
        `SELECT retry_count FROM ${testTableName} WHERE id = ?`,
        [recordId]
      );
      expect(afterFailures.retry_count).toBe(5);

      // 4. Simulate successful sync
      await RetryStrategy.resetRetryCount(testTableName, recordId);

      // 5. Verify retry count is reset
      const afterSuccess = await mockDb.getFirstAsync(
        `SELECT retry_count FROM ${testTableName} WHERE id = ?`,
        [recordId]
      );
      expect(afterSuccess.retry_count).toBe(0);
    });
  });
});
