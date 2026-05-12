import { useNavigate } from 'react-router-dom';
import {
  RiArrowLeftSFill,
  RiBankFill,
  RiBuilding2Fill,
  RiFileTextFill,
  RiTelegramFill,
} from '@remixicon/react';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { useSellerLegal } from '@/api/seller';
import { ErrorState } from '@/components/ErrorState';
import { openSellerBotDeeplink } from '@/lib/telegram';

export function LegalScreen() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useSellerLegal();

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
          <h1 className="font-display text-xl font-semibold text-fg-1">
            Yuridik ma'lumotlar
          </h1>
        </div>
      </header>

      <main className="px-4 mt-4">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton height={80} rounded="xl" />
            <Skeleton height={140} rounded="xl" />
            <Skeleton height={120} rounded="xl" />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : !data?.completed ? (
          <EmptySection />
        ) : (
          <LegalContent data={data} />
        )}
      </main>
    </div>
  );
}

function EmptySection() {
  return (
    <Card padding="lg" className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning-subtle text-warning mb-3">
        <RiFileTextFill size={32} />
      </div>
      <h2 className="font-display text-lg font-semibold text-fg-1 mb-1">
        Yuridik ma'lumotlar to'ldirilmagan
      </h2>
      <p className="text-sm text-fg-3 font-body mb-5">
        STIR, hisob raqami va bank ma'lumotlarini botda to'ldirsangiz —
        Payme split to'lov va fiskal chek imkoniyatlari ochiladi.
      </p>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        iconLeft={<RiTelegramFill size={20} />}
        onClick={() => openSellerBotDeeplink('start')}
      >
        Botda to'ldirish
      </Button>
    </Card>
  );
}

function LegalContent({ data }: { data: NonNullable<ReturnType<typeof useSellerLegal>['data']> }) {
  const isMchj = data.legal_status === 'mchj';
  return (
    <div className="space-y-3">
      {/* Status banner */}
      <Card padding="md">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-success-subtle text-success shrink-0">
            <RiFileTextFill size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-display text-base font-semibold text-fg-1">
                {data.legal_status_label}
              </p>
              <Badge variant="green" size="sm">Tasdiqlangan</Badge>
            </div>
            {data.completed_at && (
              <p className="text-xs text-fg-3 font-body mt-0.5">
                {data.completed_at}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Company */}
      <Card padding="md">
        <SectionTitle icon={<RiBuilding2Fill size={16} />} label="Kompaniya" />
        <InfoRow label="STIR" value={data.stir || '—'} mono />
        {isMchj && (
          <InfoRow label="Direktor F.I.SH." value={data.director_name || '—'} />
        )}
      </Card>

      {/* Bank */}
      <Card padding="md">
        <SectionTitle icon={<RiBankFill size={16} />} label="Bank ma'lumotlari" />
        <InfoRow label="Bank nomi" value={data.bank_name || '—'} />
        <InfoRow
          label="Hisob raqami"
          value={data.bank_account_formatted || data.bank_account || '—'}
          mono
        />
        <InfoRow label="MFO" value={data.bank_mfo || '—'} mono />
      </Card>
    </div>
  );
}

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 text-fg-3">
      {icon}
      <p className="text-xs font-display font-medium uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-2 border-b border-border last:border-0">
      <p className="text-xs text-fg-3 font-body">{label}</p>
      <p className={`text-sm text-fg-1 mt-0.5 break-words ${mono ? 'font-mono' : 'font-body'}`}>
        {value}
      </p>
    </div>
  );
}

