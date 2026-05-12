import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import {
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiInformationFill,
} from '@remixicon/react';
import { cn } from '@/lib/cn';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id:      number;
  message: string;
  type:    ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_TTL = 2500;
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DEFAULT_TTL);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4"
        style={{ top: 'calc(var(--header-safe-top) + 8px)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'inline-flex items-center gap-2 max-w-sm px-3.5 py-2.5 rounded-2xl shadow-lg backdrop-blur-md',
              'text-sm font-medium font-display pointer-events-auto',
              'animate-[toastIn_220ms_ease-out]',
              t.type === 'success' && 'bg-success/95 text-white',
              t.type === 'error'   && 'bg-danger/95 text-white',
              t.type === 'info'    && 'bg-neutral-900/92 text-white',
            )}
          >
            <ToastIcon type={t.type} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'success') return <RiCheckboxCircleFill size={18} className="shrink-0" />;
  if (type === 'error')   return <RiErrorWarningFill   size={18} className="shrink-0" />;
  return <RiInformationFill size={18} className="shrink-0" />;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Toast'siz ham silent fallback — provider o'rashidan oldin chaqirilsa
    return { show: () => { /* no-op */ } };
  }
  return ctx;
}
