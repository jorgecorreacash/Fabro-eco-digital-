export type EducationLevel =
  | 'primaria'
  | 'secundaria'
  | 'terciario'
  | 'universitario'
  | 'posgrado'
  | 'autodidacta';

export type NavSectionId =
  | 'inicio'
  | 'estudio-panel'
  | 'bienestar-panel'
  | 'social-panel'
  | 'herramientas-panel'
  | 'ia-panel'
  | 'ejercicios'
  | 'horoscopo'
  | 'suerte'
  | 'fabro-ai'
  | 'academy'
  | 'comunidad'
  | 'video'
  | 'aula'
  | 'mensajes'
  | 'perfil'
  | 'admin'
  | 'fuentes'
  | 'hub'
  | 'materias'
  | 'apuntes'
  | 'libros'
  | 'biblioteca'
  | 'diccionario'
  | 'examenes'
  | 'calendario'
  | 'memorizacion'
  | 'progreso'
  | 'configuracion'
  | 'connect'
  | 'explorer'
  | 'ai-browser'
  | 'knowledge'
  | 'documents'
  | 'research'
  | 'design'
  | 'study'
  | 'habitos'
  | 'calorias'
  | 'tools'
  | 'ultimo-dia';

export type ThemeTemplateId =
  | 'estandar'
  | 'ecologico'
  | 'gotico'
  | 'aura'
  | 'floral'
  | 'metal'
  | 'oro';

export interface ThemeTemplateMeta {
  id: ThemeTemplateId;
  label: string;
  tagline: string;
  accentHex: string;
  secondaryHex: string;
  darkBgHex: string;
  lightBgHex: string;
  recommendedMode: 'dark' | 'light';
}

export const THEME_TEMPLATES: ThemeTemplateMeta[] = [
  {
    id: 'estandar',
    label: 'FABRO 2.0 · Noche y Oro',
    tagline: 'Azul noche, profundo, violeta, blanco cálido y dorado',
    accentHex: '#8B5CF6',
    secondaryHex: '#E5B842',
    darkBgHex: '#070B17',
    lightBgHex: '#FAF7F0',
    recommendedMode: 'dark',
  },
  {
    id: 'ecologico',
    label: 'Ecológico',
    tagline: 'Hojas botánicas, musgo y papel natural',
    accentHex: '#059669',
    secondaryHex: '#34D399',
    darkBgHex: '#07130D',
    lightBgHex: '#F3F7F2',
    recommendedMode: 'light',
  },
  {
    id: 'gotico',
    label: 'Gótico',
    tagline: 'Obsidiana, granate catedral y marfil',
    accentHex: '#9F1239',
    secondaryHex: '#FB7185',
    darkBgHex: '#0B070C',
    lightBgHex: '#F5F1EE',
    recommendedMode: 'dark',
  },
  {
    id: 'aura',
    label: 'Aura',
    tagline: 'Bruma índigo, turquesa serena y nácar',
    accentHex: '#4F46E5',
    secondaryHex: '#38BDF8',
    darkBgHex: '#090D1A',
    lightBgHex: '#F4F7FF',
    recommendedMode: 'dark',
  },
  {
    id: 'floral',
    label: 'Floral',
    tagline: 'Pétalos de rosa, lino cálido y salvia',
    accentHex: '#BE185D',
    secondaryHex: '#F472B6',
    darkBgHex: '#150B11',
    lightBgHex: '#FDF7F8',
    recommendedMode: 'light',
  },
  {
    id: 'metal',
    label: 'Metal',
    tagline: 'Titanio cepillado, acero y cromo frío',
    accentHex: '#475569',
    secondaryHex: '#94A3B8',
    darkBgHex: '#0A0E14',
    lightBgHex: '#F1F5F9',
    recommendedMode: 'dark',
  },
  {
    id: 'oro',
    label: 'Oro',
    tagline: 'Ámbar imperial, ébano y pergamino dorado',
    accentHex: '#B45309',
    secondaryHex: '#F59E0B',
    darkBgHex: '#120D05',
    lightBgHex: '#FCF8F0',
    recommendedMode: 'dark',
  },
];

export type PlatformRole =
  | 'superadmin'
  | 'administrador'
  | 'moderador'
  | 'docente'
  | 'estudiante';

export type InstructorCategory =
  | 'docente_institucional'
  | 'profesor_universitario'
  | 'instructor_fp'
  | 'instructor_oficio'
  | 'instructor_independiente'
  | 'especialista';

export type VerificationStatus =
  | 'no_solicitado'
  | 'pendiente'
  | 'aprobado'
  | 'rechazado'
  | 'requiere_documentacion'
  | 'revocado';

export type PresenceMode = 'online' | 'away' | 'dnd' | 'invisible';

export type AccountStatus = 'activo' | 'advertido' | 'suspendido';

