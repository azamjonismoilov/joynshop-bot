import { RiHeart3Fill, RiHeart3Line } from '@remixicon/react';
import { useAddWishlist, useRemoveWishlist, useWishlistIds } from '@/api/buyer';
import { cn } from '@/lib/cn';
import { hapticImpact } from '@/lib/haptic';
import { getTgUser } from '@/lib/telegram';

interface Props {
  pid:   string;
  size?: 'sm' | 'md';
}

/**
 * Heart toggle — optimistic mutation orqali.
 * Tap qachon uid yo'q bo'lsa silent skip (brauzer dev).
 */
export function WishlistButton({ pid, size = 'md' }: Props) {
  const uid    = getTgUser()?.id ?? null;
  const ids    = useWishlistIds(uid);
  const add    = useAddWishlist();
  const remove = useRemoveWishlist();

  const saved   = !!ids.data?.includes(pid);
  const pending = add.isPending || remove.isPending;

  const px = size === 'sm' ? 28 : 32;
  const ic = size === 'sm' ? 14 : 16;

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uid || pending) return;
    hapticImpact('light');
    if (saved) remove.mutate({ uid, pid });
    else       add.mutate({ uid, pid });
  };

  return (
    <button
      type="button"
      aria-label={saved ? 'Saqlangandan olib tashlash' : 'Saqlash'}
      onClick={toggle}
      style={{ width: px, height: px }}
      className={cn(
        'inline-flex items-center justify-center rounded-full backdrop-blur-sm transition-colors duration-base',
        saved
          ? 'bg-white/95 text-danger'
          : 'bg-black/40 text-white hover:bg-black/55',
        pending && 'opacity-70',
      )}
    >
      {saved ? <RiHeart3Fill size={ic} /> : <RiHeart3Line size={ic} />}
    </button>
  );
}
