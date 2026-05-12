import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  RiAddFill,
  RiArrowRightSFill,
  RiBarChart2Fill,
  RiBox3Fill,
  RiCheckboxCircleFill,
  RiClipboardFill,
  RiShoppingBag3Fill,
  RiTeamFill,
  RiWalletFill,
} from '@remixicon/react';
import {
  Button,
  Card,
  Skeleton,
  SkeletonListItem,
  SkeletonStats,
} from '@/components/ui';
import { useSellerMe, useSellerStats, useSellerStatsChart } from '@/api/seller';
import { ErrorState } from '@/components/ErrorState';
import { openSellerBotDeeplink } from '@/lib/telegram';
import { cn } from '@/lib/cn';
import {
  colorFromName,
  formatChartDate,
  formatPrice,
  formatPriceShort,
  getInitials,
} from '@/lib/format';
import type {
  ChartDays,
  StatsRange,
  StatsResponse,
  TopCustomer,
  TopProduct,
} from '@/api/types';

interface PeriodOption {
  key:   StatsRange;
  label: string;
  days:  ChartDays;
}

const PERIODS: PeriodOption[] = [
  { key: 'today', label: 'Bugun',  days: 7  },
  { key: 'week',  label: '7 kun',  days: 7  },
  { key: 'month', label: '30 kun', days: 30 },
  { key: 'all',   label: '90 kun', days: 90 },
];

