import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { createDebt, deleteDebt, getUserDebts, settleDebt, updateDebt } from '@/lib/debts';
import { useCallback, useEffect, useState } from 'react';

export function useDebts() {
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const { recordSale } = useTransactionsContext();

  const refresh = useCallback(async (force = false) => {
    try {
      // Check if data is fresh (less than 3 minutes old)
      const now = Date.now();
      const threeMinutes = 3 * 60 * 1000;
      if (!force && now - lastLoadTime < threeMinutes && debts.length > 0) {
        console.log('[useDebts] Data is fresh, skipping refresh');
        return;
      }

      setLoading(true);
      setError(null);

      const data = await getUserDebts();
      setDebts(data || []);
      setLastLoadTime(Date.now());
    } catch (error: any) {
      // Only set error if we already have loaded before (not initial load)
      if (lastLoadTime > 0) {
        setError(error.message || 'Failed to load debts');
      }
      // Keep existing debts on error instead of clearing
    } finally {
      setLoading(false);
    }
  }, [lastLoadTime, debts.length]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateDebt = useCallback(async (
    customerName: string,
    amount: number,
    dueDate: string | null,
    note: string | null
  ) => {
    const newDebt = await createDebt(customerName, amount, dueDate, note);
    setDebts(prev => [newDebt, ...prev]);
    return newDebt;
  }, []);

  const handleUpdateDebt = useCallback(async (
    id: string,
    data: {
      customer_name: string;
      amount: number;
      due_date: string | null;
      note: string | null;
    }
  ) => {
    await updateDebt(id, data);
    setDebts(prev => prev.map(d =>
      d.id === id
        ? { ...d, ...data, updated_at: new Date().toISOString() }
        : d
    ));
  }, []);

  const handleSettleDebt = useCallback(async (id: string) => {
    const debtToSettle = debts.find(d => d.id === id);
    if (!debtToSettle) return;

    await settleDebt(id);

    // Recording the sale as a transaction ONLY when settled (paid)
    try {
      await recordSale(
        debtToSettle.amount,
        'Debt Payment',
        `Settled: ${debtToSettle.customer_name}${debtToSettle.note ? ' (' + debtToSettle.note + ')' : ''}`,
        new Date().toISOString().split('T')[0]
      );
    } catch (txError) {
      console.error('Error recording transaction for settled debt:', txError);
    }

    setDebts(prev => prev.map(d =>
      d.id === id
        ? { ...d, is_settled: true, updated_at: new Date().toISOString() }
        : d
    ));
  }, [debts, recordSale]);

  const handleDeleteDebt = useCallback(async (id: string) => {
    await deleteDebt(id);
    setDebts(prev => prev.filter(d => d.id !== id));
  }, []);

  return {
    debts,
    loading,
    error,
    refresh,
    createDebt: handleCreateDebt,
    updateDebt: handleUpdateDebt,
    settleDebt: handleSettleDebt,
    deleteDebt: handleDeleteDebt,
  };
}
