import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  RiCheckFill,
  RiCloseFill,
  RiPriceTag3Fill,
  RiShoppingBag3Fill,
  RiTimeLine,
  RiTruckLine,
  RiUserFill,
  RiWalletLine,
} from '@remixicon/react';
import { Card, Button, Badge, Modal, Skeleton } from '@/components/ui';
import {
  useConfirmOrder,
  useRejectOrder,
  useSellerOrderDetail,
} from '@/api/seller';
import type {
  OrderDetailResponse,
  OrderStatus,
  OrderTimelineEvent,
} from '@/api/types';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/cn';
import { colorFromName, formatPrice, getInitials } from '@/lib/format';
import { useMainButton } from '@/lib/useMainButton';
import { hapticImpact, hapticNotify } from '@/lib/haptic';

const isInTelegram = (): boolean =>
  typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;

const STATUS_BANNER_BG: Record<OrderStatus, string> = {
  pending:    'bg-bg-3 text-fg-2',
  confirming: 'bg-warning-subtle text-warning',
  confirmed:  'bg-success-subtle text-success',
  rejected:   'bg-danger-subtle text-danger',
  cancelled:  'bg-bg-3 text-fg-2',
};

export function OrderDetailScreen() {
  const { code } = useParams<{ code: string }>();
  const { data, isLoading, isError, error, refetch } = useSellerOrderDetail(code);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <DetailSkeleton code={code} />;

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline={`Buyurtma #${data.code}`} showBack />

      <main className="px-4 mt-4 space-y-4">
        {/* Status banner */}
        <StatusBanner data={data} />

        {/* Buyer card */}
        <BuyerCard data={data} />

        {/* Product card */}
        <ProductCard data={data} />

        {/* Summary */}
        <SummaryCard data={data} />

        {/* Timeline */}
        <TimelineCard timeline={data.timeline} />

        {/* Action buttons */}
        <ActionButtons data={data} />
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Subcomponents
// ════════════════════════════════════════════════════════════════════

function StatusBanner({ data }: { data: OrderDetailResponse }) {
  const cls = STATUS_BANNER_BG[data.status] || STATUS_BANNER_BG.pending;
  return (
    <div className={cn('rounded-card p-4 flex items-center gap-3', cls)}>
      <div className="text-2xl shrink-0 select-none">{data.status_emoji}</div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-base font-semibold">{data.status_label}</p>
        <p className="text-xs opacity-80 font-body">{data.created}</p>
      </div>
    </div>
  );
}

function BuyerCard({ data }: { data: OrderDetailResponse }) {
  const colors = colorFromName(data.buyer.name);
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <div
          className="inline-flex items-center justify-center font-display font-semibold shrink-0 select-none"
          style={{
            width: 48, height: 48, borderRadius: '50%',
            backgroundColor: colors.bg, color: colors.fg,
            fontSize: 18,
          }}
        >
          {getInitials(data.buyer.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-base font-semibold text-fg-1 truncate">
              {data.buyer.name || '—'}
            </h3>
            {data.buyer.tags?.map((tag) => (
              <Badge key={tag} variant="purple" size="sm">{tag}</Badge>
            ))}
          </div>
          {data.buyer.phone && (
            <p className="text-sm text-fg-3 font-mono mt-0.5">{data.buyer.phone}</p>
          )}
          {data.buyer.username && (
            <p className="text-xs text-secondary font-mono mt-0.5">@{data.buyer.username}</p>
          )}
        </div>
      </div>

      {(data.buyer.total_orders > 0 || data.buyer.lifetime_value > 0) && (
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
          <BuyerStat
            label="Xaridlar"
            value={String(data.buyer.total_orders)}
          />
          <BuyerStat
            label="Jami"
            value={`${formatPrice(data.buyer.lifetime_value)} so'm`}
            mono
          />
          <BuyerStat
            label="Birinchi"
            value={data.buyer.first_order || '—'}
          />
        </div>
      )}
    </Card>
  );
}

function BuyerStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-fg-3 uppercase tracking-wide font-body">{label}</p>
      <p className={cn('text-sm font-semibold text-fg-1 mt-0.5 truncate', mono && 'font-mono')}>
        {value}
      </p>
    </div>
  );
}

function ProductCard({ data }: { data: OrderDetailResponse }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-fg-3 font-body uppercase tracking-wide px-1 mb-2">
        Mahsulot
      </p>
      <div className="flex items-center gap-3">
        {data.product.photo_url ? (
          <img
            src={data.product.photo_url}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius-md)' }}
            className="shrink-0 bg-bg-3"
          />
        ) : (
          <div
            className="shrink-0 rounded-md flex items-center justify-center bg-bg-3 text-fg-4"
            style={{ width: 48, height: 48 }}
          >
            <RiPriceTag3Fill size={22} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-display text-sm font-medium text-fg-1 truncate">
            {data.product.name || '—'}
          </p>
          {data.variant && (
            <p className="text-xs text-fg-3 font-body mt-0.5">
              Variant: <span className="text-fg-2 font-medium">{data.variant}</span>
            </p>
          )}
          <p className="text-xs text-fg-3 font-body mt-0.5">
            <RiShoppingBag3Fill size={12} className="inline mr-1 -mt-0.5" />
            {data.type_label} · 1 ta
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-fg-1 shrink-0">
          {formatPrice(data.amount)}
        </span>
      </div>
    </Card>
  );
}

