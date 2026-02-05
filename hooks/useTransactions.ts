import { deleteLocalTransaction, ensureLocalDb, getLocalTransactions, insertLocalTransaction, updateLocalTransaction, upsertLocalFromServerTransactions } from '@/lib/localTransactions';
import { supabase } from '@/lib/supabase';
import { getUserCategories } from '@/lib/transactions';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  sync_status?: string;
}

interface Category {
  id: string;
  name: string;
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await ensureLocalDb();

      // Load local first
      const local = await getLocalTransactions(50);
      setTransactions(local);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const net = await NetInfo.fetch();
      if (net.isConnected) {
        // fetch server and merge
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false })
          .limit(50);

        if (!error && data) {
          await upsertLocalFromServerTransactions(data);
          const merged = await getLocalTransactions(50);
          setTransactions(merged);
        }

        const categoriesData = await getUserCategories(user.id);
        setCategories(categoriesData);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function recordSale(amount: number, categoryName: string | null, description: string | null, date?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return await insertLocalTransaction({ amount, category: categoryName, description, transaction_date: date, user_id: user.id });
  }

  async function recordExpense(amount: number, categoryName: string | null, description: string | null, date?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return await insertLocalTransaction({ amount: -Math.abs(amount), category: categoryName, description, transaction_date: date, user_id: user.id });
  }

  async function updateTransaction(id: string, amount: number, categoryName: string | null, description: string | null, date?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    await updateLocalTransaction(id, { amount, category: categoryName, description, transaction_date: date, user_id: user.id });
  }

  async function deleteTransactionById(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    await deleteLocalTransaction(id, user.id);
  }

  return { transactions, categories, loading, refresh, recordSale, recordExpense, updateTransaction, deleteTransaction: deleteTransactionById };
}

