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

export async function getUserDebts(limit?: number, offset?: number): Promise<Debt[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  let query = supabase
    .from('debts')
    .select('id,user_id,customer_name,amount,due_date,note,is_settled,created_at,updated_at,is_deleted')
    .eq('user_id', user.id)
    .eq('is_deleted', 0)
    .order('created_at', { ascending: false });
  
  if (limit) {
    query = query.limit(limit);
  }
  if (offset) {
    query = query.range(offset, offset + (limit || 50) - 1);
  }
  
  const { data, error } = await query;
  
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

// Batch operations for performance
export async function batchSettleDebts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  
  await Promise.all(
    ids.map(id =>
      supabase
        .from('debts')
        .update({ is_settled: 1 })
        .eq('id', id)
    )
  );
}

export async function batchDeleteDebts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  
  await Promise.all(
    ids.map(id =>
      supabase
        .from('debts')
        .update({ is_deleted: 1 })
        .eq('id', id)
    )
  );
}

export async function batchUpdateDebts(
  updates: Array<{ id: string; customer_name: string; amount: number; due_date?: string; note?: string }>
): Promise<void> {
  if (updates.length === 0) return;
  
  await Promise.all(
    updates.map(update =>
      supabase
        .from('debts')
        .update({
          customer_name: update.customer_name,
          amount: update.amount,
          due_date: update.due_date || null,
          note: update.note || null
        })
        .eq('id', update.id)
    )
  );
}

export async function batchInsertDebts(
  debts: Array<{ customer_name: string; amount: number; due_date?: string; note?: string }>
): Promise<Debt[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  if (debts.length === 0) return [];
  
  const { data, error } = await supabase
    .from('debts')
    .insert(
      debts.map(debt => ({
        user_id: user.id,
        customer_name: debt.customer_name,
        amount: debt.amount,
        due_date: debt.due_date || null,
        note: debt.note || null
      }))
    )
    .select();
  
  if (error) throw error;
  return data || [];
}
