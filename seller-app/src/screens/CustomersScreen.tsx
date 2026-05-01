import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  RiArrowLeftSFill,
  RiArrowRightSFill,
  RiSearchFill,
  RiUserFill,
  RiVipCrownFill,
} from '@remixicon/react';
import {
  Card,
  Button,
  Badge,
  Input,
  SkeletonListItem,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { useSellerCustomers } from '@/api/seller';
import type {
  CustomerActivity,
  CustomerBrief,
  CustomerFilter,
  CustomersSummary,
} from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/cn';
import { formatPrice, formatPriceShort } from '@/lib/format';

const FILTER_TABS: { key: CustomerFilter; label: string; countKey?: keyof CustomersSummary }[] = [
  { key: 'all',    label: 'Hammasi' },
  { key: 'vip',    label: 'VIP',         countKey: 'vip' },
  { key: 'active', label: 'Faol',        countKey: 'active' },
  { key: 'new',    label: 'Yangi',       countKey: 'new' },
  { key: 'repeat', label: 'Takroriy',    countKey: 'repeat' },
  { key: 'lost',   label: "Yo'qolgan",   countKey: 'lost' },
];

const ACTIVITY_BADGE: Record<CustomerActivity, BadgeVariant> = {
  active:  'green',
  average: 'yellow',
  lost:    'red',
};

const TAG_LABEL: Record<string, string> = {
  vip:     'VIP',
  problem: 'Muammoli',
  loyal:   'Doimiy',
};

export function CustomersScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as CustomerFilter) || 'all';

  const [filter, setFilter] = useState<CustomerFilter>(initialFilter);
  const [page, setPage]     = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filter === 'all') next.delete('filter');
    else next.set('filter', filter);
    setSearchParams(next, { replace: true });
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const { data, isLoading, isError, error, refetch, isFetching } = useSellerCustomers({
    filter,
    page,
    limit: 20,
    search: debouncedSearch,
  });

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <header className="px-4 pt-5 pb-3 bg-bg-1 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-bg-2 text-fg-2"
            aria-label="Orqaga"
          >
            <RiArrowLeftSFill size={22} />
          </button>
          <h1 className="font-display text-xl font-semibold text-fg-1">Mijozlar</h1>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {data?.summary && <SummaryCards summary={data.summary} />}

        <FilterBar value={filter} onChange={setFilter} summary={data?.summary} />

        <Input
          fullWidth
          inputSize="md"
          placeholder="Qidirish: ism"
          iconLeft={<RiSearchFill size={16} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <ListSkeleton />
        ) : !data || data.total === 0 ? (
          <EmptyCustomers filter={filter} />
        ) : (
          <>
            <p className="text-xs text-fg-3 font-body">
              {data.total} ta · Sahifa {data.page + 1}/{data.pages}
            </p>
            <div className="space-y-2">
              {data.items.map((c) => (
                <CustomerCard key={c.cuid} customer={c} />
              ))}
            </div>

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

function SummaryCards({ summary }: { summary: CustomersSummary }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <BigStatCard label="Jami mijozlar" value={String(summary.total)} />
        <BigStatCard label="Jami daromad" value={`${formatPriceShort(summary.total_revenue)} so'm`} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SmallStatCard label="Faol"      value={summary.active} accent="success"   />
        <SmallStatCard label="VIP"       value={summary.vip}    accent="brand"     />
        <SmallStatCard label="Yangi"     value={summary.new}    accent="secondary" />
        <SmallStatCard label="Yo'qolgan" value={summary.lost}   accent="danger"    />
      </div>
    </div>
  );
}

function BigStatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-fg-3 font-body">{label}</p>
      <p className="font-mono text-xl font-semibold text-fg-1 mt-0.5">{value}</p>
    </Card>
  );
}

const ACCENT_CLASS: Record<'success' | 'brand' | 'secondary' | 'danger', string> = {
  success:   'text-success',
  brand:     'text-brand',
  secondary: 'text-secondary',
  danger:    'text-danger',
};

function SmallStatCard({
  label,
  value,
  accent,
}: {
  label:  string;
  value:  number;
  accent: 'success' | 'brand' | 'secondary' | 'danger';
}) {
  return (
    <Card padding="sm">
      <p className="text-xs text-fg-3 font-body">{label}</p>
      <p className={cn('font-mono text-lg font-semibold mt-0.5', ACCENT_CLASS[accent])}>{value}</p>
    </Card>
  );
}

function FilterBar({
  value,
  onChange,
  summary,
}: {
  value:    CustomerFilter;
  onChange: (v: CustomerFilter) => void;
  summary?: CustomersSummary;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
      {FILTER_TABS.map((tab) => {
        const count  = tab.countKey && summary ? (summary[tab.countKey] as number) : null;
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
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-semibold',
                  active ? 'bg-brand-fg/20 text-brand-fg' : 'bg-bg-3 text-fg-3',
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CustomerCard({ customer: c }: { customer: CustomerBrief }) {
  const variant = ACTIVITY_BADGE[c.activity] || 'gray';
  const isVip   = c.tags.includes('vip');
  return (
    <Link to={`/customers/${c.cuid}`} className="block">
      <Card padding="sm" className="cursor-pointer hover:border-border-strong transition-colors duration-base">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <Avatar name={c.name} size={44} />
            {c.medal && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs">
                {c.medal}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display text-sm font-semibold text-fg-1 truncate">
                {c.name || '—'}
              </span>
              {isVip && (
                <Badge variant="brand" size="sm">
                  <RiVipCrownFill size={10} className="mr-0.5" />
                  VIP
                </Badge>
              )}
              <Badge variant={variant} size="sm">{c.activity_label}</Badge>
            </div>

            {c.phone && (
              <p className="text-xs text-fg-3 mt-0.5 font-mono truncate">{c.phone}</p>
            )}

            <div className="flex items-center justify-between mt-1.5 gap-2">
              <span className="text-xs text-fg-3 font-body">
                {c.total_orders} ta xarid
              </span>
              <span className="font-mono text-base font-semibold text-fg-1">
                {formatPrice(c.total_spent)} so'm
              </span>
            </div>

            {c.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mt-1.5">
                {c.tags.filter((t) => t !== 'vip').map((t) => (
                  <Badge key={t} variant="gray" size="sm">
                    {TAG_LABEL[t] || t}
                  </Badge>
                ))}
              </div>
            )}
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

function EmptyCustomers({ filter }: { filter: CustomerFilter }) {
  const message =
    filter === 'all'    ? "Hali mijozlar yo'q" :
    filter === 'vip'    ? "VIP mijozlar yo'q" :
    filter === 'active' ? "Faol mijozlar yo'q" :
    filter === 'new'    ? "Yangi mijozlar yo'q" :
    filter === 'repeat' ? "Takroriy xaridorlar yo'q" :
    filter === 'lost'   ? "Yo'qolgan mijozlar yo'q" :
    "Bu filterda mijoz yo'q";
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-3 text-fg-4 mb-3">
        <RiUserFill size={32} />
      </div>
      <p className="text-sm text-fg-3 font-body">{message}</p>
    </div>
  );
}
