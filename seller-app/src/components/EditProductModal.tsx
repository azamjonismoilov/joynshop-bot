import { useEffect, useState } from 'react';
import { RiAddFill, RiCloseFill } from '@remixicon/react';
import { Button, Input, Modal } from '@/components/ui';
import {
  ProductValidationError,
  useUpdateProduct,
} from '@/api/seller';
import type {
  ProductDetailResponse,
  ProductSaleType,
  ProductUpdateBody,
} from '@/api/types';
import { cn } from '@/lib/cn';

export type EditField =
  | 'name'
  | 'description'
  | 'pricing'
  | 'min_group'
  | 'deadline'
  | 'variants';

const TITLES: Record<EditField, string> = {
  name:        'Nomni tahrirlash',
  description: 'Tavsifni tahrirlash',
  pricing:     'Narxni tahrirlash',
  min_group:   'Minimal guruhni tahrirlash',
  deadline:    'Muddatni tahrirlash',
  variants:    'Variantlarni tahrirlash',
};

const DEADLINE_PRESETS: Array<{ label: string; hours: number }> = [
  { label: '24 soat', hours: 24 },
  { label: '48 soat', hours: 48 },
  { label: '72 soat', hours: 72 },
  { label: '1 hafta', hours: 168 },
];

const SALE_TYPE_OPTIONS: Array<{ key: ProductSaleType; label: string }> = [
  { key: 'both',  label: 'Ikkalasi' },
  { key: 'group', label: 'Faqat guruh' },
  { key: 'solo',  label: 'Faqat yakka' },
];

interface Props {
  isOpen:  boolean;
  onClose: () => void;
  product: ProductDetailResponse;
  field:   EditField;
}

export function EditProductModal({ isOpen, onClose, product, field }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={TITLES[field]}>
      <EditForm product={product} field={field} onClose={onClose} />
    </Modal>
  );
}

