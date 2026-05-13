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
 * Telegram WebApp fullscreen rejimi reactive kuzatuv (Bot API 8.0+).
 * Foydalanuvchi drag-up yoki menu orqali fullscreen'ga o'tsa, darhol
 * yangilanadi. Eski Telegram client'larda (8.0 dan past) — `isFullscreen`
 * undefined, `onEvent` ham yo'q bo'lishi mumkin → silent false.
 */
export function useIsTelegramFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return typeof window !== 'undefined'
      && window.Telegram?.WebApp?.isFullscreen === true;
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg || typeof tg.onEvent !== 'function') return;

    const handler = () => setIsFullscreen(tg.isFullscreen === true);
    tg.onEvent('fullscreenChanged', handler);

    // Mount paytida ham bir marta sync (state initial qiymati boshlanish
    // momentida olingan — Telegram SDK keyinroq tayyor bo'lsa, qaytadan o'qiymiz)
    handler();

    return () => {
      if (typeof tg.offEvent === 'function') {
        tg.offEvent('fullscreenChanged', handler);
      }
    };
  }, []);

  return isFullscreen;
}

/**
 * Telegram WebApp client platform — `tg.platform`.
 * Mount paytida bir marta o'qiladi, qayta o'zgarmaydi.
 * Mumkin qiymatlar: 'ios' | 'android' | 'tdesktop' | 'macos' | 'web' | 'unknown'.
 */
export function useTelegramPlatform(): string | null {
  const [tgPlatform] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.Telegram?.WebApp?.platform || null;
  });
  return tgPlatform;
}

const TG_MOBILE_PLATFORMS = ['ios', 'android'] as const;

/**
 * Joynshop app header'ini ko'rsatish shartlari — eng tor.
 *
 * Faqat **Telegram mobile (iOS/Android) fullscreen** rejimida ko'rinadi.
 * Boshqa hamma joyda yashirin:
 *   - Telegram desktop / macOS / web → Telegram o'z chrome'i kifoya
 *   - Telegram mobile compact/expanded → Telegram chat top bar bor
 *   - Brauzer, PWA standalone → URL bar yoki OS chrome bor
 */
export function useShouldShowHeader(): boolean {
  const platform     = usePlatform();
  const isFullscreen = useIsTelegramFullscreen();
  const tgPlatform   = useTelegramPlatform();

  return (
    platform === 'telegram'
    && isFullscreen
    && tgPlatform !== null
    && (TG_MOBILE_PLATFORMS as readonly string[]).includes(tgPlatform)
  );
}
