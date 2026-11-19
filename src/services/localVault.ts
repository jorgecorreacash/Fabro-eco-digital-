import { openDB, type IDBPDatabase } from 'idb';
import type {
  AcademicAgendaTask,
  ActivityEntry,
  AdvancedNoteItem,
  BalancedPlannerItem,
  ByokProviderKey,
  CachedWeatherSnapshot,
  ChatMessageItem,
  ConceptNode,
  ConnectProviderItem,
  DailyReviewState,
  EphemeralStory,
  FriendContact,
  FriendRequestItem,
  GlossaryTermItem,
  GradeSubject,
  GuidedReflectionItem,
  HydrationSleepState,
  IdeaVaultItem,
  InboxCaptureItem,
  LocalUserProfile,
  MoodLogItem,
  NotificationEntry,
  NotificationPreferences,
  OrganizerTaskItem,
  PinnedToolEntry,
  PomodoroSessionLog,
  QuickNoteItem,
  ScheduledReminderItem,
  SrsFlashcard,
  StudyQuiz,
  StudyRoomItem,
  ThemeId,
  TimeBlockItem,
  TimeCapsuleEntry,
  UserQuoteItem,
  WallPostItem,
  WorkoutLogEntry,
  ZodiacSignId,
} from '../types/ecosystem';

const DB_NAME = 'fabro-ecosystem-vault';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

const LS_PREFIX = 'fabro_stage1_';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> | null {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

export async function vaultGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = getDb();
    if (db) {
      const instance = await db;
      const val = await instance.get(STORE_NAME, key);
      if (val !== undefined) return val as T;
    }
  } catch {
    // Fallback to localStorage below
  }

  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    // ignore storage errors
  }
  return fallback;
}

export async function vaultSet<T>(key: string, value: T): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    // Avoid filling LocalStorage with heavy payloads; IndexedDB handles full persistence cleanly
    if (serialized.length < 280000) {
      localStorage.setItem(`${LS_PREFIX}${key}`, serialized);
    }
  } catch {
    // ignore quota errors
  }

  try {
    const db = getDb();
    if (db) {
      const instance = await db;
      await instance.put(STORE_NAME, value, key);
    }
  } catch {
    // ignore IndexedDB errors when private browsing restricts IDB
  }
}

export async function vaultSetIdbOnly<T>(key: string, value: T): Promise<void> {
  try {
    const db = getDb();
    if (db) {
      const instance = await db;
      await instance.put(STORE_NAME, value, key);
      return;
    }
  } catch {
    // fallback if IDB unavailable
  }
  await vaultSet(key, value);
}

export async function vaultClearAll(): Promise<void> {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }

  try {
    const db = getDb();
    if (db) {
      const instance = await db;
      await instance.clear(STORE_NAME);
    }
  } catch {
    // ignore
  }
}

