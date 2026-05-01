import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  RiArrowLeftSFill,
  RiArrowRightSFill,
  RiHistoryFill,
  RiShoppingBag3Fill,
} from '@remixicon/react';
import {
  Card,
  Button,
  Badge,
  SkeletonListItem,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { useSellerCustomerDetail, useSellerCustomerHistory } from '@/api/seller';
import type { CustomerHistoryItem } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { formatPrice } from '@/lib/format';

const STATUS_BADGE: Record<string, BadgeVariant> = {
  pending:    'gray',
  confirming: 'yellow',
  confirmed:  'green',
  rejected:   'red',
  cancelled:  'gray',
};

const STATUS_LABEL: Record<string, string> = {
  pending:    'Kutilmoqda',
  confirming: 'Yangi',
  confirmed:  'Tasdiqlangan',
  rejected:   'Bekor',
  cancelled:  'Bekor',
};

const TYPE_LABEL: Record<string, string> = {
  group: 'Guruh',
  solo:  'Yakka',
};

export function CustomerHistoryScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(0);

  const customerQ = useSellerCustomerDetail(id);
  const historyQ  = useSellerCustomerHistory(id, page, 20);

  const customer = customerQ.data;
  const data     = historyQ.data;

  if (historyQ.isError) {
    return <ErrorState error={historyQ.error} onRetry={() => historyQ.refetch()} />;
  }

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
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-semibold text-fg-1 leading-tight">
              Xaridlar tarixi
            </h1>
            {customer && (
              <p className="text-xs text-fg-3 font-body truncate">{customer.name}</p>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        {data && (
          <Card padding="sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-fg-3 font-body">Jami sarflagan</span>
              <span className="font-mono text-base font-semibold text-fg-1">
                {formatPrice(data.total_spent)} so'm
              </span>
            </div>
          </Card>
        )}

        {data?.note && (
          <p className="text-xs text-fg-4 font-body italic">{data.note}</p>
        )}

        {historyQ.isLoading ? (
          <ListSkeleton />
        ) : !data || data.total === 0 ? (
          <EmptyHistory />
        ) : (
          <>
            <p className="text-xs text-fg-3 font-body">
              {data.total} ta · Sahifa {data.page + 1}/{data.pages}
            </p>
            <div className="space-y-2">
              {data.items.map((item, i) => (
                <HistoryRow key={`${page}-${i}`} item={item} />
              ))}
            </div>

            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft={<RiArrowLeftSFill size={18} />}
                  disabled={page === 0 || historyQ.isFetching}
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
                  disabled={!data.has_next || historyQ.isFetching}
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

function HistoryRow({ item }: { item: CustomerHistoryItem }) {
  const variant = (item.status && STATUS_BADGE[item.status]) || 'gray';
  const label   = (item.status && STATUS_LABEL[item.status]) || null;
  const type    = item.type ? TYPE_LABEL[item.type] : null;

  const body = (
    <Card
      padding="sm"
      className={item.code ? 'cursor-pointer hover:border-border-strong transition-colors duration-base' : undefined}
    >
      <div className="flex items-start gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-bg-3 text-fg-3 shrink-0">
          <RiShoppingBag3Fill size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {item.code && (
              <span className="font-mono text-sm font-semibold text-brand">#{item.code}</span>
            )}
            <span className="text-xs text-fg-3 font-mono">{item.date}</span>
            {type && (
              <span className="text-xs text-fg-4 font-body">· {type}</span>
            )}
          </div>

          <p className="font-display text-sm text-fg-1 mt-0.5 truncate">
            {item.product || '—'}
          </p>

          <div className="flex items-center justify-between mt-1.5 gap-2">
            <span className="font-mono text-base font-semibold text-fg-1">
              {formatPrice(item.amount)} so'm
            </span>
            {label && <Badge variant={variant} size="sm">{label}</Badge>}
          </div>
        </div>
      </div>
    </Card>
  );

  return item.code ? <Link to={`/orders/${item.code}`} className="block">{body}</Link> : body;
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

function EmptyHistory() {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-3 text-fg-4 mb-3">
        <RiHistoryFill size={32} />
      </div>
      <p className="text-sm text-fg-3 font-body">Hali xaridlar yo'q</p>
    </div>
  );
}
