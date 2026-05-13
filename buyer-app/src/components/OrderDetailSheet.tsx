import { useEffect, useState } from 'react';
import { BottomSheet, type SnapPoint } from './BottomSheet';
import {
  RiCloseFill,
  RiFileCopyLine,
  RiMapPinLine,
  RiPhoneLine,
  RiShoppingBag3Fill,
  RiStore3Fill,
  RiTelegramFill,
  RiTimeLine,
  RiTruckLine,
  RiWalletLine,
} from '@remixicon/react';
import { Badge, Button, Modal } from '@/components/ui';
import type { BuyerOrderItem, OrderStatus } from '@/api/types';
import { ProductImage } from './ProductImage';
import { useCancelOrder } from '@/api/buyer';
import { useToast } from './Toast';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { useMainButton } from '@/lib/useMainButton';
import { hapticImpact, hapticNotify } from '@/lib/haptic';
import { isInTelegram, tgWebApp } from '@/lib/telegram';

interface Props {
  isOpen:       boolean;
  order:        BuyerOrderItem | null;
  uid:          number | null;
  onClose:      () => void;
  snapPoints?:  SnapPoint[];
  initialSnap?: SnapPoint;
}

const STATUS_BANNER_BG: Record<OrderStatus, string> = {
  pending:    'bg-bg-3 text-fg-2',
  confirming: 'bg-warning-subtle text-warning',
  confirmed:  'bg-success-subtle text-success',
  rejected:   'bg-danger-subtle text-danger',
  cancelled:  'bg-bg-3 text-fg-2',
};

const STATUS_HINT: Record<OrderStatus, string> = {
  pending:    "To'lov tizimi tez orada ulanadi — sotuvchi bilan bog'lanib oling.",
  confirming: 'Sotuvchi buyurtmangizni ko\'rib chiqmoqda.',
  confirmed:  "Sotuvchi tasdiqlandi! Yetkazib berish/olib ketish bo'yicha kelishasiz.",
  rejected:   'Sotuvchi buyurtmani rad etdi. Boshqa mahsulot tanlashingiz mumkin.',
  cancelled:  "Buyurtma bekor qilindi.",
};

