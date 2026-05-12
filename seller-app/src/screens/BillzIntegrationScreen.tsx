import {
  RiBox3Fill,
  RiPlugFill,
  RiStore3Fill,
  RiTelegramFill,
} from '@remixicon/react';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { useSellerBillzIntegration } from '@/api/seller';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/ErrorState';
import { openSellerBotDeeplink } from '@/lib/telegram';
import type { BillzIntegration, BillzShopDetail } from '@/api/types';

export function BillzIntegrationScreen() {
  const { data, isLoading, isError, error, refetch } = useSellerBillzIntegration();

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline="Billz" showBack />

      <main className="px-4 mt-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton height={120} rounded="xl" />
            <Skeleton height={100} rounded="xl" />
            <Skeleton height={100} rounded="xl" />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data?.any_connected ? (
          <EmptySection />
        ) : (
          <BillzContent data={data} />
        )}
      </main>
    </div>
  );
}

function EmptySection() {
  return (
    <Card padding="lg" className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning-subtle text-warning mb-3">
        <RiPlugFill size={32} />
      </div>
      <h2 className="font-display text-lg font-semibold text-fg-1 mb-1">
        Billz ulanmagan
      </h2>
      <p className="text-sm text-fg-3 font-body mb-5">
        Billz POS tizimini ulang — mahsulotlar avtomatik import qilinadi.
      </p>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        iconLeft={<RiTelegramFill size={20} />}
        onClick={() => openSellerBotDeeplink('start')}
      >
        Botda ulash
      </Button>
    </Card>
  );
}

function BillzContent({ data }: { data: BillzIntegration }) {
  return (
    <div className="space-y-3">
      {/* Summary */}
      <Card padding="md">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-success-subtle text-success shrink-0">
            <RiPlugFill size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-lg font-semibold text-fg-1">
                Billz POS
              </h2>
              <Badge variant="green" size="sm">Ulangan</Badge>
            </div>
            <p className="text-xs text-fg-3 font-body mt-0.5">
              {data.shops_connected}/{data.shops_total} do'kon ulangan
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border">
          <Stat
            icon={<RiStore3Fill size={16} />}
            label="Ulangan do'kon"
            value={`${data.shops_connected} / ${data.shops_total}`}
          />
          <Stat
            icon={<RiBox3Fill size={16} />}
            label="Import mahsulot"
            value={String(data.imported_count)}
          />
        </div>
      </Card>

      {/* Per-shop list */}
      <Card padding="md">
        <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-3">
          Do'konlar
        </p>
        <ul className="divide-y divide-border">
          {data.shops.map((s) => <ShopRow key={s.shop_idx} shop={s} />)}
        </ul>
      </Card>
    </div>
  );
}

function ShopRow({ shop }: { shop: BillzShopDetail }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-bg-3 text-fg-3 shrink-0">
          <RiStore3Fill size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display text-sm font-medium text-fg-1 truncate">
              {shop.shop_name || '—'}
            </p>
            <Badge variant={shop.connected ? 'green' : 'gray'} size="sm">
              {shop.connected ? 'Ulangan' : 'Ulanmagan'}
            </Badge>
          </div>
          {shop.connected && (
            <div className="mt-1 space-y-0.5">
              {shop.billz_shop_name && (
                <p className="text-xs text-fg-3 font-body">
                  Billz do'kon: <span className="text-fg-2">{shop.billz_shop_name}</span>
                </p>
              )}
              {shop.billz_shop_id && (
                <p className="text-xs text-fg-3 font-mono truncate">
                  ID: {shop.billz_shop_id}
                </p>
              )}
              {shop.connected_at && (
                <p className="text-xs text-fg-3 font-body">
                  Ulangan: <span className="font-mono">{shop.connected_at}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center py-1">
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-bg-3 text-fg-3 mb-1">
        {icon}
      </div>
      <p className="font-mono text-sm font-semibold text-fg-1">{value}</p>
      <p className="text-[10px] text-fg-3 font-body">{label}</p>
    </div>
  );
}
