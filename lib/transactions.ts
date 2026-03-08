import { transactionRepo, Transaction } from "./offline/repositories/TransactionRepository";
import { supabase } from "./supabase";
import { SyncEngine } from "./offline/sync/SyncEngine";
import { getCachedSession } from "./session-cache";

export { Transaction };

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

// Helper function to get local date string (YYYY-MM-DD)
function getLocalDateString(date?: Date | string): string {
  if (typeof date === 'string') {
    return date.split('T')[0];
  }
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Record a sale locally
export async function recordSale(
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const userId = await getUserId();

  const amountVal = Math.abs(amount);
  const dateStr = date || getLocalDateString();

  const id = await transactionRepo.record(userId, {
    amount: amountVal,
    category: categoryName,
    description,
    transaction_date: dateStr
  });

  // Trigger background sync (non-blocking, don't wait for it)
  SyncEngine.executeFullSync(userId).catch(syncError => {
    console.log('[Offline] Sale recorded locally, sync will retry later');
  });

  return { id, amount: amountVal, category: categoryName, description, transaction_date: dateStr };
}

// Record an expense locally
export async function recordExpense(
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const userId = await getUserId();

  const amountVal = -Math.abs(amount);
  const dateStr = date || getLocalDateString();

  const id = await transactionRepo.record(userId, {
    amount: amountVal,
    category: categoryName,
    description,
    transaction_date: dateStr
  });

  // Trigger background sync (non-blocking, don't wait for it)
  SyncEngine.executeFullSync(userId).catch(syncError => {
    console.log('[Offline] Expense recorded locally, sync will retry later');
  });

  return { id, amount: amountVal, category: categoryName, description, transaction_date: dateStr };
}

// Get user's transactions from local SQLite
export async function getUserTransactions(limit?: number) {
  try {
    const userId = await getUserId();
    return await transactionRepo.findAll(userId, limit);
  } catch (error) {
    // Silent fail - return empty array
    // This is normal during app initialization before login
    return [];
  }
}

// Update a transaction locally
export async function updateTransaction(
  transactionId: string,
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const userId = await getUserId();

  const dateStr = date || getLocalDateString();

  await transactionRepo.update(userId, transactionId, {
    amount,
    category: categoryName,
    description,
    transaction_date: dateStr
  });

  // Trigger background sync (non-blocking, don't wait for it)
  SyncEngine.executeFullSync(userId).catch(syncError => {
    console.log('[Offline] Transaction updated locally, sync will retry later');
  });
}

// Delete a transaction (soft delete)
export async function deleteTransaction(transactionId: string) {
  const userId = await getUserId();

  await transactionRepo.softDelete(transactionId, userId);

  // Trigger background sync (non-blocking, don't wait for it)
  SyncEngine.executeFullSync(userId).catch(syncError => {
    console.log('[Offline] Transaction deleted locally, sync will retry later');
  });
}

// Get real-time profit
export async function getRealTimeProfit() {
  try {
    const userId = await getUserId();
    return await transactionRepo.getProfit(userId);
  } catch (error) {
    console.error("Error in getRealTimeProfit:", error);
    return 0;
  }
}
