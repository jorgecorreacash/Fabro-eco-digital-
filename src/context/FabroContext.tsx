import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { authFetch } from '../lib/apiClient';
import { normalizeCustomFabroId } from '../lib/fabroId';
import {
  auth,
  db,
  handleFirestoreError,
  localDeleteObject as deleteObject,
  localGetDownloadURL as getDownloadURL,
  localStorageRef as storageRef,
  localUploadBytes as uploadBytes,
  OperationType,
  storage,
} from '../lib/firebase';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  cacheOfflineNotes,
  cacheSnapshotCollection,
  clearPendingNoteWrite,
  deleteCachedNote,
  deleteLocalFileBlob,
  enqueuePendingNoteWrite,
  getCachedCollection,
  getCachedOfflineNotes,
  getPendingNoteWrites,
  getRecentAccessIds,
  recordRecentAccess,
  saveLocalFileBlob,
  upsertCachedNote,
} from '../lib/offlineStore';
import {
  readOfflinePrecacheSnapshot,
  runFullStudyPrecache,
  type PrecacheStatusState,
} from '../lib/offlinePrecache';
import type {
  AIChatThread,
  Book,
  BookChapter,
  CalendarEvent,
  DictionaryEntry,
  DocumentCoverageMetadata,
  EducationLevel,
  Exam,
  FlashcardDeck,
  FlashcardItem,
  HubHistoryItem,
  HubTool,
  HubUserState,
  LibraryDoc,
  NavSectionId,
  Note,
  StudentProfile,
  StudySession,
  Subject,
  SubjectAcademicMemory,
  ThemeTemplateId,
} from '../types/fabro';

interface FabroContextValue {
  user: User | null;
  authReady: boolean;
  profile: StudentProfile | null;
  dataLoading: boolean;
  activeSection: NavSectionId;
  setActiveSection: (section: NavSectionId) => void;
  selectedSubjectId: string | null;
  setSelectedSubjectId: (id: string | null) => void;
  aiDraftPrompt: string;
  setAiDraftPrompt: (prompt: string) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
  colorTemplate: ThemeTemplateId;
  setColorTemplate: (template: ThemeTemplateId) => void;
  refreshUserVerification: () => Promise<void>;
  logout: () => Promise<void>;
  actionError: string | null;
  clearActionError: () => void;
  // Collections
  subjects: Subject[];
  notes: Note[];
  libraryDocs: LibraryDoc[];
  exams: Exam[];
  calendarEvents: CalendarEvent[];
  decks: FlashcardDeck[];
  studySessions: StudySession[];
  aiChats: AIChatThread[];
  // Profile
  updateStudentProfile: (patch: {
    displayName: string;
    educationLevel?: EducationLevel;
    institution?: string;
    career?: string;
    weeklyGoalHours?: number;
    themePreference?: 'dark' | 'light' | 'system';
    username?: string;
    customFabroId?: string;
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
    instructorCategory?: StudentProfile['instructorCategory'];
    specialty?: string;
    experienceSummary?: string;
    presenceMode?: StudentProfile['presenceMode'];
    followedInstructorIds?: string[];
    blockedUserIds?: string[];
    searchableInDirectory?: boolean;
  }) => Promise<void>;
  uploadProfilePhoto: (file: File, target: 'avatar' | 'gallery') => Promise<string>;
  removeGalleryPhoto: (photoUrl: string) => Promise<void>;
  // Subjects
  createSubject: (data: Omit<Subject, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateSubject: (id: string, patch: Partial<Subject>) => Promise<void>;
  uploadSubjectSyllabusFile: (
    subjectId: string,
    file: File
  ) => Promise<{
    syllabusFileName: string;
    syllabusFileMime: string;
    syllabusFileUrl: string;
    syllabusExtractedText: string;
  }>;
  deleteSubject: (id: string) => Promise<void>;
  // Notes
  createNote: (data: Omit<Note, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  // Library
  uploadLibraryDocument: (params: {
    file?: File;
    title: string;
    category: LibraryDoc['category'];
    subjectId: string;
    tags: string[];
    aiAuthorized: boolean;
    extractedText: string;
    coverage?: DocumentCoverageMetadata;
  }) => Promise<string>;
  updateLibraryDoc: (id: string, patch: Partial<LibraryDoc>) => Promise<void>;
  deleteLibraryDoc: (docItem: LibraryDoc) => Promise<void>;
  // Exams
  createExam: (data: Omit<Exam, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateExamProgress: (id: string, questions: Exam['questions']) => Promise<void>;
  completeExam: (
    id: string,
    result: {
      scorePercent: number;
      questions: Exam['questions'];
      weakTopics: string[];
      aiFeedback: string;
    }
  ) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  // Calendar
  createCalendarEvent: (data: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateCalendarEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  // Flashcards
  createDeck: (data: { subjectId: string; title: string; description: string }) => Promise<string>;
  deleteDeck: (deckId: string) => Promise<void>;
  createCard: (
    deckId: string,
    data: Omit<FlashcardItem, 'id' | 'userId' | 'deckId' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  updateCardReview: (
    deckId: string,
    cardId: string,
    patch: Pick<FlashcardItem, 'easeFactor' | 'intervalDays' | 'repetitions' | 'nextReviewDate' | 'lastResult'>
  ) => Promise<void>;
  deleteCard: (deckId: string, cardId: string, currentCount: number) => Promise<void>;
  // Study Sessions
  logStudySession: (data: Omit<StudySession, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  // AI Chat Threads
  saveAIChatThread: (
    id: string | null,
    data: Omit<AIChatThread, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  deleteAIChatThread: (id: string) => Promise<void>;
  // Books & Chapters
  books: Book[];
  createBook: (
    data: Omit<Book, 'id' | 'userId' | 'chaptersCount' | 'totalWords' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  updateBook: (id: string, patch: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  subscribeBookChapters: (bookId: string, onChange: (chapters: BookChapter[]) => void) => () => void;
  createBookChapter: (
    bookId: string,
    data: Omit<BookChapter, 'id' | 'userId' | 'bookId' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  updateBookChapter: (bookId: string, chapterId: string, patch: Partial<BookChapter>) => Promise<void>;
  reorderBookChapters: (bookId: string, orderedChapterIds: string[]) => Promise<void>;
  deleteBookChapter: (bookId: string, chapterId: string) => Promise<void>;
  syncBookMetrics: (bookId: string, chaptersCount: number, totalWords: number) => Promise<void>;
  // Dictionary Memory
  dictionaryEntries: DictionaryEntry[];
  saveDictionaryEntry: (
    data: Omit<DictionaryEntry, 'id' | 'userId' | 'normalizedTerm' | 'lookupCount' | 'createdAt' | 'updatedAt'>
  ) => Promise<string>;
  updateDictionaryEntry: (id: string, patch: Partial<DictionaryEntry>) => Promise<void>;
  deleteDictionaryEntry: (id: string) => Promise<void>;
  // FABRO HUB State
  hubState: HubUserState;
  toggleHubFavorite: (toolId: string) => Promise<void>;
  logHubHistory: (entry: Omit<HubHistoryItem, 'id' | 'visitedAt'>) => Promise<void>;
  clearHubHistory: () => Promise<void>;
  upsertCustomHubTool: (tool: HubTool) => Promise<void>;
  deleteCustomHubTool: (toolId: string) => Promise<void>;
  toggleHubToolActive: (toolId: string, active: boolean) => Promise<void>;
  // FABRO IA 2.0 Subject Academic Memory
  subjectMemories: SubjectAcademicMemory[];
  getMemoryForSubject: (subjectId: string) => SubjectAcademicMemory | null;
  upsertSubjectMemory: (
    subjectId: string,
    update: {
      developedTopic?: string;
      summarySnippet?: string;
      authorsAndTheories?: string[];
      verifiedBibliography?: string[];
      examQuestions?: string[];
      studentProgressNotes?: string;
    }
  ) => Promise<void>;
  // Offline & Precaching
  isOnline: boolean;
  recentNoteIds: string[];
  recentDocIds: string[];
  precacheState: PrecacheStatusState;
  markNoteAccessed: (noteId: string) => void;
  markLibraryDocAccessed: (docId: string) => void;
  precacheStudyDataNow: (forceRefresh?: boolean) => Promise<void>;
  syncPendingOfflineChanges: () => Promise<void>;
}

const FabroContext = createContext<FabroContextValue | null>(null);

function makeSafeId(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.slice(0, 120);
}

export const FabroProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const [activeSection, setActiveSection] = useState<NavSectionId>('inicio');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [aiDraftPrompt, setAiDraftPrompt] = useState('');

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fabro-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'dark';
  });
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const [colorTemplate, setColorTemplateState] = useState<ThemeTemplateId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fabro-color-template');
      if (
        saved === 'estandar' ||
        saved === 'ecologico' ||
        saved === 'gotico' ||
        saved === 'aura' ||
        saved === 'floral' ||
        saved === 'metal' ||
        saved === 'oro'
      ) {
        return saved;
      }
    }
    return 'estandar';
  });

  const [actionError, setActionError] = useState<string | null>(null);
  const [, setUserTick] = useState(0);

  const clearActionError = useCallback(() => setActionError(null), []);

  const surfaceFirestoreError = useCallback(
    (err: unknown, op: OperationType, path: string | null, friendlyMessage: string): never => {
      setActionError(friendlyMessage);
      return handleFirestoreError(err, op, path);
    },
    []
  );

  const isOnline = useOnlineStatus();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [libraryDocs, setLibraryDocs] = useState<LibraryDoc[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [aiChats, setAiChats] = useState<AIChatThread[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [dictionaryEntries, setDictionaryEntries] = useState<DictionaryEntry[]>([]);
  const [subjectMemories, setSubjectMemories] = useState<SubjectAcademicMemory[]>([]);
  const subjectMemoriesRef = useRef<SubjectAcademicMemory[]>([]);
  subjectMemoriesRef.current = subjectMemories;
  const [hubState, setHubState] = useState<HubUserState>({
    userId: '',
    favorites: [],
    history: [],
    customTools: [],
    disabledToolIds: [],
  });
  const hubStateRef = useRef<HubUserState>(hubState);
  hubStateRef.current = hubState;
  const [recentNoteIds, setRecentNoteIds] = useState<string[]>([]);
  const [recentDocIds, setRecentDocIds] = useState<string[]>([]);
  const [precacheState, setPrecacheState] = useState<PrecacheStatusState>({
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
    cachedNotesCount: 0,
    recentNotesCount: 0,
    cachedLibraryDocsCount: 0,
    cachedFilesCount: 0,
    cachedAssetsCount: 0,
    pendingSyncCount: 0,
    lastPrecachedAt: null,
  });

  const recentNoteIdsRef = useRef<string[]>([]);
  recentNoteIdsRef.current = recentNoteIds;
  const recentDocIdsRef = useRef<string[]>([]);
  recentDocIdsRef.current = recentDocIds;
  const notesRef = useRef<Note[]>([]);
  notesRef.current = notes;
  const libraryDocsRef = useRef<LibraryDoc[]>([]);
  libraryDocsRef.current = libraryDocs;
  const subjectsRef = useRef<Subject[]>([]);
  subjectsRef.current = subjects;

  // Apply Tailwind v4 `.dark` class and template attribute cleanly to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('fabro-theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-template', colorTemplate);
    localStorage.setItem('fabro-color-template', colorTemplate);
    if (user?.uid) {
      localStorage.setItem(`fabro-color-template-${user.uid}`, colorTemplate);
    }
  }, [colorTemplate, user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const userSaved = localStorage.getItem(`fabro-color-template-${user.uid}`);
    if (
      userSaved === 'estandar' ||
      userSaved === 'ecologico' ||
      userSaved === 'gotico' ||
      userSaved === 'aura' ||
      userSaved === 'floral' ||
      userSaved === 'metal' ||
      userSaved === 'oro'
    ) {
      setColorTemplateState(userSaved);
    }
  }, [user?.uid]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setThemeMode = useCallback((mode: 'dark' | 'light') => {
    setTheme(mode);
  }, []);

  const setColorTemplate = useCallback((tpl: ThemeTemplateId) => {
    setColorTemplateState(tpl);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfile(null);
        setSubjects([]);
        setNotes([]);
        setLibraryDocs([]);
        setExams([]);
        setCalendarEvents([]);
        setDecks([]);
        setStudySessions([]);
        setAiChats([]);
        setBooks([]);
        setDictionaryEntries([]);
        setSubjectMemories([]);
        setHubState({
          userId: '',
          favorites: [],
          history: [],
          customTools: [],
          disabledToolIds: [],
        });
      }
    });
    return () => unsub();
  }, []);

  const refreshUserVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
    setUserTick((t) => t + 1);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setActiveSection('inicio');
  }, []);

