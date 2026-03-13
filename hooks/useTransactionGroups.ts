/**
 * useTransactionGroups Hook
 * 
 * Custom React hook for managing transaction grouping with memoization and performance optimization.
 * Provides efficient grouping of transactions while maintaining cache for performance.
 */

import { useMemo, useState, useCallback } from 'react';
import { 
  Transaction, 
  TransactionGroup, 
  GroupingResult,
  GroupingConfig,
  GroupingMode
} from '@/types/grouping';
import { 
  TransactionGroupingEngine, 
  defaultGroupingEngine,
  findGroupByKey,
  findGroupById,
  getGroupsForDate
} from '@/lib/grouping';

/**
 * Return type for useTransactionGroups hook
 */
export interface UseTransactionGroupsReturn {
  groupedTransactions: TransactionGroup[];
  loading: boolean;
  groupingEnabled: boolean;
  metrics: {
    totalGroups: number;
    averageGroupSize: number;
    groupingEfficiency: number;
    processingTime: number;
  };
  actions: {
    toggleGrouping: () => void;
    setGroupingEnabled: (enabled: boolean) => void;
    getGroupByKey: (key: string) => TransactionGroup | undefined;
    getGroupById: (id: string) => TransactionGroup | undefined;
    getGroupsForDate: (date: string) => TransactionGroup[];
    refreshGroups: () => void;
  };
}

/**
 * Hook options for customizing grouping behavior
 */
export interface UseTransactionGroupsOptions {
  dateFilter?: string; // Filter transactions by specific date (YYYY-MM-DD)
  caseSensitive?: boolean; // Whether description matching is case-sensitive
  minGroupSize?: number; // Minimum transactions required to form a group
  initialGroupingEnabled?: boolean; // Initial state for grouping toggle
}

/**
 * Custom hook for transaction grouping with memoization and performance optimization
 */
export function useTransactionGroups(
  transactions: Transaction[],
  options: UseTransactionGroupsOptions = {}
): UseTransactionGroupsReturn {
  const {
    dateFilter,
    caseSensitive = true,
    minGroupSize = 1,
    initialGroupingEnabled = true
  } = options;

  // State for grouping toggle
  const [groupingEnabled, setGroupingEnabled] = useState(initialGroupingEnabled);
  const [loading, setLoading] = useState(false);

  // Create grouping engine with custom configuration
  const groupingEngine = useMemo(() => {
    return new TransactionGroupingEngine({
      mode: groupingEnabled ? GroupingMode.GROUPED : GroupingMode.INDIVIDUAL,
      caseSensitive,
      includeTime: false,
      minGroupSize
    });
  }, [groupingEnabled, caseSensitive, minGroupSize]);

  // Filter transactions by date if specified
  const filteredTransactions = useMemo(() => {
    if (!dateFilter) return transactions;
    
    return transactions.filter(tx => {
      try {
        const txDate = new Date(tx.transaction_date);
        const filterDate = new Date(dateFilter);
        
        return (
          txDate.getFullYear() === filterDate.getFullYear() &&
          txDate.getMonth() === filterDate.getMonth() &&
          txDate.getDate() === filterDate.getDate()
        );
      } catch (error) {
        console.warn('Error filtering transaction by date:', tx.id, error);
        return false;
      }
    });
  }, [transactions, dateFilter]);

  // Memoized grouping computation with performance tracking
  const groupingResult = useMemo<GroupingResult>(() => {
    if (!groupingEnabled) {
      // Return individual transactions as single-item groups when grouping is disabled
      const individualGroups: TransactionGroup[] = filteredTransactions.map(tx => ({
        id: `individual_${tx.id}`,
        description: tx.description,
        category: tx.category,
        date: tx.transaction_date.split('T')[0],
        totalAmount: tx.amount,
        transactionCount: 1,
        transactions: [tx],
        groupKey: `${tx.description}|${tx.category}|${tx.transaction_date.split('T')[0]}`
      }));

      return {
        groups: individualGroups,
        metrics: {
          totalGroups: individualGroups.length,
          averageGroupSize: 1,
          largestGroup: individualGroups[0] || {} as TransactionGroup,
          groupingEfficiency: 0,
          processingTime: 0
        },
        config: groupingEngine.getConfig(),
        timestamp: Date.now()
      };
    }

    try {
      setLoading(true);
      return groupingEngine.groupTransactionsWithMetrics(filteredTransactions);
    } catch (error) {
      console.error('Error during transaction grouping:', error);
      return {
        groups: [],
        metrics: {
          totalGroups: 0,
          averageGroupSize: 0,
          largestGroup: {} as TransactionGroup,
          groupingEfficiency: 0,
          processingTime: 0
        },
        config: groupingEngine.getConfig(),
        timestamp: Date.now()
      };
    } finally {
      setLoading(false);
    }
  }, [filteredTransactions, groupingEnabled, groupingEngine]);

  // Extract grouped transactions and metrics
  const groupedTransactions = groupingResult.groups;
  const metrics = {
    totalGroups: groupingResult.metrics.totalGroups,
    averageGroupSize: groupingResult.metrics.averageGroupSize,
    groupingEfficiency: groupingResult.metrics.groupingEfficiency,
    processingTime: groupingResult.metrics.processingTime
  };

  // Action functions
  const toggleGrouping = useCallback(() => {
    setGroupingEnabled(prev => !prev);
  }, []);

  const getGroupByKey = useCallback((key: string) => {
    return findGroupByKey(groupedTransactions, key);
  }, [groupedTransactions]);

  const getGroupById = useCallback((id: string) => {
    return findGroupById(groupedTransactions, id);
  }, [groupedTransactions]);

  const getGroupsForDateCallback = useCallback((date: string) => {
    return getGroupsForDate(groupedTransactions, date);
  }, [groupedTransactions]);

  const refreshGroups = useCallback(() => {
    // Force re-computation by updating a dependency
    // This is handled automatically by the useMemo dependency array
    setLoading(true);
    setTimeout(() => setLoading(false), 0);
  }, []);

  return {
    groupedTransactions,
    loading,
    groupingEnabled,
    metrics,
    actions: {
      toggleGrouping,
      setGroupingEnabled,
      getGroupByKey,
      getGroupById,
      getGroupsForDate: getGroupsForDateCallback,
      refreshGroups
    }
  };
}

/**
 * Simplified hook for basic transaction grouping without advanced options
 */
export function useSimpleTransactionGroups(transactions: Transaction[]): {
  groups: TransactionGroup[];
  loading: boolean;
} {
  const { groupedTransactions, loading } = useTransactionGroups(transactions, {
    initialGroupingEnabled: true
  });

  return {
    groups: groupedTransactions,
    loading
  };
}

/**
 * Hook for getting groups for today's transactions
 */
export function useTodayTransactionGroups(transactions: Transaction[]): {
  groups: TransactionGroup[];
  loading: boolean;
  totalAmount: number;
  transactionCount: number;
} {
  const todayObj = new Date();
  const today = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  
  const { groupedTransactions, loading } = useTransactionGroups(transactions, {
    dateFilter: today,
    initialGroupingEnabled: true
  });

  const totalAmount = useMemo(() => {
    return groupedTransactions.reduce((sum, group) => sum + group.totalAmount, 0);
  }, [groupedTransactions]);

  const transactionCount = useMemo(() => {
    return groupedTransactions.reduce((count, group) => count + group.transactionCount, 0);
  }, [groupedTransactions]);

  return {
    groups: groupedTransactions,
    loading,
    totalAmount,
    transactionCount
  };
}