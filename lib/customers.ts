import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";

export interface Customer extends LocalBaseModel {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

/**
 * Get all customers
 */
export async function getCustomers(): Promise<Customer[]> {
  return await LocalDB.getAll<Customer>('customers');
}

/**
 * Find customer by phone
 */
export async function findCustomerByPhone(phone: string): Promise<Customer | null> {
  const customers = await getCustomers();
  return customers.find(c => c.phone === phone) || null;
}

/**
 * Create or get customer from name and phone
 */
export async function getOrCreateCustomer(name: string, phone?: string): Promise<Customer> {
  if (phone) {
    const existing = await findCustomerByPhone(phone);
    if (existing) return existing;
  }

  const newCustomer = await LocalDB.create<Customer>('customers', {
    name,
    phone: phone || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  } as any);

  SyncEngine.syncAll().catch(console.error);
  return newCustomer;
}

/**
 * Update customer
 */
export async function updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
  await LocalDB.update('customers', id, updates);
  SyncEngine.syncAll().catch(console.error);
}

/**
 * Delete customer (Soft delete)
 */
export async function deleteCustomer(id: string): Promise<void> {
  await LocalDB.delete('customers', id);
  SyncEngine.syncAll().catch(console.error);
}