export interface StudentProfile {
  uid: string;
  displayName: string;
  username?: string;
  customFabroId?: string;
  email: string;
  photoURL?: string;
  galleryPhotos?: string[];
  sharedPhrase?: string;
  favoriteBooks?: string;
  favoriteMovies?: string;
  favoriteMusic?: string;
  birthDate?: string;
  isMinor?: boolean;
  parentalConsentApproved?: boolean;
  country?: string;
  province?: string;
  city?: string;
  bio?: string;
  interests?: string[];
  institutions?: string[];
  isStudent?: boolean;
  isInstructor?: boolean;
  instructorCategory?: InstructorCategory;
  verificationStatus?: VerificationStatus;
  specialty?: string;
  experienceSummary?: string;
  reputationPoints?: number;
  presenceMode?: PresenceMode;
  accountStatus?: AccountStatus;
  followedInstructorIds?: string[];
  blockedUserIds?: string[];
  educationLevel: EducationLevel;
  institution?: string;
  career?: string;
  weeklyGoalHours: number;
  themePreference: 'dark' | 'light' | 'system';
  storageUsedBytes: number;
  planTier: 'free' | 'premium';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SubjectAISource {
  title: string;
  url: string;
  domain: string;
  category?: string;
}

export interface Subject {
  id: string;
  userId: string;
  name: string;
  institution?: string;
  level: EducationLevel;
  career?: string;
  professor?: string;
  description?: string;
  color: string;
  syllabus?: string;
  syllabusFileName?: string;
  syllabusFileMime?: string;
  syllabusFileUrl?: string;
  syllabusExtractedText?: string;
  bibliography?: string;
  units: string[];
  progressPercent: number;
  aiAnalysisMarkdown?: string;
  aiAnalysisSources?: SubjectAISource[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NoteAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  libraryDocId?: string;
}

export interface Note {
  id: string;
  userId: string;
  subjectId: string;
  unit?: string;
  folder: string;
  title: string;
  contentHtml: string;
  contentText: string;
  tags: string[];
  attachments: NoteAttachment[];
  offlineAvailable: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type LibraryDocCategory =
  | 'libro'
  | 'pdf'
  | 'programa'
  | 'bibliografia'
  | 'foto_apunte'
  | 'investigacion'
  | 'otro';

export type DocumentReadStatus = 'completo' | 'parcial' | 'pendiente' | 'error';

export interface DocumentCoverageMetadata {
  totalPages: number;
  processedPages: number;
  pendingPages: number;
  readStatus: DocumentReadStatus;
  extractionErrors: string[];
  processedAt: string;
  fragmentCount?: number;
  conceptIndex?: string[];
  authorsDetected?: string[];
}

export interface LibraryDoc {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  category: LibraryDocCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageUrl: string;
  storagePath: string;
  extractedText: string;
  aiAuthorized: boolean;
  tags: string[];
  coverage?: DocumentCoverageMetadata;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ExamQuestion {
  id: string;
  prompt: string;
  type: 'opcion_multiple' | 'desarrollo';
  options: string[];
  correctOptionIndex: number;
  topic: string;
  expectedKeyPoints: string;
  userAnswer?: string;
  selectedOptionIndex?: number;
  isCorrect?: boolean;
  feedback?: string;
  score?: number;
}

export interface Exam {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  mode: 'escrito' | 'oral';
  difficulty: 'basico' | 'intermedio' | 'universitario' | 'avanzado';
  units: string[];
  status: 'en_progreso' | 'completado';
  scorePercent: number;
  questionsCount: number;
  questions: ExamQuestion[];
  weakTopics: string[];
  aiFeedback: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CalendarEventType =
  | 'examen'
  | 'parcial'
  | 'final'
  | 'entrega'
  | 'tp'
  | 'clase'
  | 'recordatorio'
  | 'objetivo';

export interface CalendarEvent {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  type: CalendarEventType;
  date: string;
  time: string;
  notes: string;
  completed: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FlashcardDeck {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  description: string;
  cardCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FlashcardItem {
  id: string;
  userId: string;
  deckId: string;
  question: string;
  answer: string;
  cardType: 'flashcard' | 'vf' | 'opcion_multiple';
  options: string[];
  correctOptionIndex: number;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewDate: string;
  lastResult: 'pendiente' | 'dificil' | 'bien' | 'facil';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudySession {
  id: string;
  userId: string;
  subjectId: string;
  activityType: 'apuntes' | 'tutor_ai' | 'examen' | 'memorizacion' | 'lectura';
  durationMinutes: number;
  topic: string;
  date: string;
  createdAt?: unknown;
}

export type FabroWorkMode =
  | 'DESARROLLO'
  | 'RESUMEN'
  | 'EXPLICAR'
  | 'INVESTIGAR'
  | 'COMPARAR'
  | 'EXAMEN'
  | 'BIBLIOGRAFIA'
  | 'PROGRAMA'
  | 'GLOSARIO'
  | 'REPASO';

export interface AIWebSource {
  title: string;
  url: string;
  domain?: string;
  originType?: string;
  readInFull?: boolean;
  consultedAt?: string;
}

export interface FabroAnalysisMetadata {
  workMode: FabroWorkMode;
  topicTitle: string;
  depthLevel: string;
  docsProcessedCount: number;
  docsSelectedCount: number;
  partialDocsNames?: string[];
  externalSourcesCount: number;
  urlContextReadCount: number;
  generatedSections: string[];
  epistemicCategoriesUsed: string[];
  qualityAuditPassed: boolean;
  missingInfoNotes?: string;
  verifiedReferencesCount: number;
}

export interface SubjectAcademicMemory {
  id: string;
  userId: string;
  subjectId: string;
  developedTopics: string[];
  priorSummaries: string[];
  examQuestionsHistory: string[];
  verifiedBibliography: string[];
  authorsAndTheories: string[];
  studentProgressNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  attachmentName?: string;
  webSources?: AIWebSource[];
  searchQueries?: string[];
  depth?: 'directo' | 'profundo' | 'exhaustivo' | 'desarrollo_completo';
  workMode?: FabroWorkMode;
  analysisMetadata?: FabroAnalysisMetadata;
  providerUsed?: string;
  providerId?: AIProviderId;
  modelUsed?: string;
  accessTier?: AIModelAccessTier;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  routingReason?: string;
  fallbackNotice?: string;
}

export interface DictionaryEntry {
  id: string;
  userId: string;
  subjectId: string;
  term: string;
  normalizedTerm: string;
  category: string;
  phonetic?: string;
  definition: string;
  academicDefinition?: string;
  examples: string[];
  synonyms: string[];
  etymology?: string;
  personalNotes?: string;
  favorite: boolean;
  lookupCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AIChatThread {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  mode: 'sencillo' | 'academico';
  selectedDocIds: string[];
  messages: AIChatMessage[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type BookGenre =
  | 'academico'
  | 'ensayo'
  | 'manual'
  | 'novela'
  | 'cuentos'
  | 'investigacion'
  | 'biografia'
  | 'otro';

export type BookStatus = 'borrador' | 'en_revision' | 'finalizado';

export type BookChapterStatus = 'idea' | 'borrador' | 'revisado' | 'completo';

export interface Book {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  subtitle: string;
  authorName: string;
  genre: BookGenre;
  language: string;
  synopsis: string;
  targetWords: number;
  coverColor: string;
  dedication: string;
  bibliography: string;
  status: BookStatus;
  chaptersCount: number;
  totalWords: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BookChapter {
  id: string;
  userId: string;
  bookId: string;
  orderIndex: number;
  title: string;
  summary: string;
  notes: string;
  contentHtml: string;
  contentText: string;
  wordCount: number;
  status: BookChapterStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const BOOK_GENRE_OPTIONS: Array<{ value: BookGenre; label: string }> = [
  { value: 'academico', label: 'Libro académico / Cátedra' },
  { value: 'ensayo', label: 'Ensayo' },
  { value: 'manual', label: 'Manual o guía práctica' },
  { value: 'investigacion', label: 'Investigación / Tesis' },
  { value: 'novela', label: 'Novela / Ficción' },
  { value: 'cuentos', label: 'Relatos o cuentos' },
  { value: 'biografia', label: 'Biografía / Crónica' },
  { value: 'otro', label: 'Otro género' },
];

export const EDUCATION_LEVEL_OPTIONS: Array<{ value: EducationLevel; label: string }> = [
  { value: 'primaria', label: 'Primaria' },
  { value: 'secundaria', label: 'Secundaria' },
  { value: 'terciario', label: 'Terciario' },
  { value: 'universitario', label: 'Universitario' },
  { value: 'posgrado', label: 'Posgrado' },
  { value: 'autodidacta', label: 'Formación profesional y autodidacta' },
];

export type HubCategoryId =
  | 'Inteligencia artificial conversacional'
  | 'Investigación académica'
  | 'Buscadores de Internet'
  | 'Escritura y corrección'
  | 'Traducción'
  | 'Matemáticas y ciencias'
  | 'PDF y documentos'
  | 'Mapas conceptuales'
  | 'Presentaciones'
  | 'Imágenes'
  | 'Videos'
  | 'Voz y audio'
  | 'Programación'
  | 'Organización y productividad'
  | 'Educación y cursos';

export type HubApiStatus = 'api_real' | 'api_configurable' | 'official_link';

export interface HubTool {
  id: string;
  name: string;
  shortCode: string;
  accentColor: string;
  description: string;
  category: HubCategoryId;
  officialUrl: string;
  serviceType: string;
  pricingSummary: string;
  apiStatus: HubApiStatus;
  apiProviderKey?: 'gemini' | 'openai';
  capabilities: string[];
  educationalUse: string;
  tags: string[];
  active: boolean;
  isCustom?: boolean;
}

export interface HubHistoryItem {
  id: string;
  toolId: string;
  toolName: string;
  category: string;
  officialUrl: string;
  action: 'opened' | 'multi_ai' | 'compared' | 'recommended';
  visitedAt: string;
}

export interface HubUserState {
  userId: string;
  favorites: string[];
  history: HubHistoryItem[];
  customTools: HubTool[];
  disabledToolIds: string[];
  updatedAt?: unknown;
}

// ============================================================================
// FABRO UNIVERSAL EDUCATION PLATFORM TYPES (Modules 1 - 16)
// ============================================================================

export const INSTRUCTOR_CATEGORY_LABELS: Record<InstructorCategory, { label: string; credentialHint: string }> = {
  docente_institucional: {
    label: 'Docente institucional',
    credentialHint: 'Acreditación de institución escolar, secundaria o terciaria.',
  },
  profesor_universitario: {
    label: 'Profesor universitario',
    credentialHint: 'Cátedra universitaria o título habilitante superior.',
  },
  instructor_fp: {
    label: 'Instructor de formación profesional',
    credentialHint: 'Certificación técnica, laboral o centro de formación.',
  },
  instructor_oficio: {
    label: 'Instructor de oficios',
    credentialHint: 'Acreditación de identidad y experiencia práctica en el oficio (no requiere título universitario).',
  },
  instructor_independiente: {
    label: 'Instructor independiente',
    credentialHint: 'Portafolio, trayectoria comprobable o muestra de enseñanza.',
  },
  especialista: {
    label: 'Especialista o capacitador',
    credentialHint: 'Experiencia acreditada o certificación de especialidad.',
  },
};

export interface AcademyTaxonomyGroup {
  id: string;
  area: string;
  subcategories: string[];
}

export const DEFAULT_ACADEMY_TAXONOMY: AcademyTaxonomyGroup[] = [
  {
    id: 'escolar',
    area: 'Educación escolar',
    subcategories: ['Primaria', 'Secundaria', 'Bachillerato', 'Preparación para exámenes'],
  },
  {
    id: 'universitaria',
    area: 'Educación universitaria',
    subcategories: [
      'Abogacía',
      'Medicina',
      'Psicología',
      'Ingeniería',
      'Contabilidad',
      'Administración',
      'Educación',
      'Sociología',
      'Historia',
      'Filosofía',
      'Ciencias Políticas',
      'Informática',
      'Arquitectura',
      'Otras carreras',
    ],
  },
  {
    id: 'idiomas',
    area: 'Idiomas',
    subcategories: ['Inglés', 'Portugués', 'Francés', 'Italiano', 'Alemán', 'Otros idiomas'],
  },
  {
    id: 'tecnologia',
    area: 'Informática y tecnología',
    subcategories: [
      'Programación',
      'Inteligencia artificial',
      'Desarrollo web',
      'Diseño gráfico',
      'Ofimática',
      'Robótica',
      'Ciberseguridad',
    ],
  },
  {
    id: 'oficios',
    area: 'Oficios',
    subcategories: [
      'Electricidad',
      'Carpintería',
      'Mecánica',
      'Plomería',
      'Construcción',
      'Gastronomía',
      'Costura',
      'Peluquería',
      'Reparaciones',
    ],
  },
  {
    id: 'laboral',
    area: 'Formación laboral',
    subcategories: [
      'Marketing',
      'Emprendimientos',
      'Administración',
      'Finanzas',
      'Recursos humanos',
      'Ventas',
      'Gestión empresarial',
    ],
  },
  {
    id: 'personal',
    area: 'Desarrollo personal',
    subcategories: ['Escritura', 'Música', 'Arte', 'Fotografía', 'Comunicación', 'Oratoria'],
  },
];

export interface PublicUserProfile {
  uid: string;
  displayName: string;
  username: string;
  customFabroId?: string;
  photoURL?: string;
  galleryPhotos?: string[];
  sharedPhrase?: string;
  favoriteBooks?: string;
  favoriteMovies?: string;
  favoriteMusic?: string;
  country: string;
  province: string;
  city: string;
  bio: string;
  interests: string[];
  institutions: string[];
  isStudent: boolean;
  isInstructor: boolean;
  instructorCategory: InstructorCategory;
  verificationStatus: VerificationStatus;
  specialty: string;
  experienceSummary: string;
  isMinor: boolean;
  searchableInDirectory: boolean;
  presenceStatus: 'online' | 'away' | 'dnd' | 'offline';
  reputationPoints: number;
  followersCount: number;
  updatedAt?: unknown;
}

export interface InstructorVerificationRequest {
  id: string;
  userId: string;
  applicantName: string;
  contactInfo: string;
  country: string;
  province: string;
  city: string;
  specialty: string;
  category: InstructorCategory;
  experienceDetails: string;
  institution: string;
  evidenceSummary: string;
  evidenceFileUrl: string;
  evidenceFileName: string;
  status: VerificationStatus;
  adminNote: string;
  reviewedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CourseDifficulty = 'inicial' | 'intermedio' | 'avanzado' | 'universitario';
export type CourseVisibility = 'publico' | 'privado' | 'institucional';

export interface Course {
  id: string;
  instructorId: string;
  instructorName: string;
  instructorVerified: boolean;
  instructorCategory: InstructorCategory;
  title: string;
  description: string;
  area: string;
  category: string;
  level: CourseDifficulty;
  objectives: string;
  syllabus: string;
  estimatedHours: number;
  lessonsCount: number;
  visibility: CourseVisibility;
  institution: string;
  isFree: true;
  certificateEnabled: boolean;
  linkedGroupId: string;
  bibliography: string;
  enrolledCount: number;
  ratingSum: number;
  ratingCount: number;
  status: 'activo' | 'archivado';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LessonQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface CourseLesson {
  id: string;
  courseId: string;
  instructorId: string;
  orderIndex: number;
  title: string;
  description: string;
  videoUrl: string;
  youtubeVideoId: string;
  materialPdfUrl: string;
  materialPdfName: string;
  activityPrompt: string;
  quizQuestions: LessonQuizQuestion[];
  durationMinutes: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  instructorId: string;
  status: 'activo' | 'completado' | 'abandonado';
  completedLessonIds: string[];
  quizScores: Record<string, number>;
  progressPercent: number;
  favorite: boolean;
  studentRating: number;
  certificateIssued: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type CommunityGroupType =
  | 'universitario'
  | 'escolar'
  | 'instituto'
  | 'idiomas'
  | 'oficios'
  | 'laboral'
  | 'examenes'
  | 'docentes'
  | 'investigacion'
  | 'libre';

export type GroupVisibility = 'publico' | 'privado' | 'institucional' | 'aprobado_docente';

export interface CommunityGroup {
  id: string;
  creatorId: string;
  creatorName: string;
  name: string;
  description: string;
  groupType: CommunityGroupType;
  visibility: GroupVisibility;
  country: string;
  province: string;
  city: string;
  institutionName: string;
  career: string;
  courseName: string;
  subjectName: string;
  specialty: string;
  linkedCourseId: string;
  allowMinors: boolean;
  memberCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GroupMember {
  userId: string;
  groupId: string;
  displayName: string;
  role: 'admin' | 'docente' | 'moderador' | 'miembro';
  status: 'activo' | 'pendiente' | 'rechazado';
  isMinor: boolean;
  joinedAt?: unknown;
}

export type GroupPostType =
  | 'publicacion'
  | 'pregunta'
  | 'encuesta'
  | 'actividad'
  | 'anuncio'
  | 'material'
  | 'video';

export interface GroupPostComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface GroupPostPollOption {
  id: string;
  label: string;
  voterIds: string[];
}

export interface GroupPost {
  id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorVerified: boolean;
  postType: GroupPostType;
  title: string;
  content: string;
  attachmentUrl?: string;
  attachmentName?: string;
  youtubeVideoId?: string;
  pollOptions: GroupPostPollOption[];
  comments: GroupPostComment[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GroupChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt?: unknown;
}

export interface ClassroomQuizItem {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  responses: Record<string, number>;
}

export interface VirtualClassroom {
  id: string;
  instructorId: string;
  instructorName: string;
  courseId: string;
  title: string;
  description: string;
  scheduledAt: string;
  visibility: CourseVisibility;
  allowedStudentIds: string[];
  youtubeVideoId: string;
  videoTitle: string;
  playbackState: 'playing' | 'paused';
  playbackSeconds: number;
  playbackUpdatedAt: string;
  presentationNotes: string;
  sharedLinks: Array<{ title: string; url: string }>;
  sharedDocTitles: string[];
  activeQuiz?: ClassroomQuizItem | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DirectThread {
  id: string;
  participantIds: string[];
  participantNames: string[];
  hasMinorParticipant: boolean;
  status: 'activo' | 'bloqueado';
  blockedBy: string;
  lastMessagePreview: string;
  unreadBy: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DirectMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt?: unknown;
}

export interface SavedVideoResource {
  id: string;
  addedBy: string;
  addedByName: string;
  youtubeVideoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  area: string;
  subjectTag: string;
  keywords: string[];
  transcriptAvailable: boolean;
  transcriptText: string;
  aiSummaryMarkdown: string;
  isPublic: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SharedLibraryItem {
  id: string;
  uploaderId: string;
  uploaderName: string;
  title: string;
  description: string;
  itemType: 'pdf' | 'documento' | 'presentacion' | 'apunte' | 'guia' | 'bibliografia' | 'enlace' | 'dominio_publico';
  area: string;
  career: string;
  subjectName: string;
  courseName: string;
  fileUrl: string;
  fileName: string;
  authorConfirmedRights: boolean;
  visibility: 'publico' | 'privado';
  downloadsCount: number;
  favoriteUserIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlatformCategoryRecord {
  id: string;
  area: string;
  subcategories: string[];
  active: boolean;
  createdBy: string;
  updatedAt?: unknown;
}

export interface InstitutionRecord {
  id: string;
  name: string;
  institutionType: 'escuela' | 'instituto' | 'universidad' | 'centro_formacion';
  country: string;
  province: string;
  city: string;
  verified: boolean;
  status: 'activa' | 'suspendida';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ModerationReport {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'usuario' | 'curso' | 'grupo' | 'publicacion' | 'mensaje' | 'biblioteca';
  targetId: string;
  targetSummary: string;
  reason: string;
  details: string;
  status: 'pendiente' | 'en_revision' | 'resuelta' | 'desestimada';
  resolutionNote: string;
  reviewedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserSanction {
  id: string;
  userId: string;
  userName: string;
  sanctionType: 'advertencia' | 'suspension' | 'revocacion_docente' | 'reactivacion';
  reason: string;
  status: 'activa' | 'pendiente_apelacion' | 'apelacion_aceptada' | 'levantada';
  appealText: string;
  issuedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt?: unknown;
}

export interface AdminRoleRecord {
  uid: string;
  email: string;
  role: 'superadmin' | 'administrador' | 'moderador';
  grantedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlatformNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  linkSection: NavSectionId;
  read: boolean;
  createdAt?: unknown;
}

// ============================================================================
// FABRO AI GATEWAY — HYBRID MULTI-IA CENTRAL ARCHITECTURE TYPES
// ============================================================================

export type AIProviderId = 'gemini' | 'openai';

export type AIModelAccessTier = 'free_quota' | 'open_selfhosted' | 'commercial';
export type AIRoutingMode = 'automatica' | 'manual' | 'comparacion';
export type AIPlanPolicy = 'plan_gratuito' | 'plan_educativo' | 'plan_administrador';
export type AIRequestStatus =
  | 'pendiente'
  | 'procesando'
  | 'completada'
  | 'error'
  | 'cancelada'
  | 'limite_alcanzado';

export interface AIProviderRecord {
  id: AIProviderId;
  name: string;
  accessTier: AIModelAccessTier;
  enabled: boolean;
  configuredInBackend: boolean;
  envVarName: string;
  defaultModelId: string;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsDocuments: boolean;
  allowFallback: boolean;
  officialUrl: string;
  pricingNote: string;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface AIModelRecord {
  id: string;
  providerId: AIProviderId;
  label: string;
  accessTier: AIModelAccessTier;
  enabled: boolean;
  maxContextTokens: number;
  supportsVision: boolean;
  supportsDocuments: boolean;
  supportsReasoning: boolean;
  inputCostPer1MUsd: number;
  outputCostPer1MUsd: number;
  recommendedFor: string[];
  updatedAt?: unknown;
}

export interface AIProviderStatusRecord {
  id: AIProviderId;
  configured: boolean;
  status: 'activo' | 'pendiente_configuracion' | 'error' | 'desactivado';
  lastTestedAt: string;
  lastLatencyMs: number;
  lastError: string;
  modelTested: string;
  updatedAt?: unknown;
}

export interface AIBudgetConfig {
  id: string;
  dailyGlobalLimitUsd: number;
  monthlyGlobalLimitUsd: number;
  perUserDailyRequestLimit: number;
  perUserDailyTokenLimit: number;
  alertThresholdPercent: number;
  onBudgetExceeded: 'fallback_free' | 'block';
  activePlanDefault: AIPlanPolicy;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface AIAdminSettingsRecord {
  id: 'global';
  defaultRoutingMode: AIRoutingMode;
  allowAutomaticFallback: boolean;
  blockPaidModelsForFreePlan: boolean;
  minorStrictSafeRouting: boolean;
  enableStreaming: boolean;
  retentionDays: number;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface AIRequestRecord {
  id: string;
  userId: string;
  userEmail?: string;
  conversationId: string;
  routingMode: AIRoutingMode;
  providerId: AIProviderId;
  modelId: string;
  accessTier: AIModelAccessTier;
  status: AIRequestStatus;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  errorMessage?: string;
  routingReason?: string;
  createdAt?: unknown;
}

export interface AIUsageRecord {
  id: string;
  scope: 'global' | 'user' | 'provider';
  scopeKey: string;
  dateKey: string;
  monthKey: string;
  requestsCount: number;
  freeRequestsCount: number;
  paidRequestsCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  updatedAt?: unknown;
}

export interface AIConversationRecord {
  id: string;
  userId: string;
  subjectId: string;
  title: string;
  routingMode: AIRoutingMode;
  preferredProviderId: AIProviderId | 'auto';
  preferredModelId: string;
  favorite: boolean;
  messageCount: number;
  lastModelUsed: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AIMessageRecord {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  providerId?: AIProviderId;
  modelId?: string;
  accessTier?: AIModelAccessTier;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  routingReason?: string;
  fallbackNotice?: string;
  favorite?: boolean;
  createdAt?: unknown;
}

export interface FreemiumBudgetStatus {
  monthKey: string;
  monthlyBudgetUsd: number;
  monthCostUsd: number;
  percentUsed: number;
  paidRestricted: boolean;
  paidBlocked: boolean;
  activeThreshold: 0 | 50 | 75 | 90 | 100;
  statusLabel: string;
}

export interface FreemiumSystemLimits {
  freeDailyLimit: number;
  premiumDailyLimit: number;
  resetTimezone: string;
  monthlyBudgetUsd: number;
  warn50Percent: number;
  alert75Percent: number;
  restrictPaid90Percent: number;
  blockPaid100Percent: number;
  freeMaxInputChars: number;
  freeMaxOutputTokens: number;
  premiumMaxInputChars: number;
  premiumMaxOutputTokens: number;
  antiSpamPerMinute: number;
  allowPaidModelsOnFree: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface FreemiumRequestLog {
  id: string;
  uid: string;
  userEmail: string;
  planTier: 'free' | 'premium';
  endpoint: string;
  operationType: string;
  providerId: string;
  modelId: string;
  tierUsed: 'free' | 'paid';
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  status: 'success' | 'error' | 'blocked';
  errorMessage?: string;
  fallbackUsed: boolean;
  latencyMs: number;
  timestamp: string;
  dateKey: string;
  monthKey: string;
}

export interface FreemiumStatus {
  uid: string;
  email: string;
  displayName: string;
  planTier: 'free' | 'premium';
  planLabel: 'GRATIS' | 'PREMIUM';
  dateKey: string;
  timezone: string;
  usedToday: number;
  dailyLimit: number;
  remainingToday: number;
  extraCredits: number;
  totalAvailableToday: number;
  nextResetAt: string;
  nextResetFormatted: string;
  maxInputChars: number;
  maxOutputTokens: number;
  allowPaidModels: boolean;
  budgetStatus: FreemiumBudgetStatus;
  recentRequests: FreemiumRequestLog[];
}

export interface FreemiumAdminAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'budget_50' | 'budget_75' | 'budget_90' | 'budget_100' | 'provider_error' | 'rate_limit';
  thresholdPercent?: number;
  monthKey?: string;
  providerId?: string;
  title: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface FreemiumAdminDashboard {
  generatedAt: string;
  nextResetFormatted: string;
  systemLimits: FreemiumSystemLimits;
  budgetStatus: FreemiumBudgetStatus;
  summary: {
    totalRegisteredUsers: number;
    freeUsersCount: number;
    premiumUsersCount: number;
    usersAtLimitCount: number;
    queriesToday: number;
    costTodayUsd: number;
    queriesThisMonth: number;
    freeQueriesThisMonth: number;
    paidQueriesThisMonth: number;
    tokensInThisMonth: number;
    tokensOutThisMonth: number;
    monthCostUsd: number;
    unacknowledgedAlerts: number;
  };
  byProvider: Record<
    string,
    { queries: number; tokensIn: number; tokensOut: number; costUsd: number; errors: number }
  >;
  byModel: Record<
    string,
    { queries: number; tokensIn: number; tokensOut: number; costUsd: number; errors: number }
  >;
  dailySeries: Array<{
    dateKey: string;
    queries: number;
    freeQueries: number;
    paidQueries: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  }>;
  monthlySeries: Array<{
    monthKey: string;
    queries: number;
    freeQueries: number;
    paidQueries: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  }>;
  users: Array<{
    uid: string;
    email: string;
    displayName: string;
    planTier: 'free' | 'premium';
    subscriptionStatus: string;
    usedToday: number;
    dailyLimit: number;
    atLimit: boolean;
    extraCredits: number;
    tokensToday: number;
    costTodayUsd: number;
    lastSeenAt: string;
  }>;
  alerts: FreemiumAdminAlert[];
  recentRequests: FreemiumRequestLog[];
}

// ============================================================================
// FABRO CONNECT — PERSONAL AI ACCOUNTS & BYOK TYPES
// ============================================================================

export type ConnectProviderId =
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'deepseek'
  | 'qwen'
  | 'mistral'
  | 'grok';

export type ConnectAuthMethod = 'byok' | 'oauth_pkce' | 'web_viewer';

export interface ConnectProviderCatalogEntry {
  id: ConnectProviderId;
  name: string;
  shortName: string;
  description: string;
  officialUrl: string;
  docsKeyUrl: string;
  authMethods: ConnectAuthMethod[];
  oauthSupported: boolean;
  oauthConfigured: boolean;
  oauthStatusNote: string;
  defaultEndpoint: string;
  regionalEndpoints?: Array<{ id: string; label: string; url: string }>;
  defaultModel: string;
  models: Array<{ id: string; label: string; contextK?: number }>;
  billingNote: string;
  supportsPersonalLimit: boolean;
}

export interface PersonalConnectionDTO {
  id: string;
  uid: string;
  providerId: ConnectProviderId;
  providerName: string;
  label: string;
  authMethod: 'byok' | 'oauth_pkce';
  status: 'connected' | 'disconnected' | 'error';
  lastTestStatus: 'verified' | 'failed' | 'untested';
  lastTestedAt: string;
  lastError: string;
  endpointUrl: string;
  regionId?: string;
  selectedModel: string;
  maskedKey: string;
  oauthAccountEmail?: string;
  oauthPlanScope?: 'identity_only' | 'plan_usage' | 'none';
  isDefault: boolean;
  dailyRequestLimit: number;
  monthlyBudgetAlertUsd: number;
  usedToday: number;
  usedThisMonth: number;
  tokensThisMonth: number;
  estimatedPersonalUsdThisMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalUsageLogDTO {
  id: string;
  uid: string;
  connectionId: string;
  connectionLabel: string;
  providerId: ConnectProviderId;
  modelId: string;
  authMethod: 'byok' | 'oauth_pkce';
  billingOwner: 'personal';
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  status: 'success' | 'error' | 'blocked';
  errorMessage?: string;
  latencyMs: number;
  timestamp: string;
  dateKey: string;
  monthKey: string;
}

export interface PersonalUsageSummary {
  dateKey: string;
  monthKey: string;
  queriesToday: number;
  queriesThisMonth: number;
  tokensThisMonth: number;
  estimatedPersonalUsdThisMonth: number;
  recentLogs: PersonalUsageLogDTO[];
}

export interface FabroBillingSummary {
  planLabel: 'GRATIS' | 'PREMIUM';
  usedToday: number;
  dailyLimit: number;
  remainingToday: number;
}

export interface PersonalChatResponse {
  text: string;
  connectionId: string;
  connectionLabel: string;
  providerId: ConnectProviderId;
  providerName: string;
  modelUsed: string;
  authMethod: 'byok' | 'oauth_pkce';
  billingOwner: 'personal';
  fabroQuotaConsumed: false;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
}

export interface PersonalCompareResponse {
  prompt: string;
  billingOwner: 'personal';
  fabroQuotaConsumed: false;
  results: Array<{
    connectionId: string;
    label: string;
    providerId: ConnectProviderId;
    modelUsed: string;
    status: 'ok' | 'error';
    text: string;
    error: string;
    latencyMs: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

// ============================================================================
// FABRO EXPLORER, KNOWLEDGE & RESEARCH TYPES
// ============================================================================

export interface AcademicSearchResult {
  id: string;
  source: string;
  sourceBadge: string;
  title: string;
  authors: string[];
  year: string;
  date: string;
  venue: string;
  abstract: string;
  url: string;
  pdfUrl?: string;
  doi?: string;
  openAccess: boolean;
  citationsCount?: number;
  kind?: string;
}

export interface AcademicAuthorResult {
  id: string;
  name: string;
  orcid: string;
  institution: string;
  country: string;
  worksCount: number;
  citedByCount: number;
  hIndex: number;
  topics: string[];
  url: string;
}

export interface SavedCitationRecord {
  id: string;
  title: string;
  authors: string[];
  year: string;
  venue: string;
  url: string;
  doi?: string;
  sourceBadge: string;
  notes?: string;
  savedAt: string;
}

export type PortalModuleId = 'explorer' | 'ai-browser';

export type PortalCompatibilityStatus =
  | 'untested'
  | 'iframe_compatible'
  | 'external_required'
  | 'auth_warning'
  | 'unreachable';

export type PortalOpeningMode = 'iframe_integrado' | 'apertura_externa';

export interface PortalCategory {
  id: string;
  module: PortalModuleId;
  name: string;
  order: number;
}

export interface PortalEntry {
  id: string;
  module: PortalModuleId;
  name: string;
  url: string;
  categoryId: string;
  categoryName: string;
  iconName: string;
  description: string;
  order: number;
  active: boolean;
  isSystem: boolean;
  compatibilityStatus: PortalCompatibilityStatus;
  openingMode: PortalOpeningMode;
  iframeAllowed: boolean | null;
  requiresExternal: boolean;
  httpStatus?: number;
  xFrameOptions?: string;
  cspFrameAncestors?: string;
  authRestrictionNote?: string;
  statusMessage: string;
  lastTestedAt: string;
}

export interface PortalHistoryItem {
  portalId: string;
  name: string;
  url: string;
  module: PortalModuleId;
  visitedAt: string;
}

export interface ModuleStartPage {
  title: string;
  url: string;
  portalId?: string;
}

export interface ModuleHomeConfig {
  homeUrl: string;
  homeTitle: string;
  defaultPortalId?: string;
  startPages: ModuleStartPage[];
  updatedAt: string;
}

export interface ExternalOnlyRule {
  module: PortalModuleId;
  portalId?: string;
  name: string;
  url: string;
  hostname: string;
  reason: string;
  markedAt: string;
}

export interface UserPortalShortcutPrefs {
  favoritePortalIds: string[];
  customPortals: PortalEntry[];
  hiddenPortalIds: string[];
  externalOnlyPortalIds: string[];
  externalOnlyRules: ExternalOnlyRule[];
}

// ============================================================================
// FABRO HÁBITOS, RUTINAS CONFIGURABLES, NUTRICIÓN Y SALUD DIARIA (IA)
// ============================================================================

export type RoutinePeriod = 'manana' | 'tarde' | 'noche' | 'personalizada';

export type HabitStepCategory =
  | 'ejercicio'
  | 'trabajo'
  | 'limpieza'
  | 'estudio'
  | 'descanso'
  | 'nutricion'
  | 'salud_mental'
  | 'personalizado';

export interface RoutineStep {
  id: string;
  title: string;
  category: HabitStepCategory;
  durationMinutes: number;
  scheduledTime: string;
  habitId?: string;
  notes?: string;
  completedDates: string[];
}

export interface HabitRoutine {
  id: string;
  name: string;
  description: string;
  period: RoutinePeriod;
  daysOfWeek: number[]; // 0=Dom .. 6=Sab
  active: boolean;
  steps: RoutineStep[];
  createdAt: string;
}

export type NutritionGoal =
  | 'energia_concentracion'
  | 'equilibrio_general'
  | 'rendimiento_fisico'
  | 'control_saludable';

export type DietaryPreference =
  | 'sin_restricciones'
  | 'vegetariana'
  | 'vegana'
  | 'sin_tacc'
  | 'sin_lactosa'
  | 'mediterranea';

export type MealSlotId = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'colacion';

export interface DailyMealItem {
  id: string;
  slot: MealSlotId;
  slotLabel: string;
  title: string;
  foods: string[];
  benefits: string;
  approxKcal: number;
  prepMinutes: number;
}

export interface NutritionProfile {
  goal: NutritionGoal;
  preference: DietaryPreference;
  restrictions: string;
  waterTargetGlasses: number;
  notes: string;
}

export interface NutritionDailyLog {
  dateKey: string;
  waterGlasses: number;
  completedMealIds: string[];
}

export type WellnessFocusArea =
  | 'equilibrio_integral'
  | 'estres_estudio'
  | 'energia_movimiento'
  | 'sueno_descanso';

export interface WellnessSuggestionItem {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  category: string;
  actionableStep: string;
}

export interface DailyWellnessBundle {
  dateKey: string;
  dailyHeadline: string;
  focusArea: string;
  mentalHealth: WellnessSuggestionItem[];
  physicalHealth: WellnessSuggestionItem[];
  nutritionTip: {
    title: string;
    summary: string;
    hydrationReminder: string;
  };
  generatedAt: string;
  modelUsed: string;
}

// ============================================================================
// EL ÚLTIMO DÍA DE TU VIDA — MODULE INTEGRATED IN FABRO
// ============================================================================

export type LastDayPrimaryEmotion =
  | 'alegria'
  | 'tristeza'
  | 'enojo'
  | 'preocupacion'
  | 'gratitud'
  | 'esperanza'
  | 'calma'
  | 'otro';

export type LastDayActivityCategory =
  | 'habitual'
  | 'felicidad'
  | 'sueno'
  | 'bienestar'
  | 'vinculos'
  | 'creatividad'
  | 'descanso'
  | 'otro';

export type LastDayActivityStatus =
  | 'pendiente'
  | 'en_curso'
  | 'pausado'
  | 'completada'
  | 'trasladada';

export type LastDayDreamCategory =
  | 'viajes'
  | 'familia'
  | 'aprendizaje'
  | 'salud'
  | 'creatividad'
  | 'proyecto'
  | 'naturaleza'
  | 'otro';

export type LastDayDreamStatus = 'pendiente' | 'en_marcha' | 'cumplido';

export type LastDayWritingType =
  | 'diario'
  | 'carta'
  | 'poema'
  | 'cancion'
  | 'relato'
  | 'autobiografia';

export type LastDayMemoryMediaType = 'foto' | 'video' | 'preferencia';

export type LastDayMemoryPrefKind =
  | 'recuerdo'
  | 'musica'
  | 'pelicula'
  | 'libro'
  | 'lugar'
  | 'frase'
  | 'otro';

export interface LastDayReflection {
  id: string;
  userId: string;
  dateKey: string;
  dailyAnswer: string;
  gratitudeNote: string;
  tomorrowPriorities: string[];
  tomorrowPrepDone: boolean;
  eveningNote: string;
  happinessScore: number;
  primaryEmotion: LastDayPrimaryEmotion;
  secondaryEmotions: string[];
  emotionNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LastDayActivity {
  id: string;
  userId: string;
  dateKey: string;
  title: string;
  category: LastDayActivityCategory;
  scheduledTime: string;
  durationMinutes: number;
  elapsedSeconds: number;
  status: LastDayActivityStatus;
  notes: string;
  rolledOverFromDate: string;
  isHabitualTemplate: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LastDayDream {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: LastDayDreamCategory;
  status: LastDayDreamStatus;
  targetDate: string;
  steps: string[];
  linkedCalendarEventId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LastDayWriting {
  id: string;
  userId: string;
  writingType: LastDayWritingType;
  title: string;
  contentHtml: string;
  contentText: string;
  moodTag: string;
  wordCount: number;
  dateKey: string;
  aiSummary: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LastDayMemory {
  id: string;
  userId: string;
  mediaType: LastDayMemoryMediaType;
  prefKind: LastDayMemoryPrefKind;
  title: string;
  story: string;
  mediaUrl: string;
  storagePath: string;
  youtubeVideoId: string;
  creatorOrArtist: string;
  locationOrPeople: string;
  memoryDate: string;
  favorite: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LastDayLegacy {
  id: string;
  userId: string;
  recipientName: string;
  relationship: string;
  title: string;
  message: string;
  mediaHint: string;
  consentConfirmed: true;
  privateOnly: true;
  autoSendDisabled: true;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ContactRequest {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  message: string;
  hasMinorParticipant: false;
  status: 'pendiente' | 'aceptada' | 'rechazada';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ExerciseLevelId = 'inicial' | 'intermedio' | 'avanzado' | 'maestro';

export type ExerciseFocusCategory =
  | 'respiracion'
  | 'relajacion'
  | 'estiramientos'
  | 'movilidad'
  | 'fuerza'
  | 'cardio'
  | 'meditacion'
  | 'descanso'
  | 'bienestar_emocional'
  | 'postura';

export type ExerciseDemoAnimationId =
  | 'box_breath'
  | 'neck_shoulder'
  | 'cat_cow'
  | 'squat_chair'
  | 'plank_hold'
  | 'jumping_pulse'
  | 'calm_scan'
  | 'stretch_hamstring';

export interface ExerciseStep {
  name: string;
  durationSec: number;
  repsHint: string;
  cue: string;
}

export interface ExerciseRoutine {
  id: string;
  title: string;
  level: ExerciseLevelId;
  category: ExerciseFocusCategory;
  totalMinutes: number;
  caloriesApprox: number;
  description: string;
  objective?: string;
  musclesWorked?: string[];
  beginnerAlternative?: string;
  safetyWarning?: string;
  demoAnim?: ExerciseDemoAnimationId;
  steps: ExerciseStep[];
}

export type FabroSectorId = 'estudio' | 'bienestar' | 'social' | 'ia' | 'configuracion';

export interface SectorAiPreference {
  sector: FabroSectorId;
  providerMode: 'auto' | 'fabro_gemini' | 'fabro_openai' | 'personal';
  personalConnectionId?: string;
  preferredModel?: string;
}

export type SectorAiPreferencesMap = Record<FabroSectorId, SectorAiPreference>;

export interface ExerciseLogEntry {
  id: string;
  routineId: string;
  routineTitle: string;
  level: ExerciseLevelId;
  durationMinutes: number;
  completedAt: string;
}

export type ZodiacSignId =
  | 'aries'
  | 'tauro'
  | 'geminis'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'escorpio'
  | 'sagitario'
  | 'capricornio'
  | 'acuario'
  | 'piscis';

export interface ZodiacSignMeta {
  id: ZodiacSignId;
  name: string;
  symbol: string;
  dateRange: string;
  element: 'Fuego' | 'Tierra' | 'Aire' | 'Agua';
  planet: string;
  traits: string;
  compatibleWith: ZodiacSignId[];
}

export interface LuckyNumbersEntry {
  id: string;
  numbers: number[];
  modeLabel: string;
  rangeLabel: string;
  createdAt: string;
  note?: string;
}

export type CalorieMealCategory = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'snack' | 'bebida';

export interface CalorieFoodEntry {
  id: string;
  dateKey: string;
  name: string;
  category: CalorieMealCategory;
  portion: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  createdAt: string;
}

export interface CalorieBurnEntry {
  id: string;
  dateKey: string;
  activity: string;
  minutes: number;
  caloriesBurned: number;
  createdAt: string;
}



