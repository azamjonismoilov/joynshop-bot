import { useEffect, useState } from 'react';
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiExternalLinkLine,
  RiSearchLine,
} from '@remixicon/react';
import { Button, Input, Modal } from '@/components/ui';
import { useMxikSearch } from '@/api/seller';
import type { MxikItem } from '@/api/types';
import { cn } from '@/lib/cn';

interface Props {
  isOpen:   boolean;
  onClose:  () => void;
  onPick:   (item: MxikItem) => void;
}

export function MxikSearchModal({ isOpen, onClose, onPick }: Props) {
  const [query, setQuery]         = useState('');
  const [debounced, setDebounced] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 500);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebounced('');
      setManualOpen(false);
      setManualCode('');
      setManualError(null);
    }
  }, [isOpen]);

  const { data, isLoading, isError } = useMxikSearch(debounced);
  const results       = data?.results ?? [];
  const searchFailed  = debounced.length >= 3 && (isError || data?.ok === false);
  const searchEmpty   = debounced.length >= 3 && data?.ok && results.length === 0;

  const submitManual = () => {
    const cleaned = manualCode.replace(/\D/g, '');
    if (!/^\d{17}$/.test(cleaned)) {
      setManualError("MXIK kodi aynan 17 raqamdan iborat bo'lishi kerak");
      return;
    }
    onPick({ code: cleaned, name: "Qo'lda kiritildi" });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="MXIK qidirish">
      <p className="text-sm text-fg-3 font-body mb-3">
        Mahsulot nomi yoki kalit so'z (masalan: krem, ko'ylak)
      </p>
      <Input
        fullWidth
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Qidirish..."
        iconLeft={<RiSearchLine size={16} />}
      />

      <div className="mt-3 max-h-[40vh] overflow-y-auto -mx-2">
        {debounced.length < 3 && (
          <p className="text-sm text-fg-4 font-body text-center py-4 px-2">
            Kamida 3 ta belgi kiriting
          </p>
        )}
        {debounced.length >= 3 && isLoading && (
          <p className="text-sm text-fg-3 font-body text-center py-4 px-2">
            Qidirilmoqda...
          </p>
        )}
        {searchFailed && (
          <div className="px-2 py-3 text-center">
            <p className="text-sm text-danger font-body">
              Qidirish xato — tasnif.soliq.uz vaqtinchalik mavjud emas
            </p>
            <p className="text-xs text-fg-4 font-body mt-1">
              Kodni qo'lda kiriting (pastda)
            </p>
          </div>
        )}
        {searchEmpty && (
          <p className="text-sm text-fg-3 font-body text-center py-4 px-2">
            Hech narsa topilmadi
          </p>
        )}
        {results.length > 0 && (
          <ul className="space-y-1">
            {results.slice(0, 20).map((it) => (
              <li key={it.code}>
                <button
                  type="button"
                  onClick={() => { onPick(it); onClose(); }}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-bg-2 border border-transparent hover:border-border transition-colors duration-base"
                >
                  <p className="text-sm text-fg-1 font-body line-clamp-2">{it.name}</p>
                  <p className="text-xs text-fg-3 font-mono mt-0.5">{it.code}</p>
                  {it.classify && (
                    <p className="text-[10px] text-fg-4 font-body mt-0.5 line-clamp-1">
                      {it.classify}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── Manual entry ─── */}
      <div className="mt-4 pt-4 border-t border-border">
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={manualOpen}
        >
          <span className="text-sm font-display font-medium text-fg-1">
            Yoki MXIK kodini qo'lda kiriting
          </span>
          <RiArrowDownSLine
            size={18}
            className={cn(
              'text-fg-3 shrink-0 transition-transform duration-base',
              manualOpen && 'rotate-180',
            )}
          />
        </button>
        {manualOpen && (
          <div className="mt-3 space-y-2">
            <Input
              fullWidth
              inputMode="numeric"
              maxLength={17}
              value={manualCode}
              onChange={(e) => {
                setManualCode(e.target.value.replace(/\D/g, '').slice(0, 17));
                setManualError(null);
              }}
              placeholder="01234567890123456"
              hint="17 raqamli MXIK kodi"
              error={manualError || undefined}
            />
            <p className="text-[10px] text-fg-4 font-mono text-right">
              {manualCode.length}/17
            </p>
            <Button
              variant="primary"
              size="md"
              fullWidth
              iconLeft={<RiCheckLine size={16} />}
              disabled={manualCode.length !== 17}
              onClick={submitManual}
            >
              Kodni tasdiqlash
            </Button>
            <a
              href="https://tasnif.soliq.uz/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand hover:underline font-body"
            >
              MXIK kodini bilmaysizmi? tasnif.soliq.uz dan toping
              <RiExternalLinkLine size={12} />
            </a>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 mt-4">
        <Button variant="outline" size="lg" onClick={onClose}>
          Yopish
        </Button>
      </div>
    </Modal>
  );
}