  // Bootstrap or subscribe to profile + collections when user is authenticated & verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    let cancelled = false;
    setDataLoading(true);

    const userDocRef = doc(db, 'users', user.uid);

    const ensureProfile = async () => {
      try {
        const snap = await getDoc(userDocRef);
        if (!snap.exists() && !cancelled) {
          const initialProfile: StudentProfile = {
            uid: user.uid,
            displayName: (user.displayName || user.email?.split('@')[0] || 'Usuario FABRO').slice(0, 100),
            email: (user.email || 'usuario@fabro.app').slice(0, 200),
            customFabroId: '',
            photoURL: (user.photoURL || '').slice(0, 135000),
            galleryPhotos: [],
            sharedPhrase: '',
            favoriteBooks: '',
            favoriteMovies: '',
            favoriteMusic: '',
            educationLevel: 'universitario',
            institution: '',
            career: '',
            weeklyGoalHours: 15,
            themePreference: themeRef.current,
            storageUsedBytes: 0,
            planTier: 'free',
          };
          await setDoc(userDocRef, {
            ...initialProfile,
            isStudent: false,
            isInstructor: false,
            verificationStatus: 'no_solicitado',
            accountStatus: 'activo',
            reputationPoints: 0,
            isMinor: false,
            presenceMode: 'online',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'publicProfiles', user.uid), {
            uid: user.uid,
            displayName: initialProfile.displayName,
            username: '',
            customFabroId: '',
            photoURL: initialProfile.photoURL || '',
            galleryPhotos: [],
            sharedPhrase: '',
            favoriteBooks: '',
            favoriteMovies: '',
            favoriteMusic: '',
            country: '',
            province: '',
            city: '',
            bio: '',
            interests: [],
            institutions: [],
            isStudent: false,
            isInstructor: false,
            instructorCategory: 'instructor_independiente',
            verificationStatus: 'no_solicitado',
            specialty: '',
            experienceSummary: '',
            isMinor: false,
            searchableInDirectory: true,
            presenceStatus: 'online',
            reputationPoints: 0,
            followersCount: 0,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        surfaceFirestoreError(err, OperationType.WRITE, `users/${user.uid}`, 'No se pudo inicializar tu perfil FABRO.');
      }
    };

    void ensureProfile();

    // Immediately hydrate from IndexedDB vault (covers both offline launch and flaky/slow networks)
    void Promise.all([
      getCachedCollection('subjects'),
      getCachedOfflineNotes(),
      getCachedCollection('calendarEvents'),
      getCachedCollection('libraryDocs'),
      getCachedCollection('dictionaryEntries'),
      getRecentAccessIds('note', 35),
      getRecentAccessIds('doc', 35),
    ]).then(async ([cachedSubs, cachedNotes, cachedEvents, cachedDocs, cachedDict, rNotes, rDocs]) => {
      if (cancelled) return;
      setRecentNoteIds(rNotes);
      setRecentDocIds(rDocs);
      if (cachedSubs.length > 0) setSubjects((prev) => (prev.length === 0 ? (cachedSubs as Subject[]) : prev));
      if (cachedNotes.length > 0) setNotes((prev) => (prev.length === 0 ? cachedNotes : prev));
      if (cachedEvents.length > 0) setCalendarEvents((prev) => (prev.length === 0 ? (cachedEvents as CalendarEvent[]) : prev));
      if (cachedDocs.length > 0) setLibraryDocs((prev) => (prev.length === 0 ? (cachedDocs as LibraryDoc[]) : prev));
      if (cachedDict.length > 0) setDictionaryEntries((prev) => (prev.length === 0 ? (cachedDict as DictionaryEntry[]) : prev));
      const snapState = await readOfflinePrecacheSnapshot(cachedNotes, cachedDocs as LibraryDoc[], rNotes);
      if (!cancelled) setPrecacheState(snapState);
    });

    const unsubProfile = onSnapshot(
      userDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as StudentProfile;
          setProfile(data);
        }
        setDataLoading(false);
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`)
    );

    const unsubSubjects = onSnapshot(
      query(collection(db, 'subjects'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Subject);
        setSubjects(list);
        void cacheSnapshotCollection('subjects', list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'subjects')
    );

    const unsubNotes = onSnapshot(
      query(collection(db, 'notes'), where('userId', '==', user.uid)),
      (snap) => {
        const remoteList = snap.docs.map((d) => d.data() as Note);
        void getPendingNoteWrites().then((pending) => {
          if (cancelled) return;
          let merged = [...remoteList];
          if (pending.length > 0) {
            const byId = new Map<string, Note>(merged.map((n) => [n.id, n]));
            for (const item of pending) {
              if (item.action === 'delete') {
                byId.delete(item.id);
              } else if (item.action === 'upsert' && item.payload) {
                const prev = byId.get(item.id) || ({} as Note);
                byId.set(item.id, { ...prev, ...item.payload } as Note);
              }
            }
            merged = Array.from(byId.values());
          }
          setNotes(merged);
          void cacheOfflineNotes(merged, recentNoteIdsRef.current);
        });
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notes')
    );

    const unsubLibrary = onSnapshot(
      query(collection(db, 'libraryDocs'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as LibraryDoc);
        setLibraryDocs(list);
        void cacheSnapshotCollection('libraryDocs', list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'libraryDocs')
    );

    const unsubExams = onSnapshot(
      query(collection(db, 'exams'), where('userId', '==', user.uid)),
      (snap) => {
        setExams(snap.docs.map((d) => d.data() as Exam));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'exams')
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'calendarEvents'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as CalendarEvent);
        setCalendarEvents(list);
        void cacheSnapshotCollection('calendarEvents', list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'calendarEvents')
    );

    const unsubDecks = onSnapshot(
      query(collection(db, 'flashcardDecks'), where('userId', '==', user.uid)),
      (snap) => {
        setDecks(snap.docs.map((d) => d.data() as FlashcardDeck));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'flashcardDecks')
    );

    const unsubSessions = onSnapshot(
      query(collection(db, 'studySessions'), where('userId', '==', user.uid)),
      (snap) => {
        setStudySessions(snap.docs.map((d) => d.data() as StudySession));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'studySessions')
    );

    const unsubChats = onSnapshot(
      query(collection(db, 'aiChats'), where('userId', '==', user.uid)),
      (snap) => {
        setAiChats(snap.docs.map((d) => d.data() as AIChatThread));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'aiChats')
    );

    const unsubBooks = onSnapshot(
      query(collection(db, 'books'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Book);
        setBooks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'books')
    );

    const unsubDict = onSnapshot(
      query(collection(db, 'dictionaryEntries'), where('userId', '==', user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as DictionaryEntry);
        setDictionaryEntries(list);
        void cacheSnapshotCollection('dictionaryEntries', list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'dictionaryEntries')
    );

    try {
      const cachedHub = localStorage.getItem(`fabro-hub-${user.uid}`);
      if (cachedHub) {
        const parsedHub = JSON.parse(cachedHub) as Partial<HubUserState>;
        setHubState({
          userId: user.uid,
          favorites: Array.isArray(parsedHub.favorites) ? parsedHub.favorites : [],
          history: Array.isArray(parsedHub.history) ? parsedHub.history : [],
          customTools: Array.isArray(parsedHub.customTools) ? parsedHub.customTools : [],
          disabledToolIds: Array.isArray(parsedHub.disabledToolIds) ? parsedHub.disabledToolIds : [],
        });
      }
    } catch {
      // ignore corrupted local cache
    }

    const hubDocRef = doc(db, 'hubStates', user.uid);
    const unsubHub = onSnapshot(
      hubDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<HubUserState>;
          const normalized: HubUserState = {
            userId: user.uid,
            favorites: Array.isArray(data.favorites) ? data.favorites : [],
            history: Array.isArray(data.history) ? data.history : [],
            customTools: Array.isArray(data.customTools) ? data.customTools : [],
            disabledToolIds: Array.isArray(data.disabledToolIds) ? data.disabledToolIds : [],
          };
          setHubState(normalized);
          try {
            localStorage.setItem(`fabro-hub-${user.uid}`, JSON.stringify(normalized));
          } catch {
            // ignore quota errors
          }
        } else {
          setHubState((prev) => ({
            userId: user.uid,
            favorites: prev.favorites || [],
            history: prev.history || [],
            customTools: prev.customTools || [],
            disabledToolIds: prev.disabledToolIds || [],
          }));
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `hubStates/${user.uid}`)
    );

    const unsubMemories = onSnapshot(
      query(collection(db, 'subjectMemories'), where('userId', '==', user.uid)),
      (snap) => {
        setSubjectMemories(snap.docs.map((d) => d.data() as SubjectAcademicMemory));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'subjectMemories')
    );

    return () => {
      cancelled = true;
      unsubProfile();
      unsubSubjects();
      unsubNotes();
      unsubLibrary();
      unsubExams();
      unsubEvents();
      unsubDecks();
      unsubSessions();
      unsubChats();
      unsubBooks();
      unsubDict();
      unsubHub();
      unsubMemories();
    };
  }, [authReady, user, user?.uid, user?.emailVerified, surfaceFirestoreError]);

  // ------------------------------------------------------------------
  // CRUD Mutations (Strictly conforming to firestore.rules blueprints)
  // ------------------------------------------------------------------
  const compressProfileImageToDataUrl = (file: File, maxLen = 110000): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const tryEncode = (maxSide: number, quality: number): string => {
            const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
            canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('No se pudo procesar la imagen en el navegador.');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', quality);
          };
          try {
            const attempts: Array<[number, number]> = [
              [640, 0.75],
              [520, 0.6],
              [420, 0.48],
              [320, 0.4],
            ];
            let result = '';
            for (const [side, q] of attempts) {
              result = tryEncode(side, q);
              if (result.length <= maxLen) break;
            }
            resolve(result.slice(0, maxLen));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('No se pudo decodificar la imagen seleccionada.'));
        img.src = String(reader.result || '');
      };
      reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
      reader.readAsDataURL(file);
    });
  };

  const updateStudentProfile: FabroContextValue['updateStudentProfile'] = async (patch) => {
    if (!user) return;
    const path = `users/${user.uid}`;
    try {
      const cleanName = (patch.displayName ?? profile?.displayName ?? user.displayName ?? 'Usuario FABRO')
        .trim()
        .slice(0, 100) || 'Usuario FABRO';
      const nextEducation = patch.educationLevel ?? profile?.educationLevel ?? 'universitario';
      const nextInstitution = (patch.institution ?? profile?.institution ?? '').slice(0, 150);
      const nextCareer = (patch.career ?? profile?.career ?? '').slice(0, 150);
      const nextGoalHours = Math.max(1, Math.min(168, Number(patch.weeklyGoalHours ?? profile?.weeklyGoalHours ?? 15) || 15));
      const nextTheme = patch.themePreference ?? profile?.themePreference ?? 'dark';

      const userUpdate: Record<string, unknown> = {
        displayName: cleanName,
        educationLevel: nextEducation,
        institution: nextInstitution,
        career: nextCareer,
        weeklyGoalHours: nextGoalHours,
        themePreference: nextTheme,
        updatedAt: serverTimestamp(),
      };
      let resolvedCustomFabroId = (profile?.customFabroId || '').slice(0, 32);
      if (patch.customFabroId !== undefined) {
        const rawCustom = patch.customFabroId.trim();
        if (rawCustom) {
          const normalized = normalizeCustomFabroId(rawCustom);
          if (!normalized) {
            throw new Error('El FABRO ID debe tener al menos 3 letras o números (ej: FBR-LEO-2026).');
          }
          try {
            const dupSnap = await getDocs(
              query(collection(db, 'publicProfiles'), where('customFabroId', '==', normalized))
            );
            const takenByOther = dupSnap.docs.some((d) => d.id !== user.uid);
            if (takenByOther) {
              throw new Error(`El FABRO ID "${normalized}" ya está ocupado por otro usuario.`);
            }
          } catch (dupErr) {
            if (dupErr instanceof Error && dupErr.message.includes('ya está ocupado')) {
              throw dupErr;
            }
          }
          resolvedCustomFabroId = normalized;
          userUpdate.customFabroId = normalized;
        } else {
          resolvedCustomFabroId = '';
          userUpdate.customFabroId = '';
        }
      }

      if (patch.username !== undefined) userUpdate.username = patch.username.trim().slice(0, 50);
      if (patch.photoURL !== undefined) userUpdate.photoURL = patch.photoURL.trim().slice(0, 135000);
      if (patch.galleryPhotos !== undefined) {
        userUpdate.galleryPhotos = patch.galleryPhotos
          .map((u) => String(u || '').trim().slice(0, 135000))
          .filter(Boolean)
          .slice(0, 6);
      }
      if (patch.sharedPhrase !== undefined) userUpdate.sharedPhrase = patch.sharedPhrase.trim().slice(0, 400);
      if (patch.favoriteBooks !== undefined) userUpdate.favoriteBooks = patch.favoriteBooks.trim().slice(0, 300);
      if (patch.favoriteMovies !== undefined) userUpdate.favoriteMovies = patch.favoriteMovies.trim().slice(0, 300);
      if (patch.favoriteMusic !== undefined) userUpdate.favoriteMusic = patch.favoriteMusic.trim().slice(0, 300);
      if (patch.birthDate !== undefined) userUpdate.birthDate = patch.birthDate.trim().slice(0, 20);
      if (patch.isMinor !== undefined) userUpdate.isMinor = Boolean(patch.isMinor);
      if (patch.parentalConsentApproved !== undefined) userUpdate.parentalConsentApproved = Boolean(patch.parentalConsentApproved);
      if (patch.country !== undefined) userUpdate.country = patch.country.trim().slice(0, 100);
      if (patch.province !== undefined) userUpdate.province = patch.province.trim().slice(0, 100);
      if (patch.city !== undefined) userUpdate.city = patch.city.trim().slice(0, 100);
      if (patch.bio !== undefined) userUpdate.bio = patch.bio.trim().slice(0, 1000);
      if (patch.interests !== undefined) userUpdate.interests = patch.interests.slice(0, 25).map((i) => i.trim().slice(0, 80)).filter(Boolean);
      if (patch.institutions !== undefined) userUpdate.institutions = patch.institutions.slice(0, 15).map((i) => i.trim().slice(0, 150)).filter(Boolean);
      if (patch.isStudent !== undefined) userUpdate.isStudent = Boolean(patch.isStudent);
      if (patch.isInstructor !== undefined) userUpdate.isInstructor = Boolean(patch.isInstructor);
      if (patch.instructorCategory !== undefined) userUpdate.instructorCategory = patch.instructorCategory;
      if (patch.specialty !== undefined) userUpdate.specialty = patch.specialty.trim().slice(0, 150);
      if (patch.experienceSummary !== undefined) userUpdate.experienceSummary = patch.experienceSummary.trim().slice(0, 1500);
      if (patch.presenceMode !== undefined) userUpdate.presenceMode = patch.presenceMode;
      if (patch.followedInstructorIds !== undefined) userUpdate.followedInstructorIds = patch.followedInstructorIds.slice(0, 200);
      if (patch.blockedUserIds !== undefined) userUpdate.blockedUserIds = patch.blockedUserIds.slice(0, 200);

      await updateDoc(doc(db, 'users', user.uid), userUpdate);

      // Sync strictly PII-free public profile (never email, never birthDate)
      const effectiveMinor = patch.isMinor !== undefined ? Boolean(patch.isMinor) : Boolean(profile?.isMinor);
      const effectivePresence = patch.presenceMode ?? profile?.presenceMode ?? 'online';
      const mappedPublicPresence = effectivePresence === 'invisible' ? 'offline' : effectivePresence;
      const publicDocRef = doc(db, 'publicProfiles', user.uid);
      const pubSnap = await getDoc(publicDocRef);
      const existingSearchable = pubSnap.exists()
        ? Boolean(pubSnap.data().searchableInDirectory)
        : !effectiveMinor;
      const effectiveSearchable = effectiveMinor
        ? false
        : patch.searchableInDirectory !== undefined
        ? Boolean(patch.searchableInDirectory)
        : existingSearchable;

      const resolvedPhotoURL = (patch.photoURL ?? profile?.photoURL ?? '').slice(0, 135000);
      const resolvedGallery = (patch.galleryPhotos ?? profile?.galleryPhotos ?? [])
        .map((u) => String(u || '').trim().slice(0, 135000))
        .filter(Boolean)
        .slice(0, 6);
      const resolvedSharedPhrase = (patch.sharedPhrase ?? profile?.sharedPhrase ?? '').trim().slice(0, 400);
      const resolvedFavBooks = (patch.favoriteBooks ?? profile?.favoriteBooks ?? '').trim().slice(0, 300);
      const resolvedFavMovies = (patch.favoriteMovies ?? profile?.favoriteMovies ?? '').trim().slice(0, 300);
      const resolvedFavMusic = (patch.favoriteMusic ?? profile?.favoriteMusic ?? '').trim().slice(0, 300);

      if (pubSnap.exists()) {
        await updateDoc(publicDocRef, {
          displayName: cleanName,
          username: (patch.username ?? profile?.username ?? '').slice(0, 50),
          customFabroId: resolvedCustomFabroId,
          photoURL: resolvedPhotoURL,
          galleryPhotos: resolvedGallery,
          sharedPhrase: resolvedSharedPhrase,
          favoriteBooks: resolvedFavBooks,
          favoriteMovies: resolvedFavMovies,
          favoriteMusic: resolvedFavMusic,
          country: (patch.country ?? profile?.country ?? '').slice(0, 100),
          province: (patch.province ?? profile?.province ?? '').slice(0, 100),
          city: (patch.city ?? profile?.city ?? '').slice(0, 100),
          bio: (patch.bio ?? profile?.bio ?? '').slice(0, 1000),
          interests: (patch.interests ?? profile?.interests ?? []).slice(0, 25),
          institutions: (patch.institutions ?? profile?.institutions ?? (nextInstitution ? [nextInstitution] : [])).slice(0, 15),
          isStudent: patch.isStudent ?? profile?.isStudent ?? false,
          isInstructor: patch.isInstructor ?? profile?.isInstructor ?? false,
          instructorCategory: patch.instructorCategory ?? profile?.instructorCategory ?? 'instructor_independiente',
          specialty: (patch.specialty ?? profile?.specialty ?? '').slice(0, 150),
          experienceSummary: (patch.experienceSummary ?? profile?.experienceSummary ?? '').slice(0, 1500),
          isMinor: effectiveMinor,
          searchableInDirectory: effectiveSearchable,
          presenceStatus: mappedPublicPresence,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(publicDocRef, {
          uid: user.uid,
          displayName: cleanName,
          username: (patch.username ?? profile?.username ?? '').slice(0, 50),
          customFabroId: resolvedCustomFabroId,
          photoURL: resolvedPhotoURL,
          galleryPhotos: resolvedGallery,
          sharedPhrase: resolvedSharedPhrase,
          favoriteBooks: resolvedFavBooks,
          favoriteMovies: resolvedFavMovies,
          favoriteMusic: resolvedFavMusic,
          country: (patch.country ?? profile?.country ?? '').slice(0, 100),
          province: (patch.province ?? profile?.province ?? '').slice(0, 100),
          city: (patch.city ?? profile?.city ?? '').slice(0, 100),
          bio: (patch.bio ?? profile?.bio ?? '').slice(0, 1000),
          interests: (patch.interests ?? profile?.interests ?? []).slice(0, 25),
          institutions: (patch.institutions ?? profile?.institutions ?? (nextInstitution ? [nextInstitution] : [])).slice(0, 15),
          isStudent: patch.isStudent ?? profile?.isStudent ?? false,
          isInstructor: patch.isInstructor ?? profile?.isInstructor ?? false,
          instructorCategory: patch.instructorCategory ?? profile?.instructorCategory ?? 'instructor_independiente',
          verificationStatus: profile?.verificationStatus ?? 'no_solicitado',
          specialty: (patch.specialty ?? profile?.specialty ?? '').slice(0, 150),
          experienceSummary: (patch.experienceSummary ?? profile?.experienceSummary ?? '').slice(0, 1500),
          isMinor: effectiveMinor,
          searchableInDirectory: effectiveSearchable,
          presenceStatus: mappedPublicPresence,
          reputationPoints: profile?.reputationPoints ?? 0,
          followersCount: 0,
          updatedAt: serverTimestamp(),
        });
      }

      if (patch.themePreference === 'dark' || patch.themePreference === 'light') {
        setTheme(patch.themePreference);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('FABRO ID')) {
        throw err;
      }
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const uploadProfilePhoto: FabroContextValue['uploadProfilePhoto'] = async (file, target) => {
    if (!user) throw new Error('No autenticado');
    if (!file.type.startsWith('image/')) {
      throw new Error('Seleccioná un archivo de imagen válido (JPG, PNG o WebP).');
    }

    let finalUrl = '';
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60) || 'foto.jpg';
      const ref = storageRef(storage, `users/${user.uid}/profile_photos/${target}_${Date.now()}_${safeName}`);
      await uploadBytes(ref, file);
      finalUrl = await getDownloadURL(ref);
    } catch {
      finalUrl = await compressProfileImageToDataUrl(file, 110000);
    }

    if (target === 'avatar') {
      await updateStudentProfile({
        displayName: profile?.displayName || user.displayName || 'Usuario FABRO',
        photoURL: finalUrl,
      });
    } else {
      const nextGallery = [...(profile?.galleryPhotos || []).filter((u) => u !== finalUrl), finalUrl].slice(-6);
      await updateStudentProfile({
        displayName: profile?.displayName || user.displayName || 'Usuario FABRO',
        galleryPhotos: nextGallery,
      });
    }

    return finalUrl;
  };

  const removeGalleryPhoto: FabroContextValue['removeGalleryPhoto'] = async (photoUrl) => {
    if (!user) return;
    const nextGallery = (profile?.galleryPhotos || []).filter((u) => u !== photoUrl);
    await updateStudentProfile({
      displayName: profile?.displayName || user.displayName || 'Usuario FABRO',
      galleryPhotos: nextGallery,
    });
    if (photoUrl.startsWith('https://firebasestorage.googleapis.com')) {
      try {
        await deleteObject(storageRef(storage, photoUrl));
      } catch {
        // ignore storage cleanup errors
      }
    }
  };

  const createSubject: FabroContextValue['createSubject'] = async (data) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('sub');
    const path = `subjects/${id}`;
    try {
      await setDoc(doc(db, 'subjects', id), {
        id,
        userId: user.uid,
        name: data.name.trim().slice(0, 120),
        institution: (data.institution || '').slice(0, 150),
        level: data.level,
        career: (data.career || '').slice(0, 150),
        professor: (data.professor || '').slice(0, 150),
        description: (data.description || '').slice(0, 2000),
        color: /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : '#0284C7',
        syllabus: (data.syllabus || '').slice(0, 10000),
        ...(data.syllabusFileName !== undefined
          ? { syllabusFileName: String(data.syllabusFileName || '').slice(0, 255) }
          : {}),
        ...(data.syllabusFileMime !== undefined
          ? { syllabusFileMime: String(data.syllabusFileMime || '').slice(0, 120) }
          : {}),
        ...(data.syllabusFileUrl !== undefined
          ? { syllabusFileUrl: String(data.syllabusFileUrl || '').slice(0, 2000) }
          : {}),
        ...(data.syllabusExtractedText !== undefined
          ? { syllabusExtractedText: String(data.syllabusExtractedText || '').slice(0, 120000) }
          : {}),
        bibliography: (data.bibliography || '').slice(0, 5000),
        units: data.units.slice(0, 40).map((u) => u.slice(0, 200)),
        progressPercent: Math.max(0, Math.min(100, Number(data.progressPercent) || 0)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (err) {
      return surfaceFirestoreError(err, OperationType.CREATE, path, 'No se pudo guardar la materia. Verificá los datos e intentá de nuevo.');
    }
  };

  const updateSubject: FabroContextValue['updateSubject'] = async (id, patch) => {
    if (!user) return;
    const path = `subjects/${id}`;
    try {
      if (typeof patch.progressPercent === 'number' && Object.keys(patch).length === 1) {
        await updateDoc(doc(db, 'subjects', id), {
          progressPercent: Math.max(0, Math.min(100, patch.progressPercent)),
          updatedAt: serverTimestamp(),
        });
      } else {
        const sanitizedSources =
          patch.aiAnalysisSources !== undefined
            ? patch.aiAnalysisSources
                .filter((s) => s && s.title && s.url)
                .slice(0, 20)
                .map((s) => ({
                  title: String(s.title).trim().slice(0, 200) || 'Fuente web',
                  url: String(s.url).trim().slice(0, 2000),
                  domain: String(s.domain || '').trim().slice(0, 200),
                  ...(s.category ? { category: String(s.category).trim().slice(0, 80) } : {}),
                }))
            : undefined;

        await updateDoc(doc(db, 'subjects', id), {
          ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 120) } : {}),
          ...(patch.institution !== undefined ? { institution: patch.institution.slice(0, 150) } : {}),
          ...(patch.level !== undefined ? { level: patch.level } : {}),
          ...(patch.career !== undefined ? { career: patch.career.slice(0, 150) } : {}),
          ...(patch.professor !== undefined ? { professor: patch.professor.slice(0, 150) } : {}),
          ...(patch.description !== undefined ? { description: patch.description.slice(0, 2000) } : {}),
          ...(patch.color !== undefined ? { color: patch.color } : {}),
          ...(patch.syllabus !== undefined ? { syllabus: patch.syllabus.slice(0, 10000) } : {}),
          ...(patch.syllabusFileName !== undefined
            ? { syllabusFileName: String(patch.syllabusFileName || '').slice(0, 255) }
            : {}),
          ...(patch.syllabusFileMime !== undefined
            ? { syllabusFileMime: String(patch.syllabusFileMime || '').slice(0, 120) }
            : {}),
          ...(patch.syllabusFileUrl !== undefined
            ? { syllabusFileUrl: String(patch.syllabusFileUrl || '').slice(0, 2000) }
            : {}),
          ...(patch.syllabusExtractedText !== undefined
            ? { syllabusExtractedText: String(patch.syllabusExtractedText || '').slice(0, 120000) }
            : {}),
          ...(patch.bibliography !== undefined ? { bibliography: patch.bibliography.slice(0, 5000) } : {}),
          ...(patch.units !== undefined
            ? { units: patch.units.slice(0, 40).map((u) => u.slice(0, 200)) }
            : {}),
          ...(patch.aiAnalysisMarkdown !== undefined
            ? { aiAnalysisMarkdown: String(patch.aiAnalysisMarkdown || '').slice(0, 60000) }
            : {}),
          ...(sanitizedSources !== undefined ? { aiAnalysisSources: sanitizedSources } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      surfaceFirestoreError(err, OperationType.UPDATE, path, 'No se pudo actualizar la materia.');
    }
  };

  const uploadSubjectSyllabusFile: FabroContextValue['uploadSubjectSyllabusFile'] = async (
    subjectId,
    file
  ) => {
    if (!user) throw new Error('No autenticado');
    const fileName = (file.name || 'programa-de-estudio').slice(0, 255);
    const mimeType = (file.type || 'application/octet-stream').slice(0, 120);

    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

    if (dataUrl && file.size <= 12 * 1024 * 1024) {
      await saveLocalFileBlob({
        id: `syl_${subjectId}`,
        fileName,
        mimeType,
        dataUrl,
        savedAt: new Date().toISOString(),
      });
    }

    let syllabusExtractedText = '';
    const isPlainText =
      mimeType.startsWith('text/') || /\.(txt|md|csv|json|rtf)$/i.test(fileName);

    if (isPlainText) {
      try {
        syllabusExtractedText = (await file.text()).slice(0, 120000);
      } catch {
        syllabusExtractedText = '';
      }
    } else if (dataUrl.includes(',')) {
      const base64 = dataUrl.split(',')[1] || '';
      if (base64) {
        try {
          const resp = await authFetch('/api/ai/extract-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64,
              mimeType: mimeType || 'application/pdf',
              fileName,
            }),
          });
          if (resp.ok) {
            const parsed = (await resp.json()) as { extractedText?: string };
            syllabusExtractedText = String(parsed.extractedText || '').slice(0, 120000);
          }
        } catch {
          syllabusExtractedText = '';
        }
      }
    }

    let syllabusFileUrl = '';
    try {
      const storagePath = `users/${user.uid}/syllabi/${subjectId}_${fileName}`;
      const fileRef = storageRef(storage, storagePath);
      await uploadBytes(fileRef, file);
      syllabusFileUrl = (await getDownloadURL(fileRef)).slice(0, 2000);
    } catch {
      syllabusFileUrl = '';
    }

    return {
      syllabusFileName: fileName,
      syllabusFileMime: mimeType,
      syllabusFileUrl,
      syllabusExtractedText,
    };
  };

  const deleteSubject: FabroContextValue['deleteSubject'] = async (id) => {
    const path = `subjects/${id}`;
    try {
      await deleteDoc(doc(db, 'subjects', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const markNoteAccessed = useCallback((noteId: string) => {
    if (!noteId) return;
    setRecentNoteIds((prev) => [noteId, ...prev.filter((id) => id !== noteId)].slice(0, 35));
    const found = notesRef.current.find((n) => n.id === noteId);
    void recordRecentAccess('note', noteId, found?.title).then(() => {
      if (found) {
        void upsertCachedNote(found);
      }
    });
  }, []);

  const markLibraryDocAccessed = useCallback((docId: string) => {
    if (!docId) return;
    setRecentDocIds((prev) => [docId, ...prev.filter((id) => id !== docId)].slice(0, 35));
    const found = libraryDocsRef.current.find((d) => d.id === docId);
    void recordRecentAccess('doc', docId, found?.title);
  }, []);

  const precacheStudyDataNow = useCallback(async (forceRefresh = false) => {
    setPrecacheState((prev) => ({
      ...prev,
      status: navigator.onLine ? 'precaching' : 'offline',
    }));
    const next = await runFullStudyPrecache({
      notes: notesRef.current,
      libraryDocs: libraryDocsRef.current,
      subjects: subjectsRef.current,
      recentNoteIds: recentNoteIdsRef.current,
      recentDocIds: recentDocIdsRef.current,
      forceRefresh,
    });
    setPrecacheState(next);
  }, []);

  const syncPendingOfflineChanges = useCallback(async () => {
    if (!user || !navigator.onLine) return;
    const pending = await getPendingNoteWrites();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        if (item.action === 'delete') {
          await deleteDoc(doc(db, 'notes', item.id));
          await clearPendingNoteWrite(item.id);
        } else if (item.action === 'upsert' && item.payload) {
          const p = item.payload;
          await setDoc(
            doc(db, 'notes', item.id),
            {
              id: item.id,
              userId: user.uid,
              subjectId: (p.subjectId || '').slice(0, 128),
              unit: (p.unit || '').slice(0, 200),
              folder: (p.folder || 'General').slice(0, 100),
              title: (p.title?.trim() || 'Sin título').slice(0, 200),
              contentHtml: (p.contentHtml || '').slice(0, 300000),
              contentText: (p.contentText || '').slice(0, 300000),
              tags: (p.tags || []).slice(0, 15).map((t) => t.slice(0, 50)),
              attachments: (p.attachments || []).slice(0, 10),
              offlineAvailable: Boolean(p.offlineAvailable ?? true),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          await clearPendingNoteWrite(item.id);
        }
      } catch {
        // Keep in pending queue for next reconnect attempt
      }
    }
    const updatedSnap = await readOfflinePrecacheSnapshot(
      notesRef.current,
      libraryDocsRef.current,
      recentNoteIdsRef.current
    );
    setPrecacheState(updatedSnap);
  }, [user]);

  // Automatic background precaching whenever Library docs, Notes, or Recent items change
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;
    if (!isOnline) {
      void readOfflinePrecacheSnapshot(notes, libraryDocs, recentNoteIds).then((snap) => {
        setPrecacheState({ ...snap, status: 'offline' });
      });
      return;
    }

    const timer = window.setTimeout(() => {
      void syncPendingOfflineChanges().then(() => precacheStudyDataNow(false));
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [
    authReady,
    user,
    isOnline,
    notes,
    libraryDocs,
    subjects,
    recentNoteIds,
    recentDocIds,
    precacheStudyDataNow,
    syncPendingOfflineChanges,
  ]);

  const createNote: FabroContextValue['createNote'] = async (data) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('note');
    const path = `notes/${id}`;
    const nowIso = new Date().toISOString();
    const localNote: Note = {
      id,
      userId: user.uid,
      subjectId: data.subjectId.slice(0, 128),
      unit: (data.unit || '').slice(0, 200),
      folder: (data.folder || 'General').slice(0, 100),
      title: (data.title.trim() || 'Sin título').slice(0, 200),
      contentHtml: data.contentHtml.slice(0, 300000),
      contentText: data.contentText.slice(0, 300000),
      tags: data.tags.slice(0, 15).map((t) => t.slice(0, 50)),
      attachments: data.attachments.slice(0, 10),
      offlineAvailable: Boolean(data.offlineAvailable),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Optimistic local state + IndexedDB persistence + recent access tracking
    setNotes((prev) => [localNote, ...prev]);
    setRecentNoteIds((prev) => [id, ...prev.filter((nid) => nid !== id)].slice(0, 35));
    await upsertCachedNote(localNote);
    await recordRecentAccess('note', id, localNote.title);

    const firestorePayload = {
      ...localNote,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!navigator.onLine) {
      await enqueuePendingNoteWrite('upsert', id, localNote);
      setPrecacheState((prev) => ({
        ...prev,
        status: 'offline',
        pendingSyncCount: prev.pendingSyncCount + 1,
      }));
      void setDoc(doc(db, 'notes', id), firestorePayload)
        .then(() => clearPendingNoteWrite(id))
        .catch(() => {});
      return id;
    }

    try {
      await setDoc(doc(db, 'notes', id), firestorePayload);
      return id;
    } catch (err) {
      if (!navigator.onLine) {
        await enqueuePendingNoteWrite('upsert', id, localNote);
        return id;
      }
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateNote: FabroContextValue['updateNote'] = async (id, patch) => {
    const path = `notes/${id}`;
    const existing = notesRef.current.find((n) => n.id === id);
    const nowIso = new Date().toISOString();
    const mergedLocal: Note | null = existing
      ? {
          ...existing,
          ...(patch.subjectId !== undefined ? { subjectId: patch.subjectId.slice(0, 128) } : {}),
          ...(patch.unit !== undefined ? { unit: patch.unit.slice(0, 200) } : {}),
          ...(patch.folder !== undefined ? { folder: patch.folder.slice(0, 100) } : {}),
          ...(patch.title !== undefined ? { title: (patch.title.trim() || 'Sin título').slice(0, 200) } : {}),
          ...(patch.contentHtml !== undefined ? { contentHtml: patch.contentHtml.slice(0, 300000) } : {}),
          ...(patch.contentText !== undefined ? { contentText: patch.contentText.slice(0, 300000) } : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags.slice(0, 15).map((t) => t.slice(0, 50)) } : {}),
          ...(patch.attachments !== undefined ? { attachments: patch.attachments.slice(0, 10) } : {}),
          ...(patch.offlineAvailable !== undefined ? { offlineAvailable: Boolean(patch.offlineAvailable) } : {}),
          updatedAt: nowIso,
        }
      : null;

    if (mergedLocal) {
      setNotes((prev) => prev.map((n) => (n.id === id ? mergedLocal : n)));
      await upsertCachedNote(mergedLocal);
    }
    setRecentNoteIds((prev) => [id, ...prev.filter((nid) => nid !== id)].slice(0, 35));
    await recordRecentAccess('note', id, mergedLocal?.title || existing?.title);

    const keys = Object.keys(patch);
    const firestoreUpdate =
      keys.length === 1 && patch.offlineAvailable !== undefined
        ? {
            offlineAvailable: Boolean(patch.offlineAvailable),
            updatedAt: serverTimestamp(),
          }
        : {
            ...(patch.subjectId !== undefined ? { subjectId: patch.subjectId.slice(0, 128) } : {}),
            ...(patch.unit !== undefined ? { unit: patch.unit.slice(0, 200) } : {}),
            ...(patch.folder !== undefined ? { folder: patch.folder.slice(0, 100) } : {}),
            ...(patch.title !== undefined ? { title: (patch.title.trim() || 'Sin título').slice(0, 200) } : {}),
            ...(patch.contentHtml !== undefined ? { contentHtml: patch.contentHtml.slice(0, 300000) } : {}),
            ...(patch.contentText !== undefined ? { contentText: patch.contentText.slice(0, 300000) } : {}),
            ...(patch.tags !== undefined ? { tags: patch.tags.slice(0, 15).map((t) => t.slice(0, 50)) } : {}),
            ...(patch.attachments !== undefined ? { attachments: patch.attachments.slice(0, 10) } : {}),
            ...(patch.offlineAvailable !== undefined ? { offlineAvailable: Boolean(patch.offlineAvailable) } : {}),
            updatedAt: serverTimestamp(),
          };

    if (!navigator.onLine) {
      await enqueuePendingNoteWrite('upsert', id, mergedLocal || { ...patch, id });
      const pending = await getPendingNoteWrites();
      setPrecacheState((prev) => ({
        ...prev,
        status: 'offline',
        pendingSyncCount: pending.length,
      }));
      void updateDoc(doc(db, 'notes', id), firestoreUpdate)
        .then(() => clearPendingNoteWrite(id))
        .catch(() => {});
      return;
    }

    try {
      await updateDoc(doc(db, 'notes', id), firestoreUpdate);
      await clearPendingNoteWrite(id);
    } catch (err) {
      if (!navigator.onLine) {
        await enqueuePendingNoteWrite('upsert', id, mergedLocal || { ...patch, id });
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteNote: FabroContextValue['deleteNote'] = async (id) => {
    const path = `notes/${id}`;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await deleteCachedNote(id);

    if (!navigator.onLine) {
      await enqueuePendingNoteWrite('delete', id);
      const pending = await getPendingNoteWrites();
      setPrecacheState((prev) => ({
        ...prev,
        status: 'offline',
        pendingSyncCount: pending.length,
      }));
      void deleteDoc(doc(db, 'notes', id))
        .then(() => clearPendingNoteWrite(id))
        .catch(() => {});
      return;
    }

    try {
      await deleteDoc(doc(db, 'notes', id));
      await clearPendingNoteWrite(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const sanitizeCoverage = (cov?: DocumentCoverageMetadata): DocumentCoverageMetadata | undefined => {
    if (!cov) return undefined;
    const totalPages = Math.max(0, Math.min(10000, Math.round(Number(cov.totalPages) || 0)));
    const processedPages = Math.max(0, Math.min(10000, Math.round(Number(cov.processedPages) || 0)));
    const pendingPages = Math.max(0, Math.min(10000, Math.round(Number(cov.pendingPages) || 0)));
    const readStatus: DocumentCoverageMetadata['readStatus'] =
      cov.readStatus === 'completo' ||
      cov.readStatus === 'parcial' ||
      cov.readStatus === 'pendiente' ||
      cov.readStatus === 'error'
        ? cov.readStatus
        : pendingPages > 0
          ? 'parcial'
          : 'completo';
    return {
      totalPages,
      processedPages,
      pendingPages,
      readStatus,
      extractionErrors: (cov.extractionErrors || []).slice(0, 25).map((e) => String(e).slice(0, 300)),
      processedAt: String(cov.processedAt || new Date().toISOString()).slice(0, 60),
      fragmentCount: Math.max(0, Math.min(500, Math.round(Number(cov.fragmentCount) || 1))),
      conceptIndex: (cov.conceptIndex || []).slice(0, 80).map((c) => String(c).slice(0, 200)),
      authorsDetected: (cov.authorsDetected || []).slice(0, 40).map((a) => String(a).slice(0, 200)),
    };
  };

  const uploadLibraryDocument: FabroContextValue['uploadLibraryDocument'] = async ({
    file,
    title,
    category,
    subjectId,
    tags,
    aiAuthorized,
    extractedText,
    coverage,
  }) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('doc');
    const path = `libraryDocs/${id}`;
    let storageUrl = '';
    let storagePath = '';
    const fileName = (file?.name || `${title}.txt`).slice(0, 255);
    const mimeType = (file?.type || 'text/plain').slice(0, 120);
    const sizeBytes = Math.max(0, Math.round(file?.size ?? new Blob([extractedText]).size));

    if (file) {
      // Save local offline blob copy in IndexedDB
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
      if (dataUrl && sizeBytes <= 12 * 1024 * 1024) {
        await saveLocalFileBlob({
          id,
          fileName,
          mimeType,
          dataUrl,
          savedAt: new Date().toISOString(),
        });
      }

      // Attempt real Firebase Storage upload
      try {
        storagePath = `users/${user.uid}/library/${id}_${fileName}`;
        const fileRef = storageRef(storage, storagePath);
        await uploadBytes(fileRef, file);
        storageUrl = await getDownloadURL(fileRef);
      } catch {
        // If Firebase Storage bucket isn't initialized yet, metadata + extractedText + local IndexedDB blob still work cleanly
        storagePath = '';
        storageUrl = '';
      }
    }

    const sanitizedCoverage = sanitizeCoverage(coverage);

    try {
      await setDoc(doc(db, 'libraryDocs', id), {
        id,
        userId: user.uid,
        subjectId: subjectId.slice(0, 128),
        title: (title.trim() || fileName).slice(0, 200),
        category,
        fileName,
        mimeType,
        sizeBytes: Math.min(104857600, sizeBytes),
        storageUrl: storageUrl.slice(0, 2000),
        storagePath: storagePath.slice(0, 500),
        extractedText: extractedText.slice(0, 300000),
        aiAuthorized: Boolean(aiAuthorized),
        tags: tags.slice(0, 15).map((t) => t.slice(0, 50)),
        ...(sanitizedCoverage ? { coverage: sanitizedCoverage } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (profile) {
        await updateDoc(doc(db, 'users', user.uid), {
          storageUsedBytes: Math.min(10737418240, (profile.storageUsedBytes || 0) + sizeBytes),
          updatedAt: serverTimestamp(),
        });
      }
      return id;
    } catch (err) {
      return surfaceFirestoreError(err, OperationType.CREATE, path, 'No se pudo guardar el documento en tu biblioteca.');
    }
  };

  const updateLibraryDoc: FabroContextValue['updateLibraryDoc'] = async (id, patch) => {
    const path = `libraryDocs/${id}`;
    try {
      const keys = Object.keys(patch);
      if (keys.length === 1 && patch.aiAuthorized !== undefined) {
        await updateDoc(doc(db, 'libraryDocs', id), {
          aiAuthorized: Boolean(patch.aiAuthorized),
          updatedAt: serverTimestamp(),
        });
      } else {
        const sanitizedCoverage = patch.coverage !== undefined ? sanitizeCoverage(patch.coverage) : undefined;
        await updateDoc(doc(db, 'libraryDocs', id), {
          ...(patch.subjectId !== undefined ? { subjectId: patch.subjectId.slice(0, 128) } : {}),
          ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 200) } : {}),
          ...(patch.category !== undefined ? { category: patch.category } : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags.slice(0, 15).map((t) => t.slice(0, 50)) } : {}),
          ...(patch.aiAuthorized !== undefined ? { aiAuthorized: Boolean(patch.aiAuthorized) } : {}),
          ...(patch.extractedText !== undefined ? { extractedText: patch.extractedText.slice(0, 300000) } : {}),
          ...(sanitizedCoverage ? { coverage: sanitizedCoverage } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteLibraryDoc: FabroContextValue['deleteLibraryDoc'] = async (docItem) => {
    const path = `libraryDocs/${docItem.id}`;
    try {
      if (docItem.storagePath) {
        try {
          await deleteObject(storageRef(storage, docItem.storagePath));
        } catch {
          // Ignore if already deleted
        }
      }
      await deleteLocalFileBlob(docItem.id);
      await deleteDoc(doc(db, 'libraryDocs', docItem.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const createExam: FabroContextValue['createExam'] = async (data) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('exam');
    const path = `exams/${id}`;
    try {
      await setDoc(doc(db, 'exams', id), {
        id,
        userId: user.uid,
        subjectId: data.subjectId.slice(0, 128),
        title: data.title.trim().slice(0, 200),
        mode: data.mode,
        difficulty: data.difficulty,
        units: data.units.slice(0, 20).map((u) => u.slice(0, 200)),
        status: 'en_progreso',
        scorePercent: 0,
        questionsCount: Math.max(1, Math.min(100, data.questionsCount)),
        questions: data.questions.slice(0, 50),
        weakTopics: [],
        aiFeedback: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateExamProgress: FabroContextValue['updateExamProgress'] = async (id, questions) => {
    const path = `exams/${id}`;
    try {
      await updateDoc(doc(db, 'exams', id), {
        questions: questions.slice(0, 50),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const completeExam: FabroContextValue['completeExam'] = async (id, result) => {
    const path = `exams/${id}`;
    try {
      await updateDoc(doc(db, 'exams', id), {
        status: 'completado',
        scorePercent: Math.max(0, Math.min(100, Math.round(result.scorePercent))),
        questions: result.questions.slice(0, 50),
        weakTopics: result.weakTopics.slice(0, 20).map((t) => t.slice(0, 200)),
        aiFeedback: result.aiFeedback.slice(0, 15000),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteExam: FabroContextValue['deleteExam'] = async (id) => {
    const path = `exams/${id}`;
    try {
      await deleteDoc(doc(db, 'exams', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const createCalendarEvent: FabroContextValue['createCalendarEvent'] = async (data) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('evt');
    const path = `calendarEvents/${id}`;
    try {
      await setDoc(doc(db, 'calendarEvents', id), {
        id,
        userId: user.uid,
        subjectId: data.subjectId.slice(0, 128),
        title: data.title.trim().slice(0, 200),
        type: data.type,
        date: data.date.slice(0, 30),
        time: (data.time || '').slice(0, 10),
        notes: (data.notes || '').slice(0, 1000),
        completed: Boolean(data.completed),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateCalendarEvent: FabroContextValue['updateCalendarEvent'] = async (id, patch) => {
    const path = `calendarEvents/${id}`;
    try {
      const keys = Object.keys(patch);
      if (keys.length === 1 && patch.completed !== undefined) {
        await updateDoc(doc(db, 'calendarEvents', id), {
          completed: Boolean(patch.completed),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'calendarEvents', id), {
          ...(patch.subjectId !== undefined ? { subjectId: patch.subjectId.slice(0, 128) } : {}),
          ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 200) } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.date !== undefined ? { date: patch.date.slice(0, 30) } : {}),
          ...(patch.time !== undefined ? { time: patch.time.slice(0, 10) } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 1000) } : {}),
          ...(patch.completed !== undefined ? { completed: Boolean(patch.completed) } : {}),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteCalendarEvent: FabroContextValue['deleteCalendarEvent'] = async (id) => {
    const path = `calendarEvents/${id}`;
    try {
      await deleteDoc(doc(db, 'calendarEvents', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const createDeck: FabroContextValue['createDeck'] = async (data) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('deck');
    const path = `flashcardDecks/${id}`;
    try {
      await setDoc(doc(db, 'flashcardDecks', id), {
        id,
        userId: user.uid,
        subjectId: data.subjectId.slice(0, 128),
        title: data.title.trim().slice(0, 200),
        description: data.description.slice(0, 500),
        cardCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteDeck: FabroContextValue['deleteDeck'] = async (deckId) => {
    const path = `flashcardDecks/${deckId}`;
    try {
      await deleteDoc(doc(db, 'flashcardDecks', deckId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const createCard: FabroContextValue['createCard'] = async (deckId, data) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('card');
    const path = `flashcardDecks/${deckId}/cards/${id}`;
    try {
      await setDoc(doc(db, 'flashcardDecks', deckId, 'cards', id), {
        id,
        userId: user.uid,
        deckId,
        question: data.question.trim().slice(0, 1500),
        answer: data.answer.trim().slice(0, 2000),
        cardType: data.cardType,
        options: data.options.slice(0, 6).map((o) => o.slice(0, 300)),
        correctOptionIndex: data.correctOptionIndex,
        easeFactor: data.easeFactor,
        intervalDays: data.intervalDays,
        repetitions: data.repetitions,
        nextReviewDate: data.nextReviewDate,
        lastResult: data.lastResult,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'flashcardDecks', deckId), {
        cardCount: increment(1),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (err) {
      return surfaceFirestoreError(err, OperationType.CREATE, path, 'No se pudo crear la tarjeta de estudio.');
    }
  };

  const updateCardReview: FabroContextValue['updateCardReview'] = async (deckId, cardId, patch) => {
    const path = `flashcardDecks/${deckId}/cards/${cardId}`;
    try {
      await updateDoc(doc(db, 'flashcardDecks', deckId, 'cards', cardId), {
        easeFactor: patch.easeFactor,
        intervalDays: patch.intervalDays,
        repetitions: patch.repetitions,
        nextReviewDate: patch.nextReviewDate,
        lastResult: patch.lastResult,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteCard: FabroContextValue['deleteCard'] = async (deckId, cardId, currentCount) => {
    const path = `flashcardDecks/${deckId}/cards/${cardId}`;
    try {
      await deleteDoc(doc(db, 'flashcardDecks', deckId, 'cards', cardId));
      await updateDoc(doc(db, 'flashcardDecks', deckId), {
        cardCount: Math.max(0, currentCount - 1),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const logStudySession: FabroContextValue['logStudySession'] = async (data) => {
    if (!user) return;
    const id = makeSafeId('ses');
    const path = `studySessions/${id}`;
    try {
      await setDoc(doc(db, 'studySessions', id), {
        id,
        userId: user.uid,
        subjectId: data.subjectId.slice(0, 128),
        activityType: data.activityType,
        durationMinutes: Math.max(1, Math.min(600, Math.round(data.durationMinutes))),
        topic: data.topic.slice(0, 200),
        date: data.date.slice(0, 30),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const saveAIChatThread: FabroContextValue['saveAIChatThread'] = async (id, data) => {
    if (!user) throw new Error('No autenticado');
    const threadId = id || makeSafeId('chat');
    const path = `aiChats/${threadId}`;
    try {
      if (!id) {
        await setDoc(doc(db, 'aiChats', threadId), {
          id: threadId,
          userId: user.uid,
          subjectId: data.subjectId.slice(0, 128),
          title: data.title.trim().slice(0, 200) || 'Consulta con FABRO AI',
          mode: data.mode,
          selectedDocIds: data.selectedDocIds.slice(0, 10),
          messages: data.messages.slice(-60),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'aiChats', threadId), {
          title: data.title.trim().slice(0, 200) || 'Consulta con FABRO AI',
          mode: data.mode,
          selectedDocIds: data.selectedDocIds.slice(0, 10),
          messages: data.messages.slice(-60),
          updatedAt: serverTimestamp(),
        });
      }
      return threadId;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const deleteAIChatThread: FabroContextValue['deleteAIChatThread'] = async (id) => {
    const path = `aiChats/${id}`;
    try {
      await deleteDoc(doc(db, 'aiChats', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // ------------------------------------------------------------------
  // Books & Chapters CRUD
  // ------------------------------------------------------------------
  const createBook: FabroContextValue['createBook'] = async (data) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('book');
    const path = `books/${id}`;
    try {
      await setDoc(doc(db, 'books', id), {
        id,
        userId: user.uid,
        subjectId: (data.subjectId || '').slice(0, 128),
        title: (data.title.trim() || 'Libro sin título').slice(0, 200),
        subtitle: (data.subtitle || '').slice(0, 300),
        authorName: (data.authorName || profile?.displayName || 'Autor').slice(0, 120),
        genre: data.genre,
        language: (data.language || 'Español').slice(0, 40),
        synopsis: (data.synopsis || '').slice(0, 4000),
        targetWords: Math.max(100, Math.min(500000, Math.round(Number(data.targetWords) || 20000))),
        coverColor: /^#[0-9a-fA-F]{6}$/.test(data.coverColor) ? data.coverColor : '#0284C7',
        dedication: (data.dedication || '').slice(0, 1500),
        bibliography: (data.bibliography || '').slice(0, 10000),
        status: data.status || 'borrador',
        chaptersCount: 0,
        totalWords: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (err) {
      return surfaceFirestoreError(err, OperationType.CREATE, path, 'No se pudo crear el libro.');
    }
  };

  const updateBook: FabroContextValue['updateBook'] = async (id, patch) => {
    const path = `books/${id}`;
    try {
      await updateDoc(doc(db, 'books', id), {
        ...(patch.subjectId !== undefined ? { subjectId: patch.subjectId.slice(0, 128) } : {}),
        ...(patch.title !== undefined ? { title: (patch.title.trim() || 'Libro sin título').slice(0, 200) } : {}),
        ...(patch.subtitle !== undefined ? { subtitle: patch.subtitle.slice(0, 300) } : {}),
        ...(patch.authorName !== undefined ? { authorName: patch.authorName.slice(0, 120) } : {}),
        ...(patch.genre !== undefined ? { genre: patch.genre } : {}),
        ...(patch.language !== undefined ? { language: patch.language.slice(0, 40) } : {}),
        ...(patch.synopsis !== undefined ? { synopsis: patch.synopsis.slice(0, 4000) } : {}),
        ...(patch.targetWords !== undefined
          ? { targetWords: Math.max(100, Math.min(500000, Math.round(Number(patch.targetWords) || 20000))) }
          : {}),
        ...(patch.coverColor !== undefined && /^#[0-9a-fA-F]{6}$/.test(patch.coverColor)
          ? { coverColor: patch.coverColor }
          : {}),
        ...(patch.dedication !== undefined ? { dedication: patch.dedication.slice(0, 1500) } : {}),
        ...(patch.bibliography !== undefined ? { bibliography: patch.bibliography.slice(0, 10000) } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteBook: FabroContextValue['deleteBook'] = async (id) => {
    const path = `books/${id}`;
    try {
      await deleteDoc(doc(db, 'books', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const subscribeBookChapters: FabroContextValue['subscribeBookChapters'] = useCallback(
    (bookId, onChange) => {
      if (!user || !bookId) return () => {};
      const path = `books/${bookId}/chapters`;
      const q = query(collection(db, 'books', bookId, 'chapters'), where('userId', '==', user.uid));
      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => d.data() as BookChapter)
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
          onChange(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, path)
      );
    },
    [user]
  );

  const createBookChapter: FabroContextValue['createBookChapter'] = async (bookId, data) => {
    if (!user) throw new Error('No autenticado');
    const id = makeSafeId('chap');
    const path = `books/${bookId}/chapters/${id}`;
    try {
      await setDoc(doc(db, 'books', bookId, 'chapters', id), {
        id,
        userId: user.uid,
        bookId,
        orderIndex: Math.max(0, Math.min(500, Math.round(data.orderIndex))),
        title: (data.title.trim() || 'Capítulo sin título').slice(0, 200),
        summary: (data.summary || '').slice(0, 1000),
        notes: (data.notes || '').slice(0, 5000),
        contentHtml: (data.contentHtml || '').slice(0, 300000),
        contentText: (data.contentText || '').slice(0, 300000),
        wordCount: Math.max(0, Math.min(500000, Math.round(data.wordCount || 0))),
        status: data.status || 'borrador',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    } catch (err) {
      return surfaceFirestoreError(err, OperationType.CREATE, path, 'No se pudo crear el capítulo.');
    }
  };

  const updateBookChapter: FabroContextValue['updateBookChapter'] = async (bookId, chapterId, patch) => {
    const path = `books/${bookId}/chapters/${chapterId}`;
    try {
      await updateDoc(doc(db, 'books', bookId, 'chapters', chapterId), {
        ...(patch.title !== undefined ? { title: (patch.title.trim() || 'Capítulo sin título').slice(0, 200) } : {}),
        ...(patch.summary !== undefined ? { summary: patch.summary.slice(0, 1000) } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 5000) } : {}),
        ...(patch.contentHtml !== undefined ? { contentHtml: patch.contentHtml.slice(0, 300000) } : {}),
        ...(patch.contentText !== undefined ? { contentText: patch.contentText.slice(0, 300000) } : {}),
        ...(patch.wordCount !== undefined
          ? { wordCount: Math.max(0, Math.min(500000, Math.round(patch.wordCount))) }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const reorderBookChapters: FabroContextValue['reorderBookChapters'] = async (bookId, orderedChapterIds) => {
    try {
      await Promise.all(
        orderedChapterIds.map((chapId, idx) =>
          updateDoc(doc(db, 'books', bookId, 'chapters', chapId), {
            orderIndex: idx,
            updatedAt: serverTimestamp(),
          })
        )
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `books/${bookId}/chapters`);
    }
  };

  const deleteBookChapter: FabroContextValue['deleteBookChapter'] = async (bookId, chapterId) => {
    const path = `books/${bookId}/chapters/${chapterId}`;
    try {
      await deleteDoc(doc(db, 'books', bookId, 'chapters', chapterId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const syncBookMetrics: FabroContextValue['syncBookMetrics'] = useCallback(
    async (bookId, chaptersCount, totalWords) => {
      const path = `books/${bookId}`;
      try {
        await updateDoc(doc(db, 'books', bookId), {
          chaptersCount: Math.max(0, Math.min(200, Math.round(chaptersCount))),
          totalWords: Math.max(0, Math.min(2000000, Math.round(totalWords))),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    []
  );

  const saveDictionaryEntry: FabroContextValue['saveDictionaryEntry'] = useCallback(
    async (data) => {
      if (!user) throw new Error('No autenticado');
      const normalizedTerm = data.term
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .slice(0, 160);

      const existing = dictionaryEntries.find((e) => e.normalizedTerm === normalizedTerm);
      if (existing) {
        const path = `dictionaryEntries/${existing.id}`;
        try {
          await updateDoc(doc(db, 'dictionaryEntries', existing.id), {
            subjectId: (data.subjectId || existing.subjectId || '').slice(0, 128),
            term: data.term.trim().slice(0, 160),
            normalizedTerm,
            category: (data.category || existing.category || '').slice(0, 80),
            phonetic: (data.phonetic ?? existing.phonetic ?? '').slice(0, 120),
            definition: data.definition.trim().slice(0, 4000),
            academicDefinition: (data.academicDefinition ?? existing.academicDefinition ?? '').slice(0, 6000),
            examples: data.examples.slice(0, 10).map((ex) => ex.slice(0, 800)),
            synonyms: data.synonyms.slice(0, 20).map((s) => s.slice(0, 120)),
            etymology: (data.etymology ?? existing.etymology ?? '').slice(0, 1500),
            personalNotes: (data.personalNotes ?? existing.personalNotes ?? '').slice(0, 4000),
            favorite: data.favorite ?? existing.favorite,
            lookupCount: Math.min(100000, (existing.lookupCount || 1) + 1),
            updatedAt: serverTimestamp(),
          });
          return existing.id;
        } catch (err) {
          return surfaceFirestoreError(err, OperationType.UPDATE, path, 'No se pudo actualizar el término en el diccionario.');
        }
      }

      const id = makeSafeId('dict');
      const path = `dictionaryEntries/${id}`;
      try {
        await setDoc(doc(db, 'dictionaryEntries', id), {
          id,
          userId: user.uid,
          subjectId: (data.subjectId || '').slice(0, 128),
          term: data.term.trim().slice(0, 160),
          normalizedTerm,
          category: (data.category || 'Concepto').slice(0, 80),
          phonetic: (data.phonetic || '').slice(0, 120),
          definition: data.definition.trim().slice(0, 4000),
          academicDefinition: (data.academicDefinition || '').slice(0, 6000),
          examples: data.examples.slice(0, 10).map((ex) => ex.slice(0, 800)),
          synonyms: data.synonyms.slice(0, 20).map((s) => s.slice(0, 120)),
          etymology: (data.etymology || '').slice(0, 1500),
          personalNotes: (data.personalNotes || '').slice(0, 4000),
          favorite: Boolean(data.favorite),
          lookupCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return id;
      } catch (err) {
        return surfaceFirestoreError(err, OperationType.CREATE, path, 'No se pudo guardar el término en tu diccionario.');
      }
    },
    [dictionaryEntries, surfaceFirestoreError, user]
  );

  const updateDictionaryEntry: FabroContextValue['updateDictionaryEntry'] = useCallback(
    async (id, patch) => {
      const path = `dictionaryEntries/${id}`;
      try {
        await updateDoc(doc(db, 'dictionaryEntries', id), {
          ...(patch.favorite !== undefined ? { favorite: Boolean(patch.favorite) } : {}),
          ...(patch.personalNotes !== undefined ? { personalNotes: patch.personalNotes.slice(0, 4000) } : {}),
          ...(patch.lookupCount !== undefined
            ? { lookupCount: Math.max(1, Math.min(100000, Math.round(patch.lookupCount))) }
            : {}),
          ...(patch.subjectId !== undefined ? { subjectId: patch.subjectId.slice(0, 128) } : {}),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        surfaceFirestoreError(err, OperationType.UPDATE, path, 'No se pudo actualizar la entrada del diccionario.');
      }
    },
    [surfaceFirestoreError]
  );

  const deleteDictionaryEntry: FabroContextValue['deleteDictionaryEntry'] = useCallback(
    async (id) => {
      const path = `dictionaryEntries/${id}`;
      try {
        await deleteDoc(doc(db, 'dictionaryEntries', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    []
  );

  const persistHubState = useCallback(
    async (nextState: HubUserState) => {
      if (!user) return;
      const sanitized: HubUserState = {
        userId: user.uid,
        favorites: nextState.favorites.slice(0, 150).map((f) => String(f).slice(0, 128)),
        history: nextState.history.slice(0, 40).map((h) => ({
          id: String(h.id || makeSafeId('hubh')).slice(0, 128),
          toolId: String(h.toolId).slice(0, 128),
          toolName: String(h.toolName).slice(0, 160),
          category: String(h.category || '').slice(0, 100),
          officialUrl: String(h.officialUrl).slice(0, 2000),
          action: h.action || 'opened',
          visitedAt: String(h.visitedAt || new Date().toISOString()).slice(0, 40),
        })),
        customTools: nextState.customTools.slice(0, 50).map((t) => ({
          ...t,
          id: String(t.id).slice(0, 128),
          name: String(t.name).trim().slice(0, 120) || 'Herramienta',
          shortCode: String(t.shortCode || t.name.slice(0, 3) || 'IA').toUpperCase().slice(0, 6),
          accentColor: /^#[0-9a-fA-F]{6}$/.test(t.accentColor) ? t.accentColor : '#06B6D4',
          description: String(t.description || '').slice(0, 500),
          officialUrl: String(t.officialUrl).trim().slice(0, 2000),
          serviceType: String(t.serviceType || 'Plataforma web').slice(0, 120),
          pricingSummary: String(t.pricingSummary || '').slice(0, 300),
          capabilities: (t.capabilities || []).slice(0, 8).map((c) => String(c).slice(0, 120)),
          educationalUse: String(t.educationalUse || '').slice(0, 300),
          tags: (t.tags || []).slice(0, 12).map((tg) => String(tg).slice(0, 50)),
          active: Boolean(t.active),
        })),
        disabledToolIds: nextState.disabledToolIds.slice(0, 150).map((id) => String(id).slice(0, 128)),
      };

      setHubState(sanitized);
      try {
        localStorage.setItem(`fabro-hub-${user.uid}`, JSON.stringify(sanitized));
      } catch {
        // ignore storage quota errors
      }

      const path = `hubStates/${user.uid}`;
      try {
        await setDoc(doc(db, 'hubStates', user.uid), {
          ...sanitized,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        if (!navigator.onLine) return;
        surfaceFirestoreError(err, OperationType.WRITE, path, 'No se pudo sincronizar FABRO HUB con Firebase.');
      }
    },
    [surfaceFirestoreError, user]
  );

  const toggleHubFavorite: FabroContextValue['toggleHubFavorite'] = useCallback(
    async (toolId) => {
      if (!user) return;
      const current = hubStateRef.current;
      const exists = current.favorites.includes(toolId);
      const nextFavs = exists
        ? current.favorites.filter((id) => id !== toolId)
        : [toolId, ...current.favorites];
      await persistHubState({ ...current, userId: user.uid, favorites: nextFavs });
    },
    [persistHubState, user]
  );

  const logHubHistory: FabroContextValue['logHubHistory'] = useCallback(
    async (entry) => {
      if (!user) return;
      const current = hubStateRef.current;
      const nextItem: HubHistoryItem = {
        ...entry,
        id: makeSafeId('hubh'),
        visitedAt: new Date().toISOString(),
      };
      const nextHistory = [
        nextItem,
        ...current.history.filter((h) => !(h.toolId === entry.toolId && h.action === entry.action)),
      ].slice(0, 40);
      await persistHubState({ ...current, userId: user.uid, history: nextHistory });
    },
    [persistHubState, user]
  );

  const clearHubHistory: FabroContextValue['clearHubHistory'] = useCallback(async () => {
    if (!user) return;
    const current = hubStateRef.current;
    await persistHubState({ ...current, userId: user.uid, history: [] });
  }, [persistHubState, user]);

  const upsertCustomHubTool: FabroContextValue['upsertCustomHubTool'] = useCallback(
    async (tool) => {
      if (!user) return;
      const current = hubStateRef.current;
      const exists = current.customTools.some((t) => t.id === tool.id);
      const nextTools = exists
        ? current.customTools.map((t) => (t.id === tool.id ? tool : t))
        : [tool, ...current.customTools];
      await persistHubState({ ...current, userId: user.uid, customTools: nextTools });
    },
    [persistHubState, user]
  );

  const deleteCustomHubTool: FabroContextValue['deleteCustomHubTool'] = useCallback(
    async (toolId) => {
      if (!user) return;
      const current = hubStateRef.current;
      await persistHubState({
        ...current,
        userId: user.uid,
        customTools: current.customTools.filter((t) => t.id !== toolId),
        favorites: current.favorites.filter((f) => f !== toolId),
      });
    },
    [persistHubState, user]
  );

  const toggleHubToolActive: FabroContextValue['toggleHubToolActive'] = useCallback(
    async (toolId, active) => {
      if (!user) return;
      const current = hubStateRef.current;
      const isCustom = current.customTools.some((t) => t.id === toolId);
      if (isCustom) {
        await persistHubState({
          ...current,
          userId: user.uid,
          customTools: current.customTools.map((t) => (t.id === toolId ? { ...t, active } : t)),
        });
      } else {
        const nextDisabled = active
          ? current.disabledToolIds.filter((id) => id !== toolId)
          : Array.from(new Set([...current.disabledToolIds, toolId]));
        await persistHubState({
          ...current,
          userId: user.uid,
          disabledToolIds: nextDisabled,
        });
      }
    },
    [persistHubState, user]
  );

  const getMemoryForSubject: FabroContextValue['getMemoryForSubject'] = useCallback(
    (subjectId) => {
      const targetSub = subjectId || '';
      return subjectMemoriesRef.current.find((m) => (m.subjectId || '') === targetSub) || null;
    },
    []
  );

  const upsertSubjectMemory: FabroContextValue['upsertSubjectMemory'] = useCallback(
    async (subjectId, update) => {
      if (!user) return;
      const targetSubjectId = (subjectId || '').slice(0, 128);
      const safeUid = user.uid.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 16);
      const safeSub = (targetSubjectId || 'general').replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 80);
      const memoryId = `mem_${safeUid}_${safeSub}`.slice(0, 120);
      const existing = subjectMemoriesRef.current.find(
        (m) => m.id === memoryId || (m.subjectId || '') === targetSubjectId
      );

      const dedupPush = (prev: string[], additions: string[], maxItems: number, maxLen: number) => {
        const cleanAdd = additions.map((x) => String(x || '').trim().slice(0, maxLen)).filter(Boolean);
        return Array.from(new Set([...prev, ...cleanAdd])).slice(-maxItems);
      };

      const nextDevelopedTopics = dedupPush(
        existing?.developedTopics || [],
        update.developedTopic ? [update.developedTopic] : [],
        80,
        200
      );
      const nextPriorSummaries = dedupPush(
        existing?.priorSummaries || [],
        update.summarySnippet ? [update.summarySnippet] : [],
        60,
        1000
      );
      const nextExamQuestions = dedupPush(
        existing?.examQuestionsHistory || [],
        update.examQuestions || [],
        100,
        500
      );
      const nextBib = dedupPush(
        existing?.verifiedBibliography || [],
        update.verifiedBibliography || [],
        80,
        500
      );
      const nextAuthors = dedupPush(
        existing?.authorsAndTheories || [],
        update.authorsAndTheories || [],
        80,
        300
      );
      const nextProgressNotes =
        update.studentProgressNotes !== undefined
          ? String(update.studentProgressNotes).slice(0, 10000)
          : existing?.studentProgressNotes || '';

      const path = `subjectMemories/${existing?.id || memoryId}`;
      try {
        if (existing) {
          await updateDoc(doc(db, 'subjectMemories', existing.id), {
            developedTopics: nextDevelopedTopics,
            priorSummaries: nextPriorSummaries,
            examQuestionsHistory: nextExamQuestions,
            verifiedBibliography: nextBib,
            authorsAndTheories: nextAuthors,
            studentProgressNotes: nextProgressNotes,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'subjectMemories', memoryId), {
            id: memoryId,
            userId: user.uid,
            subjectId: targetSubjectId,
            developedTopics: nextDevelopedTopics,
            priorSummaries: nextPriorSummaries,
            examQuestionsHistory: nextExamQuestions,
            verifiedBibliography: nextBib,
            authorsAndTheories: nextAuthors,
            studentProgressNotes: nextProgressNotes,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        if (!navigator.onLine) return;
        surfaceFirestoreError(err, OperationType.WRITE, path, 'No se pudo actualizar la memoria académica de la materia.');
      }
    },
    [surfaceFirestoreError, user]
  );

  return (
    <FabroContext.Provider
      value={{
        user,
        authReady,
        profile,
        dataLoading,
        activeSection,
        setActiveSection,
        selectedSubjectId,
        setSelectedSubjectId,
        aiDraftPrompt,
        setAiDraftPrompt,
        theme,
        toggleTheme,
        setThemeMode,
        colorTemplate,
        setColorTemplate,
        refreshUserVerification,
        logout,
        actionError,
        clearActionError,
        subjects,
        notes,
        libraryDocs,
        exams,
        calendarEvents,
        decks,
        studySessions,
        aiChats,
        updateStudentProfile,
        uploadProfilePhoto,
        removeGalleryPhoto,
        createSubject,
        updateSubject,
        uploadSubjectSyllabusFile,
        deleteSubject,
        createNote,
        updateNote,
        deleteNote,
        uploadLibraryDocument,
        updateLibraryDoc,
        deleteLibraryDoc,
        createExam,
        updateExamProgress,
        completeExam,
        deleteExam,
        createCalendarEvent,
        updateCalendarEvent,
        deleteCalendarEvent,
        createDeck,
        deleteDeck,
        createCard,
        updateCardReview,
        deleteCard,
        logStudySession,
        saveAIChatThread,
        deleteAIChatThread,
        books,
        createBook,
        updateBook,
        deleteBook,
        subscribeBookChapters,
        createBookChapter,
        updateBookChapter,
        reorderBookChapters,
        deleteBookChapter,
        syncBookMetrics,
        dictionaryEntries,
        saveDictionaryEntry,
        updateDictionaryEntry,
        deleteDictionaryEntry,
        hubState,
        toggleHubFavorite,
        logHubHistory,
        clearHubHistory,
        upsertCustomHubTool,
        deleteCustomHubTool,
        toggleHubToolActive,
        subjectMemories,
        getMemoryForSubject,
        upsertSubjectMemory,
        isOnline,
        recentNoteIds,
        recentDocIds,
        precacheState,
        markNoteAccessed,
        markLibraryDocAccessed,
        precacheStudyDataNow,
        syncPendingOfflineChanges,
      }}
    >
      {children}
    </FabroContext.Provider>
  );
};

export function useFabro() {
  const ctx = useContext(FabroContext);
  if (!ctx) throw new Error('useFabro debe usarse dentro de FabroProvider');
  return ctx;
}
