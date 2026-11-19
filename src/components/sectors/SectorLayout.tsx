import React from 'react';
import { ArrowLeft, LayoutGrid, Pin } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { SECTORS_CATALOG } from '../../data/ecosystemCatalog';
import type { FiveSectorId, SubmenuId } from '../../types/ecosystem';

interface SectorLayoutProps {
  sectorId: FiveSectorId;
  activeSubmenu: SubmenuId;
  badgeText?: string;
  children: React.ReactNode;
}

export const SectorLayout: React.FC<SectorLayoutProps> = ({
  sectorId,
  activeSubmenu,
  badgeText,
  children,
}) => {
  const { goBack, navigateTo, isToolPinned, togglePinTool } = useEcosystem();
  const sectorMeta = SECTORS_CATALOG.find((s) => s.id === sectorId)!;
  const { palette } = sectorMeta;
  const pinned = isToolPinned(sectorId, activeSubmenu);

  return (
    <div className="space-y-5">
      {/* Structured 2-Band Sector Header & Orderly Submenu Bar */}
      <section
        className="rounded-2xl border fabro-surface overflow-hidden"
        style={{ borderColor: `${palette.primary}45` }}
      >
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={goBack}
                className="min-h-[42px] md:min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-1.5 text-sm font-medium cursor-pointer active:scale-95 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={2} />
                Volver
              </button>
              <span
                className="font-mono text-xs font-bold uppercase tracking-wider tabular-nums"
                style={{ color: palette.primary }}
              >
                Sector {sectorMeta.number}
              </span>
              {badgeText && (
                <>
                  <span aria-hidden="true" className="fabro-muted">
                    ·
                  </span>
                  <span className="fabro-muted font-medium">{badgeText}</span>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              {sectorMeta.title}
            </h1>
            <p className="text-sm fabro-muted leading-relaxed max-w-3xl">
              {sectorMeta.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => togglePinTool(sectorId, activeSubmenu)}
              className={`min-h-[42px] md:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 md:py-2 text-sm font-medium cursor-pointer active:scale-95 transition-all duration-200 whitespace-nowrap ${
                pinned
                  ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'fabro-border fabro-surface-elevated hover:border-[var(--fabro-accent)]'
              }`}
            >
              <Pin className={`w-4 h-4 ${pinned ? 'fill-current' : ''}`} strokeWidth={2} />
              {pinned ? 'Fijado en Espacio' : 'Fijar en Espacio'}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('inicio', 'dashboard')}
              className="min-h-[42px] md:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-1.5 md:py-2 text-sm font-medium cursor-pointer active:scale-95 transition-all duration-200 whitespace-nowrap"
            >
              <LayoutGrid className="w-4 h-4 fabro-accent-text" />
              Mi Espacio
            </button>
          </div>
        </div>

        {/* Orderly Submenu Strip */}
        <div className="px-4 sm:px-5 py-2.5 border-t fabro-border fabro-surface-elevated">
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

      {children}
    </div>
  );
};
