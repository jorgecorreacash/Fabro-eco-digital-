import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  FileText,
  FileUp,
  FolderKanban,
  GitBranch,
  Globe,
  GraduationCap,
  History,
  Layers,
  Lightbulb,
  Loader2,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { authFetch } from '../../lib/apiClient';
import { markdownToHtml } from '../../lib/exporters';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';
import {
  EDUCATION_LEVEL_OPTIONS,
  type EducationLevel,
  type Subject,
  type SubjectAISource,
} from '../../types/fabro';
import { AudioReadAloudControl } from '../common/AudioReadAloudControl';
import { VisualStudyStudioModal, type VisualStudyKind } from './VisualStudyStudioModal';
import { AIReadingModeModal } from './AIReadingModeModal';

const SUBJECT_COLORS = [
  '#0284C7',
  '#2563EB',
  '#059669',
  '#D97706',
  '#DC2626',
  '#0891B2',
  '#4F46E5',
  '#0D9488',
];

export const SubjectsView: React.FC = () => {
  const {
    subjects,
    notes,
    libraryDocs,
    exams,
    calendarEvents,
    selectedSubjectId,
    setSelectedSubjectId,
    setActiveSection,
    setAiDraftPrompt,
    createSubject,
    updateSubject,
    uploadSubjectSyllabusFile,
    deleteSubject,
    createNote,
    profile,
  } = useFabro();

  const [showForm, setShowForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [level, setLevel] = useState<EducationLevel>(profile?.educationLevel || 'universitario');
  const [career, setCareer] = useState('');
  const [professor, setProfessor] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#0284C7');
  const [syllabus, setSyllabus] = useState('');
  const [bibliography, setBibliography] = useState('');
  const [unitsText, setUnitsText] = useState('');
  const [pendingSyllabusFile, setPendingSyllabusFile] = useState<File | null>(null);
  const [clearAttachedSyllabus, setClearAttachedSyllabus] = useState(false);

  // Workspace syllabus & AI Multi-source Research state
  const workspaceSyllabusInputRef = useRef<HTMLInputElement | null>(null);
  const modalSyllabusInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);
  const [syllabusStatusMsg, setSyllabusStatusMsg] = useState('');
  const [showExtractedPreview, setShowExtractedPreview] = useState(false);

  const [researchFocus, setResearchFocus] = useState('');
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState('');
  const [researchMetaBySubject, setResearchMetaBySubject] = useState<
    Record<
      string,
      {
        searchQueries: string[];
        suggestedUnits: string[];
        suggestedBibliography: string[];
        webFallbackUsed: boolean;
      }
    >
  >({});
  const [savedNoteFeedback, setSavedNoteFeedback] = useState(false);
  const [importedUnitsFeedback, setImportedUnitsFeedback] = useState(false);
  const [addedBibUrls, setAddedBibUrls] = useState<Record<string, boolean>>({});
  const [generatingUnit, setGeneratingUnit] = useState<string | null>(null);
  const [unitNotesNotice, setUnitNotesNotice] = useState('');
  const [unitNotesError, setUnitNotesError] = useState('');
  const [visualModal, setVisualModal] = useState<{
    open: boolean;
    kind: VisualStudyKind;
    topic: string;
    context: string;
  }>({ open: false, kind: 'esquema', topic: '', context: '' });
  const [readingModeOpen, setReadingModeOpen] = useState(false);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || null,
    [subjects, selectedSubjectId]
  );

  const openCreate = () => {
    setEditingSubject(null);
    setFormError('');
    setName('');
    setInstitution(profile?.institution || '');
    setLevel(profile?.educationLevel || 'universitario');
    setCareer(profile?.career || '');
    setProfessor('');
    setDescription('');
    setColor('#0284C7');
    setSyllabus('');
    setBibliography('');
    setUnitsText('Unidad 1: Introducción y fundamentos\nUnidad 2: Desarrollo conceptual');
    setPendingSyllabusFile(null);
    setClearAttachedSyllabus(false);
    setShowForm(true);
  };

  const openEdit = (sub: Subject) => {
    setEditingSubject(sub);
    setFormError('');
    setName(sub.name);
    setInstitution(sub.institution || '');
    setLevel(sub.level);
    setCareer(sub.career || '');
    setProfessor(sub.professor || '');
    setDescription(sub.description || '');
    setColor(sub.color);
    setSyllabus(sub.syllabus || '');
    setBibliography(sub.bibliography || '');
    setUnitsText(sub.units.join('\n'));
    setPendingSyllabusFile(null);
    setClearAttachedSyllabus(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Ingresá el nombre de la materia antes de guardar.');
      return;
    }
    setFormError('');
    setSaving(true);
    const units = unitsText
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, 40);

    try {
      if (editingSubject) {
        let syllabusAttachmentPatch: Partial<Subject> = {};
        if (pendingSyllabusFile) {
          syllabusAttachmentPatch = await uploadSubjectSyllabusFile(
            editingSubject.id,
            pendingSyllabusFile
          );
        } else if (clearAttachedSyllabus) {
          syllabusAttachmentPatch = {
            syllabusFileName: '',
            syllabusFileMime: '',
            syllabusFileUrl: '',
            syllabusExtractedText: '',
          };
        }

        await updateSubject(editingSubject.id, {
          name: name.trim(),
          institution,
          level,
          career,
          professor,
          description,
          color,
          syllabus,
          bibliography,
          units,
          ...syllabusAttachmentPatch,
        });
      } else {
        const newId = await createSubject({
          name: name.trim(),
          institution,
          level,
          career,
          professor,
          description,
          color,
          syllabus,
          bibliography,
          units,
          progressPercent: 0,
        });

        if (pendingSyllabusFile) {
          const uploaded = await uploadSubjectSyllabusFile(newId, pendingSyllabusFile);
          await updateSubject(newId, uploaded);
        }
        setSelectedSubjectId(newId);
      }
      setShowForm(false);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? 'No se pudo guardar la materia. Verificá tu conexión e intentá nuevamente.'
          : 'Ocurrió un error al guardar la materia.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sub: Subject) => {
    await deleteSubject(sub.id);
    if (selectedSubjectId === sub.id) {
      setSelectedSubjectId(null);
    }
  };

  const handleWorkspaceSyllabusUpload = async (file: File) => {
    if (!activeSubject) return;
    setUploadingSyllabus(true);
    setSyllabusStatusMsg('');
    try {
      const result = await uploadSubjectSyllabusFile(activeSubject.id, file);
      await updateSubject(activeSubject.id, result);
      setSyllabusStatusMsg(
        result.syllabusExtractedText
          ? `Programa "${result.syllabusFileName}" adjuntado y leído (${result.syllabusExtractedText.length} caracteres).`
          : `Archivo "${result.syllabusFileName}" adjuntado correctamente.`
      );
    } catch {
      setSyllabusStatusMsg('No se pudo procesar el archivo del programa. Intentá con otro PDF, imagen o TXT.');
    } finally {
      setUploadingSyllabus(false);
      if (workspaceSyllabusInputRef.current) {
        workspaceSyllabusInputRef.current.value = '';
      }
    }
  };

  const handleRemoveWorkspaceSyllabus = async () => {
    if (!activeSubject) return;
    await updateSubject(activeSubject.id, {
      syllabusFileName: '',
      syllabusFileMime: '',
      syllabusFileUrl: '',
      syllabusExtractedText: '',
    });
    setShowExtractedPreview(false);
    setSyllabusStatusMsg('Archivo del programa desvinculado.');
  };

  const handleRunSubjectResearch = async () => {
    if (!activeSubject) return;
    setResearching(true);
    setResearchError('');
    setSavedNoteFeedback(false);
    setImportedUnitsFeedback(false);

    const subNotes = notes.filter((n) => n.subjectId === activeSubject.id);
    const subDocs = libraryDocs.filter((d) => d.subjectId === activeSubject.id);
    const subExams = exams.filter((ex) => ex.subjectId === activeSubject.id);

    const notesSummary = subNotes
      .slice(0, 10)
      .map(
        (n) =>
          `• ${n.title} (${n.unit || n.folder || 'General'}): ${(n.contentText || '').slice(0, 900)}`
      )
      .join('\n');

    const docsSummary = subDocs
      .slice(0, 8)
      .map(
        (d) =>
          `• ${d.title} [${d.category}] (${d.fileName}): ${(d.extractedText || '').slice(0, 1200)}`
      )
      .join('\n');

    const weakTopics = Array.from(
      new Set(
        subExams.flatMap((ex) => (Array.isArray(ex.weakTopics) ? ex.weakTopics : [])).filter(Boolean)
      )
    );

    try {
      const resp = await authFetch('/api/ai/subject-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: {
            id: activeSubject.id,
            name: activeSubject.name,
            level: activeSubject.level,
            institution: activeSubject.institution,
            career: activeSubject.career,
            professor: activeSubject.professor,
            description: activeSubject.description,
            syllabus: activeSubject.syllabus,
            syllabusFileName: activeSubject.syllabusFileName,
            syllabusExtractedText: activeSubject.syllabusExtractedText,
            bibliography: activeSubject.bibliography,
            units: activeSubject.units,
          },
          notesSummary,
          docsSummary,
          weakTopics,
          educationLevel: profile?.educationLevel || activeSubject.level,
          customFocus: researchFocus.trim(),
        }),
      });

      const data = (await resp.json()) as {
        analysisMarkdown?: string;
        sources?: SubjectAISource[];
        searchQueries?: string[];
        suggestedUnits?: string[];
        suggestedBibliography?: string[];
        webFallbackUsed?: boolean;
        error?: string;
      };

      if (!resp.ok || !data.analysisMarkdown) {
        throw new Error(data.error || 'No se pudo completar el análisis inteligente de la materia.');
      }

      const cleanSources: SubjectAISource[] = Array.isArray(data.sources)
        ? data.sources
            .filter((s) => s && s.url && s.title)
            .slice(0, 16)
            .map((s) => ({
              title: String(s.title).slice(0, 200),
              url: String(s.url).slice(0, 2000),
              domain: String(s.domain || '').slice(0, 200),
              category: s.category ? String(s.category).slice(0, 80) : 'Fuente web',
            }))
        : [];

      setResearchMetaBySubject((prev) => ({
        ...prev,
        [activeSubject.id]: {
          searchQueries: Array.isArray(data.searchQueries) ? data.searchQueries : [],
          suggestedUnits: Array.isArray(data.suggestedUnits) ? data.suggestedUnits : [],
          suggestedBibliography: Array.isArray(data.suggestedBibliography)
            ? data.suggestedBibliography
            : [],
          webFallbackUsed: Boolean(data.webFallbackUsed),
        },
      }));

      await updateSubject(activeSubject.id, {
        aiAnalysisMarkdown: data.analysisMarkdown.slice(0, 60000),
        aiAnalysisSources: cleanSources,
      });
    } catch (err) {
      setResearchError(
        err instanceof Error
          ? err.message
          : 'No se pudo ejecutar el análisis y búsqueda multi-fuente.'
      );
    } finally {
      setResearching(false);
    }
  };

  const handleSaveAnalysisAsNote = async () => {
    if (!activeSubject || !activeSubject.aiAnalysisMarkdown) return;
    const sourcesBlock =
      activeSubject.aiAnalysisSources && activeSubject.aiAnalysisSources.length > 0
        ? `\n\n---\n\n### Fuentes consultadas (Modo IA)\n${activeSubject.aiAnalysisSources
            .map((s) => `- [${s.title}](${s.url}) (${s.domain})`)
            .join('\n')}`
        : '';
    const fullMarkdown = `${activeSubject.aiAnalysisMarkdown}${sourcesBlock}`;
    await createNote({
      subjectId: activeSubject.id,
      unit: 'Análisis integral',
      folder: 'Programa e Investigación IA',
      title: `Análisis Modo IA: ${activeSubject.name}`,
      contentHtml: markdownToHtml(fullMarkdown),
      contentText: fullMarkdown,
      tags: ['modo-ia', 'programa', 'fuentes'],
      attachments: [],
      offlineAvailable: true,
    });
    setSavedNoteFeedback(true);
    window.setTimeout(() => setSavedNoteFeedback(false), 3000);
  };

  const handleImportDetectedUnits = async (suggestedUnits: string[]) => {
    if (!activeSubject || suggestedUnits.length === 0) return;
    const existingLower = new Set(activeSubject.units.map((u) => u.trim().toLowerCase()));
    const merged = [...activeSubject.units];
    for (const unit of suggestedUnits) {
      const clean = unit.trim();
      if (clean && !existingLower.has(clean.toLowerCase())) {
        existingLower.add(clean.toLowerCase());
        merged.push(clean);
      }
    }
    await updateSubject(activeSubject.id, { units: merged.slice(0, 40) });
    setImportedUnitsFeedback(true);
    window.setTimeout(() => setImportedUnitsFeedback(false), 3000);
  };

  const handleAddSourceToBibliography = async (source: SubjectAISource) => {
    if (!activeSubject) return;
    const entry = `${source.title} — ${source.url}`;
    const current = (activeSubject.bibliography || '').trim();
    if (current.includes(source.url)) {
      setAddedBibUrls((prev) => ({ ...prev, [source.url]: true }));
      return;
    }
    const updated = current ? `${current}\n${entry}` : entry;
    await updateSubject(activeSubject.id, { bibliography: updated.slice(0, 5000) });
    setAddedBibUrls((prev) => ({ ...prev, [source.url]: true }));
  };

  const handleGenerateUnitTopicNotes = async (unitName: string) => {
    if (!activeSubject || generatingUnit) return;
    setGeneratingUnit(unitName);
    setUnitNotesError('');
    setUnitNotesNotice('');
    try {
      const syllabusContext = [
        activeSubject.syllabus || '',
        activeSubject.syllabusExtractedText || '',
        activeSubject.bibliography ? `Bibliografía: ${activeSubject.bibliography}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const resp = await authFetch('/api/ai/unit-topics-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName: activeSubject.name,
          unit: unitName,
          syllabusContext,
          educationLevel: profile?.educationLevel || activeSubject.level || 'universitario',
          aiProvider: 'auto',
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !Array.isArray(data.topics) || data.topics.length === 0) {
        throw new Error(data.error || 'No se pudieron generar apuntes separados por tema.');
      }

      for (const topicItem of data.topics) {
        const md = String(topicItem.markdownContent || '');
        const cleanTitle = String(topicItem.title || 'Tema de estudio').slice(0, 180);
        await createNote({
          subjectId: activeSubject.id,
          unit: unitName,
          folder: unitName,
          title: cleanTitle,
          contentHtml: markdownToHtml(md),
          contentText: md,
          tags: Array.isArray(topicItem.tags)
            ? [...topicItem.tags.slice(0, 6), 'tema-por-tema']
            : ['tema-por-tema'],
          attachments: [],
          offlineAvailable: true,
        });
      }

      setUnitNotesNotice(
        `Se crearon ${data.topics.length} apuntes separados por tema para "${unitName}" (disponibles en Apuntes).`
      );
    } catch (err) {
      setUnitNotesError(
        err instanceof Error ? err.message : 'No se pudieron desarrollar los temas por separado.'
      );
    } finally {
      setGeneratingUnit(null);
    }
  };

  // Dedicated Subject Workspace
  if (activeSubject) {
    const subNotes = notes.filter((n) => n.subjectId === activeSubject.id);
    const subDocs = libraryDocs.filter((d) => d.subjectId === activeSubject.id);
    const subExams = exams.filter((ex) => ex.subjectId === activeSubject.id);
    const subEvents = calendarEvents.filter((ev) => ev.subjectId === activeSubject.id);
    const weakTopicsCount = Array.from(
      new Set(subExams.flatMap((ex) => ex.weakTopics || []).filter(Boolean))
    ).length;

    const currentMeta = researchMetaBySubject[activeSubject.id];
    const analysisMarkdown = activeSubject.aiAnalysisMarkdown || '';
    const analysisSources = activeSubject.aiAnalysisSources || [];

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedSubjectId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a Mis materias
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEdit(activeSubject)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Editar materia
            </button>
            <button
              type="button"
              onClick={() => {
                setAiDraftPrompt(`Quiero estudiar sobre la materia ${activeSubject.name}. Ayudame a organizar los temas principales.`);
                setActiveSection('fabro-ai');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Estudiar con FABRO AI
            </button>
          </div>
        </div>

        {/* Subject Workspace Header */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <span
                className="w-3.5 h-12 rounded-full shrink-0 mt-0.5"
                style={{ backgroundColor: activeSubject.color }}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Nombre de la materia
                </p>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white break-words">
                  {activeSubject.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {[
                    activeSubject.institution,
                    activeSubject.career,
                    activeSubject.professor ? `Cátedra: ${activeSubject.professor}` : '',
                    activeSubject.level,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-center">
              <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Progreso:
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={activeSubject.progressPercent}
                onChange={(e) =>
                  void updateSubject(activeSubject.id, { progressPercent: Number(e.target.value) })
                }
                className="w-28 accent-sky-600 cursor-pointer"
              />
              <span className="font-mono text-xs font-semibold tabular-nums w-10 text-right">
                {activeSubject.progressPercent}%
              </span>
            </div>
          </div>

          {activeSubject.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {activeSubject.description}
            </p>
          )}
        </section>

        {/* Subject Workspace Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* Syllabus Attachment + Written Syllabus + Bibliography */}
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    Programa de estudio y bibliografía
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Adjuntá el programa oficial (PDF, imagen, TXT o MD) para que FABRO IA lo analice junto a tus datos.
                  </p>
                </div>

                <input
                  ref={workspaceSyllabusInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleWorkspaceSyllabusUpload(file);
                  }}
                />
                <button
                  type="button"
                  disabled={uploadingSyllabus}
                  onClick={() => workspaceSyllabusInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 disabled:opacity-60 cursor-pointer shrink-0"
                >
                  {uploadingSyllabus ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileUp className="w-3.5 h-3.5" />
                  )}
                  {uploadingSyllabus
                    ? 'Extrayendo programa...'
                    : activeSubject.syllabusFileName
                    ? 'Reemplazar archivo'
                    : 'Adjuntar programa de estudio'}
                </button>
              </div>

              {syllabusStatusMsg && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  {syllabusStatusMsg}
                </div>
              )}

              {activeSubject.syllabusFileName && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/70 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {activeSubject.syllabusFileName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {activeSubject.syllabusExtractedText
                            ? `Texto extraído listo para IA (${activeSubject.syllabusExtractedText.length.toLocaleString('es-AR')} caracteres)`
                            : 'Archivo adjunto vinculado a la materia'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {activeSubject.syllabusFileUrl && (
                        <a
                          href={activeSubject.syllabusFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir
                        </a>
                      )}
                      {activeSubject.syllabusExtractedText && (
                        <button
                          type="button"
                          onClick={() => setShowExtractedPreview((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                        >
                          {showExtractedPreview ? (
                            <>
                              <ChevronUp className="w-3 h-3" /> Ocultar texto
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3 h-3" /> Ver texto extraído
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleRemoveWorkspaceSyllabus()}
                        className="p-1.5 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                        aria-label="Quitar archivo del programa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {showExtractedPreview && activeSubject.syllabusExtractedText && (
                    <pre className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B101A] p-3 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {activeSubject.syllabusExtractedText}
                    </pre>
                  )}
                </div>
              )}

              {activeSubject.syllabus ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Programa escrito
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {activeSubject.syllabus}
                  </p>
                </div>
              ) : null}

              {activeSubject.bibliography ? (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Bibliografía
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {activeSubject.bibliography}
                  </p>
                </div>
              ) : null}

              {!activeSubject.syllabus &&
                !activeSubject.syllabusFileName &&
                !activeSubject.bibliography && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sin programa adjunto ni bibliografía cargados aún.
                  </p>
                )}
            </section>

            {/* AI Analysis & Google AI Mode Multi-Source Search */}
            <section className="rounded-xl border border-sky-500/30 bg-white dark:bg-[#0F1623] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Análisis integral y Búsqueda Multi-Fuente (Modo IA)
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    La IA analiza todos los datos de esta materia (programa adjunto, unidades, bibliografía, apuntes y exámenes) y consulta múltiples fuentes web académicas como Google Modo IA.
                  </p>
                </div>
              </div>

              {/* Loaded data inventory strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1.5">
                  <span className="text-slate-500 dark:text-slate-400 block">Programa adjunto</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {activeSubject.syllabusFileName ? 'Cargado' : activeSubject.syllabus ? 'Texto' : 'Pendiente'}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1.5">
                  <span className="text-slate-500 dark:text-slate-400 block">Unidades</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {activeSubject.units.length}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1.5">
                  <span className="text-slate-500 dark:text-slate-400 block">Apuntes y Docs</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {subNotes.length + subDocs.length}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1.5">
                  <span className="text-slate-500 dark:text-slate-400 block">Temas a reforzar</span>
                  <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                    {weakTopicsCount}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={400}
                    value={researchFocus}
                    onChange={(e) => setResearchFocus(e.target.value)}
                    placeholder="Enfoque opcional (ej. Priorizar Unidad 2, buscar guías prácticas o papers recientes)"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={researching}
                  onClick={() => void handleRunSubjectResearch()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {researching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {researching
                    ? 'Analizando y buscando fuentes...'
                    : analysisMarkdown
                    ? 'Actualizar análisis Modo IA'
                    : 'Analizar y buscar fuentes (Modo IA)'}
                </button>
              </div>

              {researchError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                  {researchError}
                </div>
              )}

              {currentMeta?.webFallbackUsed && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                  La búsqueda web en tiempo real alcanzó temporalmente su límite de cuota; el diagnóstico se generó integrando todos los datos cargados en tu materia y la base académica del tutor.
                </div>
              )}

              {analysisMarkdown && (
                <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {/* Action Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <AudioReadAloudControl
                        getText={() => analysisMarkdown}
                        title={`Analisis_IA_${activeSubject.name}`}
                        compact
                      />
                      <button
                        type="button"
                        onClick={() => setReadingModeOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Modo Lectura IA
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {currentMeta && currentMeta.suggestedUnits.length > 0 && (
                        <button
                          type="button"
                          onClick={() => void handleImportDetectedUnits(currentMeta.suggestedUnits)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                        >
                          {importedUnitsFeedback ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Unidades agregadas
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              Importar {currentMeta.suggestedUnits.length} unidades del programa
                            </>
                          )}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleSaveAnalysisAsNote()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {savedNoteFeedback ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Guardado en Apuntes
                          </>
                        ) : (
                          <>
                            <FileText className="w-3.5 h-3.5" />
                            Guardar en Apuntes
                          </>
                        )}
                      </button>

                      <a
                        href={
                          buildWhatsAppShareHref(
                            formatForWhatsApp({
                              title: `Análisis Modo IA: ${activeSubject.name}`,
                              body: analysisMarkdown,
                            })
                          ).href
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    </div>
                  </div>

                  {/* Formatted Analysis */}
                  <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 text-slate-800 dark:text-slate-200 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisMarkdown}</ReactMarkdown>
                  </div>

                  {/* Multi-Source Cards */}
                  {analysisSources.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Múltiples fuentes consultadas ({analysisSources.length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => setActiveSection('fuentes')}
                          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          Abrir buscador web completo
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {analysisSources.map((src, idx) => {
                          const alreadyAdded =
                            addedBibUrls[src.url] ||
                            (activeSubject.bibliography || '').includes(src.url);
                          return (
                            <div
                              key={`${src.url}-${idx}`}
                              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B101A] p-3 flex flex-col justify-between gap-2"
                            >
                              <div className="min-w-0 space-y-1">
                                <p className="text-[10px] font-medium text-sky-600 dark:text-sky-400 truncate">
                                  {src.category || 'Fuente web'} · {src.domain}
                                </p>
                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs font-semibold text-slate-900 dark:text-white hover:text-sky-600 dark:hover:text-sky-400 line-clamp-2 inline-flex items-start gap-1"
                                >
                                  <span>{src.title}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
                                </a>
                              </div>
                              <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                                <button
                                  type="button"
                                  disabled={alreadyAdded}
                                  onClick={() => void handleAddSourceToBibliography(src)}
                                  className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 disabled:text-emerald-600 dark:disabled:text-emerald-400 cursor-pointer disabled:cursor-default inline-flex items-center gap-1"
                                >
                                  {alreadyAdded ? (
                                    <>
                                      <Check className="w-3 h-3" /> En bibliografía
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3 h-3" /> Agregar a bibliografía
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentMeta && currentMeta.searchQueries.length > 0 && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Consultas realizadas en Modo IA: {currentMeta.searchQueries.join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Thematic Units & Topic-by-Topic Breakdown */}
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Unidades y desarrollo tema por tema
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setVisualModal({
                        open: true,
                        kind: 'esquema',
                        topic: activeSubject.name,
                        context: activeSubject.syllabus || activeSubject.units.join('\n'),
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Esquema
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setVisualModal({
                        open: true,
                        kind: 'linea_cronologica',
                        topic: activeSubject.name,
                        context: activeSubject.syllabus || activeSubject.units.join('\n'),
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    Línea cronológica
                  </button>
                </div>
              </div>

              {activeSubject.units.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                  <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      Sugerencia de inicio: comenzá por {activeSubject.units[0]}
                    </p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Para comprender mejor la materia, desarrollá cada unidad tema por tema en apuntes separados en lugar de mezclar toda la cursada en un solo documento.
                    </p>
                  </div>
                </div>
              )}

              {unitNotesError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                  {unitNotesError}
                </div>
              )}

              {unitNotesNotice && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
                  <span>{unitNotesNotice}</span>
                  <button
                    type="button"
                    onClick={() => setActiveSection('apuntes')}
                    className="font-semibold underline cursor-pointer shrink-0"
                  >
                    Ver en Apuntes
                  </button>
                </div>
              )}

              {activeSubject.units.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No hay unidades cargadas todavía. Editá la materia o ejecutá el análisis Modo IA sobre tu programa adjunto.
                </p>
              ) : (
                <ol className="divide-y divide-slate-200 dark:divide-slate-800">
                  {activeSubject.units.map((unit, idx) => {
                    const unitNotesCount = subNotes.filter(
                      (n) => n.unit === unit || n.folder === unit
                    ).length;
                    const isGeneratingThis = generatingUnit === unit;
                    return (
                      <li key={idx} className="py-3 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {unit}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              ({unitNotesCount} {unitNotesCount === 1 ? 'apunte' : 'apuntes'})
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={Boolean(generatingUnit)}
                              onClick={() => void handleGenerateUnitTopicNotes(unit)}
                              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                            >
                              {isGeneratingThis ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Layers className="w-3 h-3" />
                              )}
                              {isGeneratingThis
                                ? 'Creando apuntes...'
                                : 'Desarrollar tema por tema'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setVisualModal({
                                  open: true,
                                  kind: 'esquema',
                                  topic: unit,
                                  context: activeSubject.syllabus || '',
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <GitBranch className="w-3 h-3" />
                              Esquema
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setVisualModal({
                                  open: true,
                                  kind: 'linea_cronologica',
                                  topic: unit,
                                  context: activeSubject.syllabus || '',
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <History className="w-3 h-3" />
                              Cronología
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAiDraftPrompt(
                                  `Explicame en profundidad el tema "${unit}" de la materia ${activeSubject.name}, con ejemplos y fuentes.`
                                );
                                setActiveSection('fabro-ai');
                              }}
                              className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline px-1.5 py-1 cursor-pointer"
                            >
                              Consultar IA
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Apuntes ({subNotes.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSection('apuntes')}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Ir a Apuntes
                </button>
              </div>
              {subNotes.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Sin apuntes en esta materia.</p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {subNotes.slice(0, 5).map((n) => (
                    <li key={n.id} className="py-2 text-slate-700 dark:text-slate-200 truncate">
                      {n.title}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Documentos ({subDocs.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSection('biblioteca')}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Ir a Biblioteca
                </button>
              </div>
              {subDocs.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Sin archivos vinculados.</p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {subDocs.slice(0, 5).map((d) => (
                    <li key={d.id} className="py-2 text-slate-700 dark:text-slate-200 truncate">
                      {d.title} · {d.fileName}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  Exámenes y agenda ({subExams.length + subEvents.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSection('examenes')}
                  className="text-xs text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Practicar
                </button>
              </div>
              {subExams.length === 0 && subEvents.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Sin exámenes ni eventos registrados.</p>
              ) : (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {subEvents.slice(0, 3).map((ev) => (
                    <li key={ev.id} className="py-2 flex justify-between gap-2">
                      <span className="truncate">{ev.title}</span>
                      <span className="font-mono tabular-nums text-slate-500">{ev.date}</span>
                    </li>
                  ))}
                  {subExams.slice(0, 3).map((ex) => (
                    <li key={ex.id} className="py-2 flex justify-between gap-2">
                      <span className="truncate">{ex.title}</span>
                      <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                        {ex.status === 'completado' ? `${ex.scorePercent}%` : 'En curso'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <VisualStudyStudioModal
          isOpen={visualModal.open}
          onClose={() => setVisualModal((prev) => ({ ...prev, open: false }))}
          initialKind={visualModal.kind}
          defaultTopic={visualModal.topic}
          defaultContext={visualModal.context}
          subjectId={activeSubject.id}
          subjectName={activeSubject.name}
        />

        {analysisMarkdown && (
          <AIReadingModeModal
            isOpen={readingModeOpen}
            onClose={() => setReadingModeOpen(false)}
            title={`Análisis Modo IA: ${activeSubject.name}`}
            subjectName={activeSubject.name}
            contentText={analysisMarkdown}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Mis materias
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cada materia cuenta con su propio espacio de trabajo, programa adjunto, análisis Modo IA y material vinculado.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nueva materia
        </button>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0F1623] p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Creá tu primera materia
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            Organizá tus asignaturas universitarias, terciarias o escolares con su programa adjunto, cátedra, bibliografía y unidades.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Agregar materia
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {subjects.map((sub) => {
            const noteCount = notes.filter((n) => n.subjectId === sub.id).length;
            const docCount = libraryDocs.filter((d) => d.subjectId === sub.id).length;
            return (
              <article
                key={sub.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col justify-between gap-4 hover:border-sky-500/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 mt-1.5"
                        style={{ backgroundColor: sub.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Materia
                        </p>
                        <h3 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                          {sub.name}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(sub)}
                        aria-label={`Editar ${sub.name}`}
                        className="p-2 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(sub)}
                        aria-label={`Eliminar ${sub.name}`}
                        className="p-2 rounded-md text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {[sub.institution, sub.career, sub.professor].filter(Boolean).join(' · ') || 'Sin institución asignada'}
                  </p>

                  {sub.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                      {sub.description}
                    </p>
                  )}

                  <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 tabular-nums">
                    <span>{sub.units.length} unidades</span>
                    <span aria-hidden="true">·</span>
                    <span>{noteCount} apuntes</span>
                    <span aria-hidden="true">·</span>
                    <span>{docCount} docs</span>
                    {sub.syllabusFileName && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-sky-600 dark:text-sky-400 font-medium">Programa adjunto</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Avance</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                      {sub.progressPercent}%
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectId(sub.id)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Abrir espacio de trabajo
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] my-2 sm:my-6 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623]">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {editingSubject ? 'Editar materia' : 'Nueva materia'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                aria-label="Cerrar formulario"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Nombre de la materia *
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Análisis Matemático II"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nivel académico
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as EducationLevel)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    {EDUCATION_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Institución educativa
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Ej. Universidad de Buenos Aires"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Carrera / Área
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    value={career}
                    onChange={(e) => setCareer(e.target.value)}
                    placeholder="Ej. Ingeniería Informática"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Profesor o cátedra
                  </label>
                  <input
                    type="text"
                    maxLength={150}
                    value={professor}
                    onChange={(e) => setProfessor(e.target.value)}
                    placeholder="Ej. Cátedra Dr. García"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Color identificador
                  </label>
                  <div className="flex items-center gap-2 pt-1.5">
                    {SUBJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                          color === c ? 'ring-2 ring-offset-2 ring-sky-500 scale-110' : ''
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Color ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Objetivos generales, modalidad de cursada o notas rápidas..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Unidades o bloques temáticos (una por línea)
                  </label>
                  <textarea
                    rows={4}
                    value={unitsText}
                    onChange={(e) => setUnitsText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Bibliografía recomendada
                  </label>
                  <textarea
                    rows={4}
                    maxLength={5000}
                    value={bibliography}
                    onChange={(e) => setBibliography(e.target.value)}
                    placeholder="Autores, libros y papers de la cátedra..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Programa de estudio (texto o archivo adjunto)
                  </label>
                  <input
                    ref={modalSyllabusInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.csv,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPendingSyllabusFile(file);
                        setClearAttachedSyllabus(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => modalSyllabusInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5" />
                    Adjuntar PDF / Imagen / TXT
                  </button>
                </div>

                {(pendingSyllabusFile || (editingSubject?.syllabusFileName && !clearAttachedSyllabus)) && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {pendingSyllabusFile
                          ? `Nuevo archivo: ${pendingSyllabusFile.name}`
                          : `Adjunto actual: ${editingSubject?.syllabusFileName}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingSyllabusFile(null);
                        setClearAttachedSyllabus(true);
                        if (modalSyllabusInputRef.current) modalSyllabusInputRef.current.value = '';
                      }}
                      className="text-red-600 dark:text-red-400 hover:underline shrink-0 cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                )}

                <textarea
                  rows={3}
                  maxLength={10000}
                  value={syllabus}
                  onChange={(e) => setSyllabus(e.target.value)}
                  placeholder="También podés pegar o escribir contenidos mínimos del programa oficial..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60 cursor-pointer"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving
                    ? pendingSyllabusFile
                      ? 'Procesando programa...'
                      : 'Guardando...'
                    : editingSubject
                    ? 'Guardar cambios'
                    : 'Crear materia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
