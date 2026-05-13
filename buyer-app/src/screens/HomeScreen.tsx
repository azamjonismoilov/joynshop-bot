import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  RiBox3Fill,
  RiFireFill,
  RiFlashlightFill,
  RiPriceTag3Fill,
  RiSearchLine,
  RiSparkling2Fill,
} from '@remixicon/react';
import { useCategories, useProducts } from '@/api/buyer';
import { Skeleton, SkeletonProductCard } from '@/components/ui';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { ProductDetailSheet } from '@/components/ProductDetailSheet';
import { CheckoutSheet } from '@/components/CheckoutSheet';
import { PullToRefresh } from '@/components/PullToRefresh';
import { cn } from '@/lib/cn';
import { hapticImpact, hapticSelection } from '@/lib/haptic';
import { tgWebApp } from '@/lib/telegram';

type Filter = 'all' | 'hot' | 'almost' | 'new';

const FILTERS: Array<{ key: Filter; label: string; icon: React.ReactNode }> = [
  { key: 'all',    label: 'Hammasi',     icon: null },
  { key: 'hot',    label: 'Ommabop',     icon: <RiFireFill size={12} /> },
  { key: 'almost', label: 'Tugayotgan',  icon: <RiFlashlightFill size={12} /> },
  { key: 'new',    label: 'Yangi',       icon: <RiSparkling2Fill size={12} /> },
];

export function HomeScreen() {
  const products    = useProducts();
  const categoriesQ = useCategories();

  const [filter,   setFilter]   = useState<Filter>('all');
  const [category, setCategory] = useState<string>('all');
  const [search,   setSearch]   = useState('');
  const [openPid,  setOpenPid]  = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'group' | 'solo'>('group');
  const qc = useQueryClient();

  const handleRefresh = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ['buyer', 'products'] }),
      qc.refetchQueries({ queryKey: ['buyer', 'categories'] }),
    ]);
  };

  // Deep link parsing — mount paytida bir marta
  const deepLinkProcessed = useRef(false);
  useEffect(() => {
    if (deepLinkProcessed.current) return;
    deepLinkProcessed.current = true;

    let pid: string | null = null;
    let type: 'group' | 'solo' = 'group';
    let autoCheckout = false;

    // 1. Telegram start_param: buy_PID_TYPE
    const startParam = tgWebApp()?.initDataUnsafe?.start_param || '';
    if (startParam.startsWith('buy_')) {
      const parts = startParam.slice(4).split('_');
      pid  = parts[0] || null;
      type = parts[1] === 'solo' ? 'solo' : 'group';
      autoCheckout = true;
    }

    // 2. URL query — bot.py kanal post URL'lari shu format'da
    if (!pid) {
      const params = new URLSearchParams(window.location.search);
      const qpid   = params.get('pid');
      if (params.get('action') === 'buy' && qpid) {
        pid  = qpid;
        type = params.get('type') === 'solo' ? 'solo' : 'group';
        autoCheckout = true;
      }
    }

    if (pid) {
      setOpenPid(pid);
      if (autoCheckout) {
        // Detail sheet birinchi ko'rinsin, keyin checkout
        setTimeout(() => {
          setCheckoutType(type);
          setShowCheckout(true);
        }, 400);
      }
    }
  }, []);

  // Stats — products dan derive
  const stats = useMemo(() => {
    const list = products.data || [];
    const active = list.length;
    const ending = list.filter((p) => p.min_group - p.count <= 2 && p.count < p.min_group).length;
    const avgDisc = active > 0
      ? Math.round(list.reduce((s, p) => s + p.grp_disc, 0) / active)
      : 0;
    return { active, ending, avgDisc };
  }, [products.data]);

  const filtered = useMemo(() => {
    let list = products.data || [];
    if (category !== 'all') list = list.filter((p) => p.category === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.shop_name.toLowerCase().includes(q));
    }
    switch (filter) {
      case 'hot':
        return [...list].sort((a, b) => b.count - a.count).slice(0, 30);
      case 'almost':
        return list.filter((p) => p.min_group - p.count <= 2 && p.count < p.min_group);
      case 'new':
        return [...list].reverse();
      default:
        return list;
    }
  }, [products.data, category, search, filter]);

  const anyModalOpen = !!openPid || showCheckout;

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={anyModalOpen}>
    <div className="min-h-screen bg-bg-2 pb-28">
      <HomeHeader search={search} onSearch={setSearch} />

      <FilterBar
        value={filter}
        onChange={(f) => { hapticSelection(); setFilter(f); }}
      />

      <CategoryBar
        value={category}
        onChange={(c) => { hapticSelection(); setCategory(c); }}
        items={categoriesQ.data || []}
        isLoading={categoriesQ.isLoading}
      />

      <StatsRow active={stats.active} ending={stats.ending} avgDisc={stats.avgDisc} isLoading={products.isLoading} />

      {/* Body */}
      <section className="px-4 mt-5">
        <h2 className="font-display text-base font-semibold text-fg-1 mb-3">
          {SECTION_TITLES[filter]}
        </h2>
        {products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : products.isLoading ? (
          <ProductGridSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<RiBox3Fill size={36} />}
            title="Mahsulot topilmadi"
            description="Filter va qidiruvni tekshiring yoki keyinroq qayting."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                item={p}
                onClick={() => { hapticImpact('light'); setOpenPid(p.id); }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modal stack — Detail birinchi, Checkout ustida */}
      <ProductDetailSheet
        isOpen={!!openPid && !showCheckout}
        pid={openPid}
        onClose={() => setOpenPid(null)}
        onBuyClick={(t) => { setCheckoutType(t); setShowCheckout(true); }}
        snapPoints={['half', 'full']}
        initialSnap="half"
      />
      <CheckoutSheet
        isOpen={showCheckout}
        pid={openPid}
        defaultType={checkoutType}
        onClose={() => setShowCheckout(false)}
      />
    </div>
    </PullToRefresh>
  );
}

