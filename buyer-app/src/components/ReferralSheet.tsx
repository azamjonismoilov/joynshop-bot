import { useEffect, useRef, useState } from 'react';
import {
  RiCloseFill,
  RiFileCopyLine,
  RiShareForwardFill,
  RiTeamFill,
} from '@remixicon/react';
import { Button } from '@/components/ui';
import { useMainButton } from '@/lib/useMainButton';
import { useTelegramBackButton } from '@/lib/useTelegramBackButton';
import { hapticImpact, hapticNotify } from '@/lib/haptic';
import { isInTelegram, tgWebApp } from '@/lib/telegram';
import { formatPrice } from '@/lib/format';

interface Props {
  isOpen:  boolean;
  uid:     number | null;
  count:   number;
  onClose: () => void;
}

const SHARE_TEXT =
  "🛍 Joynshop'da do'stlar bilan birgalikda xarid qilib 40% gacha tejayapman! Sen ham qo'shilib ko'r 👇";
const CASHBACK_PER = 10000;

export function ReferralSheet({ isOpen, uid, count, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCopied(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  useTelegramBackButton(onClose, isOpen);

  const refLink = uid
    ? `https://t.me/${(import.meta.env.VITE_BUYER_BOT_USERNAME || 'joynshop_bot')}?start=ref_${uid}`
    : '';

  const share = () => {
    if (!refLink) return;
    hapticImpact('light');
    const url   = encodeURIComponent(refLink);
    const text  = encodeURIComponent(SHARE_TEXT);
    const share = `https://t.me/share/url?url=${url}&text=${text}`;
    const tg    = tgWebApp();
    if (tg?.openTelegramLink) tg.openTelegramLink(share);
    else window.open(share, '_blank');
  };

  const copy = () => {
    if (!refLink) return;
    try {
      navigator.clipboard.writeText(refLink);
      setCopied(true);
      hapticNotify('success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      hapticNotify('error');
    }
  };

  useMainButton({
    text:    '📤 Telegram\'da ulashish',
    enabled: isOpen && !!refLink,
    loading: false,
    onClick: share,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end justify-center animate-[fadeIn_120ms_ease-out]"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <Sheet onSwipeDown={onClose}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-2 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-bg-3 text-fg-2 hover:bg-bg-muted z-10"
        >
          <RiCloseFill size={18} />
        </button>

        <div className="px-5 pt-2 pb-5">
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-subtle text-brand mb-3">
              <RiTeamFill size={32} />
            </div>
            <h2 className="font-display text-xl font-bold text-fg-1">Do'stni taklif qiling</h2>
            <p className="text-sm text-fg-3 font-body mt-1 max-w-xs mx-auto">
              Har taklif uchun siz va do'stingiz{' '}
              <span className="font-mono font-semibold text-brand">10,000 so'm</span> cashback olasiz.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Stat label="Takliflar"  value={`${count}`} />
            <Stat label="Cashback"   value={`${formatPrice(count * CASHBACK_PER)} so'm`} valueClass="text-brand" />
          </div>

          {/* Link row */}
          <p className="text-xs text-fg-3 font-body mb-1.5">Sizning havolangiz</p>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={refLink}
              readOnly
              onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
              className="flex-1 min-w-0 h-10 px-3 rounded-input border border-border bg-bg-2 text-xs font-mono text-fg-1 outline-none focus:border-border-focus"
            />
            <Button
              variant={copied ? 'success' : 'outline'}
              size="md"
              iconLeft={<RiFileCopyLine size={16} />}
              onClick={copy}
              disabled={!refLink}
            >
              {copied ? 'Nusxalandi' : 'Nusxa'}
            </Button>
          </div>

          {/* Brauzer fallback CTA */}
          {!isInTelegram() && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              iconLeft={<RiShareForwardFill size={20} />}
              onClick={share}
              disabled={!refLink}
            >
              Telegram'da ulashish
            </Button>
          )}

          <p className="text-[11px] text-fg-4 font-body mt-3 text-center">
            Do'stingiz havola orqali botga kirib birinchi buyurtma berganda
            ikkala tomon cashback oladi.
          </p>
        </div>
      </Sheet>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-bg-2 rounded-xl p-3 text-center">
      <p className={`font-mono text-base font-bold leading-tight ${valueClass ?? 'text-fg-1'}`}>{value}</p>
      <p className="text-[10px] text-fg-3 font-body mt-0.5">{label}</p>
    </div>
  );
}

function Sheet({ onSwipeDown, children }: { onSwipeDown: () => void; children: React.ReactNode }) {
  const ref  = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; current: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-sheet-handle]')) return;
    drag.current = { start: e.touches[0].clientY, current: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current) return;
    const dy = e.touches[0].clientY - drag.current.start;
    if (dy <= 0) return;
    drag.current.current = dy;
    if (ref.current) ref.current.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = () => {
    if (!drag.current) return;
    const dy = drag.current.current;
    if (ref.current) ref.current.style.transform = '';
    if (dy > 120) onSwipeDown();
    drag.current = null;
  };

  return (
    <div
      ref={ref}
      className="relative w-full max-w-md bg-bg-1 rounded-t-3xl shadow-xl max-h-[92vh] flex flex-col animate-[slideUp_240ms_ease-out] overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div data-sheet-handle className="pt-2.5 pb-1.5 flex items-center justify-center cursor-grab active:cursor-grabbing">
        <div className="w-10 h-1 rounded-full bg-neutral-300" />
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
