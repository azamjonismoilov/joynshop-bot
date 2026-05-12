import { useEffect, useState } from 'react';
import { RiSearchLine } from '@remixicon/react';
import { Button, Input, Modal } from '@/components/ui';
import { useMxikSearch } from '@/api/seller';
import type { MxikItem } from '@/api/types';

interface Props {
  isOpen:   boolean;
  onClose:  () => void;
  onPick:   (item: MxikItem) => void;
}

export function MxikSearchModal({ isOpen, onClose, onPick }: Props) {
  const [query, setQuery]       = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 500);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebounced('');
    }
  }, [isOpen]);

  const { data, isLoading, isError } = useMxikSearch(debounced);
  const results = data?.results ?? [];

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

      <div className="mt-3 max-h-[50vh] overflow-y-auto -mx-2">
        {debounced.length < 3 && (
          <p className="text-sm text-fg-4 font-body text-center py-6 px-2">
            Kamida 3 ta belgi kiriting
          </p>
        )}
        {debounced.length >= 3 && isLoading && (
          <p className="text-sm text-fg-3 font-body text-center py-6 px-2">
            Qidirilmoqda...
          </p>
        )}
        {debounced.length >= 3 && (isError || data?.ok === false) && (
          <div className="px-2 py-4 text-center">
            <p className="text-sm text-danger font-body">
              Qidirish xato — tasnif.soliq.uz vaqtinchalik mavjud emas
            </p>
            <p className="text-xs text-fg-4 font-body mt-1">
              Birozdan keyin qaytadan urinib ko'ring yoki o'tkazib yuboring
            </p>
          </div>
        )}
        {debounced.length >= 3 && data?.ok && results.length === 0 && (
          <p className="text-sm text-fg-3 font-body text-center py-6 px-2">
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

      <div className="grid grid-cols-1 gap-2 mt-4">
        <Button variant="outline" size="lg" onClick={onClose}>
          Yopish
        </Button>
      </div>
    </Modal>
  );
}
