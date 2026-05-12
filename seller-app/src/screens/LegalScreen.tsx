import { useState } from 'react';
import {
  RiBankFill,
  RiBuilding2Fill,
  RiEdit2Line,
  RiFileTextFill,
  RiTelegramFill,
} from '@remixicon/react';
import { Badge, Button, Card, Skeleton } from '@/components/ui';
import { useSellerLegal } from '@/api/seller';
import { AppHeader } from '@/components/AppHeader';
import { ErrorState } from '@/components/ErrorState';
import { EditLegalModal, type LegalEditField } from '@/components/EditLegalModal';
import { openSellerBotDeeplink } from '@/lib/telegram';

export function LegalScreen() {
  const { data, isLoading, isError, error, refetch } = useSellerLegal();

  return (
    <div className="min-h-screen bg-bg-2 pb-8">
      <AppHeader tagline="Yuridik ma'lumotlar" showBack />

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
  const [edit, setEdit] = useState<LegalEditField | null>(null);
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
          <EditIconButton onClick={() => setEdit('status')} />
        </div>
      </Card>

      {/* Company */}
      <Card padding="md">
        <SectionTitle icon={<RiBuilding2Fill size={16} />} label="Kompaniya" />
        <EditableRow label="STIR" value={data.stir || '—'} mono onEdit={() => setEdit('stir')} />
        {isMchj && (
          <EditableRow
            label="Direktor F.I.SH."
            value={data.director_name || '—'}
            onEdit={() => setEdit('director_name')}
          />
        )}
      </Card>

      {/* Bank */}
      <Card padding="md">
        <SectionTitle icon={<RiBankFill size={16} />} label="Bank ma'lumotlari" />
        <EditableRow
          label="Bank nomi"
          value={data.bank_name || '—'}
          onEdit={() => setEdit('bank_name')}
        />
        <EditableRow
          label="Hisob raqami"
          value={data.bank_account_formatted || data.bank_account || '—'}
          mono
          onEdit={() => setEdit('bank_account')}
        />
        <EditableRow
          label="MFO"
          value={data.bank_mfo || '—'}
          mono
          onEdit={() => setEdit('bank_mfo')}
        />
      </Card>

      {edit && (
        <EditLegalModal
          isOpen={edit !== null}
          onClose={() => setEdit(null)}
          field={edit}
          current={data}
        />
      )}
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

function EditableRow({
  label, value, mono, onEdit,
}: { label: string; value: string; mono?: boolean; onEdit: () => void }) {
  return (
    <div className="py-2 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-fg-3 font-body">{label}</p>
          <p className={`text-sm text-fg-1 mt-0.5 break-words ${mono ? 'font-mono' : 'font-body'}`}>
            {value}
          </p>
        </div>
        <EditIconButton onClick={onEdit} />
      </div>
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


