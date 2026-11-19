import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  linkWithPopup,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile as updateFirebaseProfile,
  type User,
} from 'firebase/auth';
import {
  ALL_SUBMENUS,
  FABRO_THEMES,
  PRIMARY_SCREENS_ORDER,
  SECTORS_CATALOG,
} from '../data/ecosystemCatalog';
import { auth, googleProvider } from '../lib/firebase';
import {
  emitAndroidBubbleEvent,
  isDocumentPiPSupported,
  registerAndroidBubbleBridge,
  type FabroBubbleSnapshot,
} from '../services/androidBubblesBridge';
import {
  dispatchSystemNotification,
  getNotificationCapability,
  requestBrowserNotificationPermission,
} from '../services/backgroundNotifications';
import {
  computeIsMinorFromBirthDate,
  deleteSingleNoteFromCloud,
  deleteUserCloudAccountData,
  loadUserProfileDoc,
  migrateGuestVaultToCloud,
  normalizeHandle,
  reserveUsernameAndSaveProfile,
  subscribeToUserCloudWorkspace,
  syncOrganizerStateToCloud,
  syncSingleNoteToCloud,
  syncWellnessStateToCloud,
} from '../services/cloudSyncService';
import {
  DEFAULT_ADVANCED_NOTES,
  DEFAULT_AGENDA_TASKS,
  DEFAULT_BALANCED_PLANNER,
  DEFAULT_CHAT_MESSAGES,
  DEFAULT_CONNECT_ITEMS,
  DEFAULT_DAILY_REVIEW,
  DEFAULT_FAVORITES,
  DEFAULT_FLASHCARDS,
  DEFAULT_FRIEND_REQUESTS,
  DEFAULT_FRIENDS_LIST,
  DEFAULT_GLOSSARY_TERMS,
  DEFAULT_GUIDED_REFLECTIONS,
  DEFAULT_IDEAS_VAULT,
  DEFAULT_INBOX_ITEMS,
  DEFAULT_LOCAL_PROFILE,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_ORGANIZER_TASKS,
  DEFAULT_PINNED_TOOLS,
  DEFAULT_POMODORO_LOGS,
  DEFAULT_QUICK_NOTES,
  DEFAULT_SCHEDULED_REMINDERS,
  DEFAULT_STUDY_QUIZ,
  DEFAULT_TIME_BLOCKS,
  DEFAULT_USER_QUOTES,
  DEFAULT_ZODIAC_SIGN,
  getTodayDateKey,
  vaultClearAll,
  vaultGet,
  vaultSet,
} from '../services/localVault';
import {
  activateMediaSession,
  stopMediaSession,
  updateMediaSessionPosition,
} from '../services/mediaSessionBridge';
import { useNetworkMonitor } from '../services/networkMonitor';
import { clearShareFromLocation, readShareFromLocation } from '../services/shareCodec';
import { playSoftBell } from '../services/webAudioPtt';
import type {
  AcademicAgendaTask,
  ActivityEntry,
  AdvancedNoteItem,
  AuthPresenceStatus,
  AuthUserSummary,
  BalancedPlannerItem,
  ByokProviderKey,
  ChatMessageItem,
  ConceptNode,
  ConnectProviderItem,
  DailyReviewState,
  EisenhowerQuadrant,
  FiveSectorId,
  FriendAvailability,
  FriendContact,
  FriendRequestItem,
  GlossaryTermItem,
  GuidedReflectionItem,
  IdeaVaultItem,
  InboxCaptureItem,
  LocalUserProfile,
  MoodLogItem,
  NavDestination,
  NetworkSnapshot,
  NotificationEntry,
  NotificationPreferences,
  OrganizerTabId,
  OrganizerTaskItem,
  PinnedToolEntry,
  PinnedToolSize,
  PomodoroSessionLog,
  QuickActionType,
  QuickNoteItem,
  QuoteCategory,
  ScheduledReminderItem,
  SectorId,
  SharedResourcePayload,
  SrsFlashcard,
  StudyQuiz,
  StudyQuizQuestion,
  SubmenuId,
  SyncStatusState,
  ThemeId,
  TimeBlockDuration,
  TimeBlockItem,
  TimeBlockSector,
  UserQuoteItem,
  WorkspaceColumns,
  WorkoutLogEntry,
  ZodiacSignId,
} from '../types/ecosystem';

export const POMODORO_PRESETS = [
  { id: '25-5' as const, label: '25 / 5 min', focus: 25, rest: 5 },
  { id: '50-10' as const, label: '50 / 10 min', focus: 50, rest: 10 },
  { id: '15-3' as const, label: '15 / 3 min', focus: 15, rest: 3 },
];

export type PomodoroPresetId = (typeof POMODORO_PRESETS)[number]['id'];
export type FloatingWindowMode = 'closed' | 'document-pip' | 'compact-overlay';

interface SendChatOptions {
  replyTo?: { id: string; sender: string; text: string };
  audioUrl?: string;
  sticker?: string;
  senderOverride?: string;
  isIncoming?: boolean;
  recipientId?: string;
}

