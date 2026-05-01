import { useState } from 'react';
import {
  RiAddFill,
  RiArrowLeftSFill,
  RiArrowRightSFill,
  RiBarChart2Fill,
  RiBookmarkFill,
  RiBox3Fill,
  RiChat3Fill,
  RiCheckFill,
  RiClipboardFill,
  RiCloseFill,
  RiDeleteBinFill,
  RiDownloadFill,
  RiEditFill,
  RiErrorWarningFill,
  RiEyeFill,
  RiFireFill,
  RiHeartFill,
  RiHome3Fill,
  RiLockFill,
  RiPriceTag3Fill,
  RiRefreshFill,
  RiRocket2Fill,
  RiSearchFill,
  RiSendPlane2Fill,
  RiSettings3Fill,
  RiShoppingBag3Fill,
  RiShoppingCartFill,
  RiStarFill,
  RiTeamFill,
  RiTimeFill,
  RiUserFill,
  RiWalletFill,
} from '@remixicon/react';
import { Button, Badge, Input, Card, Skeleton, SkeletonCard, SkeletonListItem, SkeletonStats } from '@/components/ui';
import type { ButtonVariant, ButtonSize, BadgeVariant, BadgeSize, InputSize } from '@/components/ui';

const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'ghost', 'outline', 'danger', 'success'];
const BUTTON_SIZES:    ButtonSize[]    = ['xs', 'sm', 'md', 'lg', 'xl'];
const BADGE_VARIANTS:  BadgeVariant[]  = ['orange', 'blue', 'green', 'red', 'yellow', 'gray', 'purple'];
const BADGE_SIZES:     BadgeSize[]     = ['sm', 'md', 'lg'];
const INPUT_SIZES:     InputSize[]     = ['sm', 'md', 'lg', 'xl'];

const ICON_GRID = [
  { name: 'Box',          Icon: RiBox3Fill },
  { name: 'Team',         Icon: RiTeamFill },
  { name: 'Time',         Icon: RiTimeFill },
  { name: 'Check',        Icon: RiCheckFill },
  { name: 'Close',        Icon: RiCloseFill },
  { name: 'Warning',      Icon: RiErrorWarningFill },
  { name: 'Search',       Icon: RiSearchFill },
  { name: 'Add',          Icon: RiAddFill },
  { name: 'Edit',         Icon: RiEditFill },
  { name: 'Delete',       Icon: RiDeleteBinFill },
  { name: 'Send',         Icon: RiSendPlane2Fill },
  { name: 'Download',     Icon: RiDownloadFill },
  { name: 'Star',         Icon: RiStarFill },
  { name: 'Heart',        Icon: RiHeartFill },
  { name: 'Bookmark',     Icon: RiBookmarkFill },
  { name: 'Eye',          Icon: RiEyeFill },
  { name: 'Settings',     Icon: RiSettings3Fill },
  { name: 'User',         Icon: RiUserFill },
  { name: 'Home',         Icon: RiHome3Fill },
  { name: 'ArrowLeft',    Icon: RiArrowLeftSFill },
  { name: 'ArrowRight',   Icon: RiArrowRightSFill },
  { name: 'Cart',         Icon: RiShoppingCartFill },
  { name: 'Bag',          Icon: RiShoppingBag3Fill },
  { name: 'PriceTag',     Icon: RiPriceTag3Fill },
  { name: 'Wallet',       Icon: RiWalletFill },
  { name: 'Chart',        Icon: RiBarChart2Fill },
  { name: 'Clipboard',    Icon: RiClipboardFill },
  { name: 'Chat',         Icon: RiChat3Fill },
  { name: 'Lock',         Icon: RiLockFill },
  { name: 'Refresh',      Icon: RiRefreshFill },
  { name: 'Rocket',       Icon: RiRocket2Fill },
  { name: 'Fire',         Icon: RiFireFill },
];

