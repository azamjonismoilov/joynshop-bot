import { Link, useLocation } from 'react-router-dom';
import {
  RiHeart3Fill,
  RiHome5Fill,
  RiShoppingBag3Fill,
  RiUser3Fill,
} from '@remixicon/react';
import { cn } from '@/lib/cn';
import { hapticSelection } from '@/lib/haptic';

interface NavItem {
  to:     string;
  label:  string;
  icon:   React.ReactNode;
  exact?: boolean;
}

// 4 ta xaridor tab. Buyurtmalar va Profil — Sprint 3.
const ITEMS: NavItem[] = [
  { to: '/',          label: 'Bosh sahifa', icon: <RiHome5Fill size={22} />,         exact: true },
  { to: '/wishlist',  label: 'Saqlangan',   icon: <RiHeart3Fill size={22} /> },
  { to: '/orders',    label: 'Buyurtma',    icon: <RiShoppingBag3Fill size={22} /> },
  { to: '/profile',   label: 'Profil',      icon: <RiUser3Fill size={22} /> },
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
      className="fixed left-3 right-3 z-40 flex items-center gap-1 rounded-full p-1.5"
      style={{
        bottom:     'calc(12px + env(safe-area-inset-bottom))',
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
              'flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full px-2 py-2 min-h-12',
              'motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out',
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
                'text-[11px] leading-tight font-medium font-display whitespace-nowrap truncate max-w-full',
                'motion-safe:transition-colors motion-safe:duration-200',
                active ? 'text-white' : 'text-fg-3',
              )}
              style={{ letterSpacing: '-0.1px' }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
