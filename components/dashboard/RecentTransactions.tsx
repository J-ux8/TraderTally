import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

interface Category {
  id: string;
  name: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

export const RecentTransactions = React.memo(function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity style={styles.transactionItem} activeOpacity={0.7}>
      <View style={styles.transactionContent}>
        <View style={styles.transactionHeader}>
          <Text style={styles.transactionAmount}>
            K {Math.abs(item.amount).toFixed(2)}
          </Text>
          <Text style={styles.transactionDate}>
            {formatDate(item.transaction_date)}
          </Text>
        </View>
        {item.category && (
          <Text style={styles.transactionCategory}>{item.category}</Text>
        )}
        {item.description && (
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>
      <ArrowRight size={20} color="#999" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Transactions</Text>
        {transactions.length > 5 && (
          <TouchableOpacity
            onPress={() => router.push('./records')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {recentTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            No transactions yet. Start by recording your first sale!
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {recentTransactions.map((item) => (
            <View key={item.id}>
              {renderTransaction({ item })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  // Re-render if transactions array changes
  // Return true = skip re-render (props are equal)
  // Return false = re-render (props are different)

  // If length changed, definitely re-render
  if (prevProps.transactions.length !== nextProps.transactions.length) {
    return false; // Re-render
  }

  // Check if any transaction IDs in the first 5 changed
  const prevIds = prevProps.transactions.slice(0, 5).map(t => t.id).join(',');
  const nextIds = nextProps.transactions.slice(0, 5).map(t => t.id).join(',');

  // If IDs are different, re-render
  if (prevIds !== nextIds) {
    return false; // Re-render
  }

  // Also check if amounts changed (for summary updates)
  const prevAmounts = prevProps.transactions.slice(0, 5).map(t => t.amount).join(',');
  const nextAmounts = nextProps.transactions.slice(0, 5).map(t => t.amount).join(',');

  if (prevAmounts !== nextAmounts) {
    return false; // Re-render
  }

  // All props are equal, skip re-render
  return true;
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a8a',
  },
  listContainer: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  transactionCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  transactionDescription: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