export async function vaultExportSnapshot(): Promise<Record<string, unknown>> {
  const [
    profile,
    theme,
    favorites,
    recents,
    notifications,
    byokKeys,
    connectItems,
    quickNotes,
    moodLogs,
    ideasVault,
    friendsList,
    friendRequests,
    pinnedTools,
    userQuotes,
    inboxItems,
    organizerTasks,
    timeBlocks,
  ] = await Promise.all([
    vaultGet<LocalUserProfile>('profile', DEFAULT_LOCAL_PROFILE),
    vaultGet<ThemeId>('theme', 'estandar'),
    vaultGet<string[]>('favorites', DEFAULT_FAVORITES),
    vaultGet<ActivityEntry[]>('recents', []),
    vaultGet<NotificationEntry[]>('notifications', DEFAULT_NOTIFICATIONS),
    vaultGet<ByokProviderKey[]>('byok_keys', []),
    vaultGet<ConnectProviderItem[]>('connect_items', DEFAULT_CONNECT_ITEMS),
    vaultGet<QuickNoteItem[]>('quick_notes', []),
    vaultGet<MoodLogItem[]>('mood_logs', []),
    vaultGet<IdeaVaultItem[]>('ideas_vault', DEFAULT_IDEAS_VAULT),
    vaultGet<FriendContact[]>('friends_list', DEFAULT_FRIENDS_LIST),
    vaultGet<FriendRequestItem[]>('friend_requests', DEFAULT_FRIEND_REQUESTS),
    vaultGet<PinnedToolEntry[]>('pinned_tools', DEFAULT_PINNED_TOOLS),
    vaultGet<UserQuoteItem[]>('user_quotes', DEFAULT_USER_QUOTES),
    vaultGet<InboxCaptureItem[]>('org_inbox_items', DEFAULT_INBOX_ITEMS),
    vaultGet<OrganizerTaskItem[]>('org_tasks', DEFAULT_ORGANIZER_TASKS),
    vaultGet<TimeBlockItem[]>('org_time_blocks', DEFAULT_TIME_BLOCKS),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    storage: 'IndexedDB + LocalStorage (Offline-First)',
    theme,
    profile,
    favorites,
    pinnedTools,
    recents,
    notifications,
    byokKeysCount: byokKeys.length,
    connectItems,
    quickNotesCount: quickNotes.length,
    moodLogsCount: moodLogs.length,
    ideasVaultCount: ideasVault.length,
    friendsCount: friendsList.length,
    friendRequestsCount: friendRequests.length,
    userQuotesCount: userQuotes.length,
    inboxItemsCount: inboxItems.length,
    organizerTasksCount: organizerTasks.length,
    timeBlocksCount: timeBlocks.length,
  };
}

export const DEFAULT_LOCAL_PROFILE: LocalUserProfile = {
  displayName: 'Invitado FABRO',
  fabroId: 'FBR-INVITADO',
  username: 'invitado_fabro',
  fabroIdConfigured: false,
  bio: 'Construyendo hábitos de estudio consciente, bienestar diario y proyectos personales en mi Ecosistema Digital FABRO.',
  interests: ['Estudio Activo', 'Calistenia', 'Lectura', 'Organización'],
  currentActivity: 'En modo enfoque · Explorando FABRO',
  publicNoteIds: ['adv-seed-1'],
  publicRoutineIds: ['mobility-default'],
  followingIds: ['comm-camila', 'comm-lucia'],
  followersCount: 12,
  dailyPhrase: 'Si hoy fuera tu último día, elegí vivir con claridad, gratitud y propósito.',
  icebreaker: 'Preguntame qué libro estoy leyendo o qué hábito de 7 días arrancamos hoy.',
  privacyMode: 'grupo',
  shareTastesPublicly: true,
  tastes: {
    music: 'Instrumental, clásica y acústica',
    movies: 'Drama humano y ciencia ficción reflexiva',
    books: 'Estoicismo, filosofía práctica e historia',
    food: 'Cocina casera mediterránea',
    drinks: 'Café filtrado y té verde',
  },
};

export const DEFAULT_FAVORITES: string[] = [
  'social:mensajeria',
  'social:amistades',
  'estudio:academico-panel',
  'estudio:materias-apuntes',
  'bienestar:organizacion-calorias',
  'ia:claves-byok',
];

export const DEFAULT_PINNED_TOOLS: PinnedToolEntry[] = [
  { key: 'social:mensajeria', sector: 'social', submenu: 'mensajeria', size: 'wide' },
  { key: 'estudio:academico-panel', sector: 'estudio', submenu: 'academico-panel', size: 'compact' },
  { key: 'social:amistades', sector: 'social', submenu: 'amistades', size: 'compact' },
  { key: 'estudio:materias-apuntes', sector: 'estudio', submenu: 'materias-apuntes', size: 'compact' },
  { key: 'bienestar:organizacion-calorias', sector: 'bienestar', submenu: 'organizacion-calorias', size: 'compact' },
  { key: 'ia:claves-byok', sector: 'ia', submenu: 'claves-byok', size: 'compact' },
];

export const DEFAULT_NOTIFICATIONS: NotificationEntry[] = [
  {
    id: 'notif-stage1',
    title: 'FABRO Mobile-First y Colores por Sector',
    detail:
      'Explorá Pomodoro, mapas conceptuales, respiración 4-7-8, historias 24h y botones táctiles de 44px.',
    read: false,
    createdAt: 'Hoy',
    target: { sector: 'inicio', submenu: 'dashboard' },
  },
  {
    id: 'notif-ideas',
    title: 'Nueva Bóveda de Ideas abierta',
    detail:
      'Compartí qué herramientas nuevas te gustaría sumar a FABRO para facilitarte el día.',
    read: false,
    createdAt: 'Hoy',
    target: { sector: 'configuracion', submenu: 'boveda-ideas' },
  },
  {
    id: 'notif-byok',
    title: 'Centro de IA bajo modelo BYOK estricto',
    detail:
      'No hay claves ni APIs precargadas. Cuando quieras usar IA, cargá tu propia clave oficial en Sector 4.',
    read: true,
    createdAt: 'Hoy',
    target: { sector: 'ia', submenu: 'claves-byok' },
  },
];

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  enabled: true,
  pomodoroAndRoutines: true,
  chatMessages: true,
  scheduledReminders: true,
  sound: true,
  vibrate: true,
};

export const DEFAULT_SCHEDULED_REMINDERS: ScheduledReminderItem[] = [];

export const DEFAULT_CONNECT_ITEMS: ConnectProviderItem[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'Almacenamiento en nube',
    status: 'disconnected',
    folderOrScope: '/FABRO-Respaldos',
    permissionsSummary: 'Solo archivos creados por FABRO (drive.file)',
    lastTestedAt: null,
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    category: 'Almacenamiento en nube',
    status: 'disconnected',
    folderOrScope: '/Documentos/FABRO',
    permissionsSummary: 'Lectura/escritura en carpeta dedicada',
    lastTestedAt: null,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    category: 'Almacenamiento en nube',
    status: 'disconnected',
    folderOrScope: '/Apps/FABRO',
    permissionsSummary: 'Carpeta aislada de la aplicación',
    lastTestedAt: null,
  },
  {
    id: 'calendars',
    name: 'Calendarios externos',
    category: 'Agenda y recordatorios',
    status: 'disconnected',
    folderOrScope: 'Calendario académico y personal',
    permissionsSummary: 'Sincronización explícita bajo demanda',
    lastTestedAt: null,
  },
  {
    id: 'ai-keys',
    name: 'Claves de IA (BYOK)',
    category: 'Inteligencia Artificial propia',
    status: 'disconnected',
    folderOrScope: 'Bóveda local del dispositivo',
    permissionsSummary: '0 claves precargadas · 100% gestión del usuario',
    lastTestedAt: null,
  },
];

export const DEFAULT_FRIENDS_LIST: FriendContact[] = [
  {
    id: 'fr-camila',
    fabroId: 'FBR-4821',
    displayName: 'Camila Mendoza',
    bio: 'Derecho y Metodología · Estudia de noche con Pomodoro',
    availability: 'offline',
    lastSeenLabel: 'Sin conexión · Últ. vez hace 2 h',
    trustedGroup: true,
    addedAt: 'Hoy',
  },
  {
    id: 'fr-lucia',
    fabroId: 'FBR-2049',
    displayName: 'Lucía Pereyra',
    bio: 'Reto 7 días estoico y calistenia',
    availability: 'online',
    lastSeenLabel: 'En línea ahora',
    trustedGroup: true,
    addedAt: 'Hoy',
  },
  {
    id: 'fr-tomas',
    fabroId: 'FBR-7390',
    displayName: 'Tomás Villalba',
    bio: 'Apuntes abiertos y lectura profunda',
    availability: 'offline',
    lastSeenLabel: 'Sin conexión · Viajando en modo avión',
    trustedGroup: false,
    addedAt: 'Ayer',
  },
];

