/**
 * Transaction Group Detail Modal Screen
 * 
 * Displays detailed view of a transaction group with all individual transactions.
 * Allows users to view and interact with transactions within a specific group.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TransactionGroupDetail } from '@/components/transactions/TransactionGroupDetail';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Transaction } from '@/types/grouping';

/**
 * Transaction Group Detail Modal Screen Component
 */
export default function TransactionGroupDetailModal() {
  const { theme } = useTheme();
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
      // TODO: Navigate to transaction detail modal
      // For now, we'll show an alert with transaction info
      Alert.alert(
        'Transaction Details',
        `Amount: K${Math.abs(transaction.amount)}\nDescription: ${transaction.description || 'No description'}\nCategory: ${transaction.category || 'No category'}\nDate: ${new Date(transaction.transaction_date).toLocaleString()}`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Edit', 
            style: 'default',
            onPress: () => {
              // TODO: Navigate to edit transaction screen
              console.log('Edit transaction:', transaction.id);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error handling transaction press:', error);
      Alert.alert('Error', 'Unable to view transaction details');
    }
  };

  // Handle back navigation
  const handleBack = () => {
    try {
      router.back();
    } catch (error) {
      console.error('Error navigating back:', error);
      router.replace('/');
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
    <View style={[styles.container, { backgroundColor }]}>
      <Stack.Screen
        options={{
          title: params.title || displayGroup.description || 'Transaction Group',
          presentation: 'modal',
          headerShown: true,
          headerBackTitle: 'Back',
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