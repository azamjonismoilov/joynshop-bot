import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'orange' | 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple';
export type BadgeSize    = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?:    BadgeSize;
  solid?:   boolean;
  pill?:    boolean;
  icon?:    ReactNode;
}

// Subtle styles — translucent bg + dark text
const SUBTLE: Record<BadgeVariant, string> = {
  orange: 'bg-brand-subtle     text-brand',
  blue:   'bg-secondary-subtle text-secondary',
  green:  'bg-success-subtle   text-success',
  red:    'bg-danger-subtle    text-danger',
  yellow: 'bg-warning-subtle   text-neutral-900',
  gray:   'bg-neutral-100      text-neutral-700',
  purple: 'bg-purple-subtle    text-purple',
};

// Solid styles — full bg + light text
const SOLID: Record<BadgeVariant, string> = {
  orange: 'bg-brand     text-brand-fg',
  blue:   'bg-secondary text-secondary-fg',
  green:  'bg-success   text-success-fg',
  red:    'bg-danger    text-danger-fg',
  yellow: 'bg-warning   text-warning-fg',
  gray:   'bg-neutral-700 text-neutral-0',
  purple: 'bg-purple    text-purple-fg',
};

const SIZE: Record<BadgeSize, string> = {
  sm: 'h-5 px-2   text-xs gap-1',
  md: 'h-6 px-2.5 text-xs gap-1',
  lg: 'h-7 px-3   text-sm gap-1.5',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'gray', size = 'md', solid, pill, icon, className, children, ...rest },
  ref,
) {
  const colorStyles = solid ? SOLID[variant] : SUBTLE[variant];
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium font-display whitespace-nowrap',
        colorStyles,
        SIZE[size],
        pill ? 'rounded-full' : 'rounded-badge',
        className,
      )}
      {...rest}
    >
      {icon && <span className="inline-flex items-center" aria-hidden>{icon}</span>}
      {children}
    </span>
  );
});