export function DashboardScreen() {
  const [period, setPeriod] = useState<PeriodOption>(PERIODS[1]); // 7 kun
  const me    = useSellerMe();
  const stats = useSellerStats(period.key);
  const chart = useSellerStatsChart(period.days);

  // me — critical, full-screen error/loading
  if (me.isLoading) return <DashboardSkeleton />;
  if (me.isError)  return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  if (!me.data)    return <ErrorState error={new Error("Ma'lumot yo'q")} onRetry={() => me.refetch()} />;

  const profile = me.data;

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      {/* Brand header */}
      <header className="px-4 pt-safe-top pb-4 bg-bg-1 border-b border-border">
        <h1 className="font-display text-2xl font-semibold text-fg-1">
          Joynshop
        </h1>
        <p className="text-sm text-fg-3 mt-0.5 font-body">
          Sotuvchi paneli
        </p>
      </header>

      <main className="px-4 mt-4 space-y-4">
        {/* Period filter */}
        <PeriodFilter value={period} onChange={setPeriod} />

        {/* Stats grid (period-aware) */}
        {stats.isLoading ? (
          <StatsGridSkeleton />
        ) : stats.isError || !stats.data ? (
          <Card padding="md">
            <div className="text-center py-4">
              <p className="text-sm text-fg-3 font-body mb-2">Statistika yuklanmadi</p>
              <Button variant="ghost" size="sm" onClick={() => stats.refetch()}>
                Qayta urinish
              </Button>
            </div>
          </Card>
        ) : (
          <StatsGrid data={stats.data} />
        )}

        {/* No-products banner */}
        {profile.products_count === 0 && (
          <Card padding="md">
            <div className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-subtle text-brand shrink-0">
                <RiBox3Fill size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm font-semibold text-fg-1">
                  Hali mahsulot yo'q
                </p>
                <p className="text-xs text-fg-3 font-body mt-0.5">
                  Mahsulot qo'shish uchun botga qayting.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  iconLeft={<RiAddFill size={16} />}
                  onClick={() => openSellerBotDeeplink('addproduct')}
                >
                  Botda mahsulot qo'shish
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Chart (period-aware) */}
        <Card padding="md">
          <div className="mb-3">
            <h2 className="font-display text-base font-semibold text-fg-1">
              Daromad grafigi
            </h2>
            {chart.data && (
              <p className="text-xs text-fg-3 mt-0.5 font-body">
                Jami: <span className="font-mono font-medium text-fg-2">
                  {formatPrice(chart.data.total_gmv)}
                </span> so'm
              </p>
            )}
          </div>
          <ChartBody chart={chart} />
        </Card>

        {/* Top products */}
        <Card padding="md">
          <SectionHeader
            title="Top mahsulotlar"
            subtitle="Davr bo'yicha daromad"
            linkTo="/products"
            linkLabel="Hammasi"
          />
          <TopProductsList stats={stats} />
        </Card>

        {/* Top customers */}
        <Card padding="md">
          <SectionHeader
            title="Top mijozlar"
            subtitle="Davr bo'yicha xarajatlar"
            linkTo="/customers"
            linkLabel="Hammasi"
          />
          <TopCustomersList stats={stats} />
        </Card>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Period filter
// ════════════════════════════════════════════════════════════════════

function PeriodFilter({
  value, onChange,
}: { value: PeriodOption; onChange: (p: PeriodOption) => void }) {
  return (
    <div className="flex gap-1 bg-bg-3 rounded-md p-0.5 overflow-x-auto">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p)}
          className={cn(
            'flex-1 px-3 py-1.5 text-xs font-medium font-display rounded-sm transition-colors duration-base whitespace-nowrap',
            value.key === p.key ? 'bg-bg-1 text-fg-1 shadow-xs' : 'text-fg-3 hover:text-fg-2',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Stats grid — 6 cards (2x3 mobile, 3x2 sm+)
// ════════════════════════════════════════════════════════════════════

function StatsGrid({ data }: { data: StatsResponse }) {
  const conversionPct = Math.round(data.conversion_rate * 100);
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <StatCard
        icon={<RiWalletFill size={20} />}
        iconBg="bg-brand-subtle"
        iconColor="text-brand"
        label="GMV"
        value={formatPriceShort(data.gmv)}
        valueSuffix="so'm"
        valueColor="text-brand"
      />
      <StatCard
        icon={<RiClipboardFill size={20} />}
        iconBg="bg-secondary-subtle"
        iconColor="text-secondary"
        label="Buyurtmalar"
        value={String(data.orders_confirmed)}
      />
      <StatCard
        icon={<RiBarChart2Fill size={20} />}
        iconBg="bg-success-subtle"
        iconColor="text-success"
        label="O'rtacha chek"
        value={formatPriceShort(data.avg_check)}
        valueSuffix="so'm"
      />
      <StatCard
        icon={<RiTeamFill size={20} />}
        iconBg="bg-purple-subtle"
        iconColor="text-purple"
        label="Mijozlar"
        value={String(data.buyers_unique)}
      />
      <StatCard
        icon={<RiShoppingBag3Fill size={20} />}
        iconBg="bg-warning-subtle"
        iconColor="text-warning"
        label="Sotilgan mahsulot"
        value={String(data.groups_filled)}
      />
      <StatCard
        icon={<RiCheckboxCircleFill size={20} />}
        iconBg="bg-success-subtle"
        iconColor="text-success"
        label="Tasdiqlangan"
        value={`${conversionPct}%`}
      />
    </section>
  );
}

function StatsGridSkeleton() {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <SkeletonStats /><SkeletonStats /><SkeletonStats />
      <SkeletonStats /><SkeletonStats /><SkeletonStats />
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Stat card
// ════════════════════════════════════════════════════════════════════

interface StatCardProps {
  icon:        React.ReactNode;
  iconBg:      string;
  iconColor:   string;
  label:       string;
  value:       string;
  valueSuffix?: string;
  valueColor?: string;
}

function StatCard({
  icon, iconBg, iconColor, label, value, valueSuffix, valueColor,
}: StatCardProps) {
  return (
    <Card padding="md">
      <div className={cn('inline-flex items-center justify-center w-9 h-9 rounded-lg', iconBg, iconColor)}>
        {icon}
      </div>
      <p className="text-xs text-fg-3 mt-3 font-body">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={cn(
          'font-mono text-2xl font-bold leading-none',
          valueColor || 'text-fg-1',
        )}>
          {value}
        </span>
        {valueSuffix && <span className="text-xs text-fg-3 font-body">{valueSuffix}</span>}
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Chart
// ════════════════════════════════════════════════════════════════════

function ChartBody({ chart }: { chart: ReturnType<typeof useSellerStatsChart> }) {
  if (chart.isLoading || !chart.data) {
    return <Skeleton height={180} />;
  }
  if (chart.isError) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-fg-3 font-body">Grafik yuklanmadi</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => chart.refetch()}>
          Qayta urinish
        </Button>
      </div>
    );
  }
  const data = chart.data.data.map((d) => ({
    ...d,
    label: formatChartDate(d.date),
  }));
  if (data.length === 0 || chart.data.total_gmv === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-fg-3 font-body">Bu davrda daromad yo'q</p>
      </div>
    );
  }
  return (
    <div style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="brandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="var(--color-brand)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--color-fg-3)', fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-fg-3)', fontFamily: 'Inter' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatPriceShort(v)}
            width={50}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              fontFamily: 'Inter',
            }}
            formatter={(v: number) => [`${formatPrice(v)} so'm`, 'GMV']}
            labelStyle={{ color: 'var(--color-fg-2)', fontSize: 11 }}
          />
          <Area
            type="monotone"
            dataKey="gmv"
            stroke="var(--color-brand)"
            strokeWidth={2}
            fill="url(#brandGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Top lists
// ════════════════════════════════════════════════════════════════════

function SectionHeader({
  title, subtitle, linkTo, linkLabel,
}: { title: string; subtitle?: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="font-display text-base font-semibold text-fg-1">{title}</h2>
        {subtitle && <p className="text-xs text-fg-3 mt-0.5 font-body">{subtitle}</p>}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="inline-flex items-center gap-0.5 text-xs font-medium text-brand hover:text-brand-hover"
        >
          {linkLabel || 'Hammasi'}
          <RiArrowRightSFill size={14} />
        </Link>
      )}
    </div>
  );
}

