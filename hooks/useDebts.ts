import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { addDebt, deleteDebt, getUserDebts, settleDebt, updateDebt, batchSettleDebts, batchDeleteDebts, batchUpdateDebts } from '@/lib/debts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEBTS_PAGE_SIZE = 50;

export function useDebts() {
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const isLoadingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const { recordSale } = useTransactionsContext();

  // Memoize debt calculations
  const debtStats = useMemo(() => {
    const unsettled = debts.filter(d => !d.is_settled);
    const settled = debts.filter(d => d.is_settled);
    const totalAmount = unsettled.reduce((sum, d) => sum + (d.amount || 0), 0);
    
    return {
      unsettled,
      settled,
      totalAmount,
      count: unsettled.length,
    };
  }, [debts]);

  const refresh = useCallback(async (force = true) => {
    // Prevent concurrent loads unless forced
    if (isLoadingRef.current && !force) return;
    isLoadingRef.current = true;
    
    try {
      setLoading(true);
      setError(null);
      setCurrentPage(0);

      const data = await getUserDebts(DEBTS_PAGE_SIZE, 0);
      setDebts(data || []);
      setHasMore((data?.length || 0) >= DEBTS_PAGE_SIZE);
      setLastLoadTime(Date.now());
    } catch (error: any) {
      console.error('[useDebts] Error loading debts:', error);
      // Only set error if we already have loaded before (not initial load)
      if (lastLoadTime > 0) {
        setError(error.message || 'Failed to load debts');
      }
      // Keep existing debts on error instead of clearing
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMore) return;
    isLoadingRef.current = true;
    
    try {
      const nextPage = currentPage + 1;
      const offset = nextPage * DEBTS_PAGE_SIZE;
      const data = await getUserDebts(DEBTS_PAGE_SIZE, offset);
      
      setDebts(prev => [...prev, ...(data || [])]);
      setCurrentPage(nextPage);
      setHasMore((data?.length || 0) >= DEBTS_PAGE_SIZE);
    } catch (error: any) {
      console.error('[useDebts] Error loading more debts:', error);
    } finally {
      isLoadingRef.current = false;
    }
  }, [currentPage, hasMore]);

  useEffect(() => {
    // Only initialize once
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    refresh();
  }, []);

  const handleCreateDebt = useCallback(async (
    customerName: string,
    amount: number,
    dueDate: string | null,
    note: string | null
  ) => {
    const newDebt = await addDebt(customerName, amount, dueDate || undefined, note || undefined);
    // Optimistic UI update - add to beginning
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
    // Optimistic UI update
    setDebts(prev => prev.map(d =>
      d.id === id
        ? { ...d, ...data, updated_at: new Date().toISOString() }
        : d
    ));
    
    try {
      await updateDebt(id, data.customer_name, data.amount, data.due_date || undefined, data.note || undefined);
    } catch (error) {
      console.error('Error updating debt:', error);
      // Reload on error to sync state
      await refresh(true);
    }
  }, [refresh]);

  const handleSettleDebt = useCallback(async (id: string) => {
    const debtToSettle = debts.find(d => d.id === id);
    if (!debtToSettle) return;

    // Optimistic UI update
    setDebts(prev => prev.map(d =>
      d.id === id
        ? { ...d, is_settled: 1, updated_at: new Date().toISOString() }
        : d
    ));

    try {
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
    } catch (error) {
      console.error('Error settling debt:', error);
      // Reload on error to sync state
      await refresh(true);
    }
  }, [debts, recordSale, refresh]);

  const handleDeleteDebt = useCallback(async (id: string) => {
    // Optimistic UI update
    setDebts(prev => prev.filter(d => d.id !== id));
    
    try {
      await deleteDebt(id);
    } catch (error) {
      console.error('Error deleting debt:', error);
      // Reload on error to sync state
      await refresh(true);
    }
  }, [refresh]);

  // Batch operations
  const handleBatchSettleDebts = useCallback(async (ids: string[]) => {
    // Optimistic UI update
    setDebts(prev => prev.map(d =>
      ids.includes(d.id)
        ? { ...d, is_settled: 1, updated_at: new Date().toISOString() }
        : d
    ));
    
    try {
      await batchSettleDebts(ids);
    } catch (error) {
      console.error('Error batch settling debts:', error);
      await refresh(true);
    }
  }, [refresh]);

  const handleBatchDeleteDebts = useCallback(async (ids: string[]) => {
    // Optimistic UI update
    setDebts(prev => prev.filter(d => !ids.includes(d.id)));
    
    try {
      await batchDeleteDebts(ids);
    } catch (error) {
      console.error('Error batch deleting debts:', error);
      await refresh(true);
    }
  }, [refresh]);

  return {
    debts,
    loading,
    error,
    hasMore,
    debtStats,
    refresh,
    loadMore,
    createDebt: handleCreateDebt,
    updateDebt: handleUpdateDebt,
    settleDebt: handleSettleDebt,
    deleteDebt: handleDeleteDebt,
    batchSettleDebts: handleBatchSettleDebts,
    batchDeleteDebts: handleBatchDeleteDebts,
  };
}
