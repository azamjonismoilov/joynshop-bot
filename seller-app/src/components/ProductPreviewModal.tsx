import { useState } from 'react';
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMapPinFill,
  RiPhoneFill,
  RiTeamFill,
  RiTimeFill,
} from '@remixicon/react';
import { Button, Modal } from '@/components/ui';
import type {
  CategoryItem,
  MxikItem,
  ProductSaleType,
  ShopBrief,
} from '@/api/types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';

interface PreviewData {
  name:           string;
  category:       string;
  saleType:       ProductSaleType;
  originalPrice:  number;
  groupPrice:     number;
  soloPrice:      number;
  minGroup:       number;
  description:    string;
  variants:       string[];
  mxik:           MxikItem | null;
  deadlineHours:  number;
  photoUrls:      string[];
  shop:           ShopBrief | { name: string; phone: string; phone2: string; address: string } | null;
  categories?:    CategoryItem[];
}

interface Props {
  isOpen:    boolean;
  onClose:   () => void;
  onConfirm: () => void;
  data:      PreviewData;
  isSubmitting?: boolean;
}

const DEADLINE_LABELS: Record<number, string> = {
  24:  '24 soat',
  48:  '2 kun',
  72:  '3 kun',
  168: '1 hafta',
};

export function ProductPreviewModal({
  isOpen, onClose, onConfirm, data, isSubmitting,
}: Props) {
  const [idx, setIdx] = useState(0);
  const photos = data.photoUrls;
  const total  = photos.length;
  const safeIdx = total > 0 ? Math.min(idx, total - 1) : 0;
  const discount = data.originalPrice && data.groupPrice && data.groupPrice < data.originalPrice
    ? Math.round(((data.originalPrice - data.groupPrice) / data.originalPrice) * 100)
    : 0;
  const catIcon = data.categories?.find((c) => c.name === data.category)?.icon || '📦';
  const deadlineLabel = DEADLINE_LABELS[data.deadlineHours] || `${data.deadlineHours} soat`;
  const showGroup = data.saleType !== 'solo';
  const showSolo  = data.saleType !== 'group';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kanal posti ko'rinishi">
      <p className="text-sm text-fg-3 font-body mb-3">
        Xaridorlar shu ko'rinishda ko'radi:
      </p>

      <div className="bg-bg-2 rounded-card overflow-hidden border border-border">
        {/* Photo */}
        {total > 0 && (
          <div className="relative bg-bg-3" style={{ aspectRatio: '4 / 3' }}>
            <img
              src={photos[safeIdx]}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={safeIdx === 0}
                  aria-label="Oldingi"
                  className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white disabled:opacity-30"
                >
                  <RiArrowLeftSLine size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
                  disabled={safeIdx === total - 1}
                  aria-label="Keyingi"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white disabled:opacity-30"
                >
                  <RiArrowRightSLine size={20} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-mono">
                  {safeIdx + 1}/{total}
                </div>
              </>
            )}
          </div>
        )}

        {/* Caption — Telegram chat style */}
        <div className="p-4 space-y-3 bg-bg-1">
          <div>
            <p className="font-display text-base font-semibold text-fg-1 break-words">
              🛍 {data.name}
            </p>
            {data.category && (
              <p className="text-xs text-fg-3 font-body mt-0.5">
                {catIcon} {data.category}
              </p>
            )}
          </div>

          {/* Pricing block */}
          <div className="space-y-1">
            <p className="text-xs text-fg-3 font-body">💰 Narx:</p>
            {showGroup && data.originalPrice > 0 && (
              <p className="text-sm text-fg-2 font-body">
                Asl: <span className="font-mono line-through text-fg-3">{formatPrice(data.originalPrice)}</span> so'm
              </p>
            )}
            {showGroup && data.groupPrice > 0 && (
              <p className="text-sm font-body">
                Guruh:{' '}
                <span className="font-mono font-bold text-brand">
                  {formatPrice(data.groupPrice)}
                </span>{' '}
                so'm{discount > 0 && (
                  <span className="ml-1 text-success font-semibold">(−{discount}%)</span>
                )}
              </p>
            )}
            {showSolo && data.soloPrice > 0 && (
              <p className="text-sm font-body">
                Yakka:{' '}
                <span className="font-mono font-semibold text-fg-1">
                  {formatPrice(data.soloPrice)}
                </span>{' '}
                so'm
              </p>
            )}
            {data.saleType === 'solo' && data.originalPrice > 0 && showGroup === false && (
              <p className="text-sm font-body">
                Narx:{' '}
                <span className="font-mono font-bold text-brand">
                  {formatPrice(data.originalPrice)}
                </span>{' '}
                so'm
              </p>
            )}
          </div>

          {/* Group + deadline */}
          {showGroup && data.minGroup > 1 && (
            <p className="text-sm text-fg-2 font-body inline-flex items-center gap-1">
              <RiTeamFill size={14} className="text-fg-3" />
              Min guruh: <span className="font-mono font-medium">{data.minGroup}</span> kishi
            </p>
          )}
          <p className="text-sm text-fg-2 font-body inline-flex items-center gap-1">
            <RiTimeFill size={14} className="text-fg-3" />
            Muddat: <span className="font-medium">{deadlineLabel}</span>
          </p>

          {/* Description */}
          {data.description && (
            <p className="text-sm text-fg-2 font-body whitespace-pre-wrap break-words">
              📝 {data.description}
            </p>
          )}

          {/* Variants */}
          {data.variants.length > 0 && (
            <p className="text-sm text-fg-2 font-body">
              🎨 Variantlar: <span className="font-medium">{data.variants.join(', ')}</span>
            </p>
          )}

          {/* Shop info */}
          {data.shop && (
            <div className="pt-3 border-t border-border space-y-1">
              <p className="text-sm font-display font-medium text-fg-1">
                🏪 {data.shop.name || '—'}
              </p>
              {data.shop.address && (
                <p className="text-xs text-fg-3 font-body inline-flex items-start gap-1">
                  <RiMapPinFill size={12} className="shrink-0 mt-0.5" />
                  <span className="break-words">{data.shop.address}</span>
                </p>
              )}
              {data.shop.phone && (
                <p className="text-xs text-fg-3 font-mono inline-flex items-center gap-1">
                  <RiPhoneFill size={12} />
                  {data.shop.phone}
                </p>
              )}
            </div>
          )}

          {/* MXIK (small footer) */}
          {data.mxik?.code && (
            <p className="text-[10px] text-fg-4 font-mono pt-1">
              MXIK: {data.mxik.code}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className={cn('grid grid-cols-2 gap-2 mt-4')}>
        <Button variant="outline" size="lg" onClick={onClose} disabled={isSubmitting}>
          Tahrirlash
        </Button>
        <Button variant="primary" size="lg" onClick={onConfirm} disabled={isSubmitting}>
          {isSubmitting ? "E'lon qilinmoqda..." : "E'lon qilish"}
        </Button>
      </div>
    </Modal>
  );
}
