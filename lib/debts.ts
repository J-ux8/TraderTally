import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";
import { getOrCreateCustomer } from "./customers";

export interface Debt extends LocalBaseModel {
  customer_name: string;
  customer_phone: string | null;
  customer_id: string | null;
  amount: number;
  due_date: string | null;
  note: string | null;
  is_settled: number;
  type: 'receivable' | 'payable';
}


/**
 * Get user debts
 */
export async function getUserDebts(limit?: number, offset?: number): Promise<Debt[]> {
  return await LocalDB.getAll<Debt>('debts');
}


/**
 * Add a new debt
 */
export async function addDebt(
  customer_name: string,
  amount: number,
  due_date?: string,
  note?: string,
  customer_phone?: string,
  type: 'receivable' | 'payable' = 'receivable'
): Promise<Debt> {
  // Try to link a customer
  let customerId = null;
  try {
    const customer = await getOrCreateCustomer(customer_name, customer_phone);
    customerId = customer.id;
  } catch (e) {
    console.error('[Debts] Failed to link customer:', e);
  }

  const record = await LocalDB.create<Debt>('debts', {
    customer_name,
    customer_phone: customer_phone || null,
    customer_id: customerId,
    amount,
    due_date: due_date || null,
    note: note || null,
    is_settled: 0,
    type
  } as any);

  SyncEngine.syncAll().catch(console.error);
  return record;
}

/**
 * Update existing debt
 */
export async function updateDebt(
  id: string,
  customer_name: string,
  amount: number,
  due_date?: string,
  note?: string,
  customer_phone?: string,
  type?: 'receivable' | 'payable'
): Promise<void> {
  await LocalDB.update('debts', id, {
    customer_name,
    customer_phone: customer_phone || null,
    amount,
    due_date: due_date || null,
    note: note || null,
    ...(type && { type })
  });

  SyncEngine.syncAll().catch(console.error);
}

/**
 * Settle debt
 */
export async function settleDebt(id: string): Promise<void> {
  await LocalDB.update('debts', id, { is_settled: 1 } as any);
  SyncEngine.syncAll().catch(console.error);
}

/**
 * Delete debt (Soft delete)
 */
export async function deleteDebt(id: string): Promise<void> {
  await LocalDB.delete('debts', id);
  SyncEngine.syncAll().catch(console.error);
}

/**
 * Batch operations
 */
export async function batchSettleDebts(ids: string[]): Promise<void> {
  for (const id of ids) {
    await LocalDB.update('debts', id, { is_settled: 1 } as any);
  }
  SyncEngine.syncAll().catch(console.error);
}

export async function batchDeleteDebts(ids: string[]): Promise<void> {
  for (const id of ids) {
    await LocalDB.delete('debts', id);
  }
  SyncEngine.syncAll().catch(console.error);
}

export async function batchUpdateDebts(
  updates: Array<{ id: string; customer_name: string; amount: number; due_date?: string; note?: string; type?: 'receivable' | 'payable' }>
): Promise<void> {
  for (const update of updates) {
    await LocalDB.update('debts', update.id, {
      customer_name: update.customer_name,
      amount: update.amount,
      due_date: update.due_date,
      note: update.note,
      ...(update.type && { type: update.type })
    });
  }
  SyncEngine.syncAll().catch(console.error);
}

export async function batchInsertDebts(
  debts: Array<{ customer_name: string; amount: number; due_date?: string; note?: string; type?: 'receivable' | 'payable' }>
): Promise<Debt[]> {
  const results: Debt[] = [];
  for (const debt of debts) {
    const res = await LocalDB.create<Debt>('debts', {
      customer_name: debt.customer_name,
      amount: debt.amount,
      due_date: debt.due_date,
      note: debt.note,
      is_settled: 0,
      type: debt.type || 'receivable'
    } as any);
    results.push(res);
  }
  SyncEngine.syncAll().catch(console.error);
  return results;
}
