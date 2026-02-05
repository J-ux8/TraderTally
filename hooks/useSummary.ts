import { useMemo } from 'react';

interface Transaction {
  amount: number;
  transaction_date: string;
}

interface Summary {
  revenue: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

export function useSummary(transactions: Transaction[]) {
  const getDateRange = (type: 'daily' | 'weekly' | 'monthly') => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (type) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        // Get start of week (Sunday = 0, Monday = 1, etc.)
        const dayOfWeek = now.getDay();
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }
    
    // Ensure end date includes the full day (end of today)
    end.setHours(23, 59, 59, 999);

    return { start, end };
  };

  const calculateSummary = (type: 'daily' | 'weekly' | 'monthly'): Summary => {
    const { start, end } = getDateRange(type);
    
    // Get today's date in local timezone (YYYY-MM-DD format)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // For daily summary, compare date strings directly (simpler and timezone-safe)
    if (type === 'daily') {
      const filtered = transactions.filter((t) => {
        // Get transaction date string (format: YYYY-MM-DD)
        const transactionDateStr = t.transaction_date.split('T')[0];
        // Compare date strings directly - no timezone issues
        return transactionDateStr === todayStr;
      });
      
      const revenue = filtered
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expenses = filtered
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

      return {
        revenue,
        expenses,
        net: revenue - expenses,
        transactionCount: filtered.length,
      };
    }
    
    // For weekly/monthly, use date comparison
    // Normalize dates to compare only date part (ignore time)
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
    
    const filtered = transactions.filter((t) => {
      // Parse transaction_date (format: YYYY-MM-DD)
      const transactionDateStr = t.transaction_date.split('T')[0]; // Remove time if present
      const [year, month, day] = transactionDateStr.split('-').map(Number);
      const transactionDateOnly = new Date(year, month - 1, day); // month is 0-indexed
      
      // Compare dates: transaction must be >= start and < end (exclusive end = includes full end day)
      return transactionDateOnly >= startDateOnly && transactionDateOnly < endDateOnly;
    });

    const revenue = filtered
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const expenses = filtered
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    return {
      revenue,
      expenses,
      net: revenue - expenses,
      transactionCount: filtered.length,
    };
  };

  const daily = useMemo(() => calculateSummary('daily'), [transactions]);
  const weekly = useMemo(() => calculateSummary('weekly'), [transactions]);
  const monthly = useMemo(() => calculateSummary('monthly'), [transactions]);

  return { daily, weekly, monthly };
}

