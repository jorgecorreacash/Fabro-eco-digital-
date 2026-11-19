import React, { useEffect, useRef } from 'react';
import { Pin } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { SECTORS_CATALOG } from '../../data/ecosystemCatalog';
import type { FiveSectorId, SubmenuId } from '../../types/ecosystem';
import { SwipeableSubscreenContainer } from '../navigation/SwipeableSubscreenContainer';

interface SectorLayoutProps {
  sectorId: FiveSectorId;
  activeSubmenu: SubmenuId;
  badgeText?: string;
  children: React.ReactNode;
}

export const SectorLayout: React.FC<SectorLayoutProps> = ({
  sectorId,
  activeSubmenu,
  children,
}) => {
  const { navigateTo, isToolPinned } = useEcosystem();
  const sectorMeta = SECTORS_CATALOG.find((s) => s.id === sectorId)!;
  const { palette } = sectorMeta;
  const swipeEnabled =
    sectorId === 'estudio' || sectorId === 'bienestar' || sectorId === 'social';

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const activeTabEl = tabRefs.current[activeSubmenu];
    if (activeTabEl) {
      activeTabEl.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeSubmenu]);

  return (
    <div className="space-y-5">
      {/* Orderly Submenu Bar */}
      <section
        className="rounded-2xl border fabro-surface overflow-hidden"
        style={{ borderColor: `${palette.primary}45` }}
      >
        <div className="px-4 sm:px-5 py-2.5 fabro-surface-elevated">
          <div
            role="tablist"
            aria-label={`Submenú de ${sectorMeta.title}`}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar sm:flex-wrap"
          >
            {sectorMeta.submenus.map((sub) => {
              const active = activeSubmenu === sub.id;
              const subPinned = isToolPinned(sectorId, sub.id);
              return (
                <button
                  key={sub.id}
                  ref={(el) => {
                    tabRefs.current[sub.id] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => navigateTo(sectorId, sub.id)}
                  className={`min-h-[42px] md:min-h-[36px] px-3.5 py-1.5 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 active:scale-95 ${
                    active ? 'text-white font-semibold' : 'fabro-border fabro-surface hover:border-[var(--fabro-accent)]'
                  }`}
                  style={
                    active
                      ? {
                          background: palette.gradientCss,
                          borderColor: palette.primary,
                          boxShadow: `0 4px 12px ${palette.shadowRgba}`,
                        }
                      : undefined
                  }
                >
                  <span>{sub.shortLabel}</span>
                  {subPinned && (
                    <Pin
                      className={`w-3 h-3 ${active ? 'text-white/90' : 'text-amber-600 dark:text-amber-400'}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <SwipeableSubscreenContainer
        enabled={swipeEnabled}
        items={sectorMeta.submenus.map((s) => ({ id: s.id, label: s.shortLabel }))}
        activeId={activeSubmenu}
        onSelect={(nextSubId) => navigateTo(sectorId, nextSubId as SubmenuId)}
        accentColor={palette.primary}
        galleryLabel={`Indicador deslizable de ${sectorMeta.title}`}
      >
        {children}
      </SwipeableSubscreenContainer>
    </div>
  );
};
