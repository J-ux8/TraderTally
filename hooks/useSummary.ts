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
  topExpenseCategory?: string;
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
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);

    let revenue = 0;
    let expenses = 0;
    let transactionCount = 0;
    const catTotals: Record<string, number> = {};

    transactions.forEach((t) => {
      let match = false;
      const transactionDate = new Date(t.transaction_date);

      if (type === 'daily') {
        const tDate = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
        match = tDate.getTime() === startDateOnly.getTime();
      } else {
        const tDate = new Date(transactionDate.getFullYear(), transactionDate.getMonth(), transactionDate.getDate());
        match = tDate >= startDateOnly && tDate < endDateOnly;
      }

      if (match) {
        const amt = Number(t.amount);
        if (amt > 0) revenue += amt;
        else {
          expenses += Math.abs(amt);
          const cat = (t as any).category;
          if (cat) catTotals[cat] = (catTotals[cat] || 0) + Math.abs(amt);
        }
        transactionCount++;
      }
    });

    const categories = Object.entries(catTotals);
    const topExpenseCategory = categories.length > 0
      ? categories.sort((a, b) => b[1] - a[1])[0][0]
      : undefined;

    return {
      revenue,
      expenses,
      net: revenue - expenses,
      transactionCount,
      topExpenseCategory,
    };
  };

  const daily = useMemo(() => calculateSummary('daily'), [transactions]);
  const weekly = useMemo(() => calculateSummary('weekly'), [transactions]);
  const monthly = useMemo(() => calculateSummary('monthly'), [transactions]);

  return { daily, weekly, monthly };
}

