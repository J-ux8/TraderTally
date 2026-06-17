import { getDatabase } from "./database";
import { LocalDB } from "../database/localDb";
import { randomUUID } from 'expo-crypto';

export interface StockBatch {
  id: string;
  user_id: string;
  product_id: string;
  total_cost: number;
  units_in_batch: number;
  unit_cost: number;
  units_remaining: number;
  purchased_at: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  sync_status: string;
  retry_count: number;
}

export interface ConsumeResult {
  unitCost: number;
  totalCost: number;
}

export async function getStockQuantity(productId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(units_remaining), 0) as total 
     FROM stock_batches 
     WHERE product_id = ? AND is_deleted = 0 AND units_remaining > 0`,
    productId
  );
  return result?.total || 0;
}

export async function consumeFromFIFO(
  productId: string,
  quantity: number,
): Promise<ConsumeResult> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) throw new Error('User not authenticated');

  const batches = await db.getAllAsync<StockBatch>(
    `SELECT * FROM stock_batches 
     WHERE product_id = ? AND is_deleted = 0 AND units_remaining > 0 
     ORDER BY purchased_at ASC, created_at ASC`,
    productId
  );

  let remaining = quantity;
  let totalCost = 0;
  let totalConsumed = 0;

  for (const batch of batches) {
    if (remaining <= 0) break;

    const consumeFromThis = Math.min(batch.units_remaining, remaining);
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE stock_batches SET units_remaining = units_remaining - ?, updated_at = ?, sync_status = ? WHERE id = ?`,
      consumeFromThis,
      now,
      'pending',
      batch.id
    );

    totalCost += consumeFromThis * batch.unit_cost;
    totalConsumed += consumeFromThis;
    remaining -= consumeFromThis;
  }

  if (remaining > 0) {
    throw new Error(
      `Insufficient stock. Only ${totalConsumed} available, but ${quantity} requested. Please restock first.`
    );
  }

  return {
    unitCost: totalCost / totalConsumed,
    totalCost,
  };
}

export async function restockProduct(
  productId: string,
  totalCost: number,
  unitsInBatch: number,
  purchasedAt: string,
  sellingPrice?: number,
): Promise<void> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) throw new Error('User not authenticated');

  const unitCost = totalCost / unitsInBatch;
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO stock_batches 
       (id, user_id, product_id, total_cost, units_in_batch, unit_cost, units_remaining, purchased_at, created_at, updated_at, is_deleted, sync_status, retry_count) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      userId,
      productId,
      totalCost,
      unitsInBatch,
      unitCost,
      unitsInBatch,
      purchasedAt,
      now,
      now,
      0,
      'pending',
      0
    );

    const setClauses = [
      'stock_quantity = COALESCE(stock_quantity, 0) + ?',
      'cost_price = ?',
    ];
    const params: any[] = [unitsInBatch, unitCost];

    if (sellingPrice != null && sellingPrice > 0) {
      setClauses.push('price = ?');
      params.push(sellingPrice);
    }

    params.push(now, 'pending', productId);

    await db.runAsync(
      `UPDATE products SET 
       ${setClauses.join(', ')},
       updated_at = ?,
       sync_status = ?
       WHERE id = ?`,
      ...params
    );

    await db.runAsync(
      `INSERT INTO transactions 
       (id, user_id, amount, category, description, transaction_date, is_deleted, sync_status, retry_count, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      userId,
      -totalCost,
      'Stock / Inventory',
      `Restock: ${unitsInBatch} units`,
      purchasedAt,
      0,
      'pending',
      0,
      now,
      now
    );
  });
}
