import React, { useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Timer,
  Volume2,
  X,
} from 'lucide-react';
import { useHabitTimer } from '../../context/HabitTimerContext';

function formatCountdown(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const HabitTimerHeaderWidget: React.FC = () => {
  const {
    habits,
    activeHabit,
    remainingSeconds,
    isRunning,
    isPaused,
    selectHabit,
    startHabit,
    pauseTimer,
    resumeTimer,
    resetTimer,
    addMinutes,
    testSound,
    requestOpenHabitStudio,
  } = useHabitTimer();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const activeCountdown = isRunning || isPaused;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir temporizador de hábitos"
        title="Temporizador configurable de hábitos con alertas sonoras"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          isRunning
            ? 'border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300'
            : isPaused
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
      >
        <Timer className="w-3.5 h-3.5 shrink-0" />
        {activeCountdown ? (
          <span className="font-mono tabular-nums">
            {formatCountdown(remainingSeconds)} · <span className="hidden sm:inline">{activeHabit.name}</span>
          </span>
        ) : (
          <span className="hidden sm:inline">Hábitos</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Temporizador rápido de hábitos"
          className="absolute right-0 mt-2 w-80 max-w-[92vw] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 shadow-xl z-50 space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Temporizador de Hábitos
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {activeHabit.name} · {activeHabit.durationMinutes} min
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3 text-center space-y-2.5">
            <p className="font-mono text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              {formatCountdown(remainingSeconds)}
            </p>

            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {isRunning ? (
                <button
                  type="button"
                  onClick={pauseTimer}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </button>
              ) : isPaused ? (
                <button
                  type="button"
                  onClick={resumeTimer}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Reanudar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startHabit()}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar</span>
                </button>
              )}

              <button
                type="button"
                onClick={resetTimer}
                title="Reiniciar"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => addMinutes(5)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                +5m
              </button>

              <button
                type="button"
                onClick={() =>
                  testSound({
                    tone: activeHabit.tone,
                    volume: activeHabit.volume,
                    repeats: 1,
                    habitName: activeHabit.name,
                    voiceAlert: activeHabit.voiceAlert,
                  })
                }
                title="Probar alerta sonora"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-sky-600 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Cambiar hábito rápido:
            </p>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
              {habits.map((h) => {
                const selected = h.id === activeHabit.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => selectHabit(h.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'
                    }`}
                  >
                    <p className="truncate">{h.name}</p>
                    <p className="text-[10px] font-mono tabular-nums opacity-75">
                      {h.durationMinutes} min
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              requestOpenHabitStudio();
            }}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-sky-500/50 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Abrir rutinas, dieta y salud IA</span>
          </button>
        </div>
      )}
    </div>
  );
};
