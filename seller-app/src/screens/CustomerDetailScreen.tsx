import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  RiArrowRightSFill,
  RiEdit2Line,
  RiPhoneFill,
  RiTimeFill,
  RiVipCrownFill,
  RiHistoryFill,
} from '@remixicon/react';
import {
  Card,
  Button,
  Badge,
  Skeleton,
  SkeletonCard,
  SkeletonStats,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { Avatar } from '@/components/Avatar';
import { useSellerCustomerDetail, useUpdateCustomer } from '@/api/seller';
import { AppHeader } from '@/components/AppHeader';
import { EditCustomerNoteModal } from '@/components/EditCustomerNoteModal';
import type { CustomerActivity, CustomerDetail } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { hapticNotify, hapticSelection } from '@/lib/haptic';

const ACTIVITY_BADGE: Record<CustomerActivity, BadgeVariant> = {
  active:  'green',
  average: 'yellow',
  lost:    'red',
};

export function CustomerDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useSellerCustomerDetail(id);

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }
  if (isLoading || !data) {
    return <DetailSkeleton />;
  }

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline={data.name || 'Mijoz'} showBack />

      <div className="px-4 mt-4 space-y-3">
        <ProfileHeader data={data} />
        <StatsGrid data={data} />
        <TagsCard data={data} />
        <NoteCard data={data} />
        <ActionButtons data={data} />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Subcomponents
// ════════════════════════════════════════════════════════════════════

function ProfileHeader({ data }: { data: CustomerDetail }) {
  const variant = ACTIVITY_BADGE[data.activity] || 'gray';
  const isVip   = data.tags.includes('vip');
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <Avatar name={data.name} size={56} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-lg font-semibold text-fg-1 truncate">
              {data.name || '—'}
            </h2>
            {isVip && (
              <Badge variant="orange" size="sm">
                <RiVipCrownFill size={10} className="mr-0.5" />
                VIP
              </Badge>
            )}
          </div>
          {data.phone && (
            <p className="text-sm text-fg-3 mt-0.5 font-mono truncate">{data.phone}</p>
          )}
          {data.username && (
            <p className="text-xs text-fg-4 font-mono truncate">@{data.username}</p>
          )}
          <div className="mt-2">
            <Badge variant={variant} size="sm">{data.activity_label}</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

function StatsGrid({ data }: { data: CustomerDetail }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <StatBox label="Jami xaridlar"  value={String(data.total_orders)}                    />
      <StatBox label="Jami summa"     value={`${formatPrice(data.total_spent)} so'm`}      />
      <StatBox label="O'rtacha chek"  value={`${formatPrice(data.avg_check)} so'm`}        />
      <StatBox label="Birinchi xarid" value={data.first_order || '—'}                      />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-fg-3 font-body">{label}</p>
      <p className="font-mono text-base font-semibold text-fg-1 mt-0.5">{value}</p>
    </Card>
  );
}

function TagsCard({ data }: { data: CustomerDetail }) {
  const mutation = useUpdateCustomer();
  // Optimistic state — clicked tag updates immediately, mutation patches server
  const [pendingTags, setPendingTags] = useState<string[] | null>(null);
  const active = pendingTags ?? data.tags;

  const toggle = (tagId: string) => {
    if (mutation.isPending) return;
    hapticSelection();
    const next = active.includes(tagId)
      ? active.filter((t) => t !== tagId)
      : [...active, tagId];
    setPendingTags(next);
    mutation.mutate(
      { cuid: data.cuid, payload: { tags: next } },
      {
        onSuccess: () => hapticNotify('success'),
        onError:   () => hapticNotify('error'),
        onSettled: () => setPendingTags(null),
      },
    );
  };

  const opts = data.available_tags.length
    ? data.available_tags
    : [
        { id: 'vip',     label: '⭐ VIP' },
        { id: 'problem', label: '🔴 Muammoli' },
        { id: 'loyal',   label: '💎 Doimiy' },
      ];

  return (
    <Card padding="sm">
      <p className="text-xs text-fg-3 font-body mb-2">Teglar</p>
      <div className="flex gap-1.5 flex-wrap">
        {opts.map((opt) => {
          const isActive = active.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              disabled={mutation.isPending}
              className={cn(
                'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium font-display transition-colors duration-base',
                isActive
                  ? 'bg-brand text-white'
                  : 'bg-bg-3 text-fg-2 border border-border hover:border-border-strong',
                mutation.isPending && 'opacity-50',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {mutation.isError && (
        <p className="text-xs text-danger font-body mt-2">
          Tegni yangilab bo'lmadi
        </p>
      )}
    </Card>
  );
}

function NoteCard({ data }: { data: CustomerDetail }) {
  const [showEdit, setShowEdit] = useState(false);
  const hasNote = Boolean(data.note);
  return (
    <>
      <Card padding="sm">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-fg-3 font-body">Sotuvchi izohi</p>
          <button
            onClick={() => setShowEdit(true)}
            aria-label="Izohni tahrirlash"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-fg-3 hover:bg-bg-2 hover:text-brand transition-colors duration-base shrink-0"
          >
            <RiEdit2Line size={14} />
          </button>
        </div>
        {hasNote ? (
          <p className="text-sm text-fg-1 font-body whitespace-pre-wrap mt-1">{data.note}</p>
        ) : (
          <p className="text-sm text-fg-4 font-body mt-1">Izoh qo'shilmagan</p>
        )}
      </Card>
      <EditCustomerNoteModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        cuid={data.cuid}
        currentNote={data.note || ''}
      />
    </>
  );
}

function ActionButtons({ data }: { data: CustomerDetail }) {
  return (
    <div className="space-y-2 pt-1">
      <Link to={`/customers/${data.cuid}/history`} className="block">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          iconLeft={<RiHistoryFill size={18} />}
          iconRight={<RiArrowRightSFill size={18} />}
        >
          Xaridlar tarixi ({data.total_orders})
        </Button>
      </Link>
      {data.phone && (
        <a href={`tel:${data.phone}`} className="block">
          <Button
            variant="outline"
            size="lg"
            fullWidth
            iconLeft={<RiPhoneFill size={18} />}
          >
            Bog'lanish: {data.phone}
          </Button>
        </a>
      )}
      <p className="text-xs text-fg-4 font-mono inline-flex items-center gap-1 pt-1">
        <RiTimeFill size={12} />
        Oxirgi xarid: {data.last_order || '—'}
      </p>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline="Mijoz" showBack />
      <div className="px-4 mt-4 space-y-3">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <Skeleton width={56} height={56} rounded="full" />
            <div className="flex-1 space-y-2">
              <Skeleton width={160} height={20} />
              <Skeleton width={112} height={16} />
            </div>
          </div>
        </Card>
        <SkeletonStats />
        <SkeletonCard />
      </div>
    </div>
  );
}
