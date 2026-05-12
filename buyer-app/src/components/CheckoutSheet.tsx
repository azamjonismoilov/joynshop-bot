import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from './Toast';
import {
  RiCheckboxCircleFill,
  RiCloseFill,
  RiHome5Line,
  RiMapPinFill,
  RiStore3Fill,
  RiTruckFill,
} from '@remixicon/react';
import { Button, Skeleton } from '@/components/ui';
import { useCheckout, useProduct } from '@/api/buyer';
import type { CheckoutResponse, ProductDetail } from '@/api/types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { useMainButton } from '@/lib/useMainButton';
import { useTelegramBackButton } from '@/lib/useTelegramBackButton';
import { hapticImpact, hapticNotify, hapticSelection } from '@/lib/haptic';
import { getTgUser, isInTelegram, tgWebApp } from '@/lib/telegram';

interface Props {
  isOpen:      boolean;
  pid:         string | null;
  defaultType: 'group' | 'solo';
  onClose:     () => void;
  onSuccess?:  (code: string) => void;
}

type Step = 'variant' | 'delivery' | 'confirm' | 'success';
const ADDRESS_KEY = 'joynshop:buyer:last-address';

export function CheckoutSheet({ isOpen, pid, defaultType, onClose, onSuccess }: Props) {
  const product = useProduct(pid);
  const mutation = useCheckout();
  const toast = useToast();
  const data = product.data;
  const tgUser = getTgUser();

  // Step state
  const initialStep = useMemo<Step>(
    () => (data && data.variants && data.variants.length > 0 ? 'variant' : 'delivery'),
    [data],
  );
  const [step, setStep]         = useState<Step>('delivery');
  const [variant, setVariant]   = useState<string>('');
  const [delivery, setDelivery] = useState<'pickup' | 'deliver'>('pickup');
  const [address, setAddress]   = useState<string>('');
  const [code, setCode]         = useState<string>('');

  // Reset state har gal sheet ochilganda
  useEffect(() => {
    if (!isOpen) return;
    setStep(initialStep);
    setVariant('');
    setDelivery('pickup');
    setCode('');
    try {
      setAddress(localStorage.getItem(ADDRESS_KEY) || '');
    } catch { setAddress(''); }
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialStep]);

  // ESC + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  // Step-aware back: BackButton va swipe-down ham shu logic
  const handleBack = () => {
    hapticImpact('light');
    if (step === 'success')  { onClose(); return; }
    if (step === 'confirm')  { setStep('delivery'); return; }
    if (step === 'delivery') {
      if (data?.variants && data.variants.length > 0) { setStep('variant'); return; }
      onClose(); return;
    }
    onClose();
  };
  useTelegramBackButton(handleBack, isOpen);

  // Submit
  const submit = () => {
    if (!data) return;
    if (!tgUser) {
      hapticNotify('error');
      toast.show("Telegram orqali oching — buyurtma yaratish uchun", 'error');
      return;
    }
    hapticImpact('medium');
    const userName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Foydalanuvchi';
    const finalAddress = delivery === 'deliver' ? address.trim() : '';
    if (delivery === 'deliver') {
      try { localStorage.setItem(ADDRESS_KEY, finalAddress); } catch { /* quota */ }
    }
    mutation.mutate(
      {
        product_id: data.id,
        user_id:    tgUser.id,
        user_name:  userName,
        type:       defaultType,
        variant,
        delivery,
        address:    finalAddress,
      },
      {
        onSuccess: (res: CheckoutResponse) => {
          hapticNotify('success');
          setCode(res.code);
          setStep('success');
          if (onSuccess) onSuccess(res.code);
          // To'lov URL'ini Telegram in-app browser'da ochish (Paylov uchun
          // strategik). Hozir mock — `/start pay_<code>` ga otadi.
          if (res.payment_url) {
            const tg = tgWebApp();
            if (tg?.openTelegramLink && res.payment_url.includes('t.me/')) {
              try { tg.openTelegramLink(res.payment_url); } catch { /* ignore */ }
            }
          }
        },
        onError: () => hapticNotify('error'),
      },
    );
  };

  // MainButton — step bo'yicha matn va enabled
  const mainBtn = useMemo(() => {
    if (!data) return { text: 'Yuklanmoqda', enabled: false };
    switch (step) {
      case 'variant':
        return { text: "Davom etish", enabled: !!variant };
      case 'delivery':
        return {
          text:    'Davom etish',
          enabled: delivery === 'pickup' || address.trim().length >= 10,
        };
      case 'confirm':
        return { text: "🛍 Buyurtma berish", enabled: !mutation.isPending && !!tgUser };
      case 'success':
        return { text: "🏠 Bosh sahifaga qaytish", enabled: true };
    }
  }, [step, variant, delivery, address, data, mutation.isPending, tgUser]);

  const onMain = () => {
    if (step === 'variant')  { setStep('delivery'); return; }
    if (step === 'delivery') { setStep('confirm');  return; }
    if (step === 'confirm')  { submit();            return; }
    if (step === 'success')  { onClose();           return; }
  };

  useMainButton({
    text:    mainBtn.text,
    enabled: isOpen && !!data && mainBtn.enabled,
    loading: mutation.isPending,
    onClick: onMain,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center animate-[fadeIn_120ms_ease-out]"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <Sheet onSwipeDown={step === 'variant' || step === 'delivery' ? onClose : undefined}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-2 right-3 inline-flex items-center justify-center w-9 h-9 rounded-full bg-bg-3 text-fg-2 hover:bg-bg-muted z-10"
        >
          <RiCloseFill size={18} />
        </button>

        {product.isError ? (
          <BodyError msg={product.error instanceof Error ? product.error.message : 'Xato yuz berdi'} />
        ) : !data ? (
          <BodyLoading />
        ) : (
          <>
            <StepHeader step={step} hasVariants={data.variants.length > 0} />
            <div className="px-5 pb-5 space-y-4">
              {step === 'variant'  && <VariantStep data={data} value={variant} onChange={setVariant} />}
              {step === 'delivery' && (
                <DeliveryStep
                  data={data}
                  delivery={delivery}
                  onDelivery={setDelivery}
                  address={address}
                  onAddress={setAddress}
                />
              )}
              {step === 'confirm'  && (
                <ConfirmStep
                  data={data}
                  type={defaultType}
                  variant={variant}
                  delivery={delivery}
                  address={address}
                  error={mutation.isError ? mutation.error : null}
                />
              )}
              {step === 'success'  && <SuccessStep code={code} />}

              {/* Brauzer fallback CTA (Telegram'da MainButton bor) */}
              {!isInTelegram() && step !== 'success' && (
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  disabled={!mainBtn.enabled}
                  onClick={onMain}
                >
                  {mutation.isPending ? 'Yuborilmoqda...' : mainBtn.text}
                </Button>
              )}
              {!isInTelegram() && step === 'success' && (
                <Button variant="primary" size="lg" fullWidth onClick={onClose}>
                  🏠 Bosh sahifaga qaytish
                </Button>
              )}
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sheet surface
// ═══════════════════════════════════════════════════════════════
function Sheet({ onSwipeDown, children }: { onSwipeDown?: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ start: number; current: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!onSwipeDown) return;
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
    if (dy > 120 && onSwipeDown) onSwipeDown();
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

// ═══════════════════════════════════════════════════════════════
//  Step header (progress indicator)
// ═══════════════════════════════════════════════════════════════
function StepHeader({ step, hasVariants }: { step: Step; hasVariants: boolean }) {
  const steps: Step[] = hasVariants
    ? ['variant', 'delivery', 'confirm', 'success']
    : ['delivery', 'confirm', 'success'];
  const titles: Record<Step, string> = {
    variant:  'Variantni tanlang',
    delivery: 'Yetkazib berish',
    confirm:  'Buyurtmani tasdiqlash',
    success:  'Tayyor!',
  };
  const idx = steps.indexOf(step);
  return (
    <div className="px-5 pt-1 pb-3">
      <div className="flex items-center gap-1.5 mb-3">
        {steps.map((s, i) => (
          <div
            key={s}
            className={cn(
              'flex-1 h-1 rounded-full transition-colors duration-base',
              i <= idx ? 'bg-brand' : 'bg-bg-3',
            )}
          />
        ))}
      </div>
      <h2 className="font-display text-lg font-bold text-fg-1">
        {titles[step]}
      </h2>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Step bodies
// ═══════════════════════════════════════════════════════════════
function VariantStep({
  data, value, onChange,
}: { data: ProductDetail; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-sm text-fg-3 font-body mb-3">
        {data.name}
      </p>
      <div className="flex flex-wrap gap-2">
        {data.variants.map((v) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => { hapticSelection(); onChange(v); }}
              className={cn(
                'px-3.5 h-10 rounded-button text-sm font-medium font-display border transition-colors duration-base',
                active
                  ? 'bg-brand text-brand-fg border-brand'
                  : 'bg-bg-1 text-fg-2 border-border hover:border-border-strong',
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
      {!value && (
        <p className="text-xs text-fg-4 font-body mt-3">
          Davom etish uchun variantni tanlang.
        </p>
      )}
    </div>
  );
}

function DeliveryStep({
  data, delivery, onDelivery, address, onAddress,
}: {
  data: ProductDetail;
  delivery: 'pickup' | 'deliver';
  onDelivery: (v: 'pickup' | 'deliver') => void;
  address: string;
  onAddress: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <DeliveryOption
        active={delivery === 'pickup'}
        onClick={() => { hapticSelection(); onDelivery('pickup'); }}
        icon={<RiStore3Fill size={20} />}
        title="Olib ketish"
        subtitle={data.address || data.shop_name || "Sotuvchi manzilidan"}
      />
      <DeliveryOption
        active={delivery === 'deliver'}
        onClick={() => { hapticSelection(); onDelivery('deliver'); }}
        icon={<RiTruckFill size={20} />}
        title="Yetkazib berish"
        subtitle="Manzilingizga olib kelinadi"
      />
      {delivery === 'deliver' && (
        <div>
          <label className="block text-xs text-fg-3 font-body mb-1.5">
            Manzilingiz
          </label>
          <textarea
            value={address}
            onChange={(e) => onAddress(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="Shahar, tuman, ko'cha, uy raqami"
            className="w-full rounded-md border border-border bg-bg-1 px-3 py-2 text-sm font-body text-fg-1 placeholder:text-fg-4 resize-none focus:outline-none focus:border-border-focus"
          />
          <div className="flex items-center justify-between mt-1">
            <span className={cn(
              'text-[11px] font-body',
              address.trim().length >= 10 ? 'text-success' : 'text-fg-4',
            )}>
              {address.trim().length >= 10 ? '✓ Kifoyatli' : `Kamida 10 belgi (${address.trim().length}/10)`}
            </span>
            <span className="text-[10px] text-fg-4 font-mono">{address.length}/200</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryOption({
  active, onClick, icon, title, subtitle,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-3 px-3 py-3 rounded-card border transition-colors duration-base',
        active
          ? 'border-brand bg-brand-subtle'
          : 'border-border bg-bg-1 hover:border-border-strong',
      )}
    >
      <div className={cn(
        'inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
        active ? 'bg-brand text-brand-fg' : 'bg-bg-3 text-fg-3',
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold text-fg-1">{title}</p>
        <p className="text-xs text-fg-3 font-body mt-0.5 line-clamp-2">{subtitle}</p>
      </div>
    </button>
  );
}

function ConfirmStep({
  data, type, variant, delivery, address, error,
}: {
  data: ProductDetail;
  type: 'group' | 'solo';
  variant: string;
  delivery: 'pickup' | 'deliver';
  address: string;
  error: unknown;
}) {
  const amount = type === 'solo' ? data.solo_price : data.group_price;
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Mahsulot',  value: data.name },
    { label: "Do'kon",    value: data.shop_name || '—' },
    { label: 'Tur',       value: type === 'solo' ? 'Yakka' : 'Guruh' },
    ...(variant ? [{ label: 'Variant', value: variant }] : []),
    { label: 'Yetkazish', value: delivery === 'deliver' ? 'Yetkazib berish' : 'Olib ketish' },
    ...(delivery === 'deliver' && address ? [{ label: 'Manzil', value: address }] : []),
  ];
  const msg = error instanceof Error ? error.message : null;
  return (
    <div className="space-y-4">
      <div className="bg-bg-2 rounded-card p-3 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-fg-3 font-body shrink-0">{r.label}</span>
            <span className="text-fg-1 font-body font-medium text-right break-words min-w-0">{r.value}</span>
          </div>
        ))}
      </div>
      <div className="rounded-card bg-brand-subtle px-3 py-3 flex items-baseline justify-between">
        <span className="text-sm font-display font-medium text-fg-2">Jami</span>
        <span>
          <span className="font-mono text-2xl font-bold text-brand">{formatPrice(amount)}</span>
          <span className="text-sm text-fg-3 font-body ml-1">so'm</span>
        </span>
      </div>
      <p className="text-xs text-fg-3 font-body inline-flex items-start gap-1.5">
        <RiMapPinFill size={12} className="text-brand mt-0.5 shrink-0" />
        <span>
          Buyurtma berganingizdan so'ng to'lov sahifasi ochiladi.
          To'lov tizimi tez orada ulanadi — vaqtincha sotuvchi bilan
          to'g'ridan-to'g'ri kelishasiz.
        </span>
      </p>
      {msg && (
        <p className="text-sm text-danger font-body bg-danger-subtle rounded-md px-3 py-2">
          {msg}
        </p>
      )}
    </div>
  );
}

function SuccessStep({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const copy = () => {
    hapticImpact('light');
    try {
      navigator.clipboard.writeText(code);
      setCopied(true);
      toast.show('Kod nusxalandi', 'success');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.show("Nusxalab bo'lmadi", 'error');
    }
  };
  return (
    <div className="text-center py-2">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-subtle text-success mb-4">
        <RiCheckboxCircleFill size={48} />
      </div>
      <h3 className="font-display text-lg font-bold text-fg-1 mb-1">
        Buyurtma qabul qilindi!
      </h3>
      <p className="text-sm text-fg-3 font-body mb-4">
        Sotuvchi tasdiqlangach Telegram'dan xabar yuboriladi.
      </p>
      <button
        type="button"
        onClick={copy}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors duration-base',
          copied ? 'bg-success-subtle text-success' : 'bg-bg-3 text-fg-1 hover:bg-bg-muted',
        )}
        aria-label="Kodni nusxalash"
      >
        <span className="text-xs font-body opacity-70">
          {copied ? '✓ Nusxalandi' : 'Buyurtma:'}
        </span>
        <span className="font-mono text-sm font-bold">{code}</span>
      </button>
      <p className="text-xs text-fg-3 font-body mt-5 max-w-xs mx-auto inline-flex items-start gap-1.5 justify-center">
        <RiHome5Line size={14} className="text-brand mt-0.5 shrink-0" />
        <span>
          To'lov tizimi tez orada ulanadi. Hozircha sotuvchi
          bilan bog'laning yoki kuting — to'lov havolasi tayyor
          bo'lishi bilan Telegram'dan yuboramiz.
        </span>
      </p>
    </div>
  );
}

function BodyLoading() {
  return (
    <div className="px-5 py-5 space-y-3">
      <Skeleton height={20} width="40%" />
      <Skeleton height={56} rounded="xl" />
      <Skeleton height={56} rounded="xl" />
    </div>
  );
}

function BodyError({ msg }: { msg: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm text-danger font-body">{msg}</p>
    </div>
  );
}
