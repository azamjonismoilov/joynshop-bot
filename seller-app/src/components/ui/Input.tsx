import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type InputSize = 'sm' | 'md' | 'lg' | 'xl';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: InputSize;
  iconLeft?:  ReactNode;
  suffix?:    ReactNode;
  label?:     string;
  hint?:      string;
  error?:     string;
  fullWidth?: boolean;
}

const SIZE_HEIGHT: Record<InputSize, string> = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
  xl: 'h-14',
};

const SIZE_TEXT: Record<InputSize, string> = {
  sm: 'text-sm',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    inputSize = 'md',
    iconLeft,
    suffix,
    label,
    hint,
    error,
    fullWidth,
    disabled,
    className,
    id: idProp,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const id = idProp || autoId;
  const hasError = Boolean(error);

  return (
    <div className={cn('flex flex-col gap-1', fullWidth && 'w-full')}>
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-fg-2 font-display"
        >
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2 px-3 bg-bg-1 border rounded-input transition-colors duration-base',
          SIZE_HEIGHT[inputSize],
          hasError ? 'border-danger' : 'border-border',
          // Focus-within ring on the wrapper
          !disabled && !hasError &&
            'focus-within:border-border-focus focus-within:ring-2 focus-within:ring-brand-subtle',
          !disabled && hasError &&
            'focus-within:ring-2 focus-within:ring-danger-subtle',
          disabled && 'bg-bg-2 cursor-not-allowed',
        )}
      >
        {iconLeft && (
          <span className="inline-flex items-center text-fg-3 shrink-0" aria-hidden>
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={(hint || error) ? `${id}-desc` : undefined}
          className={cn(
            'flex-1 min-w-0 bg-transparent outline-none placeholder:text-fg-4 font-body',
            SIZE_TEXT[inputSize],
            disabled ? 'text-fg-disabled cursor-not-allowed' : 'text-fg-1',
          )}
          {...rest}
        />
        {suffix && (
          <span className="inline-flex items-center text-fg-3 shrink-0" aria-hidden>
            {suffix}
          </span>
        )}
      </div>
      {(hint || error) && (
        <p
          id={`${id}-desc`}
          className={cn(
            'text-xs font-body',
            hasError ? 'text-danger' : 'text-fg-3',
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
});
