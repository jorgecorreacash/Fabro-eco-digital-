import React, { useEffect, useMemo, useState } from 'react';
import { HeartPulse, Menu, Radio, Trophy, X } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useRadio } from '../../context/RadioContext';
import {
  DEFAULT_WELLNESS_STATE,
  WELLNESS_SIDEBAR_ORDER,
} from '../../data/wellnessCatalog';
import { loadWellnessState, saveWellnessState } from '../../services/wellnessVault';
import type { WellnessSubmenuId } from '../../types/ecosystem';
import type { WellnessNavId, WellnessStateSnapshot } from '../../types/wellness';
import { SectorSports } from './wellness/sports/SectorSports';
import { WellnessCoachHistoryChallengesPanel } from './wellness/v2/WellnessCoachHistoryChallengesPanel';
import { WellnessFitnessPanel } from './wellness/v2/WellnessFitnessPanel';
import { WellnessHealthGrowthPanel } from './wellness/v2/WellnessHealthGrowthPanel';
import { WellnessMindSleepPanel } from './wellness/v2/WellnessMindSleepPanel';
import { WellnessMyDayPanel } from './wellness/v2/WellnessMyDayPanel';
import { WellnessNutritionPanel } from './wellness/v2/WellnessNutritionPanel';
import { WellnessSafetyCommunityConfigPanel } from './wellness/v2/WellnessSafetyCommunityConfigPanel';

const LEGACY_SUBMENU_MAP: Record<WellnessSubmenuId, WellnessNavId> = {
  'mi-vida': 'mi-dia',
  'fabro-deportes': 'fabro-deportes',
  'organizacion-calorias': 'nutricion',
  'salud-ejercicios': 'actividad-fisica',
  'bienestar-emocional': 'mente-emociones',
  'escritura-recuerdos': 'mente-emociones',
  'videoteca-bienestar': 'educacion-conocimiento',
  'muro-bienestar': 'comunidad-bienestar',
  'organizador-integral': 'agenda-objetivos',
};