export const DEFAULT_FRIEND_REQUESTS: FriendRequestItem[] = [
  {
    id: 'freq-1',
    fabroId: 'FBR-5518',
    displayName: 'Mateo Domínguez',
    note: 'Compartimos la sala de Estudio Silencioso. ¿Nos agregamos para pasarnos resúmenes?',
    direction: 'incoming',
    status: 'pending',
    createdAt: 'Hace 25 min',
  },
];

export const SUGGESTED_FRIENDS: Array<{
  fabroId: string;
  displayName: string;
  bio: string;
  availability: 'online' | 'offline';
}> = [
  {
    fabroId: 'FBR-8120',
    displayName: 'Sofía Paredes',
    bio: 'Técnica Feynman, flashcards SRS y té verde',
    availability: 'online',
  },
  {
    fabroId: 'FBR-3904',
    displayName: 'Andrés Vega',
    bio: 'HIIT matutino + diario de gratitud',
    availability: 'offline',
  },
  {
    fabroId: 'FBR-6642',
    displayName: 'Valentina Ríos',
    bio: 'Arquitectura de Software · Mapas conceptuales',
    availability: 'offline',
  },
];

export const DEFAULT_CHAT_MESSAGES: ChatMessageItem[] = [
  {
    id: 'msg-1',
    sender: 'Equipo FABRO',
    text: '¡Bienvenido! Deslizá cualquier mensaje hacia la derecha para responder o tocá dos veces para reaccionar.',
    time: '09:30',
    own: false,
    starred: true,
    reactions: ['🍀'],
    recipientId: 'general',
    deliveryStatus: 'delivered-local',
  },
  {
    id: 'msg-2',
    sender: 'Sala Estudio',
    text: 'Hoy arrancamos bloque Pomodoro de 25/5 min para Metodología Científica.',
    time: '10:05',
    own: false,
    starred: false,
    reactions: ['🔥'],
    recipientId: 'general',
    deliveryStatus: 'delivered-local',
  },
  {
    id: 'msg-3',
    sender: 'Camila Mendoza',
    text: 'Entré en zona sin señal por unas horas. Dejame escrito por acá qué unidad repasamos a la noche y lo leo apenas vuelva.',
    time: '11:15',
    own: false,
    starred: false,
    reactions: [],
    recipientId: 'fr-camila',
    deliveryStatus: 'delivered-local',
  },
];

export const DEFAULT_AGENDA_TASKS: AcademicAgendaTask[] = [
  {
    id: 'task-1',
    task: 'Entrega trabajo práctico Unidad 2',
    subject: 'Derecho Constitucional',
    date: 'Jueves · 18:00',
    done: false,
  },
  {
    id: 'task-2',
    task: 'Repaso simulacro parcial escrito',
    subject: 'Anatomía Funcional',
    date: 'Sábado · 10:00',
    done: false,
  },
];

export const DEFAULT_POMODORO_LOGS: PomodoroSessionLog[] = [
  {
    id: 'pom-1',
    subject: 'Derecho Constitucional',
    minutes: 25,
    completedAt: 'Hoy 09:00',
  },
];

export const DEFAULT_CONCEPT_NODES: ConceptNode[] = [
  { id: 'n-root', label: 'Ecosistema Offline-First', parentId: null, color: '#2563EB', x: 50, y: 18 },
  { id: 'n-idb', label: 'IndexedDB Local', parentId: 'n-root', color: '#06B6D4', x: 24, y: 55 },
  { id: 'n-sw', label: 'Caché PWA', parentId: 'n-root', color: '#10B981', x: 76, y: 55 },
  { id: 'n-sync', label: 'Respaldo Bajo Consentimiento', parentId: 'n-idb', color: '#F59E0B', x: 24, y: 86 },
];

export const DEFAULT_GRADE_SUBJECTS: GradeSubject[] = [
  {
    id: 'sub-1',
    subject: 'Derecho Constitucional',
    passTarget: 4,
    promoteTarget: 7,
    assessments: [
      { id: 'a-1', name: 'Parcial 1', type: 'Parcial', weight: 40, score: 7.5 },
      { id: 'a-2', name: 'Trabajo Práctico', type: 'TP', weight: 20, score: 8.5 },
      { id: 'a-3', name: 'Parcial 2', type: 'Parcial', weight: 40, score: null },
    ],
  },
  {
    id: 'sub-2',
    subject: 'Arquitectura de Software',
    passTarget: 6,
    promoteTarget: 8,
    assessments: [
      { id: 'b-1', name: 'Parcial 1', type: 'Parcial', weight: 50, score: 7 },
      { id: 'b-2', name: 'Proyecto Final', type: 'Final', weight: 50, score: null },
    ],
  },
];

