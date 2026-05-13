import { useNavigate } from 'react-router-dom';
import { RiArrowLeftSLine } from '@remixicon/react';
import { useTelegramBackButton } from '@/lib/useTelegramBackButton';
import { useShouldShowHeader } from '@/lib/usePlatform';
import { isInTelegram } from '@/lib/telegram';

interface AppHeaderProps {
  tagline:   string;
  showBack?: boolean;
  onBack?:   () => void;
}

/**
 * Default xaridor sahifa header'i — brand orange.
 * Faqat oddiy brauzerda ko'rinadi. Telegram va PWA standalone'da
 * o'z chrome'i bor — dublikat oldini olamiz.
 */
export function AppHeader({ tagline, showBack, onBack }: AppHeaderProps) {
  const navigate   = useNavigate();
  const showHeader = useShouldShowHeader();
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  useTelegramBackButton(handleBack, !!showBack);

  if (!showHeader) return null;

  const showHtmlBack = showBack && !isInTelegram();
  return (
    <header className="bg-brand text-white pt-safe-top pb-4 px-4 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out">
      <div className="relative flex items-center justify-center min-h-[40px]">
        {showHtmlBack && (
          <button
            onClick={handleBack}
            aria-label="Orqaga"
            className="absolute left-0 inline-flex items-center justify-center w-10 h-10 rounded-md text-white/90 hover:bg-white/10 active:bg-white/20 transition-colors duration-base"
          >
            <RiArrowLeftSLine size={24} />
          </button>
        )}
        <div className="text-center">
          <h1 className="font-display text-lg font-bold text-white leading-tight">
            Joynshop
          </h1>
          <p className="text-xs font-medium text-white/80 mt-0.5">
            {tagline}
          </p>
        </div>
      </div>
    </header>
  );
}
