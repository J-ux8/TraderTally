import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Summary {
  revenue: number;
  expenses: number;
  net: number;
  transactionCount: number;
  topExpenseCategory?: string;
}

interface SummaryCardProps {
  title: string;
  summary: Summary;
}

export const SummaryCard = React.memo(function SummaryCard({ title, summary }: SummaryCardProps) {
  const getStatusInfo = () => {
    if (summary.revenue === 0 && summary.expenses === 0) {
      return { message: "No transactions yet - start recording!", color: "#666", icon: "✨" };
    }
    if (summary.net > 0) {
      return { message: "You're making a profit! Keep going! 🎉", color: "#1e3a8a", icon: "📈" };
    }
    if (summary.net < 0) {
      return { message: "Watch out, you're spending more than you make. ⚠️", color: "#ef4444", icon: "📉" };
    }
    return { message: "You're breaking even. Every K1 counts! 💪", color: "#f59e0b", icon: "⚖️" };
  };

  const status = getStatusInfo();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <DollarSign size={20} color="#1e3a8a" />
            <Text style={styles.cardLabel}>Money In</Text>
          </View>
          <Text style={[styles.cardValue, styles.revenue]}>
            K {summary.revenue.toFixed(2)}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TrendingDown size={20} color="#ef4444" />
            <Text style={styles.cardLabel}>Money Out</Text>
          </View>
          <Text style={[styles.cardValue, styles.expense]}>
            K {summary.expenses.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={[styles.netCard, summary.net < 0 && styles.netCardNegative]}>
        <View style={styles.netHeader}>
          <TrendingUp size={20} color={summary.net >= 0 ? '#1e3a8a' : '#ef4444'} />
          <Text style={styles.netLabel}>Net Profit</Text>
        </View>
        <Text style={[styles.netValue, summary.net >= 0 ? styles.positive : styles.negative]}>
          K {summary.net.toFixed(2)}
        </Text>

        <View style={styles.insightContainer}>
          <Text style={[styles.insightText, { color: status.color }]}>
            {status.icon} {status.message}
          </Text>
        </View>

        <View style={styles.summaryFooter}>
          <Text style={styles.transactionCount}>
            From {summary.transactionCount} transactions
          </Text>
          {summary.topExpenseCategory && (
            <Text style={styles.topExpense}>
              Most spent on: <Text style={styles.topExpenseName}>{summary.topExpenseCategory}</Text>
            </Text>
          )}
        </View>
      </View>

      <View style={styles.formulaContainer}>
        <Text style={styles.formulaText}>
          Formula: Money In - Money Out = Profit
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
  const topCatEqual = prevProps.summary.topExpenseCategory === nextProps.summary.topExpenseCategory;

  // Skip re-render only if ALL props are equal
  return titleEqual && revenueEqual && expensesEqual && netEqual && countEqual && topCatEqual;
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
    color: '#1e3a8a',
  },
  expense: {
    color: '#ef4444',
  },
  netCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
  },
  netCardNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderColor: 'rgba(239, 68, 68, 0.1)',
  },
  netHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  netValue: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
  },
  insightContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  insightText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  positive: {
    color: '#1e3a8a',
  },
  negative: {
    color: '#ef4444',
  },
  transactionCount: {
    fontSize: 12,
    color: '#666',
  },
  summaryFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    paddingTop: 12,
    gap: 4,
  },
  topExpense: {
    fontSize: 12,
    color: '#666',
  },
  topExpenseName: {
    fontWeight: '700',
    color: '#ef4444',
  },
  formulaContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignItems: 'center',
  },
  formulaText: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    fontWeight: '500',
  },
});

