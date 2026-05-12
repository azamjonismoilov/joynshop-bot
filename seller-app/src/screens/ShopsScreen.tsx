import { Link } from 'react-router-dom';
import {
  RiArrowRightSFill,
  RiMapPinFill,
  RiPhoneFill,
  RiStore3Fill,
  RiTelegramFill,
} from '@remixicon/react';
import { Badge, Button, Card, Skeleton, SkeletonListItem } from '@/components/ui';
import { useSellerShops } from '@/api/seller';
import { ErrorState } from '@/components/ErrorState';
import { openSellerBotDeeplink } from '@/lib/telegram';
import type { ShopBrief } from '@/api/types';

export function ShopsScreen() {
  const { data, isLoading, isError, error, refetch } = useSellerShops();

  return (
    <div className="min-h-screen bg-bg-2 pt-safe-top pb-8">
      <main className="px-4 mt-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton height={36} width="40%" />
            <SkeletonListItem />
            <SkeletonListItem />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data?.shops?.length ? (
          <EmptySection />
        ) : (
          <ShopsList shops={data.shops} />
        )}
      </main>
    </div>
  );
}

function EmptySection() {
  return (
    <Card padding="lg" className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-subtle text-brand mb-3">
        <RiStore3Fill size={32} />
      </div>
      <h2 className="font-display text-lg font-semibold text-fg-1 mb-1">
        Do'kon yo'q
      </h2>
      <p className="text-sm text-fg-3 font-body mb-5">
        Botda do'kon yaratish uchun davom eting.
      </p>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        iconLeft={<RiTelegramFill size={20} />}
        onClick={() => openSellerBotDeeplink('start')}
      >
        Botga o'tish
      </Button>
    </Card>
  );
}

function ShopsList({ shops }: { shops: ShopBrief[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-fg-3 font-body">
        <span className="font-mono font-semibold text-fg-1">{shops.length}</span> ta do'kon
      </p>
      {shops.map((shop) => (
        <Link key={shop.idx} to={`/settings/shops/${shop.idx}`} className="block">
          <Card padding="md" className="cursor-pointer hover:border-border-strong transition-colors duration-base">
            <div className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-subtle text-brand shrink-0">
                <RiStore3Fill size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display text-base font-semibold text-fg-1 truncate">
                    {shop.name || '—'}
                  </p>
                  <Badge variant={shop.onboarding_status === 'active' ? 'green' : 'gray'} size="sm">
                    {shop.onboarding_status === 'active' ? 'Faol' : 'Passiv'}
                  </Badge>
                </div>
                {shop.address && (
                  <p className="text-xs text-fg-3 font-body mt-1 flex items-center gap-1">
                    <RiMapPinFill size={12} className="shrink-0" />
                    <span className="truncate">{shop.address}</span>
                  </p>
                )}
                {shop.phone && (
                  <p className="text-xs text-fg-3 font-mono mt-0.5 flex items-center gap-1">
                    <RiPhoneFill size={12} className="shrink-0" />
                    <span>{shop.phone}</span>
                  </p>
                )}
              </div>
              <RiArrowRightSFill size={20} className="text-fg-4 shrink-0 mt-1" />
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
