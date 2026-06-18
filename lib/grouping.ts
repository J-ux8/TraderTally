/**
 * Transaction Grouping Engine
 * 
 * Implements efficient O(n) transaction grouping algorithm that groups transactions
 * by description, category, and date while preserving individual transaction records.
 */

import { 
  Transaction, 
  TransactionGroup, 
  GroupingEngine, 
  GroupingKey, 
  GroupingMetrics,
  GroupingConfig,
  GroupingMode,
  GroupingResult
} from '@/types/grouping';

/**
 * Default configuration for transaction grouping
 */
const DEFAULT_GROUPING_CONFIG: GroupingConfig = {
  mode: GroupingMode.GROUPED,
  caseSensitive: true,
  includeTime: false,
  minGroupSize: 1
};

/**
 * Core grouping engine implementation
 */
export class TransactionGroupingEngine implements GroupingEngine {
  private config: GroupingConfig;

  constructor(config: Partial<GroupingConfig> = {}) {
    this.config = { ...DEFAULT_GROUPING_CONFIG, ...config };
  }

  /**
   * Groups transactions using efficient Map-based algorithm
   * Time Complexity: O(n) where n = number of transactions
   * Space Complexity: O(n) for group storage
   */
  groupTransactions(transactions: Transaction[]): TransactionGroup[] {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    const groupMap = new Map<string, Transaction[]>();
    
    // O(n) grouping pass - single iteration through transactions
    for (const transaction of transactions) {
      try {
        const key = this.generateGroupKey(transaction);
        
        if (!groupMap.has(key)) {
          groupMap.set(key, []);
        }
        
        groupMap.get(key)!.push(transaction);
      } catch (error) {
        console.warn('Error processing transaction for grouping:', transaction.id, error);
        // Skip invalid transactions but continue processing
        continue;
      }
    }
    
    // O(g) group creation where g = number of groups (g <= n)
    const groups: TransactionGroup[] = [];
    
    for (const [key, groupTransactions] of groupMap.entries()) {
      try {
        // Only create groups that meet minimum size requirement
        if (groupTransactions.length >= this.config.minGroupSize) {
          const group = this.createGroup(key, groupTransactions);
          groups.push(group);
        }
      } catch (error) {
        console.warn('Error creating group for key:', key, error);
        continue;
      }
    }
    
    // Sort groups by date (newest first) and then by total amount (highest first)
    return groups.sort((a, b) => {
      const dateComparison = b.date.localeCompare(a.date);
      if (dateComparison !== 0) return dateComparison;
      return b.totalAmount - a.totalAmount;
    });
  }

  /**
   * Generates deterministic composite key for grouping
   * Format: "description|category|date"
   */
  generateGroupKey(transaction: Transaction): string {
    if (!transaction) {
      throw new Error('Transaction is required for key generation');
    }

    // Extract date component (YYYY-MM-DD) from transaction_date
    const date = this.extractDateComponent(transaction.transaction_date);
    
    // Handle description with case sensitivity setting
    const description = this.config.caseSensitive 
      ? (transaction.description || 'null')
      : (transaction.description || 'null').toLowerCase();
    
    // Handle category (always case-sensitive for categories)
    const category = transaction.linked_sale_id ? 'sale' : (transaction.category || 'null');
    
    // Create composite key with pipe separator
    return `${description}|${category}|${date}`;
  }

  /**
   * Creates a TransactionGroup from key and transactions
   */
  createGroup(key: string, transactions: Transaction[]): TransactionGroup {
    if (!key || !transactions || transactions.length === 0) {
      throw new Error('Valid key and transactions are required for group creation');
    }

    // Parse key components
    const [description, category, date] = key.split('|');
    
    // Calculate aggregated values
    const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const transactionCount = transactions.length;
    
    // Sort transactions within group by time (chronological order)
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    
    // Generate unique group ID from key hash
    const groupId = this.generateGroupId(key);
    
    return {
      id: groupId,
      description: description === 'null' ? null : description,
      category: category === 'null' ? null : category,
      date,
      totalAmount,
      transactionCount,
      transactions: sortedTransactions,
      groupKey: key
    };
  }

  /**
   * Extracts date component (YYYY-MM-DD) from transaction date string
   */
  private extractDateComponent(transactionDate: string): string {
    try {
      // Handle various date formats
      const date = new Date(transactionDate);
      
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date format: ${transactionDate}`);
      }
      
      // Return date in YYYY-MM-DD format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn('Error parsing transaction date:', transactionDate, error);
      // Fallback to current date
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  /**
   * Generates unique group ID from grouping key
   */
  private generateGroupId(key: string): string {
    // Simple hash function for generating consistent IDs
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `group_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Calculates grouping metrics for performance monitoring
   */
  calculateMetrics(transactions: Transaction[], groups: TransactionGroup[]): GroupingMetrics {
    if (groups.length === 0) {
      return {
        totalGroups: 0,
        averageGroupSize: 0,
        largestGroup: {} as TransactionGroup,
        groupingEfficiency: 0,
        processingTime: 0
      };
    }

    const totalTransactions = transactions.length;
    const totalGroups = groups.length;
    const averageGroupSize = totalTransactions / totalGroups;
    
    // Find largest group by transaction count
    const largestGroup = groups.reduce((largest, current) => 
      current.transactionCount > largest.transactionCount ? current : largest
    );
    
    // Calculate efficiency as reduction ratio
    const groupingEfficiency = totalGroups > 0 ? 1 - (totalGroups / totalTransactions) : 0;
    
    return {
      totalGroups,
      averageGroupSize,
      largestGroup,
      groupingEfficiency,
      processingTime: 0 // Will be set by caller
    };
  }

  /**
   * Main grouping function with performance monitoring
   */
  groupTransactionsWithMetrics(transactions: Transaction[]): GroupingResult {
    const startTime = performance.now();
    
    const groups = this.groupTransactions(transactions);
    const metrics = this.calculateMetrics(transactions, groups);
    
    const endTime = performance.now();
    metrics.processingTime = endTime - startTime;
    
    return {
      groups,
      metrics,
      config: this.config,
      timestamp: Date.now()
    };
  }

  /**
   * Updates grouping configuration
   */
  updateConfig(newConfig: Partial<GroupingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets current grouping configuration
   */
  getConfig(): GroupingConfig {
    return { ...this.config };
  }
}

/**
 * Default grouping engine instance
 */
export const defaultGroupingEngine = new TransactionGroupingEngine();

/**
 * Utility function for quick transaction grouping
 */
export function groupTransactions(transactions: Transaction[]): TransactionGroup[] {
  return defaultGroupingEngine.groupTransactions(transactions);
}

/**
 * Utility function for finding a group by key
 */
export function findGroupByKey(groups: TransactionGroup[], key: string): TransactionGroup | undefined {
  return groups.find(group => group.groupKey === key);
}

/**
 * Utility function for finding a group by ID
 */
export function findGroupById(groups: TransactionGroup[], id: string): TransactionGroup | undefined {
  return groups.find(group => group.id === id);
}

/**
 * Utility function for getting transactions for a specific date
 */
export function getTransactionsForDate(transactions: Transaction[], date: string): Transaction[] {
  return transactions.filter(tx => {
    const txDate = defaultGroupingEngine['extractDateComponent'](tx.transaction_date);
    return txDate === date;
  });
}

/**
 * Utility function for getting groups for a specific date
 */
export function getGroupsForDate(groups: TransactionGroup[], date: string): TransactionGroup[] {
  return groups.filter(group => group.date === date);
}