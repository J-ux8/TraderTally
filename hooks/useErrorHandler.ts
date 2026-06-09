/**
 * useErrorHandler Hook
 * 
 * Easy way to handle errors in React components
 * 
 * Usage:
 * const { captureError, captureWarning } = useErrorHandler();
 * 
 * try {
 *   await saveData();
 * } catch (error) {
 *   captureError(error, { action: 'saveData' });
 *   showUserMessage('Failed to save');
 * }
 */

import { useCallback } from 'react';
import ErrorLogger from '@/lib/errorLogger';

interface ErrorContext {
  userId?: string;
  screen?: string;
  action?: string;
  [key: string]: any;
}

export function useErrorHandler() {
  /**
   * Capture and log an error
   */
  const captureError = useCallback(
    async (error: Error | unknown, context?: ErrorContext) => {
      try {
        if (error instanceof Error) {
          await ErrorLogger.captureException(error, context);
        } else {
          await ErrorLogger.captureException(
            new Error(String(error)),
            context
          );
        }
      } catch (err) {
        console.error('[useErrorHandler] Failed to capture error:', err);
      }
    },
    []
  );

  /**
   * Capture a warning
   */
  const captureWarning = useCallback(
    async (message: string, context?: ErrorContext) => {
      try {
        await ErrorLogger.captureWarning(message, context);
      } catch (err) {
        console.error('[useErrorHandler] Failed to capture warning:', err);
      }
    },
    []
  );

  /**
   * Capture info message
   */
  const captureInfo = useCallback(
    async (message: string, context?: ErrorContext) => {
      try {
        await ErrorLogger.captureInfo(message, context);
      } catch (err) {
        console.error('[useErrorHandler] Failed to capture info:', err);
      }
    },
    []
  );

  /**
   * Wrap a function to automatically capture errors
   */
  const withErrorCapture = useCallback(
    <T extends (...args: any[]) => Promise<any>>(
      fn: T,
      context?: ErrorContext
    ): T => {
      return (async (...args: any[]) => {
        try {
          return await fn(...args);
        } catch (error) {
          await captureError(error, context);
          throw error; // Re-throw so caller can handle if needed
        }
      }) as T;
    },
    [captureError]
  );

  return {
    captureError,
    captureWarning,
    captureInfo,
    withErrorCapture,
  };
}

export default useErrorHandler;