function TopProductsList({ stats }: { stats: ReturnType<typeof useSellerStats> }) {
  if (stats.isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonListItem key={i} />)}
      </div>
    );
  }
  if (stats.isError || !stats.data) {
    return <p className="text-sm text-fg-3 py-4 text-center">Ma'lumot yo'q</p>;
  }
  const top: TopProduct[] = stats.data.top_products;
  if (top.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-fg-3 font-body">Bu davrda sotuv yo'q</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {top.slice(0, 5).map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <Rank n={i + 1} />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-medium text-fg-1 truncate">{p.name}</p>
            <p className="text-xs text-fg-3 font-body">
              <span className="font-mono">{p.sold}</span> ta sotildi
            </p>
          </div>
          <span className="font-mono text-sm font-semibold text-brand whitespace-nowrap">
            {formatPriceShort(p.revenue)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TopCustomersList({ stats }: { stats: ReturnType<typeof useSellerStats> }) {
  if (stats.isLoading) {
    return (
      <div className="divide-y divide-border">
        {Array.from({ length: 3 }).map((_, i) => <SkeletonListItem key={i} />)}
      </div>
    );
  }
  if (stats.isError || !stats.data) {
    return <p className="text-sm text-fg-3 py-4 text-center">Ma'lumot yo'q</p>;
  }
  const top: TopCustomer[] = stats.data.top_customers;
  if (top.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-fg-3 font-body">Bu davrda mijoz yo'q</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {top.slice(0, 5).map((c) => (
        <li key={c.cuid} className="flex items-center gap-3 py-2.5">
          <Avatar name={c.name} size={36} />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-medium text-fg-1 truncate">{c.name}</p>
            <p className="text-xs text-fg-3 font-body">
              <span className="font-mono">{c.orders}</span> ta xarid
            </p>
          </div>
          <span className="font-mono text-sm font-semibold text-brand whitespace-nowrap">
            {formatPriceShort(c.spent)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Rank({ n }: { n: number }) {
  const medal = ['🥇', '🥈', '🥉'][n - 1];
  if (medal) {
    return <span className="inline-flex items-center justify-center w-9 h-9 text-xl select-none">{medal}</span>;
  }
  return (
    <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-bg-3 text-fg-3 text-sm font-mono font-medium">
      {n}
    </span>
  );
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const colors = colorFromName(name);
  const initials = getInitials(name);
  return (
    <div
      className="inline-flex items-center justify-center font-display font-semibold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: colors.bg,
        color: colors.fg,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {initials}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Loading skeleton — full screen
// ════════════════════════════════════════════════════════════════════
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <header className="px-4 pt-safe-top pb-3 bg-bg-1 border-b border-border space-y-2">
        <Skeleton height={16} width="50%" />
        <Skeleton height={12} width="30%" />
      </header>
      <main className="px-4 mt-4 space-y-4">
        <Skeleton height={32} rounded="md" />
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <SkeletonStats /><SkeletonStats /><SkeletonStats />
          <SkeletonStats /><SkeletonStats /><SkeletonStats />
        </section>
        <Skeleton height={220} rounded="xl" />
        <Skeleton height={280} rounded="xl" />
      </main>
    </div>
  );
}