const SECTION_TITLES: Record<Filter, string> = {
  all:    'Barcha mahsulotlar',
  hot:    'Ommabop mahsulotlar',
  almost: 'Tugayotgan guruhlar',
  new:    'Yangi mahsulotlar',
};

// ═══════════════════════════════════════════════════════════════
//  Header + search (Home-spetsifik, brand orange)
// ═══════════════════════════════════════════════════════════════
function HomeHeader({ search, onSearch }: { search: string; onSearch: (v: string) => void }) {
  return (
    <header className="bg-brand text-white pt-safe-top pb-3 px-4">
      <div className="flex items-center justify-center pb-2">
        <h1 className="font-display text-xl font-extrabold text-white tracking-tight">
          Joynshop
        </h1>
      </div>
      <label className="relative block">
        <RiSearchLine
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 pointer-events-none"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Mahsulot yoki do'kon qidirish"
          className="w-full h-10 pl-10 pr-3 rounded-lg bg-white/20 border border-white/25 text-sm text-white placeholder:text-white/70 font-body outline-none focus:bg-white focus:text-fg-1 focus:placeholder:text-fg-4 focus:border-white transition-colors duration-base"
        />
      </label>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Filter bar (4 chips)
// ═══════════════════════════════════════════════════════════════
function FilterBar({
  value, onChange,
}: { value: Filter; onChange: (v: Filter) => void }) {
  return (
    <div className="flex gap-1.5 px-4 mt-4 overflow-x-auto no-scrollbar">
      {FILTERS.map((f) => {
        const active = value === f.key;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={cn(
              'inline-flex items-center gap-1 px-3.5 h-8 rounded-full text-xs font-medium font-display border shrink-0 transition-colors duration-base',
              active
                ? 'bg-brand text-brand-fg border-brand'
                : 'bg-bg-1 text-fg-2 border-border',
            )}
          >
            {f.icon}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Category bar — horizontal scroll
// ═══════════════════════════════════════════════════════════════
function CategoryBar({
  value, onChange, items, isLoading,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { name: string; icon: string; count: number }[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex gap-1.5 px-4 mt-2 overflow-x-auto no-scrollbar pb-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={88} height={28} rounded="full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return null;
  return (
    <div className="flex gap-1.5 px-4 mt-2 overflow-x-auto no-scrollbar pb-1">
      <CatChip active={value === 'all'} onClick={() => onChange('all')}>
        Hammasi
      </CatChip>
      {items.map((c) => (
        <CatChip
          key={c.name}
          active={value === c.name}
          onClick={() => onChange(c.name)}
        >
          <span className="mr-1">{c.icon}</span>
          {c.name}
        </CatChip>
      ))}
    </div>
  );
}

function CatChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center px-3 h-7 rounded-full text-xs font-medium font-display border shrink-0 transition-colors duration-base',
        active
          ? 'bg-brand text-brand-fg border-brand'
          : 'bg-bg-1 text-fg-2 border-border',
      )}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Stats row — 3 cards
// ═══════════════════════════════════════════════════════════════
function StatsRow({
  active, ending, avgDisc, isLoading,
}: { active: number; ending: number; avgDisc: number; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 px-4 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height={70} rounded="xl" />
        ))}
      </div>
    );
  }
  return (
    <section className="grid grid-cols-3 gap-3 px-4 mt-4">
      <StatCard
        icon={<RiFireFill size={18} className="text-brand" />}
        value={active}
        label="Faol guruhlar"
      />
      <StatCard
        icon={<RiFlashlightFill size={18} className="text-warning" />}
        value={ending}
        label="Tugayapti"
      />
      <StatCard
        icon={<RiPriceTag3Fill size={18} className="text-success" />}
        value={`${avgDisc}%`}
        label="O'rtacha chegirma"
      />
    </section>
  );
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div
      className="shadow-xs rounded-xl p-3 text-center"
      style={{ background: 'var(--color-card-bg)' }}
    >
      <div className="inline-flex items-center justify-center mb-1">{icon}</div>
      <p className="font-mono text-2xl font-bold tabular-nums text-fg-1 leading-none">{value}</p>
      <p className="text-[11px] text-fg-3 font-body leading-tight mt-1">{label}</p>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => <SkeletonProductCard key={i} />)}
    </div>
  );
}
