import { Link } from 'react-router-dom';
import {
  RiArrowRightSFill,
  RiFileTextFill,
  RiPlugFill,
  RiStore3Fill,
} from '@remixicon/react';
import { Card } from '@/components/ui';
import { useSellerMe } from '@/api/seller';

interface SettingItem {
  icon:        React.ReactNode;
  label:       string;
  description: string;
  to:          string;
}

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

  return (
    <div className="min-h-screen bg-bg-2 pt-safe-top pb-8">
      <main className="px-4 mt-4 space-y-2.5">
        {items.map((it) => (
          <Link key={it.to} to={it.to} className="block">
            <Card padding="md" className="cursor-pointer hover:border-border-strong transition-colors duration-base">
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
                <RiArrowRightSFill size={20} className="text-fg-4 shrink-0" />
              </div>
            </Card>
          </Link>
        ))}
      </main>
    </div>
  );
}
