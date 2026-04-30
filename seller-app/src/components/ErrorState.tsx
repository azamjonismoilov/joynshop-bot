import { Placeholder, Button } from '@telegram-apps/telegram-ui';
import { AuthError, NotASellerError } from '@/api/client';
import { openSellerBotDeeplink, tgWebApp } from '@/lib/telegram';

interface Props {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: Props) {
  // 403 — sotuvchi emas
  if (error instanceof NotASellerError) {
    return (
      <Placeholder
        header="Siz hali sotuvchi emassiz"
        description="Avval botga kirib do'kon yarating."
        action={
          <Button size="m" mode="filled" onClick={() => openSellerBotDeeplink('start')}>
            🤖 Botga o'tish
          </Button>
        }
      >
        <div style={{ fontSize: 64 }}>🔒</div>
      </Placeholder>
    );
  }

  // 401 — auth muammosi
  if (error instanceof AuthError) {
    return (
      <Placeholder
        header="Avtorizatsiya muammosi"
        description="Mini App'ni yopib qaytadan oching yoki botga kiring."
        action={
          <Button size="m" mode="filled" onClick={() => tgWebApp()?.close()}>
            ❌ Yopish
          </Button>
        }
      >
        <div style={{ fontSize: 64 }}>⚠️</div>
      </Placeholder>
    );
  }

  // Boshqa xato — Network, 500, va h.k.
  return (
    <Placeholder
      header="Xato yuz berdi"
      description={error instanceof Error ? error.message : 'Tarmoq xatosi'}
      action={
        onRetry && (
          <Button size="m" mode="filled" onClick={onRetry}>
            🔄 Qayta urinish
          </Button>
        )
      }
    >
      <div style={{ fontSize: 64 }}>😕</div>
    </Placeholder>
  );
}
