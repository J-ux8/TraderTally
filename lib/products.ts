import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";
import { getDatabase } from "./database";

export interface Product extends LocalBaseModel {
  name: string;
  display_name: string;
  price: number;
  category_id: string | null;
  usage_count: number;
  stock_quantity: number | null;
}

/**
 * Upsert a product (normalize name and ensure uniqueness per user)
 */
export async function upsertProduct(displayName: string, price: number, categoryId?: string | null): Promise<Product> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) throw new Error('User must be authenticated');

  const normalizedName = displayName.trim().toLowerCase();
  const now = new Date().toISOString();

  // Try to find existing product
  const existing = await db.getFirstAsync<Product>(
    'SELECT * FROM products WHERE user_id = ? AND name = ?',
    userId,
    normalizedName
  );

  if (existing) {
    // Update existing product price if it changed
    await LocalDB.update('products', existing.id, {
      price: price,
      display_name: displayName.trim(),
      category_id: categoryId || existing.category_id,
      sync_status: 'pending'
    } as any);
    
    return { ...existing, price, display_name: displayName.trim(), category_id: categoryId || existing.category_id };
  } else {
    // Create new product
    const record = await LocalDB.create<Product>('products', {
      name: normalizedName,
      display_name: displayName.trim(),
      price: price,
      category_id: categoryId || 'General',
      usage_count: 0,
      stock_quantity: null
    } as any);
    
    SyncEngine.syncAll().catch(console.error);
    return record;
  }
}

/**
 * Increment usage count for a product
 */
export async function incrementProductUsage(productId: string, quantity: number = 1): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE products SET usage_count = usage_count + ?, updated_at = ?, sync_status = ? WHERE id = ?',
    quantity,
    new Date().toISOString(),
    'pending',
    productId
  );
}

/**
 * Get all products (sorted by usage for "Quick Products")
 */
export async function getProducts(sortByUsage: boolean = false): Promise<Product[]> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) return [];

  const orderBy = sortByUsage ? 'usage_count DESC, updated_at DESC' : 'display_name ASC';
  return await db.getAllAsync<Product>(
    `SELECT * FROM products WHERE user_id = ? AND is_deleted = 0 ORDER BY ${orderBy}`,
    userId
  );
}

/**
 * Search products
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const db = await getDatabase();
  const userId = await LocalDB.getUserId();
  if (!userId) return [];

  const searchTerm = `%${query.toLowerCase()}%`;
  return await db.getAllAsync<Product>(
    `SELECT * FROM products WHERE user_id = ? AND is_deleted = 0 AND (name LIKE ? OR display_name LIKE ?) ORDER BY usage_count DESC`,
    userId,
    searchTerm,
    searchTerm
  );
}
