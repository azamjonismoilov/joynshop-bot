import { useRef, useState } from 'react';
import { RiAddLine, RiCloseFill, RiErrorWarningFill, RiImageAddFill } from '@remixicon/react';
import { useUploadProductPhoto } from '@/api/seller';
import { cn } from '@/lib/cn';

const MAX_PHOTOS = 5;
const MAX_SIZE   = 5 * 1024 * 1024; // 5 MB

interface UploadItem {
  id:        string;
  preview:   string;      // local object URL
  url?:      string;      // S3 URL after upload
  status:    'uploading' | 'done' | 'error';
  errorMsg?: string;
}

interface Props {
  urls:    string[];
  onChange: (urls: string[]) => void;
}

export function PhotoUploader({ urls, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>(() =>
    urls.map((u, i) => ({ id: `init-${i}`, preview: u, url: u, status: 'done' as const })),
  );
  const upload = useUploadProductPhoto();

  const remaining = MAX_PHOTOS - items.length;
  const canAdd = remaining > 0;

  const sync = (next: UploadItem[]) => {
    setItems(next);
    onChange(next.filter((it) => it.url).map((it) => it.url!));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files).slice(0, remaining);
    const newItems: UploadItem[] = list.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      preview: URL.createObjectURL(f),
      status: 'uploading' as const,
    }));
    const merged = [...items, ...newItems];
    setItems(merged);
    // Upload one-by-one
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const localItem = newItems[i];
      if (file.size > MAX_SIZE) {
        merged.splice(merged.findIndex((x) => x.id === localItem.id), 1, {
          ...localItem, status: 'error', errorMsg: '5 MB dan katta',
        });
        setItems([...merged]);
        continue;
      }
      try {
        const res = await upload.mutateAsync(file);
        const idx = merged.findIndex((x) => x.id === localItem.id);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], url: res.photo_url, status: 'done' };
        }
      } catch (e) {
        const idx = merged.findIndex((x) => x.id === localItem.id);
        if (idx >= 0) {
          merged[idx] = {
            ...merged[idx], status: 'error',
            errorMsg: e instanceof Error ? e.message : 'Yuklab bo\'lmadi',
          };
        }
      }
      sync([...merged]);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (id: string) => {
    sync(items.filter((it) => it.id !== id));
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => (
          <div
            key={it.id}
            className="relative aspect-square rounded-md overflow-hidden bg-bg-3"
          >
            <img src={it.preview} alt="" className="w-full h-full object-cover" />
            {it.status === 'uploading' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {it.status === 'error' && (
              <div className="absolute inset-0 bg-danger/80 flex flex-col items-center justify-center text-white text-[10px] text-center px-1">
                <RiErrorWarningFill size={20} />
                <span className="mt-0.5">{it.errorMsg}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => remove(it.id)}
              aria-label="O'chirish"
              className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <RiCloseFill size={14} />
            </button>
          </div>
        ))}
        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'aspect-square rounded-md border-2 border-dashed border-border',
              'flex flex-col items-center justify-center gap-1 text-fg-3',
              'hover:border-brand hover:text-brand transition-colors duration-base',
            )}
          >
            {items.length === 0 ? (
              <>
                <RiImageAddFill size={28} />
                <span className="text-[10px] font-body">Rasm qo'shish</span>
              </>
            ) : (
              <>
                <RiAddLine size={24} />
                <span className="text-[10px] font-mono">{items.length}/{MAX_PHOTOS}</span>
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-[10px] text-fg-4 font-body mt-2">
        1–{MAX_PHOTOS} ta rasm, har biri 5 MB gacha
      </p>
    </div>
  );
}
