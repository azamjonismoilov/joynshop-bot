import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiHeart3Fill, RiHome5Line } from '@remixicon/react';
import { useQueryClient } from '@tanstack/react-query';
import { useWishlist } from '@/api/buyer';
import { AppHeader } from '@/components/AppHeader';
import { Button, SkeletonProductCard } from '@/components/ui';
import { ProductCard } from '@/components/ProductCard';
import { ProductDetailSheet } from '@/components/ProductDetailSheet';
import { CheckoutSheet } from '@/components/CheckoutSheet';
import { PullToRefresh } from '@/components/PullToRefresh';
import { ErrorState } from '@/components/ErrorState';
import { EmptyState } from '@/components/EmptyState';
import { hapticImpact } from '@/lib/haptic';
import { getTgUser } from '@/lib/telegram';

export function WishlistScreen() {
  const navigate = useNavigate();
  const uid      = getTgUser()?.id ?? null;
  const list     = useWishlist(uid);
  const qc       = useQueryClient();

  // Modal stack — HomeScreen pattern bilan parallel
  const [openPid, setOpenPid]   = useState<string | null>(null);
  const [showCheckout, setShow] = useState(false);
  const [checkoutType, setType] = useState<'group' | 'solo'>('group');

  const items = list.data || [];

  const handleRefresh = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ['buyer', 'wishlist', uid] }),
      qc.refetchQueries({ queryKey: ['buyer', 'wishlist-ids', uid] }),
    ]);
  };
  const anyModalOpen = !!openPid || showCheckout;

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={anyModalOpen}>
    <div className="min-h-screen bg-bg-2 pb-28">
      <AppHeader tagline="Saqlanganlar" />

      <main className="px-4 mt-4">
        {!uid ? (
          <EmptyState
            icon={<RiHeart3Fill size={36} />}
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
          <EmptyState
            icon={<RiHeart3Fill size={36} />}
            title="Saqlangan mahsulot yo'q"
            description="Yoqtirgan mahsulotlarni saqlasangiz — bu yerda paydo bo'ladi."
            action={
              <Button
                variant="primary"
                size="lg"
                fullWidth
                iconLeft={<RiHome5Line size={18} />}
                onClick={() => navigate('/')}
              >
                Bosh sahifaga
              </Button>
            }
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
                  onClick={() => { hapticImpact('light'); setOpenPid(p.id); }}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <ProductDetailSheet
        isOpen={!!openPid && !showCheckout}
        pid={openPid}
        onClose={() => setOpenPid(null)}
        onBuyClick={(t) => { setType(t); setShow(true); }}
        snapPoints={['half', 'full']}
        initialSnap="half"
      />
      <CheckoutSheet
        isOpen={showCheckout}
        pid={openPid}
        defaultType={checkoutType}
        onClose={() => { setShow(false); }}
      />
    </div>
    </PullToRefresh>
  );
}
