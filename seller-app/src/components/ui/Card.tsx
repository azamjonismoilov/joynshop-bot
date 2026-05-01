import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'default' | 'elevated';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
}

const VARIANT: Record<CardVariant, string> = {
  default:  'bg-bg-1 border border-border',
  elevated: 'bg-bg-1 shadow-md',
};

const PADDING: Record<CardPadding, string> = {
  none: 'p-0',
  sm:   'p-3',   // 12px
  md:   'p-4',   // 16px
  lg:   'p-6',   // 24px
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-card',
        VARIANT[variant],
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});
