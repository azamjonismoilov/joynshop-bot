import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { useTelegramBackButton } from '@/lib/useTelegramBackButton';

export type SnapPoint = 'half' | 'full';

interface BottomSheetProps {
  isOpen:        boolean;
  onClose:       () => void;
  children:      ReactNode;
  /** Snap point'lar — default `['full']` (single state, hozirgi UX). */
  snapPoints?:   SnapPoint[];
  /** Boshlang'ich snap holat — default 'full'. */
  initialSnap?:  SnapPoint;
  /** Stack layer — Detail 100, Checkout 110, Referral 105. */
  zIndex?:       number;
  /** Pastga swipe orqali yopish — default true. */
  swipeToClose?: boolean;
  /** Snap state o'zgarganda chaqiriladi (parent monitorling uchun). */
  onSnapChange?: (snap: SnapPoint) => void;
  ariaLabel?:    string;
  /** Sheet root'iga qo'shimcha class. */
  className?:    string;
}

// Snap → translateY % qiymati. `full` 8% (92vh ko'rinadi), `half` 50%.
const SNAP_TRANSLATE: Record<SnapPoint, number> = {
  full: 8,
  half: 50,
};

const VELOCITY_THRESHOLD = 0.5;   // px/ms — keskin swipe
const DRAG_THRESHOLD     = 100;   // px — snap o'zgarish uchun minimal masofa
const CLOSE_THRESHOLD    = 100;   // px — half'dan closed'ga drag
const AXIS_LOCK_DELTA    = 10;    // px — vertikal vs horizontal aniqlash uchun ilk delta

