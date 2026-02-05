import { supabase } from "./supabase";

// Get user's categories
export async function getUserCategories(userId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

// Create a new category
export async function createCategory(name: string, userId: string) {
  const { data, error } = await supabase
    .from("categories")
    .insert({ 
      name: name.trim(),
      user_id: userId
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Helper function to get local date string (YYYY-MM-DD) - avoids timezone issues
function getLocalDateString(date?: Date | string): string {
  if (typeof date === 'string') {
    // If already a string, return as-is (assuming YYYY-MM-DD format)
    return date.split('T')[0];
  }
  
  const d = date || new Date();
  // Use local timezone, not UTC
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Record a sale (transaction)
export async function recordSale(
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Use local date string to avoid timezone issues
  const dateStr = date || getLocalDateString();

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      amount,
      category: categoryName || null,  // Store category name as text
      description: description || null,
      transaction_date: dateStr,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Record an expense (transaction with negative amount)
export async function recordExpense(
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Use local date string to avoid timezone issues
  const dateStr = date || getLocalDateString();

  // Store expense as negative amount
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      amount: -Math.abs(amount), // Ensure negative amount
      category: categoryName || null,
      description: description || null,
      transaction_date: dateStr,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Get user's transactions
export async function getUserTransactions(limit?: number) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      // Return empty array instead of throwing - prevents app crashes
      return [];
    }

    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      // Log error but return empty array to prevent crashes
      console.error("Error fetching transactions:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    // Return empty array instead of throwing
    console.error("Error in getUserTransactions:", error);
    return [];
  }
}

// Update a transaction
export async function updateTransaction(
  transactionId: string,
  amount: number,
  categoryName: string | null,
  description: string | null,
  date?: string
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("transactions")
    .update({
      amount,
      category: categoryName || null,
      description: description || null,
      transaction_date: date || getLocalDateString(),
    })
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Delete a transaction
export async function deleteTransaction(transactionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }
}

// Get total revenue (sum of all transactions)
export async function getTotalRevenue() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id);

  if (error) {
    throw error;
  }

  const total = data?.reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;
  return total;
}

