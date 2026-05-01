import { RiAddFill, RiBox3Fill } from '@remixicon/react';
import { Button } from '@/components/ui';
import { openSellerBotDeeplink } from '@/lib/telegram';

export function EmptyState() {
  return (
    <div className="min-h-screen bg-bg-2 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-subtle text-brand mb-4">
          <RiBox3Fill size={40} />
        </div>
        <h2 className="font-display text-xl font-semibold text-fg-1 mb-2">
          Hali mahsulot yo'q
        </h2>
        <p className="text-sm text-fg-3 font-body mb-6">
          Mahsulot qo'shish uchun botga qayting. Birinchi mahsulot
          ro'yxatda paydo bo'lganda bu yerda ko'rsatamiz.
        </p>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          iconLeft={<RiAddFill size={20} />}
          onClick={() => openSellerBotDeeplink('addproduct')}
        >
          Botda mahsulot qo'shish
        </Button>
      </div>
    </div>
  );
}
