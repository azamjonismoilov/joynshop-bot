import { useState, type ReactNode } from 'react';
import { RiArrowDownSLine } from '@remixicon/react';
import { cn } from '@/lib/cn';

export interface CollapseSectionProps {
  title:        string;
  subtitle?:    string;
  defaultOpen?: boolean;
  children:     ReactNode;
  className?:   string;
}

export function CollapseSection({
  title, subtitle, defaultOpen = false, children, className,
}: CollapseSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn('bg-bg-1 rounded-card border border-border', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-fg-1">{title}</p>
          {subtitle && (
            <p className="text-xs text-fg-3 font-body mt-0.5">{subtitle}</p>
          )}
        </div>
        <RiArrowDownSLine
          size={20}
          className={cn('text-fg-3 shrink-0 transition-transform duration-base', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}
