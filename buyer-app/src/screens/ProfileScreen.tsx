import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowRightSLine,
  RiFileTextFill,
  RiHeart3Fill,
  RiInformationFill,
  RiQuestionFill,
  RiShareForwardFill,
  RiShieldUserFill,
  RiShoppingBag3Fill,
  RiTelegramFill,
  RiTeamFill,
  RiUser3Fill,
} from '@remixicon/react';
import { Avatar } from '@/components/Avatar';
import { AppHeader } from '@/components/AppHeader';
import { Card, Skeleton } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { ReferralSheet } from '@/components/ReferralSheet';
import { useBuyerProfile } from '@/api/buyer';
import { cn } from '@/lib/cn';
import { formatPrice, formatPriceShort } from '@/lib/format';
import { hapticImpact } from '@/lib/haptic';
import { getTgUser, isInTelegram, tgWebApp, openBuyerBotDeeplink } from '@/lib/telegram';
import { useAvatar } from '@/lib/useAvatar';

export function ProfileScreen() {
  const navigate = useNavigate();
  const user     = getTgUser();
  const uid      = user?.id ?? null;
  const query    = useBuyerProfile(uid);
  const avatar   = useAvatar();

  const [showReferral, setShowReferral] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-2 pb-28">
        <AppHeader tagline="Profil" />
        <div className="px-4 mt-4">
          <EmptyState
            icon={<RiUser3Fill size={36} />}
            title="Telegram orqali kiring"
            description="Profil sahifasi Telegram hisobingiz bilan bog'liq."
          />
        </div>
      </div>
    );
  }

  const data = query.data;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Foydalanuvchi';

  return (
    <div className="min-h-screen bg-bg-2 pb-28">
      <AppHeader tagline="Profil" />

      <main className="px-4 mt-4 space-y-4">
        {/* Header card */}
        <Card padding="md">
          <div className="flex items-center gap-3">
            <Avatar name={name} photoUrl={avatar} size={64} />
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-xl font-bold text-fg-1 truncate">{name}</h2>
              {user.username
                ? <p className="text-sm text-fg-3 font-mono">@{user.username}</p>
                : <p className="text-xs text-fg-4 font-mono">ID: {user.id}</p>}
            </div>
          </div>
        </Card>

        {/* Stats — 3 cards */}
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <section className="grid grid-cols-3 gap-2">
            <StatCard
              icon={<RiShoppingBag3Fill size={18} className="text-brand" />}
              value={query.isLoading ? '—' : String(data?.confirmed_orders ?? 0)}
              label="Buyurtmalar"
            />
            <StatCard
              icon={<RiTeamFill size={18} className="text-secondary" />}
              value={query.isLoading ? '—' : String(data?.groups_joined ?? 0)}
              label="Guruhlar"
            />
            <StatCard
              icon={<RiShareForwardFill size={18} className="text-success" />}
              value={query.isLoading ? '—' : formatPriceShort(data?.cashback ?? 0)}
              label="Cashback so'm"
              valueClass="text-success"
            />
          </section>
        )}

        {/* Referral card — brand bg (CTA aksent) */}
        <div
          className="rounded-card p-4 bg-brand text-brand-fg"
          style={{ boxShadow: '0 4px 16px 0 rgba(250, 115, 25, 0.15)' }}
        >
          <div className="flex items-start gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/20 text-brand-fg shrink-0">
              <RiTeamFill size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-bold text-brand-fg">
                Do'stni taklif qiling
              </p>
              <p className="text-xs text-brand-fg/85 font-body mt-0.5">
                Har taklif uchun{' '}
                <span className="font-mono font-semibold">10,000 so'm</span> cashback.
              </p>
              {query.data && query.data.referral_count > 0 && (
                <p className="text-[11px] text-brand-fg/75 font-body mt-1">
                  Siz {query.data.referral_count} ta do'st taklif qilgansiz —{' '}
                  <span className="font-mono">{formatPrice(query.data.referral_count * 10000)} so'm</span> cashback yig'gansiz.
                </p>
              )}
              <button
                type="button"
                onClick={() => { hapticImpact('light'); setShowReferral(true); }}
                className="inline-flex items-center gap-1 mt-2.5 px-3 h-8 rounded-button bg-bg-1 text-brand text-xs font-medium font-display hover:bg-bg-1/90 transition-colors duration-base"
              >
                <RiShareForwardFill size={14} />
                Taklif qilish
              </button>
            </div>
          </div>
        </div>

        {/* Menu list */}
        <Card padding="none">
          <MenuRow
            icon={<RiShoppingBag3Fill size={18} className="text-brand" />}
            label="Buyurtmalarim"
            value={query.data ? String(query.data.total_orders) : undefined}
            onClick={() => { hapticImpact('light'); navigate('/orders'); }}
          />
          <Divider />
          <MenuRow
            icon={<RiHeart3Fill size={18} className="text-danger" />}
            label="Saqlanganlar"
            onClick={() => { hapticImpact('light'); navigate('/wishlist'); }}
          />
          <Divider />
          <MenuRow
            icon={<RiQuestionFill size={18} className="text-secondary" />}
            label="Yordam markazi"
            hint="Tez orada"
            disabled
          />
          <Divider />
          <MenuRow
            icon={<RiFileTextFill size={18} className="text-fg-3" />}
            label="Foydalanuvchi shartnomasi"
            onClick={() => {
              hapticImpact('light');
              window.open('https://telegra.ph/Joynshop-Foydalanuvchi-Shartnomasi-05-15', '_blank', 'noopener,noreferrer');
            }}
          />
          <Divider />
          <MenuRow
            icon={<RiShieldUserFill size={18} className="text-fg-3" />}
            label="Maxfiylik siyosati"
            onClick={() => {
              hapticImpact('light');
              window.open('https://telegra.ph/Joynshop-Maxfiylik-Siyosati-05-15', '_blank', 'noopener,noreferrer');
            }}
          />
          <Divider />
          <MenuRow
            icon={<RiInformationFill size={18} className="text-fg-3" />}
            label="Joynshop haqida"
            hint="Tez orada"
            disabled
          />
        </Card>

        {/* Footer actions */}
        <div className="pt-2 pb-2 text-center space-y-2">
          <button
            type="button"
            onClick={() => {
              hapticImpact('light');
              const tg = tgWebApp();
              if (isInTelegram() && tg?.close) tg.close();
              else openBuyerBotDeeplink('start');
            }}
            className="inline-flex items-center gap-1.5 text-xs text-fg-3 font-body hover:text-fg-1 transition-colors duration-base"
          >
            <RiTelegramFill size={14} />
            Bot'ga qaytish
          </button>
          <p className="text-[10px] text-fg-4 font-mono">
            Joynshop · v1.0
          </p>
        </div>
      </main>

      <ReferralSheet
        isOpen={showReferral}
        uid={uid}
        count={data?.referral_count ?? 0}
        onClose={() => setShowReferral(false)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════
function StatCard({
  icon, value, label, valueClass,
}: { icon: React.ReactNode; value: string; label: string; valueClass?: string }) {
  return (
    <Card padding="sm" className="text-center">
      <div className="inline-flex items-center justify-center mb-1">{icon}</div>
      <p className={cn('font-mono text-2xl font-bold tabular-nums leading-none', valueClass || 'text-fg-1')}>
        {value === '—' ? <Skeleton width={40} height={24} className="mx-auto" /> : value}
      </p>
      <p className="text-[11px] text-fg-3 font-body leading-tight mt-1">{label}</p>
    </Card>
  );
}

function MenuRow({
  icon, label, value, hint, disabled, onClick,
}: {
  icon:    React.ReactNode;
  label:   string;
  value?:  string;
  hint?:   string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors duration-base',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-2 active:bg-bg-3',
      )}
    >
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-bg-3 shrink-0">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-sm font-medium text-fg-1">{label}</span>
        {hint && <span className="block text-[11px] text-fg-4 font-body mt-0.5">{hint}</span>}
      </span>
      {value && (
        <span className="font-mono text-xs text-fg-3 shrink-0">{value}</span>
      )}
      {!disabled && <RiArrowRightSLine size={18} className="text-fg-4 shrink-0" />}
    </button>
  );
}

function Divider() {
  // Wallet pattern — icon tagidan o'tmaydi, text qatorida bo'ladi.
  // Icon container 36px (w-9) + gap-3 (12px) = 48px chap padding (px-3=12px qoldi → 48-12=36).
  // px-3 (card outer padding) + w-9 + gap-3 dan keyingi joyda turadi.
  return (
    <div
      className="h-px"
      style={{
        marginLeft:  'calc(0.75rem + 2.25rem + 0.75rem)', // px-3 + w-9 + gap-3
        marginRight: '0.75rem',
        background:  'rgba(0, 0, 0, 0.06)',
      }}
    />
  );
}
