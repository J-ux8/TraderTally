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
      await LocalDB.enqueue('products', existing.id, 'update');
    } else {
      const productId = randomUUID();
      const productRecord = {
        id: productId,
        user_id: userId,
        name: normalizedName,
        display_name: displayName,
        price: params.sellingPrice,
        cost_price: costPricePerUnit,
        category_id: params.categoryId,
        stock_quantity: params.quantity,
        usage_count: 0,
        is_deleted: 0,
        sync_status: 'pending',
        retry_count: 0,
        created_at: now,
        updated_at: now
      };

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
      await LocalDB.enqueue('products', productId, 'create', productRecord);
    }

    const txId = randomUUID();
    const txRecord = {
      id: txId,
      user_id: userId,
      amount: -totalCost,
      category: params.categoryName,
      description: `Order: ${params.quantity}x ${displayName}`,
      transaction_date: params.purchasedAt,
      is_deleted: 0,
      sync_status: 'pending',
      retry_count: 0,
      created_at: now,
      updated_at: now
    };

    await db.runAsync(
      `INSERT INTO transactions
       (id, user_id, amount, category, description, transaction_date, is_deleted, sync_status, retry_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      txId,
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
    await LocalDB.enqueue('transactions', txId, 'create', txRecord);
  });

  SyncEngine.syncAll().catch(console.error);
}
