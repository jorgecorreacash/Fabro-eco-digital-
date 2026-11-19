import React, { useEffect, useState } from 'react';
import { Pause, Play, RotateCcw, Smartphone, Wind } from 'lucide-react';
import { playSoftBell } from '../../../services/webAudioPtt';

type BreathingTechnique = '4-7-8' | 'cuadrada';

interface PhaseSpec {
  label: string;
  seconds: number;
  scale: number;
  hint: string;
}

const TECHNIQUES: Record<BreathingTechnique, { name: string; phases: PhaseSpec[] }> = {
  '4-7-8': {
    name: 'Relajación 4-7-8',
    phases: [
      { label: 'Inhalá profundo', seconds: 4, scale: 1.26, hint: 'Llená el abdomen suave por la nariz' },
      { label: 'Mantené el aire', seconds: 7, scale: 1.26, hint: 'Hombros relajados, mente en calma' },
      { label: 'Exhalá lento', seconds: 8, scale: 0.78, hint: 'Soltá todo el aire sin apuro' },
    ],
  },
  cuadrada: {
    name: 'Respiración Cuadrada (4-4-4-4)',
    phases: [
      { label: 'Inhalá', seconds: 4, scale: 1.25, hint: 'Aire suave y continuo' },
      { label: 'Sostené lleno', seconds: 4, scale: 1.25, hint: 'Pausa serena' },
      { label: 'Exhalá', seconds: 4, scale: 0.78, hint: 'Soltá la tensión' },
      { label: 'Sostené vacío', seconds: 4, scale: 0.78, hint: 'Silencio antes de volver a inhalar' },
    ],
  },
};

export const BreathingTool: React.FC = () => {
  const [technique, setTechnique] = useState<BreathingTechnique>('4-7-8');
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [phaseSecLeft, setPhaseSecLeft] = useState(TECHNIQUES['4-7-8'].phases[0].seconds);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);

  const phases = TECHNIQUES[technique].phases;
  const currentPhase = phases[phaseIdx % phases.length];

  const selectTechnique = (next: BreathingTechnique) => {
    setRunning(false);
    setTechnique(next);
    setPhaseIdx(0);
    setPhaseSecLeft(TECHNIQUES[next].phases[0].seconds);
  };

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setPhaseSecLeft((prev) => {
        if (prev > 1) return prev - 1;
        const nextIdx = (phaseIdx + 1) % phases.length;
        if (nextIdx === 0) {
          setCyclesCompleted((c) => c + 1);
          playSoftBell('break-end');
        }
        if (vibrateEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([35]);
          } catch {
            // ignore unsupported devices
          }
        }
        setPhaseIdx(nextIdx);
        return phases[nextIdx].seconds;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, phaseIdx, phases, vibrateEnabled]);

  const orbScale = running ? currentPhase.scale : 0.92;

  return (
    <div className="rounded-2xl border-2 border-[#10B981]/35 fabro-surface p-5 space-y-5 shadow-[0_8px_24px_-12px_rgba(16,185,129,0.25)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold flex items-center gap-2">
            <Wind className="w-4 h-4 text-[#10B981]" />
            Respiración Guiada Interactiva
          </h3>
          <p className="text-xs fabro-muted">
            Círculo visual sincronizado para bajar el pulso y recuperar claridad.
          </p>
        </div>
        <span className="rounded-full border-2 border-[#10B981]/40 bg-[#10B981]/10 px-3 py-1 text-xs font-mono font-bold text-[#047857] dark:text-[#34D399] tabular-nums">
          Ciclos: {cyclesCompleted}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(TECHNIQUES) as BreathingTechnique[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => selectTechnique(key)}
            className={`min-h-[44px] rounded-xl border-2 px-3.5 py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 ${
              technique === key
                ? 'border-[#10B981] bg-[#10B981] text-white shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)]'
                : 'fabro-border fabro-surface-elevated hover:border-[#10B981]'
            }`}
          >
            {TECHNIQUES[key].name}
          </button>
        ))}
      </div>

      {/* Compositor-only transform orb */}
      <div className="rounded-2xl border-2 fabro-border fabro-surface-elevated py-8 px-4 flex flex-col items-center justify-center gap-5">
        <div className="relative w-44 h-44 flex items-center justify-center">
          <div
            style={{
              transform: `scale(${orbScale})`,
              transitionDuration: `${running ? Math.min(currentPhase.seconds, 4) : 0.4}s`,
              background:
                'radial-gradient(circle at 35% 35%, rgba(52, 211, 153, 0.92), rgba(16, 185, 129, 0.72), rgba(6, 182, 212, 0.55))',
              boxShadow: '0 0 36px -6px rgba(16, 185, 129, 0.55)',
            }}
            className="w-32 h-32 rounded-full border-4 border-white/60 transition-transform ease-in-out flex flex-col items-center justify-center text-white select-none"
          >
            <span className="font-mono text-2xl font-extrabold tabular-nums">
              {phaseSecLeft}s
            </span>
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="font-display text-base font-bold text-[#047857] dark:text-[#34D399]">
            {running ? currentPhase.label : 'Listo para respirar'}
          </p>
          <p className="text-xs fabro-muted">{currentPhase.hint}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (!running) {
                setPhaseSecLeft(currentPhase.seconds);
              }
              setRunning((v) => !v);
            }}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-5 py-2 text-xs font-bold shadow-[0_8px_18px_-6px_rgba(16,185,129,0.55)] cursor-pointer transition-transform active:scale-95"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? 'Pausar guía' : 'Iniciar respiración'}
          </button>

          <button
            type="button"
            onClick={() => selectTechnique(technique)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface px-4 py-2 text-xs font-semibold cursor-pointer active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reiniciar
          </button>

          <button
            type="button"
            onClick={() => setVibrateEnabled((v) => !v)}
            className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 px-3.5 py-2 text-xs font-semibold cursor-pointer active:scale-95 ${
              vibrateEnabled
                ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-[#B45309] dark:text-[#FBBF24]'
                : 'fabro-border fabro-surface fabro-muted'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Vibración móvil: {vibrateEnabled ? 'Sí' : 'No'}
          </button>
        </div>
      </div>
    </div>
  );
};
