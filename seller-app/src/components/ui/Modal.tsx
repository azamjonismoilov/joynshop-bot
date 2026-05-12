import { useEffect, type ReactNode } from 'react';
import { RiCloseFill } from '@remixicon/react';
import { cn } from '@/lib/cn';

export interface ModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  title?:    string;
  children:  ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  // ESC key + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-[fadeIn_120ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content */}
      <div
        className={cn(
          'relative bg-bg-1 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto',
          'animate-[scaleIn_140ms_ease-out]',
          className,
        )}
      >
        {title && (
          <div className="flex items-start justify-between px-5 pt-5 pb-3">
            <h2 id="modal-title" className="font-display text-lg font-semibold text-fg-1 pr-3">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Yopish"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md text-fg-3 hover:bg-bg-2 hover:text-fg-1 shrink-0"
            >
              <RiCloseFill size={20} />
            </button>
          </div>
        )}
        <div className={cn(title ? 'px-5 pb-5' : 'p-5')}>
          {children}
        </div>
      </div>
    </div>
  );
}