function SummaryCard({ data }: { data: OrderDetailResponse }) {
  return (
    <Card padding="md">
      <p className="text-xs text-fg-3 font-body uppercase tracking-wide mb-3">
        Yig'indi
      </p>
      <div className="space-y-2">
        <SummaryRow
          icon={<RiShoppingBag3Fill size={16} className="text-fg-3" />}
          label="Mahsulotlar"
          value="1 ta"
        />
        <SummaryRow
          icon={<RiTruckLine size={16} className="text-fg-3" />}
          label="Yetkazib berish"
          value={data.delivery_label}
        />
        {data.delivery === 'deliver' && data.address && (
          <SummaryRow
            icon={<RiUserFill size={16} className="text-fg-3" />}
            label="Manzil"
            value={data.address}
          />
        )}
        {data.payment_method && (
          <SummaryRow
            icon={<RiWalletLine size={16} className="text-fg-3" />}
            label="To'lov usuli"
            value={data.payment_method}
          />
        )}
      </div>
      <div className="mt-4 pt-4 border-t border-border flex items-baseline justify-between">
        <span className="text-sm font-medium text-fg-2 font-body">Jami</span>
        <span className="font-mono text-3xl font-bold tabular-nums text-brand leading-none">
          {formatPrice(data.amount)} <span className="text-sm font-semibold text-fg-3">so'm</span>
        </span>
      </div>
    </Card>
  );
}

function SummaryRow({ icon, label, value }: {
  icon: React.ReactNode; label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0">{icon}</span>
      <span className="text-fg-3 font-body">{label}</span>
      <span className="text-fg-1 font-medium ml-auto text-right truncate">{value || '—'}</span>
    </div>
  );
}

function TimelineCard({ timeline }: { timeline: OrderTimelineEvent[] }) {
  if (!timeline || timeline.length === 0) return null;
  return (
    <Card padding="md">
      <p className="text-xs text-fg-3 font-body uppercase tracking-wide mb-3">
        Holat tarixi
      </p>
      <ol className="space-y-3">
        {timeline.map((ev, i) => (
          <TimelineRow key={i} event={ev} isLast={i === timeline.length - 1} />
        ))}
      </ol>
    </Card>
  );
}

const TIMELINE_META: Record<OrderTimelineEvent['event'], {
  icon: React.ReactNode;
  label: string;
  color: string;
  bg: string;
}> = {
  created:   { icon: <RiTimeLine size={14} />,   label: 'Yaratildi',     color: 'text-fg-2',     bg: 'bg-bg-3' },
  payment:   { icon: <RiWalletLine size={14} />, label: "To'landi",      color: 'text-secondary', bg: 'bg-secondary-subtle' },
  confirmed: { icon: <RiCheckFill size={14} />,  label: 'Tasdiqlangan',  color: 'text-success',  bg: 'bg-success-subtle' },
  rejected:  { icon: <RiCloseFill size={14} />,  label: 'Rad etildi',    color: 'text-danger',   bg: 'bg-danger-subtle' },
  cancelled: { icon: <RiCloseFill size={14} />,  label: 'Bekor qilindi', color: 'text-fg-3',     bg: 'bg-bg-3' },
};

function TimelineRow({ event, isLast }: { event: OrderTimelineEvent; isLast: boolean }) {
  const meta = TIMELINE_META[event.event] || TIMELINE_META.created;
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('inline-flex items-center justify-center w-7 h-7 rounded-full', meta.bg, meta.color)}>
          {meta.icon}
        </div>
        {!isLast && <div className="flex-1 w-px bg-border my-1" />}
      </div>
      <div className="flex-1 min-w-0 pb-2">
        <p className="text-sm font-medium font-display text-fg-1">{meta.label}</p>
        {event.at && (
          <p className="text-xs text-fg-3 font-mono mt-0.5">{event.at}</p>
        )}
        {event.meta?.method && (
          <p className="text-xs text-fg-3 font-body mt-0.5">
            Usul: <span className="text-fg-2">{event.meta.method}</span>
          </p>
        )}
        {event.meta?.reason && (
          <p className="text-xs text-fg-3 font-body mt-0.5">
            Sabab: <span className="text-fg-2">{event.meta.reason}</span>
          </p>
        )}
      </div>
    </li>
  );
}

