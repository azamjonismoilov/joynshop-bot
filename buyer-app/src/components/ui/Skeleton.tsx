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

/** Mahsulot grid uchun — image + name + price */
export function SkeletonProductCard() {
  return (
    <div className="bg-bg-1 border border-border rounded-card overflow-hidden">
      <Skeleton height="100%" rounded="none" style={{ aspectRatio: '1 / 1' }} />
      <div className="p-2.5 space-y-1.5">
        <Skeleton height={14} width="85%" />
        <Skeleton height={16} width="60%" />
        <Skeleton height={8}  width="100%" rounded="full" />
      </div>
    </div>
  );
}

/** Stats card skeleton */
export function SkeletonStats() {
  return (
    <div className="bg-bg-1 border border-border rounded-card p-3 text-center space-y-2">
      <Skeleton height={20} width="40%" className="mx-auto" />
      <Skeleton height={10} width="70%" className="mx-auto" />
    </div>
  );
}
