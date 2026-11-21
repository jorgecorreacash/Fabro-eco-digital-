import type { CalendarAlarmTone } from './ecosystem';

export type Study2NavId =
  | 'inicio'
  | 'mis-estudios'
  | 'fabro-ia'
  | 'mis-apuntes'
  | 'biblioteca'
  | 'calendario'
  | 'evaluaciones'
  | 'mi-progreso'
  | 'herramientas';

export type StudySubjectKind =
  | 'materia_universitaria'
  | 'materia_secundaria'
  | 'carrera'
  | 'curso'
  | 'diplomatura'
  | 'capacitacion'
  | 'seminario'
  | 'taller'
  | 'investigacion'
  | 'autodidacta'
  | 'otro';

export type StudySubjectIconId =
  | 'book'
  | 'graduation'
  | 'flask'
  | 'scale'
  | 'code'
  | 'globe'
  | 'calculator'
  | 'stethoscope'
  | 'landmark'
  | 'palette'
  | 'briefcase'
  | 'layers';

export interface StudyTopicItem {
  id: string;
  title: string;
  completed: boolean;
  notes?: string;
}

export interface StudyUnit {
  id: string;
  title: string;
  description?: string;
  topics: StudyTopicItem[];
}

export interface StudyBibliographyItem {
  id: string;
  title: string;
  author: string;
  year: string;
  publisher?: string;
  url?: string;
  doi?: string;
  subjectId?: string;
  kind: 'libro' | 'articulo' | 'web' | 'tesis' | 'apunte';
  notes?: string;
}

