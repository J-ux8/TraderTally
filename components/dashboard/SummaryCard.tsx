import { DollarSign, TrendingDown, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Summary {
  revenue: number;
  profit: number;
  cogs: number;
  expenses: number;
  transactionCount: number;
}

interface SummaryCardProps {
  title: string;
  summary: Summary;
}

function formatCurrency(amount: number): string {
  return `K ${amount.toFixed(2)}`;
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export const SummaryCard = React.memo(function SummaryCard({ title, summary }: SummaryCardProps) {
  const hasActivity = summary.transactionCount > 0;
  const revenue = summary.revenue;
  const profit = summary.profit;
  const expenses = summary.expenses;

  // Bar widths as % of revenue (caps at 100%)
  const profitPct = revenue > 0 ? Math.min(profit / revenue, 1) : 0;
  const expensePct = revenue > 0 ? Math.min(expenses / revenue, 1) : 0;

  // Margin percentage
  const marginPct = revenue > 0 ? profit / revenue : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>

      {/* Revenue */}
      <View style={styles.metricBlock}>
        <View style={styles.metricHeader}>
          <View style={styles.metricLabelRow}>
            <DollarSign size={16} color="#3b82f6" />
            <Text style={styles.metricLabel}>Revenue</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#0f172a' }]}>
            {hasActivity ? formatCurrency(revenue) : 'K 0.00'}
          </Text>
        </View>
        {hasActivity && revenue > 0 && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: '100%', backgroundColor: '#3b82f6' }]} />
          </View>
        )}
      </View>

      {/* Total Profits */}
      <View style={styles.metricBlock}>
        <View style={styles.metricHeader}>
          <View style={styles.metricLabelRow}>
            <TrendingUp size={16} color="#10b981" />
            <Text style={styles.metricLabel}>Total Profits</Text>
          </View>
          <View style={styles.profitRight}>
            <Text style={[styles.metricValueLarge, { color: profit >= 0 ? '#10b981' : '#ef4444' }]}>
              {hasActivity ? formatCurrency(profit) : 'K 0.00'}
            </Text>
            {hasActivity && revenue > 0 && (
              <View style={[styles.marginBadge, { backgroundColor: marginPct >= 0.2 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                <Text style={[styles.marginText, { color: marginPct >= 0.2 ? '#10b981' : '#ef4444' }]}>
                  {formatPercent(marginPct)}
                </Text>
              </View>
            )}
          </View>
        </View>
        {hasActivity && revenue > 0 && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.round(profitPct * 100)}%`, backgroundColor: '#10b981' }]} />
          </View>
        )}
      </View>

      {/* Expenses */}
      <View style={styles.metricBlock}>
        <View style={styles.metricHeader}>
          <View style={styles.metricLabelRow}>
            <TrendingDown size={16} color="#ef4444" />
            <Text style={styles.metricLabel}>Expenses</Text>
          </View>
          <Text style={[styles.metricValue, { color: '#ef4444' }]}>
            {hasActivity ? formatCurrency(expenses) : 'K 0.00'}
          </Text>
        </View>
        {hasActivity && revenue > 0 && (
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.round(expensePct * 100)}%`, backgroundColor: '#ef4444' }]} />
          </View>
        )}
      </View>

      {/* Footer */}
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
  const countEqual = prevProps.summary.transactionCount === nextProps.summary.transactionCount;
  return titleEqual && revenueEqual && profitEqual && expensesEqual && countEqual;
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
    marginBottom: 16,
  },
  metricBlock: {
    marginBottom: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  profitRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marginBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  marginText: {
    fontSize: 12,
    fontWeight: '700',
  },
  barTrack: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  footer: {
    marginTop: 8,
    paddingTop: 10,
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
