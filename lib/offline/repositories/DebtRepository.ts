import { BaseRepository } from './BaseRepository';
import { getDatabase } from '../../database';
import { withTransaction } from '../db-transaction';

export interface Debt {
    id: string;
    user_id: string;
    customer_name: string;
    amount: number;
    due_date: string | null;
    note: string | null;
    is_settled: number;
    created_at: string;
    updated_at: string;
    is_deleted: number;
    sync_status: string;
    sync_version: number;
}

export class DebtRepository extends BaseRepository<Partial<Debt>> {
    constructor() {
        super('debts');
    }

    async findAll(userId: string): Promise<Debt[]> {
        const db = await getDatabase();
        const results = await db.getAllAsync(
            `SELECT * FROM ${this.tableName} WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC`,
            [userId]
        );
        return results as Debt[];
    }

    async create(userId: string, data: {
        customer_name: string;
        amount: number;
        due_date: string | null;
        note: string | null;
    }): Promise<Debt> {
        const db = await getDatabase();
        const id = this.generateId();
        const now = this.currentTimestamp;

        await withTransaction(db, async () => {
            await db.runAsync(
                `INSERT INTO ${this.tableName} (
                    id, user_id, customer_name, amount, due_date, note, is_settled, 
                    created_at, updated_at, is_deleted, sync_status, sync_version
                ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 'pending', 1)`,
                [id, userId, data.customer_name.trim(), Math.abs(data.amount), data.due_date, data.note?.trim() || null, now, now]
            );
        });

        return {
            id,
            user_id: userId,
            customer_name: data.customer_name,
            amount: Math.abs(data.amount),
            due_date: data.due_date,
            note: data.note,
            is_settled: 0,
            created_at: now,
            updated_at: now,
            is_deleted: 0,
            sync_status: 'pending',
            sync_version: 1
        };
    }

    async update(userId: string, id: string, data: {
        customer_name: string;
        amount: number;
        due_date: string | null;
        note: string | null;
    }): Promise<void> {
        const db = await getDatabase();
        const now = this.currentTimestamp;

        await withTransaction(db, async () => {
            await db.runAsync(
                `UPDATE ${this.tableName} SET 
                    customer_name = ?, amount = ?, due_date = ?, note = ?, 
                    updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1
                WHERE id = ? AND user_id = ?`,
                [data.customer_name.trim(), Math.abs(data.amount), data.due_date, data.note?.trim() || null, now, id, userId]
            );
        });
    }

    async settle(userId: string, id: string): Promise<void> {
        const db = await getDatabase();
        const now = this.currentTimestamp;

        await withTransaction(db, async () => {
            await db.runAsync(
                `UPDATE ${this.tableName} SET 
                    is_settled = 1, updated_at = ?, sync_status = 'pending', sync_version = sync_version + 1
                WHERE id = ? AND user_id = ?`,
                [now, id, userId]
            );
        });
    }
}

export const debtRepo = new DebtRepository();
