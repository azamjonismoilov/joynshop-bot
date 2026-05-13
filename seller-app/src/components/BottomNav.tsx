import { Link, useLocation } from 'react-router-dom';
import {
  RiBox3Fill,
  RiHome5Fill,
  RiSettings3Fill,
  RiShoppingBag3Fill,
  RiTeamFill,
} from '@remixicon/react';
import { cn } from '@/lib/cn';
import { hapticSelection } from '@/lib/haptic';

interface NavItem {
  to:     string;
  label:  string;
  icon:   React.ReactNode;
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { to: '/',          label: 'Bosh sahifa', icon: <RiHome5Fill size={20} />,         exact: true },
  { to: '/products',  label: 'Mahsulot',    icon: <RiBox3Fill size={20} /> },
  { to: '/orders',    label: 'Buyurtma',    icon: <RiShoppingBag3Fill size={20} /> },
  { to: '/customers', label: 'Mijoz',       icon: <RiTeamFill size={20} /> },
  { to: '/settings',  label: 'Sozlama',     icon: <RiSettings3Fill size={20} /> },
];

function isActive(pathname: string, to: string, exact?: boolean): boolean {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(to + '/');
}

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="fixed left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 rounded-full p-2 px-3"
      style={{
        bottom:     'calc(16px + env(safe-area-inset-bottom))',
        background: '#FFFFFF',
        boxShadow:  '0 4px 16px rgba(0, 0, 0, 0.08)',
      }}
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.to, item.exact);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => { if (!active) hapticSelection(); }}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-full px-2.5 py-1.5 min-w-[56px] transition-colors duration-base',
              active
                ? 'bg-brand text-white'
                : 'text-fg-3 hover:text-fg-1',
            )}
          >
            <span className="inline-flex items-center justify-center">
              {item.icon}
            </span>
            <span
              className={cn(
                'text-[10px] leading-tight font-medium font-display whitespace-nowrap transition-colors duration-base',
                active ? 'text-white' : 'text-fg-3',
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
