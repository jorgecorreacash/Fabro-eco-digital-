import React, { useCallback, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface SwipeableSubscreenItem {
  id: string;
  label: string;
}

interface SwipeableSubscreenContainerProps {
  items: SwipeableSubscreenItem[];
  activeId: string;
  onSelect: (id: string) => void;
  accentColor: string;
  galleryLabel: string;
  enabled?: boolean;
  children: React.ReactNode;
}

export const SwipeableSubscreenContainer: React.FC<SwipeableSubscreenContainerProps> = ({
  items,
  activeId,
  onSelect,
  accentColor,
  galleryLabel,
  enabled = true,
  children,
}) => {
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId)
  );
  const currentItem = items[activeIndex];

  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [slideTick, setSlideTick] = useState(0);

  const gestureRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    lock: 'pending' | 'horizontal' | 'vertical' | 'ignored';
  } | null>(null);

  const selectWithDirection = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= items.length || nextIndex === activeIndex) return;
      setSlideDir(nextIndex > activeIndex ? 'left' : 'right');
      setSlideTick((n) => n + 1);
      onSelect(items[nextIndex].id);
    },
    [activeIndex, items, onSelect]
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!enabled || items.length <= 1 || e.touches.length !== 1) return;

    let node = e.target as HTMLElement | null;
    let shouldIgnore = false;
    while (node && node !== e.currentTarget) {
      const tag = node.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'CANVAS' ||
        node.isContentEditable ||
        node.getAttribute('draggable') === 'true' ||
        node.dataset.noSwipe === 'true' ||
        node.scrollWidth > node.clientWidth + 8
      ) {
        shouldIgnore = true;
        break;
      }
      node = node.parentElement;
    }

    gestureRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startTime: Date.now(),
      lock: shouldIgnore ? 'ignored' : 'pending',
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!enabled || !g || g.lock === 'ignored' || g.lock === 'vertical' || e.touches.length !== 1) {
      return;
    }

    const dx = e.touches[0].clientX - g.startX;
    const dy = e.touches[0].clientY - g.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (g.lock === 'pending') {
      // Yield immediately to vertical reading scroll
      if (absDy > 12 && absDy >= absDx * 0.9) {
        g.lock = 'vertical';
        setDragOffsetX(0);
        return;
      }
      if (absDx > 16 && absDx > absDy * 1.4) {
        g.lock = 'horizontal';
      } else {
        return;
      }
    }

    if (g.lock === 'horizontal') {
      const atStart = activeIndex === 0 && dx > 0;
      const atEnd = activeIndex === items.length - 1 && dx < 0;
      const damped = atStart || atEnd ? dx * 0.22 : Math.max(-72, Math.min(72, dx * 0.45));
      setDragOffsetX(damped);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    setDragOffsetX(0);

    if (!enabled || !g || g.lock === 'ignored' || g.lock === 'vertical') return;
    if (e.changedTouches.length !== 1) return;

    const dx = e.changedTouches[0].clientX - g.startX;
    const dy = e.changedTouches[0].clientY - g.startY;
    const elapsed = Math.max(1, Date.now() - g.startTime);
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const isIntentionalHorizontal =
      (absDx >= 54 || (absDx >= 32 && elapsed <= 260)) && absDx > absDy * 1.35;

    if (!isIntentionalHorizontal) return;

    // Prevent outer swipe containers (like HybridShell or outer SectorLayout) from double-navigating
    e.stopPropagation();

    if (dx < 0 && activeIndex < items.length - 1) {
      selectWithDirection(activeIndex + 1);
    } else if (dx > 0 && activeIndex > 0) {
      selectWithDirection(activeIndex - 1);
    }
  };

  const handleTouchCancel = () => {
    gestureRef.current = null;
    setDragOffsetX(0);
  };

  if (!enabled || items.length <= 1) {
    return <>{children}</>;
  }

  const barWidthPct = 100 / items.length;
  const enterAnimClass =
    slideDir === 'left'
      ? 'fabro-swipe-enter-left'
      : slideDir === 'right'
      ? 'fabro-swipe-enter-right'
      : '';

  return (
    <div
      data-swipe-gallery="true"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className="space-y-4 touch-pan-y"
    >
      {/* Active Slide Content with subtle drag & enter transitions */}
      <div
        key={`${activeId}-${slideTick}`}
        className={`transition-transform duration-150 ease-out ${enterAnimClass}`}
        style={
          dragOffsetX !== 0
            ? { transform: `translate3d(${dragOffsetX}px, 0, 0)` }
            : undefined
        }
      >
        {children}
      </div>

      {/* Discreet Synchronized Pagination Dots & Sliding Progress Bar */}
      <div
        role="region"
        aria-label={galleryLabel}
        className="no-print rounded-2xl border fabro-border fabro-surface px-3.5 py-2.5 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={activeIndex === 0}
            onClick={() => selectWithDirection(activeIndex - 1)}
            aria-label="Subpantalla anterior"
            className="min-h-[36px] min-w-[36px] rounded-xl border fabro-border fabro-surface-elevated inline-flex items-center justify-center disabled:opacity-35 cursor-pointer active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-center gap-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {items.map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectWithDirection(idx)}
                    aria-label={`Ir a ${item.label}`}
                    aria-current={isActive ? 'step' : undefined}
                    title={item.label}
                    className={`h-2.5 rounded-full transition-all duration-200 cursor-pointer ${
                      isActive ? 'w-7' : 'w-2.5 opacity-45 hover:opacity-80'
                    }`}
                    style={{
                      backgroundColor: isActive ? accentColor : 'var(--fabro-text-muted)',
                    }}
                  />
                );
              })}
            </div>
            <p className="text-[11px] fabro-muted font-medium truncate max-w-full">
              <span className="font-mono tabular-nums font-semibold" style={{ color: accentColor }}>
                {activeIndex + 1}/{items.length}
              </span>
              {' · '}
              <span>{currentItem?.label}</span>
              <span className="hidden sm:inline"> · Deslizá horizontalmente para cambiar</span>
            </p>
          </div>

          <button
            type="button"
            disabled={activeIndex === items.length - 1}
            onClick={() => selectWithDirection(activeIndex + 1)}
            aria-label="Siguiente subpantalla"
            className="min-h-[36px] min-w-[36px] rounded-xl border fabro-border fabro-surface-elevated inline-flex items-center justify-center disabled:opacity-35 cursor-pointer active:scale-95 shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Synchronized thin sliding progress bar */}
        <div
          aria-hidden="true"
          className="relative h-1 w-full rounded-full fabro-surface-elevated overflow-hidden"
        >
          <div
            className="h-full rounded-full transition-transform duration-300 ease-out"
            style={{
              width: `${barWidthPct}%`,
              transform: `translateX(${activeIndex * 100}%)`,
              backgroundColor: accentColor,
            }}
          />
        </div>
      </div>
    </div>
  );
};
