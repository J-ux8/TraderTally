import { BaseRepository } from './BaseRepository';
import { getDatabase } from '../../database';
import { withTransaction } from '../db-transaction';

export interface Transaction {
    id: string;
    user_id: string;
    amount: number;
    category: string | null;
    description: string | null;
    transaction_date: string;
    created_at: string;
    updated_at: string;
    is_deleted: number;
    sync_status: string;
    sync_version: number;
}

export class TransactionRepository extends BaseRepository<Partial<Transaction>> {
    constructor() {
        super('transactions');
    }

    async findAll(userId: string, limit?: number): Promise<Transaction[]> {
        const db = await getDatabase();
        let query = `SELECT * FROM ${this.tableName} WHERE user_id = ? AND is_deleted = 0 ORDER BY transaction_date DESC, created_at DESC`;
        if (limit) query += ` LIMIT ${limit}`;

        const results = await db.getAllAsync(query, [userId]);
        return results as Transaction[];
    }

    async getProfit(userId: string): Promise<number> {
        const db = await getDatabase();
        const result = await db.getFirstAsync(
            `SELECT SUM(amount) as total FROM ${this.tableName} WHERE user_id = ? AND is_deleted = 0`,
            [userId]
        ) as { total: number };
        return result?.total || 0;
    }

    async record(userId: string, data: {
        amount: number;
        category: string | null;
        description: string | null;
        transaction_date?: string;
    }): Promise<string> {
        const db = await getDatabase();
        const id = this.generateId();
        const now = this.currentTimestamp;
        const dateStr = data.transaction_date || now.split('T')[0];

        await withTransaction(db, async () => {
            await db.runAsync(
                `INSERT INTO ${this.tableName} (
                    id, user_id, amount, category, description, transaction_date, 
                    created_at, updated_at, is_deleted, sync_status, sync_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', 1)`,
                [id, userId, data.amount, data.category, data.description, dateStr, now, now]
            );
        });

        return id;
    }

    async update(userId: string, transactionId: string, data: {
        amount: number;
        category: string | null;
        description: string | null;
        transaction_date: string;
    }): Promise<void> {
        const db = await getDatabase();
        const now = this.currentTimestamp;

        await withTransaction(db, async () => {
            await db.runAsync(
                `UPDATE ${this.tableName} SET 
                    amount = ?, category = ?, description = ?, transaction_date = ?, 
                    updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1
                WHERE id = ? AND user_id = ?`,
                [data.amount, data.category, data.description, data.transaction_date, now, transactionId, userId]
            );
        });
    }
}

export const transactionRepo = new TransactionRepository();
