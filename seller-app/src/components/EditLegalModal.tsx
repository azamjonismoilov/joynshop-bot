import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { ApiValidationError, useUpdateLegal } from '@/api/seller';
import type { LegalInfo, LegalStatus, LegalUpdateBody } from '@/api/types';
import { cn } from '@/lib/cn';
import { useMainButton } from '@/lib/useMainButton';
import { hapticNotify, hapticSelection } from '@/lib/haptic';

const isInTelegram = (): boolean =>
  typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;

export type LegalEditField =
  | 'status'
  | 'stir'
  | 'bank_name'
  | 'bank_account'
  | 'bank_mfo'
  | 'director_name';

const TITLES: Record<LegalEditField, string> = {
  status:        'Status — YaTT yoki MChJ',
  stir:          'STIR (INN)',
  bank_name:     'Bank nomi',
  bank_account:  'Hisob raqami',
  bank_mfo:      'MFO',
  director_name: 'Direktor F.I.SH.',
};

interface Props {
  isOpen:   boolean;
  onClose:  () => void;
  field:    LegalEditField;
  current:  LegalInfo;
}

function formatAccount(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 20);
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function EditLegalModal({ isOpen, onClose, field, current }: Props) {
  const mutation = useUpdateLegal();
  const errors   = mutation.error instanceof ApiValidationError ? mutation.error.errors : null;

  const [status, setStatus] = useState<LegalStatus>(current.legal_status ?? 'yatt');
  const [stir, setStir]                 = useState(current.stir ?? '');
  const [bankName, setBankName]         = useState(current.bank_name ?? '');
  const [bankAccount, setBankAccount]   = useState(current.bank_account ?? '');
  const [bankMfo, setBankMfo]           = useState(current.bank_mfo ?? '');
  const [directorName, setDirectorName] = useState(current.director_name ?? '');

  useEffect(() => {
    if (isOpen) {
      setStatus(current.legal_status ?? 'yatt');
      setStir(current.stir ?? '');
      setBankName(current.bank_name ?? '');
      setBankAccount(current.bank_account ?? '');
      setBankMfo(current.bank_mfo ?? '');
      setDirectorName(current.director_name ?? '');
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submit = () => {
    let payload: LegalUpdateBody = {};
    switch (field) {
      case 'status':        payload = { legal_status: status }; break;
      case 'stir':          payload = { stir: stir.trim() }; break;
      case 'bank_name':     payload = { bank_name: bankName.trim() }; break;
      case 'bank_account':  payload = { bank_account: bankAccount.replace(/\D/g, '') }; break;
      case 'bank_mfo':      payload = { bank_mfo: bankMfo.trim() }; break;
      case 'director_name': payload = { director_name: directorName.trim() }; break;
    }
    mutation.mutate(payload, {
      onSuccess: () => { hapticNotify('success'); onClose(); },
      onError:   () => hapticNotify('error'),
    });
  };

  const isPending = mutation.isPending;

  const fieldValid =
    (field === 'status'        && (status === 'yatt' || status === 'mchj')) ||
    (field === 'stir'          && /^[1-6]\d{8}$/.test(stir.trim())) ||
    (field === 'bank_name'     && bankName.trim().length >= 3) ||
    (field === 'bank_account'  && bankAccount.replace(/\D/g, '').length === 20) ||
    (field === 'bank_mfo'      && /^\d{5}$/.test(bankMfo.trim())) ||
    (field === 'director_name' && directorName.trim().split(/\s+/).filter(Boolean).length >= 3);

  useMainButton({
    text:    'Saqlash',
    enabled: isOpen && fieldValid && !isPending,
    loading: isPending,
    onClick: submit,
  });

  const inTelegram = isInTelegram();

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isPending) onClose(); }}
      title={TITLES[field]}
    >
      {field === 'status' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(['yatt', 'mchj'] as LegalStatus[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { hapticSelection(); setStatus(opt); }}
                disabled={isPending}
                className={cn(
                  'flex-1 py-3 px-3 rounded-md border text-sm font-medium font-display transition-colors duration-base',
                  status === opt
                    ? 'border-brand bg-brand-subtle text-brand'
                    : 'border-border bg-bg-1 text-fg-2 hover:border-border-strong',
                )}
              >
                {opt === 'yatt' ? '👤 YaTT' : '🏢 MChJ'}
              </button>
            ))}
          </div>
          {status === 'mchj' && current.legal_status !== 'mchj' && (
            <p className="text-xs text-warning font-body">
              MChJ ga o'tsangiz, Direktor F.I.SH. ni alohida to'ldirish kerak bo'ladi.
            </p>
          )}
          {status === 'yatt' && current.director_name && (
            <p className="text-xs text-warning font-body">
              YaTT ga o'tsangiz, mavjud direktor ma'lumoti tozalanadi.
            </p>
          )}
          {errors?.legal_status && (
            <p className="text-xs text-danger font-body">{errors.legal_status}</p>
          )}
        </div>
      )}

      {field === 'stir' && (
        <Input
          fullWidth
          inputMode="numeric"
          maxLength={9}
          value={stir}
          onChange={(e) => setStir(e.target.value.replace(/\D/g, '').slice(0, 9))}
          placeholder="123456789"
          hint="9 raqam, 1-chi raqam 1 dan 6 gacha"
          disabled={isPending}
          error={errors?.stir}
        />
      )}

      {field === 'bank_name' && (
        <Input
          fullWidth
          maxLength={100}
          value={bankName}
          onChange={(e) => setBankName(e.target.value.slice(0, 100))}
          placeholder="Masalan: Hamkorbank"
          hint="Kamida 3 belgi"
          disabled={isPending}
          error={errors?.bank_name}
        />
      )}

      {field === 'bank_account' && (
        <div className="space-y-2">
          <Input
            fullWidth
            inputMode="numeric"
            maxLength={24}
            value={formatAccount(bankAccount)}
            onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, '').slice(0, 20))}
            placeholder="2020 8000 7012 3456 7890"
            hint="20 raqamli hisob raqami"
            disabled={isPending}
            error={errors?.bank_account}
          />
          <p className="text-[10px] text-fg-4 font-mono text-right">
            {bankAccount.length}/20
          </p>
        </div>
      )}

      {field === 'bank_mfo' && (
        <Input
          fullWidth
          inputMode="numeric"
          maxLength={5}
          value={bankMfo}
          onChange={(e) => setBankMfo(e.target.value.replace(/\D/g, '').slice(0, 5))}
          placeholder="00014"
          hint="5 raqamli bank kodi"
          disabled={isPending}
          error={errors?.bank_mfo}
        />
      )}

      {field === 'director_name' && (
        <Input
          fullWidth
          maxLength={150}
          value={directorName}
          onChange={(e) => setDirectorName(e.target.value.slice(0, 150))}
          placeholder="Ism Familiya Otasining ismi"
          hint="Kamida 3 ta so'z (F.I.O. to'liq)"
          disabled={isPending}
          error={errors?.director_name}
        />
      )}

      {mutation.isError && !(mutation.error instanceof ApiValidationError) && (
        <p className="text-xs text-danger font-body mt-3">
          {mutation.error instanceof Error ? mutation.error.message : 'Xato yuz berdi'}
        </p>
      )}

      <div className={cn('mt-5', inTelegram ? 'flex' : 'grid grid-cols-2 gap-2')}>
        <Button variant="outline" size="lg" onClick={onClose} disabled={isPending} fullWidth={inTelegram}>
          Bekor
        </Button>
        {!inTelegram && (
          <Button variant="primary" size="lg" onClick={submit} disabled={isPending || !fieldValid}>
            {isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
