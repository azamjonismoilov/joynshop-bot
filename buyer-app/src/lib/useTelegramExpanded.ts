import { useEffect, useState } from 'react';
import { tgWebApp } from './telegram';

/**
 * Telegram WebApp `isExpanded` holatini React state sifatida kuzatadi.
 * App header'lari compact rejimda yashirinishi uchun ishlatiladi —
 * Telegram'ning native header'i (bot nomi + close) bilan dublikat
 * bo'lmasligi uchun.
 *
 * Browser (Telegram'siz dev) → `true` (header doim ko'rinadi).
 * Eski Telegram client (`onEvent` yo'q) → initial qiymat saqlanadi,
 * lekin runtime'da o'zgarmaydi.
 *
 * Bot API 6.0+ `isExpanded` qo'llab-quvvatlaydi, 7.0+ — `viewportChanged`
 * event'lar reactive.
 */
export function useTelegramExpanded(): boolean {
  const tg = tgWebApp();
  const initial = tg ? (tg.isExpanded ?? true) : true;
  const [expanded, setExpanded] = useState<boolean>(initial);

  useEffect(() => {
    if (!tg?.onEvent) return;
    const handler = () => setExpanded(tg.isExpanded ?? true);
    try { tg.onEvent('viewportChanged', handler); } catch { /* ignore */ }
    return () => {
      try { tg.offEvent?.('viewportChanged', handler); } catch { /* ignore */ }
    };
  }, [tg]);

  return expanded;
}
