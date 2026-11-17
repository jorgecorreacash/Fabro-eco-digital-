import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import type { StudySession } from '../../types/fabro';

export const ProgressView: React.FC = () => {
  const {
    profile,
    subjects,
    selectedSubjectId,
    exams,
    calendarEvents,
    studySessions,
    logStudySession,
    setActiveSection,
    setAiDraftPrompt,
  } = useFabro();

  const [sessionSubjectId, setSessionSubjectId] = useState(selectedSubjectId || subjects[0]?.id || '');
  const [activityType, setActivityType] = useState<StudySession['activityType']>('lectura');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [topic, setTopic] = useState('');
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState('');

  useEffect(() => {
    if (selectedSubjectId) {
      setSessionSubjectId(selectedSubjectId);
    } else if (!sessionSubjectId && subjects.length > 0) {
      setSessionSubjectId(subjects[0].id);
    }
  }, [selectedSubjectId, subjects, sessionSubjectId]);

  const totalMinutes = useMemo(
    () => studySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0),
    [studySessions]
  );

  const completedTasks = useMemo(
    () => calendarEvents.filter((e) => e.completed).length,
    [calendarEvents]
  );

  const completedExams = useMemo(
    () => exams.filter((e) => e.status === 'completado'),
    [exams]
  );

  const avgExamScore = useMemo(() => {
    if (completedExams.length === 0) return null;
    const sum = completedExams.reduce((acc, e) => acc + (e.scorePercent || 0), 0);
    return Math.round(sum / completedExams.length);
  }, [completedExams]);

  const hoursBySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of studySessions) {
      const key = s.subjectId || 'general';
      map.set(key, (map.get(key) || 0) + s.durationMinutes);
    }
    return Array.from(map.entries())
      .map(([subId, mins]) => ({
        subId,
        name: subjects.find((s) => s.id === subId)?.name || 'General',
        color: subjects.find((s) => s.id === subId)?.color || '#0284C7',
        hours: Number((mins / 60).toFixed(1)),
        minutes: mins,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [studySessions, subjects]);

  const aggregatedWeakTopics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ex of completedExams) {
      for (const wt of ex.weakTopics || []) {
        counts.set(wt, (counts.get(wt) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [completedExams]);

  const strongSubjects = useMemo(() => {
    return subjects.filter((s) => s.progressPercent >= 70);
  }, [subjects]);

  const handleLogSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogging(true);
    setLogError('');
    try {
      await logStudySession({
        subjectId: sessionSubjectId,
        activityType,
        durationMinutes,
        topic: topic.trim() || 'Sesión de estudio',
        date: new Date().toISOString().slice(0, 10),
      });
      setTopic('');
    } catch {
      setLogError('No se pudo registrar la sesión de estudio.');
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Mi progreso y estadísticas
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Seguimiento real de tus horas estudiadas, actividades completadas, evolución en exámenes y recomendaciones personalizadas.
        </p>
      </div>

      {/* KPI Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Horas estudiadas</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">
            {(totalMinutes / 60).toFixed(1)} h
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            Meta semanal: {profile?.weeklyGoalHours || 15} h
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Materias trabajadas</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">
            {hoursBySubject.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            De {subjects.length} registradas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Actividades completadas</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">
            {completedTasks}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            De {calendarEvents.length} agendadas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Promedio en exámenes</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">
            {avgExamScore !== null ? `${avgExamScore}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {completedExams.length} evaluaciones cerradas
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Hours per Subject & Exam Evolution */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Distribución de tiempo por materia
            </h3>
            {hoursBySubject.length === 0 ? (
              <p className="text-xs text-slate-500">
                Usá el cronómetro superior o registrá una sesión para visualizar tu tiempo de estudio por materia.
              </p>
            ) : (
              <div className="space-y-3">
                {hoursBySubject.map((item) => {
                  const pct = Math.min(100, Math.round((item.minutes / Math.max(1, totalMinutes)) * 100));
                  return (
                    <div key={item.subId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium">{item.name}</span>
                        <span className="font-mono tabular-nums text-slate-500">
                          {item.hours} h ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Evolución de resultados en exámenes
            </h3>
            {completedExams.length === 0 ? (
              <p className="text-xs text-slate-500">
                Completá simulacros en el módulo de Exámenes para visualizar tu evolución.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {completedExams.map((ex) => (
                  <div key={ex.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{ex.title}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {ex.mode} · {ex.difficulty}
                      </p>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-sky-600 dark:text-sky-400">
                      {ex.scorePercent}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Log Session + Strengths/Weaknesses + Recommendations */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
            <h3 className="font-display text-base font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Fortalezas, dificultades y recomendaciones
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  Fortalezas actuales
                </p>
                {strongSubjects.length === 0 && (avgExamScore === null || avgExamScore < 70) ? (
                  <p className="text-slate-500">
                    Seguí avanzando en tus materias y exámenes para detectar tus áreas más sólidas.
                  </p>
                ) : (
                  <p className="text-slate-700 dark:text-slate-300">
                    {strongSubjects.map((s) => s.name).join(', ') || 'Buen rendimiento sostenido en simulacros'}
                  </p>
                )}
              </div>

              <div>
                <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">
                  Temas que requieren refuerzo
                </p>
                {aggregatedWeakTopics.length === 0 ? (
                  <p className="text-slate-500">Sin dificultades registradas aún.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {aggregatedWeakTopics.slice(0, 4).map(([topicName, count]) => (
                      <li key={topicName} className="flex items-center justify-between gap-2">
                        <span className="truncate text-slate-700 dark:text-slate-300">
                          {topicName} ({count})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAiDraftPrompt(`Necesito reforzar el tema "${topicName}". Armame una explicación clara con 3 ejercicios resueltos.`);
                            setActiveSection('fabro-ai');
                          }}
                          className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          Repasar con IA
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3.5">
            <h3 className="font-display text-base font-bold">Registrar sesión de estudio</h3>
            {logError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {logError}
              </div>
            )}
            <form onSubmit={handleLogSession} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Nombre de la materia
                  </label>
                  <select
                    value={sessionSubjectId}
                    onChange={(e) => setSessionSubjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
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
                    Actividad
                  </label>
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value as StudySession['activityType'])}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                  >
                    <option value="lectura">Lectura</option>
                    <option value="apuntes">Apuntes</option>
                    <option value="tutor_ai">Tutor AI</option>
                    <option value="examen">Examen</option>
                    <option value="memorizacion">Memorización</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Minutos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Tema trabajado
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ej. Integrales dobles"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2.5 py-2 text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={logging}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {logging ? 'Registrando...' : 'Registrar minutos'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};
