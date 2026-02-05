import { router } from 'expo-router';
import { CreditCard, FileText, Plus, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const QuickActions = React.memo(function QuickActions() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => router.push('./record-sale')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Plus size={24} color="#ffffff" />
          </View>
          <Text style={styles.primaryButtonText}>Record Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('./record-expense')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, styles.secondaryIcon]}>
            <TrendingUp size={24} color="#10b981" />
          </View>
          <Text style={styles.secondaryButtonText}>Record Expense</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('./add-debt')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, styles.secondaryIcon]}>
            <CreditCard size={24} color="#10b981" />
          </View>
          <Text style={styles.secondaryButtonText}>Add Credit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('./reports')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, styles.secondaryIcon]}>
            <FileText size={24} color="#10b981" />
          </View>
          <Text style={styles.secondaryButtonText}>View Reports</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
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
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  primaryButton: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  secondaryIcon: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});