export const DEFAULT_FLASHCARDS: SrsFlashcard[] = [
  {
    id: 'fc-1',
    subject: 'Estudio Activo',
    front: '¿En qué consiste el Recuerdo Activo (Active Recall)?',
    back: 'Consiste en cerrar los apuntes e intentar recuperar la respuesta de memoria antes de releer, fortaleciendo las conexiones neuronales.',
    difficulty: 'nueva',
    intervalLabel: 'Hoy',
    reviews: 0,
  },
  {
    id: 'fc-2',
    subject: 'Estudio Activo',
    front: '¿Cuáles son los 4 pasos de la Técnica Feynman?',
    back: '1) Elegir un concepto, 2) Explicarlo con palabras simples, 3) Detectar lagunas al explicarlo y 4) Volver a la fuente y simplificar.',
    difficulty: 'nueva',
    intervalLabel: 'Hoy',
    reviews: 0,
  },
  {
    id: 'fc-3',
    subject: 'Metodología',
    front: '¿Por qué funciona mejor la Repetición Espaciada que estudiar todo la noche anterior?',
    back: 'Repasar justo cuando estás por olvidar (1 día, 4 días, 7 días) frena la curva del olvido y consolida la memoria a largo plazo.',
    difficulty: 'regular',
    intervalLabel: '1 día',
    reviews: 1,
  },
  {
    id: 'fc-4',
    subject: 'Metodología',
    front: '¿Cómo se estructura una página con el Método Cornell?',
    back: 'Columna izquierda para preguntas clave, columna derecha amplia para notas de clase y franja inferior para un resumen propio de 3 líneas.',
    difficulty: 'regular',
    intervalLabel: '1 día',
    reviews: 2,
  },
  {
    id: 'fc-5',
    subject: 'Estoicismo',
    front: '¿Qué enseña la dicotomía del control aplicada al estudio?',
    back: 'Enfocar tu energía en lo que depende de vos (horas de práctica, descanso y método) en lugar de angustiarte por factores externos.',
    difficulty: 'facil',
    intervalLabel: '4 días',
    reviews: 3,
  },
];

export const DEFAULT_SEED_NOTEBOOK = {
  title: 'Guía Práctica: Técnicas de Estudio Activo y Resumen Estructurado',
  subject: 'Técnicas de Estudio',
  body: `1. IDEA CENTRAL\nLeer pasivamente varias veces da ilusión de conocimiento. El aprendizaje real ocurre cuando obligás a tu cerebro a recuperar y explicar ideas con tus palabras.\n\n2. ESTRUCTURA EN 3 BLOQUES (MÉTODO CORNELL + FEYNMAN)\n• Bloque A — Preguntas guía: ¿Cuál es la tesis principal? ¿Qué problema resuelve?\n• Bloque B — Desarrollo breve: Dividir el tema en 3 subtemas y conectar cada uno con un ejemplo cotidiano.\n• Bloque C — Autoevaluación rápida: Al cerrar la sesión, escribí 3 líneas sin mirar el texto y verificá qué faltó.\n\n3. PLAN DE REPASO\n• Hoy: 25 min Pomodoro + 5 flashcards.\n• Día 2 y Día 5: Simulacro breve de 5 preguntas.`,
};

export const DEFAULT_QUICK_NOTES: QuickNoteItem[] = [
  {
    id: 'qn-seed-1',
    title: DEFAULT_SEED_NOTEBOOK.title,
    subject: DEFAULT_SEED_NOTEBOOK.subject,
    body: DEFAULT_SEED_NOTEBOOK.body,
    createdAt: 'Plantilla inicial',
  },
];

export const DEFAULT_SUBJECTS_CATALOG: string[] = [
  'Técnicas de Estudio',
  'Derecho Constitucional',
  'Anatomía Funcional',
  'Arquitectura de Software',
  'General',
];

export const DEFAULT_NOTEBOOK_FOLDERS: string[] = [
  'General',
  'Teoría',
  'Práctica',
  'Resumen Final',
];

export const DEFAULT_ADVANCED_NOTES: AdvancedNoteItem[] = [
  {
    id: 'adv-seed-1',
    title: DEFAULT_SEED_NOTEBOOK.title,
    subject: 'Técnicas de Estudio',
    folder: 'Resumen Final',
    tags: ['estudio-activo', 'cornell', 'feynman'],
    favorite: true,
    mainIdea:
      'La retención real se logra recuperando la información de memoria (Active Recall) y explicándola con palabras simples (Feynman), no releyendo pasivamente.',
    summaryText:
      '• Regla 1: Cerrá el texto y formulá 3 preguntas clave por página.\n• Regla 2: Combiná bloques Pomodoro 25/5 con repaso espaciado (Día 1, 2 y 5).\n• Meta pre-examen: Explicar cada unidad en voz alta sin mirar el cuaderno.',
    contentHtml: `<h1>Técnicas de Estudio Activo y Resumen Estructurado</h1><p>Leer pasivamente varias veces da ilusión de conocimiento. El aprendizaje real ocurre cuando obligás a tu cerebro a <mark style="background-color: #FEF08A; color: #0F172A; padding: 0 3px; border-radius: 4px;">recuperar y explicar ideas con tus propias palabras</mark>.</p><h2>Estructura en 3 bloques (Cornell + Feynman)</h2><ul><li><strong>Bloque A — Preguntas guía:</strong> ¿Cuál es la tesis principal? ¿Qué problema resuelve?</li><li><strong>Bloque B — Desarrollo breve:</strong> Dividir el tema en 3 subtemas y conectar cada uno con <mark style="background-color: #BBF7D0; color: #0F172A; padding: 0 3px; border-radius: 4px;">un ejemplo cotidiano verificable</mark>.</li><li><strong>Bloque C — Autoevaluación rápida:</strong> Al cerrar la sesión, escribí 3 líneas sin mirar el texto.</li></ul><blockquote>«Si no podés explicarlo de forma sencilla, todavía no lo entendiste lo suficiente.» — Principio Feynman</blockquote><div data-fabro-summary="true" style="border-left: 4px solid #2563EB; background: rgba(37,99,235,0.08); padding: 10px 12px; border-radius: 10px; margin: 10px 0;"><strong>Bloque de resumen:</strong> Hoy 25 min Pomodoro + 5 flashcards · Día 2 y Día 5: simulacro breve de 5 preguntas.</div>`,
    contentText: DEFAULT_SEED_NOTEBOOK.body,
    audioClips: [],
    createdAt: 'Plantilla inicial',
    updatedAt: 'Hoy · 09:30',
  },
  {
    id: 'adv-seed-2',
    title: 'Unidad 1: Supremacía Constitucional y Control de Constitucionalidad',
    subject: 'Derecho Constitucional',
    folder: 'Teoría',
    tags: ['unidad-1', 'jerarquia', 'garantias'],
    favorite: false,
    mainIdea:
      'La Constitución ocupa el vértice de la pirámide jurídica y toda norma inferior debe adecuarse a sus principios y tratados con jerarquía constitucional.',
    summaryText:
      '• Orden jerárquico: Constitución + Tratados DD.HH. > Leyes nacionales > Decretos.\n• Control difuso: Cualquier juez puede declarar la inconstitucionalidad en un caso concreto.',
    contentHtml: `<h1>Supremacía y Jerarquía Normativa</h1><p>Todo el ordenamiento jurídico deriva su validez de la <mark style="background-color: #BAE6FD; color: #0F172A; padding: 0 3px; border-radius: 4px;">Constitución Nacional como norma fundamental</mark>.</p><h2>Puntos clave para el parcial</h2><ol><li>Principio de supremacía normativa y bloque de constitucionalidad federal.</li><li>Control jurisdiccional difuso vs. concentrado.</li><li><mark style="background-color: #FBCFE8; color: #0F172A; padding: 0 3px; border-radius: 4px;">Efecto inter partes</mark> de la declaración de inconstitucionalidad en el caso concreto.</li></ol>`,
    contentText:
      'Todo el ordenamiento jurídico deriva su validez de la Constitución Nacional como norma fundamental. Puntos clave: supremacía normativa, control difuso y efecto inter partes.',
    audioClips: [],
    createdAt: 'Plantilla inicial',
    updatedAt: 'Hoy · 10:15',
  },
];

