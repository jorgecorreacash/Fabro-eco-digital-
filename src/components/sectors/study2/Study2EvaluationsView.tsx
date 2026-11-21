import React, { useMemo, useState } from 'react';
import {
  CalendarCheck,
  ClipboardCheck,
  Edit3,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useStudy2 } from '../../../context/Study2Context';
import { getTodayLocalDateKey } from '../../../services/unifiedCalendarService';
import type { StudyEvaluation } from '../../../types/study2';

const KIND_LABELS: Record<StudyEvaluation['kind'], string> = {
  parcial: 'Parcial',
  final: 'Final',
  recuperatorio: 'Recuperatorio',
  tp_evaluado: 'TP evaluado',
  oral: 'Examen oral',
  cuestionario: 'Cuestionario',
};

const STATUS_LABELS: Record<StudyEvaluation['status'], string> = {
  programada: 'Programada',
  rendida: 'Rendida',
  aprobada: 'Aprobada',
  desaprobada: 'Desaprobada',
  ausente: 'Ausente',
};

interface EvalDraft {
  editingId: string | null;
  subjectId: string;
  title: string;
  kind: StudyEvaluation['kind'];
  dateKey: string;
  startTime: string;
  topicsText: string;
  status: StudyEvaluation['status'];
  gradeText: string;
  maxGrade: number;
  observations: string;
}

