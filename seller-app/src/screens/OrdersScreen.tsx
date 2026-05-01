import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  RiArrowLeftSFill,
  RiArrowRightSFill,
  RiClipboardFill,
  RiSearchFill,
  RiTimeFill,
} from '@remixicon/react';
import {
  Card,
  Button,
  Badge,
  Input,
  SkeletonListItem,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { useSellerOrders } from '@/api/seller';
import type { OrderFilter, OrderItem, OrderStatus } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';

interface FilterTab {
  key:   OrderFilter;
  label: string;
  countKey?: 'pending' | 'confirming' | 'confirmed' | 'rejected'; // map to summary
}

const FILTER_TABS: FilterTab[] = [
  { key: 'all',        label: 'Hammasi' },
  { key: 'confirming', label: 'Yangi',         countKey: 'confirming' },
  { key: 'confirmed',  label: 'Tasdiqlangan',  countKey: 'confirmed' },
  { key: 'rejected',   label: 'Bekor',         countKey: 'rejected' },
];

const STATUS_BADGE: Record<OrderStatus, BadgeVariant> = {
  pending:    'gray',
  confirming: 'yellow',
  confirmed:  'green',
  rejected:   'red',
  cancelled:  'gray',
};

export function OrdersScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as OrderFilter) || 'all';

  const [filter, setFilter] = useState<OrderFilter>(initialFilter);
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Sync filter → URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filter === 'all') next.delete('filter');
    else next.set('filter', filter);
    setSearchParams(next, { replace: true });
    // page reset when filter changes
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const { data, isLoading, isError, error, refetch, isFetching } = useSellerOrders({
    status: filter,
    page,
    limit:  20,
    search: debouncedSearch,
  });

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      {/* Header */}
      <header className="px-4 pt-5 pb-3 bg-bg-1 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-bg-2 text-fg-2"
            aria-label="Orqaga"
          >
            <RiArrowLeftSFill size={22} />
          </button>
          <h1 className="font-display text-xl font-semibold text-fg-1">
            Buyurtmalar
          </h1>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {/* Filter tabs (segmented, scrollable) */}
        <FilterBar
          value={filter}
          onChange={setFilter}
          summary={data?.summary}
        />

        {/* Search */}
        <Input
          fullWidth
          inputSize="md"
          placeholder="Qidirish: kod yoki mijoz ismi"
          iconLeft={<RiSearchFill size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* List body */}
        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <ListSkeleton />
        ) : !data || data.total === 0 ? (
          <EmptyOrders filter={filter} />
        ) : (
          <>
            <p className="text-xs text-fg-3 font-body">
              {data.total} ta · Sahifa {data.page + 1}/{data.pages}
            </p>
            <div className="space-y-2">
              {data.items.map((order) => (
                <OrderCard key={order.code} order={order} />
              ))}
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<RiArrowLeftSFill size={18} />}
                  disabled={page === 0 || isFetching}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Oldingi
                </Button>
                <span className="text-sm text-fg-3 font-mono">
                  {data.page + 1} / {data.pages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  iconRight={<RiArrowRightSFill size={18} />}
                  disabled={!data.has_next || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Keyingi
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Subcomponents
// ════════════════════════════════════════════════════════════════════

function FilterBar({
  value,
  onChange,
  summary,
}: {
  value: OrderFilter;
  onChange: (v: OrderFilter) => void;
  summary?: { pending: number; confirming: number; confirmed: number; rejected: number };
}) {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
      {FILTER_TABS.map((tab) => {
        const count = tab.countKey && summary ? summary[tab.countKey] : null;
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium font-display',
              'whitespace-nowrap transition-colors duration-base shrink-0',
              active
                ? 'bg-brand text-brand-fg'
                : 'bg-bg-1 text-fg-2 border border-border hover:bg-bg-3',
            )}
          >
            {tab.label}
            {count !== null && count > 0 && (
              <span className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-semibold',
                active ? 'bg-brand-fg/20 text-brand-fg' : 'bg-bg-3 text-fg-3',
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function OrderCard({ order }: { order: OrderItem }) {
  const variant = STATUS_BADGE[order.status] || 'gray';
  return (
    <Link to={`/orders/${order.code}`} className="block">
      <Card
        padding="sm"
        className="cursor-pointer hover:border-border-strong transition-colors duration-base"
      >
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-bg-3 text-fg-3 shrink-0">
            <RiClipboardFill size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-brand">
                #{order.code}
              </span>
              <Badge variant={variant} size="sm">{order.status_label}</Badge>
            </div>

            <p className="font-display text-sm text-fg-1 mt-1.5 truncate">
              {order.buyer.name || '—'}
              {order.buyer.phone && (
                <span className="text-fg-3 font-mono ml-1.5">{order.buyer.phone}</span>
              )}
            </p>

            <p className="text-xs text-fg-3 mt-0.5 font-body truncate">
              {order.product_name}
            </p>

            <div className="flex items-center justify-between mt-1.5 gap-2">
              <span className="font-mono text-base font-semibold text-fg-1">
                {formatPrice(order.amount)} so'm
              </span>
              <span className="text-xs text-fg-3 font-mono inline-flex items-center gap-1 shrink-0">
                <RiTimeFill size={12} />
                {order.created}
              </span>
            </div>
          </div>

          <RiArrowRightSFill size={20} className="text-fg-4 shrink-0 mt-0.5" />
        </div>
      </Card>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} padding="sm">
          <SkeletonListItem />
        </Card>
      ))}
    </div>
  );
}

function EmptyOrders({ filter }: { filter: OrderFilter }) {
  const message =
    filter === 'all'      ? "Hech qanday buyurtma yo'q" :
    filter === 'confirming' ? "Yangi buyurtmalar yo'q" :
    filter === 'confirmed'  ? "Tasdiqlangan buyurtmalar yo'q" :
    filter === 'rejected'   ? "Bekor qilingan buyurtmalar yo'q" :
    "Bu filterda buyurtma yo'q";
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-3 text-fg-4 mb-3">
        <RiClipboardFill size={32} />
      </div>
      <p className="text-sm text-fg-3 font-body">{message}</p>
    </div>
  );
}