export interface StudyTaskItem {
  id: string;
  subjectId?: string;
  title: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD
  priority: 'alta' | 'media' | 'baja';
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface StudySubject {
  id: string;
  name: string;
  kind: StudySubjectKind;
  customCategory?: string;
  institution?: string;
  professor?: string;
  period?: string;
  description?: string;
  syllabus?: string;
  color: string; // Hex #RRGGBB
  icon: StudySubjectIconId;
  units: StudyUnit[];
  archived: boolean;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudyLibraryFolder {
  id: string;
  name: string;
  parentId: string | null;
  subjectId?: string;
  createdAt: string;
}

export interface StudyLibraryFileMeta {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  folderId: string | null;
  subjectId?: string;
  tags: string[];
  favorite: boolean;
  extractedText: string;
  pageCount?: number;
  extractionStatus: 'ok' | 'parcial' | 'sin_texto' | 'error';
  extractionNote?: string;
  hasLocalBlob: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CalendarDomain =
  | 'academico'
  | 'profesional'
  | 'personal'
  | 'turnos'
  | 'recordatorios'
  | 'otros';

export interface CalendarCategoryConfig {
  id: string;
  name: string;
  color: string; // Hex #RRGGBB
  domain: CalendarDomain;
  priority: number; // Lower number = higher visual priority when multiple events fall on the same day
  enabled: boolean;
}

export type CalendarRecurrenceRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom_days';

export interface UnifiedCalendarEvent {
  id: string;
  title: string;
  description: string;
  dateKey: string; // YYYY-MM-DD
  allDay: boolean;
  startTime: string; // HH:mm
  durationMinutes: number;
  categoryId: string;
  customColor?: string; // Optional per-event hex override
  domain: CalendarDomain;
  subjectId?: string;
  linkedEvaluationId?: string;
  recurrence: CalendarRecurrenceRule;
  recurrenceDaysOfWeek?: number[]; // 0=Dom..6=Sab for custom_days
  recurrenceEndDate?: string; // YYYY-MM-DD
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  alarmTone: CalendarAlarmTone;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarPreferences {
  weekStartsOn: 1 | 0; // 1 = Monday, 0 = Sunday
  defaultView: 'month' | 'week' | 'day';
  multiEventRule: 'priority' | 'first_created' | 'latest_created';
}

export interface StudyEvaluation {
  id: string;
  subjectId: string;
  title: string;
  kind: 'parcial' | 'final' | 'recuperatorio' | 'tp_evaluado' | 'oral' | 'cuestionario';
  dateKey: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  topics: string[];
  status: 'programada' | 'rendida' | 'aprobada' | 'desaprobada' | 'ausente';
  grade?: number | null;
  maxGrade: number;
  observations: string;
  calendarEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export type FabroAiStudyMode =
  | 'explicar_tema'
  | 'resumir_documento'
  | 'analizar_documento'
  | 'mapa_conceptual'
  | 'preguntas_examen'
  | 'cuestionario_interactivo'
  | 'flashcards'
  | 'guia_estudio'
  | 'cuadro_comparativo'
  | 'linea_tiempo'
  | 'caso_practico'
  | 'corregir_texto'
  | 'mejorar_redaccion'
  | 'plan_estudio'
  | 'investigar_tema'
  | 'comparar_documentos'
  | 'explicacion_sencilla'
  | 'explicacion_academica';

export type FabroAiDepth = 'breve' | 'intermedio' | 'completo' | 'muy_profundo';

export interface AcademicWebCitation {
  id: string;
  title: string;
  authors: string[];
  year: string;
  sourceName: 'OpenAlex' | 'Crossref' | 'Wikipedia ES';
  institution?: string;
  doi?: string;
  url: string;
  excerpt: string;
  kind: 'paper' | 'enciclopedia' | 'libro';
}

export interface FabroAiSessionTurn {
  id: string;
  role: 'user' | 'assistant';
  mode: FabroAiStudyMode;
  depth: FabroAiDepth;
  subjectId?: string;
  content: string;
  documentNames: string[];
  webSources: AcademicWebCitation[];
  usedByokProvider?: string;
  createdAt: string;
}

export interface StudyConceptMapNode {
  id: string;
  label: string;
  parentId: string | null;
  color: string;
}

export interface StudyConceptMap {
  id: string;
  title: string;
  subjectId?: string;
  nodes: StudyConceptMapNode[];
  updatedAt: string;
}

export interface StudyQuizCard {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface StudyQuizSet {
  id: string;
  title: string;
  subjectId?: string;
  questions: StudyQuizCard[];
  lastScore?: { correct: number; total: number; takenAt: string };
  updatedAt: string;
}

export interface StudyFlashcardItem {
  id: string;
  subjectId?: string;
  front: string;
  back: string;
  box: 1 | 2 | 3 | 4 | 5;
  nextReviewDate: string; // YYYY-MM-DD
  reviews: number;
}

export interface StudyTimelineEntry {
  id: string;
  dateLabel: string;
  title: string;
  detail: string;
  subjectId?: string;
}

export interface StudyComparativeTable {
  id: string;
  title: string;
  subjectId?: string;
  columns: string[];
  rows: string[][];
  updatedAt: string;
}

export interface StudyAiHandoff {
  subjectId?: string;
  noteTitle?: string;
  noteText?: string;
  fileIds?: string[];
  mode?: FabroAiStudyMode;
  prompt?: string;
}

export interface Study2WorkspaceSnapshot {
  version: number;
  subjects: StudySubject[];
  tasks: StudyTaskItem[];
  bibliography: StudyBibliographyItem[];
  libraryFolders: StudyLibraryFolder[];
  libraryFiles: StudyLibraryFileMeta[];
  calendarCategories: CalendarCategoryConfig[];
  calendarEvents: UnifiedCalendarEvent[];
  calendarPreferences: CalendarPreferences;
  evaluations: StudyEvaluation[];
  aiHistory: FabroAiSessionTurn[];
  conceptMaps: StudyConceptMap[];
  quizSets: StudyQuizSet[];
  flashcards: StudyFlashcardItem[];
  timelineEntries: StudyTimelineEntry[];
  comparativeTables: StudyComparativeTable[];
  noteMetadata: Record<
    string,
    {
      subjectId?: string;
      unit?: string;
      topic?: string;
      favorite?: boolean;
      attachmentFileIds?: string[];
    }
  >;
  lastActiveSubjectId?: string;
  updatedAt: string;
}
