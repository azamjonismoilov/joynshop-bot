import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiAddFill,
  RiCloseFill,
  RiSearchLine,
} from '@remixicon/react';
import {
  Button,
  Card,
  CollapseSection,
  Input,
} from '@/components/ui';
import { AppHeader } from '@/components/AppHeader';
import { PhotoUploader } from '@/components/PhotoUploader';
import { MxikSearchModal } from '@/components/MxikSearchModal';
import {
  ApiValidationError,
  useCreateProduct,
  useSellerCategories,
  useSellerMe,
} from '@/api/seller';
import type {
  CategoryItem,
  MxikItem,
  ProductCreateBody,
  ProductSaleType,
} from '@/api/types';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';

const SALE_TYPES: Array<{ id: ProductSaleType; label: string }> = [
  { id: 'group', label: '👥 Faqat guruh' },
  { id: 'solo',  label: '👤 Faqat yakka' },
  { id: 'both',  label: '👥+👤 Ikkalasi' },
];

const DEADLINES: Array<{ hours: number; label: string }> = [
  { hours: 24,  label: '24 soat' },
  { hours: 48,  label: '2 kun' },
  { hours: 72,  label: '3 kun' },
  { hours: 168, label: '1 hafta' },
];

export function ProductCreateScreen() {
  const navigate = useNavigate();
  const me       = useSellerMe();
  const cats     = useSellerCategories();
  const mutation = useCreateProduct();
  const errors   = mutation.error instanceof ApiValidationError ? mutation.error.errors : null;

  const shops = me.data?.shops ?? [];

  // Section 1
  const [name, setName]         = useState('');
  const [category, setCategory] = useState('');
  const [saleType, setSaleType] = useState<ProductSaleType>('both');
  const [shopIdx, setShopIdx]   = useState(0);

  // Section 2
  const [origPrice, setOrigPrice]   = useState('');
  const [groupPrice, setGroupPrice] = useState('');
  const [soloPrice, setSoloPrice]   = useState('');
  const [minGroup, setMinGroup]     = useState('5');

  // Section 3
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  // Section 4 (collapse)
  const [description, setDescription] = useState('');
  const [variants, setVariants]       = useState<string[]>([]);
  const [variantDraft, setVariantDraft] = useState('');

  // Section 5 (collapse)
  const [mxik, setMxik]           = useState<MxikItem | null>(null);
  const [showMxik, setShowMxik]   = useState(false);

  // Section 6 (collapse)
  const [deadlineHours, setDeadlineHours] = useState(48);

  const parsePrice = (v: string) => Number(v.replace(/\D/g, '')) || 0;
  const orig  = parsePrice(origPrice);
  const grp   = parsePrice(groupPrice);
  const solo  = parsePrice(soloPrice);
  const discount = orig && grp && grp < orig ? Math.round(((orig - grp) / orig) * 100) : 0;
  const needsGroup = saleType !== 'solo';
  const needsSolo  = saleType !== 'group';

  const canSubmit =
    name.trim().length > 0 &&
    category.length > 0 &&
    photoUrls.length > 0 &&
    orig > 0 &&
    (saleType === 'solo' || grp > 0) &&
    !mutation.isPending;

  const submit = () => {
    const body: ProductCreateBody = {
      name:           name.trim(),
      category,
      sale_type:      saleType,
      original_price: orig,
      group_price:    needsGroup ? grp : undefined,
      solo_price:     needsSolo ? solo : undefined,
      min_group:      needsGroup ? Number(minGroup) || 0 : undefined,
      description:    description.trim() || undefined,
      variants:       variants.length ? variants : undefined,
      mxik_code:      mxik?.code || undefined,
      mxik_name:      mxik?.name || undefined,
      deadline_hours: deadlineHours,
      photo_urls:     photoUrls,
      shop_idx:       shopIdx,
    };
    mutation.mutate(body, {
      onSuccess: (res) => navigate(`/products/${res.pid}`),
    });
  };

  return (
    <div className="min-h-screen bg-bg-2 pb-32">
      <AppHeader tagline="Yangi mahsulot" showBack />

      <main className="px-4 mt-4 space-y-3">
        {/* ─── Shop picker (1 dan ko'p do'kon bo'lganda) ─── */}
        {shops.length > 1 && (
          <Card padding="md">
            <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-2">
              Do'kon
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shops.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setShopIdx(i)}
                  className={cn(
                    'px-3 py-1.5 rounded-md border text-sm font-medium font-display transition-colors duration-base',
                    shopIdx === i
                      ? 'border-brand bg-brand-subtle text-brand'
                      : 'border-border bg-bg-1 text-fg-2',
                  )}
                >
                  {s.name || `Do'kon #${i + 1}`}
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* ─── Section 1: Asosiy ma'lumotlar ─── */}
        <Card padding="md">
          <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-3">
            Asosiy ma'lumotlar
          </p>
          <div className="space-y-3">
            <div>
              <Input
                fullWidth
                label="Mahsulot nomi"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 100))}
                placeholder="Masalan: Nike krossovka"
                error={errors?.name}
              />
              <p className="text-[10px] text-fg-4 font-mono mt-1 text-right">{name.length}/100</p>
            </div>

            <div>
              <p className="text-xs text-fg-3 font-body mb-1.5">Kategoriya</p>
              <CategoryPicker
                value={category}
                onChange={setCategory}
                items={cats.data?.categories ?? []}
              />
              {errors?.category && (
                <p className="text-xs text-danger font-body mt-1">{errors.category}</p>
              )}
            </div>

            <div>
              <p className="text-xs text-fg-3 font-body mb-1.5">Sotuv turi</p>
              <div className="grid grid-cols-3 gap-1.5">
                {SALE_TYPES.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSaleType(opt.id)}
                    className={cn(
                      'px-2 py-2 rounded-md border text-xs font-medium font-display transition-colors duration-base',
                      saleType === opt.id
                        ? 'border-brand bg-brand-subtle text-brand'
                        : 'border-border bg-bg-1 text-fg-2',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors?.sale_type && (
                <p className="text-xs text-danger font-body mt-1">{errors.sale_type}</p>
              )}
            </div>
          </div>
        </Card>

        {/* ─── Section 2: Narxlar ─── */}
        <Card padding="md">
          <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-3">
            Narxlar
          </p>
          <div className="space-y-3">
            <Input
              fullWidth
              label="Asl narx (so'm)"
              inputMode="numeric"
              value={origPrice}
              onChange={(e) => setOrigPrice(e.target.value)}
              placeholder="850000"
              error={errors?.original_price}
            />
            {needsGroup && (
              <div>
                <Input
                  fullWidth
                  label="Guruh narxi (so'm)"
                  inputMode="numeric"
                  value={groupPrice}
                  onChange={(e) => setGroupPrice(e.target.value)}
                  placeholder="550000"
                  error={errors?.group_price}
                />
                {discount > 0 && (
                  <p className="text-xs text-success font-body mt-1">
                    Chegirma: <span className="font-mono">−{discount}%</span> ·
                    Tejov: <span className="font-mono">{formatPrice(orig - grp)} so'm</span>
                  </p>
                )}
              </div>
            )}
            {needsSolo && (
              <Input
                fullWidth
                label="Yakka narxi (so'm)"
                inputMode="numeric"
                value={soloPrice}
                onChange={(e) => setSoloPrice(e.target.value)}
                placeholder="720000"
                error={errors?.solo_price}
              />
            )}
            {needsGroup && (
              <Input
                fullWidth
                label="Minimal guruh a'zolari"
                inputMode="numeric"
                value={minGroup}
                onChange={(e) => setMinGroup(e.target.value.replace(/\D/g, ''))}
                placeholder="5"
                hint="2 dan 100 gacha"
                error={errors?.min_group}
              />
            )}
          </div>
        </Card>

        {/* ─── Section 3: Rasmlar ─── */}
        <Card padding="md">
          <p className="text-xs font-display font-medium uppercase tracking-wide text-fg-3 mb-3">
            Rasmlar
          </p>
          <PhotoUploader urls={photoUrls} onChange={setPhotoUrls} />
          {errors?.photo_urls && (
            <p className="text-xs text-danger font-body mt-2">{errors.photo_urls}</p>
          )}
        </Card>

        {/* ─── Section 4: Tavsif va variantlar (collapse) ─── */}
        <CollapseSection
          title="Tavsif va variantlar"
          subtitle="Ixtiyoriy"
        >
          <div className="space-y-3 mt-2">
            <div>
              <p className="text-xs text-fg-3 font-body mb-1.5">Tavsif</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="Mahsulot haqida qisqacha"
                className="w-full rounded-md border border-border bg-bg-1 px-3 py-2 text-sm font-body text-fg-1 placeholder:text-fg-4 resize-none focus:outline-none focus:border-border-focus"
              />
              <p className="text-[10px] text-fg-4 font-mono mt-1 text-right">{description.length}/300</p>
            </div>
            <div>
              <p className="text-xs text-fg-3 font-body mb-1.5">Variantlar</p>
              <div className="flex gap-2">
                <Input
                  fullWidth
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
                  placeholder="Qora, M, 42"
                />
                <Button
                  variant="outline"
                  size="md"
                  iconLeft={<RiAddFill size={16} />}
                  disabled={!variantDraft.trim()}
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
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {variants.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-brand-subtle text-brand rounded-md text-xs font-medium font-display"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() => setVariants(variants.filter((x) => x !== v))}
                        className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-brand hover:text-white"
                        aria-label={`${v}ni o'chirish`}
                      >
                        <RiCloseFill size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapseSection>

        {/* ─── Section 5: MXIK (collapse) ─── */}
        <CollapseSection
          title="MXIK kodi"
          subtitle={mxik ? mxik.name : 'Ixtiyoriy — tasnif.soliq.uz'}
        >
          <div className="mt-2">
            {mxik ? (
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg-1 font-body break-words">{mxik.name}</p>
                  <p className="text-xs text-fg-3 font-mono mt-0.5">{mxik.code}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setMxik(null)}>
                  Olib tashlash
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="md"
                iconLeft={<RiSearchLine size={16} />}
                fullWidth
                onClick={() => setShowMxik(true)}
              >
                MXIK qidirish
              </Button>
            )}
          </div>
        </CollapseSection>

        {/* ─── Section 6: Muddat (collapse) ─── */}
        <CollapseSection
          title="Muddat"
          subtitle={DEADLINES.find((d) => d.hours === deadlineHours)?.label}
          defaultOpen
        >
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {DEADLINES.map((d) => (
              <button
                key={d.hours}
                type="button"
                onClick={() => setDeadlineHours(d.hours)}
                className={cn(
                  'px-2 py-2 rounded-md border text-xs font-medium font-display transition-colors duration-base',
                  deadlineHours === d.hours
                    ? 'border-brand bg-brand-subtle text-brand'
                    : 'border-border bg-bg-1 text-fg-2',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          {errors?.deadline_hours && (
            <p className="text-xs text-danger font-body mt-2">{errors.deadline_hours}</p>
          )}
        </CollapseSection>

        {/* Non-validation error */}
        {mutation.isError && !(mutation.error instanceof ApiValidationError) && (
          <Card padding="md">
            <p className="text-sm text-danger font-body">
              {mutation.error instanceof Error ? mutation.error.message : 'Xato yuz berdi'}
            </p>
          </Card>
        )}
        {errors?._ && (
          <Card padding="md">
            <p className="text-sm text-danger font-body">
              {errors._ === 'channel_post_failed'
                ? "Kanalga post yuborib bo'lmadi. Botning kanal admin ekanligini tekshiring."
                : errors._}
            </p>
          </Card>
        )}
      </main>

      {/* Sticky bottom CTA */}
      <div
        className="fixed left-0 right-0 bg-bg-1 border-t border-border px-4 py-3 z-30"
        style={{ bottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onClick={submit}
        >
          {mutation.isPending ? "E'lon qilinmoqda..." : "🚀 E'lon qilish"}
        </Button>
      </div>

      <MxikSearchModal
        isOpen={showMxik}
        onClose={() => setShowMxik(false)}
        onPick={(item) => setMxik(item)}
      />
    </div>
  );
}

function CategoryPicker({
  value, onChange, items,
}: { value: string; onChange: (v: string) => void; items: CategoryItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
      {items.map((cat) => (
        <button
          key={cat.name}
          type="button"
          onClick={() => onChange(cat.name)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-2 rounded-md border text-left transition-colors duration-base',
            value === cat.name
              ? 'border-brand bg-brand-subtle text-brand'
              : 'border-border bg-bg-1 text-fg-2',
          )}
        >
          <span className="text-base shrink-0">{cat.icon}</span>
          <span className="text-xs font-medium font-display truncate">{cat.name}</span>
        </button>
      ))}
    </div>
  );
}
