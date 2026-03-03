import * as Crypto from 'expo-crypto';
import { getDatabase } from "./database";
import { supabase } from "./supabase";
import { pushPendingChanges } from "./sync";

export const EXPENSE_CATEGORIES = [
  "Stock / Inventory",
  "Rent / Stall Fee",
  "Salaries / Helpers",
  "Transport / Fuel",
  "Utilities",
  "Airtime / Data",
  "Maintenance / Repairs",
  "Business Supplies",
  "Market Levy / Tax",
  "Loan Repayment",
  "Other"
];

export const INCOME_CATEGORIES = [
  "Sales",
  "Services",
  "Rental Income",
  "Other"
];

// Helper function to get local date string (YYYY-MM-DD)
function getLocalDateString(date?: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Record a sale locally
export async function recordSale(
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const dateStr = date || getLocalDateString();

  await db.runAsync(`
    INSERT INTO transactions (
      id, user_id, amount, category, description, transaction_date, 
      created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [id, user.id, Math.abs(amount), categoryName, description, dateStr, now, now]);

  // Trigger background sync
  pushPendingChanges().catch(console.error);

  return { id, amount, category: categoryName, description, transaction_date: dateStr };
}

// Record an expense locally
export async function recordExpense(
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const dateStr = date || getLocalDateString();

  await db.runAsync(`
    INSERT INTO transactions (
      id, user_id, amount, category, description, transaction_date, 
      created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [id, user.id, -Math.abs(amount), categoryName, description, dateStr, now, now]);

  pushPendingChanges().catch(console.error);

  return { id, amount: -Math.abs(amount), category: categoryName, description, transaction_date: dateStr };
}

// Get user's transactions from local SQLite
export async function getUserTransactions(limit?: number) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const db = await getDatabase();
    let query = `SELECT * FROM transactions WHERE user_id = ? AND deleted = 0 ORDER BY transaction_date DESC, created_at DESC`;
    if (limit) query += ` LIMIT ${limit}`;

    const results = await db.getAllAsync(query, [user.id]);
    return results || [];
  } catch (error) {
    console.error("Error in getUserTransactions:", error);
    return [];
  }
}

// Update a transaction locally
export async function updateTransaction(
  transactionId: string,
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const db = await getDatabase();
  const now = new Date().toISOString();
  const dateStr = date || getLocalDateString();

  await db.runAsync(`
    UPDATE transactions SET 
      amount = ?, category = ?, description = ?, transaction_date = ?, 
      updated_at = ?, sync_status = 'pending'
    WHERE id = ? AND user_id = ?
  `, [amount, categoryName, description, dateStr, now, transactionId, user.id]);

  pushPendingChanges().catch(console.error);
}

// Delete a transaction (soft delete)
export async function deleteTransaction(transactionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(`
    UPDATE transactions SET 
      deleted = 1, updated_at = ?, sync_status = 'pending'
    WHERE id = ? AND user_id = ?
  `, [now, transactionId, user.id]);

  pushPendingChanges().catch(console.error);
}

// Get real-time profit
export async function getRealTimeProfit() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const db = await getDatabase();
  const result = await db.getFirstAsync(`
    SELECT SUM(amount) as total FROM transactions WHERE user_id = ? AND deleted = 0
  `, [user.id]) as { total: number };

  return result?.total || 0;
}
