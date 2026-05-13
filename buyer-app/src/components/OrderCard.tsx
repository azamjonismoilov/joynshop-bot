import {
  RiMapPinFill,
  RiStore3Fill,
  RiTruckFill,
} from '@remixicon/react';
import { Badge, Card } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import type { BuyerOrderItem, OrderStatus } from '@/api/types';
import { ProductImage } from './ProductImage';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { STATUS_META } from '@/lib/status';

interface Props {
  order:   BuyerOrderItem;
  onClick: () => void;
}

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  pending:    'gray',
  confirming: 'yellow',
  confirmed:  'green',
  rejected:   'red',
  cancelled:  'gray',
};

export function OrderCard({ order, onClick }: Props) {
  const variant = STATUS_VARIANT[order.status] || 'gray';
  const photo   = order.photo_url || (order.photo_id ? `/api/photo/${order.photo_id}` : '');

  return (
    <Card padding="sm" interactive onClick={onClick} aria-label={`Buyurtma ${order.code}`}>

      <div className="flex items-start gap-3">
        {/* Photo */}
        <div
          className="shrink-0 rounded-lg overflow-hidden"
          style={{ width: 64, height: 64 }}
        >
          <ProductImage
            src={photo}
            alt={order.name}
            className="w-full h-full object-cover"
            fallbackSize={28}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + status badge */}
          <div className="flex items-start gap-2">
            <h3 className="font-display text-sm font-semibold text-fg-1 line-clamp-1 flex-1 min-w-0">
              {order.name || '—'}
            </h3>
            <Badge variant={variant} size="sm">
              <StatusBadgeIcon status={order.status} />
              {order.status_text}
            </Badge>
          </div>

          {/* Shop + code */}
          <p className="text-xs text-fg-3 font-body inline-flex items-center gap-1 mt-1">
            <RiStore3Fill size={11} className="text-fg-4" />
            <span className="truncate">{order.shop_name || '—'}</span>
            <span className="text-fg-4 mx-1">·</span>
            <span className="font-mono">#{order.code}</span>
          </p>

          {/* Delivery / address */}
          <p className={cn(
            'text-xs font-body inline-flex items-center gap-1 mt-1',
            order.delivery === 'deliver' ? 'text-fg-2' : 'text-fg-3',
          )}>
            {order.delivery === 'deliver'
              ? <RiTruckFill   size={11} className="text-brand shrink-0" />
              : <RiMapPinFill  size={11} className="text-fg-4 shrink-0" />}
            <span className="truncate">
              {order.delivery === 'deliver'
                ? (order.address || 'Yetkazib berish')
                : 'Olib ketish'}
            </span>
          </p>

          {/* Bottom row: created + amount */}
          <div className="flex items-baseline justify-between mt-2 gap-2">
            <span className="text-[11px] text-fg-4 font-mono">{order.created}</span>
            <span>
              <span className="font-mono text-lg font-bold tabular-nums text-brand">{formatPrice(order.amount)}</span>
              <span className="text-xs text-fg-3 font-body ml-1">so'm</span>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatusBadgeIcon({ status }: { status: OrderStatus }) {
  const Icon = STATUS_META[status]?.Icon || STATUS_META.pending.Icon;
  return <Icon size={11} className="inline mr-1 -mt-0.5" />;
}
