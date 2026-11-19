import React, { useEffect, useState } from 'react';
import { Droplets, Minus, Moon, Plus, Save } from 'lucide-react';
import { DEFAULT_HYDRATION_SLEEP, vaultGet, vaultSet } from '../../../services/localVault';
import type { HydrationSleepState } from '../../../types/ecosystem';

const QUALITY_OPTIONS: HydrationSleepState['sleepQuality'][] = [
  'Excelente',
  'Buena',
  'Regular',
  'Ligera',
];

export const HydrationSleepTool: React.FC = () => {
  const [state, setState] = useState<HydrationSleepState>(DEFAULT_HYDRATION_SLEEP);
  const [hydrated, setHydrated] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void vaultGet<HydrationSleepState>('hydration_sleep', DEFAULT_HYDRATION_SLEEP).then(
      (stored) => {
        if (!active) return;
        const today = new Date().toISOString().slice(0, 10);
        if (stored.date !== today) {
          setState({
            ...stored,
            date: today,
            waterMl: 0,
            history: [
              {
                date: stored.date,
                waterMl: stored.waterMl,
                sleepHours: stored.sleepHours,
                sleepQuality: stored.sleepQuality,
              },
              ...stored.history,
            ].slice(0, 7),
          });
        } else {
          setState(stored);
        }
        setHydrated(true);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void vaultSet('hydration_sleep', state);
  }, [state, hydrated]);

  const adjustWater = (delta: number) => {
    setState((prev) => ({
      ...prev,
      waterMl: Math.max(0, Math.min(5000, prev.waterMl + delta)),
    }));
  };

  const cupsGoal = Math.max(4, Math.round(state.waterGoalMl / 250));
  const cupsFilled = Math.floor(state.waterMl / 250);
  const pct = Math.min(100, Math.round((state.waterMl / state.waterGoalMl) * 100));

  const saveTodaySnapshot = () => {
    setState((prev) => {
      const rest = prev.history.filter((h) => h.date !== 'Hoy guardado');
      return {
        ...prev,
        history: [
          {
            date: 'Hoy guardado',
            waterMl: prev.waterMl,
            sleepHours: prev.sleepHours,
            sleepQuality: prev.sleepQuality,
          },
          ...rest,
        ].slice(0, 7),
      };
    });
    setSavedNotice('Registro diario de agua y sueño guardado en IndexedDB.');
    setTimeout(() => setSavedNotice(null), 2500);
  };

  return (
    <div className="rounded-2xl border-2 border-[#10B981]/35 fabro-surface p-5 space-y-5 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Droplets className="w-4 h-4 text-[#10B981]" />
            Rastreador de Hidratación y Sueño
          </h3>
          <p className="text-xs fabro-muted">
            Vasos visuales diarios y registro de descanso reparador.
          </p>
        </div>
        <span className="rounded-full border-2 border-[#10B981]/40 bg-[#10B981]/10 text-[#047857] dark:text-[#34D399] px-3 py-1 text-xs font-mono font-bold tabular-nums">
          {state.waterMl} / {state.waterGoalMl} ml ({pct}%)
        </span>
      </div>

      {/* Water cups grid */}
      <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold">Vasos de agua hoy (250 ml c/u)</span>
          <label className="inline-flex items-center gap-1.5 text-xs fabro-muted">
            Meta:
            <select
              value={state.waterGoalMl}
              onChange={(e) => setState((prev) => ({ ...prev, waterGoalMl: Number(e.target.value) }))}
              className="rounded-lg border-2 fabro-border fabro-surface px-2 py-1 text-xs font-mono"
            >
              <option value={1500}>1500 ml</option>
              <option value={2000}>2000 ml</option>
              <option value={2500}>2500 ml</option>
              <option value={3000}>3000 ml</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {Array.from({ length: Math.min(12, cupsGoal) }).map((_, idx) => {
            const filled = idx < cupsFilled;
            return (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    waterMl: filled ? idx * 250 : (idx + 1) * 250,
                  }))
                }
                aria-label={`Vaso ${idx + 1}`}
                className={`min-h-[44px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-[11px] font-mono font-bold cursor-pointer transition-all active:scale-95 ${
                  filled
                    ? 'border-[#10B981] bg-[#10B981]/15 text-[#047857] dark:text-[#34D399] shadow-[0_4px_12px_-4px_rgba(16,185,129,0.45)]'
                    : 'fabro-border fabro-surface fabro-muted hover:border-[#10B981]'
                }`}
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>250</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => adjustWater(250)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(16,185,129,0.55)] cursor-pointer transition-transform active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            +250 ml
          </button>
          <button
            type="button"
            onClick={() => adjustWater(500)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#06B6D4] bg-[#06B6D4]/15 text-[#0E7490] dark:text-[#22D3EE] px-4 py-2 text-xs font-bold cursor-pointer transition-transform active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            +500 ml botella
          </button>
          <button
            type="button"
            onClick={() => adjustWater(-250)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface px-3.5 py-2 text-xs font-semibold cursor-pointer transition-transform active:scale-95"
          >
            <Minus className="w-3.5 h-3.5" />
            -250 ml
          </button>
        </div>
      </div>

      {/* Sleep logger */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl border-2 border-[#F59E0B]/35 fabro-surface-elevated p-4 space-y-3">
          <p className="font-semibold flex items-center gap-1.5">
            <Moon className="w-4 h-4 text-[#F59E0B]" />
            Horas y calidad de sueño
          </p>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  sleepHours: Math.max(0, Number((prev.sleepHours - 0.5).toFixed(1))),
                }))
              }
              className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Restar media hora de sueño"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-mono text-lg font-bold tabular-nums text-[#B45309] dark:text-[#FBBF24]">
              {state.sleepHours} h
            </span>
            <button
              type="button"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  sleepHours: Math.min(16, Number((prev.sleepHours + 0.5).toFixed(1))),
                }))
              }
              className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Sumar media hora de sueño"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {QUALITY_OPTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setState((prev) => ({ ...prev, sleepQuality: q }))}
                className={`min-h-[44px] rounded-xl border-2 px-2.5 py-1.5 text-xs font-semibold cursor-pointer transition-all active:scale-95 ${
                  state.sleepQuality === q
                    ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#B45309] dark:text-[#FBBF24]'
                    : 'fabro-border fabro-surface fabro-muted'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">Historial reciente</span>
            <button
              type="button"
              onClick={saveTodaySnapshot}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#10B981]/50 bg-[#10B981]/10 px-3 py-1.5 text-xs font-bold text-[#047857] dark:text-[#34D399] cursor-pointer active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar hoy
            </button>
          </div>
          {savedNotice && <p className="text-[11px] text-[#047857] dark:text-[#34D399] font-semibold">{savedNotice}</p>}
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            {state.history.map((item, i) => (
              <div
                key={`${item.date}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border fabro-border fabro-surface px-3 py-2 text-[11px] font-mono tabular-nums"
              >
                <span className="font-sans font-semibold">{item.date}</span>
                <span>
                  {item.waterMl} ml · {item.sleepHours}h ({item.sleepQuality})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
