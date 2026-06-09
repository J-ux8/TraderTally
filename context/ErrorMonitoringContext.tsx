/**
 * ErrorMonitoringContext
 * 
 * Global error monitoring context that tracks app-wide errors
 * and provides utilities for error handling
 * 
 * Usage:
 * const { errors, status, clearHistory } = useErrorMonitoring();
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import ErrorLogger from '@/lib/errorLogger';
import { ErrorQueue } from '@/lib/errorQueue';
import { NetworkMonitor } from '@/sync/NetworkMonitor';

interface ErrorMonitoringContextType {
  // Error tracking
  lastError: any | null;
  errorCount: number;
  queuedErrorCount: number;

  // Status
  status: {
    enabled: boolean;
    errorCount: number;
    unsentErrorCount: number;
    queueSize: number;
  };

  // Actions
  clearHistory: () => Promise<void>;
  processQueue: () => Promise<void>;
  getErrorHistory: (limit?: number) => Promise<any[]>;
  getQueuedErrors: (limit?: number) => Promise<any[]>;
  setUserContext: (userId: string) => Promise<void>;
}

const ErrorMonitoringContext = createContext<ErrorMonitoringContextType | null>(
  null
);

interface ErrorMonitoringProviderProps {
  children: React.ReactNode;
  enabled?: boolean;
}

/**
 * Error Monitoring Provider
 * Wrap your app with this to enable error monitoring
 * 
 * Usage:
 * <ErrorMonitoringProvider enabled={true}>
 *   <App />
 * </ErrorMonitoringProvider>
 */
export function ErrorMonitoringProvider({
  children,
  enabled = true,
}: ErrorMonitoringProviderProps) {
  const [status, setStatus] = useState({
    enabled: false,
    errorCount: 0,
    unsentErrorCount: 0,
    queueSize: 0,
  });

  const [lastError, setLastError] = useState<any>(null);

  /**
   * Initialize error monitoring on mount
   */
  useEffect(() => {
    if (!enabled) return;

    const initialize = async () => {
      try {
        console.log('[ErrorMonitoring] Initializing...');
        await ErrorLogger.initialize();
        await ErrorQueue.initialize();

        // Set up network listener for queue processing
        if (NetworkMonitor.getStatus()) {
          await ErrorQueue.processQueue();
        }

        // Update status
        const errorStatus = await ErrorLogger.getStatus();
        const queueSize = await ErrorQueue.getQueueSize();

        setStatus({
          enabled: true,
          errorCount: errorStatus.errorCount,
          unsentErrorCount: errorStatus.unsentErrorCount,
          queueSize,
        });

        setLastError(errorStatus.lastError);

        console.log('[ErrorMonitoring] ✅ Initialized');
      } catch (error) {
        console.error('[ErrorMonitoring] Initialization failed:', error);
      }
    };

    initialize();

    // Set up periodic status updates
    const statusInterval = setInterval(async () => {
      try {
        const errorStatus = await ErrorLogger.getStatus();
        const queueSize = await ErrorQueue.getQueueSize();

        setStatus({
          enabled: true,
          errorCount: errorStatus.errorCount,
          unsentErrorCount: errorStatus.unsentErrorCount,
          queueSize,
        });
      } catch (error) {
        console.error('[ErrorMonitoring] Status update failed:', error);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(statusInterval);
  }, [enabled]);

  /**
   * Set up network change listener
   */
  useEffect(() => {
    if (!enabled) return;

    // Listen for network changes and process queue when online
    const checkNetwork = async () => {
      if (NetworkMonitor.getStatus()) {
        console.log('[ErrorMonitoring] Network online, processing error queue');
        await ErrorQueue.processQueue();
      }
    };

    // Check immediately
    checkNetwork();

    // Check every 10 seconds
    const networkInterval = setInterval(checkNetwork, 10000);

    return () => clearInterval(networkInterval);
  }, [enabled]);

  /**
   * Clear error history
   */
  const clearHistory = useCallback(async () => {
    try {
      await ErrorLogger.clearHistory();
      setLastError(null);
      console.log('[ErrorMonitoring] History cleared');
    } catch (error) {
      console.error('[ErrorMonitoring] Failed to clear history:', error);
    }
  }, []);

  /**
   * Process queue
   */
  const processQueue = useCallback(async () => {
    try {
      await ErrorQueue.processQueue();
      const queueSize = await ErrorQueue.getQueueSize();
      setStatus(prev => ({ ...prev, queueSize }));
    } catch (error) {
      console.error('[ErrorMonitoring] Failed to process queue:', error);
    }
  }, []);

  /**
   * Get error history
   */
  const getErrorHistory = useCallback(
    async (limit?: number) => {
      return await ErrorLogger.getErrorHistory(limit);
    },
    []
  );

  /**
   * Get queued errors
   */
  const getQueuedErrors = useCallback(
    async (limit?: number) => {
      return await ErrorQueue.getQueuedErrors(limit);
    },
    []
  );

  /**
   * Set user context
   */
  const setUserContext = useCallback(async (userId: string) => {
    await ErrorLogger.setUserContext(userId);
  }, []);

  return (
    <ErrorMonitoringContext.Provider
      value={{
        lastError,
        errorCount: status.errorCount,
        queuedErrorCount: status.unsentErrorCount,
        status,
        clearHistory,
        processQueue,
        getErrorHistory,
        getQueuedErrors,
        setUserContext,
      }}
    >
      {children}
    </ErrorMonitoringContext.Provider>
  );
}

/**
 * useErrorMonitoring Hook
 * 
 * Usage:
 * const { errors, status } = useErrorMonitoring();
 */
export function useErrorMonitoring() {
  const context = useContext(ErrorMonitoringContext);

  if (!context) {
    console.warn(
      '[useErrorMonitoring] Called outside ErrorMonitoringProvider'
    );
    return {
      lastError: null,
      errorCount: 0,
      queuedErrorCount: 0,
      status: {
        enabled: false,
        errorCount: 0,
        unsentErrorCount: 0,
        queueSize: 0,
      },
      clearHistory: async () => {},
      processQueue: async () => {},
      getErrorHistory: async () => [],
      getQueuedErrors: async () => [],
      setUserContext: async () => {},
    };
  }

  return context;
}

export default ErrorMonitoringContext;
