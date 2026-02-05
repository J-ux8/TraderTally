import { supabase } from "./supabase";

export interface Debt {
  id: string;
  customer_name: string;
  amount: number;
  due_date: string | null;
  note: string | null;
  is_settled: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
}

// Get all debts for the current user
export async function getUserDebts() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

// Create a new debt
export async function createDebt(
  customerName: string,
  amount: number,
  dueDate: string | null,
  note: string | null
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("debts")
    .insert({
      customer_name: customerName.trim(),
      amount: Math.abs(amount),
      due_date: dueDate || null,
      note: note?.trim() || null,
      is_settled: false,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Update a debt
export async function updateDebt(
  id: string,
  data: {
    customer_name: string;
    amount: number;
    due_date: string | null;
    note: string | null;
  }
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("debts")
    .update({
      customer_name: data.customer_name.trim(),
      amount: Math.abs(data.amount),
      due_date: data.due_date || null,
      note: data.note?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

// Settle a debt
export async function settleDebt(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("debts")
    .update({
      is_settled: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

// Delete a debt
export async function deleteDebt(id: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("debts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

