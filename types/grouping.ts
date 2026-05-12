/**
 * Transaction Grouping Types and Interfaces
 * 
 * This file defines the core data structures for transaction grouping functionality.
 * All grouping logic operates at the UI layer without modifying database records.
 */

// Re-export Transaction interface for consistency
export interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  user_id: string;
  customer_id: string | null;
  linked_sale_id: string | null;
  sale_items?: any[];
}

/**
 * Composite key used for grouping transactions
 * Groups transactions by description, category, and date (ignoring time)
 */
export interface GroupingKey {
  description: string | null;
  category: string | null;
  date: string; // YYYY-MM-DD format, time component stripped
}

/**
 * Aggregated transaction group containing multiple transactions
 * with the same description, category, and date
 */
export interface TransactionGroup {
  id: string; // Generated from grouping key
  description: string | null;
  category: string | null;
  date: string; // YYYY-MM-DD format
  totalAmount: number; // Sum of all transaction amounts in the group
  transactionCount: number; // Number of transactions in the group
  transactions: Transaction[]; // Original transaction records
  groupKey: string; // Composite key for efficient lookups
}

/**
 * Interface for the grouping engine that processes transactions
 */
export interface GroupingEngine {
  /**
   * Groups an array of transactions by description, category, and date
   * @param transactions Array of individual transactions
   * @returns Array of transaction groups
   */
  groupTransactions(transactions: Transaction[]): TransactionGroup[];
  
  /**
   * Generates a composite grouping key for a transaction
   * @param transaction Individual transaction record
   * @returns String key for grouping
   */
  generateGroupKey(transaction: Transaction): string;
  
  /**
   * Creates a transaction group from a key and transactions
   * @param key Grouping key string
   * @param transactions Array of transactions for this group
   * @returns TransactionGroup object
   */
  createGroup(key: string, transactions: Transaction[]): TransactionGroup;
}

/**
 * Cache structure for storing grouped results per date
 * Improves performance by avoiding recomputation
 */
export interface GroupingCache {
  [dateKey: string]: {
    groups: TransactionGroup[];
    lastUpdated: number;
    transactionIds: string[];
  };
}

/**
 * Metrics for monitoring grouping effectiveness and performance
 */
export interface GroupingMetrics {
  totalGroups: number;
  averageGroupSize: number;
  largestGroup: TransactionGroup;
  groupingEfficiency: number; // Reduction ratio (1 - groups/transactions)
  processingTime: number; // Time taken for grouping in milliseconds
}

/**
 * Navigation parameters for group detail screens
 */
export interface GroupDetailParams {
  groupId: string;
  groupKey: string;
  title: string;
}

/**
 * Navigation parameters for individual transaction detail screens
 */
export interface TransactionDetailParams {
  transactionId: string;
  groupId?: string; // Optional context for navigation back to group
}

/**
 * Enum for grouping display modes
 */
export enum GroupingMode {
  GROUPED = 'grouped',
  INDIVIDUAL = 'individual'
}

/**
 * Configuration options for grouping behavior
 */
export interface GroupingConfig {
  mode: GroupingMode;
  caseSensitive: boolean; // Whether description matching is case-sensitive
  includeTime: boolean; // Whether to include time in date grouping
  minGroupSize: number; // Minimum transactions required to form a group
}

/**
 * Result type for grouping operations with metadata
 */
export interface GroupingResult {
  groups: TransactionGroup[];
  metrics: GroupingMetrics;
  config: GroupingConfig;
  timestamp: number;
}