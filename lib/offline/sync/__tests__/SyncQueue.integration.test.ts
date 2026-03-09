import { SyncQueue } from '../SyncQueue';
import { getDatabase } from '@/lib/database';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

// Mock the database module
jest.mock('@/lib/database');

describe('SyncQueue Integration Tests', () => {
  let mockDb: any;
  const testUserId = 'test-user-integration';
  const testTableName = 'transactions';

  beforeEach(async () => {
    // Create a more realistic mock database
    const records = new Map<string, any>();
    
    mockDb = {
      getAllAsync: jest.fn(async (query: string, params: any[]) => {
        const results: any[] = [];
        records.forEach((record) => {
          if (record.user_id === params[0] && 
              (record.sync_status === 'pending' || record.sync_status === 'failed')) {
            results.push(record);
          }
        });
        return results.sort((a, b) => 
          new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
        ).slice(0, params[1]);
      }),
      getFirstAsync: jest.fn(async (query: string, params: any[]) => {
        if (query.includes('COUNT')) {
          let count = 0;
          records.forEach((record) => {
            if (record.user_id === params[0] && 
                ['pending', 'failed', 'syncing'].includes(record.sync_status)) {
              count++;
            }
          });
          return { count };
        }
        return records.get(params[0]) || null;
      }),
      runAsync: jest.fn(async (query: string, params: any[]) => {
        if (query.includes('UPDATE')) {
          if (query.includes("sync_status = 'syncing'")) {
            params.forEach((id: string) => {
              const record = records.get(id);
              if (record) {
                record.sync_status = 'syncing';
              }
            });
          } else if (query.includes("sync_status = 'synced'")) {
            params.forEach((id: string) => {
              const record = records.get(id);
              if (record) {
                record.sync_status = 'synced';
                record.retry_count = 0;
              }
            });
          } else if (query.includes('retry_count')) {
            const [status, retryCount, id] = params;
            const record = records.get(id);
            if (record) {
              record.sync_status = status;
              record.retry_count = retryCount;
            }
          }
        }
      }),
    };

    // Add test records
    for (let i = 1; i <= 60; i++) {
      records.set(`record-${i}`, {
        id: `record-${i}`,
        user_id: testUserId,
        sync_status: 'pending',
        sync_version: 1,
        retry_count: 0,
        updated_at: new Date(2024, 0, 1, 10, i).toISOString(),
        amount: i * 100,
      });
    }

    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Batch Processing Workflow', () => {
    it('should process records in batches of 50', async () => {
      // First batch
      const batch1 = await SyncQueue.getNextBatch(testTableName, testUserId);
      expect(batch1).toHaveLength(50);
      expect(batch1[0].id).toBe('record-1'); // Oldest first
      
      // Mark first batch as syncing
      await SyncQueue.markAsSyncing(testTableName, batch1.map(r => r.id));
      
      // Second batch should get remaining 10 records
      const batch2 = await SyncQueue.getNextBatch(testTableName, testUserId);
      expect(batch2).toHaveLength(10);
      expect(batch2[0].id).toBe('record-51');
    });

    it('should handle sync success workflow', async () => {
      const batch = await SyncQueue.getNextBatch(testTableName, testUserId);
      const recordIds = batch.map(r => r.id);
      
      // Mark as syncing
      await SyncQueue.markAsSyncing(testTableName, recordIds);
      
      // Simulate successful upload
      await SyncQueue.markAsSynced(testTableName, recordIds);
      
      // Verify records are marked as synced
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'synced'"),
        recordIds
      );
    });

    it('should handle sync failure with retry logic', async () => {
      const batch = await SyncQueue.getNextBatch(testTableName, testUserId);
      const recordId = batch[0].id;
      
      // Mark as syncing
      await SyncQueue.markAsSyncing(testTableName, [recordId]);
      
      // Simulate failure
      await SyncQueue.markAsFailed(testTableName, [recordId], 'Network timeout');
      
      // Verify retry_count incremented and status set to pending
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['pending', 1, recordId]
      );
    });

    it('should mark as failed after 10 retries', async () => {
      const recordId = 'record-1';
      
      // Simulate 9 failed attempts
      mockDb.getFirstAsync.mockResolvedValue({ retry_count: 9 });
      
      await SyncQueue.markAsFailed(testTableName, [recordId], 'Persistent error');
      
      // Verify status set to failed
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        ['failed', 10, recordId]
      );
    });
  });

  describe('Status Tracking', () => {
    it('should accurately count pending records', async () => {
      const count = await SyncQueue.getPendingCount(testUserId);
      
      // Should count across all tables (transactions, categories, debts)
      expect(mockDb.getFirstAsync).toHaveBeenCalledTimes(3);
      expect(count).toBeGreaterThan(0);
    });

    it('should handle offline status transitions', async () => {
      // Mark as offline
      await SyncQueue.markAsOffline(testUserId);
      
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'offline'"),
        [testUserId]
      );
      
      // Mark back to pending when online
      await SyncQueue.markOfflineAsPending(testUserId);
      
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending'"),
        [testUserId]
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty batches gracefully', async () => {
      // Mock empty result
      mockDb.getAllAsync.mockResolvedValue([]);
      
      const batch = await SyncQueue.getNextBatch(testTableName, testUserId);
      expect(batch).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.getAllAsync.mockRejectedValue(new Error('Database error'));
      
      await expect(
        SyncQueue.getNextBatch(testTableName, testUserId)
      ).rejects.toThrow('Database error');
    });

    it('should prioritize oldest records first', async () => {
      const batch = await SyncQueue.getNextBatch(testTableName, testUserId);
      
      // Verify records are ordered by updated_at ascending
      for (let i = 1; i < batch.length; i++) {
        const prevTime = new Date(batch[i - 1].updated_at).getTime();
        const currTime = new Date(batch[i].updated_at).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });
});
