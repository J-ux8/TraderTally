import { TransactionGroupDetail } from '@/components/transactions/TransactionGroupDetail';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { toLocalTime } from '@/lib/dateUtils';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DayTransactionsScreen() {
  const { dateKey, label } = useLocalSearchParams<{ dateKey: string, label: string }>();
  const { transactions } = useTransactionsContext();
  const colors = useThemeColors();

  const dayTransactions = useMemo(() => {
    return transactions.filter(t => {
      const createdAt = toLocalTime(t.created_at);
      return createdAt.toISOString().split('T')[0] === dateKey;
    });
  }, [dateKey, transactions]);

  const totalAmount = useMemo(() => {
    return dayTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  }, [dayTransactions]);

  const mockGroup = useMemo(() => ({
    id: dateKey || 'unknown',
    description: label || 'Daily Transactions',
    category: 'Full Day',
    date: dateKey || '',
    totalAmount,
    transactionCount: dayTransactions.length,
    transactions: dayTransactions,
    groupKey: dateKey || ''
  }), [dateKey, label, dayTransactions, totalAmount]);

  const handleTransactionPress = (transaction: any) => {
    Alert.alert(
      'Transaction Details',
      `Amount: K${Math.abs(transaction.amount).toFixed(2)}\nType: ${transaction.amount >= 0 ? 'Sale' : 'Expense'}\nCategory: ${transaction.category || 'Uncategorized'}\nDescription: ${transaction.description || 'No description'}\nTime: ${new Date(transaction.created_at).toLocaleTimeString()}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transactions</Text>
        <View style={{ width: 40 }} />
      </View>

      <TransactionGroupDetail 
        group={mockGroup} 
        onTransactionPress={handleTransactionPress}
        showHeader={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
});
