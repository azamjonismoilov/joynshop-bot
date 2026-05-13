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
 * - `enabled=false` → tugma yashirin, click handler ham bog'lanmaydi
 * - `loading=true` → showProgress(), tugma matn saqlanadi
 * - `text` o'zgarsa setText
 * - `onClick` har render'da yangi bo'lsa ham re-register qilmaydi (ref orqali)
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

  // Show + register handler (deps: enabled, text)
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg?.MainButton) return;
    if (!enabled) {
      try { tg.MainButton.hide(); } catch { /* ignore */ }
      return;
    }
    const handler = () => handlerRef.current();
    // setParams — brand orange, har callsite uchun avtomatik. Telegram
    // dark theme yoki user accent o'zgartirsa ham brand identity saqlanadi.
    try {
      tg.MainButton.setParams({
        text:       text.slice(0, 64),
        color:      '#FA7319',  // --color-brand
        text_color: '#FFFFFF',  // --color-brand-fg
        is_active:  true,
        is_visible: true,
      });
    } catch { /* ignore */ }
    try { tg.MainButton.onClick(handler); } catch { /* ignore */ }
    try { tg.MainButton.show(); } catch { /* ignore */ }
    return () => {
      try { tg.MainButton.offClick(handler); } catch { /* ignore */ }
      try { tg.MainButton.hide(); } catch { /* ignore */ }
    };
  }, [enabled, text]);

  // Loading state — alohida effect (re-show qilmaslik uchun)
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
