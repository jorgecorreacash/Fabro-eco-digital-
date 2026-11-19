import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { PRIMARY_SCREENS_ORDER } from '../../data/ecosystemCatalog';
import type { SectorId, SubmenuId } from '../../types/ecosystem';

export const ColorfulScreenLoader: React.FC = () => {
  const { isScreenTransitioning } = useEcosystem();

  if (!isScreenTransitioning) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 inset-x-0 z-50 h-1 overflow-hidden pointer-events-none"
    >
      <div className="h-full w-full fabro-colorful-loader" />
    </div>
  );
};

export const ScreenIndicatorBar: React.FC = () => {
  const { sector, navigateTo, swipePrevScreen, swipeNextScreen } = useEcosystem();

  if (sector === 'admin') return null;

  const currentIdx = Math.max(
    0,
    PRIMARY_SCREENS_ORDER.findIndex((s) => s.sector === sector)
  );
  const current = PRIMARY_SCREENS_ORDER[currentIdx];

  return (
    <section
      aria-label="Indicador de pantalla actual"
      className="flex items-center justify-between gap-2 px-1"
    >
      <div className="flex items-center gap-2 min-w-0 text-xs">
        <span className="font-mono tabular-nums font-bold fabro-accent-text shrink-0">
          {currentIdx + 1}/{PRIMARY_SCREENS_ORDER.length}
        </span>
        <span aria-hidden="true" className="fabro-muted">
          ·
        </span>
        <span className="font-semibold truncate">{current.title}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Quiet pagination dots (desktop) */}
        <div
          role="navigation"
          aria-label="Indicador de pantallas"
          className="hidden sm:flex items-center gap-1.5 mr-1"
        >
          {PRIMARY_SCREENS_ORDER.map((item, idx) => {
            const active = item.sector === sector;
            return (
              <button
                key={item.sector}
                type="button"
                onClick={() => navigateTo(item.sector, item.submenu)}
                aria-label={`Ir a ${item.title}`}
                aria-current={active ? 'page' : undefined}
                title={`${idx + 1}. ${item.title}`}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  active ? 'w-5 bg-[var(--fabro-accent)]' : 'w-2 bg-[var(--fabro-border)] hover:opacity-80'
                }`}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={swipePrevScreen}
          aria-label="Pantalla anterior"
          className="min-h-[36px] min-w-[36px] rounded-xl border fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={swipeNextScreen}
          aria-label="Siguiente pantalla"
          className="min-h-[36px] min-w-[36px] rounded-xl border fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};

export interface WidgetLauncherItem {
  id: string;
  title: string;
  metric: string;
  subtitle: string;
  sector: SectorId;
  submenu: SubmenuId;
  gradientCss: string;
  icon: React.FC<{ className?: string }>;
}

export const SwipeableWidgetRail: React.FC<{
  title?: string;
  items: WidgetLauncherItem[];
}> = ({ title = 'Accesos rápidos estilo widget', items }) => {
  const { navigateTo } = useEcosystem();

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <h2 className="font-display text-sm font-bold">{title}</h2>
        <span className="text-[11px] fabro-muted">Deslizá para ver todos los widgets</span>
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
        {items.map((w) => {
          const Icon = w.icon;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => navigateTo(w.sector, w.submenu)}
              className="fabro-widget-tile snap-start min-w-[154px] sm:min-w-[168px] rounded-2xl border fabro-surface p-3.5 text-left flex flex-col justify-between gap-3 cursor-pointer shrink-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ background: w.gradientCss }}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <span className="font-mono text-xs font-extrabold tabular-nums truncate">
                  {w.metric}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{w.title}</p>
                <p className="text-[11px] fabro-muted truncate">{w.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
