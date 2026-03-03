import { deleteTransaction, getRealTimeProfit, getUserTransactions, recordExpense, recordSale, updateTransaction } from '@/lib/transactions';
import { useCallback, useEffect, useState } from 'react';

export function useTransactions() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [profit, setProfit] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const txData = await getUserTransactions(50);
      setTransactions(txData || []);

      const currentProfit = await getRealTimeProfit();
      setProfit(currentProfit);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRecordSale(amount: number, categoryName: string | null, description: string | null, date?: string) {
    const res = await recordSale(amount, categoryName, description, date);
    await refresh();
    return res;
  }

  async function handleRecordExpense(amount: number, categoryName: string | null, description: string | null, date?: string) {
    const res = await recordExpense(amount, categoryName, description, date);
    await refresh();
    return res;
  }

  async function handleUpdateTransaction(id: string, amount: number, categoryName: string | null, description: string | null, date?: string) {
    await updateTransaction(id, amount, categoryName, description, date);
    await refresh();
  }

  async function handleDeleteTransaction(id: string) {
    await deleteTransaction(id);
    await refresh();
  }

  return {
    transactions,
    profit,
    loading,
    refresh,
    recordSale: handleRecordSale,
    recordExpense: handleRecordExpense,
    updateTransaction: handleUpdateTransaction,
    deleteTransaction: handleDeleteTransaction
  };
}

