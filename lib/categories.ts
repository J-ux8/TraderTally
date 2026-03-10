import { supabase } from "./supabase";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

export async function getUserCategories(): Promise<Category[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_deleted', 0)
    .order('name');
  
  if (error) throw error;
  return data || [];
}

export async function addCategory(name: string): Promise<Category> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: user.id,
      name: name.trim(),
      normalized_name: name.trim().toLowerCase()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ is_deleted: 1 })
    .eq('id', id);
  
  if (error) throw error;
}
