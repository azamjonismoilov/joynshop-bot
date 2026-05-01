import { useState } from 'react';
import {
  RiArrowLeftSFill,
  RiArrowRightSFill,
  RiBox3Fill,
  RiErrorWarningFill,
  RiFireFill,
  RiLockFill,
  RiPauseCircleFill,
  RiPriceTag3Fill,
  RiShoppingBag3Fill,
  RiTeamFill,
  RiTimeFill,
} from '@remixicon/react';
import { Card, Badge, Button } from '@/components/ui';
import { useSellerProducts } from '@/api/seller';
import type { ProductItem } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/cn';

export function ProductsScreen() {
  const [page, setPage] = useState(0);
  const { data, isLoading, isError, error, refetch, isFetching } = useSellerProducts({
    page,
    limit: 10,
    filter: 'active',
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data || data.total === 0) return <EmptyState />;

  return (
    <div className="min-h-screen bg-bg-2 pb-6">
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold text-fg-1 flex items-center gap-2">
          <RiBox3Fill size={24} className="text-brand" />
          Mening mahsulotlarim
        </h1>
        <p className="text-sm text-fg-3 mt-1 font-body">
          {data.total} ta · Sahifa {data.page + 1}/{data.pages}
        </p>
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {data.items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 mt-5">
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
    </div>
  );
}

interface ProductCardProps {
  item: ProductItem;
}

function ProductCard({ item }: ProductCardProps) {
  const showPriceCount = item.status_label === 'Aktiv';
  const showDraftBadge = item.is_billz_draft;
  const showArchived   = item.status_label === 'Yopilgan' || item.status_label === 'Muddati tugagan';

  return (
    <Card padding="sm" className="cursor-pointer hover:border-border-strong transition-colors duration-base">
      <div className="flex items-center gap-3">
        <ProductPhoto src={item.photo_url} />

        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base font-medium text-fg-1 truncate">
            {item.name || '—'}
          </h3>

          {showPriceCount && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-base font-semibold text-brand">
                {item.price_short}
              </span>
              <span className="text-fg-4">·</span>
              <span className="text-sm text-fg-2 font-body inline-flex items-center gap-1">
                <RiTeamFill size={14} className="text-fg-3" />
                {item.count}/{item.min_group}
              </span>
            </div>
          )}

          {showDraftBadge && (
            <p className="text-sm text-fg-2 mt-0.5 font-body">
              <span className="font-mono text-fg-2">{item.price_short}</span>
              <span className="text-fg-4 mx-1">·</span>
              Asl narx
            </p>
          )}

          {showArchived && (
            <p className="text-sm text-fg-3 mt-0.5 font-body inline-flex items-center gap-1">
              <ArchivedIcon label={item.status_label} />
              {item.status_label}
            </p>
          )}

          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {showDraftBadge && (
              <Badge variant="orange" size="sm" icon={<RiPauseCircleFill size={12} />}>
                Yoqilmagan
              </Badge>
            )}
            {item.mxik_missing && (
              <Badge variant="yellow" size="sm" icon={<RiErrorWarningFill size={12} />}>
                MXIK yo'q
              </Badge>
            )}
            {item.source === 'billz' && !showDraftBadge && (
              <Badge variant="blue" size="sm" icon={<RiShoppingBag3Fill size={12} />}>
                Billz
              </Badge>
            )}
            {showPriceCount && !item.mxik_missing && (
              // Aktiv mahsulot uchun fire belgisi (statusni vizual ko'rsatish)
              <span className="inline-flex items-center text-success">
                <RiFireFill size={14} />
              </span>
            )}
          </div>
        </div>

        <RiArrowRightSFill size={20} className="text-fg-4 shrink-0" />
      </div>
    </Card>
  );
}

function ArchivedIcon({ label }: { label: string }) {
  if (label === 'Muddati tugagan') return <RiTimeFill size={14} className="text-danger" />;
  // 'Yopilgan'
  return <RiLockFill size={14} className="text-fg-4" />;
}

function ProductPhoto({ src }: { src: string }) {
  if (!src) {
    return (
      <div
        className={cn(
          'shrink-0 rounded-lg flex items-center justify-center',
          'bg-bg-3 text-fg-4',
        )}
        style={{ width: 64, height: 64 }}
      >
        <RiPriceTag3Fill size={28} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius-lg)' }}
      className="shrink-0 bg-bg-3"
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget as HTMLImageElement;
        el.style.display = 'none';
      }}
    />
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-bg-2 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-10 h-10 rounded-full border-[3px] border-brand-subtle border-t-brand"
          style={{ animation: 'spin 0.8s linear infinite' }}
        />
        <p className="text-sm text-fg-3 font-body">Yuklanmoqda...</p>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
