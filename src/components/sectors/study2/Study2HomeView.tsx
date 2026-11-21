import React, { useMemo } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Plus,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useStudy2 } from '../../../context/Study2Context';
import { computeRealStudyProgress } from '../../../services/study2ToolsUtils';
import {
  addDaysToDateKey,
  expandEventsForDateRange,
  getTodayLocalDateKey,
  resolveEventColor,
} from '../../../services/unifiedCalendarService';

export const Study2HomeView: React.FC = () => {
  const { authUser, profile, advancedNotes, pomodoroLogs } = useEcosystem();
  const {
    snapshot,
    setActiveNav,
    setSelectedSubjectId,
    toggleTask,
  } = useStudy2();

  const userName = authUser?.displayName || profile.displayName || 'Estudiante';
  const todayKey = getTodayLocalDateKey();
  const next30Key = addDaysToDateKey(todayKey, 30);

  const activeSubjects = useMemo(
    () =>
      snapshot.subjects
        .filter((s) => !s.archived)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [snapshot.subjects]
  );

  const upcomingEvents = useMemo(() => {
    return expandEventsForDateRange(snapshot.calendarEvents, todayKey, next30Key)
      .filter((o) => !o.event.completed)
      .slice(0, 5);
  }, [next30Key, snapshot.calendarEvents, todayKey]);

  const upcomingEvaluations = useMemo(() => {
    return snapshot.evaluations
      .filter((e) => e.status === 'programada' && e.dateKey >= todayKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .slice(0, 4);
  }, [snapshot.evaluations, todayKey]);

  const pendingTasks = useMemo(
    () => snapshot.tasks.filter((t) => !t.completed).slice(0, 5),
    [snapshot.tasks]
  );

  const recentNotes = useMemo(() => advancedNotes.slice(0, 4), [advancedNotes]);

  const progress = useMemo(
    () =>
      computeRealStudyProgress({
        subjects: snapshot.subjects,
        tasks: snapshot.tasks,
        evaluations: snapshot.evaluations,
        pomodoroLogs,
      }),
    [pomodoroLogs, snapshot.evaluations, snapshot.subjects, snapshot.tasks]
  );

  const subjectMap = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.id, s])),
    [snapshot.subjects]
  );

  const continueSubject = useMemo(() => {
    if (snapshot.lastActiveSubjectId) {
      const found = activeSubjects.find((s) => s.id === snapshot.lastActiveSubjectId);
      if (found) return found;
    }
    return activeSubjects[0] || null;
  }, [activeSubjects, snapshot.lastActiveSubjectId]);

  const openSubjectWorkspace = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setActiveNav('mis-estudios');
  };

  return (
    <div className="space-y-5">
      {/* Clean Welcome & Continue Studying Hero */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            FABRO Estudio
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Hola, {userName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {activeSubjects.length > 0
              ? `Tenés ${activeSubjects.length} ${
                  activeSubjects.length === 1 ? 'estudio activo' : 'estudios activos'
                } y ${pendingTasks.length} ${
                  pendingTasks.length === 1 ? 'tarea pendiente' : 'tareas pendientes'
                }.`
              : 'Tu espacio educativo está limpio y listo para organizarlo a tu medida.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {continueSubject ? (
            <button
              type="button"
              onClick={() => openSubjectWorkspace(continueSubject.id)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Continuar: {continueSubject.name}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveNav('mis-estudios')}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar mi primera materia o curso</span>
            </button>
          )}
        </div>
      </section>

      {/* Real Progress Summary Strip (Zero Invented Numbers) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Estudios activos
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {progress.activeSubjectsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Avance real
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {progress.overallCompletionPercent !== null
              ? `${progress.overallCompletionPercent}%`
              : '—'}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {progress.overallCompletionPercent !== null
              ? `${progress.completedTopics + progress.completedTasks} de ${
                  progress.totalTopics + progress.totalTasks
                } ítems`
              : 'Sin temas ni tareas aún'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Próximos exámenes
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {upcomingEvaluations.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Tiempo registrado
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {progress.totalStudyMinutes >= 60
              ? `${(progress.totalStudyMinutes / 60).toFixed(1)} h`
              : `${progress.totalStudyMinutes} min`}
          </p>
        </div>
      </section>

      {/* Main 2-Column Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left 7 cols: Active Subjects + Pending Tasks */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Subjects */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Estudios activos
              </h2>
              {activeSubjects.length > 0 && (
                <span className="text-xs text-slate-400 tabular-nums">
                  {activeSubjects.length}
                </span>
              )}
            </div>

            {activeSubjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Comenzá a organizar tus estudios. Agregá tu primera materia, curso o capacitación
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No cargamos materias obligatorias: vos elegís exactamente qué estudiás.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeSubjects.slice(0, 6).map((sub) => {
                  const stat = progress.perSubject.find((p) => p.subjectId === sub.id);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => openSubjectWorkspace(sub.id)}
                      className="text-left rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 hover:border-slate-400 dark:hover:border-slate-600 transition-colors cursor-pointer space-y-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: sub.color }}
                        />
                        <p className="text-sm font-bold truncate text-slate-900 dark:text-white">
                          {sub.name}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {sub.institution || sub.customCategory || 'Espacio personal'}
                      </p>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{sub.units.length} unidades</span>
                          <span className="font-mono tabular-nums">
                            {stat?.completionPercent !== null && stat?.completionPercent !== undefined
                              ? `${stat.completionPercent}%`
                              : 'Sin progreso aún'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${stat?.completionPercent ?? 0}%`,
                              backgroundColor: sub.color,
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Pending Tasks */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Tareas pendientes
            </h2>

            {pendingTasks.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No tenés tareas pendientes registradas.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task) => {
                  const sub = task.subjectId ? subjectMap.get(task.subjectId) : undefined;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {task.title}
                          </p>
                          {sub && (
                            <p className="text-[11px] text-slate-500 truncate">{sub.name}</p>
                          )}
                        </div>
                      </div>
                      {task.dueDate && (
                        <span className="text-[11px] font-mono text-slate-500 shrink-0 tabular-nums">
                          {task.dueDate}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 cols: Upcoming Calendar Activities + Upcoming Exams + Latest Notes */}
        <div className="lg:col-span-5 space-y-5">
          {/* Upcoming Calendar Activities */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Próximas actividades
            </h2>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sin actividades programadas para los próximos 30 días.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((occ) => {
                  const color = resolveEventColor(occ.event, snapshot.calendarCategories);
                  return (
                    <div
                      key={occ.occurrenceId}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 flex items-center gap-3"
                    >
                      <span
                        className="w-3 h-8 rounded-md shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {occ.event.title}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {occ.dateKey} ·{' '}
                          {occ.event.allDay ? 'Todo el día' : occ.event.startTime}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Upcoming Exams */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-violet-600" />
              Próximos exámenes
            </h2>
            {upcomingEvaluations.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No hay evaluaciones programadas todavía.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingEvaluations.map((ev) => {
                  const sub = subjectMap.get(ev.subjectId);
                  return (
                    <div
                      key={ev.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {ev.title}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {sub?.name || 'Evaluación'}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-violet-600 dark:text-violet-400 shrink-0 tabular-nums">
                        {ev.dateKey}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Latest Notes */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              Últimos apuntes
            </h2>
            {recentNotes.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aún no creaste apuntes en tu cuaderno.
              </p>
            ) : (
              <div className="space-y-2">
                {recentNotes.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setActiveNav('mis-apuntes')}
                    className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  >
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {note.title}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {note.subject || 'Sin materia asignada'} · {note.updatedAt}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