function EditForm({
  product, field, onClose,
}: { product: ProductDetailResponse; field: EditField; onClose: () => void }) {
  const mutation = useUpdateProduct();
  const errors   = (mutation.error instanceof ProductValidationError)
    ? mutation.error.errors
    : null;

  // Field-local state — initialized once per modal open
  const [name, setName] = useState(product.name);
  const [desc, setDesc] = useState(product.description);
  const [orig, setOrig] = useState(String(product.original_price || ''));
  const [grp,  setGrp]  = useState(String(product.group_price    || ''));
  const [solo, setSolo] = useState(String(product.solo_price     || ''));
  const [saleType, setSaleType] = useState<ProductSaleType>(product.sale_type);
  const [minGroup, setMinGroup] = useState(String(product.min_group || ''));
  const [hours, setHours]       = useState('24');
  const [variants, setVariants] = useState<string[]>(product.variants || []);
  const [variantDraft, setVariantDraft] = useState('');

  useEffect(() => { mutation.reset(); /* eslint-disable-next-line */ }, []);

  function submit() {
    let payload: ProductUpdateBody = {};
    switch (field) {
      case 'name':
        payload = { name: name.trim() }; break;
      case 'description':
        payload = { description: desc }; break;
      case 'pricing':
        payload = {
          sale_type:      saleType,
          original_price: Number(orig.replace(/\D/g, '')) || 0,
          group_price:    Number(grp.replace(/\D/g, ''))  || 0,
          solo_price:     Number(solo.replace(/\D/g, '')) || 0,
        };
        break;
      case 'min_group':
        payload = { min_group: Number(minGroup) || 0 }; break;
      case 'deadline':
        payload = { deadline_hours: Number(hours) || 0 }; break;
      case 'variants':
        payload = { variants }; break;
    }
    mutation.mutate(
      { pid: product.id, payload },
      { onSuccess: () => onClose() },
    );
  }

  const isPending = mutation.isPending;

  return (
    <>
      {field === 'name' && (
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-fg-3 font-body">Mahsulot nomi</span>
            <Input
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 100))}
              placeholder="Nom"
              disabled={isPending}
              error={errors?.name}
              className="mt-1.5"
            />
            <span className="block text-[10px] text-fg-4 font-mono mt-1 text-right">
              {name.length}/100
            </span>
          </label>
        </div>
      )}

      {field === 'description' && (
        <div className="space-y-2">
          <label className="block">
            <span className="text-xs text-fg-3 font-body">Tavsif</span>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value.slice(0, 300))}
              rows={5}
              disabled={isPending}
              className={cn(
                'mt-1.5 w-full rounded-md border bg-bg-1 px-3 py-2 text-sm font-body text-fg-1 placeholder:text-fg-4 resize-none focus:outline-none focus:border-border-focus disabled:opacity-50',
                errors?.description ? 'border-danger' : 'border-border',
              )}
              placeholder="Mahsulot haqida qisqacha"
            />
            {errors?.description && (
              <span className="text-xs text-danger font-body mt-1 block">{errors.description}</span>
            )}
            <span className="block text-[10px] text-fg-4 font-mono mt-1 text-right">
              {desc.length}/300
            </span>
          </label>
        </div>
      )}

      {field === 'pricing' && (
        <div className="space-y-3">
          <div>
            <span className="text-xs text-fg-3 font-body block mb-1.5">Sotuv turi</span>
            <div className="flex gap-1 bg-bg-3 rounded-md p-0.5">
              {SALE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSaleType(opt.key)}
                  disabled={isPending}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-xs font-medium font-display rounded-sm transition-colors duration-base',
                    saleType === opt.key ? 'bg-bg-1 text-fg-1 shadow-xs' : 'text-fg-3',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Input
            fullWidth
            label="Asl narx (so'm)"
            inputMode="numeric"
            value={orig}
            onChange={(e) => setOrig(e.target.value)}
            disabled={isPending}
            error={errors?.original_price}
          />
          {saleType !== 'solo' && (
            <Input
              fullWidth
              label="Guruh narxi (so'm)"
              inputMode="numeric"
              value={grp}
              onChange={(e) => setGrp(e.target.value)}
              disabled={isPending}
              error={errors?.group_price}
            />
          )}
          {saleType !== 'group' && (
            <Input
              fullWidth
              label="Yakka narx (so'm)"
              inputMode="numeric"
              value={solo}
              onChange={(e) => setSolo(e.target.value)}
              disabled={isPending}
              error={errors?.solo_price}
            />
          )}
          {errors?.pricing && (
            <p className="text-xs text-danger font-body">{errors.pricing}</p>
          )}
        </div>
      )}

      {field === 'min_group' && (
        <div className="space-y-2">
          <Input
            fullWidth
            label="Minimal guruh a'zolari"
            hint="2 dan 100 gacha"
            inputMode="numeric"
            value={minGroup}
            onChange={(e) => setMinGroup(e.target.value.replace(/\D/g, ''))}
            disabled={isPending}
            error={errors?.min_group}
          />
        </div>
      )}

      {field === 'deadline' && (
        <div className="space-y-3">
          <div>
            <span className="text-xs text-fg-3 font-body block mb-1.5">Tezkor variantlar</span>
            <div className="grid grid-cols-4 gap-1.5">
              {DEADLINE_PRESETS.map((p) => (
                <button
                  key={p.hours}
                  type="button"
                  onClick={() => setHours(String(p.hours))}
                  disabled={isPending}
                  className={cn(
                    'px-2 py-1.5 text-xs font-medium font-display rounded-md border transition-colors duration-base',
                    hours === String(p.hours)
                      ? 'border-brand bg-brand-subtle text-brand'
                      : 'border-border text-fg-2 hover:border-border-strong',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <Input
            fullWidth
            label="Yoki o'zingiz kiriting (soat)"
            hint="1 dan 720 soatgacha (30 kun)"
            inputMode="numeric"
            value={hours}
            onChange={(e) => setHours(e.target.value.replace(/\D/g, ''))}
            disabled={isPending}
            error={errors?.deadline_hours}
          />
        </div>
      )}

      {field === 'variants' && (
        <div className="space-y-3">
          <span className="text-xs text-fg-3 font-body block">Variantlar (rang, o'lcham, va h.k.)</span>
          <div className="flex gap-2">
            <Input
              fullWidth
              inputSize="md"
              value={variantDraft}
              onChange={(e) => setVariantDraft(e.target.value.slice(0, 50))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = variantDraft.trim();
                  if (v && !variants.includes(v)) setVariants([...variants, v]);
                  setVariantDraft('');
                }
              }}
              placeholder="Masalan: Qora, M"
              disabled={isPending}
            />
            <Button
              variant="outline"
              size="md"
              iconLeft={<RiAddFill size={16} />}
              disabled={isPending || !variantDraft.trim()}
              onClick={() => {
                const v = variantDraft.trim();
                if (v && !variants.includes(v)) setVariants([...variants, v]);
                setVariantDraft('');
              }}
            >
              Qo'shish
            </Button>
          </div>
          {variants.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {variants.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-brand-subtle text-brand rounded-md text-xs font-medium font-display"
                >
                  {v}
                  <button
                    type="button"
                    onClick={() => setVariants(variants.filter((x) => x !== v))}
                    disabled={isPending}
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-brand hover:text-white"
                    aria-label={`${v}ni o'chirish`}
                  >
                    <RiCloseFill size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {variants.length === 0 && (
            <p className="text-xs text-fg-4 font-body">Hech bo'lmaganda bitta variant qo'shing.</p>
          )}
          {errors?.variants && (
            <p className="text-xs text-danger font-body">{errors.variants}</p>
          )}
        </div>
      )}

      {/* Generic non-field-specific error */}
      {mutation.isError && !(mutation.error instanceof ProductValidationError) && (
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
    </>
  );
}
