// Telegram WebApp SDK helpers — initData o'qish va native API'larga kirish.
// retrieveLaunchParams() Telegram launch parameter'larini qaytaradi.

import { retrieveLaunchParams } from '@telegram-apps/sdk-react';

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export function getInitDataRaw(): string {
  try {
    const params = retrieveLaunchParams();
    return (params as { initDataRaw?: string }).initDataRaw || '';
  } catch {
    return '';
  }
}

export function getTgUser(): TgUser | null {
  try {
    const params = retrieveLaunchParams();
    const user = (params as { initData?: { user?: TgUser } }).initData?.user;
    return user || null;
  } catch {
    return null;
  }
}

// window.Telegram.WebApp ham mavjud — native API'lar uchun ishlatamiz
export interface TgSafeAreaInset {
  top:    number;
  bottom: number;
  left:   number;
  right:  number;
}

export interface TgMainButtonParams {
  text?:       string;
  color?:      string;
  text_color?: string;
  is_active?:  boolean;
  is_visible?: boolean;
}

export type TgHapticImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type TgHapticNotificationType = 'success' | 'error' | 'warning';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void;
        expand(): void;
        close(): void;
        openTelegramLink(url: string): void;
        BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
        // MainButton — Bot API 6.0+, to'liq
        MainButton: {
          text:              string;
          color:             string;
          textColor:         string;
          isVisible:         boolean;
          isActive:          boolean;
          isProgressVisible: boolean;
          setText(text: string): void;
          onClick(cb: () => void): void;
          offClick(cb: () => void): void;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          showProgress(leaveActive?: boolean): void;
          hideProgress(): void;
          setParams(params: TgMainButtonParams): void;
        };
        // HapticFeedback — Bot API 6.1+ (optional, eski clientlarda undefined)
        HapticFeedback?: {
          impactOccurred(style: TgHapticImpactStyle): void;
          notificationOccurred(type: TgHapticNotificationType): void;
          selectionChanged(): void;
        };
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        initData: string;
        // Bot API 7.7+ / 7.10+ / 8.0+ (optional — eski Telegram larda undefined)
        contentSafeAreaInset?: TgSafeAreaInset;  // Bot API 7.10+
        safeAreaInset?:        TgSafeAreaInset;  // Bot API 7.7+
        isFullscreen?:         boolean;          // Bot API 8.0+
        isExpanded?:           boolean;
        viewportHeight?:       number;
        viewportStableHeight?: number;
        onEvent?:  (eventName: string, handler: () => void) => void;
        offEvent?: (eventName: string, handler: () => void) => void;
        requestFullscreen?: () => void;
        exitFullscreen?:    () => void;
        // Color API — Bot API 6.1+ / 7.10+
        setHeaderColor?:     (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        setBottomBarColor?:  (color: string) => void;
      };
    };
  }
}

export function tgWebApp() {
  return window.Telegram?.WebApp;
}

export function openSellerBotDeeplink(action: string) {
  // joynshop_seller_bot username — kelajakda env'dan olinishi mumkin
  const botUsername = import.meta.env.VITE_SELLER_BOT_USERNAME || 'joynshop_seller_bot';
  const url = `https://t.me/${botUsername}?start=${action}`;
  const tg = tgWebApp();
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}
