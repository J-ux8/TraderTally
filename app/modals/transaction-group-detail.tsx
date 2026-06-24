/**
 * Transaction Group Detail Modal Screen
 * 
 * Displays detailed view of a transaction group with all individual transactions.
 * Allows users to view and interact with transactions within a specific group.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TransactionGroupDetail } from '@/components/transactions/TransactionGroupDetail';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Transaction } from '@/types/grouping';

/**
 * Transaction Group Detail Modal Screen Component
 */
export default function TransactionGroupDetailModal() {
  const { theme } = useTheme();
  const colors = useThemeColors();
  const { groupedTransactions, getGroupById } = useTransactionsContext();
  const params = useLocalSearchParams<{
    groupId: string;
    groupKey: string;
    title: string;
  }>();

  // Find the group by ID
  const group = useMemo(() => {
    if (!params.groupId) return null;
    return getGroupById(params.groupId);
  }, [params.groupId, getGroupById]);

  // Fallback: find group by key if ID lookup fails
  const fallbackGroup = useMemo(() => {
    if (group || !params.groupKey) return null;
    return groupedTransactions.find(g => g.groupKey === params.groupKey);
  }, [group, params.groupKey, groupedTransactions]);

  const displayGroup = group || fallbackGroup;

  // Handle transaction press - navigate to transaction detail
  const handleTransactionPress = (transaction: Transaction) => {
    try {
      const isSale = transaction.amount > 0;
      const absAmount = Math.abs(transaction.amount);

      if (isSale) {
        router.push({
          pathname: '/modals/record-sale',
          params: {
            existingTransactionId: transaction.id,
            preset_amount: absAmount.toString(),
            preset_description: transaction.description || '',
          },
        });
      } else {
        router.push({
          pathname: '/modals/record-expense',
          params: {
            existingTransactionId: transaction.id,
            preset_amount: absAmount.toString(),
            preset_description: transaction.description || '',
          },
        });
      }
    } catch (error) {
      if (__DEV__) console.error('Error navigating to transaction:', error);
    }
  };

  // Dynamic colors based on theme
  const backgroundColor = theme === 'dark' ? '#0f172a' : '#ffffff';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';

  // Error state - group not found
  if (!displayGroup) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <Stack.Screen
          options={{
            title: 'Group Not Found',
            presentation: 'modal',
            headerShown: true,
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: textColor }]}>
            Group not found
          </Text>
        </View>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <Stack.Screen
        options={{
          headerTitle: params.title || displayGroup.description || displayGroup.category || 'Transaction Detail',
          headerTitleStyle: {
            color: '#ffffff',
            fontWeight: '800',
            fontSize: 18,
          },
          headerStyle: {
            backgroundColor: colors.headerBackground,
          },
          headerTintColor: '#ffffff',
          headerShown: true,
          headerBackTitle: 'Back',
          headerShadowVisible: false,
        }}
      />
      
      <TransactionGroupDetail
        group={displayGroup}
        onTransactionPress={handleTransactionPress}
        showHeader={true}
      />
      
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});