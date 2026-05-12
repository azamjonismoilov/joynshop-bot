// Telegram WebApp SDK helpers — buyer-app.
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

/** Mini App ichidamizmi? (initData mavjud bo'lsa — ha) */
export function isInTelegram(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
}

// Native Telegram WebApp API'lar
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
        openInvoice(url: string, cb?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void): void;
        BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
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
        HapticFeedback?: {
          impactOccurred(style: TgHapticImpactStyle): void;
          notificationOccurred(type: TgHapticNotificationType): void;
          selectionChanged(): void;
        };
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        initData: string;
        initDataUnsafe?: {
          user?:        TgUser;
          start_param?: string;
        };
        contentSafeAreaInset?: TgSafeAreaInset;
        safeAreaInset?:        TgSafeAreaInset;
        isFullscreen?:         boolean;
        isExpanded?:           boolean;
        viewportHeight?:       number;
        viewportStableHeight?: number;
        onEvent?:  (eventName: string, handler: () => void) => void;
        offEvent?: (eventName: string, handler: () => void) => void;
        requestFullscreen?: () => void;
        exitFullscreen?:    () => void;
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

/** Telegram orqali xaridor botni ochish — deep link bilan */
export function openBuyerBotDeeplink(action: string) {
  const botUsername = import.meta.env.VITE_BUYER_BOT_USERNAME || 'joynshop_bot';
  const url = `https://t.me/${botUsername}?start=${action}`;
  const tg = tgWebApp();
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, '_blank');
}