export function OrderDetailSheet({
  isOpen, order, uid, onClose,
  snapPoints  = ['full'],
  initialSnap = 'full',
}: Props) {
  const [showCancelConfirm, setCancelConfirm] = useState(false);
  const cancelMut = useCancelOrder(uid);
  const toast = useToast();

  // Reset cancel state when sheet opens
  useEffect(() => {
    if (isOpen) { setCancelConfirm(false); cancelMut.reset(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useMainButton({
    text:    'Yopish',
    enabled: isOpen && !showCancelConfirm,
    loading: false,
    onClick: onClose,
  });

  if (!order) return null;

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        snapPoints={snapPoints}
        initialSnap={initialSnap}
        zIndex={50}
        ariaLabel={`Buyurtma ${order.code}`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-2 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-bg-3 text-fg-2 hover:bg-bg-muted z-10"
        >
          <RiCloseFill size={18} />
        </button>

        <StatusBanner order={order} />

        <div className="px-5 pb-5 space-y-4">
          <ProductInfo order={order} />
          <DetailsCard order={order} />
          {(order.contact || order.shop_phone) && <SellerCard order={order} />}
          <ActionsBlock
            order={order}
            onCancel={() => { hapticImpact('light'); setCancelConfirm(true); }}
            onClose={onClose}
            error={cancelMut.isError ? cancelMut.error : null}
          />
        </div>
      </BottomSheet>

      <Modal
        isOpen={showCancelConfirm}
        onClose={() => !cancelMut.isPending && setCancelConfirm(false)}
        title="Buyurtmani bekor qilasizmi?"
      >
        <p className="text-sm text-fg-3 font-body mb-4">
          Bu amalni qaytarib bo'lmaydi. Sotuvchiga avtomatik xabar yuboriladi.
        </p>
        {cancelMut.isError && (
          <p className="text-xs text-danger font-body mb-2">
            {cancelMut.error instanceof Error ? cancelMut.error.message : 'Xato yuz berdi'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setCancelConfirm(false)}
            disabled={cancelMut.isPending}
          >
            Yo'q
          </Button>
          <Button
            variant="danger"
            size="lg"
            disabled={cancelMut.isPending}
            onClick={() => {
              if (!uid) return;
              hapticImpact('medium');
              cancelMut.mutate(
                { code: order.code },
                {
                  onSuccess: () => {
                    hapticNotify('success');
                    toast.show('Buyurtma bekor qilindi', 'info');
                    setCancelConfirm(false);
                    onClose();
                  },
                  onError: (err) => {
                    hapticNotify('error');
                    toast.show(
                      err instanceof Error ? err.message : "Bekor qilib bo'lmadi",
                      'error',
                    );
                  },
                },
              );
            }}
          >
            {cancelMut.isPending ? 'Bekor qilinmoqda...' : 'Ha, bekor qilish'}
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════
function StatusBanner({ order }: { order: BuyerOrderItem }) {
  const cls = STATUS_BANNER_BG[order.status] || STATUS_BANNER_BG.pending;
  const hint = STATUS_HINT[order.status] || '';
  return (
    <div className={cn('mx-5 mt-1 mb-4 rounded-card p-5', cls)}>
      <div className="flex items-center gap-3">
        <div className="text-3xl shrink-0 select-none">{order.status_icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-bold leading-tight">{order.status_text}</p>
          <p className="text-xs opacity-80 font-body mt-0.5">
            {order.cancelled_at && order.status === 'cancelled' ? `Bekor qilindi: ${order.cancelled_at}` : order.created}
          </p>
        </div>
      </div>
      {hint && (
        <p className="text-xs opacity-80 font-body mt-2.5 leading-snug">{hint}</p>
      )}
    </div>
  );
}

function ProductInfo({ order }: { order: BuyerOrderItem }) {
  const photo = order.photo_url || (order.photo_id ? `/api/photo/${order.photo_id}` : '');
  return (
    <div
      className="rounded-card p-5"
      style={{ background: 'var(--color-card-bg)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 rounded-lg overflow-hidden"
          style={{ width: 80, height: 80 }}
        >
          <ProductImage
            src={photo}
            alt={order.name}
            className="w-full h-full object-cover"
            fallbackSize={36}
          />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <h2 className="font-display text-base font-bold text-fg-1 leading-tight">{order.name}</h2>
          {order.shop_name && (
            <p className="text-xs text-fg-3 font-body inline-flex items-center gap-1 mt-1">
              <RiStore3Fill size={12} className="text-fg-4" />
              {order.shop_name}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Badge variant="orange" size="sm">
              {order.type === 'solo' ? '👤 Yakka' : '👥 Guruh'}
            </Badge>
            <Badge variant="gray" size="sm">
              {order.delivery === 'deliver' ? '🚚 Yetkazish' : '🏪 Olib ketish'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailsCard({ order }: { order: BuyerOrderItem }) {
  const toast = useToast();
  const copy = () => {
    hapticImpact('light');
    try {
      navigator.clipboard.writeText(order.code);
      toast.show('Kod nusxalandi', 'success');
    } catch {
      toast.show("Nusxalab bo'lmadi", 'error');
    }
  };
  return (
    <div
      className="p-5 space-y-2"
      style={{
        background:    'var(--color-card-bg)',
        borderRadius:  'var(--radius-block)',
      }}
    >
      <Row
        icon={<RiFileCopyLine size={14} />}
        label="Kod"
        value={
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-fg-1 hover:text-brand"
          >
            #{order.code}
          </button>
        }
      />
      <Row
        icon={<RiTimeLine size={14} />}
        label="Sana"
        value={<span className="font-mono text-sm">{order.created}</span>}
      />
      {order.variant && (
        <Row
          icon={<RiShoppingBag3Fill size={14} />}
          label="Variant"
          value={<span className="font-body text-sm font-medium">{order.variant}</span>}
        />
      )}
      <Row
        icon={order.delivery === 'deliver' ? <RiTruckLine size={14} /> : <RiMapPinLine size={14} />}
        label="Yetkazib berish"
        value={<span className="font-body text-sm">{order.delivery === 'deliver' ? 'Yetkazib berish' : 'Olib ketish'}</span>}
      />
      {order.delivery === 'deliver' && order.address && (
        <Row
          icon={<RiMapPinLine size={14} />}
          label="Manzil"
          value={<span className="font-body text-sm break-words">{order.address}</span>}
        />
      )}
      <div
        className="mt-2 pt-3 flex items-baseline justify-between border-t"
        style={{ borderColor: 'rgba(0, 0, 0, 0.06)' }}
      >
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-2 font-body">
          <RiWalletLine size={14} className="text-fg-3" />
          Jami
        </span>
        <span className="flex items-baseline gap-1">
          <span className="font-mono text-3xl font-bold tabular-nums text-brand leading-none">
            {formatPrice(order.amount)}
          </span>
          <span className="text-sm text-fg-3 font-body">so'm</span>
        </span>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="inline-flex items-center gap-1.5 text-xs text-fg-3 font-body shrink-0">
        <span className="text-fg-4">{icon}</span>
        {label}
      </span>
      <span className="text-right min-w-0">{value}</span>
    </div>
  );
}

function SellerCard({ order }: { order: BuyerOrderItem }) {
  const contact = (order.contact || order.shop_phone || '').trim();
  const handleClick = () => {
    if (!contact) return;
    hapticImpact('light');
    if (contact.startsWith('@')) {
      const tg = tgWebApp();
      const url = `https://t.me/${contact.slice(1)}`;
      if (tg?.openTelegramLink) tg.openTelegramLink(url);
      else window.open(url, '_blank');
    } else {
      window.location.href = `tel:${contact.replace(/[^+\d]/g, '')}`;
    }
  };

  const isTelegram = contact.startsWith('@');
  return (
    <div
      className="rounded-card p-5"
      style={{ background: 'var(--color-card-bg)' }}
    >
      <p className="text-xs text-fg-3 font-body mb-2 inline-flex items-center gap-1.5">
        <RiStore3Fill size={12} className="text-fg-4" />
        Sotuvchi
      </p>
      <p className="font-display text-sm font-semibold text-fg-1 mb-2">{order.shop_name || '—'}</p>
      <Button
        variant="outline"
        size="md"
        fullWidth
        iconLeft={isTelegram ? <RiTelegramFill size={16} /> : <RiPhoneLine size={16} />}
        onClick={handleClick}
        disabled={!contact}
      >
        {contact ? (isTelegram ? `Telegram: ${contact}` : contact) : 'Aloqa yo\'q'}
      </Button>
    </div>
  );
}

function ActionsBlock({
  order, onCancel, onClose, error,
}: { order: BuyerOrderItem; onCancel: () => void; onClose: () => void; error: unknown }) {
  const canCancel = order.status === 'pending' || order.status === 'confirming';
  const inTelegram = isInTelegram();
  const msg = error instanceof Error ? error.message : null;
  return (
    <div className="space-y-2">
      {canCancel && (
        <Button variant="danger" size="lg" fullWidth onClick={onCancel}>
          🚫 Buyurtmani bekor qilish
        </Button>
      )}
      {!inTelegram && (
        <Button variant="ghost" size="md" fullWidth onClick={onClose}>
          Yopish
        </Button>
      )}
      {msg && (
        <p className="text-xs text-danger font-body">{msg}</p>
      )}
    </div>
  );
}
