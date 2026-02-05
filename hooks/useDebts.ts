import { deleteLocalDebt, ensureLocalDb, getLocalDebts, insertLocalDebt, settleLocalDebt, updateLocalDebt, upsertLocalFromServerDebts } from '@/lib/localDebts';
import { supabase } from '@/lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useState } from 'react';

export function useDebts() {
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await ensureLocalDb();

      const local = await getLocalDebts();
      setDebts(local);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const net = await NetInfo.fetch();
      if (net.isConnected) {
        const { data, error } = await supabase
          .from('debts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          await upsertLocalFromServerDebts(data);
          const merged = await getLocalDebts();
          setDebts(merged);
        }
      }
    } catch (error) {
      console.error('Error loading debts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateDebt = useCallback(async (
    customerName: string,
    amount: number,
    dueDate: string | null,
    note: string | null
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const newDebt = await insertLocalDebt({ customer_name: customerName, amount, due_date: dueDate, note, user_id: user.id });
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    await updateLocalDebt(id, { ...data, user_id: user.id });
    setDebts(prev => prev.map(d => 
      d.id === id 
        ? { ...d, ...data, updated_at: new Date().toISOString(), sync_status: 'pending' }
        : d
    ));
  }, []);

  const handleSettleDebt = useCallback(async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    await settleLocalDebt(id, user.id);
    setDebts(prev => prev.map(d => 
      d.id === id 
        ? { ...d, is_settled: true, updated_at: new Date().toISOString(), sync_status: 'pending' }
        : d
    ));
  }, []);

  const handleDeleteDebt = useCallback(async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    await deleteLocalDebt(id, user.id);
    setDebts(prev => prev.filter(d => d.id !== id));
  }, []);

  return {
    debts,
    loading,
    refresh,
    createDebt: handleCreateDebt,
    updateDebt: handleUpdateDebt,
    settleDebt: handleSettleDebt,
    deleteDebt: handleDeleteDebt,
  };
}

