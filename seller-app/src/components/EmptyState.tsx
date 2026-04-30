import { Placeholder, Button } from '@telegram-apps/telegram-ui';
import { openSellerBotDeeplink } from '@/lib/telegram';

export function EmptyState() {
  return (
    <Placeholder
      header="Hali mahsulot yo'q"
      description="Mahsulot qo'shish uchun botga qayting."
      action={
        <Button
          size="m"
          mode="filled"
          onClick={() => openSellerBotDeeplink('addproduct')}
        >
          ➕ Botda mahsulot qo'shish
        </Button>
      }
    >
      <div style={{ fontSize: 64 }}>📦</div>
    </Placeholder>
  );
}
