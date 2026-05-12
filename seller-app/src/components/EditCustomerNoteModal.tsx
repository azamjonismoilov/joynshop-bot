import { useEffect, useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useUpdateCustomer } from '@/api/seller';
import { cn } from '@/lib/cn';

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  cuid:        string;
  currentNote: string;
}

const MAX_LEN = 300;

export function EditCustomerNoteModal({ isOpen, onClose, cuid, currentNote }: Props) {
  const [note, setNote] = useState(currentNote);
  const mutation = useUpdateCustomer();

  useEffect(() => {
    if (isOpen) {
      setNote(currentNote);
      mutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submit = () => {
    mutation.mutate(
      { cuid, payload: { note } },
      { onSuccess: () => onClose() },
    );
  };

  const isPending = mutation.isPending;
  const overLimit = note.length > MAX_LEN - 10;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isPending) onClose(); }}
      title="Mijoz haqida izoh"
    >
      <p className="text-sm text-fg-3 font-body mb-4">
        Sotuvchi sifatida mijoz haqida kichik eslatma yozing.
        Mijoz buni ko'rmaydi.
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, MAX_LEN))}
        placeholder="Masalan: Doim Click bilan to'laydi, yetkazib berishni tezroq xohlaydi"
        rows={5}
        disabled={isPending}
        className="w-full rounded-md border border-border bg-bg-1 px-3 py-2 text-sm font-body text-fg-1 placeholder:text-fg-4 resize-none focus:outline-none focus:border-border-focus disabled:opacity-50"
      />
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-fg-4 font-body">
          {note.length === 0 && currentNote ? "Bo'sh saqlasangiz izoh o'chiriladi" : ''}
        </span>
        <span className={cn(
          'text-[10px] font-mono',
          overLimit ? 'text-danger' : 'text-fg-4',
        )}>
          {note.length}/{MAX_LEN}
        </span>
      </div>

      {mutation.isError && (
        <p className="text-xs text-danger font-body mt-2">
          {mutation.error instanceof Error ? mutation.error.message : "Xato yuz berdi"}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 mt-5">
        <Button variant="outline" size="lg" onClick={onClose} disabled={isPending}>
          Bekor
        </Button>
        <Button variant="primary" size="lg" onClick={submit} disabled={isPending}>
          {isPending ? "Saqlanmoqda..." : 'Saqlash'}
        </Button>
      </div>
    </Modal>
  );
}
