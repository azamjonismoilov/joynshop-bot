import {
  RiEmotionUnhappyFill,
  RiRefreshFill,
} from '@remixicon/react';
import { Button } from '@/components/ui';

interface Props {
  error: unknown;
  onRetry?: () => void;
}

export function ErrorState({ error, onRetry }: Props) {
  const msg = error instanceof Error ? error.message : 'Tarmoq xatosi';
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-danger-subtle text-danger mb-4">
          <RiEmotionUnhappyFill size={40} />
        </div>
        <h2 className="font-display text-xl font-semibold text-fg-1 mb-2">Xato yuz berdi</h2>
        <p className="text-sm text-fg-3 font-body mb-6">{msg}</p>
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
      </div>
    </div>
  );
}
