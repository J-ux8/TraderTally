/**
 * Unit tests for SyncEngine.sync() orchestration method
 * Tests Task 3.1 implementation: mutex lock, upload/download phases, error handling
 * Requirements: 1.2, 9.5, 17.1
 */

// Mock dependencies BEFORE imports
jest.mock('../SyncLock');
jest.mock('../SyncLogger');
jest.mock('../NetworkMonitor');
jest.mock('../SyncQueue');
jest.mock('@/lib/rls-notification', () => ({
  notifyRLSIssueOnce: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));
jest.mock('@/lib/database', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('../ConflictResolver', () => ({
  ConflictResolver: {
    resolveUpdateConflict: jest.fn(),
  },
}));

import { SyncEngine } from '../SyncEngine';
import { SyncLock } from '../SyncLock';
import { SyncLogger } from '../SyncLogger';
import { networkMonitor } from '../NetworkMonitor';
import { SyncQueue } from '../SyncQueue';
import { getDatabase } from '@/lib/database';
import { supabase } from '@/lib/supabase';

describe('SyncEngine.sync()', () => {
  const TEST_USER_ID = 'test-user-123';
  let syncEngine: SyncEngine;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    syncEngine = new SyncEngine(TEST_USER_ID);

    // Setup default mocks
    mockDb = {
      runAsync: jest.fn().mockResolvedValue(undefined),
      getFirstAsync: jest.fn().mockResolvedValue(null),
    };
    (getDatabase as jest.Mock).mockResolvedValue(mockDb);
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (SyncQueue.getNextBatch as jest.Mock).mockResolvedValue([]);
    (SyncLock.acquire as jest.Mock).mockResolvedValue(true);
    (SyncLock.release as jest.Mock).mockResolvedValue(undefined);
    (SyncLogger.logSyncStart as jest.Mock).mockResolvedValue('log-123');
    (SyncLogger.logSyncComplete as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Mutex Lock Management (Requirement 9.5)', () => {
    it('should acquire mutex lock at start', async () => {
      await syncEngine.sync();

      expect(SyncLock.acquire).toHaveBeenCalledTimes(1);
    });

    it('should fail fast if lock is already held', async () => {
      (SyncLock.acquire as jest.Mock).mockResolvedValue(false);

      const result = await syncEngine.sync();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Sync already in progress');
      expect(SyncLock.release).not.toHaveBeenCalled();
    });

    it('should release mutex lock after successful sync', async () => {
      await syncEngine.sync();

      expect(SyncLock.release).toHaveBeenCalledTimes(1);
    });

    it('should release mutex lock even if sync fails', async () => {
      (networkMonitor.isOnline as jest.Mock).mockRejectedValue(new Error('Network check failed'));

      await syncEngine.sync();

      expect(SyncLock.release).toHaveBeenCalledTimes(1);
    });

    it('should release mutex lock in finally block on error', async () => {
      (SyncQueue.getNextBatch as jest.Mock).mockRejectedValue(new Error('Database error'));

      await syncEngine.sync();

      expect(SyncLock.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('Network Connectivity Check', () => {
    it('should check network connectivity before sync', async () => {
      await syncEngine.sync();

      expect(networkMonitor.isOnline).toHaveBeenCalledTimes(1);
    });

    it('should skip sync when offline', async () => {
      (networkMonitor.isOnline as jest.Mock).mockResolvedValue(false);
      (SyncQueue.markAsOffline as jest.Mock).mockResolvedValue(undefined);

      const result = await syncEngine.sync();

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toBe('Device is offline');
      expect(SyncQueue.markAsOffline).toHaveBeenCalledWith(TEST_USER_ID);
      expect(SyncQueue.getNextBatch).not.toHaveBeenCalled();
    });

    it('should mark pending records as offline when no connectivity (Requirement 3.1)', async () => {
      (networkMonitor.isOnline as jest.Mock).mockResolvedValue(false);
      (SyncQueue.markAsOffline as jest.Mock).mockResolvedValue(undefined);

      await syncEngine.sync();

      expect(SyncQueue.markAsOffline).toHaveBeenCalledWith(TEST_USER_ID);
    });

    it('should skip cloud operations entirely when offline (Requirement 20.4)', async () => {
      (networkMonitor.isOnline as jest.Mock).mockResolvedValue(false);
      (SyncQueue.markAsOffline as jest.Mock).mockResolvedValue(undefined);

      await syncEngine.sync();

      // Verify no cloud operations attempted
      expect(SyncQueue.getNextBatch).not.toHaveBeenCalled();
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Logging (Requirements 12.2, 12.3, 12.4)', () => {
    it('should log sync start', async () => {
      await syncEngine.sync();

      expect(SyncLogger.logSyncStart).toHaveBeenCalledTimes(1);
    });

    it('should log sync completion with results', async () => {
      const logId = 'log-123';
      (SyncLogger.logSyncStart as jest.Mock).mockResolvedValue(logId);

      await syncEngine.sync();

      expect(SyncLogger.logSyncComplete).toHaveBeenCalledWith(logId, expect.objectContaining({
        success: true,
        uploadedCount: expect.any(Number),
        downloadedCount: expect.any(Number),
        conflictsResolved: expect.any(Number),
        errors: expect.any(Array),
        duration: expect.any(Number),
      }));
    });

    it('should log sync error on failure', async () => {
      const logId = 'log-123';
      const error = new Error('Sync failed');
      (SyncLogger.logSyncStart as jest.Mock).mockResolvedValue(logId);
      (mockDb.runAsync as jest.Mock).mockRejectedValue(error);

      await syncEngine.sync();

      expect(SyncLogger.logSyncError).toHaveBeenCalledWith(logId, error);
    });
  });

  describe('Upload Phase (Requirement 1.2)', () => {
    it('should upload pending records for all tables', async () => {
      await syncEngine.sync();

      // Should call getNextBatch for each table: categories, transactions, debts
      expect(SyncQueue.getNextBatch).toHaveBeenCalledWith('categories', TEST_USER_ID);
      expect(SyncQueue.getNextBatch).toHaveBeenCalledWith('transactions', TEST_USER_ID);
      expect(SyncQueue.getNextBatch).toHaveBeenCalledWith('debts', TEST_USER_ID);
    });

    it('should process upload phase before download phase', async () => {
      const callOrder: string[] = [];
      
      (SyncQueue.getNextBatch as jest.Mock).mockImplementation((table: string) => {
        callOrder.push(`upload-${table}`);
        return Promise.resolve([]);
      });

      (supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      mockDb.getFirstAsync.mockImplementation(() => {
        callOrder.push('download');
        return Promise.resolve(null);
      });

      await syncEngine.sync();

      // Verify upload happens before download
      const firstDownloadIndex = callOrder.findIndex(call => call === 'download');
      const lastUploadIndex = callOrder.map((call, idx) => call.startsWith('upload-') ? idx : -1)
        .filter(idx => idx !== -1)
        .pop() || -1;

      expect(lastUploadIndex).toBeLessThan(firstDownloadIndex);
    });
  });

  describe('Download Phase', () => {
    it('should download server updates for all tables', async () => {
      const mockSupabaseQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock) = jest.fn().mockReturnValue(mockSupabaseQuery);

      await syncEngine.sync();

      expect(supabase.from).toHaveBeenCalledWith('categories');
      expect(supabase.from).toHaveBeenCalledWith('transactions');
      expect(supabase.from).toHaveBeenCalledWith('debts');
    });
  });

  describe('Sync Metadata Update', () => {
    it('should update last_sync_time after successful sync', async () => {
      await syncEngine.sync();

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sync_metadata'),
        expect.arrayContaining([TEST_USER_ID, expect.any(String), expect.any(String), TEST_USER_ID])
      );
    });

    it('should update both last_sync_time and last_push_time', async () => {
      await syncEngine.sync();

      const call = (mockDb.runAsync as jest.Mock).mock.calls.find(
        call => call[0].includes('sync_metadata')
      );

      expect(call).toBeDefined();
      expect(call[0]).toContain('last_sync_time');
      expect(call[0]).toContain('last_push_time');
    });
  });

  describe('Error Handling', () => {
    it('should return error result on network failure', async () => {
      const error = new Error('Network timeout');
      (SyncQueue.getNextBatch as jest.Mock).mockRejectedValue(error);

      const result = await syncEngine.sync();

      expect(result.success).toBe(false);
      // Errors are collected per table (categories, transactions, debts)
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toBe('Network timeout');
    });

    it('should include duration in result', async () => {
      const result = await syncEngine.sync();

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should not throw errors to caller', async () => {
      (SyncQueue.getNextBatch as jest.Mock).mockRejectedValue(new Error('Critical error'));

      await expect(syncEngine.sync()).resolves.toBeDefined();
    });
  });

  describe('Sync Result', () => {
    it('should return success result with zero counts when no records to sync', async () => {
      const result = await syncEngine.sync();

      expect(result).toEqual({
        success: true,
        uploadedCount: 0,
        downloadedCount: 0,
        conflictsResolved: 0,
        errors: [],
        duration: expect.any(Number),
      });
    });

    it('should aggregate upload counts from all tables', async () => {
      (SyncQueue.getNextBatch as jest.Mock)
        .mockResolvedValueOnce([
          { id: '1', data: { id: '1', user_id: TEST_USER_ID } },
          { id: '2', data: { id: '2', user_id: TEST_USER_ID } },
        ])
        .mockResolvedValueOnce([
          { id: '3', data: { id: '3', user_id: TEST_USER_ID } },
        ])
        .mockResolvedValue([]);

      (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
      (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

      (supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null }),
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      const result = await syncEngine.sync();

      expect(result.uploadedCount).toBe(3);
    });
  });

  describe('Status Methods', () => {
    it('should report syncing status when lock is held', () => {
      (SyncLock.isLocked as jest.Mock).mockReturnValue(true);

      expect(syncEngine.isSyncing()).toBe(true);
      expect(syncEngine.getStatus()).toBe('syncing');
    });

    it('should report idle status when lock is not held', () => {
      (SyncLock.isLocked as jest.Mock).mockReturnValue(false);

      expect(syncEngine.isSyncing()).toBe(false);
      expect(syncEngine.getStatus()).toBe('idle');
    });
  });

  describe('Backward Compatibility', () => {
    it('should support legacy executeFullSync static method', async () => {
      await expect(SyncEngine.executeFullSync(TEST_USER_ID)).resolves.not.toThrow();
    });
  });

  describe('downloadServerUpdates() - Task 3.3 (Requirements 4.2, 4.3, 4.5, 6.5)', () => {
    let mockSupabaseQuery: any;

    beforeEach(() => {
      // Setup Supabase mock for download phase
      mockSupabaseQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      (supabase.from as jest.Mock) = jest.fn().mockReturnValue(mockSupabaseQuery);
    });

    describe('Incremental Sync', () => {
      it('should query records updated since last_sync_time', async () => {
        const lastSyncTime = '2024-01-01T00:00:00Z';
        mockDb.getFirstAsync.mockResolvedValue({ last_sync_time: lastSyncTime });

        await syncEngine.sync();

        expect(mockSupabaseQuery.gt).toHaveBeenCalledWith('updated_at', lastSyncTime);
      });

      it('should fetch all records when no last_sync_time exists', async () => {
        mockDb.getFirstAsync.mockResolvedValue(null);

        await syncEngine.sync();

        // Should not call gt() when no last_sync_time
        expect(mockSupabaseQuery.select).toHaveBeenCalled();
        expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID);
      });

      it('should fetch all records when last_sync_time is null', async () => {
        mockDb.getFirstAsync.mockResolvedValue({ last_sync_time: null });

        await syncEngine.sync();

        // Should not filter by updated_at when last_sync_time is null
        expect(mockSupabaseQuery.select).toHaveBeenCalled();
      });
    });

    describe('Batch Processing (Requirement 6.5)', () => {
      it('should fetch records in batches of 50', async () => {
        await syncEngine.sync();

        expect(mockSupabaseQuery.limit).toHaveBeenCalledWith(50);
      });

      it('should order records by updated_at ascending', async () => {
        await syncEngine.sync();

        expect(mockSupabaseQuery.order).toHaveBeenCalledWith('updated_at', { ascending: true });
      });
    });

    describe('User Isolation', () => {
      it('should filter records by user_id', async () => {
        await syncEngine.sync();

        expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('user_id', TEST_USER_ID);
      });
    });

    describe('New Records from Server (Requirement 4.2)', () => {
      it('should insert new server records with sync_status = synced', async () => {
        const serverRecord = {
          id: 'server-1',
          user_id: TEST_USER_ID,
          name: 'Server Category',
          normalized_name: 'server category',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_deleted: 0,
        };

        mockSupabaseQuery.limit.mockResolvedValue({ data: [serverRecord], error: null });
        mockDb.getFirstAsync
          .mockResolvedValueOnce(null) // sync_metadata
          .mockResolvedValueOnce(null); // local record doesn't exist

        await syncEngine.sync();

        // Should insert with sync_status = 'synced'
        expect(mockDb.runAsync).toHaveBeenCalledWith(
          expect.stringContaining("INSERT INTO categories"),
          expect.arrayContaining([
            serverRecord.id,
            serverRecord.user_id,
            serverRecord.name,
            serverRecord.normalized_name,
            serverRecord.created_at,
            serverRecord.updated_at,
            serverRecord.is_deleted,
            serverRecord.id,
            serverRecord.user_id,
            serverRecord.name,
            serverRecord.normalized_name,
            serverRecord.created_at,
            serverRecord.updated_at,
            serverRecord.is_deleted,
          ])
        );
      });

      it('should increment downloadedCount for new records', async () => {
        const serverRecords = [
          { id: '1', user_id: TEST_USER_ID, name: 'Cat1', normalized_name: 'cat1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', is_deleted: 0 },
          { id: '2', user_id: TEST_USER_ID, name: 'Cat2', normalized_name: 'cat2', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', is_deleted: 0 },
        ];

        // Mock to return data only for categories table, empty for others
        (supabase.from as jest.Mock) = jest.fn((tableName: string) => {
          if (tableName === 'categories') {
            return {
              ...mockSupabaseQuery,
              limit: jest.fn().mockResolvedValue({ data: serverRecords, error: null }),
            };
          }
          return {
            ...mockSupabaseQuery,
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        });

        mockDb.getFirstAsync
          .mockResolvedValueOnce(null) // sync_metadata
          .mockResolvedValueOnce(null) // record 1 doesn't exist
          .mockResolvedValueOnce(null); // record 2 doesn't exist

        const result = await syncEngine.sync();

        expect(result.downloadedCount).toBe(2);
      });
    });

    describe('Server Updates for Synced Records', () => {
      it('should update local synced records with server version', async () => {
        const serverRecord = {
          id: 'existing-1',
          user_id: TEST_USER_ID,
          name: 'Updated Name',
          normalized_name: 'updated name',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          is_deleted: 0,
        };

        const localRecord = {
          id: 'existing-1',
          user_id: TEST_USER_ID,
          name: 'Old Name',
          normalized_name: 'old name',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_deleted: 0,
          sync_status: 'synced',
        };

        mockSupabaseQuery.limit.mockResolvedValue({ data: [serverRecord], error: null });
        mockDb.getFirstAsync
          .mockResolvedValueOnce(null) // sync_metadata
          .mockResolvedValueOnce(localRecord); // local record exists and is synced

        await syncEngine.sync();

        // Should update local record with server data
        expect(mockDb.runAsync).toHaveBeenCalledWith(
          expect.stringContaining("INSERT INTO categories"),
          expect.arrayContaining([serverRecord.name])
        );
      });

      it('should increment downloadedCount for updated synced records', async () => {
        const serverRecord = {
          id: 'existing-1',
          user_id: TEST_USER_ID,
          name: 'Updated',
          normalized_name: 'updated',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          is_deleted: 0,
        };

        const localRecord = {
          id: 'existing-1',
          sync_status: 'synced',
          updated_at: '2024-01-01T00:00:00Z',
        };

        // Mock to return data only for categories table, empty for others
        (supabase.from as jest.Mock) = jest.fn((tableName: string) => {
          if (tableName === 'categories') {
            return {
              ...mockSupabaseQuery,
              limit: jest.fn().mockResolvedValue({ data: [serverRecord], error: null }),
            };
          }
          return {
            ...mockSupabaseQuery,
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        });

        mockDb.getFirstAsync
          .mockResolvedValueOnce(null) // sync_metadata
          .mockResolvedValueOnce(localRecord);

        const result = await syncEngine.sync();

        expect(result.downloadedCount).toBe(1);
      });
    });

    describe('Conflict Resolution (Requirements 4.3, 4.5)', () => {
      const ConflictResolver = require('../ConflictResolver').ConflictResolver;

      it('should detect conflicts when local record has pending changes', async () => {
        const serverRecord = {
          id: 'conflict-1',
          user_id: TEST_USER_ID,
          name: 'Server Version',
          normalized_name: 'server version',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          is_deleted: 0,
        };

        const localRecord = {
          id: 'conflict-1',
          user_id: TEST_USER_ID,
          name: 'Local Version',
          normalized_name: 'local version',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
          is_deleted: 0,
          sync_status: 'pending', // Has pending changes
        };

        mockSupabaseQuery.limit.mockResolvedValue({ data: [serverRecord], error: null });
        mockDb.getFirstAsync
          .mockResolvedValueOnce(null) // sync_metadata
          .mockResolvedValueOnce(localRecord);

        ConflictResolver.resolveUpdateConflict.mockReturnValue('ACCEPT_SERVER');

        await syncEngine.sync();

        expect(ConflictResolver.resolveUpdateConflict).toHaveBeenCalledWith(localRecord, serverRecord);
      });

      it('should apply server version when conflict resolver chooses ACCEPT_SERVER', async () => {
        const serverRecord = {
          id: 'conflict-1',
          user_id: TEST_USER_ID,
          name: 'Server Wins',
          normalized_name: 'server wins',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          is_deleted: 0,
        };

        const localRecord = {
          id: 'conflict-1',
          sync_status: 'pending',
          updated_at: '2024-01-01T00:00:00Z',
        };

        mockSupabaseQuery.limit.mockResolvedValue({ data: [serverRecord], error: null });
        mockDb.getFirstAsync
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(localRecord);

        ConflictResolver.resolveUpdateConflict.mockReturnValue('ACCEPT_SERVER');

        await syncEngine.sync();

        // Should apply server record
        expect(mockDb.runAsync).toHaveBeenCalledWith(
          expect.stringContaining("INSERT INTO categories"),
          expect.arrayContaining([serverRecord.name])
        );
      });

      it('should keep local version when conflict resolver chooses KEEP_LOCAL', async () => {
        const serverRecord = {
          id: 'conflict-1',
          user_id: TEST_USER_ID,
          name: 'Server Version',
          normalized_name: 'server version',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_deleted: 0,
        };

        const localRecord = {
          id: 'conflict-1',
          user_id: TEST_USER_ID,
          name: 'Local Wins',
          normalized_name: 'local wins',
          sync_status: 'pending',
          updated_at: '2024-01-02T00:00:00Z', // Newer than server
        };

        mockSupabaseQuery.limit.mockResolvedValue({ data: [serverRecord], error: null });
        mockDb.getFirstAsync
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(localRecord);

        ConflictResolver.resolveUpdateConflict.mockReturnValue('KEEP_LOCAL');

        await syncEngine.sync();

        // Should NOT apply server record (no INSERT/UPDATE for this record)
        const insertCalls = (mockDb.runAsync as jest.Mock).mock.calls.filter(
          call => call[0].includes('INSERT INTO categories') && call[1].includes('conflict-1')
        );
        expect(insertCalls.length).toBe(0);
      });

      it('should increment conflictsResolved counter for resolved conflicts', async () => {
        const serverRecord = {
          id: 'conflict-1',
          user_id: TEST_USER_ID,
          name: 'Server',
          normalized_name: 'server',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          is_deleted: 0,
        };

        const localRecord = {
          id: 'conflict-1',
          sync_status: 'pending',
          updated_at: '2024-01-01T00:00:00Z',
        };

        mockSupabaseQuery.limit.mockResolvedValue({ data: [serverRecord], error: null });
        mockDb.getFirstAsync
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(localRecord);

        ConflictResolver.resolveUpdateConflict.mockReturnValue('ACCEPT_SERVER');

        const result = await syncEngine.sync();

        expect(result.conflictsResolved).toBe(1);
      });

      it('should log conflict resolution to SyncLogger', async () => {
        const serverRecord = {
          id: 'conflict-1',
          user_id: TEST_USER_ID,
          name: 'Server',
          normalized_name: 'server',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          is_deleted: 0,
        };

        const localRecord = {
          id: 'conflict-1',
          sync_status: 'pending',
          updated_at: '2024-01-01T00:00:00Z',
        };

        mockSupabaseQuery.limit.mockResolvedValue({ data: [serverRecord], error: null });
        mockDb.getFirstAsync
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(localRecord);

        ConflictResolver.resolveUpdateConflict.mockReturnValue('ACCEPT_SERVER');

        await syncEngine.sync();

        expect(SyncLogger.logConflict).toHaveBeenCalledWith(
          serverRecord.id,
          expect.objectContaining({
            winner: 'server',
            record: serverRecord,
            reason: 'Server version is newer',
          }),
          expect.any(Object), // localVersion
          serverRecord // serverVersion
        );
      });

      it('should log when local version wins conflict', async () => {
        const serverRecord = {
          id: 'conflict-1',
          user_id: TEST_USER_ID,
          name: 'Server',
          normalized_name: 'server',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          is_deleted: 0,
        };

        const localRecord = {
          id: 'conflict-1',
          sync_status: 'pending',
          updated_at: '2024-01-02T00:00:00Z',
        };

        mockSupabaseQuery.limit.mockResolvedValue({ data: [serverRecord], error: null });
        mockDb.getFirstAsync
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(localRecord);

        ConflictResolver.resolveUpdateConflict.mockReturnValue('KEEP_LOCAL');

        await syncEngine.sync();

        expect(SyncLogger.logConflict).toHaveBeenCalledWith(
          localRecord.id,
          expect.objectContaining({
            winner: 'local',
            record: localRecord,
            reason: 'Local version is newer',
          }),
          localRecord, // localVersion
          expect.any(Object) // serverVersion
        );
      });
    });

    describe('Multi-Table Download', () => {
      it('should download updates for all sync tables', async () => {
        await syncEngine.sync();

        expect(supabase.from).toHaveBeenCalledWith('categories');
        expect(supabase.from).toHaveBeenCalledWith('transactions');
        expect(supabase.from).toHaveBeenCalledWith('debts');
      });

      it('should aggregate download counts from all tables', async () => {
        const categoriesData = [
          { id: '1', user_id: TEST_USER_ID, name: 'Cat1', normalized_name: 'cat1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', is_deleted: 0 },
        ];
        const transactionsData = [
          { id: '2', user_id: TEST_USER_ID, amount: 100, category: 'Cat1', description: 'Test', transaction_date: '2024-01-01', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', is_deleted: 0 },
          { id: '3', user_id: TEST_USER_ID, amount: 200, category: 'Cat1', description: 'Test2', transaction_date: '2024-01-01', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', is_deleted: 0 },
        ];

        (supabase.from as jest.Mock) = jest.fn((tableName: string) => {
          if (tableName === 'categories') {
            return {
              ...mockSupabaseQuery,
              limit: jest.fn().mockResolvedValue({ data: categoriesData, error: null }),
            };
          } else if (tableName === 'transactions') {
            return {
              ...mockSupabaseQuery,
              limit: jest.fn().mockResolvedValue({ data: transactionsData, error: null }),
            };
          }
          return {
            ...mockSupabaseQuery,
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        });

        mockDb.getFirstAsync.mockResolvedValue(null); // All records are new

        const result = await syncEngine.sync();

        expect(result.downloadedCount).toBe(3);
      });
    });

    describe('Error Handling', () => {
      it('should handle Supabase query errors gracefully', async () => {
        mockSupabaseQuery.limit.mockResolvedValue({ 
          data: null, 
          error: { message: 'Network error' } 
        });

        const result = await syncEngine.sync();

        // Should not throw, should return zero downloads
        expect(result.downloadedCount).toBe(0);
        expect(result.success).toBe(true); // Upload succeeded, download failed gracefully
      });

      it('should continue processing other tables if one fails', async () => {
        let callCount = 0;
        (supabase.from as jest.Mock) = jest.fn((tableName: string) => {
          callCount++;
          if (tableName === 'categories') {
            return {
              ...mockSupabaseQuery,
              limit: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
            };
          }
          return {
            ...mockSupabaseQuery,
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          };
        });

        await syncEngine.sync();

        // Should attempt all three tables despite categories failing
        expect(callCount).toBe(3);
      });

      it('should handle network errors during download phase', async () => {
        mockSupabaseQuery.limit.mockRejectedValue(new Error('Network timeout'));

        const result = await syncEngine.sync();

        // Should not throw, should complete sync
        expect(result.downloadedCount).toBe(0);
      });
    });

    describe('Empty Server Response', () => {
      it('should handle empty server response gracefully', async () => {
        mockSupabaseQuery.limit.mockResolvedValue({ data: [], error: null });

        const result = await syncEngine.sync();

        expect(result.downloadedCount).toBe(0);
        expect(result.success).toBe(true);
      });

      it('should handle null server response', async () => {
        mockSupabaseQuery.limit.mockResolvedValue({ data: null, error: null });

        const result = await syncEngine.sync();

        expect(result.downloadedCount).toBe(0);
      });
    });
  });

  describe('uploadPendingRecords() - Task 3.2 (Requirements 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 8.3, 8.4)', () => {
    let mockSupabaseQuery: any;

    beforeEach(() => {
      // Setup Supabase mock for download phase
      mockSupabaseQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };
      (supabase.from as jest.Mock) = jest.fn().mockReturnValue(mockSupabaseQuery);
    });

    describe('Batching (Requirement 6.1)', () => {
      it('should fetch records using SyncQueue.getNextBatch with 50 record limit', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID, name: 'Test' } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

        await syncEngine.sync();

        expect(SyncQueue.getNextBatch).toHaveBeenCalledWith('categories', TEST_USER_ID);
        expect(SyncQueue.getNextBatch).toHaveBeenCalledWith('transactions', TEST_USER_ID);
        expect(SyncQueue.getNextBatch).toHaveBeenCalledWith('debts', TEST_USER_ID);
      });

      it('should process multiple batches until no more records', async () => {
        const batch1 = [{ id: '1', data: { id: '1', user_id: TEST_USER_ID } }];
        const batch2 = [{ id: '2', data: { id: '2', user_id: TEST_USER_ID } }];
        
        (SyncQueue.getNextBatch as jest.Mock)
          .mockResolvedValueOnce(batch1)
          .mockResolvedValueOnce(batch2)
          .mockResolvedValue([]);
        
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

        await syncEngine.sync();

        // Should call getNextBatch multiple times per table until empty
        const categoryCalls = (SyncQueue.getNextBatch as jest.Mock).mock.calls
          .filter(call => call[0] === 'categories');
        expect(categoryCalls.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Status Transitions (Requirements 8.3, 8.4)', () => {
      it('should mark records as syncing before upload', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID } },
          { id: '2', data: { id: '2', user_id: TEST_USER_ID } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

        await syncEngine.sync();

        expect(SyncQueue.markAsSyncing).toHaveBeenCalledWith('categories', ['1', '2']);
      });

      it('should mark records as synced after successful upload', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

        await syncEngine.sync();

        expect(SyncQueue.markAsSynced).toHaveBeenCalledWith('categories', ['1']);
      });

      it('should reset retry_count when marking as synced', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID, retry_count: 3 } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

        await syncEngine.sync();

        // markAsSynced should reset retry_count to 0
        expect(SyncQueue.markAsSynced).toHaveBeenCalledWith('categories', ['1']);
      });
    });

    describe('Batch Upsert (Requirements 2.1, 2.2, 2.3)', () => {
      it('should perform batch upsert to Supabase with onConflict: id', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID, name: 'Cat1' } },
          { id: '2', data: { id: '2', user_id: TEST_USER_ID, name: 'Cat2' } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

        await syncEngine.sync();

        expect(mockSupabaseQuery.upsert).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: '1', user_id: TEST_USER_ID }),
            expect.objectContaining({ id: '2', user_id: TEST_USER_ID }),
          ]),
          { onConflict: 'id' }
        );
      });

      it('should only include allowed columns in upsert payload', async () => {
        const mockRecords = [
          { 
            id: '1', 
            data: { 
              id: '1', 
              user_id: TEST_USER_ID, 
              name: 'Test',
              sync_status: 'pending',
              sync_version: 1,
              retry_count: 0,
            } 
          },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

        await syncEngine.sync();

        const upsertCall = mockSupabaseQuery.upsert.mock.calls[0];
        const payload = upsertCall[0][0];
        
        // Should NOT include sync metadata columns
        expect(payload).not.toHaveProperty('sync_status');
        expect(payload).not.toHaveProperty('sync_version');
        expect(payload).not.toHaveProperty('retry_count');
      });
    });

    describe('Individual Retry on Batch Failure (Requirement 6.3)', () => {
      it('should retry individual records when batch upload fails', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID } },
          { id: '2', data: { id: '2', user_id: TEST_USER_ID } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsFailed as jest.Mock).mockResolvedValue(undefined);

        // First call (batch) fails, subsequent calls (individual) succeed
        mockSupabaseQuery.upsert
          .mockResolvedValueOnce({ error: { message: 'Batch failed' } })
          .mockResolvedValue({ error: null });

        await syncEngine.sync();

        // Should attempt individual upserts after batch failure
        expect(mockSupabaseQuery.upsert).toHaveBeenCalledTimes(3); // 1 batch + 2 individual
      });

      it('should mark failed individual records and increment retry_count', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID } },
          { id: '2', data: { id: '2', user_id: TEST_USER_ID } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsFailed as jest.Mock).mockResolvedValue(undefined);

        // Batch fails, first individual succeeds, second fails
        mockSupabaseQuery.upsert
          .mockResolvedValueOnce({ error: { message: 'Batch failed' } })
          .mockResolvedValueOnce({ error: null })
          .mockResolvedValueOnce({ error: { message: 'Individual failed' } });

        await syncEngine.sync();

        expect(SyncQueue.markAsSynced).toHaveBeenCalledWith('categories', ['1']);
        expect(SyncQueue.markAsFailed).toHaveBeenCalledWith('categories', ['2'], 'Individual failed');
      });

      it('should continue processing after individual record failures', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID } },
          { id: '2', data: { id: '2', user_id: TEST_USER_ID } },
          { id: '3', data: { id: '3', user_id: TEST_USER_ID } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsFailed as jest.Mock).mockResolvedValue(undefined);

        // Batch fails, record 2 fails, others succeed
        mockSupabaseQuery.upsert
          .mockResolvedValueOnce({ error: { message: 'Batch failed' } })
          .mockResolvedValueOnce({ error: null })
          .mockResolvedValueOnce({ error: { message: 'Failed' } })
          .mockResolvedValueOnce({ error: null });

        const result = await syncEngine.sync();

        expect(result.uploadedCount).toBe(2); // Records 1 and 3 succeeded
        expect(result.errors.length).toBe(1); // Record 2 failed
      });
    });

    describe('Error Handling', () => {
      it('should handle RLS policy errors gracefully', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockResolvedValueOnce(mockRecords).mockResolvedValue([]);
        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsFailed as jest.Mock).mockResolvedValue(undefined);

        mockSupabaseQuery.upsert.mockResolvedValue({ 
          error: { code: '42501', message: 'RLS policy violation' } 
        });

        const result = await syncEngine.sync();

        expect(SyncQueue.markAsFailed).toHaveBeenCalledWith('categories', ['1'], 'RLS policy error');
        expect(result.errors).toContainEqual({ recordId: '1', error: 'RLS policy error' });
      });

      it('should handle network errors during upload', async () => {
        const mockRecords = [
          { id: '1', data: { id: '1', user_id: TEST_USER_ID } },
        ];
        (SyncQueue.getNextBatch as jest.Mock).mockRejectedValue(new Error('Network timeout'));

        const result = await syncEngine.sync();

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('Upload Result Aggregation', () => {
      it('should aggregate upload counts from multiple tables', async () => {
        (SyncQueue.getNextBatch as jest.Mock)
          .mockResolvedValueOnce([{ id: '1', data: { id: '1', user_id: TEST_USER_ID } }]) // categories
          .mockResolvedValueOnce([]) // categories done
          .mockResolvedValueOnce([{ id: '2', data: { id: '2', user_id: TEST_USER_ID } }]) // transactions
          .mockResolvedValueOnce([{ id: '3', data: { id: '3', user_id: TEST_USER_ID } }]) // transactions
          .mockResolvedValue([]); // all done

        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsSynced as jest.Mock).mockResolvedValue(undefined);

        const result = await syncEngine.sync();

        expect(result.uploadedCount).toBe(3);
      });

      it('should collect errors from all tables', async () => {
        (SyncQueue.getNextBatch as jest.Mock)
          .mockResolvedValueOnce([{ id: '1', data: { id: '1', user_id: TEST_USER_ID } }])
          .mockResolvedValue([]);

        (SyncQueue.markAsSyncing as jest.Mock).mockResolvedValue(undefined);
        (SyncQueue.markAsFailed as jest.Mock).mockResolvedValue(undefined);

        mockSupabaseQuery.upsert.mockResolvedValue({ 
          error: { message: 'Upload failed' } 
        });

        const result = await syncEngine.sync();

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.success).toBe(false);
      });
    });
  });
});
