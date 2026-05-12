import { useEffect, useRef } from 'react';

interface UseMainButtonOptions {
  text:     string;
  enabled?: boolean;
  loading?: boolean;
  onClick:  () => void;
}

/**
 * Telegram WebApp MainButton lifecycle.
 *
 * - `enabled=false` → tugma yashirin, click handler bog'lanmaydi
 * - `loading=true` → showProgress(), tugma matn saqlanadi
 * - `text` o'zgarsa setText
 * - `onClick` har render'da yangi bo'lsa ham re-register qilmaydi (ref)
 *
 * Mini App tashqarisida (brauzer) `window.Telegram.WebApp.MainButton`
 * mavjud bo'lmaydi — hook silent skip qiladi.
 */
export function useMainButton({
  text,
  enabled = true,
  loading = false,
  onClick,
}: UseMainButtonOptions) {
  const handlerRef = useRef(onClick);
  useEffect(() => {
    handlerRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.MainButton) return;
    if (!enabled) {
      try { tg.MainButton.hide(); } catch { /* ignore */ }
      return;
    }
    const handler = () => handlerRef.current();
    try { tg.MainButton.setText(text.slice(0, 64)); } catch { /* ignore */ }
    try { tg.MainButton.onClick(handler); } catch { /* ignore */ }
    try { tg.MainButton.show(); } catch { /* ignore */ }
    return () => {
      try { tg.MainButton.offClick(handler); } catch { /* ignore */ }
      try { tg.MainButton.hide(); } catch { /* ignore */ }
    };
  }, [enabled, text]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.MainButton || !enabled) return;
    if (loading) {
      try { tg.MainButton.showProgress(false); } catch { /* ignore */ }
    } else {
      try { tg.MainButton.hideProgress(); } catch { /* ignore */ }
    }
  }, [enabled, loading]);
}