export function BottomSheet({
  isOpen,
  onClose,
  children,
  snapPoints   = ['full'],
  initialSnap  = 'full',
  zIndex       = 100,
  swipeToClose = true,
  onSnapChange,
  ariaLabel,
  className,
}: BottomSheetProps) {
  const sheetRef    = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  const [snap, setSnap]         = useState<SnapPoint>(initialSnap);
  const [dragging, setDragging] = useState(false);
  // Live drag delta (px from current snap baseline). Touch handler `transform`ni
  // requestAnimationFrame ichida yangilaydi — React render'ga ehtiyoj yo'q.
  const dragRef = useRef<{
    startY:    number;
    startTime: number;
    currentY:  number;
    axisLocked: 'vertical' | 'horizontal' | null;
    startX:    number;
  } | null>(null);

  // Snap o'zgarsa parent'ga xabar
  useEffect(() => { onSnapChange?.(snap); }, [snap, onSnapChange]);

  // Open paytida initialSnap'ga qaytarish + body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    setSnap(initialSnap);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen, initialSnap]);

  // ESC handler
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Telegram BackButton — faqat multi-snap holatda BottomSheet boshqaradi
  // (full → half → closed). Single-state sheet'larda parent o'zi back handler
  // qo'ymaydi yoki BottomSheet onClose'iga delegate qiladi.
  const isMultiSnap = snapPoints.length > 1;
  const handleBack = useCallback(() => {
    if (snap === 'full' && snapPoints.includes('half')) {
      setSnap('half');
    } else {
      onClose();
    }
  }, [snap, snapPoints, onClose]);
  useTelegramBackButton(handleBack, isOpen && isMultiSnap);

  // Snap translation'ni DOM'ga yozish (drag yo'q paytda)
  useLayoutEffect(() => {
    if (!sheetRef.current || dragging) return;
    sheetRef.current.style.transform = `translateY(${SNAP_TRANSLATE[snap]}%)`;
    if (backdropRef.current) {
      backdropRef.current.style.opacity = snap === 'full' ? '0.55' : '0.30';
    }
  }, [snap, dragging]);

  // Touch handlers — drag interaction
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    dragRef.current = {
      startY:     t.clientY,
      startX:     t.clientX,
      startTime:  Date.now(),
      currentY:   t.clientY,
      axisLocked: null,
    };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const t = e.touches[0];
    const dy = t.clientY - d.startY;
    const dx = t.clientX - d.startX;

    // Dominant axis lock (ilk 10px)
    if (d.axisLocked === null) {
      if (Math.abs(dx) < AXIS_LOCK_DELTA && Math.abs(dy) < AXIS_LOCK_DELTA) return;
      d.axisLocked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (d.axisLocked === 'horizontal') {
        // Horizontal — drag emas (gallery swipe uchun)
        dragRef.current = null;
        return;
      }
      setDragging(true);
    }

    // Drag tegishliligi:
    // - Drag handle zone'da har doim
    // - Content'da: full state + scrollTop > 0 da o'tkazib yuborish (scroll)
    const target  = e.target as HTMLElement;
    const inHandle = !!target.closest('[data-sheet-handle]');
    const scrollEl = scrollRef.current;
    if (!inHandle && snap === 'full' && scrollEl) {
      if (scrollEl.scrollTop > 0 && dy > 0) {
        // Pastga drag, lekin content scroll qilingan — scroll davom etsin
        dragRef.current = null;
        setDragging(false);
        return;
      }
    }

    d.currentY = t.clientY;
    if (sheetRef.current) {
      const baseTranslate = SNAP_TRANSLATE[snap]; // %
      const winH = window.innerHeight;
      const dyPercent = (dy / winH) * 100;
      const newTranslate = Math.max(SNAP_TRANSLATE.full, baseTranslate + dyPercent);
      sheetRef.current.style.transform = `translateY(${newTranslate}%)`;
      if (backdropRef.current) {
        // Backdrop opacity: full (0.55) ↔ closed (0)
        const progress = Math.max(0, Math.min(1, (100 - newTranslate) / 92));
        backdropRef.current.style.opacity = `${0.55 * progress}`;
      }
    }
  };

  const onTouchEnd = () => {
    const d = dragRef.current;
    if (!d) { setDragging(false); return; }
    const dy = d.currentY - d.startY;
    const dt = Date.now() - d.startTime;
    const velocity = dy / Math.max(1, dt); // px/ms (pozitiv = pastga)
    dragRef.current = null;
    setDragging(false);

    const hasHalf = snapPoints.includes('half');

    // Velocity bilan keskin swipe
    if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
      if (velocity > 0) {
        // Pastga keskin
        if (snap === 'full' && hasHalf) {
          setSnap('half');
        } else if (swipeToClose) {
          onClose();
        }
      } else {
        // Yuqoriga keskin
        if (snap === 'half' && snapPoints.includes('full')) {
          setSnap('full');
        }
      }
      return;
    }

    // Distance bilan snap
    if (dy < -DRAG_THRESHOLD && snap === 'half' && snapPoints.includes('full')) {
      setSnap('full');
    } else if (dy > DRAG_THRESHOLD && snap === 'full' && hasHalf) {
      setSnap('half');
    } else if (dy > CLOSE_THRESHOLD && snap === 'half' && swipeToClose) {
      onClose();
    } else if (dy > CLOSE_THRESHOLD && snap === 'full' && !hasHalf && swipeToClose) {
      onClose();
    }
    // Aks holda — snap o'sha holatda qoladi, useLayoutEffect'da restore
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-end justify-center animate-[fadeIn_120ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      style={{ zIndex }}
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-black motion-safe:transition-opacity motion-safe:duration-300"
        style={{ opacity: snap === 'full' ? 0.55 : 0.30 }}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className={cn(
          'relative w-full max-w-md bg-bg-1 rounded-t-3xl shadow-xl',
          'flex flex-col overflow-hidden',
          'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out',
          // Sheet to'liq viewport balandligida (drag bilan tortilganda kichrayadi)
          className,
        )}
        style={{
          height:    '92vh',
          transform: `translateY(${SNAP_TRANSLATE[snap]}%)`,
          // Drag paytida transition o'chiriladi (smooth follow)
          transitionProperty: dragging ? 'none' : undefined,
          touchAction: 'pan-y',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div
          data-sheet-handle
          className="pt-2.5 pb-1.5 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing"
        >
          <div className="w-10 h-1 rounded-full bg-neutral-300" />
        </div>
        <div
          ref={scrollRef}
          data-scroll-region
          className={cn(
            'flex-1 overscroll-contain',
            snap === 'full' ? 'overflow-y-auto' : 'overflow-hidden',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
