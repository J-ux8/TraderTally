import { getDatabase } from "./database";
import { LocalDB } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";
import { randomUUID } from 'expo-crypto';

export async function placeOrder(params: {
  productName: string;
  categoryId: string;
  categoryName: string;
  orderPricePerUnit: number;
  quantity: number;
  sellingPrice: number;
  purchasedAt: string;
}): Promise<void> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) throw new Error('User not authenticated');

  const costPricePerUnit = params.orderPricePerUnit;
  const totalCost = params.orderPricePerUnit * params.quantity;
  const now = new Date().toISOString();
  const displayName = params.productName.trim();
  const normalizedName = displayName.toLowerCase();

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM products WHERE user_id = ? AND name = ?',
      userId,
      normalizedName
    );

    if (existing) {
      await db.runAsync(
        `UPDATE products SET
         display_name = ?, price = ?, cost_price = ?,
         stock_quantity = COALESCE(stock_quantity, 0) + ?,
         category_id = ?, updated_at = ?, sync_status = ?
         WHERE id = ?`,
        displayName,
        params.sellingPrice,
        costPricePerUnit,
        params.quantity,
        params.categoryId,
        now,
        'pending',
        existing.id
      );
    } else {
      const productId = randomUUID();
      await db.runAsync(
        `INSERT INTO products
         (id, user_id, name, display_name, price, cost_price, category_id, stock_quantity, usage_count, is_deleted, sync_status, retry_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        productId,
        userId,
        normalizedName,
        displayName,
        params.sellingPrice,
        costPricePerUnit,
        params.categoryId,
        params.quantity,
        0,
        0,
        'pending',
        0,
        now,
        now
      );
    }

    await db.runAsync(
      `INSERT INTO transactions
       (id, user_id, amount, category, description, transaction_date, is_deleted, sync_status, retry_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      userId,
      -totalCost,
       params.categoryName,
      `Order: ${params.quantity}x ${displayName}`,
      params.purchasedAt,
      0,
      'pending',
      0,
      now,
      now
    );
  });

  SyncEngine.syncAll().catch(console.error);
}
