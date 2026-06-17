import { DollarSign, Package, TrendingDown, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Summary {
  revenue: number;
  profit: number;
  cogs: number;
  expenses: number;
  stockOrders: number;
  transactionCount: number;
}

interface SummaryCardProps {
  title: string;
  summary: Summary;
}

function formatCurrency(amount: number): string {
  return `K ${amount.toFixed(2)}`;
}

export const SummaryCard = React.memo(function SummaryCard({ title, summary }: SummaryCardProps) {
  const hasActivity = summary.transactionCount > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.metricsWrapper}>
        <View style={[styles.metricRow, styles.revenueRow]}>
          <View style={styles.accentBar}>
            <View style={[styles.accentFill, { backgroundColor: '#3b82f6' }]} />
          </View>
          <View style={styles.metricIcon}>
            <DollarSign size={20} color="#3b82f6" />
          </View>
          <View style={styles.metricBody}>
            <Text style={styles.metricLabel}>Revenue</Text>
            <Text style={[styles.metricValue, { color: '#0f172a' }]}>
              {hasActivity ? formatCurrency(summary.revenue) : 'K 0.00'}
            </Text>
          </View>
        </View>

        <View style={[styles.metricRow, styles.profitRow]}>
          <View style={styles.accentBar}>
            <View style={[styles.accentFill, { backgroundColor: '#10b981' }]} />
          </View>
          <View style={styles.metricIcon}>
            <TrendingUp size={22} color="#10b981" />
          </View>
          <View style={styles.metricBody}>
            <Text style={styles.metricLabel}>Total Profits</Text>
            <Text style={[styles.metricValueLarge, { color: '#10b981' }]}>
              {hasActivity ? formatCurrency(summary.profit) : 'K 0.00'}
            </Text>
          </View>
        </View>

        <View style={[styles.metricRow, styles.expenseRow]}>
          <View style={styles.accentBar}>
            <View style={[styles.accentFill, { backgroundColor: '#ef4444' }]} />
          </View>
          <View style={styles.metricIcon}>
            <TrendingDown size={20} color="#ef4444" />
          </View>
          <View style={styles.metricBody}>
            <Text style={styles.metricLabel}>Expenses</Text>
            <Text style={[styles.metricValue, { color: '#ef4444' }]}>
              {hasActivity ? formatCurrency(summary.expenses) : 'K 0.00'}
            </Text>
          </View>
        </View>

        {summary.stockOrders > 0 && (
          <View style={[styles.metricRow, styles.stockRow]}>
            <View style={styles.accentBar}>
              <View style={[styles.accentFill, { backgroundColor: '#8b5cf6' }]} />
            </View>
            <View style={styles.metricIcon}>
              <Package size={20} color="#8b5cf6" />
            </View>
            <View style={styles.metricBody}>
              <Text style={styles.metricLabel}>Stock Orders</Text>
              <Text style={[styles.metricValue, { color: '#8b5cf6' }]}>
                {formatCurrency(summary.stockOrders)}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {hasActivity
            ? `From ${summary.transactionCount} transaction${summary.transactionCount === 1 ? '' : 's'}`
            : 'No activity recorded yet'}
        </Text>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  const titleEqual = prevProps.title === nextProps.title;
  const revenueEqual = prevProps.summary.revenue === nextProps.summary.revenue;
  const profitEqual = prevProps.summary.profit === nextProps.summary.profit;
  const expensesEqual = prevProps.summary.expenses === nextProps.summary.expenses;
  const stockEqual = prevProps.summary.stockOrders === nextProps.summary.stockOrders;
  const countEqual = prevProps.summary.transactionCount === nextProps.summary.transactionCount;
  return titleEqual && revenueEqual && profitEqual && expensesEqual && stockEqual && countEqual;
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  metricsWrapper: {
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    overflow: 'hidden',
  },
  revenueRow: {
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.08)',
  },
  profitRow: {
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.12)',
  },
  expenseRow: {
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.08)',
  },
  stockRow: {
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.08)',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  accentFill: {
    flex: 1,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  metricIcon: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingRight: 16,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  metricValueLarge: {
    fontSize: 24,
    fontWeight: '800',
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
});
