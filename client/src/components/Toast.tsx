import { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { AIProvider } from '../types';

const ALL_PROVIDERS: AIProvider[] = ['claude', 'chatgpt', 'gemini'];

export const providerDisplayNames: Record<AIProvider, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
  actions?: ToastAction[];
}

interface ToastContextValue {
  showToast: (message: string, type?: Toast['type']) => void;
  showProviderError: (
    provider: AIProvider,
    message: string,
    onRetry: () => void,
    onSwitch: (provider: AIProvider) => void,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'error') => { addToast({ message, type }); },
    [addToast],
  );

  const showProviderError = useCallback(
    (provider: AIProvider, message: string, onRetry: () => void, onSwitch: (p: AIProvider) => void) => {
      const otherProviders = ALL_PROVIDERS.filter((p) => p !== provider);
      const displayName = providerDisplayNames[provider];
      addToast({
        message: `${displayName} error: ${message}`,
        type: 'error',
        actions: [
          { label: 'Retry', onClick: onRetry },
          ...otherProviders.map((op) => ({
            label: `Switch to ${providerDisplayNames[op]}`,
            onClick: () => onSwitch(op),
          })),
        ],
      });
    },
    [addToast],
  );

  return (
    <ToastContext.Provider value={{ showToast, showProviderError }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-[calc(100vw-2rem)]"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const toastAlertClass: Record<Toast['type'], string> = {
  error: 'alert-error',
  success: 'alert-success',
  info: 'alert-info',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!toast.actions?.length) {
      timerRef.current = setTimeout(onDismiss, 5000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [onDismiss, toast.actions]);

  return (
    <div
      role="alert"
      className={`alert ${toastAlertClass[toast.type]} shadow-lg max-w-sm text-sm`}
    >
      <div className="flex justify-between items-start gap-2 w-full">
        <span>{toast.message}</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="btn btn-ghost btn-xs btn-circle flex-shrink-0"
        >
          ✕
        </button>
      </div>
      {toast.actions && toast.actions.length > 0 && (
        <div className="flex gap-2 mt-2">
          {toast.actions.map((action) => (
            <button
              key={action.label}
              onClick={() => { action.onClick(); onDismiss(); }}
              className="btn btn-sm btn-outline btn-ghost"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
