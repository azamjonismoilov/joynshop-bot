import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  RiHeart3Fill,
  RiHome5Fill,
  RiShoppingBag3Fill,
  RiUser3Fill,
} from '@remixicon/react';
import { useBuyerOrders } from '@/api/buyer';
import { cn } from '@/lib/cn';
import { hapticSelection } from '@/lib/haptic';
import { getTgUser } from '@/lib/telegram';

type ItemKey = 'home' | 'wishlist' | 'orders' | 'profile';

interface NavItem {
  key:    ItemKey;
  to:     string;
  label:  string;
  icon:   React.ReactNode;
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { key: 'home',     to: '/',          label: 'Bosh sahifa', icon: <RiHome5Fill size={22} />,        exact: true },
  { key: 'wishlist', to: '/wishlist',  label: 'Saqlangan',   icon: <RiHeart3Fill size={22} /> },
  { key: 'orders',   to: '/orders',    label: 'Buyurtma',    icon: <RiShoppingBag3Fill size={22} /> },
  { key: 'profile',  to: '/profile',   label: 'Profil',      icon: <RiUser3Fill size={22} /> },
];

const ACTIVE_STATUSES = ['pending', 'confirming', 'confirmed'] as const;

function isActive(pathname: string, to: string, exact?: boolean): boolean {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(to + '/');
}

export function BottomNav() {
  const { pathname } = useLocation();
  const uid          = getTgUser()?.id ?? null;
  const ordersQuery  = useBuyerOrders(uid);

  const ordersBadge = useMemo(() => {
    if (!ordersQuery.data) return 0;
    return ordersQuery.data.filter((o) => (ACTIVE_STATUSES as readonly string[]).includes(o.status)).length;
  }, [ordersQuery.data]);

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
        const badge  = item.key === 'orders' ? ordersBadge : 0;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            onClick={() => { if (!active) hapticSelection(); }}
            className="flex-1 flex justify-center"
          >
            <div
              className={cn(
                'min-w-[72px] flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-full',
                'motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out',
              )}
              style={{
                background: active ? 'var(--color-segmented-bg)' : 'transparent',
              }}
            >
              <span
                className={cn(
                  'relative inline-flex items-center justify-center',
                  'motion-safe:transition-colors motion-safe:duration-200',
                  active ? 'text-brand' : 'text-fg-3',
                )}
              >
                {item.icon}
                {badge > 0 && <NavBadge count={badge} />}
              </span>
              <span
                className={cn(
                  'text-[11px] leading-tight font-medium font-display whitespace-nowrap',
                  'motion-safe:transition-colors motion-safe:duration-200',
                  active ? 'text-brand' : 'text-fg-3',
                )}
                style={{ letterSpacing: '-0.1px' }}
              >
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Tab icon ustida qizil bildirishnoma badge — Telegram pattern.
 * Pozitsiya icon ning yuqori-o'ng chetida (icon ni to'smaydi).
 * Ring rangini sahifa bg'ga moslangan (bg-2) — visual ajratish.
 */
function NavBadge({ count }: { count: number }) {
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      aria-hidden
      className="absolute -top-0.5 -right-2.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-danger text-white text-[9px] font-bold font-mono leading-none"
      style={{ boxShadow: '0 0 0 1.5px var(--color-bg-2)' }}
    >
      {label}
    </span>
  );
}
