import { useNavigate } from 'react-router-dom';
import { RiHeart3Fill } from '@remixicon/react';
import { useQueryClient } from '@tanstack/react-query';
import { useWishlist } from '@/api/buyer';
import { AppHeader } from '@/components/AppHeader';
import { SkeletonProductCard } from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { PullToRefresh } from '@/components/PullToRefresh';
import { ErrorState } from '@/components/ErrorState';
import { hapticImpact } from '@/lib/haptic';
import { getTgUser } from '@/lib/telegram';

export function WishlistScreen() {
  const navigate = useNavigate();
  const uid      = getTgUser()?.id ?? null;
  const list     = useWishlist(uid);
  const qc       = useQueryClient();

  const items = list.data || [];

  const handleRefresh = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ['buyer', 'wishlist', uid] }),
      qc.refetchQueries({ queryKey: ['buyer', 'wishlist-ids', uid] }),
    ]);
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="min-h-screen bg-bg-2 pb-28">
      <AppHeader tagline="Saqlanganlar" />

      <main className="px-4 mt-4">
        {!uid ? (
          <CenteredEmpty
            title="Telegram orqali kiring"
            description="Saqlangan mahsulotlar Telegram hisobingiz bilan bog'liq."
          />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonProductCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <CenteredEmpty
            title="Saqlangan mahsulot yo'q"
            description="Yoqqan mahsulotlarni saqlash uchun yurakcha bossin."
          />
        ) : (
          <>
            <p className="text-xs text-fg-3 font-body mb-3">
              {items.length} ta saqlangan mahsulot
            </p>
            <div className="grid grid-cols-2 gap-3">
              {items.map((p) => (
                <ProductCard
                  key={p.id}
                  item={p}
                  onClick={() => { hapticImpact('light'); navigate(`/products/${p.id}`); }}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
    </PullToRefresh>
  );
}

/**
 * WishlistScreen empty — markazda, CTA tugmasiz.
 * AppHeader + BottomNav balandligini hisobga oladigan markazlash.
 */
function CenteredEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6"
      style={{ minHeight: 'calc(100vh - 240px)' }}
    >
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-bg-1 shadow-xs text-danger mb-4">
        <RiHeart3Fill size={40} />
      </div>
      <h2 className="font-display text-lg font-semibold text-fg-1 mb-1.5">{title}</h2>
      <p className="text-sm text-fg-3 font-body max-w-xs">{description}</p>
    </div>
  );
}