export const DEFAULT_GLOSSARY_TERMS: GlossaryTermItem[] = [
  {
    id: 'glos-seed-1',
    subject: 'Técnicas de Estudio',
    term: 'Recuerdo Activo (Active Recall)',
    definition:
      'Estrategia que consiste en exigirle al cerebro recuperar un concepto sin mirar la fuente antes de verificar la respuesta.',
    createdAt: 'Hoy',
  },
  {
    id: 'glos-seed-2',
    subject: 'Técnicas de Estudio',
    term: 'Repetición Espaciada',
    definition:
      'Distribución inteligente de repasos en intervalos crecientes (1, 4 y 7 días) justo antes de olvidar el tema.',
    createdAt: 'Hoy',
  },
  {
    id: 'glos-seed-3',
    subject: 'Derecho Constitucional',
    term: 'Control Difuso',
    definition:
      'Facultad atribuida a cualquier juez competente para examinar la constitucionalidad de una norma en un caso concreto.',
    createdAt: 'Hoy',
  },
  {
    id: 'glos-seed-4',
    subject: 'General',
    term: 'Epistemología',
    definition:
      'Disciplina filosófica que estudia los fundamentos, límites, validez y métodos del conocimiento científico.',
    createdAt: 'Hoy',
  },
];

export const DEFAULT_STUDY_QUIZ: StudyQuiz = {
  id: 'quiz-seed-1',
  title: 'Simulacro Inicial: Técnicas de Estudio Activo y Memoria',
  subject: 'Metodología del Estudio',
  questions: [
    {
      id: 'q-1',
      question: '¿Qué técnica demuestra mayor retención a largo plazo frente a la relectura pasiva?',
      options: [
        'Subrayar todo el capítulo en dos colores',
        'Recuerdo activo (autoevaluarse sin mirar el apunte)',
        'Copiar el texto palabra por palabra',
      ],
      correctIndex: 1,
      explanation:
        'El recuerdo activo exige esfuerzo de recuperación y consolida mucho mejor los circuitos de memoria que releer o subrayar.',
    },
    {
      id: 'q-2',
      question: 'En la Técnica Feynman, ¿cuándo sabés que realmente entendiste un tema?',
      options: [
        'Cuando podés explicarlo con palabras simples sin jerga innecesaria',
        'Cuando memorizaste la definición textual del manual',
        'Cuando leíste el resumen cinco veces seguidas',
      ],
      correctIndex: 0,
      explanation:
        'Explicar un concepto de forma clara y sencilla expone inmediatamente qué partes dominás y cuáles necesitás reforzar.',
    },
    {
      id: 'q-3',
      question: '¿Cuál es la ventaja principal del descanso de 5 minutos en el método Pomodoro?',
      options: [
        'Permite mirar redes sociales intensamente',
        'Evita la fatiga atencional y ayuda a consolidar lo recién estudiado',
        'Reemplaza la necesidad de dormir bien',
      ],
      correctIndex: 1,
      explanation:
        'Las pausas breves restauran la atención sostenida y favorecen el procesamiento neuronal entre bloques de foco.',
    },
    {
      id: 'q-4',
      question: 'Según el Método Cornell, ¿para qué sirve la columna izquierda de la hoja?',
      options: [
        'Para escribir bibliografía completa',
        'Para anotar preguntas clave y disparadores de repaso',
        'Para hacer cálculos auxiliares',
      ],
      correctIndex: 1,
      explanation:
        'Tapar la columna derecha y responder las preguntas de la columna izquierda convierte tus propios apuntes en un simulacro instantáneo.',
    },
    {
      id: 'q-5',
      question: '¿Cómo actúa la Repetición Espaciada sobre la curva del olvido?',
      options: [
        'Aumenta el tiempo entre repasos cada vez que recordás bien una tarjeta',
        'Obliga a repasar todas las tarjetas cada 15 minutos sin parar',
        'Elimina la necesidad de entender el concepto',
      ],
      correctIndex: 0,
      explanation:
        'Espaciar los intervalos (hoy, 1 día, 4 días) optimiza el tiempo de estudio enfocándote solo en lo que estás por olvidar.',
    },
  ],
};

