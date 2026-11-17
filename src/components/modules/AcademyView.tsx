import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  FileDown,
  FileText,
  Heart,
  Layers,
  Lock,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import academyHeroImg from '../../assets/images/fabro_academy_courses_1794596245933.jpg';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { authFetch } from '../../lib/apiClient';
import { exportCourseCertificatePdf } from '../../lib/exporters';
import type { Course, CourseLesson, LessonQuizQuestion } from '../../types/fabro';

function extractYoutubeId(raw: string): string {
  const s = (raw || '').trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const match = s.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : '';
}

export const AcademyView: React.FC = () => {
  const { user, profile, setActiveSection } = useFabro();
  const {
    courses,
    enrollments,
    taxonomy,
    createCourse,
    deleteCourse,
    subscribeCourseLessons,
    addCourseLesson,
    deleteCourseLesson,
    enrollInCourse,
    unenrollFromCourse,
    toggleCourseFavorite,
    markLessonCompleted,
    rateCourse,
    submitModerationReport,
  } = usePlatform();

  const [tab, setTab] = useState<'explore' | 'enrolled' | 'teaching'>('explore');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('Todas');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedLevel, setSelectedLevel] = useState('todos');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  // Create Course Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newArea, setNewArea] = useState(taxonomy[0]?.area || 'Educación escolar');
  const [newCategory, setNewCategory] = useState(taxonomy[0]?.subcategories[0] || 'Secundaria');
  const [newLevel, setNewLevel] = useState<Course['level']>('inicial');
  const [newObjectives, setNewObjectives] = useState('');
  const [newSyllabus, setNewSyllabus] = useState('');
  const [newBibliography, setNewBibliography] = useState('');
  const [newHours, setNewHours] = useState(12);
  const [newVisibility, setNewVisibility] = useState<Course['visibility']>('publico');
  const [newInstitution, setNewInstitution] = useState(profile?.institution || '');
  const [newCertificate, setNewCertificate] = useState(true);
  const [newLinkedGroup, setNewLinkedGroup] = useState(true);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [aiDraftNotice, setAiDraftNotice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Add Lesson Form State
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [lesTitle, setLesTitle] = useState('');
  const [lesDesc, setLesDesc] = useState('');
  const [lesVideoUrl, setLesVideoUrl] = useState('');
  const [lesActivity, setLesActivity] = useState('');
  const [lesMinutes, setLesMinutes] = useState(20);
  const [lesFile, setLesFile] = useState<File | null>(null);
  const [lesQuizRaw, setLesQuizRaw] = useState('');
  const [addingLesson, setAddingLesson] = useState(false);

  // Report state
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCourse) {
      setLessons([]);
      setActiveLessonId(null);
      return;
    }
    const unsub = subscribeCourseLessons(activeCourse.id, (list) => {
      setLessons(list);
      if (list.length > 0 && !list.some((l) => l.id === activeLessonId)) {
        setActiveLessonId(list[0].id);
      }
    });
    return () => unsub();
  }, [activeCourse, subscribeCourseLessons]);

  const activeAreaGroup = useMemo(
    () => taxonomy.find((t) => t.area === newArea) || taxonomy[0],
    [taxonomy, newArea]
  );

  const filterAreaGroup = useMemo(
    () => taxonomy.find((t) => t.area === selectedArea),
    [taxonomy, selectedArea]
  );

  const enrollmentsByCourseId = useMemo(() => {
    const map = new Map<string, typeof enrollments[number]>();
    for (const e of enrollments) map.set(e.courseId, e);
    return map;
  }, [enrollments]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return courses.filter((c) => {
      if (tab === 'enrolled') {
        const enr = enrollmentsByCourseId.get(c.id);
        if (!enr) return false;
        if (onlyFavorites && !enr.favorite) return false;
      } else if (tab === 'teaching') {
        if (c.instructorId !== user?.uid) return false;
      } else {
        if (c.visibility === 'privado' && c.instructorId !== user?.uid) return false;
      }

      if (selectedArea !== 'Todas' && c.area !== selectedArea) return false;
      if (selectedCategory !== 'Todas' && c.category !== selectedCategory) return false;
      if (selectedLevel !== 'todos' && c.level !== selectedLevel) return false;

      if (q) {
        const hay = `${c.title} ${c.description} ${c.area} ${c.category} ${c.instructorName} ${c.institution}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [courses, tab, enrollmentsByCourseId, onlyFavorites, user?.uid, selectedArea, selectedCategory, selectedLevel, searchQuery]);

  const activeLesson = useMemo(
    () => lessons.find((l) => l.id === activeLessonId) || lessons[0] || null,
    [lessons, activeLessonId]
  );

  const activeEnrollment = activeCourse ? enrollmentsByCourseId.get(activeCourse.id) || null : null;

  const handleGenerateAiCourseDraft = async (action: 'syllabus' | 'activity' | 'quiz') => {
    setFormError(null);
    const targetTitle = action === 'syllabus' ? newTitle : lesTitle || newTitle || activeCourse?.title || '';
    if (!targetTitle.trim()) {
      setFormError('Escribí el título del curso o lección para que el Asistente Docente arme un borrador.');
      return;
    }
    setAiLoading(true);
    try {
      const resp = await authFetch('/api/ai/course-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          courseTitle: targetTitle,
          area: activeCourse?.area || newArea,
          category: activeCourse?.category || newCategory,
          level: activeCourse?.level || newLevel,
        }),
      });
      const json = (await resp.json()) as { text?: string; notice?: string; error?: string };
      if (!resp.ok) throw new Error(json.error || 'No se pudo generar el borrador');
      if (action === 'syllabus') {
        setNewSyllabus((prev) => (prev ? `${prev}\n\n${json.text || ''}` : json.text || ''));
      } else if (action === 'activity') {
        setLesActivity(json.text || '');
      } else {
        setLesQuizRaw(json.text || '');
      }
      setAiDraftNotice(json.notice || 'Borrador generado con IA. Revisalo antes de publicar.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error generando borrador.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newTitle.trim()) {
      setFormError('Ingresá el título del curso gratuito.');
      return;
    }
    setCreatingCourse(true);
    try {
      const id = await createCourse({
        title: newTitle,
        description: newDescription || 'Curso abierto y gratuito en PROYECTO FABRO.',
        area: newArea,
        category: newCategory,
        level: newLevel,
        objectives: newObjectives,
        syllabus: newSyllabus,
        estimatedHours: newHours,
        visibility: newVisibility,
        institution: newInstitution,
        certificateEnabled: newCertificate,
        bibliography: newBibliography,
        createLinkedGroup: newLinkedGroup,
      });
      setShowCreateForm(false);
      setNewTitle('');
      setNewDescription('');
      setNewObjectives('');
      setNewSyllabus('');
      setNewBibliography('');
      setTab('teaching');
      const created = courses.find((c) => c.id === id);
      if (created) setActiveCourse(created);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo publicar el curso.');
    } finally {
      setCreatingCourse(false);
    }
  };

  const parseQuizInput = (raw: string): LessonQuizQuestion[] => {
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const out: LessonQuizQuestion[] = [];
    for (const line of lines) {
      // Expected simple format: Pregunta? | Opción A | Opción B* | Opción C (asterisk marks correct)
      if (!line.includes('|')) continue;
      const parts = line.split('|').map((p) => p.trim()).filter(Boolean);
      if (parts.length < 3) continue;
      const qText = parts[0];
      let correctIdx = 0;
      const opts = parts.slice(1).map((o, idx) => {
        if (o.endsWith('*')) {
          correctIdx = idx;
          return o.slice(0, -1).trim();
        }
        return o;
      });
      out.push({
        id: `q_${out.length + 1}`,
        question: qText,
        options: opts,
        correctIndex: correctIdx,
      });
    }
    return out;
  };

  const handleAddLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCourse || !lesTitle.trim()) return;
    setAddingLesson(true);
    try {
      const ytId = extractYoutubeId(lesVideoUrl);
      const parsedQuiz = parseQuizInput(lesQuizRaw);
      await addCourseLesson(activeCourse.id, {
        title: lesTitle,
        description: lesDesc,
        videoUrl: lesVideoUrl,
        youtubeVideoId: ytId,
        materialPdfFile: lesFile,
        activityPrompt: lesActivity,
        quizQuestions: parsedQuiz,
        durationMinutes: lesMinutes,
        orderIndex: lessons.length + 1,
      });
      setLesTitle('');
      setLesDesc('');
      setLesVideoUrl('');
      setLesActivity('');
      setLesFile(null);
      setLesQuizRaw('');
      setShowAddLesson(false);
    } finally {
      setAddingLesson(false);
    }
  };

  const handleSubmitLessonQuiz = async (lesson: CourseLesson) => {
    if (!activeEnrollment || lesson.quizQuestions.length === 0) return;
    let correct = 0;
    for (const q of lesson.quizQuestions) {
      if (quizAnswers[q.id] === q.correctIndex) correct += 1;
    }
    const score = Math.round((correct / lesson.quizQuestions.length) * 100);
    setQuizFeedback(`Obtuviste ${correct} de ${lesson.quizQuestions.length} respuestas correctas (${score}%).`);
    await markLessonCompleted({
      enrollment: activeEnrollment,
      lessonId: lesson.id,
      totalLessons: Math.max(lessons.length, activeCourse?.lessonsCount || 1),
      quizScore: score,
    });
  };

  if (activeCourse) {
    const isInstructorOwner = activeCourse.instructorId === user?.uid;
    const avgRating =
      activeCourse.ratingCount > 0
        ? (activeCourse.ratingSum / activeCourse.ratingCount).toFixed(1)
        : 'Sin calificar';

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveCourse(null);
              setQuizFeedback(null);
            }}
            className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
          >
            ← Volver al catálogo de FABRO Academy
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {activeEnrollment ? (
              <>
                <button
                  type="button"
                  onClick={() => void toggleCourseFavorite(activeEnrollment.id, activeEnrollment.favorite)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                    activeEnrollment.favorite
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" />
                  {activeEnrollment.favorite ? 'Favorito' : 'Guardar'}
                </button>
                {activeCourse.certificateEnabled && activeEnrollment.progressPercent >= 100 && (
                  <button
                    type="button"
                    onClick={() =>
                      exportCourseCertificatePdf({
                        studentName: profile?.displayName || 'Estudiante FABRO',
                        courseTitle: activeCourse.title,
                        instructorName: activeCourse.instructorName,
                        area: `${activeCourse.area} · ${activeCourse.category}`,
                        estimatedHours: activeCourse.estimatedHours,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
                  >
                    <Award className="w-3.5 h-3.5" />
                    Descargar constancia PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void unenrollFromCourse(activeEnrollment.id, activeCourse.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  Desinscribirse
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void enrollInCourse(activeCourse)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                Inscribirse gratis
              </button>
            )}

            {activeCourse.linkedGroupId && (
              <button
                type="button"
                onClick={() => setActiveSection('comunidad')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                Ir al grupo del curso
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                void submitModerationReport({
                  targetType: 'curso',
                  targetId: activeCourse.id,
                  targetSummary: activeCourse.title,
                  reason: 'Revisión de contenido educativo',
                  details: `Reporte enviado desde el aula del curso ${activeCourse.title}`,
                }).then(() => setReportMsg('Reporte enviado al equipo de moderación.'));
              }}
              className="text-xs text-slate-500 hover:text-rose-500 cursor-pointer px-2 py-1"
            >
              Reportar
            </button>
          </div>
        </div>

        {reportMsg && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            {reportMsg}
          </div>
        )}

        {/* Course Header */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <p className="text-xs font-medium text-sky-600 dark:text-sky-400">
                {activeCourse.area} · {activeCourse.category} · Nivel {activeCourse.level} · Curso 100% gratuito
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                {activeCourse.title}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeCourse.description}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                Dictado por <strong className="text-slate-800 dark:text-slate-200">{activeCourse.instructorName}</strong>
                {activeCourse.instructorVerified ? ' · Docente/Instructor verificado ✓' : ' · Instructor comunitario'}
                {activeCourse.institution ? ` · ${activeCourse.institution}` : ''}
                {` · ${activeCourse.enrolledCount} inscriptos · ★ ${avgRating} · ${activeCourse.estimatedHours} h estimadas`}
              </p>
            </div>

            {activeEnrollment && (
              <div className="min-w-[200px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Tu progreso</span>
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    {activeEnrollment.progressPercent}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 transition-all"
                    style={{ width: `${activeEnrollment.progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 pt-1">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-1">Valorar:</span>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => void rateCourse(activeEnrollment, activeCourse, star)}
                      className="cursor-pointer p-0.5"
                      aria-label={`Calificar con ${star} estrellas`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          (activeEnrollment.studentRating || 0) >= star
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-400'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {(activeCourse.objectives || activeCourse.syllabus || activeCourse.bibliography) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              {activeCourse.objectives && (
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white mb-1">Objetivos</p>
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {activeCourse.objectives}
                  </p>
                </div>
              )}
              {activeCourse.syllabus && (
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white mb-1">Programa de estudio</p>
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {activeCourse.syllabus}
                  </p>
                </div>
              )}
              {activeCourse.bibliography && (
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white mb-1">Bibliografía y recursos</p>
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {activeCourse.bibliography}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Lessons Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Módulos y lecciones ({lessons.length})
              </h3>
              {isInstructorOwner && (
                <button
                  type="button"
                  onClick={() => setShowAddLesson((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Lección
                </button>
              )}
            </div>

            {showAddLesson && isInstructorOwner && (
              <form
                onSubmit={(e) => void handleAddLessonSubmit(e)}
                className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 space-y-2.5 text-xs"
              >
                <p className="font-semibold text-slate-900 dark:text-white">Nueva lección</p>
                <input
                  type="text"
                  required
                  value={lesTitle}
                  onChange={(e) => setLesTitle(e.target.value)}
                  placeholder="Título de la lección"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                />
                <textarea
                  rows={3}
                  value={lesDesc}
                  onChange={(e) => setLesDesc(e.target.value)}
                  placeholder="Explicación escrita de la clase..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                />
                <input
                  type="url"
                  value={lesVideoUrl}
                  onChange={(e) => setLesVideoUrl(e.target.value)}
                  placeholder="URL de YouTube opcional (https://youtu.be/...)"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                />
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] text-slate-500 dark:text-slate-400">Duración (min):</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={lesMinutes}
                    onChange={(e) => setLesMinutes(Number(e.target.value) || 15)}
                    className="w-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2 py-1 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                    Material PDF / documento opcional:
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={(e) => setLesFile(e.target.files?.[0] || null)}
                    className="w-full text-[11px] text-slate-600 dark:text-slate-300"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Actividad práctica:</span>
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => void handleGenerateAiCourseDraft('activity')}
                      className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Sugerir con IA
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={lesActivity}
                    onChange={(e) => setLesActivity(e.target.value)}
                    placeholder="Consigna o ejercicio práctico..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                  />
                </div>
                <textarea
                  rows={2}
                  value={lesQuizRaw}
                  onChange={(e) => setLesQuizRaw(e.target.value)}
                  placeholder="Quiz rápido (1 por línea): Pregunta? | Opción A | Opción B* | Opción C"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={addingLesson}
                  className="w-full rounded-lg bg-sky-600 py-1.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                >
                  {addingLesson ? 'Guardando lección...' : 'Publicar lección'}
                </button>
              </form>
            )}

            {lessons.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                {isInstructorOwner
                  ? 'Todavía no agregaste lecciones. Tocá "+ Lección" para cargar videos, PDFs y actividades.'
                  : 'El docente aún está cargando las primeras lecciones.'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {lessons.map((les, idx) => {
                  const isDone = Boolean(activeEnrollment?.completedLessonIds.includes(les.id));
                  const isSelected = activeLesson?.id === les.id;
                  return (
                    <div
                      key={les.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
                        isSelected
                          ? 'border-sky-500/60 bg-sky-500/10 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveLessonId(les.id);
                          setQuizFeedback(null);
                        }}
                        className="flex-1 min-w-0 text-left flex items-center gap-2 cursor-pointer"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{les.title}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {les.durationMinutes} min
                            {les.youtubeVideoId ? ' · Video' : ''}
                            {les.materialPdfName ? ' · PDF' : ''}
                          </p>
                        </div>
                      </button>
                      {isInstructorOwner && (
                        <button
                          type="button"
                          onClick={() => void deleteCourseLesson(activeCourse.id, les.id, lessons.length)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                          aria-label="Eliminar lección"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-5">
            {activeLesson ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                      {activeLesson.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Duración estimada: {activeLesson.durationMinutes} minutos
                    </p>
                  </div>
                  {activeEnrollment && (
                    <button
                      type="button"
                      onClick={() =>
                        void markLessonCompleted({
                          enrollment: activeEnrollment,
                          lessonId: activeLesson.id,
                          totalLessons: Math.max(lessons.length, activeCourse.lessonsCount || 1),
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                        activeEnrollment.completedLessonIds.includes(activeLesson.id)
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-sky-600 text-white hover:bg-sky-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {activeEnrollment.completedLessonIds.includes(activeLesson.id)
                        ? 'Lección completada'
                        : 'Marcar como completada'}
                    </button>
                  )}
                </div>

                {activeLesson.youtubeVideoId && (
                  <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black">
                    <iframe
                      title={activeLesson.title}
                      src={`https://www.youtube.com/embed/${activeLesson.youtubeVideoId}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}

                {activeLesson.description && (
                  <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {activeLesson.description}
                  </div>
                )}

                {activeLesson.materialPdfUrl && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {activeLesson.materialPdfName || 'Material descargable del curso'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Recurso adjunto por el instructor</p>
                      </div>
                    </div>
                    <a
                      href={activeLesson.materialPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 whitespace-nowrap"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                      Abrir / Descargar
                    </a>
                  </div>
                )}

                {activeLesson.activityPrompt && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-1.5">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      Actividad práctica sugerida
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {activeLesson.activityPrompt}
                    </p>
                  </div>
                )}

                {activeLesson.quizQuestions.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Autoevaluación de la lección
                    </p>
                    {activeLesson.quizQuestions.map((q, qIdx) => (
                      <div key={q.id} className="space-y-2">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {qIdx + 1}. {q.question}
                        </p>
                        <div className="space-y-1">
                          {q.options.map((opt, optIdx) => (
                            <label
                              key={optIdx}
                              className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <input
                                type="radio"
                                name={`quiz_${q.id}`}
                                checked={quizAnswers[q.id] === optIdx}
                                onChange={() => setQuizAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={!activeEnrollment}
                      onClick={() => void handleSubmitLessonQuiz(activeLesson)}
                      className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
                    >
                      {activeEnrollment ? 'Enviar respuestas' : 'Inscribite gratis para guardar tu puntaje'}
                    </button>
                    {quizFeedback && (
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {quizFeedback}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                Seleccioná una lección de la lista para comenzar a estudiar.
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Editorial Hero */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-sky-600 dark:text-sky-400 uppercase">
              FABRO ACADEMY · EDUCACIÓN UNIVERSAL GRATUITA
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Cursos abiertos en escuelas, universidades, oficios, idiomas y tecnología
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
              Aprendé a tu ritmo sin barreras ni aranceles, o compartí tus conocimientos creando cursos completos con videos, PDFs, actividades y grupo de estudio integrado.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {showCreateForm ? 'Cerrar creador de curso' : 'Crear curso gratuito'}
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('perfil')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Award className="w-4 h-4 text-sky-500" />
              Acreditarme como instructor
            </button>
          </div>
        </div>
        <div className="lg:col-span-5 relative min-h-[190px] bg-slate-900">
          <img
            src={academyHeroImg}
            alt="FABRO Academy cursos multidisciplinarios"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Course Creator Form */}
      {showCreateForm && (
        <form
          onSubmit={(e) => void handleCreateCourseSubmit(e)}
          className="rounded-2xl border border-sky-500/30 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Publicar nuevo curso gratuito en FABRO Academy
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Todos los cursos publicados en FABRO son libres y sin costo obligatorio para los estudiantes.
                {profile?.verificationStatus !== 'aprobado' &&
                  ' Podés publicar ahora y solicitar tu insignia verificada en Perfil cuando quieras.'}
              </p>
            </div>
            <button
              type="button"
              disabled={aiLoading}
              onClick={() => void handleGenerateAiCourseDraft('syllabus')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiLoading ? 'Generando borrador...' : 'Asistente Docente IA (Programa)'}
            </button>
          </div>

          {aiDraftNotice && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-200">
              {aiDraftNotice}
            </div>
          )}
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Título del curso *</span>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej.: Electricidad domiciliaria desde cero / Derecho Constitucional / Python inicial"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </label>

            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Institución / Taller (opcional)</span>
              <input
                type="text"
                value={newInstitution}
                onChange={(e) => setNewInstitution(e.target.value)}
                placeholder="Escuela, universidad, centro de oficios o independiente"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </label>

            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Área de formación</span>
              <select
                value={newArea}
                onChange={(e) => {
                  const next = e.target.value;
                  setNewArea(next);
                  const found = taxonomy.find((t) => t.area === next);
                  if (found && found.subcategories[0]) setNewCategory(found.subcategories[0]);
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              >
                {taxonomy.map((t) => (
                  <option key={t.id} value={t.area}>
                    {t.area}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Categoría / Especialidad</span>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              >
                {(activeAreaGroup?.subcategories || ['General']).map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Nivel</span>
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value as Course['level'])}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="inicial">Inicial (sin conocimientos previos)</option>
                <option value="intermedio">Intermedio</option>
                <option value="avanzado">Avanzado</option>
                <option value="universitario">Universitario / Superior</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Visibilidad</span>
                <select
                  value={newVisibility}
                  onChange={(e) => setNewVisibility(e.target.value as Course['visibility'])}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="publico">Público abierto</option>
                  <option value="institucional">Institucional</option>
                  <option value="privado">Solo borrador privado</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Horas estimadas</span>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={newHours}
                  onChange={(e) => setNewHours(Number(e.target.value) || 10)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                />
              </label>
            </div>
          </div>

          <label className="block space-y-1 text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Descripción general</span>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Explicá qué aprenderá el estudiante y a quién está dirigido..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
            />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Objetivos</span>
              <textarea
                rows={4}
                value={newObjectives}
                onChange={(e) => setNewObjectives(e.target.value)}
                placeholder="Resultados de aprendizaje esperados..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Programa y unidades</span>
              <textarea
                rows={4}
                value={newSyllabus}
                onChange={(e) => setNewSyllabus(e.target.value)}
                placeholder="Módulo 1... Módulo 2... (o usá Asistente IA arriba)"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </label>
            <label className="space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200">Bibliografía / Referencias</span>
              <textarea
                rows={4}
                value={newBibliography}
                onChange={(e) => setNewBibliography(e.target.value)}
                placeholder="Manuales, enlaces oficiales, leyes o guías..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700 dark:text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newCertificate}
                onChange={(e) => setNewCertificate(e.target.checked)}
              />
              <span>Emitir constancia PDF al completar el 100%</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newLinkedGroup}
                onChange={(e) => setNewLinkedGroup(e.target.checked)}
              />
              <span>Crear automáticamente comunidad / grupo de estudio vinculado</span>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creatingCourse}
              className="rounded-lg bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              {creatingCourse ? 'Publicando...' : 'Publicar curso gratuito'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs & Filters */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'explore', label: `Explorar catálogo (${courses.length})` },
              { id: 'enrolled', label: `Mis inscripciones (${enrollments.length})` },
              {
                id: 'teaching',
                label: `Cursos que dicto (${courses.filter((c) => c.instructorId === user?.uid).length})`,
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id as typeof tab)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'enrolled' && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyFavorites}
                onChange={(e) => setOnlyFavorites(e.target.checked)}
              />
              <span>Solo favoritos</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar curso, oficio, carrera o docente..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-8 pr-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <select
            value={selectedArea}
            onChange={(e) => {
              setSelectedArea(e.target.value);
              setSelectedCategory('Todas');
            }}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
          >
            <option value="Todas">Todas las áreas de conocimiento</option>
            {taxonomy.map((t) => (
              <option key={t.id} value={t.area}>
                {t.area}
              </option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
          >
            <option value="Todas">Todas las especialidades</option>
            {(filterAreaGroup?.subcategories || taxonomy.flatMap((t) => t.subcategories)).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
          >
            <option value="todos">Todos los niveles</option>
            <option value="inicial">Inicial</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
            <option value="universitario">Universitario</option>
          </select>
        </div>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No hay cursos que coincidan con tu filtro todavía
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Podés limpiar los filtros o publicar el primer curso gratuito de esta área en FABRO Academy.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCourses.map((c) => {
            const enr = enrollmentsByCourseId.get(c.id);
            const avg = c.ratingCount > 0 ? (c.ratingSum / c.ratingCount).toFixed(1) : null;
            return (
              <article
                key={c.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col justify-between gap-4 hover:border-sky-500/40 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-sky-600 dark:text-sky-400">
                    <span className="truncate">
                      {c.area} · {c.category}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 shrink-0">Gratuito</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                    {c.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                    {c.description}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    {c.instructorName}
                    {c.instructorVerified ? ' · Verificado ✓' : ''}
                    {` · ${c.lessonsCount} lecciones · ${c.estimatedHours} h`}
                    {avg ? ` · ★ ${avg}` : ''}
                  </p>
                </div>

                {enr && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400">Avance</span>
                      <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                        {enr.progressPercent}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-sky-500" style={{ width: `${enr.progressPercent}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => setActiveCourse(c)}
                    className="flex-1 rounded-lg bg-sky-600 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                  >
                    {enr || c.instructorId === user?.uid ? 'Entrar al curso' : 'Ver programa e inscribirse'}
                  </button>
                  {c.instructorId === user?.uid && (
                    <button
                      type="button"
                      onClick={() => void deleteCourse(c.id)}
                      className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 cursor-pointer"
                      aria-label="Eliminar curso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
