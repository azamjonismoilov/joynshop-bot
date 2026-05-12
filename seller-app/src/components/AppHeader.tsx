import { useNavigate } from 'react-router-dom';
import { RiArrowLeftSLine } from '@remixicon/react';

interface AppHeaderProps {
  tagline:   string;
  showBack?: boolean;
  onBack?:   () => void;
}

export function AppHeader({ tagline, showBack, onBack }: AppHeaderProps) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };
  return (
    <header className="bg-brand text-white pt-safe-top pb-4 px-4">
      <div className="relative flex items-center justify-center min-h-[40px]">
        {showBack && (
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
