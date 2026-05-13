import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  RiCloseFill,
  RiEdit2Line,
  RiErrorWarningFill,
  RiExternalLinkLine,
  RiHeart3Fill,
  RiShoppingBag3Fill,
  RiTeamFill,
  RiTimeLine,
  RiWalletLine,
} from '@remixicon/react';
import {
  Badge,
  Button,
  Card,
  Modal,
  Skeleton,
} from '@/components/ui';
import {
  useCloseProduct,
  useSellerProductDetail,
} from '@/api/seller';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/ErrorState';
import { EditProductModal, type EditField } from '@/components/EditProductModal';
import { cn } from '@/lib/cn';
import { formatPrice, formatPriceShort } from '@/lib/format';
import type { ProductDetailResponse, ProductSaleType } from '@/api/types';
import { hapticNotify } from '@/lib/haptic';

const SALE_TYPE_LABEL: Record<ProductSaleType, string> = {
  both:  'Guruh va yakka',
  group: 'Faqat guruh',
  solo:  'Faqat yakka',
};

export function ProductDetailScreen() {
  const { pid } = useParams<{ pid: string }>();
  const { data, isLoading, isError, error, refetch } = useSellerProductDetail(pid);
  const [editField, setEditField] = useState<EditField | null>(null);
  const [showClose, setShowClose] = useState(false);

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline={data?.name || 'Mahsulot'} showBack />

      <main className="px-4 mt-4 space-y-4">
        {isLoading ? (
          <DetailSkeleton />
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data ? (
          <ErrorState error={new Error("Mahsulot topilmadi")} onRetry={() => refetch()} />
        ) : (
          <DetailContent
            data={data}
            onEdit={setEditField}
            onClose={() => setShowClose(true)}
          />
        )}
      </main>

      {data && editField && (
        <EditProductModal
          isOpen={editField !== null}
          onClose={() => setEditField(null)}
          product={data}
          field={editField}
        />
      )}

      {data && (
        <CloseConfirmModal
          isOpen={showClose}
          onClose={() => setShowClose(false)}
          pid={data.id}
          name={data.name}
        />
      )}
    </div>
  );
}

