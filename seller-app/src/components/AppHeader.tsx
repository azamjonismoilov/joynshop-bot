import { useNavigate } from 'react-router-dom';
import { RiArrowLeftSLine } from '@remixicon/react';
import { useTelegramBackButton } from '@/lib/useTelegramBackButton';

interface AppHeaderProps {
  tagline:   string;
  showBack?: boolean;
  onBack?:   () => void;
}

// Telegram Mini App'da Telegram native BackButton chaqiriladi (chap-yuqori),
// shuning uchun HTML back tugma takror bo'lib qoladi. Faqat brauzer/dev
// rejimida ko'rsatamiz (fallback).
function isInTelegram(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
}

export function AppHeader({ tagline, showBack, onBack }: AppHeaderProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  // Telegram BackButton'ni `showBack` true bo'lganda ulash —
  // har detail ekran avtomatik mos keladi (per-screen kod kerak emas).
  useTelegramBackButton(handleBack, !!showBack);

  const showHtmlBack = showBack && !isInTelegram();
  return (
    <header className="bg-brand text-white pt-safe-top pb-4 px-4">
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
