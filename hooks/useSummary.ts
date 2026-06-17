import { useMemo } from 'react';
import { startOfDay, startOfWeek, startOfMonth, toLocalTime } from '../lib/dateUtils';

interface SaleItem {
  unit_price: number;
  unit_cost: number | null;
  quantity: number;
}

interface Transaction {
  amount: number;
  created_at: string;
  category?: string | null;
  description?: string | null;
  linked_sale_id?: string | null;
  sale_items?: SaleItem[];
}

interface Summary {
  revenue: number;
  profit: number;
  cogs: number;
  expenses: number;
  stockOrders: number;
  transactionCount: number;
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
    let profit = 0;
    let cogs = 0;
    let expenses = 0;
    let stockOrders = 0;
    let transactionCount = 0;

    transactions.forEach((t) => {
      const createdAtLocal = toLocalTime(t.created_at);

      if (createdAtLocal >= startDate && createdAtLocal <= now) {
        const amt = Number(t.amount);

        if (amt > 0) {
          revenue += amt;

          if (t.sale_items && t.sale_items.length > 0) {
            for (const item of t.sale_items) {
              if (item.unit_cost != null) {
                const itemCogs = item.unit_cost * item.quantity;
                cogs += itemCogs;
                profit += (item.unit_price - item.unit_cost) * item.quantity;
              }
            }
          }
        } else if (amt < 0) {
          const isStockPurchase =
            t.category === 'Stock / Inventory' ||
            (t.description && t.description.startsWith('Order:'));

          if (isStockPurchase) {
            stockOrders += Math.abs(amt);
          } else {
            expenses += Math.abs(amt);
          }
        }

        transactionCount++;
      }
    });

    return {
      revenue,
      profit,
      cogs,
      expenses,
      stockOrders,
      transactionCount,
    };
  };

  const daily = useMemo(() => calculateSummary('today'), [transactions]);
  const weekly = useMemo(() => calculateSummary('week'), [transactions]);
  const monthly = useMemo(() => calculateSummary('month'), [transactions]);

  return { daily, weekly, monthly };
}
