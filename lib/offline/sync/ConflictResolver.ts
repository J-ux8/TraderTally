export interface SyncRecord {
    id: string;
    updated_at: string;
    is_deleted: number;
    sync_version: number;
}

export class ConflictResolver {
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
