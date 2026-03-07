import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { getDatabase } from '../../database';
import { withTransaction } from '../db-transaction';

export abstract class BaseRepository<T extends { id?: string }> {
    constructor(protected tableName: string) { }

    protected get currentTimestamp() {
        return new Date().toISOString();
    }

    protected generateId() {
        return Crypto.randomUUID();
    }

    /**
     * Universal save logic ensuring ID generation, timestamping, 
     * and auto-flagging `sync_status = 'pending'` with `sync_version` bump.
     */
    async save(userId: string, data: T, upsertQuery: (dbObj: any) => Promise<void>): Promise<string> {
        const db = await getDatabase();
        const id = data.id || this.generateId();
        const now = this.currentTimestamp;

        const dbObj = {
            ...data,
            id,
            user_id: userId,
            created_at: now,
            updated_at: now,
            is_deleted: 0,
            sync_status: 'pending'
        };

        return withTransaction(db, async () => {
            await upsertQuery(dbObj);
            return id;
        });
    }

    /**
     * Universal soft delete standard (enforces is_deleted=1, resets sync_status to 'pending')
     */
    async softDelete(id: string, userId: string): Promise<void> {
        const db = await getDatabase();
        await withTransaction(db, async () => {
            await this.validateBeforeDelete(id);

            const now = this.currentTimestamp;
            await db.runAsync(
                `UPDATE ${this.tableName} 
         SET is_deleted = 1, sync_status = 'pending', sync_version = sync_version + 1, updated_at = ? 
         WHERE id = ? AND user_id = ?`,
                [now, id, userId]
            );
        });
    }

    protected async validateBeforeDelete(id: string): Promise<void> { };
}
