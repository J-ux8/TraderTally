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
        const now = this.currentTimestamp;
        const dateStr = data.transaction_date || now.split('T')[0];

        return this.save(userId, {
            amount: data.amount,
            category: data.category,
            description: data.description,
            transaction_date: dateStr
        } as Partial<Transaction>, async (dbObj) => {
            const db = await getDatabase();
            await db.runAsync(
                `INSERT INTO ${this.tableName} (
                    id, user_id, amount, category, description, transaction_date, 
                    created_at, updated_at, is_deleted, sync_status, sync_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    dbObj.id, dbObj.user_id, dbObj.amount, dbObj.category, 
                    dbObj.description, dbObj.transaction_date, dbObj.created_at, 
                    dbObj.updated_at, dbObj.is_deleted, dbObj.sync_status
                ]
            );
        });
    }

    async update(userId: string, transactionId: string, data: {
        amount: number;
        category: string | null;
        description: string | null;
        transaction_date: string;
    }): Promise<void> {
        await this.save(userId, {
            id: transactionId,
            amount: data.amount,
            category: data.category,
            description: data.description,
            transaction_date: data.transaction_date
        } as Partial<Transaction>, async (dbObj) => {
            const db = await getDatabase();
            // For updates, we need to preserve created_at and increment sync_version
            const existing = await db.getFirstAsync<{ created_at: string, sync_version: number }>(
                `SELECT created_at, sync_version FROM ${this.tableName} WHERE id = ? AND user_id = ?`,
                [transactionId, userId]
            );

            if (!existing) {
                throw new Error(`Transaction ${transactionId} not found`);
            }

            await db.runAsync(
                `UPDATE ${this.tableName} SET 
                    amount = ?, category = ?, description = ?, transaction_date = ?, 
                    updated_at = ?, sync_status = ?, sync_version = ?
                WHERE id = ? AND user_id = ?`,
                [
                    dbObj.amount, dbObj.category, dbObj.description, dbObj.transaction_date,
                    dbObj.updated_at, dbObj.sync_status, existing.sync_version + 1,
                    transactionId, userId
                ]
            );
        });
    }
}

export const transactionRepo = new TransactionRepository();
