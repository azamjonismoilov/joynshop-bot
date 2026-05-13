import { RiHeart3Fill } from '@remixicon/react';
import { useAddWishlist, useRemoveWishlist, useWishlistIds } from '@/api/buyer';
import { useToast } from './Toast';
import { cn } from '@/lib/cn';
import { hapticImpact } from '@/lib/haptic';
import { getTgUser } from '@/lib/telegram';

interface Props {
  pid:   string;
  size?: 'sm' | 'md';
}

/**
 * Heart toggle — optimistic mutation orqali.
 * uid yo'q (brauzer dev) → disabled state ko'rsatadi.
 */
export function WishlistButton({ pid, size = 'md' }: Props) {
  const uid    = getTgUser()?.id ?? null;
  const ids    = useWishlistIds(uid);
  const add    = useAddWishlist();
  const remove = useRemoveWishlist();
  const toast  = useToast();

  const saved    = !!ids.data?.includes(pid);
  const pending  = add.isPending || remove.isPending;
  const disabled = !uid;

  const px = size === 'sm' ? 28 : 32;
  const ic = size === 'sm' ? 14 : 16;

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || pending) return;
    hapticImpact('light');
    if (saved) {
      remove.mutate({ uid: uid!, pid }, {
        onSuccess: () => toast.show('Olib tashlandi', 'info'),
        onError:   () => toast.show('Olib tashlab bo\'lmadi', 'error'),
      });
    } else {
      add.mutate({ uid: uid!, pid }, {
        onSuccess: () => toast.show('❤️ Saqlandi', 'success'),
        onError:   () => toast.show('Saqlanmadi', 'error'),
      });
    }
  };

  return (
    <button
      type="button"
      aria-label={
        disabled
          ? 'Saqlash uchun Telegram\'da kiring'
          : saved ? 'Saqlangandan olib tashlash' : 'Saqlash'
      }
      aria-disabled={disabled || undefined}
      title={disabled ? "Telegram'da oching" : undefined}
      onClick={toggle}
      style={{ width: px, height: px }}
      className={cn(
        'inline-flex items-center justify-center rounded-full backdrop-blur-sm transition-colors duration-base',
        disabled
          ? 'bg-black/30 text-white/50 cursor-not-allowed opacity-60'
          : saved
            ? 'bg-white/95 text-danger'
            : 'bg-black/40 text-white hover:bg-black/55',
        pending && 'opacity-70',
      )}
    >
      {saved ? <RiHeart3Fill size={ic} /> : <RiHeart3Fill size={ic} />}
    </button>
  );
}
