import { Link } from 'react-router-dom';
import {
  RiArrowRightSFill,
  RiLockFill,
  RiPlugFill,
} from '@remixicon/react';
import { Badge, Card, Skeleton } from '@/components/ui';
import { useSellerIntegrations } from '@/api/seller';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/cn';
import type { IntegrationItem } from '@/api/types';

export function IntegrationsScreen() {
  const { data, isLoading, isError, error, refetch } = useSellerIntegrations();

  return (
    <div className="min-h-screen bg-bg-2 pt-3 pb-8">
      <main className="px-4 mt-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton height={88} rounded="xl" />
            <Skeleton height={88} rounded="xl" />
            <Skeleton height={88} rounded="xl" />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : (
          <IntegrationsList items={data?.integrations ?? []} />
        )}
      </main>
    </div>
  );
}

function IntegrationsList({ items }: { items: IntegrationItem[] }) {
  if (items.length === 0) {
    return (
      <Card padding="lg" className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-subtle text-brand mb-3">
          <RiPlugFill size={32} />
        </div>
        <p className="text-sm text-fg-3 font-body">
          Integratsiyalar mavjud emas
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((it) => <IntegrationCard key={it.id} item={it} />)}
    </div>
  );
}

function IntegrationCard({ item }: { item: IntegrationItem }) {
  const isComingSoon = item.status === 'coming_soon';
  const isBillz      = item.id === 'billz';
  const connected    = item.connected_shops ?? 0;
  const total        = item.total_shops ?? 0;
  const isConnected  = connected > 0;

  const inner = (
    <Card
      padding="md"
      className={cn(
        !isComingSoon && 'cursor-pointer hover:border-border-strong transition-colors duration-base',
        isComingSoon && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
            isComingSoon ? 'bg-neutral-100 text-fg-4' : 'bg-brand-subtle text-brand',
          )}
        >
          {isComingSoon ? <RiLockFill size={20} /> : <RiPlugFill size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-display text-base font-medium text-fg-1">
              {item.name}
            </p>
            {isBillz && !isComingSoon && (
              <Badge variant={isConnected ? 'green' : 'gray'} size="sm">
                {isConnected ? 'Ulangan' : 'Ulanmagan'}
              </Badge>
            )}
            {isComingSoon && (
              <Badge variant="gray" size="sm">Tez orada</Badge>
            )}
          </div>
          <p className="text-xs text-fg-3 font-body mt-0.5">
            {isBillz
              ? (isConnected
                  ? `${connected}/${total} do'kon ulangan`
                  : 'POS tizimi — Billz')
              : 'Integratsiya tez orada qo\'shiladi'}
          </p>
        </div>
        {!isComingSoon && (
          <RiArrowRightSFill size={20} className="text-fg-4 shrink-0" />
        )}
      </div>
    </Card>
  );

  if (isComingSoon || !isBillz) return inner;
  return <Link to="/settings/integrations/billz" className="block">{inner}</Link>;
}
