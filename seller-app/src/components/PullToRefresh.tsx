import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { RiRefreshLine } from '@remixicon/react';
import { cn } from '@/lib/cn';
import { hapticImpact, hapticNotify } from '@/lib/haptic';

interface Props {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  /** Modal/Sheet/Keyboard ochiq paytda disabled — parent qayd qiladi. */
  disabled?: boolean;
  /** Minimum refresh display vaqti — too-fast feedback noxush. */
  minRefreshMs?: number;
  children: ReactNode;
}

const DEFAULT_THRESHOLD = 80;
const DEFAULT_MIN_MS    = 600;
const MAX_PULL          = 160;

/**
 * Pull-to-refresh wrapper — window scroll'a attach qiladi.
 * Scroll top'da ekan, pastga drag — refresh.
 *
 * - Resistance curve: distance = rawDelta * (1 - rawDelta/300)
 * - Spinner: brand orange dot rotation
 * - Haptic: light impact threshold reached, notify success/error
 * - Min refresh time: 600ms (UX)
 */
export function PullToRefresh({
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  disabled,
  minRefreshMs = DEFAULT_MIN_MS,
  children,
}: Props) {
  const [distance, setDistance]   = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const stateRef = useRef<{
    startY:      number;
    isPulling:   boolean;
    hapticFired: boolean;
  } | null>(null);

  // Disabled qachon: prop yoki keyboard ochiq paytda
  const isKeyboardFocused = useRef(false);
  useEffect(() => {
    const onFocusIn = () => {
      const el = document.activeElement;
      if (!el) return;
      const tag = el.tagName.toLowerCase();
      const editable = (el as HTMLElement).isContentEditable;
      isKeyboardFocused.current = tag === 'input' || tag === 'textarea' || editable;
    };
    const onFocusOut = () => { isKeyboardFocused.current = false; };
    document.addEventListener('focusin',  onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin',  onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  const reset = useCallback(() => {
    setDistance(0);
    stateRef.current = null;
  }, []);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || refreshing) return;
    if (isKeyboardFocused.current) return;
    if (e.touches.length !== 1) return;
    if (window.scrollY > 0) return;
    stateRef.current = {
      startY:      e.touches[0].clientY,
      isPulling:   false,
      hapticFired: false,
    };
  }, [disabled, refreshing]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    const s = stateRef.current;
    if (!s || disabled || refreshing) return;
    if (window.scrollY > 0) { reset(); return; }
    const dy = e.touches[0].clientY - s.startY;
    if (dy <= 0) {
      if (s.isPulling) reset();
      return;
    }
    // Resistance: quadratic ease
    const raw = Math.min(dy, MAX_PULL * 2);
    const eased = Math.min(MAX_PULL, raw * (1 - raw / 600));
    if (eased > 8 && !s.isPulling) {
      s.isPulling = true;
    }
    if (s.isPulling) {
      e.preventDefault();
      setDistance(eased);
      // Haptic fire when threshold reached (once)
      if (!s.hapticFired && eased >= threshold) {
        s.hapticFired = true;
        hapticImpact('light');
      }
      if (s.hapticFired && eased < threshold) {
        s.hapticFired = false; // re-fire on next reach
      }
    }
  }, [disabled, refreshing, threshold, reset]);

  const onTouchEnd = useCallback(async () => {
    const s = stateRef.current;
    if (!s) return;
    const triggered = s.isPulling && distance >= threshold;
    reset();
    if (!triggered || refreshing) return;

    setRefreshing(true);
    const startedAt = Date.now();
    try {
      await onRefresh();
      const elapsed = Date.now() - startedAt;
      const remain  = Math.max(0, minRefreshMs - elapsed);
      if (remain > 0) await new Promise((r) => setTimeout(r, remain));
      hapticNotify('success');
    } catch {
      hapticNotify('error');
    } finally {
      setRefreshing(false);
    }
  }, [distance, threshold, refreshing, onRefresh, minRefreshMs, reset]);

  useEffect(() => {
    // passive: false to allow preventDefault
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { passive: false });
    document.addEventListener('touchend',   onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  const visibleDistance = refreshing ? threshold : distance;
  const progress = Math.min(1, visibleDistance / threshold);
  const opacity  = Math.min(1, visibleDistance / 40);
  const isReady  = !refreshing && distance >= threshold;
  const dragging = distance > 0 || refreshing;

  return (
    <div className="relative">
      {/* Spinner indicator */}
      <div
        aria-hidden
        className="absolute left-0 right-0 -top-2 flex items-center justify-center pointer-events-none z-10"
        style={{
          transform: `translateY(${visibleDistance}px)`,
          opacity,
          transition: dragging && !refreshing ? 'none' : 'transform 250ms ease-out, opacity 200ms',
        }}
      >
        <div
          className={cn(
            'w-9 h-9 rounded-full bg-bg-1 shadow-md flex items-center justify-center',
            'transition-colors duration-base',
          )}
          style={{
            transform: refreshing ? 'rotate(0deg)' : `rotate(${progress * 270}deg)`,
            transition: refreshing ? 'none' : 'transform 100ms linear',
          }}
        >
          {refreshing ? (
            <div
              className="w-5 h-5 rounded-full border-[2.5px] border-brand-subtle border-t-brand"
              style={{ animation: 'spin 0.7s linear infinite' }}
            />
          ) : (
            <RiRefreshLine
              size={20}
              className={isReady ? 'text-brand' : 'text-fg-3'}
            />
          )}
        </div>
      </div>

      {/* Content — drag paytida pastga siljiydi */}
      <div
        style={{
          transform: `translateY(${visibleDistance}px)`,
          transition: dragging && !refreshing ? 'none' : 'transform 250ms ease-out',
        }}
      >
        {children}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
