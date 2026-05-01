import { type CSSProperties, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type SkeletonRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?:   string | number;
  height?:  string | number;
  rounded?: SkeletonRounded;
}

const RADIUS: Record<SkeletonRounded, string> = {
  none: '0',
  sm:   'var(--radius-sm)',
  md:   'var(--radius-md)',
  lg:   'var(--radius-lg)',
  xl:   'var(--radius-xl)',
  '2xl':'var(--radius-2xl)',
  full: '9999px',
};

export function Skeleton({
  width,
  height = 16,
  rounded = 'md',
  className,
  style,
  ...rest
}: SkeletonProps) {
  const widthStr  = width  === undefined ? '100%' : (typeof width  === 'number' ? `${width}px` : width);
  const heightStr = typeof height === 'number' ? `${height}px` : height;
  const merged: CSSProperties = {
    width:        widthStr,
    height:       heightStr,
    borderRadius: RADIUS[rounded],
    ...style,
  };
  return <div className={cn('shimmer block', className)} style={merged} {...rest} />;
}

// ─── SkeletonCard — mahsulot card holatida (~ProductsScreen card) ───
export function SkeletonCard() {
  return (
    <div className="bg-bg-1 border border-border rounded-card p-3">
      <div className="flex items-center gap-3">
        <Skeleton width={64} height={64} rounded="lg" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton height={16} width="80%" />
          <Skeleton height={14} width="50%" />
          <div className="flex gap-2 pt-1">
            <Skeleton width={64} height={20} rounded="md" />
            <Skeleton width={80} height={20} rounded="md" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SkeletonListItem — sodda list satr (avatar + nom + qiymat) ───
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Skeleton width={40} height={40} rounded="full" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton height={14} width="65%" />
        <Skeleton height={12} width="35%" />
      </div>
      <Skeleton width={56} height={16} rounded="sm" />
    </div>
  );
}

// ─── SkeletonStats — stat card (icon + label + raqam) ───
export function SkeletonStats() {
  return (
    <div className="bg-bg-1 border border-border rounded-card p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton width={36} height={36} rounded="lg" />
        <Skeleton width={48} height={20} rounded="md" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton height={12} width="60%" />
        <Skeleton height={28} width="70%" />
      </div>
    </div>
  );
}
