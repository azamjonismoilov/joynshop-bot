import { RiHeart3Fill, RiHeart3Line, RiPriceTag3Fill, RiTeamFill } from '@remixicon/react';
import { cn } from '@/lib/cn';
import { formatPrice, discountPct } from '@/lib/format';
import { photoUrl, type ProductListItem } from '@/api/types';

interface Props {
  item:       ProductListItem;
  saved?:     boolean;
  onClick:    () => void;
  onToggleSave?: () => void;
}

/** Mahsulot grid card — 2-column layout */
export function ProductCard({ item, saved, onClick, onToggleSave }: Props) {
  const src = photoUrl(item);
  const showGroupPrice = item.sale_type !== 'solo';
  const finalPrice     = showGroupPrice ? item.group_price : item.solo_price;
  const disc           = discountPct(item.original_price, finalPrice);
  const pct            = item.min_group > 0 ? Math.min(100, Math.round((item.count / item.min_group) * 100)) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-bg-1 border border-border rounded-card overflow-hidden hover:border-border-strong active:scale-[0.98] transition-all duration-base"
    >
      {/* Photo */}
      <div className="relative bg-bg-3" style={{ aspectRatio: '1 / 1' }}>
        {src ? (
          <img
            src={src}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-fg-4">
            <RiPriceTag3Fill size={36} />
          </div>
        )}

        {disc > 0 && (
          <span className="absolute top-2 left-2 inline-flex items-center px-1.5 py-0.5 rounded-md bg-danger text-danger-fg text-[10px] font-mono font-bold shadow-sm">
            −{disc}%
          </span>
        )}

        {onToggleSave && (
          <button
            type="button"
            aria-label={saved ? 'Saqlangandan olib tashlash' : 'Saqlash'}
            onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
            className={cn(
              'absolute top-2 right-2 inline-flex items-center justify-center w-8 h-8 rounded-full backdrop-blur-sm transition-colors duration-base',
              saved ? 'bg-white/95 text-danger' : 'bg-black/40 text-white hover:bg-black/55',
            )}
          >
            {saved ? <RiHeart3Fill size={16} /> : <RiHeart3Line size={16} />}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-2.5 space-y-1.5">
        <h3 className="font-display text-sm font-medium text-fg-1 line-clamp-2 leading-snug min-h-[2.5em]">
          {item.name || '—'}
        </h3>

        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-base font-bold text-brand leading-none">
            {formatPrice(finalPrice)}
          </span>
          <span className="text-[10px] text-fg-3 font-body">so'm</span>
        </div>

        {item.original_price > finalPrice && (
          <p className="text-[11px] text-fg-4 font-mono line-through leading-tight">
            {formatPrice(item.original_price)}
          </p>
        )}

        {showGroupPrice && item.min_group > 1 && (
          <>
            <div className="h-1 bg-bg-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand transition-all duration-slow"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="inline-flex items-center gap-1 text-[10px] text-fg-3 font-body">
              <RiTeamFill size={10} />
              <span className="font-mono">{item.count}/{item.min_group}</span>
              <span>kishi</span>
            </p>
          </>
        )}
      </div>
    </button>
  );
}
