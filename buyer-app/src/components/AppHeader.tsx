import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftSLine } from '@remixicon/react';
import { cn } from '@/lib/cn';
import { useTelegramBackButton } from '@/lib/useTelegramBackButton';
import { useShouldShowHeader } from '@/lib/usePlatform';
import { isInTelegram } from '@/lib/telegram';

interface AppHeaderProps {
  tagline:   string;
  showBack?: boolean;
  onBack?:   () => void;
}

/**
 * Xaridor sahifa header'i — Wallet pattern: page bg bilan teng.
 * Scroll bo'lganda soft shadow paydo bo'ladi (separator vazifasini bajaradi).
 * Faqat Telegram mobile fullscreen'da ko'rinadi (useShouldShowHeader).
 */
export function AppHeader({ tagline, showBack, onBack }: AppHeaderProps) {
  const navigate   = useNavigate();
  const showHeader = useShouldShowHeader();
  const [scrolled, setScrolled] = useState(false);

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  useTelegramBackButton(handleBack, !!showBack);

  useEffect(() => {
    if (!showHeader) return;
    const handler = () => setScrolled(window.scrollY > 4);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [showHeader]);

  if (!showHeader) return null;

  const showHtmlBack = showBack && !isInTelegram();
  return (
    <header
      className={cn(
        'sticky top-0 z-30 bg-bg-2 pt-safe-top pb-3 px-4',
        'motion-safe:transition-shadow motion-safe:duration-200',
      )}
      style={{ boxShadow: scrolled ? '0 1px 4px rgba(0, 0, 0, 0.06)' : 'none' }}
    >
      <div className="relative flex items-center justify-center min-h-[40px]">
        {showHtmlBack && (
          <button
            onClick={handleBack}
            aria-label="Orqaga"
            className="absolute left-0 inline-flex items-center justify-center w-10 h-10 rounded-md text-fg-2 hover:bg-bg-3 active:bg-bg-muted transition-colors duration-base"
          >
            <RiArrowLeftSLine size={24} />
          </button>
        )}
        <div className="text-center">
          <h1 className="font-display text-lg font-bold text-fg-1 leading-tight">
            Joynshop
          </h1>
          <p className="text-xs font-medium text-fg-3 mt-0.5">
            {tagline}
          </p>
        </div>
      </div>
    </header>
  );
}
