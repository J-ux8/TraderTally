import { BaseRepository } from './BaseRepository';
import { getDatabase } from '../../database';
import { withTransaction } from '../db-transaction';

export interface Category {
    id: string;
    user_id: string;
    name: string;
    normalized_name: string;
    created_at: string;
    updated_at: string;
    is_deleted: number;
    sync_status: string;
    sync_version: number;
}

export class CategoryRepository extends BaseRepository<Partial<Category>> {
    constructor() {
        super('categories');
    }

    async findAll(userId: string): Promise<Category[]> {
        const db = await getDatabase();
        const results = await db.getAllAsync(
            `SELECT * FROM ${this.tableName} WHERE user_id = ? AND is_deleted = 0 ORDER BY name ASC`,
            [userId]
        );
        return results as Category[];
    }

    async findByNormalizedName(userId: string, normalizedName: string): Promise<Category | null> {
        const db = await getDatabase();
        const result = await db.getFirstAsync(
            `SELECT * FROM ${this.tableName} WHERE user_id = ? AND normalized_name = ? AND is_deleted = 0`,
            [userId, normalizedName]
        );
        return result as Category | null;
    }

    async createCategory(userId: string, name: string): Promise<Category> {
        const trimmedName = name.trim();
        const normalizedName = trimmedName.toLowerCase();

        const existing = await this.findByNormalizedName(userId, normalizedName);
        if (existing) return existing;

        const db = await getDatabase();
        const id = this.generateId();
        const now = this.currentTimestamp;

        await withTransaction(db, async () => {
            await db.runAsync(
                `INSERT INTO ${this.tableName} (
                    id, user_id, name, normalized_name, created_at, updated_at, is_deleted, sync_status, sync_version
                ) VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', 1)`,
                [id, userId, trimmedName, normalizedName, now, now]
            );
        });

        return {
            id,
            user_id: userId,
            name: trimmedName,
            normalized_name: normalizedName,
            created_at: now,
            updated_at: now,
            is_deleted: 0,
            sync_status: 'pending',
            sync_version: 1
        };
    }

    protected async validateBeforeDelete(id: string): Promise<void> {
        const db = await getDatabase();
        // Check if category is actively in use by transactions
        // Note: Comparing by category name as per current transaction schema
        const linkedTransactions = await db.getAllAsync(
            `SELECT id FROM transactions WHERE category = (SELECT name FROM categories WHERE id = ?) AND is_deleted = 0 LIMIT 1`,
            [id]
        );

        if (linkedTransactions.length > 0) {
            throw new Error("Cannot delete category: Activity exists. Please clear items associated with this category or re-assign them first.");
        }
    }
}

export const categoryRepo = new CategoryRepository();
