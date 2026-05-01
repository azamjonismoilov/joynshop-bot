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
  RiArrowDownSFill,
  RiArrowRightSFill,
  RiArrowUpSFill,
  RiBarChart2Fill,
  RiBox3Fill,
  RiClipboardFill,
  RiWalletFill,
} from '@remixicon/react';
import { Card, Button, Skeleton, SkeletonStats, SkeletonListItem } from '@/components/ui';
import { useSellerMe, useSellerStats, useSellerStatsChart } from '@/api/seller';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/cn';
import {
  colorFromName,
  formatChartDate,
  formatDateUz,
  formatPrice,
  formatPriceShort,
  getInitials,
} from '@/lib/format';
import type { ChartDays } from '@/api/types';

export function DashboardScreen() {
  const [chartDays, setChartDays] = useState<ChartDays>(7);
  const me    = useSellerMe();
  const stats = useSellerStats('week');
  const chart = useSellerStatsChart(chartDays);

  // me — bu critical, agar fail bo'lsa butun screen ErrorState
  if (me.isLoading) return <DashboardSkeleton />;
  if (me.isError)  return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  if (!me.data)    return <ErrorState error={new Error("Ma'lumot yo'q")} onRetry={() => me.refetch()} />;

  const profile = me.data;

  // Empty state — sotuvchi mahsulotsiz va buyurtmasiz
  const isCompletelyEmpty = profile.products_count === 0 && profile.orders_pending === 0
    && (stats.data?.gmv ?? 0) === 0;
  if (isCompletelyEmpty && !stats.isLoading) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      {/* ─── A. Header ─── */}
      <header className="px-4 pt-5 pb-4 bg-bg-1 border-b border-border">
        <h1 className="font-display text-2xl font-semibold text-fg-1">
          Salom, {profile.first_name || 'sotuvchi'} 👋
        </h1>
        <p className="text-sm text-fg-3 mt-0.5 font-body">
          {formatDateUz(new Date())}
        </p>
      </header>

      <main className="px-4 mt-4 space-y-4">
        {/* ─── B. Stats grid 2x2 ─── */}
        <section className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<RiWalletFill size={20} />}
            iconBg="bg-brand-subtle"
            iconColor="text-brand"
            label="GMV bugun"
            value={formatPriceShort(profile.stats_summary.gmv_today)}
            valueSuffix="so'm"
          />
          <StatCard
            icon={<RiBarChart2Fill size={20} />}
            iconBg="bg-secondary-subtle"
            iconColor="text-secondary"
            label="GMV hafta"
            value={formatPriceShort(profile.stats_summary.gmv_week)}
            valueSuffix="so'm"
          />
          <StatCard
            icon={<RiClipboardFill size={20} />}
            iconBg="bg-warning-subtle"
            iconColor="text-warning"
            label="Buyurtmalar"
            value={String(profile.orders_pending)}
            valueSuffix={profile.orders_pending ? 'kutilmoqda' : ''}
            highlight={profile.orders_pending > 0}
            linkTo="/orders?filter=confirming"
          />
          <StatCard
            icon={<RiBox3Fill size={20} />}
            iconBg="bg-success-subtle"
            iconColor="text-success"
            label="Faol mahsulotlar"
            value={String(profile.products_count)}
          />
        </section>

        {/* ─── C. Chart ─── */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <div>
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
            <RangeTabs value={chartDays} onChange={setChartDays} />
          </div>
          <ChartBody chart={chart} />
        </Card>

        {/* ─── D. Top mahsulotlar ─── */}
        <Card padding="md">
          <SectionHeader
            title="Top mahsulotlar"
            subtitle="Hafta bo'yicha daromad bo'yicha"
            linkTo="/products"
            linkLabel="Hammasi"
          />
          <TopProductsList stats={stats} />
        </Card>

        {/* ─── E. Top mijozlar ─── */}
        <Card padding="md">
          <SectionHeader
            title="Top mijozlar"
            subtitle="Hafta bo'yicha xarajatlar bo'yicha"
          />
          <TopCustomersList stats={stats} />
        </Card>
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Subcomponents
// ════════════════════════════════════════════════════════════════════

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  valueSuffix?: string;
  trend?: number; // +/-% (kelajakda)
  highlight?: boolean;
  linkTo?: string;
}

function StatCard({ icon, iconBg, iconColor, label, value, valueSuffix, trend, highlight, linkTo }: StatCardProps) {
  const inner = (
    <Card
      padding="md"
      className={cn(
        highlight && 'ring-2 ring-warning ring-offset-2 ring-offset-bg-2',
        linkTo && 'cursor-pointer hover:border-border-strong transition-colors duration-base',
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('inline-flex items-center justify-center w-9 h-9 rounded-lg', iconBg, iconColor)}>
          {icon}
        </div>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p className="text-xs text-fg-3 mt-3 font-body">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-2xl font-bold text-fg-1 leading-none">{value}</span>
        {valueSuffix && <span className="text-xs text-fg-3 font-body">{valueSuffix}</span>}
      </div>
    </Card>
  );
  return linkTo ? <Link to={linkTo} className="block">{inner}</Link> : inner;
}

function TrendBadge({ value }: { value: number }) {
  const positive = value >= 0;
  const Icon = positive ? RiArrowUpSFill : RiArrowDownSFill;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium font-mono',
      positive ? 'text-success' : 'text-danger',
    )}>
      <Icon size={14} />
      {Math.abs(value)}%
    </span>
  );
}

function RangeTabs({ value, onChange }: { value: ChartDays; onChange: (v: ChartDays) => void }) {
  const opts: ChartDays[] = [7, 30, 90];
  return (
    <div className="flex gap-1 bg-bg-3 rounded-md p-0.5">
      {opts.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={cn(
            'px-2.5 py-1 text-xs font-medium font-display rounded-sm transition-colors duration-base',
            value === d ? 'bg-bg-1 text-fg-1 shadow-xs' : 'text-fg-3 hover:text-fg-2',
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

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
            tick={{ fontSize: 11, fill: 'var(--color-fg-3)', fontFamily: 'DM Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-fg-3)', fontFamily: 'DM Mono' }}
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
  const top = stats.data.top_products;
  if (top.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-fg-3 font-body">Hali sotilgan mahsulot yo'q</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {top.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <Rank n={i + 1} />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-medium text-fg-1 truncate">{p.name}</p>
            <p className="text-xs text-fg-3 font-body">{p.sold} ta sotildi</p>
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
  const top = stats.data.top_customers;
  if (top.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-fg-3 font-body">Hali mijoz yo'q</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {top.map((c) => (
        <li key={c.cuid} className="flex items-center gap-3 py-2.5">
          <Avatar name={c.name} size={36} />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-medium text-fg-1 truncate">{c.name}</p>
            <p className="text-xs text-fg-3 font-body">{c.orders} ta xarid</p>
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
      <header className="px-4 pt-5 pb-4 bg-bg-1 border-b border-border space-y-2">
        <Skeleton height={28} width="60%" />
        <Skeleton height={14} width="35%" />
      </header>
      <main className="px-4 mt-4 space-y-4">
        <section className="grid grid-cols-2 gap-3">
          <SkeletonStats />
          <SkeletonStats />
          <SkeletonStats />
          <SkeletonStats />
        </section>
        <Skeleton height={220} rounded="xl" />
        <Skeleton height={280} rounded="xl" />
      </main>
    </div>
  );
}
