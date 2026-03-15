import { useMemo } from 'react';
import { startOfDay, startOfWeek, startOfMonth, toLocalTime } from '../lib/dateUtils';

interface Transaction {
  amount: number;
  created_at: string;
  category?: string | null;
}

interface Summary {
  revenue: number;
  expenses: number;
  net: number;
  transactionCount: number;
  topExpenseCategory?: string;
}

export function useSummary(transactions: Transaction[]) {
  const calculateSummary = (type: 'today' | 'week' | 'month'): Summary => {
    const now = new Date();
    let startDate: Date;

    switch (type) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
    }

    let revenue = 0;
    let expenses = 0;
    let transactionCount = 0;
    const catTotals: Record<string, number> = {};

    transactions.forEach((t) => {
      const createdAtLocal = toLocalTime(t.created_at);
      
      // Filter: created_at >= startDate && created_at <= now
      if (createdAtLocal >= startDate && createdAtLocal <= now) {
        const amt = Number(t.amount);
        if (amt > 0) {
          revenue += amt;
        } else if (amt < 0) {
          const absAmt = Math.abs(amt);
          expenses += absAmt;
          const cat = t.category;
          if (cat) catTotals[cat] = (catTotals[cat] || 0) + absAmt;
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

  const daily = useMemo(() => calculateSummary('today'), [transactions]);
  const weekly = useMemo(() => calculateSummary('week'), [transactions]);
  const monthly = useMemo(() => calculateSummary('month'), [transactions]);

  return { daily, weekly, monthly };
}