export function UIShowcase() {
  const [val, setVal] = useState('');

  return (
    <div className="min-h-screen bg-bg-2 px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <Section title="Joynshop UI library — Bosqich 1 + Icons">
          <p className="text-fg-3 text-sm font-body">
            Design tokens + 4 core component + Remix Icons. Tailwind class'lar
            bo'yicha ishlatiladi (bg-brand, text-fg-1, rounded-card).
          </p>
        </Section>

        {/* ─── Typography ─── */}
        <Section title="Typography">
          <Card padding="md">
            <div className="space-y-3">
              <Sample label="Display 4xl / 700">
                <h1 className="font-display text-4xl font-bold text-fg-1">Sotuvchi paneli</h1>
              </Sample>
              <Sample label="Display 2xl / 600">
                <h2 className="font-display text-2xl font-semibold text-fg-1">Mahsulotlarim</h2>
              </Sample>
              <Sample label="Body base / 400">
                <p className="font-body text-base text-fg-2">
                  Adidas Ultraboost krossovkalar — ko'p o'lchamda mavjud.
                </p>
              </Sample>
              <Sample label="Mono lg / 500 (raqamlar uchun)">
                <p className="font-mono text-lg font-medium text-fg-1">850,000 so'm</p>
              </Sample>
            </div>
          </Card>
        </Section>

        {/* ─── Icons grid ─── */}
        <Section title="Icons (Remix Icon, Fill variant)">
          <Card padding="md">
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {ICON_GRID.map(({ name, Icon }) => (
                <div
                  key={name}
                  className="flex flex-col items-center gap-1 p-2 rounded-md hover:bg-bg-2 transition-colors"
                >
                  <Icon size={24} className="text-fg-1" />
                  <span className="text-[10px] text-fg-3 font-mono">{name}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-fg-3 mb-2">Color variants (text-brand, text-success, text-danger, text-warning)</p>
              <div className="flex items-center gap-3">
                <RiBox3Fill size={24} className="text-brand" />
                <RiCheckFill size={24} className="text-success" />
                <RiErrorWarningFill size={24} className="text-warning" />
                <RiCloseFill size={24} className="text-danger" />
                <RiTeamFill size={24} className="text-secondary" />
                <RiStarFill size={24} className="text-purple" />
                <RiHome3Fill size={24} className="text-fg-3" />
              </div>
            </div>
          </Card>
        </Section>

        {/* ─── Buttons ─── */}
        <Section title="Button — variants × sizes">
          <Card padding="md">
            <div className="space-y-4">
              {BUTTON_VARIANTS.map((variant) => (
                <div key={variant}>
                  <p className="text-xs text-fg-3 mb-2 capitalize">{variant}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {BUTTON_SIZES.map((size) => (
                      <Button key={size} variant={variant} size={size}>
                        {size.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <p className="text-xs text-fg-3 mb-2">Pill, Remix Icons, full-width, disabled</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="primary" pill>Pill</Button>
                  <Button variant="secondary" iconLeft={<RiRocket2Fill size={16} />}>
                    Boshlash
                  </Button>
                  <Button variant="outline" iconRight={<RiArrowRightSFill size={16} />}>
                    Davomi
                  </Button>
                  <Button variant="ghost" disabled iconLeft={<RiLockFill size={16} />}>
                    Disabled
                  </Button>
                  <Button variant="danger" iconLeft={<RiDeleteBinFill size={16} />}>
                    O'chirish
                  </Button>
                  <Button variant="success" iconLeft={<RiCheckFill size={16} />}>
                    Tasdiqlash
                  </Button>
                </div>
                <div className="mt-2">
                  <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    iconLeft={<RiSendPlane2Fill size={18} />}
                  >
                    Full width with icon
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* ─── Badges ─── */}
        <Section title="Badge — subtle / solid + Remix icons">
          <Card padding="md">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-fg-3 mb-2">Subtle</p>
                <div className="flex flex-wrap gap-2">
                  {BADGE_VARIANTS.map((v) => (
                    <Badge key={v} variant={v}>{v}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-fg-3 mb-2">Solid</p>
                <div className="flex flex-wrap gap-2">
                  {BADGE_VARIANTS.map((v) => (
                    <Badge key={v} variant={v} solid>{v}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-fg-3 mb-2">Sizes (sm / md / lg)</p>
                <div className="flex flex-wrap items-center gap-2">
                  {BADGE_SIZES.map((s) => (
                    <Badge key={s} variant="orange" size={s}>{s}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-fg-3 mb-2">Pill + Remix icons</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="green"  pill icon={<RiCheckFill size={12} />}>Aktiv</Badge>
                  <Badge variant="red"    pill icon={<RiTimeFill size={12} />}>Yo'qotilgan</Badge>
                  <Badge variant="blue"   pill solid icon={<RiRocket2Fill size={12} />}>Yangi</Badge>
                  <Badge variant="yellow"      icon={<RiErrorWarningFill size={12} />}>MXIK yo'q</Badge>
                  <Badge variant="orange"      icon={<RiShoppingBag3Fill size={12} />}>Billz</Badge>
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* ─── Inputs ─── */}
        <Section title="Input — sizes / states + Remix icon">
          <Card padding="md">
            <div className="space-y-3">
              {INPUT_SIZES.map((s) => (
                <Input
                  key={s}
                  inputSize={s}
                  label={`Input — ${s}`}
                  placeholder={`Size ${s}`}
                  fullWidth
                />
              ))}
              <Input
                fullWidth
                label="Icon va suffix bilan"
                placeholder="Qidirish..."
                iconLeft={<RiSearchFill size={16} />}
                suffix={<span className="text-xs font-mono text-fg-4">⌘K</span>}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                hint="Tahrirlanyapti"
              />
              <Input
                fullWidth
                label="Xato holati"
                placeholder="STIR (9 raqam)"
                iconLeft={<RiErrorWarningFill size={16} />}
                error="STIR — 9 ta raqam bo'lishi kerak, 1-chi raqam 1-6"
                defaultValue="123"
              />
              <Input
                fullWidth
                label="Disabled"
                placeholder="O'chirilgan"
                iconLeft={<RiLockFill size={16} />}
                disabled
                defaultValue="readonly"
              />
            </div>
          </Card>
        </Section>

        {/* ─── Cards ─── */}
        <Section title="Card — variants × padding">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card variant="default" padding="md">
              <div className="flex items-start gap-3">
                <RiBox3Fill size={20} className="text-brand mt-0.5" />
                <div>
                  <h3 className="font-display text-base font-semibold mb-1">Default</h3>
                  <p className="text-sm text-fg-3 font-body">
                    Border bilan, neutral-0 bg.
                  </p>
                </div>
              </div>
            </Card>
            <Card variant="elevated" padding="md">
              <div className="flex items-start gap-3">
                <RiRocket2Fill size={20} className="text-secondary mt-0.5" />
                <div>
                  <h3 className="font-display text-base font-semibold mb-1">Elevated</h3>
                  <p className="text-sm text-fg-3 font-body">
                    Shadow-md bilan, border yo'q.
                  </p>
                </div>
              </div>
            </Card>
            <Card variant="default" padding="sm">
              <p className="text-xs text-fg-3">padding=sm (12px)</p>
            </Card>
            <Card variant="default" padding="lg">
              <p className="text-xs text-fg-3">padding=lg (24px)</p>
            </Card>
          </div>
        </Section>

        {/* ─── Skeletons ─── */}
        <Section title="Skeletons (loading shimmer)">
          <Card padding="md">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-fg-3 mb-2">Skeleton (base) — width/height/rounded</p>
                <div className="space-y-2">
                  <Skeleton height={16} width="100%" />
                  <Skeleton height={16} width="70%" />
                  <Skeleton height={20} width="40%" rounded="full" />
                </div>
              </div>
              <div>
                <p className="text-xs text-fg-3 mb-2">SkeletonStats</p>
                <div className="grid grid-cols-2 gap-3">
                  <SkeletonStats />
                  <SkeletonStats />
                </div>
              </div>
              <div>
                <p className="text-xs text-fg-3 mb-2">SkeletonListItem</p>
                <div className="divide-y divide-border">
                  <SkeletonListItem />
                  <SkeletonListItem />
                  <SkeletonListItem />
                </div>
              </div>
              <div>
                <p className="text-xs text-fg-3 mb-2">SkeletonCard</p>
                <div className="space-y-2">
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              </div>
            </div>
          </Card>
        </Section>

        {/* ─── Color tokens preview ─── */}
        <Section title="Color tokens">
          <Card padding="md">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Swatch name="brand"     bg="bg-brand"     fg="text-brand-fg" />
              <Swatch name="secondary" bg="bg-secondary" fg="text-secondary-fg" />
              <Swatch name="success"   bg="bg-success"   fg="text-success-fg" />
              <Swatch name="danger"    bg="bg-danger"    fg="text-danger-fg" />
              <Swatch name="warning"   bg="bg-warning"   fg="text-warning-fg" />
              <Swatch name="purple"    bg="bg-purple"    fg="text-purple-fg" />
              <Swatch name="bg-2"      bg="bg-bg-2"      fg="text-fg-1" />
              <Swatch name="bg-3"      bg="bg-bg-3"      fg="text-fg-1" />
            </div>
          </Card>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-fg-1 mb-2 px-1">{title}</h2>
      {children}
    </section>
  );
}

function Sample({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-fg-3 mb-1">{label}</p>
      {children}
    </div>
  );
}

function Swatch({ name, bg, fg }: { name: string; bg: string; fg: string }) {
  return (
    <div className={`${bg} ${fg} rounded-md p-3 text-xs font-medium font-mono`}>
      {name}
    </div>
  );
}
