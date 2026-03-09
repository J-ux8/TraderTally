import { BaseRepository } from './BaseRepository';
import { getDatabase } from '../../database';

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
        const now = this.currentTimestamp;
        
        const id = await this.save(userId, {
            customer_name: data.customer_name.trim(),
            amount: Math.abs(data.amount),
            due_date: data.due_date,
            note: data.note?.trim() || null,
            is_settled: 0
        } as Partial<Debt>, async (dbObj) => {
            const db = await getDatabase();
            await db.runAsync(
                `INSERT INTO ${this.tableName} (
                    id, user_id, customer_name, amount, due_date, note, is_settled, 
                    created_at, updated_at, is_deleted, sync_status, sync_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                    dbObj.id, dbObj.user_id, dbObj.customer_name, dbObj.amount, 
                    dbObj.due_date, dbObj.note, dbObj.is_settled,
                    dbObj.created_at, dbObj.updated_at, dbObj.is_deleted, dbObj.sync_status
                ]
            );
        });

        return {
            id,
            user_id: userId,
            customer_name: data.customer_name.trim(),
            amount: Math.abs(data.amount),
            due_date: data.due_date,
            note: data.note?.trim() || null,
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
        await this.save(userId, {
            id,
            customer_name: data.customer_name.trim(),
            amount: Math.abs(data.amount),
            due_date: data.due_date,
            note: data.note?.trim() || null
        } as Partial<Debt>, async (dbObj) => {
            const db = await getDatabase();
            // For updates, we need to preserve created_at, is_settled, and increment sync_version
            const existing = await db.getFirstAsync<{ created_at: string, sync_version: number, is_settled: number }>(
                `SELECT created_at, sync_version, is_settled FROM ${this.tableName} WHERE id = ? AND user_id = ?`,
                [id, userId]
            );

            if (!existing) {
                throw new Error(`Debt ${id} not found`);
            }

            await db.runAsync(
                `UPDATE ${this.tableName} SET 
                    customer_name = ?, amount = ?, due_date = ?, note = ?, 
                    updated_at = ?, sync_status = ?, sync_version = ?
                WHERE id = ? AND user_id = ?`,
                [
                    dbObj.customer_name, dbObj.amount, dbObj.due_date, dbObj.note,
                    dbObj.updated_at, dbObj.sync_status, existing.sync_version + 1,
                    id, userId
                ]
            );
        });
    }

    async settle(userId: string, id: string): Promise<void> {
        await this.save(userId, {
            id,
            is_settled: 1
        } as Partial<Debt>, async (dbObj) => {
            const db = await getDatabase();
            // For settle, we need to preserve all other fields and increment sync_version
            const existing = await db.getFirstAsync<{ created_at: string, sync_version: number }>(
                `SELECT created_at, sync_version FROM ${this.tableName} WHERE id = ? AND user_id = ?`,
                [id, userId]
            );

            if (!existing) {
                throw new Error(`Debt ${id} not found`);
            }

            await db.runAsync(
                `UPDATE ${this.tableName} SET 
                    is_settled = 1, updated_at = ?, sync_status = ?, sync_version = ?
                WHERE id = ? AND user_id = ?`,
                [dbObj.updated_at, dbObj.sync_status, existing.sync_version + 1, id, userId]
            );
        });
    }
}

export const debtRepo = new DebtRepository();
