import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import {
  RiCloseFill,
  RiFileCopyLine,
  RiShareForwardFill,
  RiTeamFill,
} from '@remixicon/react';
import { Button } from '@/components/ui';
import { useMainButton } from '@/lib/useMainButton';
import { hapticImpact, hapticNotify } from '@/lib/haptic';
import { isInTelegram, tgWebApp } from '@/lib/telegram';
import { formatPrice } from '@/lib/format';
import { useToast } from './Toast';

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
  const toast = useToast();

  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);


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
      toast.show('Link nusxalandi', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      hapticNotify('error');
      toast.show("Nusxalab bo'lmadi", 'error');
    }
  };

  useMainButton({
    text:    '📤 Telegram\'da ulashish',
    enabled: isOpen && !!refLink,
    loading: false,
    onClick: share,
  });

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={['full']}
      zIndex={55}
      ariaLabel="Do'stni taklif qilish"
    >
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
    </BottomSheet>
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
