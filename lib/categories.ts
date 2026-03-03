import * as Crypto from 'expo-crypto';
import { getDatabase } from "./database";
import { supabase } from "./supabase";
import { pushPendingChanges } from "./sync";

export interface Category {
    id: string;
    user_id: string;
    name: string;
    created_at: string;
    updated_at: string;
    deleted: number;
    sync_status: string;
}

export async function getUserCategories(): Promise<Category[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const db = await getDatabase();
        const results = await db.getAllAsync(
            "SELECT * FROM categories WHERE user_id = ? AND deleted = 0 ORDER BY name ASC",
            [user.id]
        );
        return results as Category[];
    } catch (error) {
        console.error("Error in getUserCategories:", error);
        return [];
    }
}

export async function addCategory(name: string): Promise<Category> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const db = await getDatabase();
    const id = Crypto.randomUUID();
    const now = new Date().toISOString();

    // Check if category already exists (case-insensitive)
    const existing = await db.getFirstAsync(
        "SELECT * FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?) AND deleted = 0",
        [user.id, name.trim()]
    ) as Category;

    if (existing) {
        return existing;
    }

    await db.runAsync(`
    INSERT INTO categories (
      id, user_id, name, created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, 'pending')
  `, [id, user.id, name.trim(), now, now]);

    pushPendingChanges().catch(console.error);

    return {
        id,
        user_id: user.id,
        name: name.trim(),
        created_at: now,
        updated_at: now,
        deleted: 0,
        sync_status: 'pending'
    };
}

export async function deleteCategory(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(`
    UPDATE categories SET 
      deleted = 1, updated_at = ?, sync_status = 'pending'
    WHERE id = ? AND user_id = ?
  `, [now, id, user.id]);

    pushPendingChanges().catch(console.error);
}
