import { useCallback, useState } from 'react';
import { ToastMessage, ToastType } from '@/components/ui/Toast';

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback(
    (
      type: ToastType,
      title: string,
      options?: {
        message?: string;
        amount?: number;
        category?: string;
        duration?: number;
      }
    ) => {
      const id = Date.now().toString();
      const newToast: ToastMessage = {
        id,
        type,
        title,
        message: options?.message,
        amount: options?.amount,
        category: options?.category,
        duration: options?.duration || 3000,
      };

      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback(
    (
      title: string,
      options?: {
        message?: string;
        amount?: number;
        category?: string;
        duration?: number;
      }
    ) => {
      show('success', title, options);
    },
    [show]
  );

  const error = useCallback(
    (
      title: string,
      options?: {
        message?: string;
        amount?: number;
        category?: string;
        duration?: number;
      }
    ) => {
      show('error', title, options);
    },
    [show]
  );

  const info = useCallback(
    (
      title: string,
      options?: {
        message?: string;
        amount?: number;
        category?: string;
        duration?: number;
      }
    ) => {
      show('info', title, options);
    },
    [show]
  );

  return {
    toasts,
    show,
    success,
    error,
    info,
    dismiss,
  };
};
