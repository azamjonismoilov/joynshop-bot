import { type ReactNode } from 'react';
import { AppHeader } from '@/components/AppHeader';

interface Props {
  tagline: string;
  icon:    ReactNode;
  title:   string;
  hint?:   string;
}

/** Sprint 2-3 da to'lib boriladi — hozircha "Tez orada" placeholder */
export function PlaceholderScreen({ tagline, icon, title, hint }: Props) {
  return (
    <div className="min-h-screen bg-bg-2 pb-28">
      <AppHeader tagline={tagline} />
      <div className="flex flex-col items-center justify-center px-6 py-20">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-subtle text-brand mb-4">
          {icon}
        </div>
        <h2 className="font-display text-xl font-semibold text-fg-1 mb-1.5 text-center">
          {title}
        </h2>
        <p className="text-sm text-fg-3 font-body text-center max-w-xs">
          {hint || "Bu bo'lim keyingi sprintda ulanadi. Hozircha eski Mini App'dan foydalanishingiz mumkin."}
        </p>
      </div>
    </div>
  );
}
