import React from 'react';
import {
  BookOpen,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Cpu,
  HeartPulse,
  LayoutGrid,
  MessageSquare,
  Settings,
  SunMoon,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { PRIMARY_SCREENS_ORDER } from '../../data/ecosystemCatalog';
import type { SectorId, SubmenuId } from '../../types/ecosystem';

const SCREEN_ICONS: Record<SectorId, React.FC<{ className?: string }>> = {
  social: MessageSquare,
  inicio: LayoutGrid,
  hoy: SunMoon,
  herramientas: Calculator,
  estudio: BookOpen,
  bienestar: HeartPulse,
  ia: Cpu,
  configuracion: Settings,
};

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

  const currentIdx = Math.max(
    0,
    PRIMARY_SCREENS_ORDER.findIndex((s) => s.sector === sector)
  );
  const current = PRIMARY_SCREENS_ORDER[currentIdx];

  return (
    <section
      aria-label="Indicaciones y navegación deslizable entre pantallas"
      className="rounded-2xl border fabro-surface px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
    >
      <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={swipePrevScreen}
            aria-label="Pantalla anterior"
            title="Deslizar a la pantalla anterior"
            className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={swipeNextScreen}
            aria-label="Siguiente pantalla"
            title="Deslizar a la siguiente pantalla"
            className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center cursor-pointer active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold flex items-center gap-2 truncate">
            <span className="font-mono tabular-nums fabro-accent-text shrink-0">
              Pantalla {currentIdx + 1}/{PRIMARY_SCREENS_ORDER.length}
            </span>
            <span aria-hidden="true" className="fabro-muted">
              ·
            </span>
            <span className="truncate">{current.title}</span>
          </p>
          <p className="text-[11px] fabro-muted truncate">
            {current.hint} · Deslizá horizontalmente en móvil o usá los indicadores
          </p>
        </div>
      </div>

      {/* Interactive Screen Stepper / Swipeable Pills */}
      <div
        role="navigation"
        aria-label="Pantallas principales deslizables"
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0 shrink-0"
      >
        {PRIMARY_SCREENS_ORDER.map((item, idx) => {
          const active = item.sector === sector;
          const Icon = SCREEN_ICONS[item.sector];
          return (
            <button
              key={item.sector}
              type="button"
              onClick={() => navigateTo(item.sector, item.submenu)}
              aria-current={active ? 'page' : undefined}
              title={`Pantalla ${idx + 1}: ${item.title}`}
              className={`min-h-[36px] rounded-xl border px-2.5 py-1 inline-flex items-center gap-1.5 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 active:scale-95 ${
                active
                  ? 'text-white border-transparent'
                  : 'fabro-border fabro-surface-elevated fabro-muted hover:opacity-100'
              }`}
              style={active ? { background: item.gradientCss } : undefined}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className={active ? 'inline' : 'hidden xl:inline'}>{item.shortLabel}</span>
            </button>
          );
        })}
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
