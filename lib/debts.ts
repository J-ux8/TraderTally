import { debtRepo, Debt as RepoDebt } from "./offline/repositories/DebtRepository";
import { supabase } from "./supabase";
import { SyncEngine } from "./offline/sync/SyncEngine";
import { getCachedSession } from "./session-cache";

export interface Debt extends Omit<RepoDebt, 'is_settled'> {
  is_settled: boolean;
}

// Helper function to get user ID with cache fallback for offline support
async function getUserId(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user.id;
  } catch (error) {
    // Supabase auth failed - this is normal when offline
  }
  
  const cached = await getCachedSession();
  if (cached) {
    return cached.userId;
  }
  
  // No session available - user needs to login
  // This is not an error during app initialization
  throw new Error("User not authenticated and no cached session");
}

// Get all debts for the current user from local SQLite
export async function getUserDebts(): Promise<Debt[]> {
  try {
    const userId = await getUserId();

    const results = await debtRepo.findAll(userId);

    // Map SQLite boolean (0/1) to true/false for UI
    return results.map(d => ({
      ...d,
      is_settled: d.is_settled === 1
    })) as Debt[];
  } catch (error) {
    // Silent fail - return empty array
    // This is normal during app initialization before login
    return [];
  }
}

// Create a new debt locally
export async function createDebt(
  customerName: string,
  amount: number,
  dueDate: string | null,
  note: string | null
) {
  const userId = await getUserId();

  const debt = await debtRepo.create(userId, {
    customer_name: customerName,
    amount,
    due_date: dueDate,
    note
  });

  // Trigger background sync (non-blocking, don't wait for it)
  SyncEngine.executeFullSync(userId).catch(syncError => {
    console.log('[Offline] Debt recorded locally, sync will retry later');
  });

  return { ...debt, is_settled: debt.is_settled === 1 };
}

// Update a debt locally
export async function updateDebt(
  id: string,
  data: {
    customer_name: string;
    amount: number;
    due_date: string | null;
    note: string | null;
  }
) {
  const userId = await getUserId();

  await debtRepo.update(userId, id, data);

  // Trigger background sync (non-blocking, don't wait for it)
  SyncEngine.executeFullSync(userId).catch(syncError => {
    console.log('[Offline] Debt updated locally, sync will retry later');
  });
}

// Settle a debt locally
export async function settleDebt(id: string) {
  const userId = await getUserId();

  await debtRepo.settle(userId, id);

  // Trigger background sync (non-blocking, don't wait for it)
  SyncEngine.executeFullSync(userId).catch(syncError => {
    console.log('[Offline] Debt settled locally, sync will retry later');
  });
}

// Delete a debt locally (soft delete)
export async function deleteDebt(id: string) {
  const userId = await getUserId();

  await debtRepo.softDelete(id, userId);

  // Trigger background sync (non-blocking, don't wait for it)
  SyncEngine.executeFullSync(userId).catch(syncError => {
    console.log('[Offline] Debt deleted locally, sync will retry later');
  });
}

