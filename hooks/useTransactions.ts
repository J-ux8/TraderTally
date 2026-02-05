import { supabase } from '@/lib/supabase';
import { getUserCategories, getUserTransactions } from '@/lib/transactions';
import { useCallback, useEffect, useState } from 'react';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
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

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const txData = await getUserTransactions(50);
      setTransactions(txData || []);

      const categoriesData = await getUserCategories(user.id).catch(err => {
        console.error('Error loading categories:', err);
        return [];
      });
      setCategories(categoriesData || []);
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
    return await serverRecordSale(amount, categoryName, description, date);
  }

  async function recordExpense(amount: number, categoryName: string | null, description: string | null, date?: string) {
    return await serverRecordExpense(amount, categoryName, description, date);
  }

  async function updateTransaction(id: string, amount: number, categoryName: string | null, description: string | null, date?: string) {
    await serverUpdateTransaction(id, amount, categoryName, description, date);
  }

  async function deleteTransactionById(id: string) {
    await serverDeleteTransaction(id);
  }

  return { transactions, categories, loading, refresh, recordSale, recordExpense, updateTransaction, deleteTransaction: deleteTransactionById };
}

