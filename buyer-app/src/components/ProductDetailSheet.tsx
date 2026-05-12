import { useEffect, useRef, useState } from 'react';
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseFill,
  RiInboxFill,
  RiPhoneFill,
  RiStore3Fill,
  RiTeamFill,
  RiTimeFill,
} from '@remixicon/react';
import { Badge, Button, Skeleton } from '@/components/ui';
import { useProduct } from '@/api/buyer';
import type { ProductDetail } from '@/api/types';
import { ProductImage } from './ProductImage';
import { cn } from '@/lib/cn';
import { discountPct, formatPrice } from '@/lib/format';
import { useMainButton } from '@/lib/useMainButton';
import { useTelegramBackButton } from '@/lib/useTelegramBackButton';
import { hapticImpact } from '@/lib/haptic';
import { isInTelegram } from '@/lib/telegram';

interface Props {
  isOpen:     boolean;
  pid:        string | null;
  onClose:    () => void;
  /** Buyurtma berish tugmasi bosilganda — parent CheckoutSheet'ni ochadi.
   * Sale type ham uzatiladi (product.sale_type asosida). */
  onBuyClick?: (type: 'group' | 'solo') => void;
}

/**
 * Bottom-sheet — mahsulot detail.
 * - Slide-up animation
 * - Backdrop + tap-to-close
 * - Swipe-down to close (drag handle)
 * - Telegram MainButton — "Guruhga qo'shilish" / "Sotib olish"
 *   (Sprint 2 da checkout flow ulanadi)
 */
