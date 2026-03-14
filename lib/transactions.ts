import { getLocalISOString } from "./dateUtils";
import { supabase } from "./supabase";

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

export async function recordSale(
  amount: number,
  category: string | null,
  description: string | null,
  date?: string
): Promise<Transaction> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  // Retry logic for network issues
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          amount: Math.abs(amount),
          category,
          description,
          transaction_date: date || new Date().toISOString(),
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        lastError = error;
        
        // If it's a network error, retry
        if (error.message?.includes('network') || error.message?.includes('fetch')) {
          console.log(`[recordSale] Network error on attempt ${attempt}, retrying...`);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Wait 1s, 2s, 3s
            continue;
          }
        }
        
        // For other errors, throw immediately
        throw error;
      }
      
      return data;
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a network-related error
      if (error.message?.includes('network') || error.message?.includes('fetch') || error.name === 'TypeError') {
        console.log(`[recordSale] Network error on attempt ${attempt}:`, error.message);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Wait 1s, 2s, 3s
          continue;
        }
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  // If all retries failed, throw the last error with a user-friendly message
  throw new Error(`Failed to record sale after 3 attempts. Please check your internet connection and try again. (${lastError?.message || 'Unknown error'})`);
}

export async function recordExpense(
  amount: number,
  category: string | null,
  description: string | null,
  date?: string
): Promise<Transaction> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      amount: -Math.abs(amount),
      category,
      description,
      transaction_date: date || new Date().toISOString(),
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUserTransactions(limit?: number, offset?: number): Promise<Transaction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  let query = supabase
    .from('transactions')
    .select('id,user_id,amount,category,description,transaction_date,created_at,updated_at,is_deleted', { count: 'exact' })
    .eq('user_id', user.id)
    .eq('is_deleted', 0)
    .order('transaction_date', { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  if (offset) {
    query = query.range(offset, offset + (limit || 50) - 1);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('[getUserTransactions] Error:', error);
    throw error;
  }
  return data || [];
}

export async function updateTransaction(
  id: string,
  amount: number,
  category: string | null,
  description: string | null,
  date?: string
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({
      amount,
      category,
      description,
      transaction_date: date || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id);
  
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ is_deleted: 1 })
    .eq('id', id);
  
  if (error) throw error;
}

export async function getRealTimeProfit(): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', user.id)
    .eq('is_deleted', 0);
  
  if (error) throw error;
  
  return (data || []).reduce((sum, tx) => sum + (tx.amount || 0), 0);
}

// Batch operations for performance
export async function batchUpdateTransactions(
  updates: Array<{ id: string; amount: number; category: string | null; description: string | null; transaction_date: string }>
): Promise<void> {
  if (updates.length === 0) return;
  
  // Supabase doesn't support true batch updates, so we use Promise.all for parallel execution
  await Promise.all(
    updates.map(update =>
      supabase
        .from('transactions')
        .update({
          amount: update.amount,
          category: update.category,
          description: update.description,
          transaction_date: update.transaction_date || new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id)
    )
  );
}

export async function batchDeleteTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  
  // Batch soft delete
  await Promise.all(
    ids.map(id =>
      supabase
        .from('transactions')
        .update({ is_deleted: 1 })
        .eq('id', id)
    )
  );
}

export async function batchInsertTransactions(
  transactions: Array<{ amount: number; category: string | null; description: string | null; transaction_date: string }>
): Promise<Transaction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  if (transactions.length === 0) return [];
  
  const { data, error } = await supabase
    .from('transactions')
    .insert(
      transactions.map(tx => ({
        user_id: user.id,
        amount: tx.amount,
        category: tx.category,
        description: tx.description,
        transaction_date: tx.transaction_date || new Date().toISOString(),
        created_at: new Date().toISOString()
      }))
    )
    .select();
  
  if (error) throw error;
  return data || [];
}
