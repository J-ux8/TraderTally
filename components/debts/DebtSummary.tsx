import { Debt } from '@/lib/debts';
import { TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface DebtSummaryProps {
  debts: Debt[];
}

export const DebtSummary = React.memo(function DebtSummary({ debts }: DebtSummaryProps) {
  const activeDebts = debts.filter(d => !d.is_settled);
  const totalActive = activeDebts.reduce((sum, d) => sum + Number(d.amount), 0);
  const totalCount = activeDebts.length;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <TrendingUp size={24} color="#1e3a8a" />
        </View>
        <View style={styles.content}>
          <Text style={styles.label}>Total Active Debts</Text>
          <Text style={styles.amount}>K {totalActive.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <Text style={styles.count}>{totalCount} {totalCount === 1 ? 'debt' : 'debts'}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  amount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 2,
  },
  count: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
});