export const DEFAULT_GUIDED_REFLECTIONS: GuidedReflectionItem[] = [
  {
    id: 'ref-1',
    title: '1. Claridad sobre lo esencial',
    prompt: 'Si hoy fuera tu último día, ¿qué preocupación actual perdería toda importancia de inmediato?',
    answer: 'Discutir por cosas pequeñas que no construyen paz ni aprendizaje.',
    stoicQuote: '«No nos perturba lo que sucede, sino nuestra opinión sobre lo que sucede.» — Epicteto',
  },
  {
    id: 'ref-2',
    title: '2. Lo que sí depende de vos',
    prompt: '¿Qué pequeña acción concreta podés completar hoy con total atención y honestidad?',
    answer: 'Completar un bloque de estudio sin celular cerca y llamar a alguien que aprecio.',
    stoicQuote: '«Concéntrate en la tarea que tienes delante como si fuera la última.» — Marco Aurelio',
  },
  {
    id: 'ref-3',
    title: '3. Gratitud consciente',
    prompt: '¿A quién o por qué motivo puntual querés agradecer antes de terminar el día?',
    answer: 'Por la oportunidad de aprender algo nuevo hoy y tener salud para intentarlo.',
    stoicQuote: '«Quien no se alegra con lo que tiene hoy, tampoco será feliz con lo que desea.» — Séneca',
  },
];

export const DEFAULT_BALANCED_PLANNER: BalancedPlannerItem[] = [
  {
    id: 'plan-1',
    time: '08:00',
    block: 'Hidratación',
    activity: '500 ml de agua + 5 min de luz natural y movilidad suave',
    done: false,
  },
  {
    id: 'plan-2',
    time: '09:30',
    block: 'Enfoque',
    activity: '2 bloques Pomodoro (25/5) en la tarea más importante del día',
    done: false,
  },
  {
    id: 'plan-3',
    time: '13:30',
    block: 'Descanso',
    activity: 'Almuerzo tranquilo sin pantallas + caminata breve de 10 min',
    done: false,
  },
  {
    id: 'plan-4',
    time: '18:00',
    block: 'Hidratación',
    activity: 'Alcanzar 2.000 ml diarios + rutina de respiración 4-7-8',
    done: false,
  },
  {
    id: 'plan-5',
    time: '21:30',
    block: 'Descanso',
    activity: 'Cierre estoico de gratitud y 3 prioridades claras para mañana',
    done: false,
  },
];

export const DEFAULT_MOBILITY_ROUTINE = {
  title: 'Rutina Rápida: Movilidad y Respiración (10 min)',
  category: 'Movilidad + Calistenia suave + Respiración',
  workSec: 40,
  restSec: 20,
  rounds: 10,
  steps: [
    'Círculos suaves de cuello y hombros (40s) + respiración profunda (20s)',
    'Apertura torácica y estiramiento de espalda (40s)',
    'Sentadillas lentas controladas sin impacto (40s)',
    'Movilidad de cadera y tobillos alternando piernas (40s)',
    'Plancha inclinada o puente lumbar suave (40s)',
    'Respiración Cuadrada 4-4-4-4 de cierre para bajar pulsaciones',
  ],
};

export const DEFAULT_HYDRATION_SLEEP: HydrationSleepState = {
  date: new Date().toISOString().slice(0, 10),
  waterMl: 1000,
  waterGoalMl: 2000,
  sleepHours: 7.5,
  sleepQuality: 'Buena',
  history: [
    { date: 'Ayer', waterMl: 2000, sleepHours: 7.5, sleepQuality: 'Buena' },
    { date: 'Anteayer', waterMl: 1750, sleepHours: 7, sleepQuality: 'Excelente' },
  ],
};

export const DEFAULT_TIME_CAPSULES: TimeCapsuleEntry[] = [
  {
    id: 'cap-1',
    title: 'Carta de serenidad para el próximo mes',
    content:
      'Si hoy fuera mi último día, me daría paz saber que cuidé mi salud, estudié con constancia y hablé con honestidad a quienes quiero.',
    openDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    createdAt: 'Hoy',
    unlockedManually: false,
  },
];

export const DEFAULT_WORKOUT_LOGS: WorkoutLogEntry[] = [
  {
    id: 'wk-1',
    routine: 'Tabata Calistenia Funcional',
    rounds: 8,
    reps: 64,
    durationLabel: '4 min',
    dateLabel: 'Hoy',
  },
];

export const DEFAULT_STORIES: EphemeralStory[] = [
  {
    id: 'st-1',
    author: 'Jorge Luis Correa',
    fabroId: 'FBR-LOCAL-01',
    statusTag: 'Modo enfoque',
    text: 'Bloque Pomodoro de 25 min listo para avanzar con mis apuntes.',
    ringGradient: 'linear-gradient(135deg, #7C3AED, #EC4899)',
    expiresLabel: 'Expira en 22h',
    createdAtMs: Date.now(),
  },
  {
    id: 'st-2',
    author: 'Comunidad Lectura',
    fabroId: 'FBR-CLUB-07',
    statusTag: 'Reto 7 días',
    text: 'Día 4 leyendo 20 minutos de filosofía práctica sin distracciones.',
    ringGradient: 'linear-gradient(135deg, #10B981, #06B6D4)',
    expiresLabel: 'Expira en 18h',
    createdAtMs: Date.now(),
  },
];

