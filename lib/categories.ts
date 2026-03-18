import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";

export interface Category extends LocalBaseModel {
  name: string;
  normalized_name: string;
}

/**
 * Get user categories
 */
export async function getUserCategories(): Promise<Category[]> {
  return await LocalDB.getAll<Category>('categories');
}

/**
 * Add a new category
 */
export async function addCategory(name: string): Promise<Category> {
  const record = await LocalDB.create<Category>('categories', {
    name: name.trim(),
    normalized_name: name.trim().toLowerCase()
  } as any);

  SyncEngine.syncAll().catch(console.error);
  return record;
}

/**
 * Delete category (Soft delete)
 */
export async function deleteCategory(id: string): Promise<void> {
  await LocalDB.delete('categories', id);
  SyncEngine.syncAll().catch(console.error);
}

/**
 * Seed Default Categories
 */
export async function seedDefaultCategories(): Promise<void> {
  const current = await getUserCategories();
  if (current.length > 0) return;

  const defaults = [
    'Sale',
    'Stock / Inventory',
    'Rent / Stall Fee',
    'Salaries / Helpers',
    'Transport / Fuel',
    'Utilities',
    'Maintenance / Repairs',
    'Business Supplies',
    'Market Levy / Tax',
    'Other'
  ];

  for (const name of defaults) {
    await addCategory(name);
  }
}
