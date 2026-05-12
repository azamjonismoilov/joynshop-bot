import { forwardRef, type HTMLAttributes, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'default' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?:     CardVariant;
  padding?:     CardPadding;
  /** Tap qabul qiladigan card — active scale, keyboard role.
   * onClick bilan birga ishlatiladi. */
  interactive?: boolean;
}

const VARIANT: Record<CardVariant, string> = {
  // Soft elevation — nozik border + minimal shadow (Wallet pattern)
  default:  'bg-bg-1 border border-border/60 shadow-xs',
  elevated: 'bg-bg-1 shadow-md',
};

const PADDING: Record<CardPadding, string> = {
  none: 'p-0',
  sm:   'p-3.5',   // 14px (eski 12px)
  md:   'p-5',     // 20px (eski 16px) — generous whitespace
  lg:   'p-6',     // 24px
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', interactive, className, children, onClick, onKeyDown, ...rest },
  ref,
) {
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
    }
    onKeyDown?.(e);
  };

  return (
    <div
      ref={ref}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKey : onKeyDown}
      className={cn(
        'rounded-card',
        VARIANT[variant],
        PADDING[padding],
        interactive && 'cursor-pointer active:scale-[0.98] transition-transform duration-fast hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
