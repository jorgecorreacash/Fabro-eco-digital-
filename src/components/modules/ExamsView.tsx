import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  CheckCircle2,
  GraduationCap,
  Mic,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import type { Exam, ExamQuestion } from '../../types/fabro';

export const ExamsView: React.FC = () => {
  const {
    subjects,
    selectedSubjectId,
    libraryDocs,
    notes,
    exams,
    profile,
    createExam,
    updateExamProgress,
    completeExam,
    deleteExam,
    logStudySession,
    setAiDraftPrompt,
    setActiveSection,
  } = useFabro();

  const isOnline = useOnlineStatus();

  const [subjectId, setSubjectId] = useState(selectedSubjectId || subjects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'escrito' | 'oral'>('escrito');
  const [difficulty, setDifficulty] = useState<Exam['difficulty']>('universitario');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(5);

  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState('');

  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [localQuestions, setLocalQuestions] = useState<ExamQuestion[]>([]);

  // Oral simulation state
  const [oralIndex, setOralIndex] = useState(0);
  const [oralInput, setOralInput] = useState('');
  const [oralTranscript, setOralTranscript] = useState<
    Array<{ speaker: 'profesor' | 'estudiante'; text: string }>
  >([]);
  const [oralTurning, setOralTurning] = useState(false);

  useEffect(() => {
    if (selectedSubjectId) {
      setSubjectId(selectedSubjectId);
    } else if (!subjectId && subjects.length > 0) {
      setSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects, subjectId]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === subjectId) || null,
    [subjects, subjectId]
  );

  const activeExam = useMemo(
    () => exams.find((e) => e.id === activeExamId) || null,
    [exams, activeExamId]
  );

  const toggleUnit = (u: string) => {
    setSelectedUnits((prev) =>
      prev.includes(u) ? prev.filter((item) => item !== u) : [...prev, u]
    );
  };

  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setError('Se requiere conexión a internet para generar exámenes con Gemini.');
      return;
    }
    setError('');
    setGenerating(true);

    const subjectName = activeSubject?.name || 'Evaluación general';
    const contextParts = [
      ...libraryDocs
        .filter((d) => d.aiAuthorized && (!subjectId || d.subjectId === subjectId))
        .map((d) => d.extractedText.slice(0, 8000)),
      ...notes
        .filter((n) => !subjectId || n.subjectId === subjectId)
        .map((n) => n.contentText.slice(0, 4000)),
    ]
      .filter(Boolean)
      .join('\n\n');

    try {
      const resp = await authFetch('/api/ai/exam-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName,
          units: selectedUnits,
          difficulty,
          mode,
          questionCount,
          educationLevel: profile?.educationLevel || 'universitario',
          studyContext: contextParts,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No se pudo generar el examen.');
        return;
      }

      const generatedQuestions: ExamQuestion[] = (data.questions || []).map(
        (q: ExamQuestion, idx: number) => ({
          id: q.id || `q_${idx + 1}`,
          prompt: q.prompt,
          type: q.type === 'desarrollo' ? 'desarrollo' : 'opcion_multiple',
          options: Array.isArray(q.options) ? q.options : [],
          correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : -1,
          topic: q.topic || subjectName,
          expectedKeyPoints: q.expectedKeyPoints || '',
          userAnswer: '',
          selectedOptionIndex: -1,
        })
      );

      const examTitle =
        title.trim() ||
        `${mode === 'oral' ? 'Examen oral' : 'Simulacro'}: ${subjectName}`;

      const examId = await createExam({
        subjectId,
        title: examTitle,
        mode,
        difficulty,
        units: selectedUnits,
        status: 'en_progreso',
        scorePercent: 0,
        questionsCount: generatedQuestions.length || 1,
        questions: generatedQuestions,
        weakTopics: [],
        aiFeedback: '',
      });

      setActiveExamId(examId);
      setLocalQuestions(generatedQuestions);
      if (mode === 'oral' && generatedQuestions.length > 0) {
        setOralIndex(0);
        setOralTranscript([
          {
            speaker: 'profesor',
            text: `Comenzamos el examen oral de ${subjectName}. Primera pregunta: ${generatedQuestions[0].prompt}`,
          },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando el examen.');
    } finally {
      setGenerating(false);
    }
  };

  const openExistingExam = (exam: Exam) => {
    setActiveExamId(exam.id);
    setLocalQuestions(exam.questions || []);
    if (exam.mode === 'oral' && exam.status === 'en_progreso' && exam.questions.length > 0) {
      setOralIndex(0);
      setOralTranscript([
        {
          speaker: 'profesor',
          text: `Retomamos el examen oral. Pregunta 1: ${exam.questions[0].prompt}`,
        },
      ]);
    }
  };

  const handleSubmitWrittenExam = async () => {
    if (!activeExam || !isOnline) return;
    setEvaluating(true);
    setError('');
    try {
      const subjectName = subjects.find((s) => s.id === activeExam.subjectId)?.name || 'General';
      const resp = await authFetch('/api/ai/exam-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName,
          mode: activeExam.mode,
          difficulty: activeExam.difficulty,
          questions: localQuestions,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No se pudo corregir el examen.');
        return;
      }

      const evalMap = new Map<string, { isCorrect?: boolean; score?: number; feedback?: string }>();
      for (const ev of data.questionEvaluations || []) {
        evalMap.set(ev.id, ev);
      }

      const gradedQuestions = localQuestions.map((q) => {
        const ev = evalMap.get(q.id);
        return {
          ...q,
          isCorrect: ev?.isCorrect ?? false,
          score: ev?.score ?? 0,
          feedback: ev?.feedback ?? '',
        };
      });

      await completeExam(activeExam.id, {
        scorePercent: Number(data.scorePercent) || 0,
        questions: gradedQuestions,
        weakTopics: Array.isArray(data.weakTopics) ? data.weakTopics : [],
        aiFeedback: data.aiFeedback || '',
      });

      void logStudySession({
        subjectId: activeExam.subjectId,
        activityType: 'examen',
        durationMinutes: Math.max(10, gradedQuestions.length * 3),
        topic: activeExam.title,
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al evaluar respuestas.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleOralSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeExam || !oralInput.trim() || !isOnline) return;

    const currentQ = localQuestions[oralIndex];
    const studentAnswer = oralInput.trim();
    const updatedTranscript = [
      ...oralTranscript,
      { speaker: 'estudiante' as const, text: studentAnswer },
    ];
    setOralTranscript(updatedTranscript);
    setOralInput('');

    const updatedQs = localQuestions.map((q, idx) =>
      idx === oralIndex ? { ...q, userAnswer: studentAnswer } : q
    );
    setLocalQuestions(updatedQs);
    void updateExamProgress(activeExam.id, updatedQs);

    setOralTurning(true);
    setError('');
    try {
      const subjectName = subjects.find((s) => s.id === activeExam.subjectId)?.name || 'General';
      const resp = await authFetch('/api/ai/oral-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName,
          difficulty: activeExam.difficulty,
          currentQuestion: currentQ?.prompt || '',
          studentAnswer,
          history: updatedTranscript,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No se pudo procesar la respuesta del examen oral.');
        return;
      }
      const nextIndex = oralIndex + 1;
      const nextPrompt =
        nextIndex < localQuestions.length
          ? `\n\nSiguiente pregunta (${nextIndex + 1}/${localQuestions.length}): ${localQuestions[nextIndex].prompt}`
          : '\n\nCon esto completamos las preguntas previstas. Cuando quieras podés finalizar para recibir tu nota y devolución integral.';

      setOralTranscript((prev) => [
        ...prev,
        { speaker: 'profesor', text: `${data.reply || ''}${nextPrompt}` },
      ]);
      if (nextIndex < localQuestions.length) {
        setOralIndex(nextIndex);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red en la simulación oral.');
    } finally {
      setOralTurning(false);
    }
  };

  const handleFinishOralExam = async () => {
    if (!activeExam || !isOnline) return;
    setEvaluating(true);
    setError('');
    try {
      const subjectName = subjects.find((s) => s.id === activeExam.subjectId)?.name || 'General';
      const resp = await authFetch('/api/ai/exam-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName,
          mode: 'oral',
          difficulty: activeExam.difficulty,
          questions: localQuestions,
          oralTranscript,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'No se pudo calificar el examen oral.');
        return;
      }
      await completeExam(activeExam.id, {
        scorePercent: Number(data.scorePercent) || 0,
        questions: localQuestions,
        weakTopics: Array.isArray(data.weakTopics) ? data.weakTopics : [],
        aiFeedback: data.aiFeedback || '',
      });
      void logStudySession({
        subjectId: activeExam.subjectId,
        activityType: 'examen',
        durationMinutes: Math.max(10, localQuestions.length * 3),
        topic: activeExam.title,
        date: new Date().toISOString().slice(0, 10),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al evaluar el examen oral.');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Preparación de exámenes
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Creá simulacros escritos o rendí exámenes orales interactivos con evaluación argumentativa y detección de temas débiles.
          </p>
        </div>
        {activeExam && (
          <button
            type="button"
            onClick={() => setActiveExamId(null)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-medium cursor-pointer self-start"
          >
            Volver al listado
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!activeExam ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Exam Generator Form */}
          <section className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Configurar nuevo examen
            </h3>
            <form onSubmit={handleGenerateExam} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nombre de la materia
                </label>
                <select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setSelectedUnits([]);
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                >
                  <option value="">General</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Título del examen (opcional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Primer Parcial - Unidades 1 a 3"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Modalidad
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'escrito' | 'oral')}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="escrito">Escrito</option>
                    <option value="oral">Simulación oral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Dificultad
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Exam['difficulty'])}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="basico">Básico</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="universitario">Universitario</option>
                    <option value="avanzado">Avanzado / Final</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Cantidad de preguntas: <span className="font-mono">{questionCount}</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={12}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-sky-600"
                />
              </div>

              {activeSubject && activeSubject.units.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Unidades a evaluar
                  </label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {activeSubject.units.map((u) => (
                      <label key={u} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedUnits.includes(u)}
                          onChange={() => toggleUnit(u)}
                          className="accent-sky-600"
                        />
                        <span className="truncate">{u}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={generating || !isOnline}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {generating ? 'Generando preguntas con Gemini...' : 'Crear y comenzar'}
              </button>
            </form>
          </section>

          {/* Exam History */}
          <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Historial y evolución de exámenes
              </h3>
            </div>
            {exams.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <GraduationCap className="w-9 h-9 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Todavía no realizaste simulacros. Configurá uno a la izquierda para comenzar.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {exams.map((ex) => {
                  const subName = subjects.find((s) => s.id === ex.subjectId)?.name || 'General';
                  return (
                    <div key={ex.id} className="p-4 sm:px-5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {ex.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {subName} · <span className="capitalize">{ex.mode}</span> · <span className="capitalize">{ex.difficulty}</span> ·{' '}
                          {ex.status === 'completado' ? (
                            <span className="font-mono font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                              Nota: {ex.scorePercent}%
                            </span>
                          ) : (
                            'En progreso'
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openExistingExam(ex)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {ex.status === 'completado' ? 'Ver resultados' : 'Continuar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteExam(ex.id)}
                          aria-label="Eliminar examen"
                          className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : activeExam.status === 'completado' ? (
        /* Completed Exam Results View */
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Evaluación completada
                </p>
                <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {activeExam.title}
                </h3>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-slate-500">Calificación final</p>
                <p className="font-display text-4xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                  {activeExam.scorePercent}%
                </p>
              </div>
            </div>

            {activeExam.weakTopics.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Temas recomendados para reforzar: </span>
                  <span className="text-slate-700 dark:text-slate-300">{activeExam.weakTopics.join(' · ')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAiDraftPrompt(
                      `Acabo de rendir "${activeExam.title}" y necesito reforzar estos temas débiles: ${activeExam.weakTopics.join(', ')}. Explicamelos con ejemplos y ejercitación.`
                    );
                    setActiveSection('fabro-ai');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Reforzar con FABRO AI
                </button>
              </div>
            )}

            {activeExam.aiFeedback && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 fabro-markdown text-sm text-slate-700 dark:text-slate-200">
                <Markdown remarkPlugins={[remarkGfm]}>{activeExam.aiFeedback}</Markdown>
              </div>
            )}
          </section>

          <div className="space-y-4">
            {activeExam.questions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {idx + 1}. {q.prompt}
                </p>
                {q.type === 'opcion_multiple' && q.options.length > 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Tu respuesta: {q.selectedOptionIndex !== undefined && q.selectedOptionIndex >= 0 ? q.options[q.selectedOptionIndex] : 'Sin responder'} · Correcta: {q.correctOptionIndex >= 0 ? q.options[q.correctOptionIndex] : 'Ver devolución'}
                  </p>
                )}
                {q.userAnswer && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>Tu desarrollo:</strong> {q.userAnswer}
                  </p>
                )}
                {q.feedback && (
                  <p className="text-xs text-sky-700 dark:text-sky-300 pt-1">
                    <strong>Devolución:</strong> {q.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : activeExam.mode === 'oral' ? (
        /* Interactive Oral Exam Simulation */
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] flex flex-col overflow-hidden min-h-[480px] max-h-[78dvh]">
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Mic className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                {activeExam.title} · Mesa oral simulada
              </h3>
            </div>
            <button
              type="button"
              disabled={evaluating}
              onClick={() => void handleFinishOralExam()}
              className="w-full sm:w-auto rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {evaluating ? 'Evaluando mesa...' : 'Finalizar y calificar'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {oralTranscript.map((turn, idx) => (
              <div
                key={idx}
                className={`flex ${turn.speaker === 'estudiante' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    turn.speaker === 'estudiante'
                      ? 'bg-sky-600 text-white'
                      : 'border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70'
                  }`}
                >
                  <p className="text-[11px] font-semibold opacity-75 mb-1">
                    {turn.speaker === 'estudiante' ? 'Tu defensa oral' : 'Docente evaluador'}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed break-words">{turn.text}</p>
                </div>
              </div>
            ))}
            {oralTurning && (
              <p className="text-xs text-slate-500">El tribunal está analizando tu argumentación...</p>
            )}
          </div>

          <form onSubmit={handleOralSend} className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
            <textarea
              rows={2}
              value={oralInput}
              onChange={(e) => setOralInput(e.target.value)}
              placeholder="Desarrollá tu respuesta oral con precisión argumentativa..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm resize-none"
            />
            <button
              type="submit"
              disabled={oralTurning || !oralInput.trim()}
              className="rounded-xl bg-sky-600 px-4 text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shrink-0"
              aria-label="Enviar defensa oral"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      ) : (
        /* Written Exam Runner */
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white break-words">
                {activeExam.title}
              </h3>
              <p className="text-xs text-slate-500">
                Respondé todas las consignas y presioná &ldquo;Entregar y corregir&rdquo;.
              </p>
            </div>
            <button
              type="button"
              disabled={evaluating || !isOnline}
              onClick={() => void handleSubmitWrittenExam()}
              className="w-full sm:w-auto rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {evaluating ? 'Corrigiendo con IA...' : 'Entregar y corregir'}
            </button>
          </div>

          {localQuestions.map((q, idx) => (
            <div key={q.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {idx + 1}. {q.prompt}
                </p>
                <span className="text-[11px] text-slate-400 shrink-0">{q.topic}</span>
              </div>

              {q.type === 'opcion_multiple' && q.options.length > 0 ? (
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <label
                      key={optIdx}
                      className={`flex items-center gap-2.5 rounded-lg border p-3 text-sm cursor-pointer transition-colors ${
                        q.selectedOptionIndex === optIdx
                          ? 'border-sky-500 bg-sky-500/10 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        checked={q.selectedOptionIndex === optIdx}
                        onChange={() => {
                          const updated = localQuestions.map((item, i) =>
                            i === idx ? { ...item, selectedOptionIndex: optIdx } : item
                          );
                          setLocalQuestions(updated);
                          void updateExamProgress(activeExam.id, updated);
                        }}
                        className="accent-sky-600"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={4}
                  value={q.userAnswer || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const updated = localQuestions.map((item, i) =>
                      i === idx ? { ...item, userAnswer: val } : item
                    );
                    setLocalQuestions(updated);
                  }}
                  onBlur={() => void updateExamProgress(activeExam.id, localQuestions)}
                  placeholder="Escribí tu respuesta desarrollada..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
