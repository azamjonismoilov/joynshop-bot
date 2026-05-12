import { useEffect, useState } from 'react';
import { RiWifiOffLine } from '@remixicon/react';

/**
 * Internet aloqasi yo'q paytda yuqorida fixed banner ko'rsatadi.
 * `navigator.onLine` event listener orqali — Telegram va brauzer'da
 * bir xil ishlaydi.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline  = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 z-[150] bg-warning text-warning-fg px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium font-display animate-[toastIn_220ms_ease-out]"
      style={{ top: 'var(--header-safe-top)' }}
    >
      <RiWifiOffLine size={16} />
      <span>Internet aloqasi yo'q</span>
    </div>
  );
}
