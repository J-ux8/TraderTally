import * as Crypto from 'expo-crypto';
import { getDatabase } from "./database";
import { supabase } from "./supabase";
import { pushPendingChanges } from "./sync";

export interface Debt {
  id: string;
  customer_name: string;
  amount: number;
  due_date: string | null;
  note: string | null;
  is_settled: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  deleted: number;
  sync_status: string;
}

// Get all debts for the current user from local SQLite
export async function getUserDebts(): Promise<Debt[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const db = await getDatabase();
    const results = await db.getAllAsync(
      "SELECT * FROM debts WHERE user_id = ? AND deleted = 0 ORDER BY created_at DESC",
      [user.id]
    );

    // Map SQLite boolean (0/1) to true/false
    return (results as any[]).map(d => ({
      ...d,
      is_settled: d.is_settled === 1
    })) as Debt[];
  } catch (error) {
    console.error("Error in getUserDebts:", error);
    return [];
  }
}

// Create a new debt locally
export async function createDebt(
  customerName: string,
  amount: number,
  dueDate: string | null,
  note: string | null
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(`
    INSERT INTO debts (
      id, user_id, customer_name, amount, due_date, note, is_settled, 
      created_at, updated_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending')
  `, [id, user.id, customerName.trim(), Math.abs(amount), dueDate || null, note?.trim() || null, now, now]);

  // Trigger background sync
  pushPendingChanges().catch(console.error);

  return { id, customer_name: customerName, amount: Math.abs(amount), due_date: dueDate, note, is_settled: false, created_at: now, updated_at: now, user_id: user.id };
}

// Update a debt locally
export async function updateDebt(
  id: string,
  data: {
    customer_name: string;
    amount: number;
    due_date: string | null;
    note: string | null;
  }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(`
    UPDATE debts SET 
      customer_name = ?, amount = ?, due_date = ?, note = ?, 
      updated_at = ?, sync_status = 'pending'
    WHERE id = ? AND user_id = ?
  `, [data.customer_name.trim(), Math.abs(data.amount), data.due_date || null, data.note?.trim() || null, now, id, user.id]);

  pushPendingChanges().catch(console.error);
}

// Settle a debt locally
export async function settleDebt(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(`
    UPDATE debts SET 
      is_settled = 1, updated_at = ?, sync_status = 'pending'
    WHERE id = ? AND user_id = ?
  `, [now, id, user.id]);

  pushPendingChanges().catch(console.error);
}

// Delete a debt locally (soft delete)
export async function deleteDebt(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(`
    UPDATE debts SET 
      deleted = 1, updated_at = ?, sync_status = 'pending'
    WHERE id = ? AND user_id = ?
  `, [now, id, user.id]);

  pushPendingChanges().catch(console.error);
}

