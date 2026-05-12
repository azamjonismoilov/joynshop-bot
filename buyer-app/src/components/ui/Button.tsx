import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success';
export type ButtonSize    = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  pill?:      boolean;
  iconLeft?:  ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-fg hover:bg-brand-hover active:bg-brand-active ' +
    'disabled:bg-neutral-200 disabled:text-fg-disabled',
  secondary:
    'bg-secondary text-secondary-fg hover:bg-secondary-hover active:bg-secondary-active ' +
    'disabled:bg-neutral-200 disabled:text-fg-disabled',
  ghost:
    'bg-transparent text-fg-1 hover:bg-bg-3 active:bg-bg-muted ' +
    'disabled:text-fg-disabled disabled:hover:bg-transparent',
  outline:
    'bg-transparent text-fg-1 border border-border hover:bg-bg-2 active:bg-bg-3 ' +
    'disabled:text-fg-disabled disabled:border-border disabled:hover:bg-transparent',
  danger:
    'bg-danger text-danger-fg hover:bg-danger-hover ' +
    'disabled:bg-neutral-200 disabled:text-fg-disabled',
  success:
    'bg-success text-success-fg hover:bg-success-hover ' +
    'disabled:bg-neutral-200 disabled:text-fg-disabled',
};

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-7  px-2.5 text-xs  gap-1',
  sm: 'h-8  px-3   text-sm  gap-1.5',
  md: 'h-10 px-4   text-sm  gap-2',
  lg: 'h-12 px-5   text-base gap-2',
  xl: 'h-14 px-6   text-lg  gap-2.5',
};

const BASE =
  'inline-flex items-center justify-center font-medium font-display ' +
  'transition-colors duration-base ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg-1 ' +
  'disabled:cursor-not-allowed select-none whitespace-nowrap';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', pill, iconLeft, iconRight, fullWidth, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        BASE,
        VARIANT[variant],
        SIZE[size],
        pill ? 'rounded-full' : 'rounded-button',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {iconLeft && <span className="inline-flex items-center" aria-hidden>{iconLeft}</span>}
      {children}
      {iconRight && <span className="inline-flex items-center" aria-hidden>{iconRight}</span>}
    </button>
  );
});