function DetailContent({
  data, onEdit, onClose,
}: {
  data: ProductDetailResponse;
  onEdit: (f: EditField) => void;
  onClose: () => void;
}) {
  const canEdit  = data.actions.can_edit;
  const canClose = data.actions.can_close;
  const discount = data.original_price
    ? Math.round(((data.original_price - data.group_price) / data.original_price) * 100)
    : 0;

  return (
    <>
      {/* Photos */}
      {data.photos.length > 0 && (
        <PhotosGallery photos={data.photos} />
      )}

      {/* Status + name + status banner */}
      <Card padding="md">
        <div className="flex items-start gap-3">
          <div className="text-2xl shrink-0 select-none">{data.status_emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={data.status === 'active' ? 'green' : data.status === 'draft' ? 'orange' : 'gray'}
                size="sm"
              >
                {data.status_label}
              </Badge>
              {data.is_billz_draft && (
                <Badge variant="blue" size="sm">Billz draft</Badge>
              )}
            </div>
            <h2 className="font-display text-lg font-semibold text-fg-1 mt-1 break-words">
              {data.name}
            </h2>
            {data.shop.name && (
              <p className="text-xs text-fg-3 mt-0.5 font-body">
                {data.shop.name}{data.shop.channel ? ` · ${data.shop.channel}` : ''}
              </p>
            )}
          </div>
          {canEdit && (
            <EditIconButton onClick={() => onEdit('name')} />
          )}
        </div>
      </Card>

      {/* Pricing card */}
      <SectionCard
        title="Narxlar"
        editable={canEdit}
        onEdit={() => onEdit('pricing')}
      >
        {data.sale_type !== 'solo' && data.group_price > 0 && (
          <div className="mb-3 pb-3 border-b border-border">
            <p className="text-xs text-fg-3 font-body font-medium uppercase tracking-wide mb-1.5">
              Guruh narxi
            </p>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-3xl font-bold tabular-nums text-brand leading-none">
                {formatPrice(data.group_price)}
              </span>
              <span className="text-sm text-fg-3 font-body">so'm</span>
              {discount > 0 && (
                <Badge variant="green" size="sm">-{discount}%</Badge>
              )}
            </div>
          </div>
        )}
        <InfoRow
          label="Sotuv turi"
          value={SALE_TYPE_LABEL[data.sale_type]}
        />
        <InfoRow label="Asl narx" value={`${formatPrice(data.original_price)} so'm`} mono />
        {data.sale_type !== 'group' && (
          <InfoRow label="Yakka narx" value={`${formatPrice(data.solo_price)} so'm`} mono />
        )}
      </SectionCard>

      {/* Group card */}
      <SectionCard
        title="Guruh"
        editable={canEdit}
        onEdit={() => onEdit('min_group')}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-fg-3 font-body inline-flex items-center gap-1">
            <RiTeamFill size={14} /> A'zolar
          </span>
          <span className="font-mono text-sm text-fg-1">
            <span className="font-semibold">{data.count}</span>
            <span className="text-fg-3"> / {data.min_group}</span>
          </span>
        </div>
        <div className="h-2 bg-bg-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand transition-all duration-base"
            style={{
              width: `${Math.min(100, data.min_group ? (data.count / data.min_group) * 100 : 0)}%`,
            }}
          />
        </div>
      </SectionCard>

      {/* Deadline card */}
      <SectionCard
        title="Muddat"
        editable={canEdit}
        onEdit={() => onEdit('deadline')}
      >
        <div className="flex items-center gap-2">
          <RiTimeLine size={18} className="text-brand shrink-0" />
          <Countdown secondsLeft={data.deadline_seconds_left} display={data.deadline} />
        </div>
      </SectionCard>

      {/* Content card */}
      <SectionCard
        title="Tavsif"
        editable={canEdit}
        onEdit={() => onEdit('description')}
      >
        {data.description ? (
          <p className="text-sm text-fg-2 font-body whitespace-pre-wrap break-words">
            {data.description}
          </p>
        ) : (
          <p className="text-sm text-fg-4 font-body">Tavsif kiritilmagan</p>
        )}
      </SectionCard>

      {/* Variants */}
      <SectionCard
        title="Variantlar"
        editable={canEdit}
        onEdit={() => onEdit('variants')}
      >
        {data.variants.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {data.variants.map((v) => (
              <span
                key={v}
                className="inline-flex items-center px-2 py-1 bg-bg-3 text-fg-1 rounded-md text-xs font-medium font-display"
              >
                {v}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-fg-4 font-body">Variant kiritilmagan</p>
        )}
      </SectionCard>

      {/* Stats card */}
      <Card padding="md">
        <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-3">
          Statistika
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Stat
            icon={<RiShoppingBag3Fill size={16} />}
            label="Buyurtma"
            value={String(data.stats.orders_total)}
          />
          <Stat
            icon={<RiWalletLine size={16} />}
            label="Daromad"
            value={formatPriceShort(data.stats.revenue)}
          />
          <Stat
            icon={<RiHeart3Fill size={16} />}
            label="Wishlist"
            value={String(data.stats.wishlist_count)}
          />
        </div>
      </Card>

      {/* MXIK card */}
      <Card padding="md">
        <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-3">
          MXIK
        </p>
        {data.mxik.code ? (
          <div>
            <p className="text-sm font-mono text-fg-1">{data.mxik.code}</p>
            {data.mxik.name && (
              <p className="text-xs text-fg-3 font-body mt-0.5">{data.mxik.name}</p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <RiErrorWarningFill size={18} className="text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-fg-1 font-body">MXIK kodi kiritilmagan</p>
              <p className="text-xs text-fg-3 font-body mt-0.5">
                Botda mahsulotni tahrirlab kod tanlang.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Channel post link */}
      {data.channel_post_url && (
        <Card padding="md">
          <a
            href={data.channel_post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-sm font-body text-secondary hover:underline"
          >
            <span className="flex items-center gap-2">
              <RiExternalLinkLine size={16} />
              Kanal postini ko'rish
            </span>
            <span className="text-fg-4 text-xs">{data.shop.channel}</span>
          </a>
        </Card>
      )}

      {/* Close button */}
      {canClose && (
        <Button
          variant="danger"
          size="lg"
          fullWidth
          iconLeft={<RiCloseFill size={18} />}
          onClick={onClose}
        >
          Mahsulotni yopish
        </Button>
      )}
      {!canEdit && !canClose && (
        <p className="text-xs text-fg-4 font-body text-center pt-2">
          Yopilgan mahsulot tahrirlanmaydi
        </p>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Subcomponents
// ════════════════════════════════════════════════════════════════════

function SectionCard({
  title, editable, onEdit, children,
}: {
  title: string;
  editable: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3">
          {title}
        </p>
        {editable && <EditIconButton onClick={onEdit} />}
      </div>
      {children}
    </Card>
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

function InfoRow({
  label, value, mono,
}: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-fg-3 font-body">{label}</span>
      <span className={cn('text-sm text-fg-1', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
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

function Countdown({ secondsLeft, display }: { secondsLeft: number; display: string }) {
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.floor((now - mountedAt) / 1000);
  const remain  = Math.max(0, secondsLeft - elapsed);
  if (remain === 0) {
    return (
      <span className="text-sm text-danger font-body">
        Tugagan <span className="text-fg-3">· {display}</span>
      </span>
    );
  }
  const days  = Math.floor(remain / 86400);
  const hours = Math.floor((remain % 86400) / 3600);
  const mins  = Math.floor((remain % 3600) / 60);
  let parts: string[] = [];
  if (days)  parts.push(`${days} kun`);
  if (hours) parts.push(`${hours} soat`);
  if (mins && days === 0) parts.push(`${mins} daqiqa`);
  return (
    <span className="text-sm text-fg-1 font-body">
      <span className="font-mono">{parts.join(' ')}</span>
      <span className="text-fg-3 ml-2 text-xs">· {display}</span>
    </span>
  );
}
function CloseConfirmModal({
  isOpen, onClose, pid, name,
}: { isOpen: boolean; onClose: () => void; pid: string; name: string }) {
  const mutation = useCloseProduct();
  return (
    <Modal isOpen={isOpen} onClose={() => !mutation.isPending && onClose()} title="Mahsulotni yopish">
      <p className="text-sm text-fg-3 font-body mb-3">
        <span className="font-semibold text-fg-1">{name}</span> kanal postidan o'chiriladi
        va yangi buyurtma qabul qilinmaydi. Mavjud buyurtmalar o'zgarmaydi.
      </p>
      {mutation.isError && (
        <p className="text-xs text-danger font-body mb-2">
          {mutation.error instanceof Error ? mutation.error.message : 'Xato yuz berdi'}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button variant="outline" size="lg" onClick={onClose} disabled={mutation.isPending}>
          Bekor
        </Button>
        <Button
          variant="danger"
          size="lg"
          iconLeft={<RiCloseFill size={18} />}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(pid, {
            onSuccess: () => { hapticNotify('success'); onClose(); },
            onError:   () => hapticNotify('error'),
          })}
        >
          {mutation.isPending ? "Yopilmoqda..." : 'Yopish'}
        </Button>
      </div>
    </Modal>
  );
}

function PhotosGallery({ photos }: { photos: { url: string; is_primary: boolean }[] }) {
  if (photos.length === 1) {
    return (
      <div className="rounded-card overflow-hidden bg-bg-3 aspect-square">
        <img src={photos[0].url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto -mx-4 px-4 snap-x">
      {photos.map((ph, i) => (
        <div
          key={ph.url + i}
          className="rounded-card overflow-hidden bg-bg-3 w-56 h-56 shrink-0 snap-start"
        >
          <img src={ph.url} alt="" className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton height={240} rounded="xl" />
      <Skeleton height={100} rounded="xl" />
      <Skeleton height={140} rounded="xl" />
      <Skeleton height={120} rounded="xl" />
      <Skeleton height={100} rounded="xl" />
    </div>
  );
}
