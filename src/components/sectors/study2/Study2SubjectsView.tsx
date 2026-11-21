import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookMarked,
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Code,
  Edit3,
  FileText,
  FlaskConical,
  FolderOpen,
  Globe,
  GraduationCap,
  Landmark,
  Layers,
  Palette,
  Plus,
  Scale,
  Sparkles,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useStudy2 } from '../../../context/Study2Context';
import { CALENDAR_PRESET_SWATCHES } from '../../../services/unifiedCalendarService';
import type {
  StudySubject,
  StudySubjectIconId,
  StudySubjectKind,
} from '../../../types/study2';
import { UnifiedShiftCalendar } from './UnifiedShiftCalendar';

const SUBJECT_KIND_LABELS: Record<StudySubjectKind, string> = {
  materia_universitaria: 'Materia universitaria',
  materia_secundaria: 'Materia secundaria',
  carrera: 'Carrera',
  curso: 'Curso',
  diplomatura: 'Diplomatura',
  capacitacion: 'Capacitación',
  seminario: 'Seminario',
  taller: 'Taller',
  investigacion: 'Investigación',
  autodidacta: 'Estudio autodidacta',
  otro: 'Otro (personalizado)',
};

const SUBJECT_ICONS: Array<{
  id: StudySubjectIconId;
  label: string;
  Icon: React.FC<{ className?: string }>;
}> = [
  { id: 'book', label: 'Libro', Icon: BookOpen },
  { id: 'graduation', label: 'Académico', Icon: GraduationCap },
  { id: 'flask', label: 'Ciencias', Icon: FlaskConical },
  { id: 'scale', label: 'Derecho', Icon: Scale },
  { id: 'code', label: 'Tecnología', Icon: Code },
  { id: 'globe', label: 'Sociales', Icon: Globe },
  { id: 'calculator', label: 'Exactas', Icon: Calculator },
  { id: 'stethoscope', label: 'Salud', Icon: Stethoscope },
  { id: 'landmark', label: 'Historia', Icon: Landmark },
  { id: 'palette', label: 'Arte', Icon: Palette },
  { id: 'briefcase', label: 'Profesional', Icon: Briefcase },
  { id: 'layers', label: 'General', Icon: Layers },
];

export function renderSubjectIcon(iconId: StudySubjectIconId, className = 'w-4 h-4') {
  const found = SUBJECT_ICONS.find((i) => i.id === iconId) || SUBJECT_ICONS[0];
  const IconComp = found.Icon;
  return <IconComp className={className} />;
}

type WorkspaceTab =
  | 'programa'
  | 'unidades'
  | 'bibliografia'
  | 'apuntes'
  | 'documentos'
  | 'tareas'
  | 'evaluaciones'
  | 'calendario';

interface SubjectFormDraft {
  editingId: string | null;
  name: string;
  kind: StudySubjectKind;
  customCategory: string;
  institution: string;
  professor: string;
  period: string;
  description: string;
  syllabus: string;
  color: string;
  icon: StudySubjectIconId;
}

const EMPTY_FORM: SubjectFormDraft = {
  editingId: null,
  name: '',
  kind: 'materia_universitaria',
  customCategory: '',
  institution: '',
  professor: '',
  period: '',
  description: '',
  syllabus: '',
  color: '#2563EB',
  icon: 'book',
};

