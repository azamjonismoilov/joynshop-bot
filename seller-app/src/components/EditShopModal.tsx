import { useEffect, useState } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import { ApiValidationError, useUpdateShop } from '@/api/seller';
import type { DeliveryType, ShopDetail, ShopUpdateBody } from '@/api/types';
import { cn } from '@/lib/cn';

export type ShopEditField = 'name' | 'contact' | 'delivery' | 'social';

const TITLES: Record<ShopEditField, string> = {
  name:     "Do'kon nomi",
  contact:  "Aloqa ma'lumotlari",
  delivery: 'Yetkazib berish turi',
  social:   'Ijtimoiy tarmoqlar',
};

const DELIVERY_OPTIONS: Array<{ id: DeliveryType; label: string }> = [
  { id: 'pickup',  label: '🏪 Olib ketish' },
  { id: 'deliver', label: '🚚 Yetkazib berish' },
  { id: 'both',    label: '🚚🏪 Ikkalasi' },
];

const SOCIAL_KEYS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: 'instagram', label: 'Instagram', placeholder: '@dokon_uz' },
  { key: 'telegram',  label: 'Telegram',  placeholder: '@kanal' },
  { key: 'website',   label: 'Website',   placeholder: 'https://dokon.uz' },
  { key: 'youtube',   label: 'YouTube',   placeholder: '@kanal' },
];

interface Props {
  isOpen:  boolean;
  onClose: () => void;
  field:   ShopEditField;
  shop:    ShopDetail;
}

export function EditShopModal({ isOpen, onClose, field, shop }: Props) {
  const mutation = useUpdateShop();
  const errors   = mutation.error instanceof ApiValidationError ? mutation.error.errors : null;

  const [name, setName]       = useState(shop.name);
  const [phone, setPhone]     = useState(shop.phone);
  const [phone2, setPhone2]   = useState(shop.phone2);
  const [address, setAddress] = useState(shop.address);
  const [delivery, setDelivery] = useState<DeliveryType>(shop.delivery);
  const [social, setSocial]   = useState<Record<string, string>>({ ...shop.social });

  useEffect(() => {
    if (isOpen) {
      setName(shop.name);
      setPhone(shop.phone);
      setPhone2(shop.phone2);
      setAddress(shop.address);
      setDelivery(shop.delivery);
      setSocial({ ...shop.social });
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submit = () => {
    let body: ShopUpdateBody = {};
    switch (field) {
      case 'name':
        body = { name: name.trim() };
        break;
      case 'contact':
        body = {
          phone:   phone.trim(),
          phone2:  phone2.trim(),
          address: address.trim(),
        };
        break;
      case 'delivery':
        body = { delivery };
        break;
      case 'social':
        body = { social };
        break;
    }
    mutation.mutate({ idx: shop.idx, body }, { onSuccess: () => onClose() });
  };

  const isPending = mutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isPending) onClose(); }}
      title={TITLES[field]}
    >
      {field === 'name' && (
        <Input
          fullWidth
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 100))}
          placeholder="Do'kon nomi"
          disabled={isPending}
          error={errors?.name}
        />
      )}

      {field === 'contact' && (
        <div className="space-y-3">
          <Input
            fullWidth
            label="Asosiy telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value.slice(0, 30))}
            placeholder="+998 XX XXX XX XX"
            disabled={isPending}
            error={errors?.phone}
          />
          <Input
            fullWidth
            label="Qo'shimcha telefon (ixtiyoriy)"
            value={phone2}
            onChange={(e) => setPhone2(e.target.value.slice(0, 30))}
            placeholder="+998 XX XXX XX XX"
            disabled={isPending}
            error={errors?.phone2}
          />
          <label className="block">
            <span className="text-xs text-fg-3 font-body">Manzil</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value.slice(0, 200))}
              placeholder="Shahar, tuman, ko'cha, uy raqami"
              rows={3}
              disabled={isPending}
              className={cn(
                'mt-1.5 w-full rounded-md border bg-bg-1 px-3 py-2 text-sm font-body text-fg-1 placeholder:text-fg-4 resize-none focus:outline-none focus:border-border-focus disabled:opacity-50',
                errors?.address ? 'border-danger' : 'border-border',
              )}
            />
            <span className="block text-[10px] text-fg-4 font-mono mt-1 text-right">
              {address.length}/200
            </span>
            {errors?.address && (
              <span className="text-xs text-danger font-body">{errors.address}</span>
            )}
          </label>
        </div>
      )}

      {field === 'delivery' && (
        <div className="space-y-2">
          {DELIVERY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDelivery(opt.id)}
              disabled={isPending}
              className={cn(
                'w-full text-left px-3 py-3 rounded-md border text-sm font-medium font-display transition-colors duration-base',
                delivery === opt.id
                  ? 'border-brand bg-brand-subtle text-brand'
                  : 'border-border bg-bg-1 text-fg-2 hover:border-border-strong',
              )}
            >
              {opt.label}
            </button>
          ))}
          {errors?.delivery && (
            <p className="text-xs text-danger font-body">{errors.delivery}</p>
          )}
        </div>
      )}

      {field === 'social' && (
        <div className="space-y-3">
          {SOCIAL_KEYS.map((sk) => (
            <Input
              key={sk.key}
              fullWidth
              label={sk.label}
              value={social[sk.key] || ''}
              onChange={(e) => setSocial((prev) => ({ ...prev, [sk.key]: e.target.value.slice(0, 200) }))}
              placeholder={sk.placeholder}
              disabled={isPending}
            />
          ))}
          <p className="text-xs text-fg-4 font-body">
            Bo'sh qoldirilgan maydonlar olib tashlanadi.
          </p>
          {errors?.social && (
            <p className="text-xs text-danger font-body">{errors.social}</p>
          )}
        </div>
      )}

      {mutation.isError && !(mutation.error instanceof ApiValidationError) && (
        <p className="text-xs text-danger font-body mt-3">
          {mutation.error instanceof Error ? mutation.error.message : 'Xato yuz berdi'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-5">
        <Button variant="outline" size="lg" onClick={onClose} disabled={isPending}>
          Bekor
        </Button>
        <Button variant="primary" size="lg" onClick={submit} disabled={isPending}>
          {isPending ? 'Saqlanmoqda...' : 'Saqlash'}
        </Button>
      </div>
    </Modal>
  );
}
