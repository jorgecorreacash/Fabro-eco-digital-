import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clover,
  Pause,
  Play,
  Printer,
  RotateCcw,
  RotateCw,
  Sparkles,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { getResourceKindSummary } from '../../services/shareCodec';
import { playSoftBell } from '../../services/webAudioPtt';

export const SharedResourceReader: React.FC = () => {
  const { sharedViewerPayload, closeSharedViewer, importSharedResourceToVault } =
    useEcosystem();

  // Interactive Quiz state
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Interactive Flashcards state
  const [cardIndex, setCardIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // Interactive Routine Timer state
  const [routineRunning, setRoutineRunning] = useState(false);
  const [routinePhase, setRoutinePhase] = useState<'work' | 'rest'>('work');
  const [routineRound, setRoutineRound] = useState(1);
  const [routineSecLeft, setRoutineSecLeft] = useState(40);
  const [guestReflection, setGuestReflection] = useState('');

  useEffect(() => {
    setAnswers({});
    setQuizSubmitted(false);
    setCardIndex(0);
    setCardFlipped(false);
    setRoutineRunning(false);
    setRoutinePhase('work');
    setRoutineRound(1);
    if (sharedViewerPayload?.kind === 'routine') {
      setRoutineSecLeft(sharedViewerPayload.workSec);
    }
    if (sharedViewerPayload?.kind === 'stoic') {
      setGuestReflection(sharedViewerPayload.reflection || '');
    }
  }, [sharedViewerPayload]);

  useEffect(() => {
    if (!routineRunning || sharedViewerPayload?.kind !== 'routine') return;
    const timer = window.setInterval(() => {
      setRoutineSecLeft((prev) => {
        if (prev > 1) return prev - 1;
        playSoftBell('interval');
        if (routinePhase === 'work') {
          setRoutinePhase('rest');
          return sharedViewerPayload.restSec;
        }
        if (routineRound < sharedViewerPayload.rounds) {
          setRoutineRound((r) => r + 1);
          setRoutinePhase('work');
          return sharedViewerPayload.workSec;
        }
        setRoutineRunning(false);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [routineRunning, routinePhase, routineRound, sharedViewerPayload]);

  if (!sharedViewerPayload) return null;

  const { badge, summary } = getResourceKindSummary(sharedViewerPayload);

  const handleSaveToFabro = () => {
    const payloadToSave =
      sharedViewerPayload.kind === 'stoic'
        ? { ...sharedViewerPayload, reflection: guestReflection }
        : sharedViewerPayload;
    void importSharedResourceToVault(payloadToSave);
  };

  const quizScore =
    sharedViewerPayload.kind === 'quiz'
      ? sharedViewerPayload.questions.reduce(
          (acc, q) => acc + (answers[q.id] === q.correctIndex ? 1 : 0),
          0
        )
      : 0;

  return (
    <div className="min-h-dvh fabro-canvas p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-6">
        {/* Top Guest Reader Header */}
        <header className="rounded-2xl border-2 border-[#2563EB]/35 fabro-surface p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#10B981] text-white flex items-center justify-center shrink-0">
              <Clover className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold tracking-tight flex items-center gap-1.5">
                FABRO · Modo Lector Directo
              </p>
              <p className="text-[11px] fabro-muted truncate">
                Acceso inmediato sin registro ni contraseña
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToFabro}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)] cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Guardar en mi FABRO y crear mi espacio gratis
            </button>
            <button
              type="button"
              onClick={closeSharedViewer}
              aria-label="Cerrar lector compartido y abrir FABRO"
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-semibold cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4" />
              Explorar app
            </button>
          </div>
        </header>

        {/* Main Resource Hero */}
        <section className="rounded-2xl border-2 fabro-border fabro-surface p-6 space-y-5 shadow-sm">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2563EB]/30 bg-[#2563EB]/10 px-3 py-1 text-xs font-bold text-[#2563EB] dark:text-[#60A5FA]">
              <BookOpen className="w-3.5 h-3.5" />
              {badge}
              {sharedViewerPayload.author ? ` · Compartido por ${sharedViewerPayload.author}` : ''}
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
              {sharedViewerPayload.title}
            </h1>
            <p className="text-xs sm:text-sm fabro-muted">{summary}</p>
          </div>

          {/* 1. NOTE READER */}
          {sharedViewerPayload.kind === 'note' && (
            <div className="space-y-4">
              {sharedViewerPayload.mainIdea && (
                <div className="rounded-2xl border-2 border-[#2563EB]/40 bg-[#2563EB]/10 p-4 space-y-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#2563EB] dark:text-[#60A5FA]">
                    Idea Principal
                  </p>
                  <p className="text-sm font-semibold leading-relaxed">
                    {sharedViewerPayload.mainIdea}
                  </p>
                </div>
              )}

              {sharedViewerPayload.summaryText && (
                <div className="rounded-2xl border-2 border-[#06B6D4]/40 bg-[#06B6D4]/10 p-4 space-y-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#0891B2] dark:text-[#38BDF8]">
                    Resumen rápido pre-examen
                  </p>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">
                    {sharedViewerPayload.summaryText}
                  </p>
                </div>
              )}

              {sharedViewerPayload.tags && sharedViewerPayload.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {sharedViewerPayload.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1 text-[11px] font-mono font-semibold"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border-2 fabro-border fabro-surface-elevated p-5 whitespace-pre-wrap text-sm leading-relaxed">
                {sharedViewerPayload.body}
              </div>

              {sharedViewerPayload.glossary && sharedViewerPayload.glossary.length > 0 && (
                <div className="rounded-2xl border-2 fabro-border fabro-surface-elevated p-4 space-y-2">
                  <p className="text-xs font-bold">Glosario clave de la materia</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {sharedViewerPayload.glossary.map((g, idx) => (
                      <div key={idx} className="rounded-xl border fabro-border fabro-surface p-2.5">
                        <p className="font-bold">{g.term}</p>
                        <p className="fabro-muted mt-0.5">{g.definition}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 fabro-border fabro-surface-elevated px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                Imprimir / Guardar como PDF
              </button>
            </div>
          )}

          {/* 2. INTERACTIVE FLASHCARDS READER */}
          {sharedViewerPayload.kind === 'flashcards' &&
            sharedViewerPayload.cards.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono fabro-muted">
                  <span>
                    Tarjeta {(cardIndex % sharedViewerPayload.cards.length) + 1} de{' '}
                    {sharedViewerPayload.cards.length}
                  </span>
                  <span>Tocá la tarjeta para girar</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCardFlipped((f) => !f)}
                  className="w-full min-h-[190px] rounded-2xl border-2 p-6 text-left flex flex-col justify-between gap-3 cursor-pointer active:scale-[0.99] transition-all"
                  style={{
                    borderColor: cardFlipped ? '#06B6D4' : '#2563EB',
                    backgroundColor: cardFlipped
                      ? 'rgba(6, 182, 212, 0.10)'
                      : 'rgba(37, 99, 235, 0.08)',
                  }}
                >
                  <span className="text-xs font-bold text-[#2563EB] dark:text-[#60A5FA] flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5" />
                    {cardFlipped ? 'Respuesta' : 'Pregunta'}
                  </span>
                  <p className="text-base sm:text-lg font-bold leading-relaxed">
                    {cardFlipped
                      ? sharedViewerPayload.cards[
                          cardIndex % sharedViewerPayload.cards.length
                        ].back
                      : sharedViewerPayload.cards[
                          cardIndex % sharedViewerPayload.cards.length
                        ].front}
                  </p>
                  <span className="text-xs fabro-muted">Tocá para ver el otro lado</span>
                </button>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCardFlipped(false);
                      setCardIndex((i) =>
                        i === 0 ? sharedViewerPayload.cards.length - 1 : i - 1
                      );
                    }}
                    className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface-elevated px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCardFlipped(false);
                      setCardIndex((i) => (i + 1) % sharedViewerPayload.cards.length);
                    }}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    Siguiente tarjeta
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          {/* 3. INTERACTIVE QUIZ READER */}
          {sharedViewerPayload.kind === 'quiz' && (
            <div className="space-y-4">
              {sharedViewerPayload.questions.map((q, qIdx) => {
                const chosen = answers[q.id];
                const isCorrect = chosen === q.correctIndex;
                return (
                  <div
                    key={q.id}
                    className="rounded-2xl border-2 fabro-border fabro-surface-elevated p-4 space-y-3"
                  >
                    <p className="text-sm font-bold">
                      {qIdx + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, optIdx) => {
                        const selected = chosen === optIdx;
                        let styleCls = 'fabro-border fabro-surface';
                        if (quizSubmitted) {
                          if (optIdx === q.correctIndex) {
                            styleCls =
                              'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold';
                          } else if (selected && optIdx !== q.correctIndex) {
                            styleCls =
                              'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-300';
                          }
                        } else if (selected) {
                          styleCls =
                            'border-[#2563EB] bg-[#2563EB]/15 font-bold text-[#1D4ED8] dark:text-[#60A5FA]';
                        }
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={quizSubmitted}
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                            }
                            className={`w-full min-h-[44px] rounded-xl border-2 px-3.5 py-2 text-left text-xs cursor-pointer transition-all ${styleCls}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && (
                      <div className="rounded-xl border fabro-border fabro-surface p-3 text-xs flex items-start gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span>{q.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {!quizSubmitted ? (
                  <button
                    type="button"
                    onClick={() => setQuizSubmitted(true)}
                    className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-5 py-2 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Corregir simulacro ahora
                  </button>
                ) : (
                  <>
                    <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      Puntaje: {quizScore} / {sharedViewerPayload.questions.length} correctas
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAnswers({});
                        setQuizSubmitted(false);
                      }}
                      className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reintentar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 4. CONCEPT MAP VIEWER */}
          {sharedViewerPayload.kind === 'concept-map' && (
            <div className="space-y-4">
              <div className="relative h-72 rounded-2xl border-2 fabro-border fabro-surface-elevated overflow-hidden">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                  {sharedViewerPayload.nodes.map((node) => {
                    if (!node.parentId) return null;
                    const parent = sharedViewerPayload.nodes.find((p) => p.id === node.parentId);
                    if (!parent) return null;
                    return (
                      <path
                        key={`edge-${node.id}`}
                        d={`M ${parent.x} ${parent.y} Q ${parent.x} ${(parent.y + node.y) / 2}, ${node.x} ${node.y}`}
                        fill="none"
                        stroke={node.color}
                        strokeWidth="1.2"
                      />
                    );
                  })}
                </svg>
                {sharedViewerPayload.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl border-2 text-xs font-bold fabro-surface shadow-sm max-w-[160px] truncate"
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      borderColor: node.color,
                    }}
                  >
                    {node.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. ROUTINE + LIVE TIMER */}
          {sharedViewerPayload.kind === 'routine' && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-[#10B981]/40 bg-[#10B981]/10 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase text-[#047857] dark:text-[#34D399] flex items-center gap-1.5">
                    <Timer className="w-4 h-4" />
                    {routinePhase === 'work' ? 'En movimiento' : 'Descanso'} · Ronda {routineRound}/
                    {sharedViewerPayload.rounds}
                  </p>
                  <p className="font-mono text-3xl font-extrabold tabular-nums mt-1">
                    {String(routineSecLeft).padStart(2, '0')}s
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRoutineRunning((r) => !r)}
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
                  >
                    {routineRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {routineRunning ? 'Pausar' : 'Iniciar rutina'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRoutineRunning(false);
                      setRoutinePhase('work');
                      setRoutineRound(1);
                      setRoutineSecLeft(sharedViewerPayload.workSec);
                    }}
                    className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface flex items-center justify-center cursor-pointer active:scale-95"
                    aria-label="Reiniciar rutina"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <ol className="space-y-2 text-xs">
                {sharedViewerPayload.steps.map((step, i) => (
                  <li
                    key={i}
                    className="rounded-xl border-2 fabro-border fabro-surface-elevated p-3 font-medium"
                  >
                    <strong>Paso {i + 1}:</strong> {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 6. STOIC REFLECTION READER */}
          {sharedViewerPayload.kind === 'stoic' && (
            <div className="space-y-3 text-xs">
              {sharedViewerPayload.quote && (
                <p className="italic fabro-muted">{sharedViewerPayload.quote}</p>
              )}
              <div className="rounded-xl border-2 border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 font-semibold text-sm">
                {sharedViewerPayload.prompt}
              </div>
              <textarea
                rows={4}
                value={guestReflection}
                onChange={(e) => setGuestReflection(e.target.value)}
                placeholder="Escribí tu propia respuesta antes de guardarla en tu espacio FABRO..."
                className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-3 text-xs leading-relaxed fabro-input"
              />
            </div>
          )}

          {/* Bottom CTA */}
          <div className="pt-4 border-t fabro-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs fabro-muted">
              ¿Querés conservar este recurso para editarlo, estudiarlo sin internet y crear los tuyos?
            </p>
            <button
              type="button"
              onClick={handleSaveToFabro}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-5 py-2.5 text-xs font-bold shadow-[0_6px_16px_-6px_rgba(16,185,129,0.5)] cursor-pointer active:scale-95 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              Guardar en mi FABRO y crear mi espacio gratis
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
