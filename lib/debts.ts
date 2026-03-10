import { supabase } from "./supabase";

export interface Debt {
  id: string;
  user_id: string;
  customer_name: string;
  amount: number;
  due_date: string | null;
  note: string | null;
  is_settled: number;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

export async function getUserDebts(): Promise<Debt[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_deleted', 0);
  
  if (error) throw error;
  return data || [];
}

export async function addDebt(
  customer_name: string,
  amount: number,
  due_date?: string,
  note?: string
): Promise<Debt> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('debts')
    .insert({
      user_id: user.id,
      customer_name,
      amount,
      due_date: due_date || null,
      note: note || null
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateDebt(
  id: string,
  customer_name: string,
  amount: number,
  due_date?: string,
  note?: string
): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .update({
      customer_name,
      amount,
      due_date: due_date || null,
      note: note || null
    })
    .eq('id', id);
  
  if (error) throw error;
}

export async function settleDebt(id: string): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .update({ is_settled: 1 })
    .eq('id', id);
  
  if (error) throw error;
}

export async function deleteDebt(id: string): Promise<void> {
  const { error } = await supabase
    .from('debts')
    .update({ is_deleted: 1 })
    .eq('id', id);
  
  if (error) throw error;
}
