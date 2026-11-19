import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { POMODORO_PRESETS, useEcosystem } from '../../../context/EcosystemContext';

const SUBJECT_OPTIONS = [
  'Derecho Constitucional',
  'Anatomía Funcional',
  'Arquitectura de Software',
  'Metodología Científica',
];

export const PomodoroTool: React.FC = () => {
  const {
    pomodoroLogs,
    addAgendaTask,
    pomoPresetId,
    pomoPhase,
    pomoSubject,
    pomoSecondsLeft,
    pomoRunning,
    selectPomodoroPreset,
    setPomodoroSubject,
    togglePomodoro,
    resetPomodoro,
    completePomodoroManual,
    floatingMode,
    openFloatingMiniWindow,
  } = useEcosystem();

  const [customSubject, setCustomSubject] = useState('');
  const [agendaFeedback, setAgendaFeedback] = useState<string | null>(null);

  const activePreset = POMODORO_PRESETS.find((p) => p.id === pomoPresetId) || POMODORO_PRESETS[0];
  const effectiveSubject = customSubject.trim() || pomoSubject;

  const handleManualComplete = () => {
    completePomodoroManual(effectiveSubject);
    setAgendaFeedback(`Sesión de ${activePreset.focus} min sumada a ${effectiveSubject}.`);
    window.setTimeout(() => setAgendaFeedback(null), 3000);
  };

  const handleLinkToAgenda = () => {
    addAgendaTask(
      `Bloque Pomodoro (${activePreset.label}) — ${effectiveSubject}`,
      effectiveSubject,
      'Hoy · Enfoque'
    );
    setAgendaFeedback('Bloque vinculado directamente a tu Agenda Académica.');
    window.setTimeout(() => setAgendaFeedback(null), 3000);
  };

  const sessionsBySubject = useMemo(() => {
    const map = new Map<string, number>();
    pomodoroLogs.forEach((log) => {
      map.set(log.subject, (map.get(log.subject) || 0) + 1);
    });
    return Array.from(map.entries());
  }, [pomodoroLogs]);

  const mm = String(Math.floor(pomoSecondsLeft / 60)).padStart(2, '0');
  const ss = String(pomoSecondsLeft % 60).padStart(2, '0');

  return (
    <div className="rounded-2xl border-2 border-[#2563EB]/40 fabro-surface p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <Timer className="w-5 h-5 text-[#2563EB] dark:text-[#38BDF8]" />
            Temporizador Pomodoro y Bloques de Enfoque
          </h2>
          <p className="text-xs fabro-muted mt-0.5">
            Funciona en segundo plano con controles en pantalla de bloqueo, notificación del sistema y mini-ventana flotante.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {POMODORO_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPomodoroPreset(p.id)}
              className={`min-h-[44px] px-3.5 rounded-full border-2 text-xs font-bold cursor-pointer active:scale-95 transition-all whitespace-nowrap ${
                pomoPresetId === p.id
                  ? 'border-[#2563EB] bg-[#2563EB] text-white'
                  : 'border-[#06B6D4]/40 bg-[#06B6D4]/10'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">
        <div
          className="rounded-2xl border-2 p-5 text-center space-y-4"
          style={{
            borderColor: pomoPhase === 'focus' ? '#2563EB' : '#06B6D4',
            backgroundColor:
              pomoPhase === 'focus' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(6, 182, 212, 0.10)',
          }}
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: pomoPhase === 'focus' ? '#2563EB' : '#0891B2' }}
          >
            {pomoPhase === 'focus' ? 'Modo Enfoque' : 'Descanso Activo'}
          </span>

          <p className="font-mono text-5xl font-extrabold tabular-nums tracking-tight">
            {mm}:{ss}
          </p>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={togglePomodoro}
              className="fabro-btn border-[#2563EB] bg-[#2563EB] text-white"
              style={{ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.28)' }}
            >
              {pomoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {pomoRunning ? 'Pausar' : 'Iniciar'}
            </button>

            <button
              type="button"
              onClick={resetPomodoro}
              className="fabro-btn border-[#06B6D4]/50 fabro-surface"
            >
              <RotateCcw className="w-4 h-4" />
              Reiniciar
            </button>

            <button
              type="button"
              onClick={handleManualComplete}
              className="fabro-btn border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="w-4 h-4" />
              Completar bloque
            </button>

            <button
              type="button"
              onClick={() => void openFloatingMiniWindow()}
              className={`fabro-btn border-[#7C3AED] ${
                floatingMode !== 'closed'
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C084FC]'
              }`}
            >
              <PictureInPicture2 className="w-4 h-4" />
              Modo Flotante (Mini-Ventana)
            </button>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <label className="block space-y-1">
            <span className="font-semibold fabro-muted">Materia activa</span>
            <select
              value={SUBJECT_OPTIONS.includes(pomoSubject) ? pomoSubject : SUBJECT_OPTIONS[0]}
              onChange={(e) => {
                setCustomSubject('');
                setPomodoroSubject(e.target.value);
              }}
              className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
            >
              {SUBJECT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <input
            type="text"
            value={customSubject}
            onChange={(e) => {
              setCustomSubject(e.target.value);
              if (e.target.value.trim()) setPomodoroSubject(e.target.value.trim());
            }}
            placeholder="O escribí otra materia personalizada..."
            className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
          />

          <button
            type="button"
            onClick={handleLinkToAgenda}
            className="w-full fabro-btn border-[#06B6D4] bg-[#06B6D4]/15 text-[#0E7490] dark:text-[#22D3EE]"
          >
            <CalendarPlus className="w-4 h-4" />
            Vincular bloque a Agenda Académica
          </button>

          {agendaFeedback && (
            <p className="text-emerald-700 dark:text-emerald-400 font-semibold">{agendaFeedback}</p>
          )}

          <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 space-y-1.5">
            <p className="font-bold">Sesiones completadas por materia ({pomodoroLogs.length} total)</p>
            <div className="flex flex-wrap gap-2 font-mono tabular-nums">
              {sessionsBySubject.map(([subName, count]) => (
                <span
                  key={subName}
                  className="rounded-lg border fabro-border fabro-surface px-2.5 py-1 text-[11px] font-semibold"
                >
                  {subName}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

