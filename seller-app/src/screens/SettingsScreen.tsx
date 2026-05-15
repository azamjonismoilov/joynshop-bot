import { Link } from 'react-router-dom';
import {
  RiArrowRightSLine,
  RiExternalLinkLine,
  RiFileTextFill,
  RiPlugFill,
  RiShieldUserFill,
  RiStore3Fill,
} from '@remixicon/react';
import { Card } from '@/components/ui';
import { useSellerMe } from '@/api/seller';
import { AppHeader } from '@/components/AppHeader';
import { hapticImpact } from '@/lib/haptic';

interface SettingItem {
  icon:        React.ReactNode;
  label:       string;
  description: string;
  to:          string;
}

interface LegalLink {
  icon:  React.ReactNode;
  label: string;
  url:   string;
}

const LEGAL_LINKS: LegalLink[] = [
  {
    icon:  <RiFileTextFill size={22} />,
    label: 'Sotuvchi qoidalari',
    url:   'https://telegra.ph/Joynshop-Sotuvchi-Qoidalari-05-15',
  },
  {
    icon:  <RiFileTextFill size={22} />,
    label: 'Foydalanuvchi shartnomasi',
    url:   'https://telegra.ph/Joynshop-Foydalanuvchi-Shartnomasi-05-15',
  },
  {
    icon:  <RiShieldUserFill size={22} />,
    label: 'Maxfiylik siyosati',
    url:   'https://telegra.ph/Joynshop-Maxfiylik-Siyosati-05-15',
  },
];

export function SettingsScreen() {
  const me = useSellerMe();
  const shopsCount = me.data?.shops?.length ?? 0;

  const items: SettingItem[] = [
    {
      icon:        <RiFileTextFill size={22} />,
      label:       "Yuridik ma'lumotlar",
      description: 'STIR, hisob raqami, bank',
      to:          '/settings/legal',
    },
    {
      icon:        <RiStore3Fill size={22} />,
      label:       "Do'konlar",
      description: shopsCount ? `${shopsCount} ta do'kon` : "Do'kon yo'q",
      to:          '/settings/shops',
    },
    {
      icon:        <RiPlugFill size={22} />,
      label:       'Integratsiyalar',
      description: 'Billz va boshqalar',
      to:          '/settings/integrations',
    },
  ];

  const openLink = (url: string) => {
    hapticImpact('light');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline="Sozlamalar" />
      <main className="px-4 mt-4 space-y-4">
        <section className="space-y-3">
          {items.map((it) => (
            <Link key={it.to} to={it.to} className="block">
              <Card padding="md" interactive>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-subtle text-brand shrink-0">
                    {it.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base font-medium text-fg-1">
                      {it.label}
                    </p>
                    <p className="text-xs text-fg-3 font-body mt-0.5">
                      {it.description}
                    </p>
                  </div>
                  <RiArrowRightSLine size={20} className="text-fg-4 shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </section>

        {/* Yuridik hujjatlar — Telegraph */}
        <section>
          <p className="text-xs text-fg-3 font-body font-medium uppercase tracking-wide px-2 mb-2">
            Huquqiy hujjatlar
          </p>
          <Card padding="none">
            {LEGAL_LINKS.map((link, i) => (
              <button
                key={link.url}
                type="button"
                onClick={() => openLink(link.url)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 text-left',
                  'hover:bg-bg-2 active:bg-bg-3 transition-colors duration-base',
                  i > 0 ? 'border-t border-border' : '',
                ].join(' ')}
              >
                <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-bg-3 text-fg-3 shrink-0">
                  {link.icon}
                </div>
                <span className="flex-1 font-display text-sm font-medium text-fg-1">
                  {link.label}
                </span>
                <RiExternalLinkLine size={16} className="text-fg-4 shrink-0" />
              </button>
            ))}
          </Card>
        </section>
      </main>
    </div>
  );
}
