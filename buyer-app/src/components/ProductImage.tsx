import { useEffect, useState, type ReactNode } from 'react';
import { RiInboxFill, RiPriceTag3Fill } from '@remixicon/react';
import { cn } from '@/lib/cn';

interface Props {
  src?:           string | null;
  alt?:           string;
  className?:     string;
  fallbackIcon?:  ReactNode;
  fallbackSize?:  number;
  lazy?:          boolean;
  draggable?:     boolean;
}

/**
 * Mahsulot / order rasm — broken/404 holatda fallback icon ko'rsatadi.
 * Telegram `/api/photo/<file_id>` proxy 404 qaytarishi mumkin
 * (eski file_id'lar uchun) — har joyda DRY fallback.
 */
export function ProductImage({
  src, alt = '', className, fallbackIcon, fallbackSize = 32, lazy = true, draggable,
}: Props) {
  const [failed, setFailed] = useState(false);

  // src o'zgarsa qayta yuklashga harakat qil
  useEffect(() => { setFailed(false); }, [src]);

  if (!src || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-bg-3 text-fg-4', className)}>
        {fallbackIcon || <RiPriceTag3Fill size={fallbackSize} />}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={lazy ? 'lazy' : undefined}
      draggable={draggable}
      onError={() => setFailed(true)}
    />
  );
}

/** Gallery / hero pattern uchun — bo'sh inbox icon */
export function ProductImageInbox(props: Omit<Props, 'fallbackIcon'>) {
  return <ProductImage {...props} fallbackIcon={<RiInboxFill size={48} />} />;
}