export const DEFAULT_WALL_POSTS: WallPostItem[] = [
  {
    id: 'post-1',
    author: 'Jorge Luis Correa',
    fabroId: 'FBR-LOCAL-01',
    text: '¿Qué bloque de enfoque les rinde más hoy para estudiar desde el celular?',
    likes: 11,
    createdAt: 'Hace 20 min',
    reactions: { like: 5, insightful: 4, inspiring: 2 },
    myReaction: null,
    comments: [
      {
        id: 'cmt-1',
        author: 'Camila Mendoza',
        fabroId: 'FBR-4821',
        text: 'El de 25/5 me salva cuando estudio de noche porque no pierdo ritmo.',
        createdAt: 'Hace 12 min',
        parentId: null,
      },
      {
        id: 'cmt-2',
        author: 'Lucía Pereyra',
        fabroId: 'FBR-2049',
        text: 'Coincido totalmente, y en los 5 minutos meto movilidad cervical.',
        createdAt: 'Hace 8 min',
        parentId: 'cmt-1',
      },
    ],
    poll: {
      question: 'Bloque favorito de estudio',
      votedOptionId: null,
      options: [
        { id: 'opt-1', label: 'Pomodoro 25 / 5 min', votes: 14 },
        { id: 'opt-2', label: 'Enfoque profundo 50 / 10 min', votes: 9 },
        { id: 'opt-3', label: 'Sprint 15 / 3 min', votes: 4 },
      ],
    },
  },
  {
    id: 'post-2',
    author: 'Camila Mendoza',
    fabroId: 'FBR-4821',
    text: 'Comparto mi resumen estructurado de Estudio Activo (Cornell + Feynman) para quienes están preparando parciales esta semana.',
    likes: 16,
    createdAt: 'Hace 1 h',
    reactions: { love: 6, insightful: 7, strength: 3 },
    myReaction: null,
    sharedResource: {
      kind: 'note',
      refId: 'adv-seed-1',
      title: 'Guía Práctica: Técnicas de Estudio Activo y Resumen Estructurado',
      subtitle: 'Resumen Cornell + Feynman con 3 bloques de autoevaluación rápida.',
      subject: 'Técnicas de Estudio',
      metricLabel: 'Apunte abierto · Sector 1',
    },
    comments: [
      {
        id: 'cmt-3',
        author: 'Tomás Villalba',
        fabroId: 'FBR-7390',
        text: '¡Excelente aporte! Ya lo guardé en marcadores para repasarlo hoy.',
        createdAt: 'Hace 40 min',
        parentId: null,
      },
    ],
  },
];

export const DEFAULT_STUDY_ROOMS: StudyRoomItem[] = [
  {
    id: 'room-silent-pomodoro',
    name: 'Sala de Estudio Silencioso (Pomodoro grupal)',
    category: 'Sala Permanente · Acceso 1 Clic',
    challengeTitle: 'Bloques compartidos 25/5 min sin distracciones',
    targetDays: 7,
    myStreakDays: 1,
    joined: true,
    sharedNotes: [
      {
        id: 'rn-silent-1',
        author: 'Anfitrión Pomodoro',
        text: 'Entrá cuando quieras: elegí 1 sola meta para estos 25 minutos y silenciá notificaciones.',
      },
    ],
    ranking: [
      { name: 'Lucía M.', days: 7 },
      { name: 'Mateo R.', days: 5 },
      { name: 'Invitado FABRO', days: 1 },
    ],
  },
  {
    id: 'room-stoic-7days',
    name: 'Reto 7 Días de Hábitos Estoicos',
    category: 'Reto Público · Bienestar Diario',
    challengeTitle: '1 micro-acción estoica + 2L agua + cierre de gratitud',
    targetDays: 7,
    myStreakDays: 2,
    joined: true,
    sharedNotes: [
      {
        id: 'rn-stoic-1',
        author: 'Comunidad Estoica',
        text: 'Día 2: distinguí hoy qué depende de vos antes de responder con apuro.',
      },
    ],
    ranking: [
      { name: 'Sofía P.', days: 6 },
      { name: 'Andrés V.', days: 4 },
      { name: 'Invitado FABRO', days: 2 },
    ],
  },
  {
    id: 'room-open-notes',
    name: 'Comunidad de Apuntes Abiertos',
    category: 'Colaboración Libre · Sin Contactos Previos',
    challengeTitle: 'Compartí un resumen o simulacro por WhatsApp cada semana',
    targetDays: 7,
    myStreakDays: 1,
    joined: true,
    sharedNotes: [
      {
        id: 'rn-open-1',
        author: 'Biblioteca Abierta',
        text: 'Podés enviar cualquier apunte o flashcard de Estudio por enlace directo sin que tus compañeros se registren.',
      },
    ],
    ranking: [
      { name: 'Camila D.', days: 6 },
      { name: 'Tomás G.', days: 4 },
      { name: 'Invitado FABRO', days: 1 },
    ],
  },
];

export const DEFAULT_IDEAS_VAULT: IdeaVaultItem[] = [
  {
    id: 'idea-1',
    title: 'Escáner de apuntes con recorte automático a PDF',
    sector: 'estudio',
    description: 'Sacar foto a hojas escritas a mano desde el teléfono, mejorar el contraste y unirlas en un PDF de la materia.',
    priority: 'esencial',
    status: 'en-evaluacion',
    votes: 18,
    votedByMe: false,
    author: 'Comunidad Estudio',
    createdAt: 'Hoy',
  },
  {
    id: 'idea-2',
    title: 'Widget rápido de hidratación y racha en pantalla de inicio móvil',
    sector: 'bienestar',
    description: 'Sumar +250 ml de agua con un toque desde la pantalla de inicio Android sin abrir toda la app.',
    priority: 'muy-util',
    status: 'propuesta',
    votes: 12,
    votedByMe: false,
    author: 'Comunidad Bienestar',
    createdAt: 'Hoy',
  },
  {
    id: 'idea-3',
    title: 'Modo lectura nocturna con filtro cálido para bibliografía larga',
    sector: 'estudio',
    description: 'Reducir fatiga visual al leer PDFs de noche ajustando tipografía y tono cálido.',
    priority: 'experimento',
    status: 'favorita',
    votes: 9,
    votedByMe: false,
    author: 'Jorge Luis Correa',
    createdAt: 'Hoy',
  },
];