export const Sector2Wellness: React.FC = () => {
  const { submenu } = useEcosystem();
  const { openRadioModal } = useRadio();

  const initialNav = useMemo<WellnessNavId>(() => {
    const mapped = LEGACY_SUBMENU_MAP[submenu as WellnessSubmenuId];
    return mapped || 'mi-dia';
  }, [submenu]);

  const [activeNav, setActiveNav] = useState<WellnessNavId>(initialNav);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarFilter, setSidebarFilter] = useState('');
  const [state, setState] = useState<WellnessStateSnapshot>(DEFAULT_WELLNESS_STATE);

  // Sync deep links from other FABRO sectors (e.g. HybridShell / Reminders / Organizer)
  useEffect(() => {
    const mapped = LEGACY_SUBMENU_MAP[submenu as WellnessSubmenuId];
    if (mapped) {
      setActiveNav(mapped);
    }
  }, [submenu]);

  useEffect(() => {
    let mounted = true;
    void loadWellnessState().then((loaded) => {
      if (mounted) setState(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const updateWellnessState = (
    updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot
  ) => {
    setState((prev) => {
      const next = updater(prev);
      void saveWellnessState(next);
      return next;
    });
  };

  const filteredSidebarItems = useMemo(() => {
    const q = sidebarFilter.trim().toLowerCase();
    if (!q) return WELLNESS_SIDEBAR_ORDER;
    return WELLNESS_SIDEBAR_ORDER.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.shortDesc.toLowerCase().includes(q) ||
        String(item.number).includes(q)
    );
  }, [sidebarFilter]);

  const activeEntry = useMemo(
    () => WELLNESS_SIDEBAR_ORDER.find((i) => i.id === activeNav) || WELLNESS_SIDEBAR_ORDER[0],
    [activeNav]
  );

  const selectNav = (id: WellnessNavId) => {
    setActiveNav(id);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b fabro-border space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wide uppercase text-[#059669] dark:text-[#34D399]">
            <HeartPulse className="w-4 h-4 shrink-0" />
            FABRO Bienestar
          </span>
          <span className="text-[11px] font-mono tabular-nums fabro-muted">18 + Deportes</span>
        </div>
        <p className="text-[11px] fabro-muted leading-snug">
          Ecosistema integral · El Último Día de Tu Vida
        </p>

        {/* Dedicated FABRO DEPORTES Space Entry */}
        <button
          type="button"
          onClick={() => selectNav('fabro-deportes')}
          className="w-full min-h-[40px] rounded-xl border border-[#0284C7]/45 bg-[#0284C7]/10 hover:bg-[#0284C7] hover:text-white text-[#0284C7] dark:text-[#38BDF8] px-3 py-2 text-left text-xs font-bold flex items-center justify-between gap-2 transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Trophy className="w-4 h-4 shrink-0" />
            <span className="truncate">FABRO DEPORTES</span>
          </span>
          <span className="text-[10px] font-mono opacity-80 shrink-0">18 áreas →</span>
        </button>

        {/* Compact Radio Digital AM/FM Launcher */}
        <button
          type="button"
          onClick={() => {
            setMobileSidebarOpen(false);
            openRadioModal();
          }}
          className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated hover:border-[#0284C7] px-3 py-1.5 text-left text-xs font-semibold flex items-center justify-between gap-2 transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Radio className="w-3.5 h-3.5 text-[#0284C7] shrink-0" />
            <span className="truncate">Radio Digital AM / FM</span>
          </span>
          <span className="text-[10px] font-mono fabro-muted shrink-0">En vivo</span>
        </button>

        <input
          type="search"
          value={sidebarFilter}
          onChange={(e) => setSidebarFilter(e.target.value)}
          placeholder="Filtrar espacios..."
          className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs fabro-input"
        />
      </div>

      <nav
        aria-label="Menú lateral de FABRO Bienestar"
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
      >
        {filteredSidebarItems.map((item) => {
          const active = activeNav === item.id;
          const isSports = item.id === 'fabro-deportes';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectNav(item.id)}
              className={`w-full min-h-[38px] rounded-xl px-2.5 py-1.5 text-left text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                active
                  ? isSports
                    ? 'bg-[#0284C7] text-white font-semibold'
                    : 'bg-[#059669] text-white font-semibold'
                  : isSports
                  ? 'text-[#0284C7] dark:text-[#38BDF8] font-semibold hover:bg-[#0284C7]/10'
                  : 'fabro-muted hover:text-[var(--fabro-text)] hover:bg-[var(--fabro-surface-2)]'
              }`}
            >
              <span
                className={`font-mono text-[10px] w-5 text-right shrink-0 tabular-nums ${
                  active ? 'text-white/85' : 'opacity-65'
                }`}
              >
                {String(item.number).padStart(2, '0')}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );

  const renderActiveSpace = () => {
    switch (activeNav) {
      case 'mi-dia':
        return (
          <WellnessMyDayPanel
            state={state}
            onNavigate={selectNav}
            onUpdateState={updateWellnessState}
          />
        );
      case 'nutricion':
        return <WellnessNutritionPanel state={state} onUpdateState={updateWellnessState} />;
      case 'actividad-fisica':
        return <WellnessFitnessPanel state={state} onUpdateState={updateWellnessState} />;
      case 'mente-emociones':
      case 'sueno-descanso':
      case 'fabro-respira':
        return (
          <WellnessMindSleepPanel
            section={activeNav}
            state={state}
            onUpdateState={updateWellnessState}
          />
        );
      case 'salud-prevencion':
      case 'desarrollo-personal':
      case 'relaciones-social':
      case 'naturaleza-ambiente':
        return (
          <WellnessHealthGrowthPanel
            section={activeNav}
            state={state}
            onUpdateState={updateWellnessState}
          />
        );
      case 'educacion-conocimiento':
      case 'agenda-objetivos':
      case 'fabro-coach':
      case 'mi-historial':
      case 'fabro-desafios':
        return (
          <WellnessCoachHistoryChallengesPanel
            section={activeNav}
            state={state}
            onUpdateState={updateWellnessState}
          />
        );
      case 'primeros-auxilios':
      case 'comunidad-bienestar':
      case 'configuracion-privacidad':
        return (
          <WellnessSafetyCommunityConfigPanel
            section={activeNav}
            state={state}
            onUpdateState={updateWellnessState}
          />
        );
      default:
        return null;
    }
  };

  if (activeNav === 'fabro-deportes') {
    return (
      <SectorSports
        wellnessState={state}
        onUpdateWellnessState={updateWellnessState}
        onBackToWellness={() => selectNav('mi-dia')}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Header Bar */}
      <div className="lg:hidden flex items-center justify-between gap-2 rounded-2xl border fabro-border fabro-surface px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-semibold cursor-pointer"
          >
            <Menu className="w-4 h-4 text-[#059669]" />
            Bienestar
          </button>
          <button
            type="button"
            onClick={() => selectNav('fabro-deportes')}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#0284C7]/45 bg-[#0284C7]/10 text-[#0284C7] dark:text-[#38BDF8] px-2.5 text-xs font-bold cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            Deportes
          </button>
        </div>
        <div className="text-right min-w-0">
          <p className="text-[10px] font-mono fabro-muted">
            {String(activeEntry.number).padStart(2, '0')} / 18
          </p>
          <p className="text-xs font-bold truncate">{activeEntry.label}</p>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Cerrar menú de FABRO Bienestar"
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/45"
          />
          <aside className="relative z-10 w-72 max-w-[84vw] h-full fabro-surface border-r fabro-border flex flex-col">
            <div className="flex items-center justify-end p-2 border-b fabro-border">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="min-h-[36px] min-w-[36px] rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{renderSidebarContent()}</div>
          </aside>
        </div>
      )}

      {/* Desktop Split Workspace modeled on FABRO Cultura */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <aside className="hidden lg:block w-64 shrink-0 sticky top-20 rounded-2xl border fabro-border fabro-surface overflow-hidden max-h-[calc(100vh-6.5rem)]">
          {renderSidebarContent()}
        </aside>

        <section className="flex-1 min-w-0 w-full space-y-5">
          {renderActiveSpace()}
        </section>
      </div>
    </div>
  );
};
