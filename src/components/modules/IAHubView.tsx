import React, { useEffect, useState } from 'react';
import {
  Compass,
  Cpu,
  Globe,
  KeyRound,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { getSectorAiPreferences, updateSectorAiPreference } from '../../lib/fabroId';
import type { FabroSectorId, SectorAiPreferencesMap } from '../../types/fabro';
import { FabroAIBrowserView } from './FabroAIBrowserView';
import { FabroAIView } from './FabroAIView';
import { FabroConnectView } from './FabroConnectView';
import { FabroHubView } from './FabroHubView';

type IaTabId = 'tutor' | 'hub' | 'browser' | 'connect';

const SECTOR_ROWS: Array<{ id: FabroSectorId; label: string }> = [
  { id: 'estudio', label: '1. Estudio' },
  { id: 'bienestar', label: '2. Bienestar y Salud' },
  { id: 'social', label: '3. Red Social FABRO' },
  { id: 'configuracion', label: '5. Configuración' },
];

export const IAHubView: React.FC = () => {
  const { user, setActiveSection } = useFabro();
  const { personalConnections, freemiumStatus } = useAIGateway();

  const [tab, setTab] = useState<IaTabId>('tutor');
  const [prefs, setPrefs] = useState<SectorAiPreferencesMap>(() => getSectorAiPreferences(user?.uid));

  useEffect(() => {
    setPrefs(getSectorAiPreferences(user?.uid));
  }, [user?.uid]);

  const connectedPersonal = personalConnections.filter((c) => c.status === 'connected');

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-violet-500/30 fabro-shell-surface p-5 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-[#E5B842]">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Sector 04 · Inteligencia Artificial Multimodelo
              </span>
              <button
                type="button"
                onClick={() => setActiveSection('inicio')}
                className="text-[11px] font-semibold normal-case tracking-normal text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-[#E5B842] cursor-pointer whitespace-nowrap"
              >
                ← Volver a Inicio
              </button>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-[#FAF6EE]">
              Centro Multi-IA: OpenAI, Gemini, Claude, DeepSeek y Qwen
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
              Asigná qué modelo trabaja en cada sector de FABRO, compará respuestas en paralelo o vinculá tus propias API Keys cifradas desde FABRO Connect.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 shrink-0 text-center">
            <div className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Cuentas personales</p>
              <p className="font-display text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {connectedPersonal.length} activas
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-white/10 px-3 py-2">
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Cuota FABRO hoy</p>
              <p className="font-display text-base font-bold text-slate-900 dark:text-[#FAF6EE] tabular-nums">
                {freemiumStatus ? `${freemiumStatus.usedToday}/${freemiumStatus.dailyLimit}` : '0/5'}
              </p>
            </div>
          </div>
        </div>

        {/* Transversal per-sector AI defaults bar */}
        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-[#070B17]/80 p-3.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
            <Cpu className="w-3.5 h-3.5 text-violet-500" />
            <span>Motor predeterminado por sector:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
            {SECTOR_ROWS.map((s) => {
              const pref = prefs[s.id];
              const val =
                pref.providerMode === 'personal' && pref.personalConnectionId
                  ? `personal:${pref.personalConnectionId}`
                  : pref.providerMode;
              return (
                <label key={s.id} className="block space-y-1 text-[11px]">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{s.label}</span>
                  <select
                    value={val}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.startsWith('personal:')) {
                        setPrefs(
                          updateSectorAiPreference(user?.uid, s.id, {
                            providerMode: 'personal',
                            personalConnectionId: v.slice('personal:'.length),
                          })
                        );
                      } else {
                        setPrefs(
                          updateSectorAiPreference(user?.uid, s.id, {
                            providerMode: v as 'auto' | 'fabro_gemini' | 'fabro_openai',
                            personalConnectionId: undefined,
                          })
                        );
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="auto">Auto FABRO</option>
                    <option value="fabro_gemini">Gemini (FABRO)</option>
                    <option value="fabro_openai">ChatGPT (FABRO)</option>
                    {connectedPersonal.map((c) => (
                      <option key={c.id} value={`personal:${c.id}`}>
                        {c.label} ({c.selectedModel})
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-800/80">
          {[
            { id: 'tutor', label: 'FABRO IA Chat', icon: Sparkles },
            { id: 'hub', label: 'Comparador y Directorio (HUB)', icon: Compass },
            { id: 'browser', label: 'AI Browser Paralelo', icon: Globe },
            { id: 'connect', label: 'FABRO CONNECT (API Keys y Nube)', icon: KeyRound },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as IaTabId)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
          {tab !== 'tutor' && (
            <button
              type="button"
              onClick={() => setTab('tutor')}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 px-3 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Ir a FABRO IA
            </button>
          )}
        </div>
      </section>

      {tab === 'tutor' && <FabroAIView />}
      {tab === 'hub' && <FabroHubView />}
      {tab === 'browser' && <FabroAIBrowserView />}
      {tab === 'connect' && <FabroConnectView />}
    </div>
  );
};
