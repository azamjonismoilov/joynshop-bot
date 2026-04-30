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
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready(): void;
        expand(): void;
        close(): void;
        openTelegramLink(url: string): void;
        BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
        MainButton: { show(): void; hide(): void; setText(text: string): void; onClick(cb: () => void): void };
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        initData: string;
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