function ActionButtons({ data }: { data: OrderDetailResponse }) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason]         = useState('');
  const [actionError, setError]     = useState<string | null>(null);
  const confirmMut = useConfirmOrder();
  const rejectMut  = useRejectOrder();

  // Server'dagi actions field afzal — eski backend uchun status'dan fallback
  const canConfirm = data.actions?.can_confirm ?? (data.status === 'pending' || data.status === 'confirming');
  const canReject  = data.actions?.can_reject  ?? !['confirmed', 'rejected', 'cancelled'].includes(data.status);

  const isPending = confirmMut.isPending || rejectMut.isPending;

  const handleConfirm = () => {
    setError(null);
    hapticImpact('medium');
    confirmMut.mutate(data.code, {
      onSuccess: () => hapticNotify('success'),
      onError: (e) => {
        hapticNotify('error');
        setError(e instanceof Error ? e.message : "Tasdiqlash xato bo'ldi");
      },
    });
  };

  const handleReject = () => {
    setError(null);
    rejectMut.mutate(
      { code: data.code, reason: reason.trim() },
      {
        onSuccess: () => {
          hapticNotify('success');
          setShowReject(false);
          setReason('');
        },
        onError: (e) => {
          hapticNotify('error');
          setError(e instanceof Error ? e.message : "Rad etish xato bo'ldi");
        },
      },
    );
  };

  // Tasdiqlash → MainButton; reject modal ochiq bo'lsa MainButton yashirin
  useMainButton({
    text:    'Tasdiqlash',
    enabled: !!canConfirm && !showReject && !isPending,
    loading: confirmMut.isPending,
    onClick: handleConfirm,
  });
  const inTelegram = isInTelegram();

  if (!canConfirm && !canReject) return null;

  return (
    <>
      <div className="space-y-2">
        <div className={cn(
          'gap-2',
          inTelegram ? 'flex flex-col' : 'grid grid-cols-2',
        )}>
          {canConfirm && !inTelegram && (
            <Button
              variant="success"
              size="lg"
              iconLeft={<RiCheckFill size={18} />}
              disabled={isPending}
              onClick={handleConfirm}
            >
              {confirmMut.isPending ? 'Tasdiqlanmoqda...' : 'Tasdiqlash'}
            </Button>
          )}
          {canReject && (
            <Button
              variant="danger"
              size="lg"
              iconLeft={<RiCloseFill size={18} />}
              disabled={isPending}
              onClick={() => { hapticImpact('light'); setError(null); setShowReject(true); }}
            >
              Rad etish
            </Button>
          )}
        </div>
        {actionError && (
          <p className="text-xs text-danger font-body px-1">{actionError}</p>
        )}
      </div>

      <Modal
        isOpen={showReject}
        onClose={() => { if (!rejectMut.isPending) setShowReject(false); }}
        title="Buyurtmani rad etish"
      >
        <p className="text-sm text-fg-3 font-body mb-4">
          Bu amal qaytarib bo'lmaydi. Xaridorga xabar yuboriladi.
        </p>
        <label className="block">
          <span className="text-xs text-fg-3 font-body">Sabab (ixtiyoriy)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 200))}
            placeholder="Masalan: Mahsulot omborda yo'q"
            rows={3}
            disabled={rejectMut.isPending}
            className="mt-1.5 w-full rounded-md border border-border bg-bg-1 px-3 py-2 text-sm font-body text-fg-1 placeholder:text-fg-4 resize-none focus:outline-none focus:border-border-focus disabled:opacity-50"
          />
          <span className="block text-[10px] text-fg-4 font-mono mt-1 text-right">
            {reason.length}/200
          </span>
        </label>
        {rejectMut.isError && !actionError && (
          <p className="text-xs text-danger font-body mt-2">
            {rejectMut.error instanceof Error ? rejectMut.error.message : "Xato yuz berdi"}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button
            variant="outline"
            size="lg"
            onClick={() => { setShowReject(false); setReason(''); }}
            disabled={rejectMut.isPending}
          >
            Bekor
          </Button>
          <Button
            variant="danger"
            size="lg"
            iconLeft={<RiCloseFill size={18} />}
            onClick={handleReject}
            disabled={rejectMut.isPending}
          >
            {rejectMut.isPending ? 'Rad etilmoqda...' : 'Rad etish'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Loading skeleton
// ════════════════════════════════════════════════════════════════════
function DetailSkeleton({ code }: { code?: string }) {
  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline={code ? `Buyurtma #${code}` : 'Buyurtma'} showBack />
      <main className="px-4 mt-4 space-y-4">
        <Skeleton height={72} rounded="xl" />
        <Skeleton height={140} rounded="xl" />
        <Skeleton height={88} rounded="xl" />
        <Skeleton height={180} rounded="xl" />
        <Skeleton height={160} rounded="xl" />
      </main>
    </div>
  );
}
