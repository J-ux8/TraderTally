import { getDatabase } from "./database";
import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";
import { randomUUID } from 'expo-crypto';
import { CartItem } from "../contexts/CartContext";

export interface Sale extends LocalBaseModel {
  total_amount: number;
}

export interface SaleItem extends LocalBaseModel {
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number | null;
  total_price: number;
}

/**
 * Complete a multi-item sale atomically.
 * Uses product-level stock_quantity and cost_price (no FIFO batches).
 */
export async function completeSale(
  items: CartItem[], 
  totalAmount: number,
  paymentStatus: 'Paid' | 'Credit' = 'Paid',
  customerId?: string,
  customerName?: string,
  customerPhone?: string,
  date?: string
): Promise<Sale> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) throw new Error('User must be authenticated');

  // Pre-check: read stock_quantity + cost_price for each product
  type StockInfo = { stockQty: number | null; costPrice: number | null };
  const stockInfoMap = new Map<string, StockInfo>();

  for (const item of items) {
    const product = await db.getFirstAsync<{ stock_quantity: number | null; cost_price: number | null }>(
      'SELECT stock_quantity, cost_price FROM products WHERE id = ? AND is_deleted = 0',
      item.product_id
    );
    if (!product) {
      throw new Error(`Product "${item.name}" not found.`);
    }
    const available = product.stock_quantity ?? 0;
    if (available < item.quantity) {
      throw new Error(
        `Insufficient stock for "${item.name}". Only ${available} in stock, but ${item.quantity} requested. Please restock first.`
      );
    }
    stockInfoMap.set(item.product_id, { stockQty: product.stock_quantity, costPrice: product.cost_price });
  }

  const now = date || new Date().toISOString();
  const saleId = randomUUID();

  const saleRecord: Sale = {
    id: saleId,
    user_id: userId,
    total_amount: totalAmount,
    is_deleted: 0,
    sync_status: 'pending',
    retry_count: 0,
    created_at: now,
    updated_at: now
  };

  try {
    await db.withTransactionAsync(async () => {
      // 1. Insert Sales Record
      await db.runAsync(
        `INSERT INTO sales (id, user_id, total_amount, is_deleted, sync_status, retry_count, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        saleRecord.id,
        saleRecord.user_id,
        saleRecord.total_amount,
        0,
        'pending',
        0,
        now,
        now
      );

      // 2. Insert Sale Items, snapshot cost, decrement stock
      const itemNames = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const primaryCategory = 'Sale';

      for (const item of items) {
        const stockInfo = stockInfoMap.get(item.product_id)!;
        // unit_cost = product's cost_price at time of sale (NULL if legacy product with no cost tracking)
        const unitCost = stockInfo.costPrice;
        const itemId = randomUUID();
        const itemTotal = item.price * item.quantity;

        await db.runAsync(
          `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, unit_cost, total_price, is_deleted, sync_status, retry_count, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          itemId,
          saleId,
          item.product_id,
          item.name,
          item.quantity,
          item.price,
          unitCost,
          itemTotal,
          0,
          'pending',
          0,
          now,
          now
        );

        // Decrement product stock_quantity
        await db.runAsync(
          `UPDATE products SET 
           stock_quantity = stock_quantity - ?,
           usage_count = usage_count + ?,
           updated_at = ?,
           sync_status = ?
           WHERE id = ?`,
          item.quantity,
          item.quantity,
          now,
          'pending',
          item.product_id
        );
      }

      // 3. Handle Payment Status Tracking
      if (paymentStatus === 'Paid') {
        const transactionId = randomUUID();
        await db.runAsync(
          `INSERT INTO transactions (id, user_id, amount, category, description, transaction_date, is_deleted, sync_status, retry_count, created_at, updated_at, customer_id, linked_sale_id) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          transactionId,
          userId,
          totalAmount,
          primaryCategory,
          `Sale: ${itemNames}`,
          now,
          0,
          'pending',
          0,
          now,
          now,
          customerId || null,
          saleId
        );
      } else if (paymentStatus === 'Credit') {
        const debtId = randomUUID();
        await db.runAsync(
          `INSERT INTO debts (id, user_id, customer_name, customer_phone, customer_id, amount, due_date, note, type, is_settled, created_at, updated_at, is_deleted, sync_status, retry_count, linked_sale_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          debtId,
          userId,
          customerName || 'Unknown Customer',
          customerPhone || null,
          customerId || null,
          totalAmount,
          null,
          `Credit Sale: ${itemNames}`,
          'receivable',
          0,
          now,
          now,
          0,
          'pending',
          0,
          saleId
        );
      }
    });

    console.log('[SalesLib] Sale completed successfully:', saleId);
    SyncEngine.syncAll().catch(console.error);
    return saleRecord;
  } catch (error) {
    console.error('[SalesLib] Transaction failed, rolled back:', error);
    throw error;
  }
}