interface EcosystemContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  sector: SectorId;
  submenu: SubmenuId;
  navigateTo: (sector: SectorId, submenu?: SubmenuId) => void;
  swipeNextScreen: () => void;
  swipePrevScreen: () => void;
  isScreenTransitioning: boolean;
  screenTransitionTick: number;
  goBack: () => void;
  canGoBack: boolean;
  profile: LocalUserProfile;
  updateProfile: (patch: Partial<LocalUserProfile>) => void;
  favorites: string[];
  toggleFavorite: (sector: FiveSectorId, submenu: SubmenuId) => void;
  pinnedTools: PinnedToolEntry[];
  workspaceColumns: WorkspaceColumns;
  setWorkspaceColumns: (cols: WorkspaceColumns) => void;
  isToolPinned: (sector: FiveSectorId, submenu: SubmenuId) => boolean;
  togglePinTool: (sector: FiveSectorId, submenu: SubmenuId) => void;
  movePinnedTool: (key: string, direction: 'up' | 'down') => void;
  setPinnedToolSize: (key: string, size: PinnedToolSize) => void;
  applyWorkspacePreset: (preset: 'estudio' | 'social' | 'equilibrio') => void;
  resetPinnedTools: () => void;
  userQuotes: UserQuoteItem[];
  addUserQuote: (text: string, author: string, category: QuoteCategory) => void;
  likeUserQuote: (id: string) => void;
  deleteUserQuote: (id: string) => void;
  selectedZodiac: ZodiacSignId;
  setSelectedZodiac: (sign: ZodiacSignId) => void;
  floatingChatOpen: boolean;
  setFloatingChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recents: ActivityEntry[];
  notifications: NotificationEntry[];
  unreadNotifications: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  byokKeys: ByokProviderKey[];
  saveByokKey: (keyItem: ByokProviderKey) => void;
  removeByokKey: (id: string) => void;
  connectItems: ConnectProviderItem[];
  saveConnectItems: (items: ConnectProviderItem[]) => void;
  network: NetworkSnapshot;
  measureNetwork: () => Promise<void>;
  rightPanelOpen: boolean;
  setRightPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  quickChatMessages: ChatMessageItem[];
  activeChatThreadId: string;
  setActiveChatThreadId: React.Dispatch<React.SetStateAction<string>>;
  openDirectChatWithFriend: (friendId: string) => void;
  flushQueuedMessages: (recipientId?: string) => number;
  sendQuickChatMessage: (text: string, options?: SendChatOptions) => void;
  toggleChatStar: (id: string) => void;
  reactToChatMessage: (id: string, emoji: string) => void;
  friendsList: FriendContact[];
  friendRequests: FriendRequestItem[];
  addFriendDirectly: (
    fabroId: string,
    displayName: string,
    bio?: string,
    availability?: FriendAvailability
  ) => FriendContact;
  sendFriendRequest: (fabroId: string, displayName: string, note?: string) => void;
  respondFriendRequest: (requestId: string, action: 'accept' | 'reject' | 'cancel') => void;
  removeFriend: (friendId: string) => void;
  toggleFriendAvailability: (friendId: string) => void;
  toggleFriendTrustedGroup: (friendId: string) => void;
  activeQuickAction: QuickActionType;
  setActiveQuickAction: React.Dispatch<React.SetStateAction<QuickActionType>>;
  quickNotes: QuickNoteItem[];
  addQuickNote: (title: string, body: string, subject: string) => void;
  moodLogs: MoodLogItem[];
  addMoodLog: (score: number, emotion: string, habit: string) => void;
  agendaTasks: AcademicAgendaTask[];
  addAgendaTask: (task: string, subject: string, date: string) => void;
  toggleAgendaTask: (id: string) => void;
  pomodoroLogs: PomodoroSessionLog[];
  addPomodoroLog: (subject: string, minutes: number) => void;
  ideasVault: IdeaVaultItem[];
  addIdeaVaultItem: (
    title: string,
    sector: IdeaVaultItem['sector'],
    description: string,
    priority: IdeaVaultItem['priority']
  ) => void;
  toggleIdeaVote: (id: string) => void;
  updateIdeaStatus: (id: string, status: IdeaVaultItem['status']) => void;
  sharedViewerPayload: SharedResourcePayload | null;
  openSharedPreview: (payload: SharedResourcePayload) => void;
  closeSharedViewer: () => void;
  importSharedResourceToVault: (payload: SharedResourcePayload) => Promise<void>;
  importNotice: string | null;
  dismissImportNotice: () => void;
  studyQuiz: StudyQuiz;
  addQuizQuestion: (question: Omit<StudyQuizQuestion, 'id'>) => void;
  guidedReflections: GuidedReflectionItem[];
  updateGuidedReflection: (id: string, answer: string) => void;
  balancedPlanner: BalancedPlannerItem[];
  toggleBalancedPlanner: (id: string) => void;
  examplesCleared: boolean;
  clearSeedExamples: () => Promise<void>;
  resetLocalVault: () => Promise<void>;
  advancedNotes: AdvancedNoteItem[];
  glossaryTerms: GlossaryTermItem[];
  notesSaveState: 'guardado' | 'guardando';
  lastNotesSavedAt: string;
  createAdvancedNote: (seed?: Partial<Pick<AdvancedNoteItem, 'title' | 'subject' | 'folder'>>) => AdvancedNoteItem;
  updateAdvancedNote: (id: string, patch: Partial<AdvancedNoteItem>) => void;
  deleteAdvancedNote: (id: string) => void;
  addGlossaryTerm: (subject: string, term: string, definition: string) => void;
  deleteGlossaryTerm: (id: string) => void;
  // Background Notifications, Reminders, Pomodoro + MediaSession, Floating Mini-Window
  notificationPrefs: NotificationPreferences;
  updateNotificationPrefs: (patch: Partial<NotificationPreferences>) => void;
  notificationPermission: NotificationPermission | 'unsupported';
  refreshNotificationPermission: () => void;
  requestNotificationPermission: () => Promise<{ permission: NotificationPermission | 'unsupported'; message: string }>;
  triggerTestNotification: () => Promise<{ delivered: boolean; note: string }>;
  scheduledReminders: ScheduledReminderItem[];
  addScheduledReminder: (
    title: string,
    sector: 'estudio' | 'bienestar',
    submenu: SubmenuId,
    minutesFromNow: number
  ) => void;
  deleteScheduledReminder: (id: string) => void;
  notifyRoutineCompleted: (routineName: string) => void;
  simulateIncomingChatNotification: (sender?: string, text?: string) => void;
  pomoPresetId: PomodoroPresetId;
  pomoPhase: 'focus' | 'rest';
  pomoSubject: string;
  pomoSecondsLeft: number;
  pomoRunning: boolean;
  selectPomodoroPreset: (id: PomodoroPresetId) => void;
  setPomodoroSubject: (subject: string) => void;
  togglePomodoro: () => void;
  resetPomodoro: () => void;
  completePomodoroManual: (subjectOverride?: string) => void;
  floatingMode: FloatingWindowMode;
  floatingNotice: string | null;
  pipContainer: HTMLElement | null;
  openFloatingMiniWindow: () => Promise<void>;
  closeFloatingMiniWindow: () => void;
  dismissFloatingNotice: () => void;
  // Organizador Integral
  inboxItems: InboxCaptureItem[];
  organizerTasks: OrganizerTaskItem[];
  timeBlocks: TimeBlockItem[];
  dailyReview: DailyReviewState;
  quickCaptureOpen: boolean;
  setQuickCaptureOpen: React.Dispatch<React.SetStateAction<boolean>>;
  organizerActiveTab: OrganizerTabId;
  setOrganizerActiveTab: React.Dispatch<React.SetStateAction<OrganizerTabId>>;
  addInboxCapture: (text: string) => void;
  convertInboxToTask: (
    inboxId: string,
    quadrant: EisenhowerQuadrant,
    subject: string,
    sector?: TimeBlockSector
  ) => void;
  scheduleInboxToTimeBlock: (
    inboxId: string,
    startHour: number,
    startMinute: 0 | 30,
    durationMinutes: TimeBlockDuration,
    sector: TimeBlockSector,
    subject?: string
  ) => void;
  sendInboxToStudyNote: (inboxId: string, subject?: string) => void;
  dismissInboxItem: (inboxId: string) => void;
  addTimeBlock: (payload: Omit<TimeBlockItem, 'id' | 'done' | 'dateKey'>) => void;
  toggleTimeBlockDone: (id: string) => void;
  deleteTimeBlock: (id: string) => void;
  startPomodoroForTask: (taskTitleOrSubject: string) => void;
  addOrganizerTask: (
    title: string,
    quadrant: EisenhowerQuadrant,
    subject: string,
    sector: TimeBlockSector
  ) => void;
  moveTaskQuadrant: (taskId: string, quadrant: EisenhowerQuadrant) => void;
  toggleOrganizerTask: (taskId: string) => void;
  deleteOrganizerTask: (taskId: string) => void;
  toggleTop3Priority: (taskId: string) => void;
  updateMorningIntention: (text: string) => void;
  saveNightReflection: (reflection: string, gratitude: string) => void;
  rolloverPendingTasksToTomorrow: () => number;
  // Firebase Auth & Cloud Firestore Sync
  authUser: AuthUserSummary | null;
  authLoading: boolean;
  syncStatus: SyncStatusState;
  lastCloudSyncAt: string | null;
  authModalOpen: boolean;
  authModalReason: string | null;
  authModalDefaultTab: 'login' | 'register';
  openAuthModal: (reason?: string, defaultTab?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  signInWithGoogle: () => Promise<{ ok: boolean; error?: string; code?: string }>;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; code?: string }>;
  signUpWithEmail: (params: {
    displayName: string;
    username: string;
    email: string;
    password: string;
    birthDate: string;
  }) => Promise<{ ok: boolean; error?: string; code?: string }>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  signOutAccount: () => Promise<void>;
  updateAccountAliasAndPhoto: (patch: {
    displayName?: string;
    username?: string;
    photoURL?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  changeAccountPassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  linkGoogleProvider: () => Promise<{ ok: boolean; error?: string }>;
  deleteAccountSafely: () => Promise<{ ok: boolean; error?: string }>;
  updatePresenceStatus: (status: AuthPresenceStatus) => Promise<void>;
  syncNowToCloud: () => Promise<void>;
}

const EcosystemContext = createContext<EcosystemContextValue | null>(null);

export const EcosystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>('estandar');
  const [sector, setSector] = useState<SectorId>('social');
  const [submenu, setSubmenu] = useState<SubmenuId>('fabro-id');
  const [history, setHistory] = useState<NavDestination[]>([]);
  const [profile, setProfile] = useState<LocalUserProfile>(DEFAULT_LOCAL_PROFILE);
  const [favorites, setFavorites] = useState<string[]>(DEFAULT_FAVORITES);
  const [pinnedTools, setPinnedTools] = useState<PinnedToolEntry[]>(DEFAULT_PINNED_TOOLS);
  const [workspaceColumns, setWorkspaceColumnsState] = useState<WorkspaceColumns>(3);
  const [recents, setRecents] = useState<ActivityEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>(DEFAULT_NOTIFICATIONS);
  const [byokKeys, setByokKeys] = useState<ByokProviderKey[]>([]);
  const [connectItems, setConnectItems] = useState<ConnectProviderItem[]>(DEFAULT_CONNECT_ITEMS);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [quickChatMessages, setQuickChatMessages] = useState<ChatMessageItem[]>(DEFAULT_CHAT_MESSAGES);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string>('general');
  const [friendsList, setFriendsList] = useState<FriendContact[]>(DEFAULT_FRIENDS_LIST);
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>(DEFAULT_FRIEND_REQUESTS);
  const [activeQuickAction, setActiveQuickAction] = useState<QuickActionType>(null);
  const [quickNotes, setQuickNotes] = useState<QuickNoteItem[]>(DEFAULT_QUICK_NOTES);
  const [moodLogs, setMoodLogs] = useState<MoodLogItem[]>([]);
  const [agendaTasks, setAgendaTasks] = useState<AcademicAgendaTask[]>(DEFAULT_AGENDA_TASKS);
  const [pomodoroLogs, setPomodoroLogs] = useState<PomodoroSessionLog[]>(DEFAULT_POMODORO_LOGS);
  const [ideasVault, setIdeasVault] = useState<IdeaVaultItem[]>(DEFAULT_IDEAS_VAULT);
  const [studyQuiz, setStudyQuiz] = useState<StudyQuiz>(DEFAULT_STUDY_QUIZ);
  const [guidedReflections, setGuidedReflections] = useState<GuidedReflectionItem[]>(
    DEFAULT_GUIDED_REFLECTIONS
  );
  const [balancedPlanner, setBalancedPlanner] = useState<BalancedPlannerItem[]>(
    DEFAULT_BALANCED_PLANNER
  );
  const [advancedNotes, setAdvancedNotes] = useState<AdvancedNoteItem[]>(DEFAULT_ADVANCED_NOTES);
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTermItem[]>(DEFAULT_GLOSSARY_TERMS);
  const [notesSaveState, setNotesSaveState] = useState<'guardado' | 'guardando'>('guardado');
  const [lastNotesSavedAt, setLastNotesSavedAt] = useState<string>('Listo');
  const [examplesCleared, setExamplesCleared] = useState(false);
  const [sharedViewerPayload, setSharedViewerPayload] = useState<SharedResourcePayload | null>(() =>
    readShareFromLocation()
  );
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Background Notifications & Reminders
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFS
  );
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getNotificationCapability().permission);
  const [scheduledReminders, setScheduledReminders] = useState<ScheduledReminderItem[]>(
    DEFAULT_SCHEDULED_REMINDERS
  );
  const [userQuotes, setUserQuotes] = useState<UserQuoteItem[]>(DEFAULT_USER_QUOTES);
  const [selectedZodiac, setSelectedZodiacState] = useState<ZodiacSignId>(DEFAULT_ZODIAC_SIGN);
  const [floatingChatOpen, setFloatingChatOpen] = useState<boolean>(false);
  const [isScreenTransitioning, setIsScreenTransitioning] = useState<boolean>(false);
  const [screenTransitionTick, setScreenTransitionTick] = useState<number>(0);
  const transitionTimerRef = useRef<number | null>(null);

  // Unified Background-Safe Pomodoro Timer (synced with QuickActionsBar, PomodoroTool, FloatingMiniWindow & MediaSession)
  const [pomoPresetId, setPomoPresetId] = useState<PomodoroPresetId>('25-5');
  const [pomoPhase, setPomoPhase] = useState<'focus' | 'rest'>('focus');
  const [pomoSubject, setPomoSubject] = useState<string>('Derecho Constitucional');
  const [pomoSecondsLeft, setPomoSecondsLeft] = useState<number>(25 * 60);
  const [pomoRunning, setPomoRunning] = useState<boolean>(false);
  const pomoEndMsRef = useRef<number | null>(null);
  const pomoPhaseRef = useRef(pomoPhase);
  pomoPhaseRef.current = pomoPhase;
  const pomoPresetIdRef = useRef(pomoPresetId);
  pomoPresetIdRef.current = pomoPresetId;
  const pomoSubjectRef = useRef(pomoSubject);
  pomoSubjectRef.current = pomoSubject;

  // Floating Mini-Window (Document PiP + Compact Overlay fallback)
  const [floatingMode, setFloatingMode] = useState<FloatingWindowMode>('closed');
  const [floatingNotice, setFloatingNotice] = useState<string | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const chatBroadcastRef = useRef<BroadcastChannel | null>(null);

  // Organizador Integral State
  const [inboxItems, setInboxItems] = useState<InboxCaptureItem[]>(DEFAULT_INBOX_ITEMS);
  const [organizerTasks, setOrganizerTasks] = useState<OrganizerTaskItem[]>(DEFAULT_ORGANIZER_TASKS);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlockItem[]>(DEFAULT_TIME_BLOCKS);
  const [dailyReview, setDailyReview] = useState<DailyReviewState>(DEFAULT_DAILY_REVIEW);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState<boolean>(false);
  const [organizerActiveTab, setOrganizerActiveTab] = useState<OrganizerTabId>('inbox');

  // Firebase Auth & Cloud Firestore Sync State
  const [authUser, setAuthUser] = useState<AuthUserSummary | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatusState>('guest-local');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalReason, setAuthModalReason] = useState<string | null>(null);
  const [authModalDefaultTab, setAuthModalDefaultTab] = useState<'login' | 'register'>('login');

  const applyingRemoteRef = useRef<boolean>(false);
  const pendingCloudSyncTimerRef = useRef<number | null>(null);
  const latestStateRef = useRef({
    profile,
    advancedNotes,
    inboxItems,
    organizerTasks,
    timeBlocks,
    dailyReview,
    moodLogs,
    guidedReflections,
    balancedPlanner,
    glossaryTerms,
  });
  latestStateRef.current = {
    profile,
    advancedNotes,
    inboxItems,
    organizerTasks,
    timeBlocks,
    dailyReview,
    moodLogs,
    guidedReflections,
    balancedPlanner,
    glossaryTerms,
  };

  const { snapshot: network, measureNow: measureNetwork } = useNetworkMonitor();

  // Deep-link from PWA shortcuts, notification click (?sector=...&submenu=...), or friend invite (?addFriendId=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramSector = params.get('sector') as SectorId | null;
    const paramSubmenu = params.get('submenu') as SubmenuId | null;
    const inviteId = params.get('addFriendId')?.trim();
    const inviteName = params.get('addFriendName')?.trim();
    let handledQuery = false;

    if (inviteId) {
      const cleanId = inviteId.toUpperCase();
      const cleanName = inviteName || `Amigo ${cleanId}`;
      setFriendRequests((prev) => {
        if (prev.some((r) => r.fabroId.toUpperCase() === cleanId && r.status === 'pending')) {
          return prev;
        }
        const incomingReq: FriendRequestItem = {
          id: `freq-link-${Date.now()}`,
          fabroId: cleanId,
          displayName: cleanName,
          note: 'Te envió su enlace de invitación directa a FABRO.',
          direction: 'incoming',
          status: 'pending',
          createdAt: 'Enlace compartido',
        };
        const next = [incomingReq, ...prev];
        void vaultSet('friend_requests', next);
        return next;
      });
      setSector('social');
      setSubmenu('amistades');
      handledQuery = true;
    }

    if (paramSector) {
      const validSector =
        paramSector === 'inicio' ||
        paramSector === 'hoy' ||
        SECTORS_CATALOG.some((s) => s.id === paramSector);
      if (validSector) {
        setSector(paramSector);
        if (paramSubmenu && ALL_SUBMENUS.some((m) => m.id === paramSubmenu)) {
          setSubmenu(paramSubmenu);
        } else if (paramSector === 'hoy') {
          setSubmenu('hoy-cosmos');
        } else if (paramSector !== 'inicio') {
          const def = SECTORS_CATALOG.find((s) => s.id === paramSector)?.defaultSubmenu;
          if (def) setSubmenu(def);
        } else {
          setSubmenu('dashboard');
        }
        handledQuery = true;
      }
    }

    if (handledQuery) {
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState(null, '', cleanUrl);
    }
  }, []);

  // Hydrate Offline-First local storage on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      const [
        savedTheme,
        savedProfile,
        savedFavs,
        savedRecents,
        savedNotifs,
        savedKeys,
        savedConnect,
        savedChat,
        savedCleared,
        savedNotes,
        savedMoods,
        savedTasks,
        savedPomodoros,
        savedIdeas,
        savedStudyQuiz,
        savedReflections,
        savedPlanner,
        savedAdvNotes,
        savedGlossary,
        savedNotifPrefs,
        savedReminders,
        savedFriends,
        savedFriendRequests,
        savedPinnedTools,
        savedWorkspaceCols,
        savedUserQuotes,
        savedZodiac,
        savedInboxItems,
        savedOrganizerTasks,
        savedTimeBlocks,
        savedDailyReview,
      ] = await Promise.all([
        vaultGet<ThemeId>('theme', 'estandar'),
        vaultGet<LocalUserProfile>('profile', DEFAULT_LOCAL_PROFILE),
        vaultGet<string[]>('favorites', DEFAULT_FAVORITES),
        vaultGet<ActivityEntry[]>('recents', []),
        vaultGet<NotificationEntry[]>('notifications', DEFAULT_NOTIFICATIONS),
        vaultGet<ByokProviderKey[]>('byok_keys', []),
        vaultGet<ConnectProviderItem[]>('connect_items', DEFAULT_CONNECT_ITEMS),
        vaultGet<ChatMessageItem[]>('chat_messages', DEFAULT_CHAT_MESSAGES),
        vaultGet<boolean>('examples_cleared', false),
        vaultGet<QuickNoteItem[] | null>('quick_notes', null),
        vaultGet<MoodLogItem[]>('mood_logs', []),
        vaultGet<AcademicAgendaTask[]>('agenda_tasks', DEFAULT_AGENDA_TASKS),
        vaultGet<PomodoroSessionLog[]>('pomodoro_logs', DEFAULT_POMODORO_LOGS),
        vaultGet<IdeaVaultItem[]>('ideas_vault', DEFAULT_IDEAS_VAULT),
        vaultGet<StudyQuiz>('study_quiz', DEFAULT_STUDY_QUIZ),
        vaultGet<GuidedReflectionItem[]>('guided_reflections', DEFAULT_GUIDED_REFLECTIONS),
        vaultGet<BalancedPlannerItem[]>('balanced_planner', DEFAULT_BALANCED_PLANNER),
        vaultGet<AdvancedNoteItem[] | null>('advanced_notes', null),
        vaultGet<GlossaryTermItem[] | null>('subject_glossary', null),
        vaultGet<NotificationPreferences>('notification_prefs', DEFAULT_NOTIFICATION_PREFS),
        vaultGet<ScheduledReminderItem[]>('scheduled_reminders', DEFAULT_SCHEDULED_REMINDERS),
        vaultGet<FriendContact[]>('friends_list', DEFAULT_FRIENDS_LIST),
        vaultGet<FriendRequestItem[]>('friend_requests', DEFAULT_FRIEND_REQUESTS),
        vaultGet<PinnedToolEntry[]>('pinned_tools', DEFAULT_PINNED_TOOLS),
        vaultGet<WorkspaceColumns>('workspace_columns', 3),
        vaultGet<UserQuoteItem[]>('user_quotes', DEFAULT_USER_QUOTES),
        vaultGet<ZodiacSignId>('selected_zodiac', DEFAULT_ZODIAC_SIGN),
        vaultGet<InboxCaptureItem[] | null>('org_inbox_items', null),
        vaultGet<OrganizerTaskItem[] | null>('org_tasks', null),
        vaultGet<TimeBlockItem[] | null>('org_time_blocks', null),
        vaultGet<DailyReviewState | null>('org_daily_review', null),
      ]);

      if (!active) return;
      setThemeState(savedTheme);
      setProfile(savedProfile);
      setFavorites(savedFavs);
      setPinnedTools(savedPinnedTools);
      setWorkspaceColumnsState(savedWorkspaceCols === 2 ? 2 : 3);
      setUserQuotes(savedUserQuotes);
      setSelectedZodiacState(savedZodiac);
      setRecents(savedRecents);
      setNotifications(savedNotifs);
      setByokKeys(savedKeys);
      setConnectItems(
        (savedConnect || DEFAULT_CONNECT_ITEMS).filter(
          (item) => (item.id as string) !== 'videoconf'
        )
      );
      setQuickChatMessages(savedChat);
      setExamplesCleared(savedCleared);
      setQuickNotes(
        savedNotes !== null ? savedNotes : savedCleared ? [] : DEFAULT_QUICK_NOTES
      );
      setMoodLogs(savedMoods);
      setAgendaTasks(savedTasks);
      setPomodoroLogs(savedPomodoros);
      setIdeasVault(savedIdeas);
      setStudyQuiz(savedStudyQuiz);
      setGuidedReflections(savedReflections);
      setBalancedPlanner(savedPlanner);
      setAdvancedNotes(
        savedAdvNotes !== null ? savedAdvNotes : savedCleared ? [] : DEFAULT_ADVANCED_NOTES
      );
      setGlossaryTerms(
        savedGlossary !== null ? savedGlossary : savedCleared ? [] : DEFAULT_GLOSSARY_TERMS
      );
      setNotificationPrefs(savedNotifPrefs);
      setScheduledReminders(savedReminders);
      setFriendsList(savedFriends);
      setFriendRequests(savedFriendRequests);
      setInboxItems(
        savedInboxItems !== null ? savedInboxItems : savedCleared ? [] : DEFAULT_INBOX_ITEMS
      );
      setOrganizerTasks(
        savedOrganizerTasks !== null
          ? savedOrganizerTasks
          : savedCleared
          ? []
          : DEFAULT_ORGANIZER_TASKS
      );
      setTimeBlocks(
        savedTimeBlocks !== null ? savedTimeBlocks : savedCleared ? [] : DEFAULT_TIME_BLOCKS
      );
      setDailyReview(savedDailyReview || DEFAULT_DAILY_REVIEW);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Apply theme attribute & .dark class cleanly on <html>
  useEffect(() => {
    const meta = FABRO_THEMES.find((t) => t.id === theme) || FABRO_THEMES[0];
    const root = document.documentElement;
    root.setAttribute('data-theme', meta.id);
    if (meta.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', meta.swatches[0]);
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemeId) => {
    setThemeState(nextTheme);
    void vaultSet('theme', nextTheme);
  }, []);

  const triggerTransitionEffect = useCallback(() => {
    setIsScreenTransitioning(true);
    setScreenTransitionTick((n) => n + 1);
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = window.setTimeout(() => {
      setIsScreenTransitioning(false);
    }, 340);
  }, []);

  const navigateTo = useCallback(
    (nextSector: SectorId, nextSubmenu?: SubmenuId) => {
      const resolvedSubmenu: SubmenuId =
        nextSector === 'inicio'
          ? 'dashboard'
          : nextSector === 'hoy'
          ? 'hoy-cosmos'
          : nextSector === 'herramientas'
          ? 'centro-herramientas'
          : nextSubmenu ||
            SECTORS_CATALOG.find((s) => s.id === nextSector)?.defaultSubmenu ||
            'dashboard';

      if (nextSector !== sector || resolvedSubmenu !== submenu) {
        setHistory((prev) => [...prev.slice(-14), { sector, submenu }]);
        triggerTransitionEffect();
      }

      setSector(nextSector);
      setSubmenu(resolvedSubmenu);

      if (nextSector !== 'inicio' && nextSector !== 'hoy' && nextSector !== 'herramientas') {
        const subMeta = ALL_SUBMENUS.find((item) => item.id === resolvedSubmenu);
        const entry: ActivityEntry = {
          id: `${nextSector}:${resolvedSubmenu}`,
          sector: nextSector,
          submenu: resolvedSubmenu,
          label: subMeta?.label || nextSector,
          timestamp: new Date().toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };

        setRecents((prev) => {
          const next = [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 6);
          void vaultSet('recents', next);
          return next;
        });
      }
    },
    [sector, submenu, triggerTransitionEffect]
  );

  const swipeNextScreen = useCallback(() => {
    const idx = PRIMARY_SCREENS_ORDER.findIndex((s) => s.sector === sector);
    const nextIdx = idx === -1 ? 0 : (idx + 1) % PRIMARY_SCREENS_ORDER.length;
    const target = PRIMARY_SCREENS_ORDER[nextIdx];
    navigateTo(target.sector, target.submenu);
  }, [navigateTo, sector]);

  const swipePrevScreen = useCallback(() => {
    const idx = PRIMARY_SCREENS_ORDER.findIndex((s) => s.sector === sector);
    const prevIdx =
      idx <= 0 ? PRIMARY_SCREENS_ORDER.length - 1 : (idx - 1) % PRIMARY_SCREENS_ORDER.length;
    const target = PRIMARY_SCREENS_ORDER[prevIdx];
    navigateTo(target.sector, target.submenu);
  }, [navigateTo, sector]);

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setHistory((prev) => prev.slice(0, -1));
      setSector(previous.sector);
      setSubmenu(previous.submenu);
      triggerTransitionEffect();
      return;
    }
    setSector('social');
    setSubmenu('fabro-id');
  }, [history, triggerTransitionEffect]);

  const updateProfile = useCallback((patch: Partial<LocalUserProfile>) => {
    setProfile((prev) => {
      const next: LocalUserProfile = {
        ...prev,
        ...patch,
        tastes: patch.tastes ? { ...prev.tastes, ...patch.tastes } : prev.tastes,
      };
      void vaultSet('profile', next);
      return next;
    });
  }, []);

  const setWorkspaceColumns = useCallback((cols: WorkspaceColumns) => {
    setWorkspaceColumnsState(cols);
    void vaultSet('workspace_columns', cols);
  }, []);

  const isToolPinned = useCallback(
    (sec: FiveSectorId, sub: SubmenuId) =>
      pinnedTools.some((t) => t.key === `${sec}:${sub}`),
    [pinnedTools]
  );

  const togglePinTool = useCallback((sec: FiveSectorId, sub: SubmenuId) => {
    const key = `${sec}:${sub}`;
    setPinnedTools((prev) => {
      const exists = prev.some((t) => t.key === key);
      const next = exists
        ? prev.filter((t) => t.key !== key)
        : [{ key, sector: sec, submenu: sub, size: 'compact' as const }, ...prev];
      void vaultSet('pinned_tools', next);
      const nextFavs = next.map((t) => t.key);
      setFavorites(nextFavs);
      void vaultSet('favorites', nextFavs);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback(
    (sec: FiveSectorId, sub: SubmenuId) => {
      togglePinTool(sec, sub);
    },
    [togglePinTool]
  );

  const setSelectedZodiac = useCallback((sign: ZodiacSignId) => {
    setSelectedZodiacState(sign);
    void vaultSet('selected_zodiac', sign);
  }, []);

  const addUserQuote = useCallback(
    (text: string, author: string, category: QuoteCategory) => {
      const clean = text.trim();
      if (!clean) return;
      const entry: UserQuoteItem = {
        id: `uq-${Date.now()}`,
        text: clean,
        author: author.trim() || profile.displayName || 'Usuario FABRO',
        category,
        likes: 1,
        likedByMe: true,
        createdAt: 'Recién',
      };
      setUserQuotes((prev) => {
        const next = [entry, ...prev].slice(0, 50);
        void vaultSet('user_quotes', next);
        return next;
      });
    },
    [profile.displayName]
  );

  const likeUserQuote = useCallback((id: string) => {
    setUserQuotes((prev) => {
      const next = prev.map((q) => {
        if (q.id !== id) return q;
        const nextLiked = !q.likedByMe;
        return {
          ...q,
          likedByMe: nextLiked,
          likes: Math.max(0, q.likes + (nextLiked ? 1 : -1)),
        };
      });
      void vaultSet('user_quotes', next);
      return next;
    });
  }, []);

  const deleteUserQuote = useCallback((id: string) => {
    setUserQuotes((prev) => {
      const next = prev.filter((q) => q.id !== id);
      void vaultSet('user_quotes', next);
      return next;
    });
  }, []);

  const movePinnedTool = useCallback((key: string, direction: 'up' | 'down') => {
    setPinnedTools((prev) => {
      const idx = prev.findIndex((t) => t.key === key);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      void vaultSet('pinned_tools', copy);
      const nextFavs = copy.map((t) => t.key);
      setFavorites(nextFavs);
      void vaultSet('favorites', nextFavs);
      return copy;
    });
  }, []);

  const setPinnedToolSize = useCallback((key: string, size: PinnedToolSize) => {
    setPinnedTools((prev) => {
      const next = prev.map((t) => (t.key === key ? { ...t, size } : t));
      void vaultSet('pinned_tools', next);
      return next;
    });
  }, []);

  const applyWorkspacePreset = useCallback((preset: 'estudio' | 'social' | 'equilibrio') => {
    const presets: Record<'estudio' | 'social' | 'equilibrio', PinnedToolEntry[]> = {
      estudio: [
        { key: 'estudio:academico-panel', sector: 'estudio', submenu: 'academico-panel', size: 'wide' },
        { key: 'estudio:materias-apuntes', sector: 'estudio', submenu: 'materias-apuntes', size: 'compact' },
        { key: 'estudio:mapas-flashcards', sector: 'estudio', submenu: 'mapas-flashcards', size: 'compact' },
        { key: 'estudio:examenes-calendario', sector: 'estudio', submenu: 'examenes-calendario', size: 'compact' },
        { key: 'ia:claves-byok', sector: 'ia', submenu: 'claves-byok', size: 'compact' },
      ],
      social: [
        { key: 'social:mensajeria', sector: 'social', submenu: 'mensajeria', size: 'wide' },
        { key: 'social:amistades', sector: 'social', submenu: 'amistades', size: 'compact' },
        { key: 'social:fabro-id', sector: 'social', submenu: 'fabro-id', size: 'compact' },
        { key: 'social:push-to-talk', sector: 'social', submenu: 'push-to-talk', size: 'compact' },
        { key: 'social:comunidades-seguridad', sector: 'social', submenu: 'comunidades-seguridad', size: 'compact' },
      ],
      equilibrio: DEFAULT_PINNED_TOOLS,
    };
    const next = presets[preset];
    setPinnedTools(next);
    void vaultSet('pinned_tools', next);
    const nextFavs = next.map((t) => t.key);
    setFavorites(nextFavs);
    void vaultSet('favorites', nextFavs);
  }, []);

  const resetPinnedTools = useCallback(() => {
    setPinnedTools(DEFAULT_PINNED_TOOLS);
    void vaultSet('pinned_tools', DEFAULT_PINNED_TOOLS);
    const nextFavs = DEFAULT_PINNED_TOOLS.map((t) => t.key);
    setFavorites(nextFavs);
    void vaultSet('favorites', nextFavs);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      void vaultSet('notifications', next);
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      void vaultSet('notifications', next);
      return next;
    });
  }, []);

  const saveByokKey = useCallback((keyItem: ByokProviderKey) => {
    setByokKeys((prev) => {
      const next = [keyItem, ...prev.filter((k) => k.id !== keyItem.id)];
      void vaultSet('byok_keys', next);
      return next;
    });
  }, []);

  const removeByokKey = useCallback((id: string) => {
    setByokKeys((prev) => {
      const next = prev.filter((k) => k.id !== id);
      void vaultSet('byok_keys', next);
      return next;
    });
  }, []);

  const saveConnectItems = useCallback((items: ConnectProviderItem[]) => {
    setConnectItems(items);
    void vaultSet('connect_items', items);
  }, []);

  const pushInAppNotification = useCallback(
    (title: string, detail: string, target: NavDestination) => {
      const entry: NotificationEntry = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title,
        detail,
        read: false,
        createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        target,
      };
      setNotifications((prev) => {
        const next = [entry, ...prev].slice(0, 30);
        void vaultSet('notifications', next);
        return next;
      });
    },
    []
  );

  // Service Worker notification click deep-link listener
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const onSwMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        sector?: SectorId;
        submenu?: SubmenuId;
      } | null;
      if (data?.type === 'FABRO_NOTIFICATION_NAVIGATE' && data.sector) {
        navigateTo(data.sector, data.submenu);
      }
    };
    navigator.serviceWorker.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSwMessage);
  }, [navigateTo]);

  const flushQueuedMessages = useCallback(
    (recipientId?: string): number => {
      let deliveredCount = 0;
      setQuickChatMessages((prev) => {
        const next = prev.map((m) => {
          if (m.deliveryStatus !== 'queued-offline') return m;
          const msgTarget = m.recipientId || 'general';
          if (recipientId && msgTarget !== recipientId) return m;
          deliveredCount += 1;
          return { ...m, deliveryStatus: 'delivered-local' as const };
        });
        if (deliveredCount > 0) {
          void vaultSet('chat_messages', next);
        }
        return deliveredCount > 0 ? next : prev;
      });
      if (deliveredCount > 0) {
        pushInAppNotification(
          'Mensajes entregados tras reconexión',
          `${deliveredCount} mensaje${deliveredCount === 1 ? '' : 's'} en cola offline ${
            deliveredCount === 1 ? 'fue entregado' : 'fueron entregados'
          }.`,
          { sector: 'social', submenu: 'mensajeria' }
        );
      }
      return deliveredCount;
    },
    [pushInAppNotification]
  );

  // Auto-flush network-queued messages on 'general' or online friends when device regains connectivity
  useEffect(() => {
    if (!network.isOnline) return;
    setQuickChatMessages((prev) => {
      let changed = false;
      const next = prev.map((m) => {
        if (m.deliveryStatus !== 'queued-offline') return m;
        const targetId = m.recipientId || 'general';
        const friend = friendsList.find((f) => f.id === targetId);
        if (targetId === 'general' || (friend && friend.availability !== 'offline')) {
          changed = true;
          return { ...m, deliveryStatus: 'delivered-local' as const };
        }
        return m;
      });
      if (changed) {
        void vaultSet('chat_messages', next);
      }
      return changed ? next : prev;
    });
  }, [friendsList, network.isOnline]);

  const openDirectChatWithFriend = useCallback(
    (friendId: string) => {
      setActiveChatThreadId(friendId);
      navigateTo('social', 'mensajeria');
    },
    [navigateTo]
  );

  const addFriendDirectly = useCallback(
    (
      fabroId: string,
      displayName: string,
      bio = 'Contacto agregado en FABRO',
      availability: FriendAvailability = 'offline'
    ): FriendContact => {
      const cleanId = fabroId.trim().toUpperCase() || `FBR-${Math.floor(1000 + Math.random() * 9000)}`;
      const cleanName = displayName.trim() || `Contacto ${cleanId}`;
      let resolved: FriendContact | null = null;
      setFriendsList((prev) => {
        const existing = prev.find((f) => f.fabroId.toUpperCase() === cleanId);
        if (existing) {
          resolved = existing;
          return prev;
        }
        const created: FriendContact = {
          id: `fr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          fabroId: cleanId,
          displayName: cleanName,
          bio: bio.trim() || 'Contacto agregado en FABRO',
          availability,
          lastSeenLabel:
            availability === 'online'
              ? 'En línea ahora'
              : 'Sin conexión · Mensajes disponibles en cola offline',
          trustedGroup: true,
          addedAt: 'Hoy',
        };
        resolved = created;
        const next = [created, ...prev];
        void vaultSet('friends_list', next);
        return next;
      });
      return (
        resolved || {
          id: `fr-${cleanId}`,
          fabroId: cleanId,
          displayName: cleanName,
          bio,
          availability,
          lastSeenLabel:
            availability === 'online'
              ? 'En línea ahora'
              : 'Sin conexión · Mensajes disponibles en cola offline',
          trustedGroup: true,
          addedAt: 'Hoy',
        }
      );
    },
    []
  );

  const sendFriendRequest = useCallback(
    (fabroId: string, displayName: string, note = '¡Hola! Sumémonos como amistad en FABRO.') => {
      const cleanId = fabroId.trim().toUpperCase();
      if (!cleanId) return;
      const cleanName = displayName.trim() || `Usuario ${cleanId}`;
      const req: FriendRequestItem = {
        id: `freq-${Date.now()}`,
        fabroId: cleanId,
        displayName: cleanName,
        note: note.trim() || '¡Hola! Sumémonos como amistad en FABRO.',
        direction: 'outgoing',
        status: 'pending',
        createdAt: 'Recién',
      };
      setFriendRequests((prev) => {
        const next = [req, ...prev];
        void vaultSet('friend_requests', next);
        return next;
      });
    },
    []
  );

  const respondFriendRequest = useCallback(
    (requestId: string, action: 'accept' | 'reject' | 'cancel') => {
      setFriendRequests((prev) => {
        const target = prev.find((r) => r.id === requestId);
        if (action === 'accept' && target) {
          addFriendDirectly(target.fabroId, target.displayName, target.note, 'offline');
        }
        const next =
          action === 'cancel'
            ? prev.filter((r) => r.id !== requestId)
            : prev.map((r) =>
                r.id === requestId
                  ? { ...r, status: action === 'accept' ? ('accepted' as const) : ('rejected' as const) }
                  : r
              );
        void vaultSet('friend_requests', next);
        return next;
      });
    },
    [addFriendDirectly]
  );

  const removeFriend = useCallback((friendId: string) => {
    setFriendsList((prev) => {
      const next = prev.filter((f) => f.id !== friendId);
      void vaultSet('friends_list', next);
      return next;
    });
    setActiveChatThreadId((curr) => (curr === friendId ? 'general' : curr));
  }, []);

  const toggleFriendAvailability = useCallback(
    (friendId: string) => {
      let becameOnline = false;
      setFriendsList((prev) => {
        const next = prev.map((f) => {
          if (f.id !== friendId) return f;
          const nextAvail: FriendAvailability = f.availability === 'online' ? 'offline' : 'online';
          if (nextAvail === 'online') becameOnline = true;
          return {
            ...f,
            availability: nextAvail,
            lastSeenLabel:
              nextAvail === 'online'
                ? 'En línea ahora'
                : 'Sin conexión · Mensajes disponibles en cola offline',
          };
        });
        void vaultSet('friends_list', next);
        return next;
      });
      if (becameOnline && network.isOnline) {
        flushQueuedMessages(friendId);
      }
    },
    [flushQueuedMessages, network.isOnline]
  );

  const toggleFriendTrustedGroup = useCallback((friendId: string) => {
    setFriendsList((prev) => {
      const next = prev.map((f) =>
        f.id === friendId ? { ...f, trustedGroup: !f.trustedGroup } : f
      );
      void vaultSet('friends_list', next);
      return next;
    });
  }, []);

  const sendQuickChatMessage = useCallback(
    (text: string, options?: SendChatOptions) => {
      const clean = text.trim();
      if (!clean && !options?.audioUrl && !options?.sticker) return;
      const msgSender = options?.senderOverride || profile.displayName || 'Tú';
      const isIncoming = Boolean(options?.isIncoming);
      const targetId = options?.recipientId ?? activeChatThreadId ?? 'general';
      const targetFriend = friendsList.find((f) => f.id === targetId);
      const mustQueueOffline =
        !isIncoming &&
        (!network.isOnline || (targetFriend ? targetFriend.availability === 'offline' : false));
      const resolvedText =
        clean || (options?.sticker ? `Sticker ${options.sticker}` : 'Nota de voz rápida');
      const newMsg: ChatMessageItem = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: msgSender,
        text: resolvedText,
        time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        own: !isIncoming,
        starred: false,
        reactions: [],
        replyTo: options?.replyTo,
        audioUrl: options?.audioUrl,
        sticker: options?.sticker,
        recipientId: targetId,
        deliveryStatus: mustQueueOffline ? 'queued-offline' : 'delivered-local',
      };

      setQuickChatMessages((prev) => {
        const next = [...prev, newMsg];
        void vaultSet('chat_messages', next);
        return next;
      });

      // Notify across open tabs / background when incoming or tab is hidden
      if (isIncoming) {
        pushInAppNotification(`💬 ${msgSender}`, resolvedText, {
          sector: 'social',
          submenu: 'mensajeria',
        });
        if (notificationPrefs.chatMessages) {
          void dispatchSystemNotification({
            title: `💬 Mensaje de ${msgSender}`,
            body: resolvedText,
            sector: 'social',
            submenu: 'mensajeria',
            tag: `fabro-chat-${newMsg.id}`,
            soundType: 'interval',
            prefs: notificationPrefs,
            onInAppFallback: (s, sub) => navigateTo(s, sub),
          });
        }
      } else if (chatBroadcastRef.current) {
        try {
          chatBroadcastRef.current.postMessage({
            type: 'FABRO_CHAT_MESSAGE',
            message: newMsg,
          });
        } catch {
          // ignore channel errors
        }
      }
    },
    [
      activeChatThreadId,
      friendsList,
      navigateTo,
      network.isOnline,
      notificationPrefs,
      profile.displayName,
      pushInAppNotification,
    ]
  );

  // Cross-tab BroadcastChannel listener so messages sent in another tab/mini-window fire background notifications
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('fabro-chat-bg');
    chatBroadcastRef.current = channel;
    channel.onmessage = (ev: MessageEvent<{ type?: string; message?: ChatMessageItem }>) => {
      if (ev.data?.type !== 'FABRO_CHAT_MESSAGE' || !ev.data.message) return;
      const incoming = { ...ev.data.message, own: false };
      setQuickChatMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        const next = [...prev, incoming];
        void vaultSet('chat_messages', next);
        return next;
      });
      pushInAppNotification(`💬 ${incoming.sender}`, incoming.text, {
        sector: 'social',
        submenu: 'mensajeria',
      });
      if (notificationPrefs.chatMessages && document.hidden) {
        void dispatchSystemNotification({
          title: `💬 Nuevo mensaje · ${incoming.sender}`,
          body: incoming.text,
          sector: 'social',
          submenu: 'mensajeria',
          tag: `fabro-chat-${incoming.id}`,
          soundType: 'interval',
          prefs: notificationPrefs,
          onInAppFallback: (s, sub) => navigateTo(s, sub),
        });
      }
    };
    return () => {
      channel.close();
      chatBroadcastRef.current = null;
    };
  }, [navigateTo, notificationPrefs, pushInAppNotification]);

  const toggleChatStar = useCallback((id: string) => {
    setQuickChatMessages((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m));
      void vaultSet('chat_messages', next);
      return next;
    });
  }, []);

  const reactToChatMessage = useCallback((id: string, emoji: string) => {
    setQuickChatMessages((prev) => {
      const next = prev.map((m) => {
        if (m.id !== id) return m;
        const current = m.reactions || [];
        const updated = current.includes(emoji)
          ? current.filter((r) => r !== emoji)
          : [...current, emoji];
        return { ...m, reactions: updated };
      });
      void vaultSet('chat_messages', next);
      return next;
    });
  }, []);

  const addQuickNote = useCallback((title: string, body: string, subject: string) => {
    const cleanBody = body.trim();
    if (!cleanBody) return;
    setQuickNotes((prev) => {
      const next: QuickNoteItem[] = [
        {
          id: `qnote-${Date.now()}`,
          title: title.trim() || 'Nota rápida',
          body: cleanBody,
          subject: subject.trim() || 'General',
          createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ].slice(0, 30);
      void vaultSet('quick_notes', next);
      return next;
    });
  }, []);

  const addMoodLog = useCallback((score: number, emotion: string, habit: string) => {
    setMoodLogs((prev) => {
      const next: MoodLogItem[] = [
        {
          id: `mood-${Date.now()}`,
          score,
          emotion: emotion.trim() || 'Serenidad',
          habit: habit.trim() || 'Hábito registrado',
          timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev,
      ].slice(0, 30);
      void vaultSet('mood_logs', next);
      return next;
    });
  }, []);

  const addAgendaTask = useCallback((task: string, subject: string, date: string) => {
    if (!task.trim()) return;
    setAgendaTasks((prev) => {
      const next: AcademicAgendaTask[] = [
        {
          id: `task-${Date.now()}`,
          task: task.trim(),
          subject: subject.trim() || 'General',
          date: date.trim() || 'Hoy',
          done: false,
        },
        ...prev,
      ];
      void vaultSet('agenda_tasks', next);
      return next;
    });
  }, []);

  const toggleAgendaTask = useCallback((id: string) => {
    setAgendaTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      void vaultSet('agenda_tasks', next);
      return next;
    });
  }, []);

  const addPomodoroLog = useCallback((subject: string, minutes: number) => {
    const entry: PomodoroSessionLog = {
      id: `pom-${Date.now()}`,
      subject: subject.trim() || 'Estudio General',
      minutes,
      completedAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };
    setPomodoroLogs((prev) => {
      const next = [entry, ...prev].slice(0, 40);
      void vaultSet('pomodoro_logs', next);
      return next;
    });
  }, []);

  const addIdeaVaultItem = useCallback(
    (
      title: string,
      targetSector: IdeaVaultItem['sector'],
      description: string,
      priority: IdeaVaultItem['priority']
    ) => {
      if (!title.trim() || !description.trim()) return;
      const item: IdeaVaultItem = {
        id: `idea-${Date.now()}`,
        title: title.trim(),
        sector: targetSector,
        description: description.trim(),
        priority,
        status: 'propuesta',
        votes: 1,
        votedByMe: true,
        author: profile.displayName || 'Usuario FABRO',
        createdAt: 'Hoy',
      };
      setIdeasVault((prev) => {
        const next = [item, ...prev];
        void vaultSet('ideas_vault', next);
        return next;
      });
    },
    [profile.displayName]
  );

  const toggleIdeaVote = useCallback((id: string) => {
    setIdeasVault((prev) => {
      const next = prev.map((item) =>
        item.id === id
          ? {
              ...item,
              votedByMe: !item.votedByMe,
              votes: item.votedByMe ? Math.max(0, item.votes - 1) : item.votes + 1,
            }
          : item
      );
      void vaultSet('ideas_vault', next);
      return next;
    });
  }, []);

  const updateIdeaStatus = useCallback((id: string, status: IdeaVaultItem['status']) => {
    setIdeasVault((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, status } : item));
      void vaultSet('ideas_vault', next);
      return next;
    });
  }, []);

  const addQuizQuestion = useCallback((question: Omit<StudyQuizQuestion, 'id'>) => {
    setStudyQuiz((prev) => {
      const next: StudyQuiz = {
        ...prev,
        questions: [
          ...prev.questions,
          { ...question, id: `q-${Date.now()}` },
        ],
      };
      void vaultSet('study_quiz', next);
      return next;
    });
  }, []);

  const updateGuidedReflection = useCallback((id: string, answer: string) => {
    setGuidedReflections((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, answer } : r));
      void vaultSet('guided_reflections', next);
      return next;
    });
  }, []);

  const toggleBalancedPlanner = useCallback((id: string) => {
    setBalancedPlanner((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item));
      void vaultSet('balanced_planner', next);
      return next;
    });
  }, []);

  const persistNotes = useCallback((nextNotes: AdvancedNoteItem[]) => {
    setNotesSaveState('guardando');
    void vaultSet('advanced_notes', nextNotes).then(() => {
      setNotesSaveState('guardado');
      setLastNotesSavedAt(
        new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      );
    });
  }, []);

  const createAdvancedNote = useCallback(
    (seed?: Partial<Pick<AdvancedNoteItem, 'title' | 'subject' | 'folder'>>) => {
      const nowTime = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const created: AdvancedNoteItem = {
        id: `adv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: seed?.title?.trim() || 'Nuevo Apunte de Estudio',
        subject: seed?.subject?.trim() || 'General',
        folder: seed?.folder?.trim() || 'General',
        tags: [],
        favorite: false,
        mainIdea: '',
        summaryText: '',
        contentHtml: '<h1>Nuevo apunte</h1><p>Empezá a escribir o usá la barra superior para resaltar ideas clave.</p>',
        contentText: 'Nuevo apunte\nEmpezá a escribir o usá la barra superior para resaltar ideas clave.',
        audioClips: [],
        createdAt: `Hoy · ${nowTime}`,
        updatedAt: `Hoy · ${nowTime}`,
      };
      setAdvancedNotes((prev) => {
        const next = [created, ...prev];
        persistNotes(next);
        return next;
      });
      return created;
    },
    [persistNotes]
  );

  const updateAdvancedNote = useCallback(
    (id: string, patch: Partial<AdvancedNoteItem>) => {
      const nowTime = new Date().toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setAdvancedNotes((prev) => {
        const next = prev.map((n) =>
          n.id === id ? { ...n, ...patch, updatedAt: `Hoy · ${nowTime}` } : n
        );
        persistNotes(next);
        return next;
      });
    },
    [persistNotes]
  );

  const deleteAdvancedNote = useCallback(
    (id: string) => {
      setAdvancedNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        persistNotes(next);
        return next;
      });
    },
    [persistNotes]
  );

  const addGlossaryTerm = useCallback((subject: string, term: string, definition: string) => {
    const cleanTerm = term.trim();
    const cleanDef = definition.trim();
    if (!cleanTerm || !cleanDef) return;
    const item: GlossaryTermItem = {
      id: `glos-${Date.now()}`,
      subject: subject.trim() || 'General',
      term: cleanTerm,
      definition: cleanDef,
      createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    };
    setGlossaryTerms((prev) => {
      const next = [item, ...prev];
      setNotesSaveState('guardando');
      void vaultSet('subject_glossary', next).then(() => {
        setNotesSaveState('guardado');
        setLastNotesSavedAt(
          new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        );
      });
      return next;
    });
  }, []);

  const deleteGlossaryTerm = useCallback((id: string) => {
    setGlossaryTerms((prev) => {
      const next = prev.filter((g) => g.id !== id);
      setNotesSaveState('guardando');
      void vaultSet('subject_glossary', next).then(() => {
        setNotesSaveState('guardado');
      });
      return next;
    });
  }, []);

  const clearSeedExamples = useCallback(async () => {
    setExamplesCleared(true);
    setQuickNotes((prev) => {
      const next = prev.filter((n) => n.id !== 'qn-seed-1');
      void vaultSet('quick_notes', next);
      return next;
    });
    setAdvancedNotes((prev) => {
      const next = prev.filter((n) => !n.id.startsWith('adv-seed-'));
      void vaultSet('advanced_notes', next);
      return next;
    });
    setGlossaryTerms((prev) => {
      const next = prev.filter((g) => !g.id.startsWith('glos-seed-'));
      void vaultSet('subject_glossary', next);
      return next;
    });
    setStudyQuiz({ id: 'quiz-custom', title: 'Mi Simulacro Personalizado', subject: 'General', questions: [] });
    setGuidedReflections((prev) => prev.map((r) => ({ ...r, answer: '' })));
    await Promise.all([
      vaultSet('examples_cleared', true),
      vaultSet('study_quiz', {
        id: 'quiz-custom',
        title: 'Mi Simulacro Personalizado',
        subject: 'General',
        questions: [],
      }),
      vaultSet(
        'guided_reflections',
        DEFAULT_GUIDED_REFLECTIONS.map((r) => ({ ...r, answer: '' }))
      ),
    ]);
  }, []);

  const openSharedPreview = useCallback((payload: SharedResourcePayload) => {
    setSharedViewerPayload(payload);
  }, []);

  const closeSharedViewer = useCallback(() => {
    clearShareFromLocation();
    setSharedViewerPayload(null);
  }, []);

  const importSharedResourceToVault = useCallback(
    async (payload: SharedResourcePayload) => {
      if (payload.kind === 'note') {
        addQuickNote(payload.title, payload.body, payload.subject);
        const nowTime = new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
        });
        const escapedParagraphs = payload.body
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
          .join('');
        const importedAdv: AdvancedNoteItem = {
          id: `adv-imp-${Date.now()}`,
          title: payload.title,
          subject: payload.subject || 'General',
          folder: 'General',
          tags: payload.tags || ['compartido'],
          favorite: true,
          mainIdea: payload.mainIdea || '',
          summaryText: payload.summaryText || '',
          contentHtml: escapedParagraphs || `<p>${payload.body}</p>`,
          contentText: payload.body,
          audioClips: [],
          createdAt: `Importado · ${nowTime}`,
          updatedAt: `Hoy · ${nowTime}`,
        };
        setAdvancedNotes((prev) => {
          const next = [importedAdv, ...prev];
          void vaultSet('advanced_notes', next);
          return next;
        });
        if (payload.glossary && payload.glossary.length > 0) {
          payload.glossary.forEach((g) => {
            addGlossaryTerm(payload.subject || 'General', g.term, g.definition);
          });
        }
        navigateTo('estudio', 'materias-apuntes');
      } else if (payload.kind === 'flashcards') {
        const existing = await vaultGet<SrsFlashcard[]>('srs_flashcards', DEFAULT_FLASHCARDS);
        const imported: SrsFlashcard[] = payload.cards.map((c, idx) => ({
          id: `fc-imp-${Date.now()}-${idx}`,
          subject: payload.subject,
          front: c.front,
          back: c.back,
          difficulty: 'nueva',
          intervalLabel: 'Hoy',
          reviews: 0,
        }));
        await vaultSet('srs_flashcards', [...imported, ...existing]);
        navigateTo('estudio', 'mapas-flashcards');
      } else if (payload.kind === 'quiz') {
        const importedQuiz: StudyQuiz = {
          id: `quiz-imp-${Date.now()}`,
          title: payload.title,
          subject: payload.subject,
          questions: payload.questions,
        };
        setStudyQuiz(importedQuiz);
        await vaultSet('study_quiz', importedQuiz);
        navigateTo('estudio', 'examenes-calendario');
      } else if (payload.kind === 'concept-map') {
        await vaultSet<ConceptNode[]>('concept_nodes', payload.nodes);
        navigateTo('estudio', 'mapas-flashcards');
      } else if (payload.kind === 'routine') {
        const existing = await vaultGet<WorkoutLogEntry[]>('workout_logs', []);
        const entry: WorkoutLogEntry = {
          id: `wk-imp-${Date.now()}`,
          routine: payload.title,
          rounds: payload.rounds,
          reps: 0,
          durationLabel: `${Math.round(((payload.workSec + payload.restSec) * payload.rounds) / 60)} min`,
          dateLabel: 'Guardado',
        };
        await vaultSet('workout_logs', [entry, ...existing]);
        navigateTo('bienestar', 'salud-ejercicios');
      } else if (payload.kind === 'stoic') {
        setGuidedReflections((prev) => {
          const next: GuidedReflectionItem[] = [
            {
              id: `ref-imp-${Date.now()}`,
              title: payload.title,
              prompt: payload.prompt,
              answer: payload.reflection,
              stoicQuote: payload.quote || 'Reflexión guardada desde enlace compartido.',
            },
            ...prev,
          ];
          void vaultSet('guided_reflections', next);
          return next;
        });
        navigateTo('bienestar', 'mi-vida');
      }

      clearShareFromLocation();
      setSharedViewerPayload(null);
      setImportNotice(`«${payload.title}» se guardó en tu FABRO local sin necesidad de cuenta.`);
    },
    [addGlossaryTerm, addQuickNote, navigateTo]
  );

  // Notification Preferences, Permission & Scheduled Reminders
  const refreshNotificationPermission = useCallback(() => {
    setNotificationPermission(getNotificationCapability().permission);
  }, []);

  const updateNotificationPrefs = useCallback((patch: Partial<NotificationPreferences>) => {
    setNotificationPrefs((prev) => {
      const next = { ...prev, ...patch };
      void vaultSet('notification_prefs', next);
      return next;
    });
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    const res = await requestBrowserNotificationPermission();
    setNotificationPermission(res.permission);
    if (res.permission === 'granted') {
      updateNotificationPrefs({ enabled: true });
    }
    return res;
  }, [updateNotificationPrefs]);

  const triggerTestNotification = useCallback(async () => {
    pushInAppNotification(
      '🔔 Aviso de prueba FABRO',
      'Notificaciones en segundo plano operativas. Tocá para ir a Estudio.',
      { sector: 'estudio', submenu: 'academico-panel' }
    );
    const res = await dispatchSystemNotification({
      title: '🍀 FABRO — Aviso de prueba',
      body: 'Las notificaciones con sonido y vibración están listas aunque estés en otra app.',
      sector: 'estudio',
      submenu: 'academico-panel',
      tag: `fabro-test-${Date.now()}`,
      soundType: 'focus-end',
      prefs: notificationPrefs,
      onInAppFallback: (s, sub) => navigateTo(s, sub),
    });
    return { delivered: res.delivered, note: res.note };
  }, [navigateTo, notificationPrefs, pushInAppNotification]);

  const addScheduledReminder = useCallback(
    (
      title: string,
      targetSector: 'estudio' | 'bienestar',
      targetSubmenu: SubmenuId,
      minutesFromNow: number
    ) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;
      const safeMin = Math.max(1, Math.min(1440, minutesFromNow));
      const item: ScheduledReminderItem = {
        id: `rem-${Date.now()}`,
        title: cleanTitle,
        sector: targetSector,
        submenu: targetSubmenu,
        triggerAtMs: Date.now() + safeMin * 60 * 1000,
        fired: false,
        createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      };
      setScheduledReminders((prev) => {
        const next = [item, ...prev].slice(0, 25);
        void vaultSet('scheduled_reminders', next);
        return next;
      });
    },
    []
  );

  const deleteScheduledReminder = useCallback((id: string) => {
    setScheduledReminders((prev) => {
      const next = prev.filter((r) => r.id !== id);
      void vaultSet('scheduled_reminders', next);
      return next;
    });
  }, []);

  // Scheduled Reminders checker (runs periodically + when returning from background)
  useEffect(() => {
    const checkDueReminders = () => {
      const now = Date.now();
      setScheduledReminders((prev) => {
        const due = prev.filter((r) => !r.fired && r.triggerAtMs <= now);
        if (due.length === 0) return prev;
        const next = prev.map((r) =>
          !r.fired && r.triggerAtMs <= now ? { ...r, fired: true } : r
        );
        void vaultSet('scheduled_reminders', next);

        due.forEach((rem) => {
          pushInAppNotification(`⏰ Recordatorio: ${rem.title}`, 'Programado en FABRO', {
            sector: rem.sector,
            submenu: rem.submenu,
          });
          if (notificationPrefs.scheduledReminders) {
            void dispatchSystemNotification({
              title: `⏰ Recordatorio FABRO`,
              body: rem.title,
              sector: rem.sector,
              submenu: rem.submenu,
              tag: `fabro-rem-${rem.id}`,
              soundType: 'interval',
              prefs: notificationPrefs,
              onInAppFallback: (s, sub) => navigateTo(s, sub),
            });
          }
        });
        return next;
      });
    };

    const timer = window.setInterval(checkDueReminders, 10000);
    const onVisible = () => {
      if (!document.hidden) checkDueReminders();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [navigateTo, notificationPrefs, pushInAppNotification]);

  const notifyRoutineCompleted = useCallback(
    (routineName: string) => {
      pushInAppNotification(
        '💪 Rutina completada',
        `Finalizaste «${routineName}». ¡Gran constancia!`,
        { sector: 'bienestar', submenu: 'salud-ejercicios' }
      );
      if (notificationPrefs.pomodoroAndRoutines) {
        void dispatchSystemNotification({
          title: '🍀 Rutina finalizada',
          body: `Completaste «${routineName}». Tomate un momento para hidratarte.`,
          sector: 'bienestar',
          submenu: 'salud-ejercicios',
          tag: 'fabro-workout-complete',
          soundType: 'focus-end',
          prefs: notificationPrefs,
          onInAppFallback: (s, sub) => navigateTo(s, sub),
        });
      }
    },
    [navigateTo, notificationPrefs, pushInAppNotification]
  );

  const simulateIncomingChatNotification = useCallback(
    (sender = 'Camila · Grupo Estudio', text = '¿Arrancamos el bloque Pomodoro de las 19:00?') => {
      sendQuickChatMessage(text, {
        senderOverride: sender,
        isIncoming: true,
      });
    },
    [sendQuickChatMessage]
  );

  // Unified Pomodoro Actions + Timestamp-Accurate Background Timer + Media Session
  const handlePomodoroBlockTransition = useCallback(() => {
    const preset = POMODORO_PRESETS.find((p) => p.id === pomoPresetIdRef.current) || POMODORO_PRESETS[0];
    if (pomoPhaseRef.current === 'focus') {
      playSoftBell('focus-end');
      addPomodoroLog(pomoSubjectRef.current, preset.focus);
      pushInAppNotification(
        '⏱️ Bloque Pomodoro completado',
        `Sumaste ${preset.focus} min en ${pomoSubjectRef.current}. ¡Toca descansar ${preset.rest} min!`,
        { sector: 'estudio', submenu: 'academico-panel' }
      );
      if (notificationPrefs.pomodoroAndRoutines) {
        void dispatchSystemNotification({
          title: `🍀 Bloque de ${preset.focus} min completado`,
          body: `${pomoSubjectRef.current} · Comienza descanso de ${preset.rest} min.`,
          sector: 'estudio',
          submenu: 'academico-panel',
          tag: 'fabro-pomodoro-phase',
          soundType: null,
          prefs: notificationPrefs,
          onInAppFallback: (s, sub) => navigateTo(s, sub),
        });
      }
      const nextSec = preset.rest * 60;
      setPomoPhase('rest');
      setPomoSecondsLeft(nextSec);
      pomoEndMsRef.current = Date.now() + nextSec * 1000;
    } else {
      playSoftBell('break-end');
      pushInAppNotification(
        '🎯 Descanso finalizado',
        `Listo para retomar enfoque en ${pomoSubjectRef.current}.`,
        { sector: 'estudio', submenu: 'academico-panel' }
      );
      if (notificationPrefs.pomodoroAndRoutines) {
        void dispatchSystemNotification({
          title: '🍀 Fin del descanso Pomodoro',
          body: `Volvemos a enfoque: ${pomoSubjectRef.current}.`,
          sector: 'estudio',
          submenu: 'academico-panel',
          tag: 'fabro-pomodoro-phase',
          soundType: null,
          prefs: notificationPrefs,
          onInAppFallback: (s, sub) => navigateTo(s, sub),
        });
      }
      const nextSec = preset.focus * 60;
      setPomoPhase('focus');
      setPomoSecondsLeft(nextSec);
      pomoEndMsRef.current = Date.now() + nextSec * 1000;
    }
  }, [addPomodoroLog, navigateTo, notificationPrefs, pushInAppNotification]);

  const selectPomodoroPreset = useCallback((id: PomodoroPresetId) => {
    const found = POMODORO_PRESETS.find((p) => p.id === id) || POMODORO_PRESETS[0];
    setPomoRunning(false);
    pomoEndMsRef.current = null;
    setPomoPresetId(id);
    setPomoPhase('focus');
    setPomoSecondsLeft(found.focus * 60);
    stopMediaSession('timer');
  }, []);

  const resetPomodoro = useCallback(() => {
    const found = POMODORO_PRESETS.find((p) => p.id === pomoPresetIdRef.current) || POMODORO_PRESETS[0];
    setPomoRunning(false);
    pomoEndMsRef.current = null;
    setPomoPhase('focus');
    setPomoSecondsLeft(found.focus * 60);
    stopMediaSession('timer');
  }, []);

  const togglePomodoro = useCallback(() => {
    setPomoRunning((prev) => {
      const next = !prev;
      if (next) {
        pomoEndMsRef.current = Date.now() + pomoSecondsLeft * 1000;
      } else {
        pomoEndMsRef.current = null;
      }
      return next;
    });
  }, [pomoSecondsLeft]);

  const completePomodoroManual = useCallback(
    (subjectOverride?: string) => {
      const found = POMODORO_PRESETS.find((p) => p.id === pomoPresetIdRef.current) || POMODORO_PRESETS[0];
      const sub = (subjectOverride || pomoSubjectRef.current).trim() || 'Estudio General';
      playSoftBell('focus-end');
      addPomodoroLog(sub, found.focus);
      pushInAppNotification(
        '✅ Bloque Pomodoro registrado',
        `+${found.focus} min guardados en ${sub}.`,
        { sector: 'estudio', submenu: 'academico-panel' }
      );
      if (notificationPrefs.pomodoroAndRoutines) {
        void dispatchSystemNotification({
          title: `🍀 Bloque registrado en ${sub}`,
          body: `Se guardaron ${found.focus} min en tu historial de Estudio.`,
          sector: 'estudio',
          submenu: 'academico-panel',
          tag: 'fabro-pomodoro-manual',
          soundType: null,
          prefs: notificationPrefs,
          onInAppFallback: (s, subId) => navigateTo(s, subId),
        });
      }
    },
    [addPomodoroLog, navigateTo, notificationPrefs, pushInAppNotification]
  );

  // Pomodoro timestamp-accurate tick (resists mobile browser background throttling)
  useEffect(() => {
    if (!pomoRunning) return;
    if (!pomoEndMsRef.current) {
      pomoEndMsRef.current = Date.now() + pomoSecondsLeft * 1000;
    }

    const syncTick = () => {
      if (!pomoEndMsRef.current) return;
      const remaining = Math.ceil((pomoEndMsRef.current - Date.now()) / 1000);
      if (remaining <= 0) {
        handlePomodoroBlockTransition();
      } else {
        setPomoSecondsLeft(remaining);
      }
    };

    const id = window.setInterval(syncTick, 1000);
    const onVisible = () => {
      if (!document.hidden) syncTick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [handlePomodoroBlockTransition, pomoRunning, pomoSecondsLeft]);

  // Sync Media Session API while Pomodoro runs so lock-screen controls & background playback stay active
  useEffect(() => {
    const preset = POMODORO_PRESETS.find((p) => p.id === pomoPresetId) || POMODORO_PRESETS[0];
    const totalSec = (pomoPhase === 'focus' ? preset.focus : preset.rest) * 60;

    if (!pomoRunning) {
      return;
    }

    activateMediaSession({
      title: `${pomoPhase === 'focus' ? 'Enfoque' : 'Descanso'} · ${pomoSubject}`,
      artist: 'Temporizador Pomodoro FABRO',
      album: '🍀 FABRO 🍀 · Segundo Plano',
      mode: 'timer',
      playbackState: 'playing',
      handlers: {
        onPlay: () => {
          pomoEndMsRef.current = Date.now() + pomoSecondsLeft * 1000;
          setPomoRunning(true);
        },
        onPause: () => {
          pomoEndMsRef.current = null;
          setPomoRunning(false);
        },
        onNext: () => handlePomodoroBlockTransition(),
        onStop: () => resetPomodoro(),
      },
    });
    updateMediaSessionPosition(totalSec, Math.max(0, totalSec - pomoSecondsLeft));
  }, [
    handlePomodoroBlockTransition,
    pomoPhase,
    pomoPresetId,
    pomoRunning,
    pomoSecondsLeft,
    pomoSubject,
    resetPomodoro,
  ]);

  useEffect(() => {
    if (!pomoRunning) {
      stopMediaSession('timer');
    }
  }, [pomoRunning]);

  // Floating Mini-Window (Document PiP + In-App Compact Overlay Fallback + Android Bubbles Bridge)
  const buildBubbleSnapshot = useCallback((): FabroBubbleSnapshot => {
    const mm = String(Math.floor(pomoSecondsLeft / 60)).padStart(2, '0');
    const ss = String(pomoSecondsLeft % 60).padStart(2, '0');
    const last = quickChatMessages[quickChatMessages.length - 1];
    return {
      fabroId: profile.fabroId,
      displayName: profile.displayName,
      privacyMode: profile.privacyMode,
      timerLabel: `${mm}:${ss}`,
      timerRunning: pomoRunning,
      unreadCount: notifications.filter((n) => !n.read).length,
      lastMessage: last ? `${last.sender}: ${last.text}` : 'Sin mensajes recientes',
    };
  }, [notifications, pomoRunning, pomoSecondsLeft, profile.displayName, profile.fabroId, profile.privacyMode, quickChatMessages]);

  const closeFloatingMiniWindow = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      try {
        pipWindowRef.current.close();
      } catch {
        // ignore
      }
    }
    pipWindowRef.current = null;
    setPipContainer(null);
    setFloatingMode('closed');
    emitAndroidBubbleEvent('bubble-close', buildBubbleSnapshot());
  }, [buildBubbleSnapshot]);

  const openFloatingMiniWindow = useCallback(async () => {
    const snapshot = buildBubbleSnapshot();
    if (isDocumentPiPSupported()) {
      try {
        const pipApi = (
          window as unknown as {
            documentPictureInPicture: {
              requestWindow: (opts: { width: number; height: number }) => Promise<Window>;
            };
          }
        ).documentPictureInPicture;

        if (pipWindowRef.current && !pipWindowRef.current.closed) {
          pipWindowRef.current.focus();
          setFloatingMode('document-pip');
          return;
        }

        const pipWin = await pipApi.requestWindow({ width: 350, height: 480 });
        pipWindowRef.current = pipWin;

        // Mirror theme & Tailwind stylesheets cleanly inside Document PiP window
        const isDark = document.documentElement.classList.contains('dark');
        const activeTheme = document.documentElement.getAttribute('data-theme') || 'estandar';
        pipWin.document.documentElement.setAttribute('data-theme', activeTheme);
        if (isDark) pipWin.document.documentElement.classList.add('dark');

        Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).forEach((node) => {
          pipWin.document.head.appendChild(node.cloneNode(true));
        });

        pipWin.document.title = '🍀 FABRO Mini-Ventana';
        pipWin.document.body.className = 'fabro-bg p-3 m-0 antialiased';

        const host = pipWin.document.createElement('div');
        host.id = 'fabro-pip-root';
        pipWin.document.body.appendChild(host);

        pipWin.addEventListener('pagehide', () => {
          pipWindowRef.current = null;
          setPipContainer(null);
          setFloatingMode('closed');
          emitAndroidBubbleEvent('bubble-close', buildBubbleSnapshot());
        });

        setPipContainer(host);
        setFloatingMode('document-pip');
        setFloatingNotice(null);
        emitAndroidBubbleEvent('bubble-open', snapshot);
        return;
      } catch {
        setFloatingNotice(
          'Tu navegador o vista integrada bloqueó la ventana externa Picture-in-Picture. Se activó la Mini-Ventana Compacta flotante dentro de FABRO.'
        );
      }
    } else {
      setFloatingNotice(
        'Document Picture-in-Picture no está disponible en este dispositivo (ej. iOS Safari o Firefox). Se activó el Modo Compacto Flotante.'
      );
    }

    setPipContainer(null);
    setFloatingMode('compact-overlay');
    emitAndroidBubbleEvent('bubble-open', snapshot);
  }, [buildBubbleSnapshot]);

  // Keep Android Bubbles snapshot & bridge listeners synchronized
  useEffect(() => {
    const snapshot = buildBubbleSnapshot();
    if (floatingMode !== 'closed') {
      emitAndroidBubbleEvent('bubble-state-sync', snapshot);
    }
    return registerAndroidBubbleBridge((actionType, detail) => {
      if (actionType === 'bubble-timer-toggle') {
        togglePomodoro();
      } else if (actionType === 'bubble-chat-send' && typeof detail?.text === 'string') {
        sendQuickChatMessage(detail.text);
      } else if (actionType === 'bubble-close') {
        closeFloatingMiniWindow();
      }
    });
  }, [buildBubbleSnapshot, closeFloatingMiniWindow, floatingMode, sendQuickChatMessage, togglePomodoro]);

  // ------------------------------------------------------------------
  // Organizador Integral Actions (Inbox, Time Blocking, Eisenhower, Revisión)
  // ------------------------------------------------------------------
  const addInboxCapture = useCallback((text: string) => {
    const clean = text.trim();
    if (!clean) return;
    const item: InboxCaptureItem = {
      id: `inb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      text: clean,
      createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      createdAtMs: Date.now(),
    };
    setInboxItems((prev) => {
      const next = [item, ...prev].slice(0, 100);
      void vaultSet('org_inbox_items', next);
      return next;
    });
  }, []);

  const dismissInboxItem = useCallback((inboxId: string) => {
    setInboxItems((prev) => {
      const next = prev.filter((item) => item.id !== inboxId);
      void vaultSet('org_inbox_items', next);
      return next;
    });
  }, []);

  const addOrganizerTask = useCallback(
    (
      title: string,
      quadrant: EisenhowerQuadrant,
      subject: string,
      taskSector: TimeBlockSector
    ) => {
      const clean = title.trim();
      if (!clean) return;
      const task: OrganizerTaskItem = {
        id: `org-task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        title: clean,
        quadrant,
        subject: subject.trim() || 'General',
        sector: taskSector,
        done: false,
        isTop3Priority: false,
        scheduledDate: getTodayDateKey(),
        createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      };
      setOrganizerTasks((prev) => {
        const next = [task, ...prev];
        void vaultSet('org_tasks', next);
        return next;
      });
    },
    []
  );

  const convertInboxToTask = useCallback(
    (
      inboxId: string,
      quadrant: EisenhowerQuadrant,
      subject: string,
      taskSector: TimeBlockSector = 'personal'
    ) => {
      const target = inboxItems.find((i) => i.id === inboxId);
      if (!target) return;
      addOrganizerTask(target.text, quadrant, subject, taskSector);
      dismissInboxItem(inboxId);
    },
    [addOrganizerTask, dismissInboxItem, inboxItems]
  );

  const addTimeBlock = useCallback(
    (payload: Omit<TimeBlockItem, 'id' | 'done' | 'dateKey'>) => {
      const cleanTitle = payload.title.trim();
      if (!cleanTitle) return;
      const block: TimeBlockItem = {
        ...payload,
        title: cleanTitle,
        id: `tb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        done: false,
        dateKey: getTodayDateKey(),
      };
      setTimeBlocks((prev) => {
        const next = [...prev, block].sort(
          (a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute)
        );
        void vaultSet('org_time_blocks', next);
        return next;
      });
    },
    []
  );

  const scheduleInboxToTimeBlock = useCallback(
    (
      inboxId: string,
      startHour: number,
      startMinute: 0 | 30,
      durationMinutes: TimeBlockDuration,
      blockSector: TimeBlockSector,
      subject = 'General'
    ) => {
      const target = inboxItems.find((i) => i.id === inboxId);
      if (!target) return;
      addTimeBlock({
        title: target.text,
        startHour,
        startMinute,
        durationMinutes,
        sector: blockSector,
        subject,
      });
      dismissInboxItem(inboxId);
    },
    [addTimeBlock, dismissInboxItem, inboxItems]
  );

  const sendInboxToStudyNote = useCallback(
    (inboxId: string, subject = 'General') => {
      const target = inboxItems.find((i) => i.id === inboxId);
      if (!target) return;
      const created = createAdvancedNote({
        title: target.text.slice(0, 72),
        subject,
        folder: 'General',
      });
      updateAdvancedNote(created.id, {
        mainIdea: target.text,
        contentHtml: `<h1>${target.text.replace(/</g, '&lt;')}</h1><p>Capturado desde Bandeja Rápida FABRO y convertido en apunte de estudio.</p>`,
        contentText: target.text,
      });
      dismissInboxItem(inboxId);
      setImportNotice(`«${created.title}» se envió a Apuntes de Estudio (${subject}).`);
    },
    [createAdvancedNote, dismissInboxItem, inboxItems, updateAdvancedNote]
  );

  const toggleTimeBlockDone = useCallback((id: string) => {
    setTimeBlocks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, done: !b.done } : b));
      void vaultSet('org_time_blocks', next);
      return next;
    });
  }, []);

  const deleteTimeBlock = useCallback((id: string) => {
    setTimeBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      void vaultSet('org_time_blocks', next);
      return next;
    });
  }, []);

  const startPomodoroForTask = useCallback(
    (taskTitleOrSubject: string) => {
      const clean = taskTitleOrSubject.trim() || 'Bloque Organizador';
      const preset = POMODORO_PRESETS.find((p) => p.id === pomoPresetIdRef.current) || POMODORO_PRESETS[0];
      const nextSec = preset.focus * 60;
      setPomoSubject(clean);
      setPomoPhase('focus');
      setPomoSecondsLeft(nextSec);
      pomoEndMsRef.current = Date.now() + nextSec * 1000;
      setPomoRunning(true);
      navigateTo('estudio', 'academico-panel');
    },
    [navigateTo]
  );

  const moveTaskQuadrant = useCallback((taskId: string, quadrant: EisenhowerQuadrant) => {
    setOrganizerTasks((prev) => {
      const next = prev.map((t) => (t.id === taskId ? { ...t, quadrant } : t));
      void vaultSet('org_tasks', next);
      return next;
    });
  }, []);

  const toggleOrganizerTask = useCallback((taskId: string) => {
    setOrganizerTasks((prev) => {
      const next = prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
      void vaultSet('org_tasks', next);
      return next;
    });
  }, []);

  const deleteOrganizerTask = useCallback((taskId: string) => {
    setOrganizerTasks((prev) => {
      const next = prev.filter((t) => t.id !== taskId);
      void vaultSet('org_tasks', next);
      return next;
    });
    setDailyReview((prev) => {
      if (!prev.top3TaskIds.includes(taskId)) return prev;
      const next: DailyReviewState = {
        ...prev,
        top3TaskIds: prev.top3TaskIds.filter((id) => id !== taskId),
      };
      void vaultSet('org_daily_review', next);
      return next;
    });
  }, []);

  const toggleTop3Priority = useCallback((taskId: string) => {
    setOrganizerTasks((prev) => {
      const target = prev.find((t) => t.id === taskId);
      if (!target) return prev;
      const currentTop3Count = prev.filter((t) => t.isTop3Priority).length;
      if (!target.isTop3Priority && currentTop3Count >= 3) {
        return prev;
      }
      const next = prev.map((t) =>
        t.id === taskId ? { ...t, isTop3Priority: !t.isTop3Priority } : t
      );
      void vaultSet('org_tasks', next);
      const nextIds = next.filter((t) => t.isTop3Priority).map((t) => t.id);
      setDailyReview((rev) => {
        const updated = { ...rev, top3TaskIds: nextIds };
        void vaultSet('org_daily_review', updated);
        return updated;
      });
      return next;
    });
  }, []);

  const updateMorningIntention = useCallback((text: string) => {
    setDailyReview((prev) => {
      const next = { ...prev, morningIntention: text };
      void vaultSet('org_daily_review', next);
      return next;
    });
  }, []);

  const saveNightReflection = useCallback((reflection: string, gratitude: string) => {
    setDailyReview((prev) => {
      const next: DailyReviewState = {
        ...prev,
        nightReflection: reflection,
        nightGratitude: gratitude,
      };
      void vaultSet('org_daily_review', next);
      return next;
    });
  }, []);

  const rolloverPendingTasksToTomorrow = useCallback((): number => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    let movedCount = 0;
    setOrganizerTasks((prev) => {
      const next = prev.map((t) => {
        if (!t.done) {
          movedCount += 1;
          return { ...t, scheduledDate: tomorrow };
        }
        return t;
      });
      void vaultSet('org_tasks', next);
      return next;
    });
    setDailyReview((prev) => {
      const next: DailyReviewState = {
        ...prev,
        rolledOverAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      };
      void vaultSet('org_daily_review', next);
      return next;
    });
    return movedCount;
  }, []);

  // ------------------------------------------------------------------
  // Firebase Auth + Hybrid Cloud Firestore Sync (Zero calls in Guest Mode)
  // ------------------------------------------------------------------
  const openAuthModal = useCallback(
    (reason?: string, defaultTab: 'login' | 'register' = 'login') => {
      setAuthModalReason(reason || null);
      setAuthModalDefaultTab(defaultTab);
      setAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setAuthModalReason(null);
  }, []);

  const mapFirebaseAuthError = useCallback((err: unknown): { message: string; code: string } => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    if (code === 'auth/operation-not-allowed') {
      return {
        code,
        message:
          'El método Correo/Contraseña aún no está habilitado en Firebase Console (Authentication > Sign-in method). Podés activarlo en 1 clic o entrar con Google ahora mismo.',
      };
    }
    if (code === 'auth/email-already-in-use') {
      return { code, message: 'Ese correo ya está registrado. Probá iniciar sesión o recuperar tu clave.' };
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return { code, message: 'Correo o contraseña incorrectos. Verificá los datos e intentá de nuevo.' };
    }
    if (code === 'auth/weak-password') {
      return { code, message: 'La contraseña debe tener al menos 6 caracteres.' };
    }
    if (code === 'auth/popup-closed-by-user') {
      return { code, message: 'Cerraste la ventana de Google antes de completar el ingreso.' };
    }
    if (code === 'auth/popup-blocked') {
      return { code, message: 'El navegador bloqueó la ventana emergente de Google. Permití popups para FABRO.' };
    }
    if (code === 'auth/requires-recent-login') {
      return {
        code,
        message: 'Por seguridad, cerrá sesión y volvé a ingresar antes de hacer este cambio sensible.',
      };
    }
    if (code === 'auth/network-request-failed') {
      return { code, message: 'Sin conexión estable a internet. Seguís trabajando 100% offline en tu dispositivo.' };
    }
    return {
      code,
      message: err instanceof Error ? err.message : 'No pudimos completar la autenticación.',
    };
  }, []);

  const buildAuthSummaryFromUser = useCallback(
    (fbUser: User, cloudDoc?: Awaited<ReturnType<typeof loadUserProfileDoc>>): AuthUserSummary => {
      const localProf = latestStateRef.current.profile;
      const fallbackHandle =
        cloudDoc?.username ||
        localProf.username ||
        normalizeHandle(fbUser.displayName || fbUser.email?.split('@')[0] || `fabro_${fbUser.uid.slice(0, 6)}`);
      const resolvedName = cloudDoc?.displayName || fbUser.displayName || localProf.displayName || 'Usuario FABRO';
      const resolvedFabroId =
        cloudDoc?.fabroId ||
        (localProf.fabroId !== 'FBR-INVITADO'
          ? localProf.fabroId
          : `FBR-${fallbackHandle.slice(0, 8).toUpperCase()}`);
      return {
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: resolvedName,
        username: fallbackHandle,
        fabroId: resolvedFabroId,
        photoURL: cloudDoc?.photoURL || fbUser.photoURL || localProf.photoURL || '',
        birthDate: cloudDoc?.birthDate || localProf.birthDate || '',
        isMinor:
          typeof cloudDoc?.isMinor === 'boolean'
            ? cloudDoc.isMinor
            : Boolean(localProf.isMinor),
        presenceStatus: cloudDoc?.presenceStatus || 'online',
        providers: fbUser.providerData.map((p) => p.providerId),
        emailVerified: fbUser.emailVerified,
      };
    },
    []
  );

  // Listen to Firebase Auth state and connect Firestore ONLY when authenticated
  useEffect(() => {
    let workspaceUnsub: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (workspaceUnsub) {
        workspaceUnsub();
        workspaceUnsub = null;
      }

      if (!fbUser) {
        setAuthUser(null);
        setAuthLoading(false);
        setSyncStatus('guest-local');
        return;
      }

      setAuthLoading(false);
      setSyncStatus(network.isOnline ? 'syncing' : 'local-offline');

      void (async () => {
        try {
          const cloudProfile = await loadUserProfileDoc(fbUser.uid).catch(() => null);
          const summary = buildAuthSummaryFromUser(fbUser, cloudProfile);
          setAuthUser(summary);

          applyingRemoteRef.current = true;
          updateProfile({
            authUid: summary.uid,
            displayName: summary.displayName,
            username: summary.username,
            fabroId: summary.fabroId,
            photoURL: summary.photoURL,
            birthDate: summary.birthDate,
            isMinor: summary.isMinor,
            fabroIdConfigured: true,
            ...(cloudProfile?.dailyPhrase ? { dailyPhrase: cloudProfile.dailyPhrase } : {}),
            ...(cloudProfile?.icebreaker ? { icebreaker: cloudProfile.icebreaker } : {}),
            ...(cloudProfile?.privacyMode ? { privacyMode: cloudProfile.privacyMode } : {}),
          });
          setTimeout(() => {
            applyingRemoteRef.current = false;
          }, 150);

          if (!cloudProfile) {
            await reserveUsernameAndSaveProfile(fbUser.uid, {
              displayName: summary.displayName,
              username: summary.username,
              fabroId: summary.fabroId,
              photoURL: summary.photoURL,
              birthDate: summary.birthDate,
              isMinor: summary.isMinor,
              presenceStatus: summary.presenceStatus,
              dailyPhrase: latestStateRef.current.profile.dailyPhrase,
              icebreaker: latestStateRef.current.profile.icebreaker || '',
              privacyMode: latestStateRef.current.profile.privacyMode,
              shareTastesPublicly: latestStateRef.current.profile.shareTastesPublicly,
              tastes: latestStateRef.current.profile.tastes,
            }).catch(() => undefined);
          }

          // Migrate Guest IndexedDB/LocalStorage work once without overwriting existing cloud data
          const snap = latestStateRef.current;
          const migrated = await migrateGuestVaultToCloud(fbUser.uid, {
            notes: snap.advancedNotes,
            organizer: {
              inboxItems: snap.inboxItems,
              organizerTasks: snap.organizerTasks,
              timeBlocks: snap.timeBlocks,
              dailyReview: snap.dailyReview,
            },
            wellness: {
              moodLogs: snap.moodLogs,
              guidedReflections: snap.guidedReflections,
              balancedPlanner: snap.balancedPlanner,
              glossaryTerms: snap.glossaryTerms,
            },
          }).catch(() => false);

          if (migrated) {
            setImportNotice('Tus apuntes, organizador y reflexiones de invitado se sincronizaron con tu FABRO ID.');
          }

          setLastCloudSyncAt(
            new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
          );
          setSyncStatus(network.isOnline ? 'cloud-synced' : 'local-offline');

          // Attach real-time Firestore listeners for multi-device continuity
          workspaceUnsub = subscribeToUserCloudWorkspace(fbUser.uid, {
            onProfile: (remoteProf) => {
              applyingRemoteRef.current = true;
              setAuthUser((prev) =>
                prev
                  ? {
                      ...prev,
                      displayName: remoteProf.displayName || prev.displayName,
                      username: remoteProf.username || prev.username,
                      fabroId: remoteProf.fabroId || prev.fabroId,
                      photoURL: remoteProf.photoURL ?? prev.photoURL,
                      presenceStatus: remoteProf.presenceStatus || prev.presenceStatus,
                    }
                  : prev
              );
              updateProfile({
                displayName: remoteProf.displayName,
                username: remoteProf.username,
                fabroId: remoteProf.fabroId,
                photoURL: remoteProf.photoURL,
                dailyPhrase: remoteProf.dailyPhrase,
                icebreaker: remoteProf.icebreaker,
                privacyMode: remoteProf.privacyMode,
                fabroIdConfigured: true,
              });
              setTimeout(() => {
                applyingRemoteRef.current = false;
              }, 120);
            },
            onNotes: (remoteNotes) => {
              applyingRemoteRef.current = true;
              setAdvancedNotes((prev) => {
                const mergedMap = new Map<string, AdvancedNoteItem>();
                prev.forEach((n) => mergedMap.set(n.id, n));
                remoteNotes.forEach((rn) => {
                  const local = mergedMap.get(rn.id);
                  mergedMap.set(rn.id, {
                    ...rn,
                    audioClips: local?.audioClips || [],
                  });
                });
                const next = Array.from(mergedMap.values());
                void vaultSet('advanced_notes', next);
                return next;
              });
              setTimeout(() => {
                applyingRemoteRef.current = false;
              }, 120);
            },
            onOrganizer: (remoteOrg) => {
              applyingRemoteRef.current = true;
              if (remoteOrg.inboxItems.length > 0) {
                setInboxItems(remoteOrg.inboxItems);
                void vaultSet('org_inbox_items', remoteOrg.inboxItems);
              }
              if (remoteOrg.organizerTasks.length > 0) {
                setOrganizerTasks(remoteOrg.organizerTasks);
                void vaultSet('org_tasks', remoteOrg.organizerTasks);
              }
              if (remoteOrg.timeBlocks.length > 0) {
                setTimeBlocks(remoteOrg.timeBlocks);
                void vaultSet('org_time_blocks', remoteOrg.timeBlocks);
              }
              if (remoteOrg.dailyReview) {
                setDailyReview(remoteOrg.dailyReview);
                void vaultSet('org_daily_review', remoteOrg.dailyReview);
              }
              setLastCloudSyncAt(
                new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
              );
              setTimeout(() => {
                applyingRemoteRef.current = false;
              }, 120);
            },
            onError: () => {
              setSyncStatus(navigator.onLine ? 'sync-error' : 'local-offline');
            },
          });
        } catch {
          setSyncStatus(navigator.onLine ? 'sync-error' : 'local-offline');
        }
      })();
    });

    return () => {
      if (workspaceUnsub) workspaceUnsub();
      unsubAuth();
    };
  }, [buildAuthSummaryFromUser, network.isOnline, updateProfile]);

  // Reflect offline/online transitions cleanly for authenticated sync badge
  useEffect(() => {
    if (!authUser) {
      setSyncStatus('guest-local');
    } else if (!network.isOnline) {
      setSyncStatus('local-offline');
    } else if (syncStatus === 'local-offline') {
      setSyncStatus('cloud-synced');
    }
  }, [authUser, network.isOnline, syncStatus]);

  // Debounced outbound cloud sync ONLY when authenticated (and never syncs byokKeys)
  useEffect(() => {
    if (!authUser || applyingRemoteRef.current) return;
    if (pendingCloudSyncTimerRef.current !== null) {
      window.clearTimeout(pendingCloudSyncTimerRef.current);
    }
    pendingCloudSyncTimerRef.current = window.setTimeout(() => {
      if (!auth.currentUser) return;
      if (!navigator.onLine) {
        setSyncStatus('local-offline');
        return;
      }
      setSyncStatus('syncing');
      const snap = latestStateRef.current;
      void Promise.all([
        syncOrganizerStateToCloud(authUser.uid, {
          inboxItems: snap.inboxItems,
          organizerTasks: snap.organizerTasks,
          timeBlocks: snap.timeBlocks,
          dailyReview: snap.dailyReview,
        }),
        syncWellnessStateToCloud(authUser.uid, {
          moodLogs: snap.moodLogs,
          guidedReflections: snap.guidedReflections,
          balancedPlanner: snap.balancedPlanner,
          glossaryTerms: snap.glossaryTerms,
        }),
        ...snap.advancedNotes.slice(0, 20).map((n) => syncSingleNoteToCloud(authUser.uid, n)),
      ])
        .then(() => {
          setSyncStatus('cloud-synced');
          setLastCloudSyncAt(
            new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
          );
        })
        .catch(() => {
          setSyncStatus(navigator.onLine ? 'sync-error' : 'local-offline');
        });
    }, 1500);

    return () => {
      if (pendingCloudSyncTimerRef.current !== null) {
        window.clearTimeout(pendingCloudSyncTimerRef.current);
      }
    };
  }, [
    authUser,
    inboxItems,
    organizerTasks,
    timeBlocks,
    dailyReview,
    advancedNotes,
    moodLogs,
    guidedReflections,
    balancedPlanner,
    glossaryTerms,
  ]);

  const syncNowToCloud = useCallback(async () => {
    if (!authUser) {
      openAuthModal('activar la sincronización en la nube', 'register');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('local-offline');
      return;
    }
    setSyncStatus('syncing');
    try {
      const snap = latestStateRef.current;
      await Promise.all([
        syncOrganizerStateToCloud(authUser.uid, {
          inboxItems: snap.inboxItems,
          organizerTasks: snap.organizerTasks,
          timeBlocks: snap.timeBlocks,
          dailyReview: snap.dailyReview,
        }),
        syncWellnessStateToCloud(authUser.uid, {
          moodLogs: snap.moodLogs,
          guidedReflections: snap.guidedReflections,
          balancedPlanner: snap.balancedPlanner,
          glossaryTerms: snap.glossaryTerms,
        }),
        ...snap.advancedNotes.slice(0, 25).map((n) => syncSingleNoteToCloud(authUser.uid, n)),
      ]);
      setSyncStatus('cloud-synced');
      setLastCloudSyncAt(
        new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      setSyncStatus('sync-error');
    }
  }, [authUser, openAuthModal]);

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      closeAuthModal();
      return { ok: true };
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      return { ok: false, error: mapped.message, code: mapped.code };
    }
  }, [closeAuthModal, mapFirebaseAuthError]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        closeAuthModal();
        return { ok: true };
      } catch (err) {
        const mapped = mapFirebaseAuthError(err);
        return { ok: false, error: mapped.message, code: mapped.code };
      }
    },
    [closeAuthModal, mapFirebaseAuthError]
  );

  const signUpWithEmail = useCallback(
    async ({
      displayName,
      username,
      email,
      password,
      birthDate,
    }: {
      displayName: string;
      username: string;
      email: string;
      password: string;
      birthDate: string;
    }) => {
      const cleanName = displayName.trim();
      const cleanHandle = normalizeHandle(username);
      if (cleanHandle.length < 3) {
        return { ok: false, error: 'Elegí un @usuario FABRO ID de al menos 3 caracteres.' };
      }
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateFirebaseProfile(cred.user, { displayName: cleanName });
        const isMinor = computeIsMinorFromBirthDate(birthDate);
        const fabroId = `FBR-${cleanHandle.slice(0, 10).toUpperCase()}`;
        await reserveUsernameAndSaveProfile(cred.user.uid, {
          displayName: cleanName,
          username: cleanHandle,
          fabroId,
          photoURL: '',
          birthDate,
          isMinor,
          presenceStatus: 'online',
          dailyPhrase: latestStateRef.current.profile.dailyPhrase,
          icebreaker: latestStateRef.current.profile.icebreaker || '',
          privacyMode: isMinor ? 'grupo' : latestStateRef.current.profile.privacyMode,
          shareTastesPublicly: !isMinor && latestStateRef.current.profile.shareTastesPublicly,
          tastes: latestStateRef.current.profile.tastes,
        });
        closeAuthModal();
        return { ok: true };
      } catch (err) {
        const mapped = mapFirebaseAuthError(err);
        return { ok: false, error: mapped.message, code: mapped.code };
      }
    },
    [closeAuthModal, mapFirebaseAuthError]
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      try {
        await sendPasswordResetEmail(auth, email.trim());
        return { ok: true };
      } catch (err) {
        const mapped = mapFirebaseAuthError(err);
        return { ok: false, error: mapped.message };
      }
    },
    [mapFirebaseAuthError]
  );

  const signOutAccount = useCallback(async () => {
    await signOut(auth);
    setAuthUser(null);
    setSyncStatus('guest-local');
    updateProfile({
      authUid: undefined,
    });
  }, [updateProfile]);

  const updateAccountAliasAndPhoto = useCallback(
    async (patch: { displayName?: string; username?: string; photoURL?: string }) => {
      if (!auth.currentUser || !authUser) {
        return { ok: false, error: 'Iniciá sesión para guardar cambios en tu FABRO ID.' };
      }
      const nextName = (patch.displayName ?? authUser.displayName).trim() || authUser.displayName;
      const nextHandle = patch.username ? normalizeHandle(patch.username) : authUser.username;
      const nextPhoto = patch.photoURL ?? authUser.photoURL;
      const nextFabroId = `FBR-${nextHandle.slice(0, 10).toUpperCase()}`;
      try {
        if (patch.displayName) {
          await updateFirebaseProfile(auth.currentUser, { displayName: nextName });
        }
        await reserveUsernameAndSaveProfile(authUser.uid, {
          previousHandle: authUser.username,
          displayName: nextName,
          username: nextHandle,
          fabroId: nextFabroId,
          photoURL: nextPhoto,
          birthDate: authUser.birthDate,
          isMinor: authUser.isMinor,
          presenceStatus: authUser.presenceStatus,
          dailyPhrase: profile.dailyPhrase,
          icebreaker: profile.icebreaker || '',
          privacyMode: profile.privacyMode,
          shareTastesPublicly: profile.shareTastesPublicly,
          tastes: profile.tastes,
        });
        setAuthUser((prev) =>
          prev
            ? { ...prev, displayName: nextName, username: nextHandle, fabroId: nextFabroId, photoURL: nextPhoto }
            : prev
        );
        updateProfile({
          displayName: nextName,
          username: nextHandle,
          fabroId: nextFabroId,
          photoURL: nextPhoto,
          fabroIdConfigured: true,
        });
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'No pudimos actualizar tu perfil en la nube.',
        };
      }
    },
    [authUser, profile, updateProfile]
  );

  const changeAccountPassword = useCallback(
    async (newPassword: string) => {
      if (!auth.currentUser) {
        return { ok: false, error: 'Debés estar autenticado para cambiar tu contraseña.' };
      }
      try {
        await updatePassword(auth.currentUser, newPassword);
        return { ok: true };
      } catch (err) {
        const mapped = mapFirebaseAuthError(err);
        return { ok: false, error: mapped.message };
      }
    },
    [mapFirebaseAuthError]
  );

  const linkGoogleProvider = useCallback(async () => {
    if (!auth.currentUser) {
      return { ok: false, error: 'Iniciá sesión primero para vincular Google.' };
    }
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      setAuthUser((prev) =>
        prev ? { ...prev, providers: result.user.providerData.map((p) => p.providerId) } : prev
      );
      return { ok: true };
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      return { ok: false, error: mapped.message };
    }
  }, [mapFirebaseAuthError]);

  const deleteAccountSafely = useCallback(async () => {
    if (!auth.currentUser || !authUser) {
      return { ok: false, error: 'No hay cuenta activa para eliminar.' };
    }
    try {
      await deleteUserCloudAccountData(authUser.uid, authUser.username);
      await deleteUser(auth.currentUser);
      setAuthUser(null);
      setSyncStatus('guest-local');
      updateProfile({
        authUid: undefined,
        displayName: 'Invitado FABRO',
        fabroId: 'FBR-INVITADO',
        username: undefined,
        photoURL: undefined,
        fabroIdConfigured: false,
      });
      return { ok: true };
    } catch (err) {
      const mapped = mapFirebaseAuthError(err);
      return { ok: false, error: mapped.message };
    }
  }, [authUser, mapFirebaseAuthError, updateProfile]);

  const updatePresenceStatus = useCallback(
    async (status: AuthPresenceStatus) => {
      if (!authUser) return;
      setAuthUser((prev) => (prev ? { ...prev, presenceStatus: status } : prev));
      const nextPrivacy: LocalUserProfile['privacyMode'] =
        status === 'invisible' ? 'invisible' : status === 'focus' ? 'grupo' : 'todos';
      updateProfile({ privacyMode: nextPrivacy });
      await reserveUsernameAndSaveProfile(authUser.uid, {
        displayName: authUser.displayName,
        username: authUser.username,
        fabroId: authUser.fabroId,
        photoURL: authUser.photoURL,
        birthDate: authUser.birthDate,
        isMinor: authUser.isMinor,
        presenceStatus: status,
        dailyPhrase: profile.dailyPhrase,
        icebreaker: profile.icebreaker || '',
        privacyMode: nextPrivacy,
        shareTastesPublicly: profile.shareTastesPublicly,
        tastes: profile.tastes,
      }).catch(() => undefined);
    },
    [authUser, profile, updateProfile]
  );

  // Sync deleteAdvancedNote with Firestore if signed in
  useEffect(() => {
    // Kept lightweight: deletions are handled cleanly
  }, []);

  const deleteAdvancedNoteWithCloud = useCallback(
    (id: string) => {
      deleteAdvancedNote(id);
      if (authUser && navigator.onLine) {
        void deleteSingleNoteFromCloud(authUser.uid, id).catch(() => undefined);
      }
    },
    [authUser, deleteAdvancedNote]
  );

  const resetLocalVault = useCallback(async () => {
    await vaultClearAll();
    setThemeState('estandar');
    setProfile(DEFAULT_LOCAL_PROFILE);
    setFavorites(DEFAULT_FAVORITES);
    setPinnedTools(DEFAULT_PINNED_TOOLS);
    setWorkspaceColumnsState(3);
    setUserQuotes(DEFAULT_USER_QUOTES);
    setSelectedZodiacState(DEFAULT_ZODIAC_SIGN);
    setRecents([]);
    setNotifications(DEFAULT_NOTIFICATIONS);
    setByokKeys([]);
    setConnectItems(DEFAULT_CONNECT_ITEMS);
    setQuickChatMessages(DEFAULT_CHAT_MESSAGES);
    setActiveChatThreadId('general');
    setFriendsList(DEFAULT_FRIENDS_LIST);
    setFriendRequests(DEFAULT_FRIEND_REQUESTS);
    setQuickNotes(DEFAULT_QUICK_NOTES);
    setMoodLogs([]);
    setAgendaTasks(DEFAULT_AGENDA_TASKS);
    setPomodoroLogs(DEFAULT_POMODORO_LOGS);
    setIdeasVault(DEFAULT_IDEAS_VAULT);
    setStudyQuiz(DEFAULT_STUDY_QUIZ);
    setGuidedReflections(DEFAULT_GUIDED_REFLECTIONS);
    setBalancedPlanner(DEFAULT_BALANCED_PLANNER);
    setAdvancedNotes(DEFAULT_ADVANCED_NOTES);
    setGlossaryTerms(DEFAULT_GLOSSARY_TERMS);
    setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
    setScheduledReminders(DEFAULT_SCHEDULED_REMINDERS);
    setInboxItems(DEFAULT_INBOX_ITEMS);
    setOrganizerTasks(DEFAULT_ORGANIZER_TASKS);
    setTimeBlocks(DEFAULT_TIME_BLOCKS);
    setDailyReview(DEFAULT_DAILY_REVIEW);
    setExamplesCleared(false);
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  return (
    <EcosystemContext.Provider
      value={{
        theme,
        setTheme,
        sector,
        submenu,
        navigateTo,
        swipeNextScreen,
        swipePrevScreen,
        isScreenTransitioning,
        screenTransitionTick,
        goBack,
        canGoBack: sector !== 'social' || submenu !== 'fabro-id' || history.length > 0,
        profile,
        updateProfile,
        favorites,
        toggleFavorite,
        pinnedTools,
        workspaceColumns,
        setWorkspaceColumns,
        isToolPinned,
        togglePinTool,
        movePinnedTool,
        setPinnedToolSize,
        applyWorkspacePreset,
        resetPinnedTools,
        userQuotes,
        addUserQuote,
        likeUserQuote,
        deleteUserQuote,
        selectedZodiac,
        setSelectedZodiac,
        floatingChatOpen,
        setFloatingChatOpen,
        recents,
        notifications,
        unreadNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        byokKeys,
        saveByokKey,
        removeByokKey,
        connectItems,
        saveConnectItems,
        network,
        measureNetwork,
        rightPanelOpen,
        setRightPanelOpen,
        quickChatMessages,
        activeChatThreadId,
        setActiveChatThreadId,
        openDirectChatWithFriend,
        flushQueuedMessages,
        sendQuickChatMessage,
        toggleChatStar,
        reactToChatMessage,
        friendsList,
        friendRequests,
        addFriendDirectly,
        sendFriendRequest,
        respondFriendRequest,
        removeFriend,
        toggleFriendAvailability,
        toggleFriendTrustedGroup,
        activeQuickAction,
        setActiveQuickAction,
        quickNotes,
        addQuickNote,
        moodLogs,
        addMoodLog,
        agendaTasks,
        addAgendaTask,
        toggleAgendaTask,
        pomodoroLogs,
        addPomodoroLog,
        ideasVault,
        addIdeaVaultItem,
        toggleIdeaVote,
        updateIdeaStatus,
        sharedViewerPayload,
        openSharedPreview,
        closeSharedViewer,
        importSharedResourceToVault,
        importNotice,
        dismissImportNotice: () => setImportNotice(null),
        studyQuiz,
        addQuizQuestion,
        guidedReflections,
        updateGuidedReflection,
        balancedPlanner,
        toggleBalancedPlanner,
        examplesCleared,
        clearSeedExamples,
        resetLocalVault,
        advancedNotes,
        glossaryTerms,
        notesSaveState,
        lastNotesSavedAt,
        createAdvancedNote,
        updateAdvancedNote,
        deleteAdvancedNote: deleteAdvancedNoteWithCloud,
        addGlossaryTerm,
        deleteGlossaryTerm,
        notificationPrefs,
        updateNotificationPrefs,
        notificationPermission,
        refreshNotificationPermission,
        requestNotificationPermission,
        triggerTestNotification,
        scheduledReminders,
        addScheduledReminder,
        deleteScheduledReminder,
        notifyRoutineCompleted,
        simulateIncomingChatNotification,
        pomoPresetId,
        pomoPhase,
        pomoSubject,
        pomoSecondsLeft,
        pomoRunning,
        selectPomodoroPreset,
        setPomodoroSubject: setPomoSubject,
        togglePomodoro,
        resetPomodoro,
        completePomodoroManual,
        floatingMode,
        floatingNotice,
        pipContainer,
        openFloatingMiniWindow,
        closeFloatingMiniWindow,
        dismissFloatingNotice: () => setFloatingNotice(null),
        inboxItems,
        organizerTasks,
        timeBlocks,
        dailyReview,
        quickCaptureOpen,
        setQuickCaptureOpen,
        organizerActiveTab,
        setOrganizerActiveTab,
        addInboxCapture,
        convertInboxToTask,
        scheduleInboxToTimeBlock,
        sendInboxToStudyNote,
        dismissInboxItem,
        addTimeBlock,
        toggleTimeBlockDone,
        deleteTimeBlock,
        startPomodoroForTask,
        addOrganizerTask,
        moveTaskQuadrant,
        toggleOrganizerTask,
        deleteOrganizerTask,
        toggleTop3Priority,
        updateMorningIntention,
        saveNightReflection,
        rolloverPendingTasksToTomorrow,
        authUser,
        authLoading,
        syncStatus,
        lastCloudSyncAt,
        authModalOpen,
        authModalReason,
        authModalDefaultTab,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        signOutAccount,
        updateAccountAliasAndPhoto,
        changeAccountPassword,
        linkGoogleProvider,
        deleteAccountSafely,
        updatePresenceStatus,
        syncNowToCloud,
      }}
    >
      {children}
    </EcosystemContext.Provider>
  );
};

export function useEcosystem() {
  const ctx = useContext(EcosystemContext);
  if (!ctx) {
    throw new Error('useEcosystem debe usarse dentro de EcosystemProvider');
  }
  return ctx;
}
