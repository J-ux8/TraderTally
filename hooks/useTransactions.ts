import { deleteTransaction, getRealTimeProfit, getUserTransactions, recordExpense, recordSale, updateTransaction } from '@/lib/transactions';
import { useCallback, useEffect, useMemo, useState } from 'react';

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

  // Memoize transaction stats
  const transactionStats = useMemo(() => {
    const sales = transactions.filter(tx => tx.amount > 0);
    const expenses = transactions.filter(tx => tx.amount < 0);
    
    return {
      totalSales: sales.reduce((sum, tx) => sum + tx.amount, 0),
      totalExpenses: expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
      transactionCount: transactions.length,
      salesCount: sales.length,
      expensesCount: expenses.length,
    };
  }, [transactions]);

  const handleRecordSale = useCallback(async (amount: number, categoryName: string | null, description: string | null, date?: string) => {
    const res = await recordSale(amount, categoryName, description, date);
    // Optimistic update
    setTransactions(prev => [res, ...prev]);
    setProfit(prev => prev + amount);
    return res;
  }, []);

  const handleRecordExpense = useCallback(async (amount: number, categoryName: string | null, description: string | null, date?: string) => {
    const res = await recordExpense(amount, categoryName, description, date);
    // Optimistic update
    setTransactions(prev => [res, ...prev]);
    setProfit(prev => prev - amount);
    return res;
  }, []);

  const handleUpdateTransaction = useCallback(async (id: string, amount: number, categoryName: string | null, description: string | null, date?: string) => {
    const oldTx = transactions.find(tx => tx.id === id);
    
    // Optimistic update
    setTransactions(prev => prev.map(tx =>
      tx.id === id
        ? { ...tx, amount, category: categoryName, description, transaction_date: date || tx.transaction_date }
        : tx
    ));
    
    if (oldTx) {
      const diff = amount - oldTx.amount;
      setProfit(prev => prev + diff);
    }
    
    try {
      await updateTransaction(id, amount, categoryName, description, date);
    } catch (error) {
      console.error('Error updating transaction:', error);
      // Reload on error
      await refresh();
    }
  }, [transactions, refresh]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    const txToDelete = transactions.find(tx => tx.id === id);
    
    // Optimistic update
    setTransactions(prev => prev.filter(tx => tx.id !== id));
    if (txToDelete) {
      setProfit(prev => prev - txToDelete.amount);
    }
    
    try {
      await deleteTransaction(id);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      // Reload on error
      await refresh();
    }
  }, [transactions, refresh]);

  return {
    transactions,
    profit,
    loading,
    transactionStats,
    refresh,
    recordSale: handleRecordSale,
    recordExpense: handleRecordExpense,
    updateTransaction: handleUpdateTransaction,
    deleteTransaction: handleDeleteTransaction
  };
}