export const Study2SubjectsView: React.FC = () => {
  const { advancedNotes, createAdvancedNote } = useEcosystem();
  const {
    snapshot,
    selectedSubjectId,
    setSelectedSubjectId,
    setActiveNav,
    createSubject,
    updateSubject,
    deleteSubject,
    toggleArchiveSubject,
    moveSubjectOrder,
    addSubjectUnit,
    deleteSubjectUnit,
    addUnitTopic,
    toggleUnitTopic,
    deleteUnitTopic,
    createTask,
    toggleTask,
    deleteTask,
    addBibliographyItem,
    deleteBibliographyItem,
    uploadLibraryFile,
    deleteLibraryFile,
    createEvaluation,
    updateNoteMeta,
    sendToFabroAi,
  } = useStudy2();

  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<SubjectFormDraft>(EMPTY_FORM);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('unidades');

  // Inline sub-forms inside subject workspace
  const [unitTitle, setUnitTitle] = useState('');
  const [topicDraftByUnit, setTopicDraftByUnit] = useState<Record<string, string>>({});
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [bibTitle, setBibTitle] = useState('');
  const [bibAuthor, setBibAuthor] = useState('');
  const [bibYear, setBibYear] = useState('');
  const [bibUrl, setBibUrl] = useState('');
  const [evalTitle, setEvalTitle] = useState('');
  const [evalDate, setEvalDate] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);

  const visibleSubjects = useMemo(
    () =>
      snapshot.subjects
        .filter((s) => (showArchived ? s.archived : !s.archived))
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [showArchived, snapshot.subjects]
  );

  const archivedCount = useMemo(
    () => snapshot.subjects.filter((s) => s.archived).length,
    [snapshot.subjects]
  );

  const selectedSubject = useMemo(
    () => snapshot.subjects.find((s) => s.id === selectedSubjectId) || null,
    [selectedSubjectId, snapshot.subjects]
  );

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (sub: StudySubject) => {
    setForm({
      editingId: sub.id,
      name: sub.name,
      kind: sub.kind,
      customCategory: sub.customCategory || '',
      institution: sub.institution || '',
      professor: sub.professor || '',
      period: sub.period || '',
      description: sub.description || '',
      syllabus: sub.syllabus || '',
      color: sub.color,
      icon: sub.icon,
    });
    setModalOpen(true);
  };

  const handleSubmitSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (form.editingId) {
      updateSubject(form.editingId, {
        name: form.name.trim(),
        kind: form.kind,
        customCategory: form.customCategory.trim() || undefined,
        institution: form.institution.trim() || undefined,
        professor: form.professor.trim() || undefined,
        period: form.period.trim() || undefined,
        description: form.description.trim() || undefined,
        syllabus: form.syllabus.trim() || undefined,
        color: form.color,
        icon: form.icon,
      });
    } else {
      const created = createSubject({
        name: form.name.trim(),
        kind: form.kind,
        customCategory: form.customCategory.trim() || undefined,
        institution: form.institution.trim() || undefined,
        professor: form.professor.trim() || undefined,
        period: form.period.trim() || undefined,
        description: form.description.trim() || undefined,
        syllabus: form.syllabus.trim() || undefined,
        color: form.color,
        icon: form.icon,
      });
      setSelectedSubjectId(created.id);
    }
    setModalOpen(false);
  };

  // ------- SUBJECT WORKSPACE VIEW -------
  if (selectedSubject) {
    const subTasks = snapshot.tasks.filter((t) => t.subjectId === selectedSubject.id);
    const subBib = snapshot.bibliography.filter((b) => b.subjectId === selectedSubject.id);
    const subFiles = snapshot.libraryFiles.filter((f) => f.subjectId === selectedSubject.id);
    const subEvals = snapshot.evaluations.filter((e) => e.subjectId === selectedSubject.id);
    const subNotes = advancedNotes.filter((n) => {
      const meta = snapshot.noteMetadata[n.id];
      return (
        meta?.subjectId === selectedSubject.id ||
        n.subject.toLowerCase() === selectedSubject.name.toLowerCase()
      );
    });

    const allTopics = selectedSubject.units.flatMap((u) => u.topics);
    const doneTopics = allTopics.filter((t) => t.completed).length;
    const totalTrack = allTopics.length + subTasks.length;
    const doneTrack = doneTopics + subTasks.filter((t) => t.completed).length;
    const realPct = totalTrack > 0 ? Math.round((doneTrack / totalTrack) * 100) : null;

    return (
      <div className="space-y-5">
        {/* Top Breadcrumb + Subject Identity Card */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelectedSubjectId(null)}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver a Mis estudios
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  sendToFabroAi({
                    subjectId: selectedSubject.id,
                    mode: 'explicar_tema',
                    prompt: `Trabajemos sobre ${selectedSubject.name}.`,
                  })
                }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 text-xs font-bold cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Consultar a FABRO IA
              </button>
              <button
                type="button"
                onClick={() => openEditModal(selectedSubject)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Editar
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <span
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: selectedSubject.color }}
              >
                {renderSubjectIcon(selectedSubject.icon, 'w-5 h-5')}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {selectedSubject.customCategory || SUBJECT_KIND_LABELS[selectedSubject.kind]}
                  {selectedSubject.institution ? ` · ${selectedSubject.institution}` : ''}
                </p>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white truncate">
                  {selectedSubject.name}
                </h1>
                {(selectedSubject.professor || selectedSubject.period) && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {[selectedSubject.professor, selectedSubject.period]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
            </div>

            <div className="min-w-[160px] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Progreso real</span>
                <span className="font-mono font-bold tabular-nums">
                  {realPct !== null ? `${realPct}%` : 'Sin datos aún'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${realPct ?? 0}%`,
                    backgroundColor: selectedSubject.color,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Workspace Internal Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100 dark:border-slate-800">
            {(
              [
                { id: 'unidades', label: `Unidades y temas (${selectedSubject.units.length})` },
                { id: 'programa', label: 'Programa' },
                { id: 'apuntes', label: `Apuntes (${subNotes.length})` },
                { id: 'documentos', label: `Documentos (${subFiles.length})` },
                { id: 'tareas', label: `Actividades (${subTasks.length})` },
                { id: 'evaluaciones', label: `Evaluaciones (${subEvals.length})` },
                { id: 'bibliografia', label: `Bibliografía (${subBib.length})` },
                { id: 'calendario', label: 'Fechas' },
              ] as Array<{ id: WorkspaceTab; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setWorkspaceTab(t.id)}
                className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  workspaceTab === t.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* Tab 1: Units & Topics */}
        {workspaceTab === 'unidades' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!unitTitle.trim()) return;
                addSubjectUnit(selectedSubject.id, unitTitle);
                setUnitTitle('');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={unitTitle}
                onChange={(e) => setUnitTitle(e.target.value)}
                placeholder="Agregar unidad o módulo (ej. Unidad 1: Fundamentos)..."
                className="flex-1 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
              />
              <button
                type="submit"
                className="min-h-[42px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                + Agregar unidad
              </button>
            </form>

            {selectedSubject.units.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                Agregá unidades y temas para llevar un seguimiento real de tu avance.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedSubject.units.map((unit) => {
                  const unitDone = unit.topics.filter((t) => t.completed).length;
                  return (
                    <div
                      key={unit.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {unit.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {unitDone} de {unit.topics.length} temas completados
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteSubjectUnit(selectedSubject.id, unit.id)}
                          aria-label={`Eliminar ${unit.title}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {unit.topics.map((topic) => (
                          <div
                            key={topic.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                toggleUnitTopic(selectedSubject.id, unit.id, topic.id)
                              }
                              className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
                            >
                              {topic.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              <span
                                className={`text-xs ${
                                  topic.completed
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800 dark:text-slate-200 font-medium'
                                }`}
                              >
                                {topic.title}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                deleteUnitTopic(selectedSubject.id, unit.id, topic.id)
                              }
                              aria-label="Quitar tema"
                              className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const val = (topicDraftByUnit[unit.id] || '').trim();
                          if (!val) return;
                          addUnitTopic(selectedSubject.id, unit.id, val);
                          setTopicDraftByUnit((prev) => ({ ...prev, [unit.id]: '' }));
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          value={topicDraftByUnit[unit.id] || ''}
                          onChange={(e) =>
                            setTopicDraftByUnit((prev) => ({
                              ...prev,
                              [unit.id]: e.target.value,
                            }))
                          }
                          placeholder="Nuevo tema dentro de esta unidad..."
                          className="flex-1 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold cursor-pointer"
                        >
                          Agregar tema
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Syllabus / Programa */}
        {workspaceTab === 'programa' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h2 className="text-sm font-bold">Programa y objetivos de cursada</h2>
            <textarea
              rows={10}
              value={selectedSubject.syllabus || ''}
              onChange={(e) =>
                updateSubject(selectedSubject.id, { syllabus: e.target.value })
              }
              placeholder="Pegá o redactá aquí el programa oficial, criterios de evaluación, modalidad de cursada y objetivos. FABRO IA utilizará este programa como contexto al estudiar esta materia."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 p-3.5 text-sm leading-relaxed"
            />
          </section>
        )}

        {/* Tab 3: Notes linked to Subject */}
        {workspaceTab === 'apuntes' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Apuntes de {selectedSubject.name}</h2>
              <button
                type="button"
                onClick={() => {
                  const created = createAdvancedNote({
                    title: `Apunte de ${selectedSubject.name}`,
                    subject: selectedSubject.name,
                    folder: selectedSubject.name,
                  });
                  updateNoteMeta(created.id, { subjectId: selectedSubject.id });
                  setActiveNav('mis-apuntes');
                }}
                className="min-h-[36px] rounded-xl bg-blue-600 text-white px-3 text-xs font-bold cursor-pointer"
              >
                + Nuevo apunte aquí
              </button>
            </div>
            {subNotes.length === 0 ? (
              <p className="text-xs text-slate-500">
                Todavía no hay apuntes vinculados a esta materia.
              </p>
            ) : (
              <div className="space-y-2">
                {subNotes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setActiveNav('mis-apuntes')}
                    className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{n.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{n.updatedAt}</p>
                    </div>
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 4: Documents / Real Files */}
        {workspaceTab === 'documentos' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">Documentos y PDFs de la materia</h2>
              <label className="min-h-[38px] inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 text-xs font-bold cursor-pointer">
                <FolderOpen className="w-4 h-4" />
                <span>{uploadingFile ? 'Procesando...' : 'Subir archivo real'}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.csv,image/*"
                  disabled={uploadingFile}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingFile(true);
                    try {
                      await uploadLibraryFile(file, { subjectId: selectedSubject.id });
                    } finally {
                      setUploadingFile(false);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
            {subFiles.length === 0 ? (
              <p className="text-xs text-slate-500">
                Subí PDFs, Word, textos o imágenes de esta materia; quedan guardados en tu Biblioteca y disponibles para FABRO IA.
              </p>
            ) : (
              <div className="space-y-2">
                {subFiles.map((file) => (
                  <div
                    key={file.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{file.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {file.extractionNote || 'Guardado en biblioteca'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          sendToFabroAi({
                            subjectId: selectedSubject.id,
                            fileIds: [file.id],
                            mode: 'resumir_documento',
                            prompt: `Resumí y analizá el documento "${file.name}".`,
                          })
                        }
                        className="min-h-[32px] px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold cursor-pointer"
                      >
                        Analizar en IA
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteLibraryFile(file.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        aria-label="Eliminar archivo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Tab 5: Tasks */}
        {workspaceTab === 'tareas' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!taskTitle.trim()) return;
                createTask({
                  subjectId: selectedSubject.id,
                  title: taskTitle.trim(),
                  dueDate: taskDue || undefined,
                  priority: 'media',
                });
                setTaskTitle('');
                setTaskDue('');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Nueva actividad, TP o entrega..."
                className="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
              <input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-mono"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 text-xs font-bold cursor-pointer"
              >
                Agregar
              </button>
            </form>
            <div className="space-y-2">
              {subTasks.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(t.id)}
                    className="flex items-center gap-2 text-left cursor-pointer flex-1 min-w-0"
                  >
                    {t.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={`text-xs ${
                        t.completed ? 'line-through text-slate-400' : 'font-semibold'
                      }`}
                    >
                      {t.title}
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    {t.dueDate && (
                      <span className="text-[11px] font-mono text-slate-500">{t.dueDate}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteTask(t.id)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tab 6: Evaluations linked to Subject */}
        {workspaceTab === 'evaluaciones' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!evalTitle.trim() || !evalDate) return;
                createEvaluation({
                  subjectId: selectedSubject.id,
                  title: evalTitle.trim(),
                  kind: 'parcial',
                  dateKey: evalDate,
                  startTime: '09:00',
                  topics: [],
                  status: 'programada',
                  grade: null,
                  maxGrade: 10,
                  observations: '',
                });
                setEvalTitle('');
                setEvalDate('');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                value={evalTitle}
                onChange={(e) => setEvalTitle(e.target.value)}
                placeholder="Ej. Primer Parcial, Final, Coloquio..."
                className="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
              <input
                type="date"
                required
                value={evalDate}
                onChange={(e) => setEvalDate(e.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-mono"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-violet-600 text-white px-4 text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                + Agendar evaluación
              </button>
            </form>
            <div className="space-y-2">
              {subEvals.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Las evaluaciones que cargues aquí se sincronizan automáticamente con tu Calendario.
                </p>
              ) : (
                subEvals.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold">{ev.title}</p>
                      <p className="text-[11px] font-mono text-slate-500">
                        {ev.dateKey} · {ev.status}
                        {typeof ev.grade === 'number' ? ` · Nota: ${ev.grade}/${ev.maxGrade}` : ''}
                      </p>
                    </div>
                    <ClipboardCheck className="w-4 h-4 text-violet-600 shrink-0" />
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Tab 7: Bibliography */}
        {workspaceTab === 'bibliografia' && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!bibTitle.trim()) return;
                addBibliographyItem({
                  subjectId: selectedSubject.id,
                  title: bibTitle.trim(),
                  author: bibAuthor.trim() || 'Autor no especificado',
                  year: bibYear.trim() || 's. f.',
                  url: bibUrl.trim() || undefined,
                  kind: 'libro',
                });
                setBibTitle('');
                setBibAuthor('');
                setBibYear('');
                setBibUrl('');
              }}
              className="grid grid-cols-1 sm:grid-cols-4 gap-2"
            >
              <input
                type="text"
                value={bibTitle}
                onChange={(e) => setBibTitle(e.target.value)}
                placeholder="Título del libro o artículo *"
                className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
              <input
                type="text"
                value={bibAuthor}
                onChange={(e) => setBibAuthor(e.target.value)}
                placeholder="Autor/es"
                className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
              <input
                type="text"
                value={bibYear}
                onChange={(e) => setBibYear(e.target.value)}
                placeholder="Año"
                className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
              <input
                type="url"
                value={bibUrl}
                onChange={(e) => setBibUrl(e.target.value)}
                placeholder="Enlace o DOI (opcional)"
                className="sm:col-span-3 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
              />
              <button
                type="submit"
                className="min-h-[38px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3 text-xs font-bold cursor-pointer"
              >
                Agregar fuente
              </button>
            </form>

            <div className="space-y-2">
              {subBib.map((b) => (
                <div
                  key={b.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold">{b.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {b.author} ({b.year})
                    </p>
                    {b.url && (
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline break-all"
                      >
                        {b.url}
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteBibliographyItem(b.id)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tab 8: Subject-filtered Unified Calendar */}
        {workspaceTab === 'calendario' && (
          <UnifiedShiftCalendar
            contextLabel={`Calendario · ${selectedSubject.name}`}
            fixedSubjectId={selectedSubject.id}
            initialDomain="academico"
          />
        )}
      </div>
    );
  }

  // ------- MAIN SUBJECTS LIST / EMPTY STATE -------
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Mis estudios
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Creá y organizá materias, carreras, cursos, capacitaciones o proyectos de investigación a tu manera.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-xs font-semibold cursor-pointer"
            >
              {showArchived ? 'Ver activos' : `Archivados (${archivedCount})`}
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 text-xs font-bold cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar estudio</span>
          </button>
        </div>
      </section>

      {visibleSubjects.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <BookMarked className="w-6 h-6" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {showArchived
                ? 'No tenés estudios archivados'
                : 'Comenzá a organizar tus estudios. Agregá tu primera materia, curso o capacitación'}
            </h2>
            {!showArchived && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cada estudio cuenta con su propio espacio para programa, unidades, apuntes, documentos, tareas, evaluaciones y consultas con FABRO IA.
              </p>
            )}
          </div>
          {!showArchived && (
            <button
              type="button"
              onClick={openCreateModal}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Crear mi primer estudio</span>
            </button>
          )}
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleSubjects.map((sub, idx) => {
            const totalTopics = sub.units.reduce((acc, u) => acc + u.topics.length, 0);
            const doneTopics = sub.units.reduce(
              (acc, u) => acc + u.topics.filter((t) => t.completed).length,
              0
            );
            const pct = totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : null;

            return (
              <article
                key={sub.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className="space-y-3 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: sub.color }}
                      >
                        {renderSubjectIcon(sub.icon, 'w-5 h-5')}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-500">
                          {sub.customCategory || SUBJECT_KIND_LABELS[sub.kind]}
                        </p>
                        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                          {sub.name}
                        </h2>
                        {sub.institution && (
                          <p className="text-xs text-slate-500 truncate">{sub.institution}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {sub.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {sub.description}
                    </p>
                  )}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        {sub.units.length} unidades · {totalTopics} temas
                      </span>
                      <span className="font-mono tabular-nums">
                        {pct !== null ? `${pct}%` : 'Sin temas aún'}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct ?? 0}%`, backgroundColor: sub.color }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectId(sub.id)}
                    className="min-h-[34px] px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
                  >
                    Abrir espacio
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSubjectOrder(sub.id, 'up')}
                      aria-label="Mover arriba"
                      className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === visibleSubjects.length - 1}
                      onClick={() => moveSubjectOrder(sub.id, 'down')}
                      aria-label="Mover abajo"
                      className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(sub)}
                      aria-label="Editar estudio"
                      className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleArchiveSubject(sub.id)}
                      aria-label={sub.archived ? 'Desarchivar' : 'Archivar'}
                      className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
                    >
                      {sub.archived ? (
                        <ArchiveRestore className="w-3.5 h-3.5" />
                      ) : (
                        <Archive className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSubject(sub.id)}
                      aria-label="Eliminar estudio"
                      className="min-h-[32px] min-w-[32px] rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit Subject Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={form.editingId ? 'Editar estudio' : 'Nuevo estudio'}
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSubmitSubject}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">
                {form.editingId ? 'Editar estudio' : 'Agregar materia, curso o capacitación'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar"
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block space-y-1 text-xs">
                <span className="font-semibold">Nombre *</span>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej. Derecho Constitucional, Curso de Python, Anatomía..."
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Tipo de estudio</span>
                  <select
                    value={form.kind}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, kind: e.target.value as StudySubjectKind }))
                    }
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
                  >
                    {(Object.keys(SUBJECT_KIND_LABELS) as StudySubjectKind[]).map((k) => (
                      <option key={k} value={k}>
                        {SUBJECT_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Categoría propia (opcional)</span>
                  <input
                    type="text"
                    value={form.customCategory}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, customCategory: e.target.value }))
                    }
                    placeholder="Ej. 2° Cuatrimestre, Posgrado..."
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Institución (opcional)</span>
                  <input
                    type="text"
                    value={form.institution}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, institution: e.target.value }))
                    }
                    placeholder="Universidad, instituto o plataforma"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                  />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold">Docente / cátedra (opcional)</span>
                  <input
                    type="text"
                    value={form.professor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, professor: e.target.value }))
                    }
                    placeholder="Nombre del docente o instructor"
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
                  />
                </label>
              </div>

              <label className="block space-y-1 text-xs">
                <span className="font-semibold">Descripción breve (opcional)</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs"
                />
              </label>

              {/* Color Picker */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold">Color identificador</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CALENDAR_PRESET_SWATCHES.slice(0, 10).map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color: hex }))}
                      style={{ backgroundColor: hex }}
                      aria-label={`Color ${hex}`}
                      className={`w-7 h-7 rounded-lg cursor-pointer ${
                        form.color === hex
                          ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-2'
                          : ''
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    aria-label="Color libre"
                    className="w-7 h-7 rounded-lg border border-slate-300 cursor-pointer"
                  />
                </div>
              </div>

              {/* Icon Picker */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold">Ícono</span>
                <div className="grid grid-cols-6 gap-1.5">
                  {SUBJECT_ICONS.map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      title={label}
                      onClick={() => setForm((f) => ({ ...f, icon: id }))}
                      className={`min-h-[38px] rounded-xl border flex items-center justify-center cursor-pointer ${
                        form.icon === id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 text-xs font-bold cursor-pointer"
              >
                {form.editingId ? 'Guardar cambios' : 'Crear estudio'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
