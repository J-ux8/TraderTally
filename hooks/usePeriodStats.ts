import { useState, useEffect, useRef, useMemo } from 'react';
import { getTransactionsInRange } from '@/lib/transactions';
import { getCachedStats, setCachedStats } from '@/lib/statsCache';

const DAY_MS = 86400000;

interface DayBucket {
  dateMs: number;
  revenue: number;
  expenses: number;
  profit: number;
  count: number;
  transactions: any[];
}

export interface Stats {
  revenue: number;
  expenses: number;
  profit: number;
  count: number;
  dailyBreakdown: (DayBucket & { date: Date })[];
}

const EMPTY_STATS: Stats = { revenue: 0, expenses: 0, profit: 0, count: 0, dailyBreakdown: [] };

export function computeStats(transactions: any[]): Stats {
  const now = new Date();
  const tzOffsetMs = -now.getTimezoneOffset() * 60000;
  const dayBuckets = new Map<number, DayBucket>();

  let revenue = 0;
  let expenses = 0;
  let profit = 0;
  let count = 0;

  for (let i = 0; i < transactions.length; i++) {
    const t = transactions[i];
    const createdAtMs = new Date(t.created_at).getTime();
    const localMs = createdAtMs + tzOffsetMs;
    const dayKey = Math.floor(localMs / DAY_MS);
    const dateMs = dayKey * DAY_MS - tzOffsetMs;

    let bucket = dayBuckets.get(dayKey);
    if (!bucket) {
      bucket = { dateMs, revenue: 0, expenses: 0, profit: 0, count: 0, transactions: [] };
      dayBuckets.set(dayKey, bucket);
    }

    const amt = Number(t.amount);
    if (amt > 0) {
      revenue += amt;
      bucket.revenue += amt;
      profit += amt;
      bucket.profit += amt;
    } else if (amt < 0) {
      const absAmt = Math.abs(amt);
      expenses += absAmt;
      bucket.expenses += absAmt;
      profit -= absAmt;
      bucket.profit -= absAmt;
    }

    count++;
    bucket.count++;
    bucket.transactions.push(t);
  }

  for (const bucket of dayBuckets.values()) {
    bucket.transactions.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  const dailyBreakdown = Array.from(dayBuckets.values())
    .sort((a, b) => b.dateMs - a.dateMs)
    .map(b => ({ ...b, date: new Date(b.dateMs) }));

  return { revenue, expenses, profit, count, dailyBreakdown };
}

export function usePeriodStats(cacheKey: string, startMs: number, endMs: number) {
  const [rangeTransactions, setRangeTransactions] = useState<any[]>(() => {
    const cached = getCachedStats(cacheKey);
    return cached?.transactions ?? [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getCachedStats(cacheKey);
    return !cached;
  });
  const mountRef = useRef(true);

  useEffect(() => {
    mountRef.current = true;
    const cached = getCachedStats(cacheKey);
    if (cached) {
      setRangeTransactions(cached.transactions);
      setLoading(false);
    } else {
      setLoading(true);
    }

    getTransactionsInRange(startMs, endMs).then((data) => {
      if (!mountRef.current) return;
      const stats = computeStats(data);
      setCachedStats(cacheKey, data, stats);
      setRangeTransactions(data);
      setLoading(false);
    });

    return () => { mountRef.current = false; };
  }, [cacheKey, startMs, endMs]);

  const stats = useMemo(() => {
    if (rangeTransactions.length === 0) return EMPTY_STATS;
    return computeStats(rangeTransactions);
  }, [rangeTransactions]);

  return { stats, loading, transactions: rangeTransactions };
}
