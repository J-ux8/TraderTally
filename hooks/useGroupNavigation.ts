/**
 * useGroupNavigation Hook
 * 
 * Custom React hook for managing navigation between grouped transaction views
 * and individual transaction detail screens.
 */

import { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { TransactionGroup, Transaction, GroupDetailParams, TransactionDetailParams } from '@/types/grouping';

/**
 * Return type for useGroupNavigation hook
 */
export interface UseGroupNavigationReturn {
  currentGroup: TransactionGroup | null;
  navigationHistory: string[];
  actions: {
    navigateToGroup: (group: TransactionGroup) => void;
    navigateToTransaction: (transaction: Transaction, groupContext?: TransactionGroup) => void;
    navigateBack: () => void;
    clearHistory: () => void;
    canGoBack: boolean;
  };
}

/**
 * Custom hook for managing group navigation state and actions
 */
export function useGroupNavigation(): UseGroupNavigationReturn {
  const [currentGroup, setCurrentGroup] = useState<TransactionGroup | null>(null);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

  /**
   * Navigate to a transaction group detail screen
   */
  const navigateToGroup = useCallback((group: TransactionGroup) => {
    try {
      setCurrentGroup(group);
      setNavigationHistory(prev => [...prev, `group:${group.id}`]);

      const params: GroupDetailParams = {
        groupId: group.id,
        groupKey: group.groupKey,
        title: group.description || 'Transaction Group'
      };

      router.push({
        pathname: '/modals/transaction-group-detail' as any,
        params: {
          groupId: params.groupId,
          groupKey: params.groupKey,
          title: params.title
        }
      });
    } catch (error) {
      console.error('Error navigating to group:', error);
      // Fallback: show error message or navigate to safe screen
    }
  }, []);

  /**
   * Navigate to an individual transaction detail screen
   */
  const navigateToTransaction = useCallback((
    transaction: Transaction, 
    groupContext?: TransactionGroup
  ) => {
    try {
      setNavigationHistory(prev => [...prev, `transaction:${transaction.id}`]);

      const params: TransactionDetailParams = {
        transactionId: transaction.id,
        groupId: groupContext?.id
      };

      // TODO: Create transaction-detail modal route
      // For now, we'll use a placeholder or existing route
      console.log('Navigate to transaction detail:', params);
      // router.push({
      //   pathname: '/modals/transaction-detail',
      //   params: {
      //     transactionId: params.transactionId,
      //     ...(params.groupId && { groupId: params.groupId })
      //   }
      // });
    } catch (error) {
      console.error('Error navigating to transaction:', error);
      // Fallback: show error message or navigate to safe screen
    }
  }, []);

  /**
   * Navigate back to the previous screen
   */
  const navigateBack = useCallback(() => {
    try {
      if (navigationHistory.length > 0) {
        const newHistory = [...navigationHistory];
        const lastItem = newHistory.pop();
        setNavigationHistory(newHistory);

        // If we're going back from a transaction to a group, restore group context
        if (lastItem?.startsWith('transaction:') && newHistory.length > 0) {
          const previousItem = newHistory[newHistory.length - 1];
          if (previousItem?.startsWith('group:')) {
            // Keep current group context when going back to group
            router.back();
            return;
          }
        }

        // Clear group context when going back to main view
        if (newHistory.length === 0) {
          setCurrentGroup(null);
        }

        router.back();
      } else {
        // No history, go to main screen
        setCurrentGroup(null);
        router.back();
      }
    } catch (error) {
      console.error('Error navigating back:', error);
      // Fallback: navigate to home screen
      setCurrentGroup(null);
      setNavigationHistory([]);
      router.replace("/");
    }
  }, [navigationHistory]);

  /**
   * Clear navigation history and reset state
   */
  const clearHistory = useCallback(() => {
    setCurrentGroup(null);
    setNavigationHistory([]);
  }, []);

  /**
   * Check if we can navigate back
   */
  const canGoBack = navigationHistory.length > 0;

  return {
    currentGroup,
    navigationHistory,
    actions: {
      navigateToGroup,
      navigateToTransaction,
      navigateBack,
      clearHistory,
      canGoBack
    }
  };
}

/**
 * Simplified hook for basic group navigation without state tracking
 */
export function useSimpleGroupNavigation() {
  const navigateToGroup = useCallback((group: TransactionGroup) => {
    // TODO: Create transaction-group-detail modal route
    console.log('Navigate to group detail:', group);
    // router.push({
    //   pathname: '/modals/transaction-group-detail',
    //   params: {
    //     groupId: group.id,
    //     groupKey: group.groupKey,
    //     title: group.description || 'Transaction Group'
    //   }
    // });
  }, []);

  const navigateToTransaction = useCallback((transaction: Transaction) => {
    // TODO: Create transaction-detail modal route
    console.log('Navigate to transaction detail:', transaction);
    // router.push({
    //   pathname: '/modals/transaction-detail',
    //   params: {
    //     transactionId: transaction.id
    //   }
    // });
  }, []);

  return {
    navigateToGroup,
    navigateToTransaction
  };
}

/**
 * Hook for handling group navigation with error boundaries
 */
export function useSafeGroupNavigation(): UseGroupNavigationReturn {
  const navigation = useGroupNavigation();

  // Wrap navigation actions with error handling
  const safeNavigateToGroup = useCallback((group: TransactionGroup) => {
    try {
      navigation.actions.navigateToGroup(group);
    } catch (error) {
      console.error('Safe navigation error (group):', error);
      // Could show toast notification here
    }
  }, [navigation.actions]);

  const safeNavigateToTransaction = useCallback((
    transaction: Transaction, 
    groupContext?: TransactionGroup
  ) => {
    try {
      navigation.actions.navigateToTransaction(transaction, groupContext);
    } catch (error) {
      console.error('Safe navigation error (transaction):', error);
      // Could show toast notification here
    }
  }, [navigation.actions]);

  const safeNavigateBack = useCallback(() => {
    try {
      navigation.actions.navigateBack();
    } catch (error) {
      console.error('Safe navigation error (back):', error);
      // Fallback to home screen
      router.replace("/");
    }
  }, [navigation.actions]);

  return {
    ...navigation,
    actions: {
      ...navigation.actions,
      navigateToGroup: safeNavigateToGroup,
      navigateToTransaction: safeNavigateToTransaction,
      navigateBack: safeNavigateBack
    }
  };
}