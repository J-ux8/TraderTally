import { ConflictResolver, SyncRecord, ResolvedRecord } from '../ConflictResolver';

describe('ConflictResolver', () => {
    describe('hasConflict()', () => {
        it('should return false when timestamps are identical', () => {
            const timestamp = '2024-01-01T10:00:00Z';
            
            const local: SyncRecord = {
                id: '1',
                updated_at: timestamp,
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: timestamp,
                is_deleted: 0,
                sync_version: 1
            };

            const result = ConflictResolver.hasConflict(local, server);
            expect(result).toBe(false);
        });

        it('should return true when timestamps differ', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 0,
                sync_version: 2
            };

            const result = ConflictResolver.hasConflict(local, server);
            expect(result).toBe(true);
        });

        it('should return true when local is newer than server', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T12:00:00Z',
                is_deleted: 0,
                sync_version: 2
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const result = ConflictResolver.hasConflict(local, server);
            expect(result).toBe(true);
        });

        it('should handle millisecond precision differences', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00.100Z',
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00.200Z',
                is_deleted: 0,
                sync_version: 2
            };

            const result = ConflictResolver.hasConflict(local, server);
            expect(result).toBe(true);
        });

        it('should detect conflict with deleted records', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 1,
                sync_version: 2
            };

            const result = ConflictResolver.hasConflict(local, server);
            expect(result).toBe(true);
        });
    });

    describe('resolve()', () => {
        it('should return server as winner when server timestamp is newer', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 0,
                sync_version: 2
            };

            const result = ConflictResolver.resolve(local, server);

            expect(result.winner).toBe('server');
            expect(result.record).toBe(server);
            expect(result.reason).toBe('Server version has newer timestamp');
        });

        it('should return local as winner when local timestamp is newer', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T12:00:00Z',
                is_deleted: 0,
                sync_version: 2
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const result = ConflictResolver.resolve(local, server);

            expect(result.winner).toBe('local');
            expect(result.record).toBe(local);
            expect(result.reason).toBe('Local version has newer timestamp');
        });

        it('should return server as winner when timestamps are equal (tie-breaker)', () => {
            const timestamp = '2024-01-01T10:00:00Z';
            
            const local: SyncRecord = {
                id: '1',
                updated_at: timestamp,
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: timestamp,
                is_deleted: 0,
                sync_version: 1
            };

            const result = ConflictResolver.resolve(local, server);

            expect(result.winner).toBe('server');
            expect(result.record).toBe(server);
            expect(result.reason).toBe('Timestamps equal, server wins tie-breaker');
        });

        it('should handle millisecond precision in timestamps', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00.100Z',
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00.200Z',
                is_deleted: 0,
                sync_version: 2
            };

            const result = ConflictResolver.resolve(local, server);

            expect(result.winner).toBe('server');
            expect(result.record).toBe(server);
        });

        it('should return ResolvedRecord with all required fields', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 0,
                sync_version: 2
            };

            const result = ConflictResolver.resolve(local, server);

            expect(result).toHaveProperty('winner');
            expect(result).toHaveProperty('record');
            expect(result).toHaveProperty('reason');
            expect(typeof result.winner).toBe('string');
            expect(typeof result.record).toBe('object');
            expect(typeof result.reason).toBe('string');
        });

        it('should work with deleted records', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 1,
                sync_version: 2
            };

            const result = ConflictResolver.resolve(local, server);

            expect(result.winner).toBe('server');
            expect(result.record.is_deleted).toBe(1);
        });
    });

    describe('resolveUpdateConflict() - legacy method', () => {
        it('should return ACCEPT_SERVER when server timestamp is newer', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T10:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 0,
                sync_version: 2
            };

            const result = ConflictResolver.resolveUpdateConflict(local, server);
            expect(result).toBe('ACCEPT_SERVER');
        });

        it('should return KEEP_LOCAL when local timestamp is newer', () => {
            const local: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T12:00:00Z',
                is_deleted: 0,
                sync_version: 2
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: '2024-01-01T11:00:00Z',
                is_deleted: 0,
                sync_version: 1
            };

            const result = ConflictResolver.resolveUpdateConflict(local, server);
            expect(result).toBe('KEEP_LOCAL');
        });

        it('should return ACCEPT_SERVER when server is deleted and timestamps are equal', () => {
            const timestamp = '2024-01-01T10:00:00Z';
            
            const local: SyncRecord = {
                id: '1',
                updated_at: timestamp,
                is_deleted: 0,
                sync_version: 1
            };

            const server: SyncRecord = {
                id: '1',
                updated_at: timestamp,
                is_deleted: 1,
                sync_version: 1
            };

            const result = ConflictResolver.resolveUpdateConflict(local, server);
            expect(result).toBe('ACCEPT_SERVER');
        });
    });
});
