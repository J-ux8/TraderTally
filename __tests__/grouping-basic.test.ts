/**
 * Basic Transaction Grouping Tests
 * 
 * Simple tests to verify core grouping functionality works correctly.
 */

import { TransactionGroupingEngine } from '@/lib/grouping';
import { Transaction } from '@/types/grouping';

describe('Transaction Grouping - Basic Tests', () => {
  let groupingEngine: TransactionGroupingEngine;

  beforeEach(() => {
    groupingEngine = new TransactionGroupingEngine();
  });

  test('should group transactions with same description, category, and date', () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        amount: 50,
        category: 'Food',
        description: 'Bread Sale',
        transaction_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user1'
      },
      {
        id: '2',
        amount: 50,
        category: 'Food',
        description: 'Bread Sale',
        transaction_date: '2024-01-15T11:00:00Z',
        created_at: '2024-01-15T11:00:00Z',
        user_id: 'user1'
      }
    ];

    const groups = groupingEngine.groupTransactions(transactions);

    expect(groups).toHaveLength(1);
    expect(groups[0].description).toBe('Bread Sale');
    expect(groups[0].category).toBe('Food');
    expect(groups[0].totalAmount).toBe(100);
    expect(groups[0].transactionCount).toBe(2);
    expect(groups[0].transactions).toHaveLength(2);
  });

  test('should create separate groups for different descriptions', () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        amount: 50,
        category: 'Food',
        description: 'Bread Sale',
        transaction_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user1'
      },
      {
        id: '2',
        amount: 30,
        category: 'Food',
        description: 'Milk Sale',
        transaction_date: '2024-01-15T11:00:00Z',
        created_at: '2024-01-15T11:00:00Z',
        user_id: 'user1'
      }
    ];

    const groups = groupingEngine.groupTransactions(transactions);

    expect(groups).toHaveLength(2);
    expect(groups.find(g => g.description === 'Bread Sale')).toBeDefined();
    expect(groups.find(g => g.description === 'Milk Sale')).toBeDefined();
  });

  test('should create separate groups for different dates', () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        amount: 50,
        category: 'Food',
        description: 'Bread Sale',
        transaction_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user1'
      },
      {
        id: '2',
        amount: 50,
        category: 'Food',
        description: 'Bread Sale',
        transaction_date: '2024-01-16T10:00:00Z',
        created_at: '2024-01-16T10:00:00Z',
        user_id: 'user1'
      }
    ];

    const groups = groupingEngine.groupTransactions(transactions);

    expect(groups).toHaveLength(2);
    expect(groups[0].date).not.toBe(groups[1].date);
  });

  test('should handle empty transaction array', () => {
    const groups = groupingEngine.groupTransactions([]);
    expect(groups).toHaveLength(0);
  });

  test('should handle single transaction', () => {
    const transactions: Transaction[] = [
      {
        id: '1',
        amount: 50,
        category: 'Food',
        description: 'Bread Sale',
        transaction_date: '2024-01-15T10:00:00Z',
        created_at: '2024-01-15T10:00:00Z',
        user_id: 'user1'
      }
    ];

    const groups = groupingEngine.groupTransactions(transactions);

    expect(groups).toHaveLength(1);
    expect(groups[0].transactionCount).toBe(1);
    expect(groups[0].totalAmount).toBe(50);
  });

  test('should generate consistent group keys', () => {
    const transaction: Transaction = {
      id: '1',
      amount: 50,
      category: 'Food',
      description: 'Bread Sale',
      transaction_date: '2024-01-15T10:00:00Z',
      created_at: '2024-01-15T10:00:00Z',
      user_id: 'user1'
    };

    const key1 = groupingEngine.generateGroupKey(transaction);
    const key2 = groupingEngine.generateGroupKey(transaction);

    expect(key1).toBe(key2);
    expect(key1).toBe('Bread Sale|Food|2024-01-15');
  });
});