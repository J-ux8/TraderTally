import React, { createContext, useContext } from 'react';
import Toast, { ToastMessage } from '@/components/ui/Toast';
import { View } from 'react-native';
import { useToast } from '@/hooks/useToast';

interface ToastContextType {
  toasts: ToastMessage[];
  success: (title: string, options?: any) => void;
  error: (title: string, options?: any) => void;
  info: (title: string, options?: any) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toasts, success, error, info, dismiss } = useToast();

  return (
    <ToastContext.Provider value={{ toasts, success, error, info, dismiss }}>
      {children}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999, pointerEvents: 'none' }}>
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return context;
};
