export type ThemeId =
  | 'estandar'
  | 'futuro-azul-blanco'
  | 'futuro-turquesa-verde'
  | 'futuro-blanco-verde'
  | 'futuro-cobalto-neon'
  | 'ecologico'
  | 'gotico'
  | 'aura'
  | 'floral'
  | 'oro'
  | 'metal'
  | 'minimalista-claro'
  | 'azul-noche-dorado'
  | 'esmeralda-profundo'
  | 'atardecer-coral'
  | 'marino-nordico'
  | 'violeta-obsidian'
  | 'grafito-ambar'
  | 'aurora-boreal'
  | 'lavanda-serena'
  | 'terracota-sol'
  | 'medianoche-rubi'
  | 'bosque-musgo';

export type FiveSectorId =
  | 'estudio'
  | 'bienestar'
  | 'social'
  | 'ia'
  | 'configuracion';

export type SectorId = 'inicio' | 'hoy' | 'herramientas' | FiveSectorId;

export type StudySubmenuId =
  | 'academico-panel'
  | 'materias-apuntes'
  | 'biblioteca-glosario'
  | 'mapas-flashcards'
  | 'examenes-calendario'
  | 'investigacion-fuentes';

export type WellnessSubmenuId =
  | 'mi-vida'
  | 'organizador-integral'
  | 'organizacion-calorias'
  | 'salud-ejercicios'
  | 'bienestar-emocional'
  | 'escritura-recuerdos';

export type SocialSubmenuId =
  | 'fabro-id'
  | 'amistades'
  | 'mensajeria'
  | 'push-to-talk'
  | 'comunidades-seguridad';

export type AISubmenuId =
  | 'claves-byok'
  | 'asistente-api'
  | 'chat-comparador'
  | 'analisis-documentos';

export type ConfigSubmenuId =
  | 'fabro-connect'
  | 'nubes-respaldos'
  | 'boveda-ideas'
  | 'notificaciones'
  | 'config-general';

export type SubmenuId =
  | 'dashboard'
  | 'hoy-cosmos'
  | 'centro-herramientas'
  | StudySubmenuId
  | WellnessSubmenuId
  | SocialSubmenuId
  | AISubmenuId
  | ConfigSubmenuId;

export interface NavDestination {
  sector: SectorId;
  submenu: SubmenuId;
}

export type PinnedToolSize = 'compact' | 'wide';
export type WorkspaceColumns = 2 | 3;

export interface PinnedToolEntry {
  key: string;
  sector: FiveSectorId;
  submenu: SubmenuId;
  size: PinnedToolSize;
}

export interface SubmenuDefinition {
  id: SubmenuId;
  sector: FiveSectorId;
  groupLabel: string;
  label: string;
  shortLabel: string;
  description: string;
  keywords: string;
}

export interface SectorPalette {
  primary: string;
  secondary: string;
  shadowRgba: string;
  gradientCss: string;
  softBgCss: string;
}

export interface SectorDefinition {
  id: FiveSectorId;
  number: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  accentNote: string;
  defaultSubmenu: SubmenuId;
  palette: SectorPalette;
  submenus: SubmenuDefinition[];
}

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  isDark: boolean;
  description: string;
  swatches: [string, string, string, string];
}

export interface LocalUserProfile {
  displayName: string;
  fabroId: string;
  username?: string;
  photoURL?: string;
  birthDate?: string;
  isMinor?: boolean;
  authUid?: string;
  fabroIdConfigured?: boolean;
  dailyPhrase: string;
  icebreaker?: string;
  privacyMode: 'todos' | 'grupo' | 'invisible';
  shareTastesPublicly: boolean;
  tastes: {
    music: string;
    movies: string;
    books: string;
    food: string;
    drinks: string;
  };
}

export interface ByokProviderKey {
  id: string;
  providerName: string;
  endpointFormat: 'openai-compatible' | 'gemini' | 'anthropic-compatible' | 'custom';
  baseUrl: string;
  modelName: string;
  maskedKey: string;
  storedLocally: boolean;
  testedStatus: 'untested' | 'ready' | 'error';
  updatedAt: string;
}

export interface ConnectProviderItem {
  id: 'google-drive' | 'onedrive' | 'dropbox' | 'calendars' | 'ai-keys';
  name: string;
  category: string;
  status: 'disconnected' | 'local-draft' | 'ready';
  folderOrScope: string;
  permissionsSummary: string;
  lastTestedAt: string | null;
}

export interface ActivityEntry {
  id: string;
  sector: SectorId;
  submenu: SubmenuId;
  label: string;
  timestamp: string;
}

export interface NotificationEntry {
  id: string;
  title: string;
  detail: string;
  read: boolean;
  createdAt: string;
  target: NavDestination;
}

export interface NotificationPreferences {
  enabled: boolean;
  pomodoroAndRoutines: boolean;
  chatMessages: boolean;
  scheduledReminders: boolean;
  sound: boolean;
  vibrate: boolean;
}

