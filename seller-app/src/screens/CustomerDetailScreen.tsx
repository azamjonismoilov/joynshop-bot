import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  RiArrowLeftSFill,
  RiArrowRightSFill,
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
import { useSellerCustomerDetail } from '@/api/seller';
import type { CustomerActivity, CustomerDetail } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { formatPrice } from '@/lib/format';

const ACTIVITY_BADGE: Record<CustomerActivity, BadgeVariant> = {
  active:  'green',
  average: 'yellow',
  lost:    'red',
};

export function CustomerDetailScreen() {
  const navigate = useNavigate();
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
      <header className="px-4 pt-5 pb-3 bg-bg-1 border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-md hover:bg-bg-2 text-fg-2"
            aria-label="Orqaga"
          >
            <RiArrowLeftSFill size={22} />
          </button>
          <h1 className="font-display text-xl font-semibold text-fg-1">Mijoz profili</h1>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-3">
        <ProfileHeader data={data} />
        <StatsGrid data={data} />
        {data.tags.length > 0 && <TagsCard data={data} />}
        {data.note && <NoteCard note={data.note} />}
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
              <Badge variant="brand" size="sm">
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

const TAG_LABEL: Record<string, string> = {
  vip:     'VIP',
  problem: 'Muammoli',
  loyal:   'Doimiy',
};

function TagsCard({ data }: { data: CustomerDetail }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-fg-3 font-body mb-2">Teglar</p>
      <div className="flex gap-1 flex-wrap">
        {data.tags.map((t) => (
          <Badge key={t} variant={t === 'vip' ? 'brand' : 'gray'} size="sm">
            {TAG_LABEL[t] || t}
          </Badge>
        ))}
      </div>
    </Card>
  );
}

function NoteCard({ note }: { note: string }) {
  return (
    <Card padding="sm">
      <p className="text-xs text-fg-3 font-body mb-1">Sotuvchi izohi</p>
      <p className="text-sm text-fg-1 font-body whitespace-pre-wrap">{note}</p>
    </Card>
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
      <header className="px-4 pt-5 pb-3 bg-bg-1 border-b border-border">
        <div className="flex items-center gap-2">
          <Skeleton width={36} height={36} rounded="md" />
          <Skeleton width={128} height={24} />
        </div>
      </header>
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
