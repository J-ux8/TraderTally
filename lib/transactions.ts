import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";
import { getDatabase } from "./database";
import { z } from "zod";

// --- Security: Input Validation Schemas ---
const transactionSchema = z.object({
  amount: z.number({ message: "Amount is required" }).finite("Amount must be a valid number").safe(),
  category: z.string().max(100, "Category is too long").nullable().optional(),
  description: z.string().max(1000, "Description is too long").nullable().optional(),
  date: z.string().refine(val => !isNaN(Date.parse(val)), { message: "Invalid date format" }).optional(),
  customerId: z.string().uuid("Invalid Customer ID").nullable().optional(),
  linkedSaleId: z.string().uuid("Invalid Sale ID").nullable().optional()
});

function validateTransactionInput(data: any) {
  const result = transactionSchema.safeParse(data);
  if (!result.success) {
    // Return the first friendly error message
    throw new Error(result.error.issues[0].message);
  }
}

export interface Transaction extends LocalBaseModel {
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  customer_id: string | null;
  linked_sale_id: string | null;
  sale_items?: any[]; // Optional field for detailed breakdown
}

export async function getSaleItems(saleId: string): Promise<any[]> {
  return await LocalDB.getAllByField('sale_items', 'sale_id', saleId);
}

/**
 * Batch fetch sale items for multiple sale IDs in ONE query (eliminates N+1)
 */
export async function getSaleItemsBatch(saleIds: string[]): Promise<Record<string, any[]>> {
  if (saleIds.length === 0) return {};
  const db = await getDatabase();
  const placeholders = saleIds.map(() => '?').join(', ');
  const rows = await db.getAllAsync<any>(
    `SELECT si.*, p.category_id, c.name as category_name
     FROM sale_items si
     LEFT JOIN products p ON si.product_id = p.id
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE si.sale_id IN (${placeholders}) AND si.is_deleted = 0`,
    saleIds
  );
  // Group results by sale_id
  return rows.reduce((acc, item) => {
    if (!acc[item.sale_id]) acc[item.sale_id] = [];
    acc[item.sale_id].push(item);
    return acc;
  }, {} as Record<string, any[]>);
}

/**
 * Record a sale (Positive amount)
 */
export async function recordSale(
  amount: number,
  category: string | null,
  description: string | null,
  date?: string,
  customerId?: string,
  linkedSaleId?: string
): Promise<Transaction> {
  // Security Rule #3: Validate inputs server/logic-side
  validateTransactionInput({ amount, category, description, date, customerId, linkedSaleId });

  const record = await LocalDB.create<Transaction>('transactions', {
    amount: Math.abs(amount),
    category,
    description,
    transaction_date: date || new Date().toISOString(),
    customer_id: customerId || null,
    linked_sale_id: linkedSaleId || null
  } as any);

  // Trigger background sync (non-blocking)
  SyncEngine.syncAll().catch(console.error);
  return record;
}

/**
 * Record an expense (Negative amount)
 */
export async function recordExpense(
  amount: number,
  category: string | null,
  description: string | null,
  date?: string,
  customerId?: string,
  linkedSaleId?: string
): Promise<Transaction> {
  // Security Rule #3: Validate inputs server/logic-side
  validateTransactionInput({ amount, category, description, date, customerId, linkedSaleId });

  const record = await LocalDB.create<Transaction>('transactions', {
    amount: -Math.abs(amount),
    category,
    description,
    transaction_date: date || new Date().toISOString(),
    customer_id: customerId || null,
    linked_sale_id: linkedSaleId || null
  } as any);

  // Trigger background sync (non-blocking)
  SyncEngine.syncAll().catch(console.error);
  return record;
}

/**
 * Get user transactions
 */
export async function getUserTransactions(limit: number = 150, offset: number = 0): Promise<Transaction[]> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) return [];
  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions
     WHERE user_id = ? AND is_deleted = 0
     ORDER BY transaction_date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    userId, limit, offset
  );
}

/**
 * Update transaction
 */
export async function updateTransaction(
  id: string,
  amount: number,
  category: string | null,
  description: string | null,
  date?: string,
  customerId?: string
): Promise<void> {
  // Security Rule #3: Validate inputs server/logic-side
  validateTransactionInput({ amount, category, description, date, customerId });
  if (id) {
    const idResult = z.string().min(1).safeParse(id);
    if (!idResult.success) throw new Error("Invalid transaction ID");
  }

  await LocalDB.update('transactions', id, {
    amount,
    category,
    description,
    transaction_date: date || new Date().toISOString(),
    customer_id: customerId || null
  });

  // Trigger background sync (non-blocking)
  SyncEngine.syncAll().catch(console.error);
}

/**
 * Delete transaction (Soft delete)
 */
export async function deleteTransaction(id: string): Promise<void> {
  await LocalDB.delete('transactions', id);

  // Trigger background sync (non-blocking)
  SyncEngine.syncAll().catch(console.error);
}

/**
 * Get real-time profit (Calculated from local db)
 */
export async function getRealTimeProfit(): Promise<number> {
  const transactions = await LocalDB.getAll<Transaction>('transactions');
  return transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
}

/**
 * Batch operations (Redirected to optimized LocalDB loop)
 */
export async function batchUpdateTransactions(
  updates: Array<{ id: string; amount: number; category: string | null; description: string | null; transaction_date: string }>
): Promise<void> {
  if (updates.length === 0) return;
  const db = await getDatabase();
  const now = new Date().toISOString();
  // Wrap all updates in a single atomic SQLite transaction (much faster than N commits)
  await db.withTransactionAsync(async () => {
    for (const update of updates) {
      await db.runAsync(
        `UPDATE transactions SET amount = ?, category = ?, description = ?, transaction_date = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
        update.amount, update.category, update.description, update.transaction_date, now, update.id
      );
    }
  });
  SyncEngine.syncAll().catch(console.error);
}

export async function batchDeleteTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const now = new Date().toISOString();
  // Single atomic transaction instead of N individual soft-delete commits
  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        `UPDATE transactions SET is_deleted = 1, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
        now, id
      );
    }
  });
  SyncEngine.syncAll().catch(console.error);
}

export async function batchInsertTransactions(
  transactions: Array<{ amount: number; category: string | null; description: string | null; transaction_date: string }>
): Promise<Transaction[]> {
  if (transactions.length === 0) return [];
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) throw new Error('Cannot insert: User not authenticated');
  const now = new Date().toISOString();
  const results: Transaction[] = [];
  // Single atomic transaction for all inserts
  await db.withTransactionAsync(async () => {
    for (const tx of transactions) {
      const { randomUUID } = await import('expo-crypto');
      const id = randomUUID();
      await db.runAsync(
        `INSERT INTO transactions (id, user_id, amount, category, description, transaction_date, customer_id, linked_sale_id, created_at, updated_at, is_deleted, sync_status, retry_count)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 0, 'pending', 0)`,
        id, userId, tx.amount, tx.category, tx.description, tx.transaction_date, now, now
      );
      results.push({ id, user_id: userId, amount: tx.amount, category: tx.category, description: tx.description,
        transaction_date: tx.transaction_date, customer_id: null, linked_sale_id: null,
        created_at: now, updated_at: now, is_deleted: 0, sync_status: 'pending', retry_count: 0 } as any);
    }
  });
  SyncEngine.syncAll().catch(console.error);
  return results;
}
