import {
  RiCloseFill,
  RiEmotionUnhappyFill,
  RiErrorWarningFill,
  RiLockFill,
  RiRefreshFill,
  RiTelegramFill,
} from '@remixicon/react';
import { Button } from '@/components/ui';
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
      <Layout
        icon={<RiLockFill size={40} />}
        iconColor="purple"
        title="Siz hali sotuvchi emassiz"
        description="Avval botga kirib do'kon yarating."
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          iconLeft={<RiTelegramFill size={20} />}
          onClick={() => openSellerBotDeeplink('start')}
        >
          Botga o'tish
        </Button>
      </Layout>
    );
  }

  // 401 — auth muammosi
  if (error instanceof AuthError) {
    return (
      <Layout
        icon={<RiErrorWarningFill size={40} />}
        iconColor="warning"
        title="Avtorizatsiya muammosi"
        description="Mini App'ni yopib qaytadan oching yoki botga kiring."
      >
        <Button
          variant="outline"
          size="lg"
          fullWidth
          iconLeft={<RiCloseFill size={20} />}
          onClick={() => tgWebApp()?.close()}
        >
          Yopish
        </Button>
      </Layout>
    );
  }

  // Boshqa xato — Network, 500, va h.k.
  const msg = error instanceof Error ? error.message : 'Tarmoq xatosi';
  return (
    <Layout
      icon={<RiEmotionUnhappyFill size={40} />}
      iconColor="danger"
      title="Xato yuz berdi"
      description={msg}
    >
      {onRetry && (
        <Button
          variant="primary"
          size="lg"
          fullWidth
          iconLeft={<RiRefreshFill size={20} />}
          onClick={onRetry}
        >
          Qayta urinish
        </Button>
      )}
    </Layout>
  );
}

interface LayoutProps {
  icon: React.ReactNode;
  iconColor: 'brand' | 'warning' | 'danger' | 'purple';
  title: string;
  description: string;
  children?: React.ReactNode;
}

const ICON_BG: Record<LayoutProps['iconColor'], string> = {
  brand:   'bg-brand-subtle text-brand',
  warning: 'bg-warning-subtle text-warning',
  danger:  'bg-danger-subtle text-danger',
  purple:  'bg-purple-subtle text-purple',
};

function Layout({ icon, iconColor, title, description, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-bg-2 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${ICON_BG[iconColor]}`}>
          {icon}
        </div>
        <h2 className="font-display text-xl font-semibold text-fg-1 mb-2">{title}</h2>
        <p className="text-sm text-fg-3 font-body mb-6">{description}</p>
        {children}
      </div>
    </div>
  );
}
