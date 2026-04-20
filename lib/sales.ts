import { getDatabase } from "./database";
import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";
import { randomUUID } from 'expo-crypto';
import { CartItem } from "../contexts/CartContext";
import { incrementProductUsage } from "./products";

export interface Sale extends LocalBaseModel {
  total_amount: number;
}

export interface SaleItem extends LocalBaseModel {
  sale_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/**
 * Complete a multi-item sale atomically
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
    // Perform everything in a single atomic transaction
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

      // 2. Insert Sale Items and update usage counts
      const itemNames = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
      // Get the primary category from the first item to better categorize the transaction
      let primaryCategory = 'Sale';
      
      for (const item of items) {
        // Find category if possible
        const product = await db.getFirstAsync<{category_id: string}>('SELECT category_id FROM products WHERE id = ?', item.product_id);
        if (product && product.category_id && primaryCategory === 'Sale') {
          primaryCategory = product.category_id;
        }

        const itemId = randomUUID();
        const itemTotal = item.price * item.quantity;

        // Insert Item
        await db.runAsync(
          `INSERT INTO sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total_price, is_deleted, sync_status, retry_count, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          itemId,
          saleId,
          item.product_id,
          item.name,
          item.quantity,
          item.price,
          itemTotal,
          0,
          'pending',
          0,
          now,
          now
        );

        // 3. Increment Usage Count
        await db.runAsync(
          'UPDATE products SET usage_count = usage_count + ?, updated_at = ?, sync_status = ? WHERE id = ?',
          item.quantity,
          now,
          'pending',
          item.product_id
        );
      }

      // 4. Handle Payment Status Tracking
      if (paymentStatus === 'Paid') {
        // If PAID, create a transaction to show cash inflow immediately
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
        // If ON CREDIT, we do NOT create a transaction yet. We create a Receivable Debt instead.
        const debtId = randomUUID();
        await db.runAsync(
          `INSERT INTO debts (id, user_id, customer_name, customer_phone, customer_id, amount, due_date, note, type, is_settled, created_at, updated_at, is_deleted, sync_status, retry_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          0
        );
      }
    });

    console.log('[SalesLib] Sale completed successfully:', saleId);
    
    // Trigger background sync (non-blocking)
    SyncEngine.syncAll().catch(console.error);
    
    return saleRecord;
  } catch (error) {
    console.error('[SalesLib] Transaction failed, rolled back:', error);
    throw error;
  }
}
