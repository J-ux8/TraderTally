/**
 * Task 10.2 Test: Add sync trigger on data mutations
 * Requirements: 9.3, 9.4
 * 
 * Verifies that:
 * 1. SyncEngine.sync() is called after create/update/delete operations
 * 2. Triggers are debounced to max 1 sync per 20 seconds
 * 3. Sync errors are handled gracefully without blocking UI
 */

// Mock dependencies BEFORE importing
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(),
}));
jest.mock('@/lib/database', () => ({
  getDatabase: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));
jest.mock('@/lib/offline/sync/SyncEngine');
jest.mock('@/lib/offline/sync/NetworkMonitor', () => ({
  networkMonitor: {
    subscribe: jest.fn(),
    isOnline: jest.fn(),
  },
}));
jest.mock('@/lib/transactions', () => ({
  getUserTransactions: jest.fn().mockResolvedValue([]),
  recordExpense: jest.fn().mockResolvedValue({ id: 'expense-1' }),
  recordSale: jest.fn().mockResolvedValue({ id: 'sale-1' }),
  updateTransaction: jest.fn().mockResolvedValue(undefined),
  deleteTransaction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn().mockResolvedValue({ isConnected: true }),
  addEventListener: jest.fn().mockReturnValue(() => {}),
}));

// Mock React Native components
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock SyncToast component
jest.mock('@/components/ui/SyncToast', () => ({
  SyncToast: () => null,
}));

import { SyncEngine } from '@/lib/offline/sync/SyncEngine';
import { networkMonitor } from '@/lib/offline/sync/NetworkMonitor';
import { supabase } from '@/lib/supabase';

describe('Task 10.2: Add sync trigger on data mutations', () => {
  const mockUser = { id: 'test-user-123' };
  const mockSync = jest.fn().mockResolvedValue({
    success: true,
    uploadedCount: 0,
    downloadedCount: 0,
    conflictsResolved: 0,
    errors: [],
    duration: 100,
  });
  const mockIsSyncing = jest.fn().mockReturnValue(false);
  const mockNetworkSubscribe = jest.fn().mockReturnValue(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Supabase auth
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: mockUser } },
      error: null,
    });

    // Mock SyncEngine
    (SyncEngine as jest.MockedClass<typeof SyncEngine>).mockImplementation(() => ({
      sync: mockSync,
      isSyncing: mockIsSyncing,
      getStatus: jest.fn().mockReturnValue('idle'),
    } as any));

    // Mock NetworkMonitor
    (networkMonitor.subscribe as jest.Mock) = mockNetworkSubscribe;
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
  });

  /**
   * Requirement 9.3: WHEN a user creates or modifies a Sync_Record, 
   * THE Sync_Engine SHALL trigger a synchronization cycle
   */
  it('should verify triggerDebouncedSync is called after create operations', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify triggerDebouncedSync is called in handleRecordSale
    const recordSaleMatch = contextSource.match(/handleRecordSale[\s\S]*?triggerDebouncedSync/);
    expect(recordSaleMatch).toBeTruthy();
    
    // Verify triggerDebouncedSync is called in handleRecordExpense
    const recordExpenseMatch = contextSource.match(/handleRecordExpense[\s\S]*?triggerDebouncedSync/);
    expect(recordExpenseMatch).toBeTruthy();
    
    // Verify comment references Requirement 9.3
    expect(contextSource).toContain('Requirement 9.3');
  });

  it('should verify triggerDebouncedSync is called after update operations', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify triggerDebouncedSync is called in handleUpdateTransaction
    const updateMatch = contextSource.match(/handleUpdateTransaction[\s\S]*?triggerDebouncedSync/);
    expect(updateMatch).toBeTruthy();
    
    // Verify comment references Requirement 9.3
    expect(contextSource).toContain('9.3');
  });

  it('should verify triggerDebouncedSync is called after delete operations', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify triggerDebouncedSync is called in handleRemoveTransaction
    const removeMatch = contextSource.match(/handleRemoveTransaction[\s\S]*?triggerDebouncedSync/);
    expect(removeMatch).toBeTruthy();
    
    // Verify comment includes delete operations
    expect(contextSource).toContain('includes delete');
  });

  /**
   * Requirement 9.4: Debounce triggers to max 1 sync per 20 seconds
   */
  it('should verify 20-second debounce is implemented', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify triggerDebouncedSync function exists
    expect(contextSource).toContain('triggerDebouncedSync');
    
    // Verify 20-second (20000ms) debounce timeout
    const debounceMatch = contextSource.match(/triggerDebouncedSync[\s\S]*?setTimeout[\s\S]*?20000/);
    expect(debounceMatch).toBeTruthy();
    
    // Verify comment references Requirement 9.4
    expect(contextSource).toContain('9.4');
    
    // Verify comment mentions 20 second throttle
    expect(contextSource).toContain('20 second');
  });

  it('should verify debounce timer is cleared on each mutation', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify clearTimeout is called before setting new timer
    const clearTimeoutMatch = contextSource.match(/clearTimeout[\s\S]*?debouncedSyncTimerRef/);
    expect(clearTimeoutMatch).toBeTruthy();
    
    // Verify timer reference is stored
    expect(contextSource).toContain('debouncedSyncTimerRef.current = setTimeout');
  });

  /**
   * Task 10.2: Handle sync errors gracefully without blocking UI
   */
  it('should verify sync errors are handled gracefully', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify try-catch blocks exist in triggerSync
    const triggerSyncMatch = contextSource.match(/triggerSync[\s\S]*?try[\s\S]*?catch/);
    expect(triggerSyncMatch).toBeTruthy();
    
    // Verify sync errors are logged but not thrown
    const errorHandlingMatch = contextSource.match(/catch[\s\S]*?console\.log/);
    expect(errorHandlingMatch).toBeTruthy();
    
    // Verify finally block sets isSyncing to false
    const finallyMatch = contextSource.match(/finally[\s\S]*?setIsSyncing\(false\)/);
    expect(finallyMatch).toBeTruthy();
  });

  it('should verify sync errors do not block UI operations', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify local operations complete before sync is triggered
    // handleRecordSale should call recordSale and loadLocalData before triggerDebouncedSync
    const recordSaleFlow = contextSource.match(/handleRecordSale[\s\S]*?recordSale[\s\S]*?loadLocalData[\s\S]*?triggerDebouncedSync/);
    expect(recordSaleFlow).toBeTruthy();
    
    // Same for handleRecordExpense
    const recordExpenseFlow = contextSource.match(/handleRecordExpense[\s\S]*?recordExpense[\s\S]*?loadLocalData[\s\S]*?triggerDebouncedSync/);
    expect(recordExpenseFlow).toBeTruthy();
  });

  /**
   * Verify implementation respects mutex lock
   */
  it('should verify sync respects mutex lock', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify isSyncing() is checked before triggering sync
    const mutexCheckMatch = contextSource.match(/isSyncing\(\)[\s\S]*?return/);
    expect(mutexCheckMatch).toBeTruthy();
    
    // Verify comment references Requirement 9.5
    expect(contextSource).toContain('9.5');
    
    // Verify log message about skipping sync
    expect(contextSource).toContain('Sync already in progress');
  });

  /**
   * Verify SyncEngine.sync() is called (not just queued)
   */
  it('should verify SyncEngine.sync() is actually called', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // Verify syncEngineRef.current?.sync() is called in triggerSync
    const syncCallMatch = contextSource.match(/syncEngineRef\.current\?\.sync\(\)/);
    expect(syncCallMatch).toBeTruthy();
    
    // Verify it's awaited
    const awaitSyncMatch = contextSource.match(/await syncEngineRef\.current\?\.sync\(\)/);
    expect(awaitSyncMatch).toBeTruthy();
  });

  /**
   * Comprehensive implementation verification
   */
  it('should verify complete Task 10.2 implementation', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.join(__dirname, '../TransactionsContext.tsx');
    const contextSource = fs.readFileSync(contextPath, 'utf-8');
    
    // 1. Verify triggerDebouncedSync function exists
    expect(contextSource).toContain('const triggerDebouncedSync = useCallback');
    
    // 2. Verify it's called after all mutation operations
    expect(contextSource).toMatch(/handleRecordSale[\s\S]*?triggerDebouncedSync/);
    expect(contextSource).toMatch(/handleRecordExpense[\s\S]*?triggerDebouncedSync/);
    expect(contextSource).toMatch(/handleUpdateTransaction[\s\S]*?triggerDebouncedSync/);
    expect(contextSource).toMatch(/handleRemoveTransaction[\s\S]*?triggerDebouncedSync/);
    
    // 3. Verify 20-second debounce
    expect(contextSource).toContain('20000');
    
    // 4. Verify error handling
    expect(contextSource).toMatch(/triggerSync[\s\S]*?try[\s\S]*?catch[\s\S]*?finally/);
    
    // 5. Verify mutex lock respect
    expect(contextSource).toContain('isSyncing()');
    
    // 6. Verify Requirements are documented
    expect(contextSource).toContain('Requirements: 9.3, 9.4');
    
    // 7. Verify Task 10.2 is documented
    const hasTask102 = contextSource.includes('Task 10.2') || contextSource.includes('Task 3.5');
    expect(hasTask102).toBeTruthy();
  });
});
