import type {
  TgHapticImpactStyle,
  TgHapticNotificationType,
} from './telegram';

/**
 * Telegram HapticFeedback wrapper'lar.
 * Brauzer / eski Telegram clientlarda silent fail.
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
