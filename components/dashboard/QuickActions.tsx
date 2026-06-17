import { router } from 'expo-router';
import { BookOpen, FileText, Plus, TrendingUp, TrendingDown, Package } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const QuickActions = React.memo(function QuickActions() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton]}
          onPress={() => router.push('/modals/new-sale')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Plus size={24} color="#ffffff" />
          </View>
          <Text style={styles.primaryButtonText}>Multi-Item Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/modals/record-sale')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, styles.secondaryIcon]}>
            <TrendingUp size={24} color="#1e3a8a" />
          </View>
          <Text style={styles.secondaryButtonText}>Single Sale</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/modals/record-expense')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, styles.secondaryIcon, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
            <TrendingDown size={24} color="#ef4444" />
          </View>
          <Text style={styles.secondaryButtonText}>Record Expense</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/modals/orders')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, styles.secondaryIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <Package size={24} color="#10b981" />
          </View>
          <Text style={styles.secondaryButtonText}>Record Stock</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/debts')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconContainer, styles.secondaryIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
            <BookOpen size={24} color="#f59e0b" />
          </View>
          <Text style={styles.secondaryButtonText}>Credit Book</Text>
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
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
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

