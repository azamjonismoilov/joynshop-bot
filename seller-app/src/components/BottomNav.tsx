import { Link, useLocation } from 'react-router-dom';
import {
  RiBox3Fill,
  RiHome5Fill,
  RiSettings3Fill,
  RiShoppingBag3Fill,
  RiTeamFill,
} from '@remixicon/react';
import { cn } from '@/lib/cn';

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
      className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-full p-1.5 backdrop-blur-xl shadow-xl"
      style={{
        bottom:     'calc(24px + env(safe-area-inset-bottom))',
        background: 'rgba(28, 28, 28, 0.92)',
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
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-full transition-all duration-base',
              active
                ? 'bg-brand text-white px-3 py-2'
                : 'p-2 text-white/50 hover:text-white/80',
            )}
          >
            <span className="inline-flex items-center justify-center">
              {item.icon}
            </span>
            {active && (
              <span className="text-xs font-medium font-display whitespace-nowrap">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
