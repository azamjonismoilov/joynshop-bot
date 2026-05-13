import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  RiBox3Fill,
  RiEdit2Line,
  RiExternalLinkLine,
  RiGlobalFill,
  RiInstagramFill,
  RiMapPinLine,
  RiPhoneLine,
  RiShoppingBag3Fill,
  RiStore3Fill,
  RiTelegramFill,
  RiTruckLine,
  RiWalletLine,
} from '@remixicon/react';
import { Badge, Card, Skeleton } from '@/components/ui';
import { useSellerShopDetail } from '@/api/seller';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/ErrorState';
import { EditShopModal, type ShopEditField } from '@/components/EditShopModal';
import type { ShopDetail } from '@/api/types';
import { formatPriceShort } from '@/lib/format';

export function ShopDetailScreen() {
  const params   = useParams<{ id: string }>();
  const idx      = params.id !== undefined ? Number(params.id) : undefined;
  const { data, isLoading, isError, error, refetch } = useSellerShopDetail(idx);

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline={data?.name || "Do'kon"} showBack />

      <main className="px-4 mt-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton height={120} rounded="xl" />
            <Skeleton height={100} rounded="xl" />
            <Skeleton height={100} rounded="xl" />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data ? (
          <ErrorState error={new Error("Do'kon topilmadi")} onRetry={() => refetch()} />
        ) : (
          <ShopContent data={data} />
        )}
      </main>
    </div>
  );
}

function ShopContent({ data }: { data: ShopDetail }) {
  const [edit, setEdit] = useState<ShopEditField | null>(null);
  return (
    <div className="space-y-3">
      {/* Hero */}
      <Card padding="md">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-brand-subtle text-brand shrink-0">
            <RiStore3Fill size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-lg font-semibold text-fg-1 truncate">
                {data.name || '—'}
              </h2>
              <Badge variant={data.onboarding_status === 'active' ? 'green' : 'gray'} size="sm">
                {data.onboarding_status === 'active' ? 'Faol' : 'Passiv'}
              </Badge>
            </div>
            {data.channel && (
              <p className="text-xs text-fg-3 font-body mt-0.5 truncate">
                {data.channel}
              </p>
            )}
          </div>
          <EditIconButton onClick={() => setEdit('name')} />
        </div>

        {/* Quick stats grid */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
          <Stat icon={<RiBox3Fill size={16} />} label="Mahsulot" value={String(data.products_count)} />
          <Stat icon={<RiShoppingBag3Fill size={16} />} label="Buyurtma" value={String(data.orders_confirmed)} />
          <Stat icon={<RiWalletLine size={16} />} label="Daromad" value={formatPriceShort(data.revenue)} />
        </div>
      </Card>

      {/* Basic info */}
      <Card padding="md">
        <SectionHeader label="Asosiy ma'lumotlar" onEdit={() => setEdit('contact')} />
        <InfoRow
          icon={<RiPhoneLine size={14} />}
          label="Telefon"
          value={data.phone || '—'}
          mono
        />
        {data.phone2 && (
          <InfoRow
            icon={<RiPhoneLine size={14} />}
            label="Qo'shimcha telefon"
            value={data.phone2}
            mono
          />
        )}
        <InfoRow
          icon={<RiMapPinLine size={14} />}
          label="Manzil"
          value={data.address || '—'}
        />
      </Card>

      {/* Delivery */}
      <Card padding="md">
        <SectionHeader label="Yetkazib berish" onEdit={() => setEdit('delivery')} />
        <div className="flex items-center gap-2.5 py-1">
          <RiTruckLine size={18} className="text-brand shrink-0" />
          <span className="text-sm text-fg-1 font-body">
            {data.delivery_label || '—'}
          </span>
        </div>
      </Card>

      {/* Social */}
      <Card padding="md">
        <SectionHeader label="Ijtimoiy tarmoqlar" onEdit={() => setEdit('social')} />
        <SocialList social={data.social} />
      </Card>

      {/* Activity (read-only) */}
      {data.last_order && (
        <Card padding="md">
          <SectionTitle label="Faollik" />
          <InfoRow
            label="Oxirgi buyurtma"
            value={data.last_order}
            mono
          />
          <InfoRow
            label="Jami buyurtma"
            value={`${data.orders_total} ta`}
            mono
          />
        </Card>
      )}

      {edit && (
        <EditShopModal
          isOpen={edit !== null}
          onClose={() => setEdit(null)}
          field={edit}
          shop={data}
        />
      )}
    </div>
  );
}

function SectionHeader({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3">
        {label}
      </p>
      <EditIconButton onClick={onEdit} />
    </div>
  );
}

function EditIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Tahrirlash"
      className="inline-flex items-center justify-center w-8 h-8 rounded-md text-fg-3 hover:bg-bg-2 hover:text-brand transition-colors duration-base shrink-0"
    >
      <RiEdit2Line size={16} />
    </button>
  );
}

function SocialList({ social }: { social: Record<string, string> }) {
  const entries = Object.entries(social || {}).filter(([, v]) => v && v.trim());
  if (entries.length === 0) {
    return (
      <p className="text-sm text-fg-3 font-body py-1">
        Ijtimoiy tarmoqlar qo'shilmagan
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {entries.map(([key, value]) => {
        const icon = socialIcon(key);
        const href = socialHref(key, value);
        return (
          <li key={key} className="flex items-center gap-2.5">
            <span className="text-brand shrink-0">{icon}</span>
            <span className="text-xs text-fg-3 font-body uppercase tracking-wide w-20 shrink-0">
              {key}
            </span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-secondary hover:underline truncate inline-flex items-center gap-1"
              >
                <span className="truncate">{value}</span>
                <RiExternalLinkLine size={12} className="shrink-0" />
              </a>
            ) : (
              <span className="text-sm text-fg-1 font-body truncate">{value}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function socialIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes('instagram')) return <RiInstagramFill size={16} />;
  if (k.includes('telegram'))  return <RiTelegramFill size={16} />;
  if (k.includes('web') || k.includes('site') || k.includes('url')) return <RiGlobalFill size={16} />;
  return <RiGlobalFill size={16} />;
}

function socialHref(key: string, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  const k = key.toLowerCase();
  if (k.includes('instagram')) {
    const handle = v.replace(/^@/, '');
    return `https://instagram.com/${handle}`;
  }
  if (k.includes('telegram')) {
    const handle = v.replace(/^@/, '');
    return `https://t.me/${handle}`;
  }
  if (k.includes('web') || k.includes('site') || k.includes('url')) {
    return `https://${v}`;
  }
  return null;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-bg-3 text-fg-3 mb-1.5">
        {icon}
      </div>
      <p className="font-mono text-lg font-bold tabular-nums text-fg-1 leading-none">{value}</p>
      <p className="text-[10px] text-fg-3 font-body mt-0.5">{label}</p>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-3">
      {label}
    </p>
  );
}

function InfoRow({
  icon, label, value, mono,
}: { icon?: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-1.5 text-xs text-fg-3 font-body">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-sm text-fg-1 mt-0.5 break-words ${mono ? 'font-mono' : 'font-body'}`}>
        {value}
      </p>
    </div>
  );
}
