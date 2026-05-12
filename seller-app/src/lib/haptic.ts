import type {
  TgHapticImpactStyle,
  TgHapticNotificationType,
} from './telegram';

/**
 * Telegram HapticFeedback wrapper'lar.
 * Eski Telegram clientlar / desktop / brauzer'da silent fail qiladi.
 */

export function hapticImpact(style: TgHapticImpactStyle = 'light'): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {
    // silent fail
  }
}

export function hapticNotify(type: TgHapticNotificationType): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
  } catch {
    // silent fail
  }
}

export function hapticSelection(): void {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    // silent fail
  }
}
