import { useEffect, useState } from 'react';

export type Platform = 'telegram' | 'pwa' | 'browser';

/**
 * Foydalanuvchi qaysi muhitda Mini App'ni ochganini aniqlaydi.
 *
 * - `telegram` — Telegram WebApp (initData mavjud). Mobil, desktop, web —
 *   barchasi bir xil (Telegram o'z chrome'ini boshqaradi).
 * - `pwa` — "Add to home screen" qilingan (standalone display mode). iOS
 *   `navigator.standalone` ham qo'shimcha tekshiriladi.
 * - `browser` — oddiy brauzer tab/window.
 *
 * Telegram tekshiruvi birinchi bo'lishi shart: PWA installed bo'lsa-yu,
 * lekin Telegram link orqali ochilgan bo'lsa, initData mavjud — telegram
 * priority oladi.
 */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>(() => detect());

  useEffect(() => {
    // Mount paytida qayta hisoblash (SSR fallback'idan keyin)
    setPlatform(detect());

    // Display-mode o'zgarishi (PWA install qilinganda yoki olib tashlanganda)
    const mq = window.matchMedia?.('(display-mode: standalone)');
    if (!mq) return;
    const handler = () => setPlatform(detect());
    try { mq.addEventListener('change', handler); } catch { mq.addListener?.(handler); }
    return () => {
      try { mq.removeEventListener('change', handler); } catch { mq.removeListener?.(handler); }
    };
  }, []);

  return platform;
}

function detect(): Platform {
  if (typeof window === 'undefined') return 'browser';

  // 1. Telegram — initData mavjud bo'lsa
  if (window.Telegram?.WebApp?.initData) return 'telegram';

  // 2. PWA standalone — Android Chrome / desktop Chrome / iOS Safari (alohida property)
  const standaloneIOS = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const standaloneDM  = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  if (standaloneIOS || standaloneDM) return 'pwa';

  return 'browser';
}

/**
 * Joynshop app header'ini ko'rsatish shartlari.
 * Telegram va PWA'da o'zining chrome'i bor — dublikat oldini olamiz.
 */
export function useShouldShowHeader(): boolean {
  return usePlatform() === 'browser';
}
