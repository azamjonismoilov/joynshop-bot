import {
  RiCheckLine,
  RiStore3Fill,
  RiTelegramFill,
} from '@remixicon/react';
import { Button, Card } from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { openSellerBotDeeplink } from '@/lib/telegram';
import { cn } from '@/lib/cn';
import type { MeResponse, OnboardingSteps } from '@/api/types';

interface Props {
  me: MeResponse;
}

const STEP_LABELS: Array<{ key: keyof OnboardingSteps; label: string }> = [
  { key: 'shop_name', label: "Do'kon nomi" },
  { key: 'phone',     label: 'Telefon raqam' },
  { key: 'address',   label: 'Manzil' },
  { key: 'social',    label: 'Ijtimoiy tarmoqlar' },
  { key: 'delivery',  label: 'Yetkazib berish' },
];

export function OnboardingGate({ me }: Props) {
  const steps = me.onboarding_steps ?? {
    shop_name: false, phone: false, address: false, social: false, delivery: false,
  };
  const done  = STEP_LABELS.reduce((n, s) => n + (steps[s.key] ? 1 : 0), 0);
  const total = STEP_LABELS.length;
  const pct   = Math.round((done / total) * 100);

  return (
    <div className="min-h-screen bg-bg-2 flex flex-col">
      <AppHeader tagline="Sotuvchi paneli" />
      <div className="max-w-md w-full mx-auto flex-1 flex flex-col px-4 pb-8">
        {/* Hero */}
        <div className="text-center mt-6 mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-subtle text-brand mb-4">
            <RiStore3Fill size={40} />
          </div>
          {me.first_name && (
            <p className="font-display text-sm text-fg-3 mb-1">
              Salom, {me.first_name} 👋
            </p>
          )}
          <h1 className="font-display text-2xl font-semibold text-fg-1 mb-2">
            Do'koningizni sozlang
          </h1>
          <p className="text-sm text-fg-3 font-body">
            Mini App'dan foydalanish uchun avval botda do'kon
            ma'lumotlarini to'ldiring.
          </p>
        </div>

        {/* Progress */}
        <Card padding="md" className="mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <p className="font-display text-sm font-medium text-fg-2">
              Jarayon
            </p>
            <p className="font-mono text-sm text-fg-2">
              <span className="text-brand font-semibold">{done}</span>
              <span className="text-fg-3">/{total} qadam</span>
            </p>
          </div>
          <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand transition-all duration-base"
              style={{ width: `${pct}%` }}
            />
          </div>
        </Card>

        {/* Steps */}
        <Card padding="md" className="mb-6">
          <ul className="space-y-2.5">
            {STEP_LABELS.map((s) => {
              const isDone = steps[s.key];
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0',
                      isDone
                        ? 'bg-success text-success-fg'
                        : 'bg-bg-3 text-fg-4 border border-border',
                    )}
                  >
                    {isDone && <RiCheckLine size={14} />}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-body',
                      isDone ? 'text-fg-2 line-through decoration-fg-4' : 'text-fg-1',
                    )}
                  >
                    {s.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* CTA */}
        <div className="mt-auto pb-2">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            iconLeft={<RiTelegramFill size={20} />}
            onClick={() => openSellerBotDeeplink('start')}
          >
            Botda davom etish
          </Button>
          <p className="text-xs text-fg-4 text-center mt-3 font-body">
            Botda do'kon ma'lumotlarini to'ldirgach Mini App
            avtomatik ochiladi.
          </p>
        </div>
      </div>
    </div>
  );
}
