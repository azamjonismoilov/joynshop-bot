/**
 * className parts qo'shish, falsy qiymatlarni filtrlash.
 *
 *   cn('btn', isActive && 'btn-active', disabled && 'opacity-50')
 *   → "btn btn-active opacity-50"
 */
export function cn(...parts: Array<string | false | undefined | null | 0>): string {
  return parts.filter(Boolean).join(' ');
}
