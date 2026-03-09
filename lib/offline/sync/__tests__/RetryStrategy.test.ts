import { RetryStrategy } from '../RetryStrategy';
import { getDatabase } from '@/lib/database';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock the database module
jest.mock('@/lib/database');

describe('RetryStrategy', () => {
  describe('getRetryDelay', () => {
    it('should return 10 seconds for retry_count 0', () => {
      const delay = RetryStrategy.getRetryDelay(0);
      expect(delay).toBe(10 * 1000);
    });

    it('should return 30 seconds for retry_count 1', () => {
      const delay = RetryStrategy.getRetryDelay(1);
      expect(delay).toBe(30 * 1000);
    });

    it('should return 2 minutes for retry_count 2', () => {
      const delay = RetryStrategy.getRetryDelay(2);
      expect(delay).toBe(2 * 60 * 1000);
    });

    it('should return 10 minutes for retry_count 3', () => {
      const delay = RetryStrategy.getRetryDelay(3);
      expect(delay).toBe(10 * 60 * 1000);
    });

    it('should return 10 minutes for retry_count 4 and above', () => {
      expect(RetryStrategy.getRetryDelay(4)).toBe(10 * 60 * 1000);
      expect(RetryStrategy.getRetryDelay(5)).toBe(10 * 60 * 1000);
      expect(RetryStrategy.getRetryDelay(9)).toBe(10 * 60 * 1000);
    });

    it('should return 0 for negative retry_count', () => {
      const delay = RetryStrategy.getRetryDelay(-1);
      expect(delay).toBe(0);
    });
  });

  describe('shouldRetry', () => {
    it('should return true for retry_count less than 10', () => {
      expect(RetryStrategy.shouldRetry(0)).toBe(true);
      expect(RetryStrategy.shouldRetry(5)).toBe(true);
      expect(RetryStrategy.shouldRetry(9)).toBe(true);
    });

    it('should return false for retry_count 10 or greater', () => {
      expect(RetryStrategy.shouldRetry(10)).toBe(false);
      expect(RetryStrategy.shouldRetry(11)).toBe(false);
      expect(RetryStrategy.shouldRetry(100)).toBe(false);
    });
  });

  describe('resetRetryCount', () => {
    let mockDb: any;

    beforeEach(() => {
      mockDb = {
        runAsync: jest.fn().mockResolvedValue(undefined),
      };
      (getDatabase as jest.Mock).mockResolvedValue(mockDb);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should reset retry_count to 0 for the specified record', async () => {
      const tableName = 'transactions';
      const recordId = 'test-record-id';

      await RetryStrategy.resetRetryCount(tableName, recordId);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE transactions'),
        [recordId]
      );
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('SET retry_count = 0'),
        [recordId]
      );
    });

    it('should work with different table names', async () => {
      await RetryStrategy.resetRetryCount('categories', 'cat-id');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE categories'),
        ['cat-id']
      );

      await RetryStrategy.resetRetryCount('debts', 'debt-id');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE debts'),
        ['debt-id']
      );
    });
  });

  describe('getMaxRetries', () => {
    it('should return 10 as the maximum retry count', () => {
      expect(RetryStrategy.getMaxRetries()).toBe(10);
    });
  });

  describe('exponential backoff schedule', () => {
    it('should implement the correct retry schedule', () => {
      const schedule = [
        { count: 0, expected: 10 * 1000 },
        { count: 1, expected: 30 * 1000 },
        { count: 2, expected: 2 * 60 * 1000 },
        { count: 3, expected: 10 * 60 * 1000 },
        { count: 4, expected: 10 * 60 * 1000 },
        { count: 5, expected: 10 * 60 * 1000 },
      ];

      schedule.forEach(({ count, expected }) => {
        expect(RetryStrategy.getRetryDelay(count)).toBe(expected);
      });
    });

    it('should cap delays at 10 minutes for high retry counts', () => {
      const maxDelay = 10 * 60 * 1000;
      
      for (let i = 4; i < 20; i++) {
        expect(RetryStrategy.getRetryDelay(i)).toBe(maxDelay);
      }
    });
  });
});