export function ProductDetailSheet({ isOpen, pid, onClose, onBuyClick }: Props) {
  const { data, isLoading, isError, error } = useProduct(pid);

  // Scroll lock + ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  useTelegramBackButton(onClose, isOpen);

  const ctaText = data
    ? data.sale_type === 'solo'
      ? `Sotib olish — ${formatPrice(data.solo_price)} so'm`
      : `Guruhga qo'shilish — ${formatPrice(data.group_price)} so'm`
    : 'Yuklanmoqda...';

  const triggerBuy = () => {
    if (!data) return;
    hapticImpact('medium');
    const type: 'group' | 'solo' = data.sale_type === 'solo' ? 'solo' : 'group';
    if (onBuyClick) onBuyClick(type);
  };

  useMainButton({
    text:    ctaText,
    enabled: isOpen && !!data && !isLoading,
    loading: false,
    onClick: triggerBuy,
  });

  const inTelegram = isInTelegram();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center animate-[fadeIn_120ms_ease-out]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <SheetSurface onClose={onClose}>
        {isError ? (
          <ErrorBody error={error} />
        ) : isLoading || !data ? (
          <LoadingBody />
        ) : (
          <DetailBody data={data} inTelegram={inTelegram} onBuy={triggerBuy} />
        )}
      </SheetSurface>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sheet surface — swipe down handler + close button
// ═══════════════════════════════════════════════════════════════
function SheetSurface({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragY    = useRef<{ start: number; current: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    // Faqat sheet top'idagi 60px zonada drag — boshqa joy normal scroll
    const target = e.target as HTMLElement;
    const handle = target.closest('[data-sheet-handle]');
    if (!handle) return;
    dragY.current = { start: e.touches[0].clientY, current: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragY.current) return;
    const dy = e.touches[0].clientY - dragY.current.start;
    if (dy <= 0) return; // faqat pastga
    dragY.current.current = dy;
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  };
  const onTouchEnd = () => {
    if (!dragY.current) return;
    const dy = dragY.current.current;
    if (sheetRef.current) {
      sheetRef.current.style.transform = '';
    }
    if (dy > 120) onClose();
    dragY.current = null;
  };

  return (
    <div
      ref={sheetRef}
      className="relative w-full max-w-md bg-bg-1 rounded-t-3xl shadow-xl max-h-[92vh] flex flex-col animate-[slideUp_240ms_ease-out] overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Drag handle */}
      <div data-sheet-handle className="pt-2.5 pb-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing">
        <div className="w-10 h-1 rounded-full bg-neutral-300" />
      </div>

      {/* Close (brauzer fallback) */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Yopish"
        className="absolute top-2 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-bg-3 text-fg-2 hover:bg-bg-muted z-10"
      >
        <RiCloseFill size={18} />
      </button>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Body — to'liq mahsulot detail
// ═══════════════════════════════════════════════════════════════
function DetailBody({
  data, inTelegram, onBuy,
}: { data: ProductDetail; inTelegram: boolean; onBuy: () => void }) {
  const disc = discountPct(data.original_price, data.group_price);

  return (
    <>
      {/* Gallery */}
      <Gallery photos={data.photos} photoUrls={data.photo_urls || []} fallback={data.photo_url || ''} />

      <div className="px-5 pt-4 pb-5 space-y-4">
        {/* Shop */}
        {data.shop_name && (
          <p className="inline-flex items-center gap-1.5 text-xs text-fg-3 font-body">
            <RiStore3Fill size={14} className="text-brand" />
            <span className="truncate">{data.shop_name}</span>
          </p>
        )}

        {/* Name */}
        <h2 className="font-display text-xl font-bold text-fg-1 break-words leading-tight">
          {data.name}
        </h2>

        {/* Price block */}
        <PriceBlock data={data} disc={disc} />

        {/* Group progress */}
        {data.sale_type !== 'solo' && data.min_group > 1 && (
          <GroupProgress count={data.count} min={data.min_group} deadline={data.deadline} />
        )}

        {/* Description */}
        {data.description && (
          <div>
            <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-1.5">
              Tavsif
            </p>
            <p className="text-sm text-fg-2 font-body whitespace-pre-wrap break-words leading-relaxed">
              {data.description}
            </p>
          </div>
        )}

        {/* Variants */}
        {data.variants && data.variants.length > 0 && (
          <div>
            <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-2">
              Variantlar
            </p>
            <div className="flex flex-wrap gap-1.5">
              {data.variants.map((v) => (
                <Badge key={v} variant="orange" size="md">{v}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        {data.contact && (
          <div className="border-t border-border pt-4">
            <p className="inline-flex items-center gap-2 text-sm text-fg-2 font-body">
              <RiPhoneFill size={14} className="text-fg-3" />
              <span className="font-mono">{data.contact}</span>
            </p>
          </div>
        )}

        {/* Brauzer fallback — HTML CTA. Telegram'da MainButton bor */}
        {!inTelegram && (
          <Button variant="primary" size="lg" fullWidth onClick={onBuy}>
            {data.sale_type === 'solo'
              ? `Sotib olish — ${formatPrice(data.solo_price)} so'm`
              : `Guruhga qo'shilish — ${formatPrice(data.group_price)} so'm`}
          </Button>
        )}
      </div>
    </>
  );
}

function PriceBlock({ data, disc }: { data: ProductDetail; disc: number }) {
  const showGroup = data.sale_type !== 'solo';
  const showSolo  = data.sale_type !== 'group';
  return (
    <div className="space-y-1.5">
      {data.original_price > 0 && (data.group_price < data.original_price || data.solo_price < data.original_price) && (
        <p className="text-sm text-fg-3 font-body">
          Asl narx: <span className="font-mono line-through">{formatPrice(data.original_price)}</span> so'm
        </p>
      )}
      {showGroup && data.group_price > 0 && (
        <div>
          <p className="text-xs text-fg-3 font-body font-medium uppercase tracking-wide mb-1">
            Guruh narxi
          </p>
          <p className="flex items-baseline gap-2 flex-wrap">
            <span className="font-mono text-3xl font-bold tabular-nums text-brand leading-none">
              {formatPrice(data.group_price)}
            </span>
            <span className="text-sm text-fg-3 font-body">so'm</span>
            {disc > 0 && <Badge variant="green" size="sm">−{disc}%</Badge>}
          </p>
        </div>
      )}
      {showSolo && data.solo_price > 0 && (
        <p className="font-body text-sm text-fg-2">
          Yakka narx:{' '}
          <span className="font-mono font-semibold text-fg-1">
            {formatPrice(data.solo_price)}
          </span>{' '}
          so'm
        </p>
      )}
    </div>
  );
}

function GroupProgress({ count, min, deadline }: { count: number; min: number; deadline: string }) {
  const pct = Math.min(100, Math.round((count / min) * 100));
  const needed = Math.max(0, min - count);
  return (
    <div className="bg-bg-2 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-display font-medium text-fg-2">
          <RiTeamFill size={14} className="text-brand" />
          Guruh holati
        </span>
        <span className="font-mono text-sm text-fg-1">
          <span className="font-bold">{count}</span>
          <span className="text-fg-3">/{min}</span>
        </span>
      </div>
      <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand transition-all duration-slow"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-fg-3 font-body mt-2">
        {needed > 0
          ? <>Yana <span className="font-mono font-medium text-fg-1">{needed}</span> kishi kerak</>
          : <span className="text-success">✓ Guruh to'ldi!</span>}
      </p>
      {deadline && (
        <p className="inline-flex items-center gap-1 text-[11px] text-fg-4 font-body mt-1">
          <RiTimeFill size={11} /> {deadline}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Gallery — horizontal swiper
// ═══════════════════════════════════════════════════════════════
function Gallery({
  photos, photoUrls, fallback,
}: { photos: string[]; photoUrls: string[]; fallback: string }) {
  const [idx, setIdx] = useState(0);
  const startX = useRef<number | null>(null);

  // src list — photo_urls afzal, file_id proxy fallback
  const sources: string[] = (() => {
    if (photoUrls.length > 0) return photoUrls;
    if (photos.length > 0)    return photos.map((fid) => `/api/photo/${fid}`);
    if (fallback)             return [fallback];
    return [];
  })();
  const total = sources.length;

  if (total === 0) {
    return (
      <div className="bg-bg-3 flex items-center justify-center" style={{ aspectRatio: '1 / 1' }}>
        <RiInboxFill size={48} className="text-fg-4" />
      </div>
    );
  }

  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = startX.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) {
      setIdx((i) => Math.max(0, Math.min(total - 1, i + (dx > 0 ? 1 : -1))));
    }
    startX.current = null;
  };

  return (
    <div className="relative bg-bg-3 overflow-hidden" style={{ aspectRatio: '1 / 1' }}>
      <div
        className="flex h-full transition-transform duration-base"
        style={{ transform: `translateX(-${idx * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {sources.map((src, i) => (
          <div key={i} className="w-full h-full shrink-0">
            <ProductImage
              src={src}
              alt=""
              className="w-full h-full object-cover"
              fallbackSize={48}
              // Faqat current + qo'shni slide'larni darhol yuklash —
              // qolganlar browser native lazy
              lazy={Math.abs(i - idx) > 1}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Oldingi rasm"
            className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-white disabled:opacity-30 hover:bg-black/55"
          >
            <RiArrowLeftSLine size={22} />
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            aria-label="Keyingi rasm"
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-white disabled:opacity-30 hover:bg-black/55"
          >
            <RiArrowRightSLine size={22} />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {sources.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'block h-1.5 rounded-full transition-all duration-base',
                  i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/60',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LoadingBody() {
  return (
    <div>
      <Skeleton height="100%" rounded="none" style={{ aspectRatio: '1 / 1' }} />
      <div className="px-5 pt-4 pb-5 space-y-3">
        <Skeleton height={14} width="40%" />
        <Skeleton height={28} width="80%" />
        <Skeleton height={20} width="55%" />
        <Skeleton height={60} rounded="xl" />
        <Skeleton height={80} />
      </div>
    </div>
  );
}

function ErrorBody({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : 'Tarmoq xatosi';
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-sm text-danger font-body">{msg}</p>
    </div>
  );
}
