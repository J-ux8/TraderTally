import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Summary {
  revenue: number;
  expenses: number;
  net: number;
  transactionCount: number;
}

interface SummaryCardProps {
  title: string;
  summary: Summary;
}

export const SummaryCard = React.memo(function SummaryCard({ title, summary }: SummaryCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      
      <View style={styles.grid}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <DollarSign size={20} color="#10b981" />
            <Text style={styles.cardLabel}>Revenue</Text>
          </View>
          <Text style={[styles.cardValue, styles.revenue]}>
            K {summary.revenue.toFixed(2)}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TrendingDown size={20} color="#ef4444" />
            <Text style={styles.cardLabel}>Expenses</Text>
          </View>
          <Text style={[styles.cardValue, styles.expense]}>
            K {summary.expenses.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.netCard}>
        <View style={styles.netHeader}>
          <TrendingUp size={20} color={summary.net >= 0 ? '#10b981' : '#ef4444'} />
          <Text style={styles.netLabel}>Net Income</Text>
        </View>
        <Text style={[styles.netValue, summary.net >= 0 ? styles.positive : styles.negative]}>
          K {summary.net.toFixed(2)}
        </Text>
        <Text style={styles.transactionCount}>
          {summary.transactionCount} transactions
        </Text>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Re-render if title or summary values change
  // Return true = skip re-render (props are equal)
  // Return false = re-render (props are different)
  const titleEqual = prevProps.title === nextProps.title;
  const revenueEqual = prevProps.summary.revenue === nextProps.summary.revenue;
  const expensesEqual = prevProps.summary.expenses === nextProps.summary.expenses;
  const netEqual = prevProps.summary.net === nextProps.summary.net;
  const countEqual = prevProps.summary.transactionCount === nextProps.summary.transactionCount;
  
  // Skip re-render only if ALL props are equal
  return titleEqual && revenueEqual && expensesEqual && netEqual && countEqual;
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  revenue: {
    color: '#10b981',
  },
  expense: {
    color: '#ef4444',
  },
  netCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  netHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  netValue: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  positive: {
    color: '#10b981',
  },
  negative: {
    color: '#ef4444',
  },
  transactionCount: {
    fontSize: 12,
    color: '#666',
  },
});

