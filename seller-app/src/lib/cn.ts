/**
 * Concatenate className parts, filtering out falsy values.
 * Lightweight alternative to clsx/classnames — no external dependency.
 *
 * Example:
 *   cn('btn', isActive && 'btn-active', disabled && 'opacity-50')
 *   → "btn btn-active opacity-50" (when both truthy)
 */
export function cn(...parts: Array<string | false | undefined | null | 0>): string {
  return parts.filter(Boolean).join(' ');
}
