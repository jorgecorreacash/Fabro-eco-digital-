import React, { useState } from 'react';
import {
  FileText,
  Heart,
  Mic,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RotateCcw,
  Send,
  Timer,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { playPttTone } from '../../services/webAudioPtt';

const QUICK_EMOTIONS = ['Serenidad', 'Gratitud', 'Enfoque', 'Energía', 'Calma', 'Esperanza'];

export const QuickActionsBar: React.FC = () => {
  const {
    activeQuickAction,
    setActiveQuickAction,
    addQuickNote,
    addMoodLog,
    sendQuickChatMessage,
    navigateTo,
    pomoPresetId,
    pomoSecondsLeft,
    pomoRunning,
    selectPomodoroPreset,
    togglePomodoro,
    resetPomodoro,
    openFloatingMiniWindow,
  } = useEcosystem();

  // Quick Note state
  const [noteSubject, setNoteSubject] = useState('Estudio General');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteSavedMsg, setNoteSavedMsg] = useState<string | null>(null);

  // Quick Mood state
  const [moodScore, setMoodScore] = useState(8);
  const [moodEmotion, setMoodEmotion] = useState('Serenidad');
  const [moodHabit, setMoodHabit] = useState('Bloque de lectura o agua');
  const [moodSavedMsg, setMoodSavedMsg] = useState<string | null>(null);

  // Quick PTT state
  const [pttHolding, setPttHolding] = useState(false);
  const [pttQuickText, setPttQuickText] = useState('');
  const [pttFeedback, setPttFeedback] = useState<string | null>(null);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSaveQuickNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    addQuickNote(noteTitle || 'Nota rápida', noteBody, noteSubject);
    setNoteTitle('');
    setNoteBody('');
    setNoteSavedMsg('Guardado en tu bóveda local.');
    window.setTimeout(() => setNoteSavedMsg(null), 2500);
  };

  const handleSaveQuickMood = (e: React.FormEvent) => {
    e.preventDefault();
    addMoodLog(moodScore, moodEmotion, moodHabit);
    setMoodSavedMsg('Emoción y hábito guardados localmente.');
    window.setTimeout(() => setMoodSavedMsg(null), 2500);
  };

  const startQuickPtt = () => {
    if (pttHolding) return;
    setPttHolding(true);
    playPttTone('start');
  };

  const releaseQuickPtt = () => {
    if (!pttHolding) return;
    setPttHolding(false);
    playPttTone('end');
    sendQuickChatMessage('Nota de voz Push-to-Talk rápida enviada desde barra móvil.');
    setPttFeedback('Audio PTT enviado al canal de FABRO.');
    window.setTimeout(() => setPttFeedback(null), 2500);
  };

  return (
    <>
      {/* Floating Mobile-First Quick Actions Bar */}
      <div
        role="toolbar"
        aria-label="Barra de acciones rápidas"
        className="no-print fixed bottom-[64px] right-2.5 lg:bottom-4 lg:right-5 z-40 flex items-center gap-1.5 rounded-2xl border fabro-surface p-1.5"
        style={{ boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)' }}
      >
        <button
          type="button"
          onClick={() => setActiveQuickAction('note')}
          title="Nueva nota rápida"
          aria-label="Nueva nota rápida"
          className="min-h-[42px] min-w-[42px] md:min-h-[38px] px-3 py-1.5 rounded-xl border border-[#2563EB]/60 bg-[#2563EB]/10 text-[#1D4ED8] dark:text-[#60A5FA] inline-flex items-center justify-center gap-1.5 text-sm font-medium cursor-pointer active:scale-95 transition-all whitespace-nowrap"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">Nota rápida</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickAction('mood')}
          title="Registrar emoción o hábito"
          aria-label="Registrar emoción o hábito"
          className="min-h-[42px] min-w-[42px] md:min-h-[38px] px-3 py-1.5 rounded-xl border border-[#10B981]/60 bg-[#10B981]/10 text-[#047857] dark:text-[#34D399] inline-flex items-center justify-center gap-1.5 text-sm font-medium cursor-pointer active:scale-95 transition-all whitespace-nowrap"
        >
          <Heart className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">Emoción</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickAction('ptt')}
          title="Mensaje Push-to-Talk"
          aria-label="Mensaje Push-to-Talk"
          className="min-h-[42px] min-w-[42px] md:min-h-[38px] px-3 py-1.5 rounded-xl border border-[#7C3AED]/60 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#A78BFA] inline-flex items-center justify-center gap-1.5 text-sm font-medium cursor-pointer active:scale-95 transition-all whitespace-nowrap"
        >
          <Mic className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">PTT</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveQuickAction('pomodoro')}
          title="Temporizador Pomodoro"
          aria-label="Temporizador Pomodoro"
          className="min-h-[42px] min-w-[42px] md:min-h-[38px] px-3 py-1.5 rounded-xl border border-[#06B6D4]/60 bg-[#06B6D4]/10 text-[#0E7490] dark:text-[#22D3EE] inline-flex items-center justify-center gap-1.5 text-sm font-medium cursor-pointer active:scale-95 transition-all whitespace-nowrap"
        >
          <Timer className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline font-mono tabular-nums">
            {pomoRunning ? formatTimer(pomoSecondsLeft) : 'Pomodoro'}
          </span>
        </button>
      </div>

      {/* Bottom Sheet / Quick Action Modal */}
      {activeQuickAction && (
        <div
          className="no-print fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveQuickAction(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Acción rápida FABRO"
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border-2 fabro-surface p-5 sm:p-6 space-y-4 shadow-2xl max-h-[85dvh] overflow-y-auto"
          >
            <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto sm:hidden" />

            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold">
                {activeQuickAction === 'note' && 'Nueva nota rápida'}
                {activeQuickAction === 'mood' && 'Registrar emoción y hábito'}
                {activeQuickAction === 'ptt' && 'Push-to-Talk rápido'}
                {activeQuickAction === 'pomodoro' && 'Temporizador Pomodoro rápido'}
              </h2>
              <button
                type="button"
                onClick={() => setActiveQuickAction(null)}
                aria-label="Cerrar acción rápida"
                className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border flex items-center justify-center cursor-pointer active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeQuickAction === 'note' && (
              <form onSubmit={handleSaveQuickNote} className="space-y-3 text-xs">
                <input
                  type="text"
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  placeholder="Materia o categoría"
                  className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                />
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Título corto de la nota"
                  className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 font-semibold fabro-input"
                />
                <textarea
                  rows={4}
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Escribí una idea, concepto clave o recordatorio de clase..."
                  className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 fabro-input"
                />
                {noteSavedMsg && (
                  <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {noteSavedMsg}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="flex-1 fabro-btn border-[#2563EB] bg-[#2563EB] text-white"
                    style={{ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.25)' }}
                  >
                    Guardar nota local
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuickAction(null);
                      navigateTo('estudio', 'materias-apuntes');
                    }}
                    className="fabro-btn fabro-border fabro-surface-elevated"
                  >
                    Ir a Apuntes
                  </button>
                </div>
              </form>
            )}

            {activeQuickAction === 'mood' && (
              <form onSubmit={handleSaveQuickMood} className="space-y-3.5 text-xs">
                <div>
                  <p className="font-semibold mb-2">Nivel de bienestar hoy ({moodScore}/10)</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[2, 4, 6, 8, 10].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setMoodScore(val)}
                        className={`min-h-[44px] rounded-xl border-2 font-mono font-bold cursor-pointer active:scale-95 transition-all ${
                          moodScore === val
                            ? 'border-[#10B981] bg-[#10B981] text-white'
                            : 'fabro-border fabro-surface-elevated'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold mb-2">Emoción principal</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_EMOTIONS.map((emo) => (
                      <button
                        key={emo}
                        type="button"
                        onClick={() => setMoodEmotion(emo)}
                        className={`min-h-[44px] px-3 rounded-full border-2 text-xs font-bold cursor-pointer active:scale-95 ${
                          moodEmotion === emo
                            ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#B45309] dark:text-[#FBBF24]'
                            : 'fabro-border fabro-surface-elevated'
                        }`}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  value={moodHabit}
                  onChange={(e) => setMoodHabit(e.target.value)}
                  placeholder="Hábito cumplido (ej. 2L agua, caminata, lectura)"
                  className="w-full min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                />

                {moodSavedMsg && (
                  <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {moodSavedMsg}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="flex-1 fabro-btn border-[#10B981] bg-[#10B981] text-white"
                    style={{ boxShadow: '0 6px 16px rgba(16, 185, 129, 0.25)' }}
                  >
                    Registrar hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuickAction(null);
                      navigateTo('bienestar', 'bienestar-emocional');
                    }}
                    className="fabro-btn fabro-border fabro-surface-elevated"
                  >
                    Abrir Bienestar
                  </button>
                </div>
              </form>
            )}

            {activeQuickAction === 'ptt' && (
              <div className="space-y-4 text-xs">
                <div className="flex flex-col items-center gap-3 py-3 rounded-2xl border-2 border-[#7C3AED]/30 bg-[#7C3AED]/5">
                  <button
                    type="button"
                    onPointerDown={startQuickPtt}
                    onPointerUp={releaseQuickPtt}
                    onPointerLeave={() => {
                      if (pttHolding) releaseQuickPtt();
                    }}
                    className={`w-28 h-28 rounded-full border-2 flex flex-col items-center justify-center gap-1.5 font-bold cursor-pointer select-none active:scale-95 transition-all ${
                      pttHolding
                        ? 'border-[#EC4899] bg-[#EC4899] text-white'
                        : 'border-[#7C3AED] bg-[#7C3AED] text-white'
                    }`}
                    style={{ boxShadow: '0 10px 24px rgba(124, 58, 237, 0.30)' }}
                  >
                    {pttHolding ? <Radio className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                    <span>{pttHolding ? 'Soltá...' : 'Mantener'}</span>
                  </button>
                  <p className="fabro-muted">Mantené presionado para hablar por Push-to-Talk.</p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!pttQuickText.trim()) return;
                    sendQuickChatMessage(pttQuickText);
                    setPttQuickText('');
                    setPttFeedback('Mensaje enviado al chat rápido.');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={pttQuickText}
                    onChange={(e) => setPttQuickText(e.target.value)}
                    placeholder="O escribí un mensaje rápido..."
                    className="flex-1 min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 fabro-input"
                  />
                  <button
                    type="submit"
                    aria-label="Enviar mensaje rápido"
                    className="fabro-btn border-[#7C3AED] bg-[#7C3AED] text-white"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                {pttFeedback && (
                  <p className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {pttFeedback}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveQuickAction(null);
                    navigateTo('social', 'push-to-talk');
                  }}
                  className="w-full fabro-btn fabro-border fabro-surface-elevated"
                >
                  Abrir Sector 3 completo
                </button>
              </div>
            )}

            {activeQuickAction === 'pomodoro' && (
              <div className="space-y-4 text-xs text-center">
                <div className="flex justify-center gap-2">
                  {(
                    [
                      { id: '25-5' as const, label: '25 min enfoque' },
                      { id: '50-10' as const, label: '50 min enfoque' },
                    ]
                  ).map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPomodoroPreset(preset.id)}
                      className={`min-h-[44px] px-4 rounded-full border-2 font-bold cursor-pointer active:scale-95 ${
                        pomoPresetId === preset.id
                          ? 'border-[#2563EB] bg-[#2563EB] text-white'
                          : 'fabro-border fabro-surface-elevated'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="py-4 rounded-2xl border-2 border-[#06B6D4]/40 bg-[#06B6D4]/10">
                  <p className="font-mono text-4xl font-extrabold tabular-nums">
                    {formatTimer(pomoSecondsLeft)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={togglePomodoro}
                    className="flex-1 fabro-btn border-[#2563EB] bg-[#2563EB] text-white"
                    style={{ boxShadow: '0 6px 16px rgba(37, 99, 235, 0.25)' }}
                  >
                    {pomoRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {pomoRunning ? 'Pausar' : 'Iniciar'}
                  </button>
                  <button
                    type="button"
                    onClick={resetPomodoro}
                    className="fabro-btn fabro-border fabro-surface-elevated"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reiniciar
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuickAction(null);
                      void openFloatingMiniWindow();
                    }}
                    className="fabro-btn border-[#7C3AED] bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C084FC]"
                  >
                    <PictureInPicture2 className="w-4 h-4" />
                    Modo Flotante
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuickAction(null);
                      navigateTo('estudio', 'academico-panel');
                    }}
                    className="fabro-btn fabro-border fabro-surface-elevated"
                  >
                    Panel completo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