export const DEFAULT_ZODIAC_SIGN: ZodiacSignId = 'leo';

export const DEFAULT_WEATHER_SNAPSHOT: CachedWeatherSnapshot = {
  cityName: 'Buenos Aires',
  latitude: -34.6037,
  longitude: -58.3816,
  temperatureC: 22,
  apparentC: 22,
  humidityPct: 58,
  windKmh: 14,
  weatherCode: 1,
  isDay: true,
  dailyMaxC: 25,
  dailyMinC: 16,
  fetchedAtIso: new Date().toISOString(),
  forecastDays: [
    { dateLabel: 'Mañana', weatherCode: 0, maxC: 26, minC: 17 },
    { dateLabel: 'Pasado', weatherCode: 2, maxC: 24, minC: 16 },
    { dateLabel: '+3 días', weatherCode: 61, maxC: 21, minC: 15 },
  ],
};

export const DEFAULT_USER_QUOTES: UserQuoteItem[] = [
  {
    id: 'uq-1',
    text: 'Lo que hacés con serenidad hoy construye el descanso tranquilo de mañana.',
    author: 'Jorge Luis Correa',
    category: 'Sabiduría',
    likes: 14,
    likedByMe: false,
    createdAt: 'Hoy',
  },
  {
    id: 'uq-2',
    text: 'Veinticinco minutos de atención genuina valen más que una tarde de distracciones.',
    author: 'Camila D.',
    category: 'Estudio',
    likes: 11,
    likedByMe: false,
    createdAt: 'Hoy',
  },
  {
    id: 'uq-3',
    text: 'Cuidar el agua, el sueño y la palabra amable es la base de cualquier proyecto.',
    author: 'Sofía P.',
    category: 'Calma',
    likes: 9,
    likedByMe: false,
    createdAt: 'Hoy',
  },
  {
    id: 'uq-4',
    text: 'Dejá mensajes sinceros a quienes querés aunque hoy estén sin conexión.',
    author: 'Mateo R.',
    category: 'Vínculos',
    likes: 8,
    likedByMe: false,
    createdAt: 'Hoy',
  },
];

export const getTodayDateKey = (): string => new Date().toISOString().slice(0, 10);

export const DEFAULT_INBOX_ITEMS: InboxCaptureItem[] = [
  {
    id: 'inb-seed-1',
    text: 'Repasar 5 flashcards de Recuerdo Activo antes de merendar',
    createdAt: 'Hoy · 09:15',
    createdAtMs: Date.now() - 3600000,
  },
  {
    id: 'inb-seed-2',
    text: 'Comprar cuaderno de repaso y botella térmica para la facultad',
    createdAt: 'Hoy · 10:20',
    createdAtMs: Date.now() - 1800000,
  },
];

export const DEFAULT_ORGANIZER_TASKS: OrganizerTaskItem[] = [
  {
    id: 'org-task-1',
    title: 'Completar 1 bloque Pomodoro de Derecho Constitucional (Unidad 2)',
    quadrant: 'hacer-ahora',
    subject: 'Derecho Constitucional',
    sector: 'estudio',
    done: false,
    isTop3Priority: true,
    scheduledDate: getTodayDateKey(),
    createdAt: 'Hoy',
  },
  {
    id: 'org-task-2',
    title: 'Tomar 2 litros de agua y hacer 10 min de movilidad cervical',
    quadrant: 'planificar',
    subject: 'Bienestar Diario',
    sector: 'bienestar',
    done: false,
    isTop3Priority: true,
    scheduledDate: getTodayDateKey(),
    createdAt: 'Hoy',
  },
  {
    id: 'org-task-3',
    title: 'Ordenar apuntes de Anatomía Funcional en carpeta Resumen Final',
    quadrant: 'planificar',
    subject: 'Anatomía Funcional',
    sector: 'estudio',
    done: false,
    isTop3Priority: true,
    scheduledDate: getTodayDateKey(),
    createdAt: 'Hoy',
  },
  {
    id: 'org-task-4',
    title: 'Enviar mensaje rápido al grupo de estudio para confirmar horario',
    quadrant: 'delegar-rapido',
    subject: 'Personal',
    sector: 'personal',
    done: false,
    isTop3Priority: false,
    scheduledDate: getTodayDateKey(),
    createdAt: 'Hoy',
  },
];

export const DEFAULT_TIME_BLOCKS: TimeBlockItem[] = [
  {
    id: 'tb-seed-1',
    title: 'Bloque Pomodoro: Supremacía Constitucional',
    startHour: 9,
    startMinute: 0,
    durationMinutes: 60,
    sector: 'estudio',
    subject: 'Derecho Constitucional',
    done: false,
    dateKey: getTodayDateKey(),
  },
  {
    id: 'tb-seed-2',
    title: 'Movilidad, hidratación y pausa consciente',
    startHour: 13,
    startMinute: 0,
    durationMinutes: 30,
    sector: 'bienestar',
    subject: 'Bienestar Diario',
    done: false,
    dateKey: getTodayDateKey(),
  },
  {
    id: 'tb-seed-3',
    title: 'Simulacro y revisión diaria nocturna',
    startHour: 18,
    startMinute: 30,
    durationMinutes: 45,
    sector: 'personal',
    subject: 'Técnicas de Estudio',
    done: false,
    dateKey: getTodayDateKey(),
  },
];

export const DEFAULT_DAILY_REVIEW: DailyReviewState = {
  dateKey: getTodayDateKey(),
  top3TaskIds: ['org-task-1', 'org-task-2', 'org-task-3'],
  morningIntention: 'Avanzar con calma en lo verdaderamente importante sin dispersarme.',
  nightReflection: '',
  nightGratitude: '',
};


