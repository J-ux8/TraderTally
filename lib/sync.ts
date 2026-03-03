import { getDatabase } from "./database";
import { supabase } from "./supabase";

// Offline-first sync manager
export async function pushPendingChanges() {
    const db = await getDatabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Transactions Sync
    const pendingTransactions = await db.getAllAsync(`
    SELECT * FROM transactions WHERE sync_status = 'pending' AND user_id = ?
  `, [user.id]);

    for (const tx of pendingTransactions as any[]) {
        try {
            if (tx.deleted) {
                const { error } = await supabase.from("transactions").delete().eq("id", tx.id).eq("user_id", user.id);
                if (!error) await db.runAsync("DELETE FROM transactions WHERE id = ?", [tx.id]);
            } else {
                const { error } = await supabase.from("transactions").upsert({
                    id: tx.id, user_id: tx.user_id, amount: tx.amount, category: tx.category,
                    description: tx.description, transaction_date: tx.transaction_date,
                    created_at: tx.created_at, updated_at: tx.updated_at,
                });
                if (!error) await db.runAsync("UPDATE transactions SET sync_status = 'synced' WHERE id = ?", [tx.id]);
            }
        } catch (e) {
            console.error("Sync error for transaction", tx.id, e);
        }
    }

    // 2. Categories Sync
    const pendingCategories = await db.getAllAsync(`
    SELECT * FROM categories WHERE sync_status = 'pending' AND user_id = ?
  `, [user.id]);

    for (const cat of pendingCategories as any[]) {
        try {
            if (cat.deleted) {
                const { error } = await supabase.from("categories").delete().eq("id", cat.id).eq("user_id", user.id);
                if (!error) await db.runAsync("DELETE FROM categories WHERE id = ?", [cat.id]);
            } else {
                const { error } = await supabase.from("categories").upsert({
                    id: cat.id, user_id: cat.user_id, name: cat.name,
                    created_at: cat.created_at, updated_at: cat.updated_at,
                });
                if (!error) await db.runAsync("UPDATE categories SET sync_status = 'synced' WHERE id = ?", [cat.id]);
            }
        } catch (e) {
            console.error("Sync error for category", cat.id, e);
        }
    }

    // 3. Debts Sync
    const pendingDebts = await db.getAllAsync(`
    SELECT * FROM debts WHERE sync_status = 'pending' AND user_id = ?
  `, [user.id]);

    for (const debt of pendingDebts as any[]) {
        try {
            if (debt.deleted) {
                const { error } = await supabase.from("debts").delete().eq("id", debt.id).eq("user_id", user.id);
                if (!error) await db.runAsync("DELETE FROM debts WHERE id = ?", [debt.id]);
            } else {
                const { error } = await supabase.from("debts").upsert({
                    id: debt.id, user_id: debt.user_id, customer_name: debt.customer_name,
                    amount: debt.amount, due_date: debt.due_date, note: debt.note,
                    is_settled: debt.is_settled === 1, created_at: debt.created_at, updated_at: debt.updated_at,
                });
                if (!error) await db.runAsync("UPDATE debts SET sync_status = 'synced' WHERE id = ?", [debt.id]);
            }
        } catch (e) {
            console.error("Sync error for debt", debt.id, e);
        }
    }
}

export async function pullCloudChanges() {
    const db = await getDatabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Pull Transactions
    const { data: txData, error: txError } = await supabase.from("transactions").select("*").eq("user_id", user.id);
    if (!txError && txData) {
        for (const tx of txData) {
            await db.runAsync(`
        INSERT OR REPLACE INTO transactions (id, user_id, amount, category, description, transaction_date, created_at, updated_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `, [tx.id, tx.user_id, tx.amount, tx.category, tx.description, tx.transaction_date, tx.created_at, tx.updated_at]);
        }
    }

    // Pull Categories
    const { data: catData, error: catError } = await supabase.from("categories").select("*").eq("user_id", user.id);
    if (!catError && catData) {
        for (const cat of catData) {
            await db.runAsync(`
        INSERT OR REPLACE INTO categories (id, user_id, name, created_at, updated_at, sync_status)
        VALUES (?, ?, ?, ?, ?, 'synced')
      `, [cat.id, cat.user_id, cat.name, cat.created_at, cat.updated_at]);
        }
    }

    // Pull Debts
    const { data: debtData, error: debtError } = await supabase.from("debts").select("*").eq("user_id", user.id);
    if (!debtError && debtData) {
        for (const debt of debtData) {
            await db.runAsync(`
        INSERT OR REPLACE INTO debts (id, user_id, customer_name, amount, due_date, note, is_settled, created_at, updated_at, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `, [debt.id, debt.user_id, debt.customer_name, debt.amount, debt.due_date, debt.note, debt.is_settled ? 1 : 0, debt.created_at, debt.updated_at]);
        }
    }
}

export async function getLastSyncedAt(): Promise<string | null> {
    const db = await getDatabase();
    // Simplified: check most recent updated_at in synced transactions
    const result = await db.getFirstAsync(`
    SELECT updated_at FROM transactions WHERE sync_status = 'synced' ORDER BY updated_at DESC LIMIT 1
  `) as { updated_at: string };
    return result?.updated_at || null;
}
