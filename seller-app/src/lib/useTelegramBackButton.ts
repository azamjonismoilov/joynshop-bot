import { useEffect, useRef } from 'react';

/**
 * Telegram WebApp BackButton ni boshqaradi.
 * Mount paytida show + onClick ulaydi, unmount'da offClick + hide.
 *
 * Mini App tashqarisida (brauzer) `window.Telegram?.WebApp?.BackButton`
 * mavjud bo'lmaydi — hook silent skip qiladi.
 *
 * `onBack` har render'da yangi bo'lsa ham hook qayta register qilmaydi
 * (ref orqali — flicker oldini olamiz).
 */
export function useTelegramBackButton(
  onBack: () => void,
  enabled: boolean = true,
) {
  const handlerRef = useRef(onBack);
  useEffect(() => {
    handlerRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!enabled) return;
    const tg = window.Telegram?.WebApp;
    if (!tg?.BackButton) return;

    const handler = () => handlerRef.current();
    try { tg.BackButton.show(); } catch { /* ignore */ }
    try { tg.BackButton.onClick(handler); } catch { /* ignore */ }

    return () => {
      try { tg.BackButton.offClick(handler); } catch { /* ignore */ }
      try { tg.BackButton.hide(); } catch { /* ignore */ }
    };
  }, [enabled]);
}