export interface ScheduledReminderItem {
  id: string;
  title: string;
  sector: 'estudio' | 'bienestar';
  submenu: SubmenuId;
  triggerAtMs: number;
  fired: boolean;
  createdAt: string;
}

export interface NetworkSnapshot {
  isOnline: boolean;
  syncStatus: 'sincronizado-local' | 'pendiente-red' | 'modo-offline';
  downlinkMbps: number | null;
  latencyMs: number | null;
  effectiveType: string;
  measuredAt: string | null;
  measuring: boolean;
}

export type QuickActionType = 'note' | 'mood' | 'ptt' | 'pomodoro' | null;

export interface QuickNoteItem {
  id: string;
  title: string;
  body: string;
  subject: string;
  createdAt: string;
}

export interface MoodLogItem {
  id: string;
  score: number;
  emotion: string;
  habit: string;
  timestamp: string;
}

export type FriendAvailability = 'online' | 'offline' | 'busy';

export interface FriendContact {
  id: string;
  fabroId: string;
  displayName: string;
  bio: string;
  availability: FriendAvailability;
  lastSeenLabel: string;
  trustedGroup: boolean;
  addedAt: string;
}

export interface FriendRequestItem {
  id: string;
  fabroId: string;
  displayName: string;
  note: string;
  direction: 'incoming' | 'outgoing';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface ChatMessageItem {
  id: string;
  sender: string;
  text: string;
  time: string;
  own?: boolean;
  starred?: boolean;
  reactions?: string[];
  replyTo?: { id: string; sender: string; text: string };
  audioUrl?: string;
  sticker?: string;
  recipientId?: string;
  deliveryStatus?: 'queued-offline' | 'delivered-local' | 'read';
}

export interface AcademicAgendaTask {
  id: string;
  task: string;
  subject: string;
  date: string;
  done: boolean;
}

export interface PomodoroSessionLog {
  id: string;
  subject: string;
  minutes: number;
  completedAt: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  parentId: string | null;
  color: string;
  x: number;
  y: number;
}

export interface ClassVoiceNote {
  id: string;
  subject: string;
  title: string;
  durationSec: number;
  audioDataUrl: string;
  createdAt: string;
}

export interface NoteAudioClip {
  id: string;
  label: string;
  durationSec: number;
  audioDataUrl: string;
  createdAt: string;
}

export interface AdvancedNoteItem {
  id: string;
  title: string;
  subject: string;
  folder: string;
  tags: string[];
  favorite: boolean;
  mainIdea: string;
  summaryText: string;
  contentHtml: string;
  contentText: string;
  audioClips: NoteAudioClip[];
  createdAt: string;
  updatedAt: string;
}

export interface GlossaryTermItem {
  id: string;
  subject: string;
  term: string;
  definition: string;
  createdAt: string;
}

export interface GradeAssessment {
  id: string;
  name: string;
  type: 'Parcial' | 'TP' | 'Final';
  weight: number;
  score: number | null;
}

export interface GradeSubject {
  id: string;
  subject: string;
  passTarget: number;
  promoteTarget: number;
  assessments: GradeAssessment[];
}

export interface SrsFlashcard {
  id: string;
  subject: string;
  front: string;
  back: string;
  difficulty: 'nueva' | 'dificil' | 'regular' | 'facil';
  intervalLabel: string;
  reviews: number;
}

export interface HydrationSleepState {
  date: string;
  waterMl: number;
  waterGoalMl: number;
  sleepHours: number;
  sleepQuality: 'Excelente' | 'Buena' | 'Regular' | 'Ligera';
  history: Array<{ date: string; waterMl: number; sleepHours: number; sleepQuality: string }>;
}

export interface TimeCapsuleEntry {
  id: string;
  title: string;
  content: string;
  audioDataUrl?: string;
  openDate: string;
  createdAt: string;
  unlockedManually?: boolean;
}

export interface WorkoutLogEntry {
  id: string;
  routine: string;
  rounds: number;
  reps: number;
  durationLabel: string;
  dateLabel: string;
}

export interface EphemeralStory {
  id: string;
  author: string;
  fabroId: string;
  statusTag: string;
  text: string;
  imageDataUrl?: string;
  ringGradient: string;
  expiresLabel: string;
  createdAtMs: number;
}

export interface WallPollOption {
  id: string;
  label: string;
  votes: number;
}

export interface WallPostItem {
  id: string;
  author: string;
  fabroId: string;
  text: string;
  likes: number;
  createdAt: string;
  poll?: {
    question: string;
    votedOptionId: string | null;
    options: WallPollOption[];
  };
}

export interface StudyRoomItem {
  id: string;
  name: string;
  category: string;
  challengeTitle: string;
  targetDays: number;
  myStreakDays: number;
  joined: boolean;
  sharedNotes: Array<{ id: string; author: string; text: string }>;
  ranking: Array<{ name: string; days: number }>;
}

export interface IdeaVaultItem {
  id: string;
  title: string;
  sector: FiveSectorId | 'general';
  description: string;
  priority: 'esencial' | 'muy-util' | 'experimento';
  status: 'propuesta' | 'en-evaluacion' | 'favorita';
  votes: number;
  votedByMe: boolean;
  author: string;
  createdAt: string;
}

export interface StudyQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface StudyQuiz {
  id: string;
  title: string;
  subject: string;
  questions: StudyQuizQuestion[];
}

export interface GuidedReflectionItem {
  id: string;
  title: string;
  prompt: string;
  answer: string;
  stoicQuote: string;
}

export interface BalancedPlannerItem {
  id: string;
  time: string;
  block: 'Enfoque' | 'Descanso' | 'Hidratación';
  activity: string;
  done: boolean;
}

export type SharedResourcePayload =
  | {
      v: 1;
      kind: 'note';
      title: string;
      subject: string;
      body: string;
      mainIdea?: string;
      summaryText?: string;
      tags?: string[];
      glossary?: Array<{ term: string; definition: string }>;
      author?: string;
    }
  | {
      v: 1;
      kind: 'flashcards';
      title: string;
      subject: string;
      cards: Array<{ front: string; back: string }>;
      author?: string;
    }
  | {
      v: 1;
      kind: 'quiz';
      title: string;
      subject: string;
      questions: StudyQuizQuestion[];
      author?: string;
    }
  | {
      v: 1;
      kind: 'concept-map';
      title: string;
      nodes: ConceptNode[];
      author?: string;
    }
  | {
      v: 1;
      kind: 'routine';
      title: string;
      category: string;
      workSec: number;
      restSec: number;
      rounds: number;
      steps: string[];
      author?: string;
    }
  | {
      v: 1;
      kind: 'stoic';
      title: string;
      prompt: string;
      reflection: string;
      quote?: string;
      author?: string;
    };

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

export type QuoteCategory = 'Sabiduría' | 'Estudio' | 'Ánimo' | 'Vínculos' | 'Calma';

export interface UserQuoteItem {
  id: string;
  text: string;
  author: string;
  category: QuoteCategory;
  likes: number;
  likedByMe?: boolean;
  createdAt: string;
}

export interface CachedWeatherSnapshot {
  cityName: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  apparentC: number;
  humidityPct: number;
  windKmh: number;
  weatherCode: number;
  isDay: boolean;
  dailyMaxC: number;
  dailyMinC: number;
  fetchedAtIso: string;
  forecastDays: Array<{
    dateLabel: string;
    weatherCode: number;
    maxC: number;
    minC: number;
  }>;
}

export interface CalculatorHistoryEntry {
  id: string;
  expression: string;
  result: string;
  createdAt: string;
}

// ------------------------------------------------------------------
// Organizador Integral (Inbox, Time Blocking, Eisenhower, Revisión Diaria)
// ------------------------------------------------------------------
export type OrganizerTabId = 'inbox' | 'bloques' | 'matriz' | 'revision';

export type EisenhowerQuadrant =
  | 'hacer-ahora'
  | 'planificar'
  | 'delegar-rapido'
  | 'posponer';

export type TimeBlockSector = 'estudio' | 'bienestar' | 'personal';

export type TimeBlockDuration = 30 | 45 | 60 | 120;

export interface InboxCaptureItem {
  id: string;
  text: string;
  createdAt: string;
  createdAtMs: number;
}

export interface OrganizerTaskItem {
  id: string;
  title: string;
  quadrant: EisenhowerQuadrant;
  subject: string;
  sector: TimeBlockSector;
  done: boolean;
  isTop3Priority: boolean;
  scheduledDate: string; // YYYY-MM-DD
  createdAt: string;
}

export interface TimeBlockItem {
  id: string;
  title: string;
  startHour: number; // 6..22
  startMinute: 0 | 30;
  durationMinutes: TimeBlockDuration;
  sector: TimeBlockSector;
  subject: string;
  done: boolean;
  dateKey: string; // YYYY-MM-DD
}

export interface DailyReviewState {
  dateKey: string;
  top3TaskIds: string[];
  morningIntention: string;
  nightReflection: string;
  nightGratitude: string;
  rolledOverAt?: string;
}

// ------------------------------------------------------------------
// FABRO ID Auth & Cloud Firestore Sync Types
// ------------------------------------------------------------------
export type AuthPresenceStatus = 'online' | 'focus' | 'invisible';

export type SyncStatusState =
  | 'guest-local'
  | 'cloud-synced'
  | 'syncing'
  | 'local-offline'
  | 'sync-error';

export interface AuthUserSummary {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  fabroId: string;
  photoURL: string;
  birthDate: string;
  isMinor: boolean;
  presenceStatus: AuthPresenceStatus;
  providers: string[];
  emailVerified: boolean;
}




