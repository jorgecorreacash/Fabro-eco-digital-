import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Dumbbell,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { playPttTone, playSoftBell } from '../../../services/webAudioPtt';
import type { WellnessWorkoutPlanItem } from '../../../types/ecosystem';

interface WellnessWorkoutTimerModalProps {
  plan: WellnessWorkoutPlanItem | null;
  onClose: () => void;
}

export const WellnessWorkoutTimerModal: React.FC<WellnessWorkoutTimerModalProps> = ({
  plan,
  onClose,
}) => {
  const [exIdx, setExIdx] = useState(0);
  const [setNum, setSetNum] = useState(1);
  const [phase, setPhase] = useState<'work' | 'rest' | 'done'>('work');
  const [secondsLeft, setSecondsLeft] = useState(40);
  const [running, setRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    if (!plan || plan.exercises.length === 0) return;
    setExIdx(0);
    setSetNum(1);
    setPhase('work');
    setSecondsLeft(plan.exercises[0].workSec || 40);
    setRunning(false);
  }, [plan]);

  const currentEx = plan?.exercises[exIdx];

  const notifyBeep = (kind: 'phase' | 'done') => {
    if (soundOn) {
      if (kind === 'done') playSoftBell('focus-end');
      else playPttTone('receive');
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(kind === 'done' ? [180, 90, 180] : [120]);
      } catch {
        // Ignore unsupported vibration
      }
    }
  };

  const advancePhase = () => {
    if (!plan || !currentEx) return;
    if (phase === 'work') {
      const isLastSetOfLastEx =
        exIdx === plan.exercises.length - 1 && setNum >= currentEx.sets;
      if (isLastSetOfLastEx) {
        setPhase('done');
        setRunning(false);
        notifyBeep('done');
        return;
      }
      setPhase('rest');
      setSecondsLeft(currentEx.restSec || 45);
      notifyBeep('phase');
      return;
    }

    if (phase === 'rest') {
      if (setNum < currentEx.sets) {
        setSetNum((s) => s + 1);
        setPhase('work');
        setSecondsLeft(currentEx.workSec || 40);
        notifyBeep('phase');
      } else if (exIdx + 1 < plan.exercises.length) {
        const nextEx = plan.exercises[exIdx + 1];
        setExIdx((i) => i + 1);
        setSetNum(1);
        setPhase('work');
        setSecondsLeft(nextEx.workSec || 40);
        notifyBeep('phase');
      } else {
        setPhase('done');
        setRunning(false);
        notifyBeep('done');
      }
    }
  };

  useEffect(() => {
    if (!running || !plan || phase === 'done') return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          advancePhase();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  });

  if (!plan || !currentEx) return null;

  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Temporizador de Entrenamiento FABRO"
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border fabro-surface p-5 sm:p-6 space-y-5 shadow-2xl max-h-[90dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase text-[#10B981]">
              Temporizador de Entrenamiento
            </p>
            <h3 className="font-display text-base sm:text-lg font-extrabold truncate">
              {plan.title}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSoundOn((v) => !v)}
              aria-label={soundOn ? 'Silenciar alertas' : 'Activar alertas sonoras'}
              className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
            >
              {soundOn ? <Volume2 className="w-4 h-4 text-[#10B981]" /> : <VolumeX className="w-4 h-4 fabro-muted" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar temporizador"
              className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {phase === 'done' ? (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h4 className="font-display text-xl font-extrabold">¡Rutina completada!</h4>
            <p className="text-xs fabro-muted leading-relaxed">
              Terminaste los {plan.exercises.length} ejercicios de "{plan.title}". Hidratate y
              estirá suavemente 2 minutos.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setExIdx(0);
                  setSetNum(1);
                  setPhase('work');
                  setSecondsLeft(plan.exercises[0].workSec || 40);
                  setRunning(false);
                }}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface px-4 py-2 text-xs font-bold cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Repetir
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-[42px] rounded-xl border border-[#10B981] bg-[#10B981] text-white px-5 py-2 text-xs font-bold cursor-pointer"
              >
                Finalizar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Active Exercise Card */}
            <div
              className={`rounded-2xl border-2 p-5 text-center space-y-3 transition-colors ${
                phase === 'work'
                  ? 'border-[#10B981] bg-[#10B981]/10'
                  : 'border-[#F59E0B] bg-[#F59E0B]/10'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4" />
                  Ejercicio {exIdx + 1} / {plan.exercises.length}
                </span>
                <span>
                  Serie {setNum} / {currentEx.sets}
                </span>
              </div>

              <div>
                <p
                  className={`text-xs font-extrabold uppercase tracking-wider ${
                    phase === 'work'
                      ? 'text-[#047857] dark:text-[#34D399]'
                      : 'text-[#B45309] dark:text-[#FBBF24]'
                  }`}
                >
                  {phase === 'work' ? 'En ejecución · Serie activa' : 'Descanso y respiración'}
                </p>
                <h4 className="font-display text-xl font-extrabold mt-1">{currentEx.name}</h4>
                <p className="text-xs font-semibold fabro-muted mt-0.5">
                  Meta: {currentEx.reps} · Descanso: {currentEx.restSec}s
                </p>
              </div>

              <p className="font-mono text-5xl sm:text-6xl font-extrabold tabular-nums tracking-tight py-1">
                {formatSec(secondsLeft)}
              </p>

              <p className="text-xs fabro-muted leading-relaxed rounded-xl border fabro-border fabro-surface p-2.5 text-left">
                <strong className="font-semibold">Técnica clave:</strong> {currentEx.technique}
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#10B981] bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 text-sm font-bold cursor-pointer active:scale-95"
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {running ? 'Pausar' : 'Iniciar cuenta regresiva'}
              </button>

              <button
                type="button"
                onClick={advancePhase}
                className="min-h-[46px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <SkipForward className="w-4 h-4" />
                {phase === 'work' ? 'Pasar a descanso' : 'Siguiente serie'}
              </button>
            </div>

            {/* Exercise Step Queue */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase fabro-muted">Ejercicios de esta rutina</p>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {plan.exercises.map((ex, idx) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      setExIdx(idx);
                      setSetNum(1);
                      setPhase('work');
                      setSecondsLeft(ex.workSec || 40);
                      setRunning(false);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer ${
                      idx === exIdx
                        ? 'border-[#10B981] bg-[#10B981]/10 font-bold'
                        : 'fabro-border fabro-surface-elevated fabro-muted'
                    }`}
                  >
                    <span className="truncate">
                      {idx + 1}. {ex.name}
                    </span>
                    <span className="font-mono text-[11px] shrink-0 tabular-nums">
                      {ex.sets}×{ex.reps}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
