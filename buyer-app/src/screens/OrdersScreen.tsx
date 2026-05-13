import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiHome5Line,
  RiShoppingBag3Fill,
  RiShoppingBag3Line,
} from '@remixicon/react';
import { useQueryClient } from '@tanstack/react-query';
import { useBuyerOrders } from '@/api/buyer';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Skeleton } from '@/components/ui';
import { OrderCard } from '@/components/OrderCard';
import { OrderDetailSheet } from '@/components/OrderDetailSheet';
import { PullToRefresh } from '@/components/PullToRefresh';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import type { BuyerOrderItem, OrderStatus } from '@/api/types';
import { cn } from '@/lib/cn';
import { hapticImpact, hapticSelection } from '@/lib/haptic';
import { getTgUser } from '@/lib/telegram';

type Filter = 'all' | 'active' | 'done';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all',    label: 'Hammasi' },
  { key: 'active', label: 'Faol' },
  { key: 'done',   label: 'Tugagan' },
];

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirming', 'confirmed'];
const DONE_STATUSES:   OrderStatus[] = ['rejected', 'cancelled'];

export function OrdersScreen() {
  const navigate = useNavigate();
  const uid      = getTgUser()?.id ?? null;
  const query    = useBuyerOrders(uid);
  const qc       = useQueryClient();

  const [filter, setFilter]     = useState<Filter>('all');
  const [selected, setSelected] = useState<BuyerOrderItem | null>(null);

  const orders = query.data || [];

  const handleRefresh = async () => {
    await qc.refetchQueries({ queryKey: ['buyer', 'orders', uid] });
  };

  const filtered = useMemo(() => {
    if (filter === 'all')    return orders;
    if (filter === 'active') return orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
    return orders.filter((o) => DONE_STATUSES.includes(o.status));
  }, [orders, filter]);

  // selected re-sync — agar query yangilanib status o'zgarsa, sheet'dagi
  // ko'rinish ham yangi statusni ko'rsatsin
  const selectedFresh = useMemo(() => {
    if (!selected) return null;
    return orders.find((o) => o.code === selected.code) || selected;
  }, [orders, selected]);

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={!!selected}>
    <div className="min-h-screen bg-bg-2 pb-28">
      <AppHeader tagline="Buyurtmalarim" />

      {!uid ? (
        <div className="px-4 mt-4">
          <EmptyState
            icon={<RiShoppingBag3Line size={36} />}
            title="Telegram orqali kiring"
            description="Buyurtmalarni ko'rish uchun Mini App'ni Telegram ichida oching."
          />
        </div>
      ) : query.isError ? (
        <div className="px-4 mt-4">
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </div>
      ) : (
        <main className="px-4 mt-3 space-y-3">
          {/* Filter chips */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const count  = f.key === 'all'
                ? orders.length
                : f.key === 'active'
                  ? orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length
                  : orders.filter((o) => DONE_STATUSES.includes(o.status)).length;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => { hapticSelection(); setFilter(f.key); }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-xs font-medium font-display border shrink-0 transition-colors duration-base',
                    active
                      ? 'bg-brand text-brand-fg border-brand'
                      : 'bg-bg-1 text-fg-2 border-border',
                  )}
                >
                  {f.label}
                  {count > 0 && (
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-semibold',
                      active ? 'bg-white/25 text-white' : 'bg-bg-3 text-fg-3',
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Body */}
          {query.isLoading ? (
            <ListSkeleton />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<RiShoppingBag3Line size={36} />}
              title="Hali buyurtma yo'q"
              description="Mahsulot tanlab buyurtma bering — bu yerda ko'rinadi."
              action={
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  iconLeft={<RiHome5Line size={18} />}
                  onClick={() => navigate('/')}
                >
                  Mahsulotlarni ko'rish
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<RiShoppingBag3Fill size={36} />}
              title="Bu filtrda buyurtma yo'q"
              description="Boshqa filtrni tanlab ko'ring."
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((o) => (
                <OrderCard
                  key={o.code}
                  order={o}
                  onClick={() => { hapticImpact('light'); setSelected(o); }}
                />
              ))}
            </div>
          )}
        </main>
      )}

      <OrderDetailSheet
        isOpen={!!selected}
        order={selectedFresh}
        uid={uid}
        onClose={() => setSelected(null)}
        snapPoints={['half', 'full']}
        initialSnap="half"
      />
    </div>
    </PullToRefresh>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} padding="sm">
          <div className="flex items-start gap-3">
            <Skeleton width={64} height={64} rounded="lg" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton height={14} width="65%" />
              <Skeleton height={12} width="45%" />
              <Skeleton height={12} width="80%" />
              <div className="flex items-baseline justify-between mt-1">
                <Skeleton height={10} width={70} />
                <Skeleton height={16} width={80} />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
