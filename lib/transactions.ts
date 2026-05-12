import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";
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
export async function getUserTransactions(limit?: number, offset?: number): Promise<Transaction[]> {
  // SQLite doesn't directly support offset/limit in the LocalDB generic yet, 
  // but we mostly need getAll for this app's current usage.
  return await LocalDB.getAll<Transaction>('transactions');
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
  for (const update of updates) {
    await LocalDB.update('transactions', update.id, {
      amount: update.amount,
      category: update.category,
      description: update.description,
      transaction_date: update.transaction_date
    });
  }
  SyncEngine.syncAll().catch(console.error);
}

export async function batchDeleteTransactions(ids: string[]): Promise<void> {
  for (const id of ids) {
    await LocalDB.delete('transactions', id);
  }
  SyncEngine.syncAll().catch(console.error);
}

export async function batchInsertTransactions(
  transactions: Array<{ amount: number; category: string | null; description: string | null; transaction_date: string }>
): Promise<Transaction[]> {
  const results: Transaction[] = [];
  for (const tx of transactions) {
    const res = await LocalDB.create<Transaction>('transactions', {
      amount: tx.amount,
      category: tx.category,
      description: tx.description,
      transaction_date: tx.transaction_date
    } as any);
    results.push(res);
  }
  SyncEngine.syncAll().catch(console.error);
  return results;
}
