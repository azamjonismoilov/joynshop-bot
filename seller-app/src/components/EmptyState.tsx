import { Link } from 'react-router-dom';
import { RiAddFill, RiBox3Fill, RiTelegramFill } from '@remixicon/react';
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
          Birinchi mahsulotingizni Mini App orqali yoki botda
          qo'shing.
        </p>
        <div className="space-y-2">
          <Link to="/products/new" className="block">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              iconLeft={<RiAddFill size={20} />}
            >
              Yangi mahsulot qo'shish
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="md"
            fullWidth
            iconLeft={<RiTelegramFill size={16} />}
            onClick={() => openSellerBotDeeplink('addproduct')}
          >
            Yoki botda qo'shish
          </Button>
        </div>
      </div>
    </div>
  );
}
