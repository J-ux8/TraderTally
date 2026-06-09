/**
 * Transaction Wrappers with Error Logging
 * 
 * This module wraps critical transaction functions with error logging
 * All existing functionality is preserved, errors are just logged
 */

import * as Transactions from './transactions';
import * as Debts from './debts';
import ErrorLogger from './errorLogger';

/**
 * Wrapped recordExpense - logs errors but re-throws for caller
 */
export async function recordExpenseWithLogging(
  amount: number,
  category: string | null,
  description: string | null,
  date?: string,
  customerId?: string
) {
  try {
    return await Transactions.recordExpense(amount, category, description, date, customerId);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'recordExpense',
      amount,
      category,
      hasDescription: !!description,
    });
    throw error; // Re-throw so caller can handle
  }
}

/**
 * Wrapped recordSale - logs errors but re-throws for caller
 */
export async function recordSaleWithLogging(
  amount: number,
  category: string | null,
  description: string | null,
  date?: string,
  customerId?: string,
  linkedSaleId?: string
) {
  try {
    return await Transactions.recordSale(amount, category, description, date, customerId, linkedSaleId);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'recordSale',
      amount,
      category,
      hasDescription: !!description,
    });
    throw error;
  }
}

/**
 * Wrapped updateTransaction - logs errors but re-throws for caller
 */
export async function updateTransactionWithLogging(
  id: string,
  amount: number,
  category: string | null,
  description: string | null,
  date?: string,
  customerId?: string
) {
  try {
    return await Transactions.updateTransaction(id, amount, category, description, date, customerId);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'updateTransaction',
      transactionId: id,
      amount,
      category,
    });
    throw error;
  }
}

/**
 * Wrapped getUserTransactions - logs errors but re-throws for caller
 */
export async function getUserTransactionsWithLogging(limit?: number, offset?: number) {
  try {
    return await Transactions.getUserTransactions(limit, offset);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'getUserTransactions',
      limit,
      offset,
    });
    throw error;
  }
}

/**
 * Wrapped getUserDebts - logs errors but re-throws for caller
 */
export async function getUserDebtsWithLogging(limit?: number, offset?: number) {
  try {
    return await Debts.getUserDebts(limit, offset);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'getUserDebts',
      limit,
      offset,
    });
    throw error;
  }
}

/**
 * Wrapped addDebt - logs errors but re-throws for caller
 */
export async function addDebtWithLogging(
  customer_name: string,
  amount: number,
  due_date?: string,
  note?: string,
  customer_phone?: string,
  type: 'receivable' | 'payable' = 'receivable'
) {
  try {
    return await Debts.addDebt(customer_name, amount, due_date, note, customer_phone, type);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'addDebt',
      customerName: customer_name,
      amount,
      type,
    });
    throw error;
  }
}

/**
 * Wrapped deleteTransaction - logs errors but re-throws for caller
 */
export async function deleteTransactionWithLogging(id: string) {
  try {
    return await Transactions.deleteTransaction(id);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'deleteTransaction',
      transactionId: id,
    });
    throw error;
  }
}

/**
 * Wrapped settleDebt - logs errors but re-throws for caller
 */
export async function settleDebtWithLogging(id: string) {
  try {
    return await Debts.settleDebt(id);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'settleDebt',
      debtId: id,
    });
    throw error;
  }
}

/**
 * Wrapped deleteDebt - logs errors but re-throws for caller
 */
export async function deleteDebtWithLogging(id: string) {
  try {
    return await Debts.deleteDebt(id);
  } catch (error) {
    await ErrorLogger.captureException(error as Error, {
      action: 'deleteDebt',
      debtId: id,
    });
    throw error;
  }
}

export default {
  recordExpenseWithLogging,
  recordSaleWithLogging,
  updateTransactionWithLogging,
  getUserTransactionsWithLogging,
  getUserDebtsWithLogging,
  addDebtWithLogging,
  deleteTransactionWithLogging,
  settleDebtWithLogging,
  deleteDebtWithLogging,
};
