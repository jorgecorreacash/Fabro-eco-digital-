import React, { useMemo } from 'react';
import { BarChart3, BookOpen, CheckCircle2, ClipboardCheck, Clock } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useStudy2 } from '../../../context/Study2Context';
import { computeRealStudyProgress } from '../../../services/study2ToolsUtils';

export const Study2ProgressView: React.FC = () => {
  const { pomodoroLogs } = useEcosystem();
  const { snapshot } = useStudy2();

  const report = useMemo(
    () =>
      computeRealStudyProgress({
        subjects: snapshot.subjects,
        tasks: snapshot.tasks,
        evaluations: snapshot.evaluations,
        pomodoroLogs,
      }),
    [pomodoroLogs, snapshot.evaluations, snapshot.subjects, snapshot.tasks]
  );

  const hasAnyData =
    report.activeSubjectsCount > 0 ||
    report.totalTasks > 0 ||
    report.evaluationsTotal > 0 ||
    report.totalStudyMinutes > 0;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Mi progreso
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Métricas calculadas exclusivamente a partir de tus materias, temas completados, tareas, evaluaciones y sesiones de estudio registradas.
        </p>
      </section>

      {/* Key Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            Estudios activos
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
            {report.activeSubjectsCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Tareas completadas
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
            {report.completedTasks}
            <span className="text-sm font-normal text-slate-400">
              /{report.totalTasks}
            </span>
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <ClipboardCheck className="w-3.5 h-3.5 text-violet-600" />
            Evaluaciones rendidas
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
            {report.evaluationsTaken}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            Promedio real
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
            {report.averageGrade !== null ? report.averageGrade : '—'}
          </p>
          <p className="text-[11px] text-slate-400">
            {report.gradedEvaluationsCount > 0
              ? `En ${report.gradedEvaluationsCount} notas`
              : 'Sin calificaciones aún'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 col-span-2 lg:col-span-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Horas de estudio
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold tabular-nums">
            {(report.totalStudyMinutes / 60).toFixed(1)} h
          </p>
          <p className="text-[11px] text-slate-400 tabular-nums">
            {report.totalStudyMinutes} min registrados
          </p>
        </div>
      </section>

      {!hasAnyData ? (
        <section className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <BarChart3 className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            Todavía no hay datos suficientes para graficar tu avance
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            A medida que agregues materias, completes temas o tareas, registres calificaciones o uses el temporizador Pomodoro, tus estadísticas reales aparecerán automáticamente aquí.
          </p>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Per-Subject Real Progress Chart */}
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Avance real por estudio</h2>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                Global:{' '}
                {report.overallCompletionPercent !== null
                  ? `${report.overallCompletionPercent}%`
                  : 'Sin ítems aún'}
              </span>
            </div>

            {report.perSubject.length === 0 ? (
              <p className="text-xs text-slate-500">
                Agregá materias o cursos en «Mis estudios» para ver su progreso individual.
              </p>
            ) : (
              <div className="space-y-3.5">
                {report.perSubject.map((row) => (
                  <div key={row.subjectId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {row.name}
                      </span>
                      <span className="font-mono text-slate-500 tabular-nums shrink-0">
                        {row.completionPercent !== null
                          ? `${row.completionPercent}% (${row.completedItems}/${row.totalItems})`
                          : 'Sin temas/tareas cargados'}
                        {row.averageGrade !== null ? ` · Prom. ${row.averageGrade}` : ''}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${row.completionPercent ?? 0}%`,
                          backgroundColor: row.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Study Sessions History */}
          <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold">Sesiones registradas (Pomodoro)</h2>
            {pomodoroLogs.length === 0 ? (
              <p className="text-xs text-slate-500">
                Completá una sesión en Herramientas educativas → Temporizador Pomodoro para ver tu historial real de estudio.
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {pomodoroLogs.slice(0, 12).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{log.subject}</p>
                      <p className="text-[11px] text-slate-500">{log.completedAt}</p>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400 shrink-0">
                      {log.minutes} min
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
