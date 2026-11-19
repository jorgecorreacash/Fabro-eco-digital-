import React, { useState } from 'react';
import { CheckCircle2, GraduationCap, Plus, RotateCcw, XCircle } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { ShareResourceButton } from '../../common/ShareResourceButton';

export const QuizSimulatorTool: React.FC = () => {
  const { studyQuiz, addQuizQuestion, profile } = useEcosystem();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [qText, setQText] = useState('');
  const [opt0, setOpt0] = useState('');
  const [opt1, setOpt1] = useState('');
  const [opt2, setOpt2] = useState('');
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState('');

  const score = studyQuiz.questions.reduce(
    (sum, q) => sum + (answers[q.id] === q.correctIndex ? 1 : 0),
    0
  );

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText.trim() || !opt0.trim() || !opt1.trim()) return;
    const opts = [opt0.trim(), opt1.trim(), ...(opt2.trim() ? [opt2.trim()] : [])];
    addQuizQuestion({
      question: qText.trim(),
      options: opts,
      correctIndex: Math.min(correctIndex, opts.length - 1),
      explanation: explanation.trim() || 'Respuesta correcta verificada por el creador.',
    });
    setQText('');
    setOpt0('');
    setOpt1('');
    setOpt2('');
    setExplanation('');
    setShowAdd(false);
  };

  return (
    <div className="rounded-2xl border-2 border-[#2563EB]/40 fabro-surface p-5 sm:p-6 space-y-5 shadow-[0_8px_24px_-12px_rgba(37,99,235,0.22)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#2563EB] dark:text-[#38BDF8]" />
            {studyQuiz.title}
          </h2>
          <p className="text-xs fabro-muted mt-0.5">
            {studyQuiz.subject} · {studyQuiz.questions.length} preguntas con autocorrección y explicación.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4 text-[#2563EB]" />
          {showAdd ? 'Cerrar editor' : 'Agregar pregunta'}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={handleAddQuestion}
          className="rounded-2xl border-2 border-[#06B6D4]/40 fabro-surface-elevated p-4 space-y-2.5 text-xs"
        >
          <input
            type="text"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Escribí la pregunta del simulacro..."
            className="min-h-[44px] w-full rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              value={opt0}
              onChange={(e) => setOpt0(e.target.value)}
              placeholder="Opción 1"
              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
            />
            <input
              type="text"
              value={opt1}
              onChange={(e) => setOpt1(e.target.value)}
              placeholder="Opción 2"
              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
            />
            <input
              type="text"
              value={opt2}
              onChange={(e) => setOpt2(e.target.value)}
              placeholder="Opción 3 (opcional)"
              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={correctIndex}
              onChange={(e) => setCorrectIndex(Number(e.target.value))}
              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2"
            >
              <option value={0}>Opción 1 es correcta</option>
              <option value={1}>Opción 2 es correcta</option>
              <option value={2}>Opción 3 es correcta</option>
            </select>
            <input
              type="text"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explicación breve para el estudiante..."
              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
          >
            Sumar al simulacro
          </button>
        </form>
      )}

      {studyQuiz.questions.length === 0 ? (
        <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-5 text-xs fabro-muted">
          Sin preguntas cargadas. Tocá «Agregar pregunta» para armar tu propio simulacro y compartirlo por WhatsApp.
        </div>
      ) : (
        <div className="space-y-3">
          {studyQuiz.questions.map((q, qIdx) => {
            const chosen = answers[q.id];
            const isCorrect = chosen === q.correctIndex;
            return (
              <div
                key={q.id}
                className="rounded-2xl border-2 fabro-border fabro-surface-elevated p-4 space-y-2.5 text-xs"
              >
                <p className="font-bold text-sm">
                  {qIdx + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const selected = chosen === optIdx;
                    let cls = 'fabro-border fabro-surface hover:border-[#2563EB]';
                    if (submitted) {
                      if (optIdx === q.correctIndex) {
                        cls =
                          'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold';
                      } else if (selected && optIdx !== q.correctIndex) {
                        cls = 'border-rose-500 bg-rose-500/15 text-rose-800 dark:text-rose-300';
                      }
                    } else if (selected) {
                      cls = 'border-[#2563EB] bg-[#2563EB]/15 font-bold text-[#1D4ED8] dark:text-[#60A5FA]';
                    }
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        disabled={submitted}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                        className={`w-full min-h-[44px] rounded-xl border-2 px-3 py-2 text-left cursor-pointer transition-all ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {submitted && (
                  <div className="rounded-xl border fabro-border fabro-surface p-3 flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{q.explanation}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t fabro-border">
        <div className="flex flex-wrap items-center gap-2">
          {!submitted ? (
            <button
              type="button"
              disabled={studyQuiz.questions.length === 0}
              onClick={() => setSubmitted(true)}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-2 text-xs font-bold disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              Autocorregir ({Object.keys(answers).length}/{studyQuiz.questions.length})
            </button>
          ) : (
            <>
              <span className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                Resultado: {score} / {studyQuiz.questions.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setSubmitted(false);
                }}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar
              </button>
            </>
          )}
        </div>

        {studyQuiz.questions.length > 0 && (
          <ShareResourceButton
            label="Compartir simulacro por WhatsApp"
            payload={{
              v: 1,
              kind: 'quiz',
              title: studyQuiz.title,
              subject: studyQuiz.subject,
              questions: studyQuiz.questions,
              author: profile.displayName,
            }}
          />
        )}
      </div>
    </div>
  );
};
