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
    console.log('[Offline Mode] Supabase auth failed, using cached session');
  }
  
  const cached = await getCachedSession();
  if (!cached) throw new Error("User not authenticated and no cached session");
  return cached.userId;
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
    console.error("Error in getUserDebts:", error);
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

  // Trigger background sync
  SyncEngine.executeFullSync(userId).catch(console.error);

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

  SyncEngine.executeFullSync(userId).catch(console.error);
}

// Settle a debt locally
export async function settleDebt(id: string) {
  const userId = await getUserId();

  await debtRepo.settle(userId, id);

  SyncEngine.executeFullSync(userId).catch(console.error);
}

// Delete a debt locally (soft delete)
export async function deleteDebt(id: string) {
  const userId = await getUserId();

  await debtRepo.softDelete(id, userId);

  SyncEngine.executeFullSync(userId).catch(console.error);
}

