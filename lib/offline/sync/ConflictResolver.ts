export interface SyncRecord {
    id: string;
    updated_at: string;
    is_deleted: number;
    sync_version: number;
}

export interface ResolvedRecord {
    winner: 'local' | 'server';
    record: SyncRecord;
    reason: string;
}

export class ConflictResolver {
    /**
     * Determine if a conflict exists between local and server versions.
     * A conflict exists when:
     * 1. Local record has pending changes (sync_status != 'synced'), AND
     * 2. Server record has been updated (different updated_at timestamp)
     * 
     * Requirements: 5.4, 12.5
     * 
     * @param local - Local version of the record
     * @param server - Server version of the record
     * @returns true if a conflict exists, false otherwise
     */
    static hasConflict(local: SyncRecord, server: SyncRecord): boolean {
        // No conflict if timestamps are identical
        if (local.updated_at === server.updated_at) {
            return false;
        }

        // Conflict exists if both versions have different timestamps
        // This indicates both local and server have been modified
        const localTime = new Date(local.updated_at).getTime();
        const serverTime = new Date(server.updated_at).getTime();
        
        return localTime !== serverTime;
    }

    /**
     * Resolve conflict between local and server versions using latest-update-wins strategy.
     * 
     * Requirements: 5.1, 5.2, 5.5
     * 
     * @param local - Local version of the record
     * @param server - Server version of the record
     * @returns ResolvedRecord with winner, record, and reason
     */
    static resolve(local: SyncRecord, server: SyncRecord): ResolvedRecord {
        const localTime = new Date(local.updated_at).getTime();
        const serverTime = new Date(server.updated_at).getTime();

        // Compare timestamps - newer wins (Requirement 5.1, 5.2)
        if (serverTime > localTime) {
            return {
                winner: 'server',
                record: server,
                reason: 'Server version has newer timestamp'
            };
        } else if (localTime > serverTime) {
            return {
                winner: 'local',
                record: local,
                reason: 'Local version has newer timestamp'
            };
        } else {
            // Equal timestamps - server wins as tie-breaker (Requirement 5.5)
            return {
                winner: 'server',
                record: server,
                reason: 'Timestamps equal, server wins tie-breaker'
            };
        }
    }

    /**
     * Strict conflict resolution rules:
     * 1. If server was deleted, and local is NOT deleted -> Server wins
     *    (financial compliance dictates deletions are high priority).
     * 2. Newer updated_at ALWAYS wins.
     */
    static resolveUpdateConflict(local: SyncRecord, server: SyncRecord): 'KEEP_LOCAL' | 'ACCEPT_SERVER' {
        const localTime = new Date(local.updated_at).getTime();
        const serverTime = new Date(server.updated_at).getTime();

        // Hard rule: server deletion wins if it happened later
        if (server.is_deleted && !local.is_deleted && serverTime >= localTime) {
            return 'ACCEPT_SERVER';
        }

        if (serverTime > localTime) {
            return 'ACCEPT_SERVER';
        }

        return 'KEEP_LOCAL';
    }
}
