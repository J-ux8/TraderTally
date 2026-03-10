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
  
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      amount: Math.abs(amount),
      category,
      description,
      transaction_date: date || new Date().toISOString().split('T')[0]
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
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
      transaction_date: date || new Date().toISOString().split('T')[0]
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getUserTransactions(): Promise<Transaction[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_deleted', 0)
    .order('transaction_date', { ascending: false });
  
  if (error) throw error;
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
      transaction_date: date || new Date().toISOString().split('T')[0]
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
