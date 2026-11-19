import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dumbbell, Pause, Play, Plus, RotateCcw, Timer } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { DEFAULT_WORKOUT_LOGS, vaultGet, vaultSet } from '../../../services/localVault';
import { activateMediaSession, stopMediaSession, updateMediaSessionPosition } from '../../../services/mediaSessionBridge';
import { playSoftBell } from '../../../services/webAudioPtt';
import type { WorkoutLogEntry } from '../../../types/ecosystem';

const INTERVAL_MODES = [
  { id: 'movilidad10', label: 'Movilidad 10 min', workSec: 40, restSec: 20, rounds: 10 },
  { id: 'tabata', label: 'Tabata 20/10', workSec: 20, restSec: 10, rounds: 8 },
  { id: 'hiit', label: 'HIIT 30/15', workSec: 30, restSec: 15, rounds: 6 },
  { id: 'rest60', label: 'Descanso 60s', workSec: 60, restSec: 10, rounds: 4 },
] as const;

export const CalisthenicsTimerTool: React.FC = () => {
  const { notifyRoutineCompleted } = useEcosystem();
  const [logs, setLogs] = useState<WorkoutLogEntry[]>(DEFAULT_WORKOUT_LOGS);
  const [hydrated, setHydrated] = useState(false);

  const [modeId, setModeId] = useState<(typeof INTERVAL_MODES)[number]['id']>('movilidad10');
  const [routineName, setRoutineName] = useState('Movilidad y Respiración (10 min)');
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [round, setRound] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState(40);
  const [running, setRunning] = useState(false);
  const [reps, setReps] = useState(0);

  const phaseEndMsRef = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const roundRef = useRef(round);
  roundRef.current = round;

  const activeMode = INTERVAL_MODES.find((m) => m.id === modeId) ?? INTERVAL_MODES[0];

  useEffect(() => {
    let active = true;
    void vaultGet<WorkoutLogEntry[]>('workout_logs', DEFAULT_WORKOUT_LOGS).then((stored) => {
      if (!active) return;
      setLogs(stored);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void vaultSet('workout_logs', logs);
  }, [logs, hydrated]);

  const selectMode = (id: (typeof INTERVAL_MODES)[number]['id']) => {
    const found = INTERVAL_MODES.find((m) => m.id === id) ?? INTERVAL_MODES[0];
    setRunning(false);
    phaseEndMsRef.current = null;
    stopMediaSession('timer');
    setModeId(id);
    setPhase('work');
    setRound(1);
    setSecondsLeft(found.workSec);
  };

  const advancePhase = useCallback(() => {
    playSoftBell('interval');
    if (phaseRef.current === 'work') {
      setPhase('rest');
      setSecondsLeft(activeMode.restSec);
      phaseEndMsRef.current = Date.now() + activeMode.restSec * 1000;
      return;
    }
    if (roundRef.current < activeMode.rounds) {
      setRound((r) => r + 1);
      setPhase('work');
      setSecondsLeft(activeMode.workSec);
      phaseEndMsRef.current = Date.now() + activeMode.workSec * 1000;
      return;
    }
    const label = routineName.trim() || activeMode.label;
    setRunning(false);
    phaseEndMsRef.current = null;
    stopMediaSession('timer');
    setPhase('work');
    setRound(1);
    setSecondsLeft(activeMode.workSec);
    setLogs((prevLogs) => [
      {
        id: `wk-${Date.now()}`,
        routine: label,
        rounds: activeMode.rounds,
        reps,
        durationLabel: `${Math.round(((activeMode.workSec + activeMode.restSec) * activeMode.rounds) / 60)} min`,
        dateLabel: 'Recién',
      },
      ...prevLogs,
    ]);
    notifyRoutineCompleted(label);
  }, [activeMode, notifyRoutineCompleted, reps, routineName]);

  useEffect(() => {
    if (!running) return;
    if (!phaseEndMsRef.current) {
      phaseEndMsRef.current = Date.now() + secondsLeft * 1000;
    }

    const syncTick = () => {
      if (!phaseEndMsRef.current) return;
      const remaining = Math.ceil((phaseEndMsRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        advancePhase();
      } else {
        setSecondsLeft(remaining);
      }
    };

    const timer = window.setInterval(syncTick, 1000);
    const onVisible = () => {
      if (!document.hidden) syncTick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [advancePhase, running, secondsLeft]);

  useEffect(() => {
    if (!running) return;
    const totalSec = phase === 'work' ? activeMode.workSec : activeMode.restSec;
    activateMediaSession({
      title: `${phase === 'work' ? 'Entrenando' : 'Descanso'} · Ronda ${round}/${activeMode.rounds}`,
      artist: routineName.trim() || activeMode.label,
      album: '🍀 FABRO · Bienestar Activo',
      mode: 'timer',
      playbackState: 'playing',
      handlers: {
        onPlay: () => {
          phaseEndMsRef.current = Date.now() + secondsLeft * 1000;
          setRunning(true);
        },
        onPause: () => {
          phaseEndMsRef.current = null;
          setRunning(false);
        },
        onNext: () => advancePhase(),
        onStop: () => selectMode(modeId),
      },
    });
    updateMediaSessionPosition(totalSec, Math.max(0, totalSec - secondsLeft));
  }, [activeMode, advancePhase, modeId, phase, round, routineName, running, secondsLeft]);

  useEffect(() => {
    if (!running) {
      stopMediaSession('timer');
    }
    return () => stopMediaSession('timer');
  }, [running]);

  const logManually = () => {
    const label = routineName.trim() || activeMode.label;
    setLogs((prev) => [
      {
        id: `wk-${Date.now()}`,
        routine: label,
        rounds: round,
        reps,
        durationLabel: activeMode.label,
        dateLabel: 'Hoy',
      },
      ...prev,
    ]);
    notifyRoutineCompleted(label);
  };

  return (
    <div className="rounded-2xl border-2 border-[#10B981]/35 fabro-surface p-5 space-y-5 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.28)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Timer className="w-4 h-4 text-[#10B981]" />
            Cronómetro de Rutinas y Calistenia (HIIT / Tabata)
          </h3>
          <p className="text-xs fabro-muted">
            Intervalos de trabajo/descanso con aviso sonoro suave y contador de repeticiones.
          </p>
        </div>
        <span className="rounded-full border-2 border-[#10B981]/40 bg-[#10B981]/10 px-3 py-1 text-xs font-mono font-bold text-[#047857] dark:text-[#34D399]">
          Ronda {round}/{activeMode.rounds}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border-2 fabro-border fabro-surface-elevated p-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {INTERVAL_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m.id)}
                className={`min-h-[44px] rounded-xl border-2 px-3 py-2 text-xs font-bold cursor-pointer active:scale-95 ${
                  modeId === m.id
                    ? 'border-[#10B981] bg-[#10B981] text-white'
                    : 'fabro-border fabro-surface'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
            aria-label="Nombre de la rutina"
            className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 text-xs font-semibold fabro-input"
          />

          <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#10B981]/30 fabro-surface p-4">
            <div>
              <span
                className={`text-xs font-bold uppercase ${
                  phase === 'work' ? 'text-[#10B981]' : 'text-[#F59E0B]'
                }`}
              >
                {phase === 'work' ? 'Entrenando' : 'Descanso'}
              </span>
              <p className="font-mono text-3xl font-extrabold tabular-nums">
                {String(secondsLeft).padStart(2, '0')}s
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRunning((v) => !v)}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {running ? 'Pausar' : 'Iniciar'}
              </button>
              <button
                type="button"
                onClick={() => selectMode(modeId)}
                aria-label="Reiniciar cronómetro"
                className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border flex items-center justify-center cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Repeticiones: {reps}</span>
              <button
                type="button"
                onClick={() => setReps((r) => r + 1)}
                className="min-h-[44px] rounded-xl border-2 border-[#F59E0B] bg-[#F59E0B]/15 text-[#B45309] dark:text-[#FBBF24] px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95"
              >
                +1 rep
              </button>
              <button
                type="button"
                onClick={() => setReps((r) => r + 5)}
                className="min-h-[44px] rounded-xl border-2 border-[#10B981]/50 bg-[#10B981]/10 px-3 py-1.5 text-xs font-bold text-[#047857] dark:text-[#34D399] cursor-pointer active:scale-95"
              >
                +5 reps
              </button>
            </div>
            <button
              type="button"
              onClick={logManually}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Guardar sesión
            </button>
          </div>
        </div>

        <div className="rounded-2xl border-2 fabro-border fabro-surface-elevated p-4 space-y-2.5">
          <h4 className="text-xs font-bold flex items-center gap-1.5">
            <Dumbbell className="w-4 h-4 text-[#10B981]" />
            Registro físico semanal
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {logs.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border fabro-border fabro-surface p-3 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{item.routine}</p>
                  <p className="text-[11px] fabro-muted font-mono">
                    {item.dateLabel} · {item.rounds} rondas · {item.durationLabel}
                  </p>
                </div>
                <span className="rounded-lg bg-[#10B981]/15 text-[#047857] dark:text-[#34D399] px-2.5 py-1 text-xs font-mono font-bold shrink-0">
                  {item.reps} reps
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