export const Study2EvaluationsView: React.FC = () => {
  const { snapshot, createEvaluation, updateEvaluation, deleteEvaluation } = useStudy2();
  const todayKey = getTodayLocalDateKey();

  const [filterMode, setFilterMode] = useState<'todas' | 'proximas' | 'historial'>('todas');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<EvalDraft>({
    editingId: null,
    subjectId: snapshot.subjects[0]?.id || '',
    title: '',
    kind: 'parcial',
    dateKey: todayKey,
    startTime: '09:00',
    topicsText: '',
    status: 'programada',
    gradeText: '',
    maxGrade: 10,
    observations: '',
  });

  const subjectMap = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.id, s])),
    [snapshot.subjects]
  );

  const filteredEvals = useMemo(() => {
    return snapshot.evaluations
      .filter((ev) => {
        if (subjectFilter && ev.subjectId !== subjectFilter) return false;
        if (filterMode === 'proximas') {
          return ev.status === 'programada' && ev.dateKey >= todayKey;
        }
        if (filterMode === 'historial') {
          return ev.status !== 'programada' || ev.dateKey < todayKey;
        }
        return true;
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [filterMode, snapshot.evaluations, subjectFilter, todayKey]);

  const openNewModal = () => {
    setDraft({
      editingId: null,
      subjectId: snapshot.subjects[0]?.id || '',
      title: '',
      kind: 'parcial',
      dateKey: todayKey,
      startTime: '09:00',
      topicsText: '',
      status: 'programada',
      gradeText: '',
      maxGrade: 10,
      observations: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (ev: StudyEvaluation) => {
    setDraft({
      editingId: ev.id,
      subjectId: ev.subjectId,
      title: ev.title,
      kind: ev.kind,
      dateKey: ev.dateKey,
      startTime: ev.startTime || '09:00',
      topicsText: ev.topics.join(', '),
      status: ev.status,
      gradeText: typeof ev.grade === 'number' ? String(ev.grade) : '',
      maxGrade: ev.maxGrade || 10,
      observations: ev.observations || '',
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const parsedGrade =
      draft.gradeText.trim() !== '' && Number.isFinite(Number(draft.gradeText.replace(',', '.')))
        ? Number(draft.gradeText.replace(',', '.'))
        : null;
    const topics = draft.topicsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      subjectId: draft.subjectId,
      title: draft.title.trim(),
      kind: draft.kind,
      dateKey: draft.dateKey,
      startTime: draft.startTime || '09:00',
      topics,
      status: draft.status,
      grade: parsedGrade,
      maxGrade: Math.max(1, Number(draft.maxGrade) || 10),
      observations: draft.observations.trim(),
    };

    if (draft.editingId) {
      updateEvaluation(draft.editingId, payload);
    } else {
      createEvaluation(payload);
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Evaluaciones
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Registrá parciales, finales, trabajos evaluados y calificaciones. Cada fecha se sincroniza automáticamente con tu Calendario.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewModal}
          className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 text-xs font-bold cursor-pointer whitespace-nowrap self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva evaluación</span>
        </button>
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
          {(
            [
              { id: 'todas', label: `Todas (${snapshot.evaluations.length})` },
              { id: 'proximas', label: 'Próximas' },
              { id: 'historial', label: 'Historial' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {snapshot.subjects.length > 0 && (
          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium"
          >
            <option value="">Todas las materias</option>
            {snapshot.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {filteredEvals.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-2">
          <ClipboardCheck className="w-8 h-8 text-violet-600 mx-auto" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            No hay evaluaciones registradas en esta vista
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Cargá tus próximos parciales o notas anteriores; el sistema actualiza tu calendario y tu promedio real sin duplicar eventos.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {filteredEvals.map((ev) => {
            const sub = subjectMap.get(ev.subjectId);
            return (
              <article
                key={ev.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {sub && (
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: sub.color }}
                        />
                        {sub.name}
                      </span>
                    )}
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-400 font-medium">
                      {KIND_LABELS[ev.kind]}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      {ev.dateKey} {ev.startTime}
                    </span>
                  </div>

                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {ev.title}
                  </h2>

                  {ev.topics.length > 0 && (
                    <p className="text-xs text-slate-500">
                      Temas: {ev.topics.join(' · ')}
                    </p>
                  )}
                  {ev.observations && (
                    <p className="text-xs text-slate-500">{ev.observations}</p>
                  )}
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                    <CalendarCheck className="w-3.5 h-3.5" />
                    Sincronizado con Calendario
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-slate-500">
                      {STATUS_LABELS[ev.status]}
                    </p>
                    <p className="font-mono text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {typeof ev.grade === 'number' ? `${ev.grade}/${ev.maxGrade}` : '—'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditModal(ev)}
                    aria-label="Editar evaluación"
                    className="min-h-[36px] min-w-[36px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEvaluation(ev.id)}
                    aria-label="Eliminar evaluación"
                    className="min-h-[36px] min-w-[36px] rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Registrar evaluación"
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {draft.editingId ? 'Editar evaluación' : 'Nueva evaluación'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1 text-xs">
                <span className="font-semibold">Título *</span>
                <input
                  type="text"
                  required
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Ej. Primer Parcial, Final Regular, Defensa oral..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Materia o curso</span>
                  <select
                    value={draft.subjectId}
                    onChange={(e) => setDraft((d) => ({ ...d, subjectId: e.target.value }))}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
                  >
                    <option value="">Sin materia asignada</option>
                    {snapshot.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Tipo</span>
                  <select
                    value={draft.kind}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        kind: e.target.value as StudyEvaluation['kind'],
                      }))
                    }
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
                  >
                    {(Object.keys(KIND_LABELS) as StudyEvaluation['kind'][]).map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Fecha</span>
                  <input
                    type="date"
                    required
                    value={draft.dateKey}
                    onChange={(e) => setDraft((d) => ({ ...d, dateKey: e.target.value }))}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-mono"
                  />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Horario</span>
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-mono"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Estado</span>
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        status: e.target.value as StudyEvaluation['status'],
                      }))
                    }
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
                  >
                    {(Object.keys(STATUS_LABELS) as StudyEvaluation['status'][]).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Calificación (opcional)</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={draft.gradeText}
                    onChange={(e) => setDraft((d) => ({ ...d, gradeText: e.target.value }))}
                    placeholder="Ej. 8.5"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-mono"
                  />
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Escala máx.</span>
                  <input
                    type="number"
                    min="1"
                    value={draft.maxGrade}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, maxGrade: Number(e.target.value) || 10 }))
                    }
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-mono"
                  />
                </label>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="font-semibold">Temas incluidos (separados por coma)</span>
                <input
                  type="text"
                  value={draft.topicsText}
                  onChange={(e) => setDraft((d) => ({ ...d, topicsText: e.target.value }))}
                  placeholder="Unidad 1, Unidad 2, Fallo Marbury..."
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                />
              </label>

              <label className="block space-y-1 text-xs">
                <span className="font-semibold">Observaciones</span>
                <textarea
                  rows={2}
                  value={draft.observations}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, observations: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-5 text-xs font-bold cursor-pointer"
              >
                Guardar y sincronizar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
