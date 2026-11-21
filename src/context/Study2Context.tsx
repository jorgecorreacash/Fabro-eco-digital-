import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { vaultGet, vaultSetIdbOnly } from '../services/localVault';
import {
  deleteStudyFileBlob,
  extractTextFromStudyFile,
  saveStudyFileBlob,
} from '../services/study2FileExtractor';
import {
  DEFAULT_CALENDAR_CATEGORIES,
  DEFAULT_CALENDAR_PREFERENCES,
  migrateLegacyPaintedEvents,
  upsertCalendarEventForEvaluation,
} from '../services/unifiedCalendarService';
import type {
  CalendarCategoryConfig,
  CalendarPreferences,
  FabroAiSessionTurn,
  Study2NavId,
  Study2WorkspaceSnapshot,
  StudyAiHandoff,
  StudyBibliographyItem,
  StudyComparativeTable,
  StudyConceptMap,
  StudyEvaluation,
  StudyFlashcardItem,
  StudyLibraryFileMeta,
  StudyLibraryFolder,
  StudyQuizSet,
  StudySubject,
  StudyTaskItem,
  StudyTimelineEntry,
  UnifiedCalendarEvent,
} from '../types/study2';
import { useEcosystem } from './EcosystemContext';

export function createEmptyStudy2Snapshot(): Study2WorkspaceSnapshot {
  return {
    version: 2,
    subjects: [], // STRICT: zero forced default subjects
    tasks: [],
    bibliography: [],
    libraryFolders: [],
    libraryFiles: [],
    calendarCategories: DEFAULT_CALENDAR_CATEGORIES,
    calendarEvents: [],
    calendarPreferences: DEFAULT_CALENDAR_PREFERENCES,
    evaluations: [],
    aiHistory: [],
    conceptMaps: [],
    quizSets: [],
    flashcards: [],
    timelineEntries: [],
    comparativeTables: [],
    noteMetadata: {},
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeSnapshot(raw: unknown): Study2WorkspaceSnapshot {
  const base = createEmptyStudy2Snapshot();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Partial<Study2WorkspaceSnapshot>;
  return {
    ...base,
    version: 2,
    subjects: Array.isArray(obj.subjects) ? obj.subjects : [],
    tasks: Array.isArray(obj.tasks) ? obj.tasks : [],
    bibliography: Array.isArray(obj.bibliography) ? obj.bibliography : [],
    libraryFolders: Array.isArray(obj.libraryFolders) ? obj.libraryFolders : [],
    libraryFiles: Array.isArray(obj.libraryFiles) ? obj.libraryFiles : [],
    calendarCategories:
      Array.isArray(obj.calendarCategories) && obj.calendarCategories.length > 0
        ? obj.calendarCategories
        : DEFAULT_CALENDAR_CATEGORIES,
    calendarEvents: Array.isArray(obj.calendarEvents) ? obj.calendarEvents : [],
    calendarPreferences:
      obj.calendarPreferences && typeof obj.calendarPreferences === 'object'
        ? { ...DEFAULT_CALENDAR_PREFERENCES, ...obj.calendarPreferences }
        : DEFAULT_CALENDAR_PREFERENCES,
    evaluations: Array.isArray(obj.evaluations) ? obj.evaluations : [],
    aiHistory: Array.isArray(obj.aiHistory) ? obj.aiHistory : [],
    conceptMaps: Array.isArray(obj.conceptMaps) ? obj.conceptMaps : [],
    quizSets: Array.isArray(obj.quizSets) ? obj.quizSets : [],
    flashcards: Array.isArray(obj.flashcards) ? obj.flashcards : [],
    timelineEntries: Array.isArray(obj.timelineEntries) ? obj.timelineEntries : [],
    comparativeTables: Array.isArray(obj.comparativeTables) ? obj.comparativeTables : [],
    noteMetadata:
      obj.noteMetadata && typeof obj.noteMetadata === 'object' ? obj.noteMetadata : {},
    lastActiveSubjectId:
      typeof obj.lastActiveSubjectId === 'string' ? obj.lastActiveSubjectId : undefined,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
  };
}

/**
 * Strips heavy text payloads before storing workspace snapshot in Firestore
 * so the document stays compact well below Firestore's 1 MiB limit and $0 tier.
 */
function buildCloudSafeSnapshotJson(snapshot: Study2WorkspaceSnapshot): string {
  const compact: Study2WorkspaceSnapshot = {
    ...snapshot,
    libraryFiles: snapshot.libraryFiles.map((f) => ({
      ...f,
      extractedText: f.extractedText.slice(0, 6000),
    })),
    aiHistory: snapshot.aiHistory.slice(-25).map((t) => ({
      ...t,
      content: t.content.slice(0, 8000),
    })),
  };
  return JSON.stringify(compact);
}

interface Study2ContextValue {
  ownerUid: string;
  hydrated: boolean;
  cloudSyncNote: string | null;
  snapshot: Study2WorkspaceSnapshot;
  activeNav: Study2NavId;
  setActiveNav: (nav: Study2NavId) => void;
  selectedSubjectId: string | null;
  setSelectedSubjectId: (id: string | null) => void;

  // Subjects
  createSubject: (
    payload: Omit<
      StudySubject,
      'id' | 'units' | 'archived' | 'orderIndex' | 'createdAt' | 'updatedAt'
    >
  ) => StudySubject;
  updateSubject: (id: string, patch: Partial<StudySubject>) => void;
  deleteSubject: (id: string) => void;
  toggleArchiveSubject: (id: string) => void;
  moveSubjectOrder: (id: string, direction: 'up' | 'down') => void;
  addSubjectUnit: (subjectId: string, title: string, description?: string) => void;
  deleteSubjectUnit: (subjectId: string, unitId: string) => void;
  addUnitTopic: (subjectId: string, unitId: string, title: string) => void;
  toggleUnitTopic: (subjectId: string, unitId: string, topicId: string) => void;
  deleteUnitTopic: (subjectId: string, unitId: string, topicId: string) => void;

  // Tasks
  createTask: (
    payload: Omit<StudyTaskItem, 'id' | 'completed' | 'createdAt'>
  ) => StudyTaskItem;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;

  // Bibliography
  addBibliographyItem: (item: Omit<StudyBibliographyItem, 'id'>) => void;
  deleteBibliographyItem: (id: string) => void;

  // Real File Library
  createLibraryFolder: (name: string, parentId: string | null, subjectId?: string) => void;
  deleteLibraryFolder: (folderId: string) => void;
  uploadLibraryFile: (
    file: File,
    opts?: { folderId?: string | null; subjectId?: string; tags?: string[]; runImageOcr?: boolean }
  ) => Promise<StudyLibraryFileMeta>;
  updateLibraryFileMeta: (id: string, patch: Partial<StudyLibraryFileMeta>) => void;
  deleteLibraryFile: (id: string) => Promise<void>;

  // Unified Shift-Style Calendar
  addCalendarEvent: (
    payload: Omit<UnifiedCalendarEvent, 'id' | 'createdAt' | 'updatedAt'>
  ) => UnifiedCalendarEvent;
  updateCalendarEvent: (id: string, patch: Partial<UnifiedCalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  toggleCalendarEventCompleted: (id: string) => void;
  upsertCalendarCategory: (category: CalendarCategoryConfig) => void;
  deleteCalendarCategory: (id: string) => void;
  moveCalendarCategoryPriority: (id: string, direction: 'up' | 'down') => void;
  resetCalendarCategories: () => void;
  updateCalendarPreferences: (patch: Partial<CalendarPreferences>) => void;

  // Evaluations (auto-synced with Unified Calendar)
  createEvaluation: (
    payload: Omit<StudyEvaluation, 'id' | 'calendarEventId' | 'createdAt' | 'updatedAt'>
  ) => StudyEvaluation;
  updateEvaluation: (id: string, patch: Partial<StudyEvaluation>) => void;
  deleteEvaluation: (id: string) => void;

  // Notes metadata (links EcosystemContext.advancedNotes to Study2 subjects/units/files)
  updateNoteMeta: (
    noteId: string,
    patch: Partial<{
      subjectId?: string;
      unit?: string;
      topic?: string;
      favorite?: boolean;
      attachmentFileIds?: string[];
    }>
  ) => void;

  // FABRO IA Studio handoff & history
  aiHandoff: StudyAiHandoff | null;
  sendToFabroAi: (handoff: StudyAiHandoff) => void;
  clearAiHandoff: () => void;
  appendAiTurn: (turn: FabroAiSessionTurn) => void;
  clearAiHistory: () => void;

  // Educational Tools persistence
  saveConceptMap: (map: StudyConceptMap) => void;
  deleteConceptMap: (id: string) => void;
  saveQuizSet: (set: StudyQuizSet) => void;
  deleteQuizSet: (id: string) => void;
  upsertFlashcard: (card: StudyFlashcardItem) => void;
  deleteFlashcard: (id: string) => void;
  addTimelineEntry: (entry: Omit<StudyTimelineEntry, 'id'>) => void;
  deleteTimelineEntry: (id: string) => void;
  saveComparativeTable: (table: StudyComparativeTable) => void;
  deleteComparativeTable: (id: string) => void;
}

const Study2Context = createContext<Study2ContextValue | null>(null);

export const Study2Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authUser, authState, paintedCalendarEvents } = useEcosystem();
  const ownerUid = authUser?.uid || 'guest';
  const vaultKey = `study2_workspace::${ownerUid}`;

  const [snapshot, setSnapshot] = useState<Study2WorkspaceSnapshot>(() =>
    createEmptyStudy2Snapshot()
  );
  const [hydrated, setHydrated] = useState(false);
  const [cloudSyncNote, setCloudSyncNote] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<Study2NavId>('inicio');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [aiHandoff, setAiHandoff] = useState<StudyAiHandoff | null>(null);

  const cloudSyncTimerRef = useRef<number | null>(null);
  const legacyEventsRef = useRef(paintedCalendarEvents);
  legacyEventsRef.current = paintedCalendarEvents;

  // Hydrate strictly per user UID (IndexedDB first, then Firestore if authenticated)
  useEffect(() => {
    let active = true;
    setHydrated(false);
    setSelectedSubjectId(null);

    const hydrate = async () => {
      const localRaw = await vaultGet<Study2WorkspaceSnapshot | null>(vaultKey, null);
      let resolved = localRaw ? sanitizeSnapshot(localRaw) : createEmptyStudy2Snapshot();

      // Migrate legacy painted calendar events non-destructively only if calendar is empty
      if (
        !localRaw &&
        resolved.calendarEvents.length === 0 &&
        legacyEventsRef.current.length > 0
      ) {
        resolved = {
          ...resolved,
          calendarEvents: migrateLegacyPaintedEvents(legacyEventsRef.current),
        };
      }

      // If authenticated with Firebase, merge with user's private Firestore study workspace
      if (authUser?.uid && authState === 'AUTHENTICATED') {
        try {
          const ref = doc(db, 'users', authUser.uid, 'study', 'workspace');
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const data = snap.data() as { payloadJson?: string; updatedAtIso?: string };
            if (typeof data.payloadJson === 'string' && data.payloadJson.trim()) {
              const cloudParsed = sanitizeSnapshot(JSON.parse(data.payloadJson));
              const localTs = Date.parse(resolved.updatedAt || '1970-01-01');
              const cloudTs = Date.parse(
                data.updatedAtIso || cloudParsed.updatedAt || '1970-01-01'
              );
              if (!localRaw || cloudTs > localTs) {
                // Preserve hasLocalBlob flags from local device
                const localBlobIds = new Set(
                  resolved.libraryFiles.filter((f) => f.hasLocalBlob).map((f) => f.id)
                );
                resolved = {
                  ...cloudParsed,
                  libraryFiles: cloudParsed.libraryFiles.map((f) => ({
                    ...f,
                    hasLocalBlob: localBlobIds.has(f.id),
                  })),
                };
                await vaultSetIdbOnly(vaultKey, resolved);
              }
            }
          }
          if (active) setCloudSyncNote('Sincronizado con tu cuenta');
        } catch {
          if (active) setCloudSyncNote('Guardado localmente (nube no disponible)');
        }
      } else {
        if (active) setCloudSyncNote('Guardado localmente en este dispositivo');
      }

      if (active) {
        setSnapshot(resolved);
        setHydrated(true);
      }
    };

    void hydrate();
    return () => {
      active = false;
    };
  }, [authState, authUser?.uid, vaultKey]);

  const scheduleCloudSync = useCallback(
    (nextSnap: Study2WorkspaceSnapshot) => {
      if (!authUser?.uid || authState !== 'AUTHENTICATED') return;
      if (cloudSyncTimerRef.current) {
        window.clearTimeout(cloudSyncTimerRef.current);
      }
      cloudSyncTimerRef.current = window.setTimeout(async () => {
        try {
          const payloadJson = buildCloudSafeSnapshotJson(nextSnap);
          if (payloadJson.length > 850_000) {
            setCloudSyncNote('Guardado local (tamaño excede límite de respaldo rápido)');
            return;
          }
          const ref = doc(db, 'users', authUser.uid, 'study', 'workspace');
          await setDoc(
            ref,
            {
              userId: authUser.uid,
              version: 2,
              payloadJson,
              updatedAtIso: nextSnap.updatedAt,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          setCloudSyncNote('Sincronizado con tu cuenta');
        } catch {
          setCloudSyncNote('Guardado local (sin conexión a la nube)');
        }
      }, 900);
    },
    [authState, authUser?.uid]
  );

  const commitSnapshot = useCallback(
    (updater: (prev: Study2WorkspaceSnapshot) => Study2WorkspaceSnapshot) => {
      setSnapshot((prev) => {
        const next: Study2WorkspaceSnapshot = {
          ...updater(prev),
          updatedAt: new Date().toISOString(),
        };
        void vaultSetIdbOnly(vaultKey, next);
        scheduleCloudSync(next);
        return next;
      });
    },
    [scheduleCloudSync, vaultKey]
  );

  // ---- SUBJECTS ----
  const createSubject: Study2ContextValue['createSubject'] = useCallback(
    (payload) => {
      const now = new Date().toISOString();
      const created: StudySubject = {
        ...payload,
        id: `subj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        units: [],
        archived: false,
        orderIndex: snapshot.subjects.length,
        createdAt: now,
        updatedAt: now,
      };
      commitSnapshot((prev) => ({
        ...prev,
        subjects: [...prev.subjects, created],
        lastActiveSubjectId: created.id,
      }));
      return created;
    },
    [commitSnapshot, snapshot.subjects.length]
  );

  const updateSubject: Study2ContextValue['updateSubject'] = useCallback(
    (id, patch) => {
      commitSnapshot((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s
        ),
      }));
    },
    [commitSnapshot]
  );

  const deleteSubject: Study2ContextValue['deleteSubject'] = useCallback(
    (id) => {
      commitSnapshot((prev) => ({
        ...prev,
        subjects: prev.subjects.filter((s) => s.id !== id),
        tasks: prev.tasks.map((t) => (t.subjectId === id ? { ...t, subjectId: undefined } : t)),
        lastActiveSubjectId: prev.lastActiveSubjectId === id ? undefined : prev.lastActiveSubjectId,
      }));
      setSelectedSubjectId((cur) => (cur === id ? null : cur));
    },
    [commitSnapshot]
  );

  const toggleArchiveSubject = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === id ? { ...s, archived: !s.archived, updatedAt: new Date().toISOString() } : s
        ),
      }));
    },
    [commitSnapshot]
  );

  const moveSubjectOrder = useCallback(
    (id: string, direction: 'up' | 'down') => {
      commitSnapshot((prev) => {
        const list = [...prev.subjects].sort((a, b) => a.orderIndex - b.orderIndex);
        const idx = list.findIndex((s) => s.id === id);
        if (idx === -1) return prev;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= list.length) return prev;
        const copy = [...list];
        const tmp = copy[idx];
        copy[idx] = copy[swapIdx];
        copy[swapIdx] = tmp;
        return {
          ...prev,
          subjects: copy.map((s, orderIndex) => ({ ...s, orderIndex })),
        };
      });
    },
    [commitSnapshot]
  );

  const addSubjectUnit = useCallback(
    (subjectId: string, title: string, description?: string) => {
      const clean = title.trim();
      if (!clean) return;
      commitSnapshot((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: [
                  ...s.units,
                  {
                    id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    title: clean,
                    description: description?.trim() || undefined,
                    topics: [],
                  },
                ],
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));
    },
    [commitSnapshot]
  );

  const deleteSubjectUnit = useCallback(
    (subjectId: string, unitId: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.filter((u) => u.id !== unitId),
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));
    },
    [commitSnapshot]
  );

  const addUnitTopic = useCallback(
    (subjectId: string, unitId: string, title: string) => {
      const clean = title.trim();
      if (!clean) return;
      commitSnapshot((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.map((u) =>
                  u.id === unitId
                    ? {
                        ...u,
                        topics: [
                          ...u.topics,
                          {
                            id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                            title: clean,
                            completed: false,
                          },
                        ],
                      }
                    : u
                ),
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));
    },
    [commitSnapshot]
  );

  const toggleUnitTopic = useCallback(
    (subjectId: string, unitId: string, topicId: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.map((u) =>
                  u.id === unitId
                    ? {
                        ...u,
                        topics: u.topics.map((t) =>
                          t.id === topicId ? { ...t, completed: !t.completed } : t
                        ),
                      }
                    : u
                ),
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));
    },
    [commitSnapshot]
  );

  const deleteUnitTopic = useCallback(
    (subjectId: string, unitId: string, topicId: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        subjects: prev.subjects.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                units: s.units.map((u) =>
                  u.id === unitId
                    ? { ...u, topics: u.topics.filter((t) => t.id !== topicId) }
                    : u
                ),
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));
    },
    [commitSnapshot]
  );

  // ---- TASKS ----
  const createTask: Study2ContextValue['createTask'] = useCallback(
    (payload) => {
      const item: StudyTaskItem = {
        ...payload,
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      commitSnapshot((prev) => ({ ...prev, tasks: [item, ...prev.tasks] }));
      return item;
    },
    [commitSnapshot]
  );

  const toggleTask = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                completed: !t.completed,
                completedAt: !t.completed ? new Date().toISOString() : undefined,
              }
            : t
        ),
      }));
    },
    [commitSnapshot]
  );

  const deleteTask = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
      }));
    },
    [commitSnapshot]
  );

  // ---- BIBLIOGRAPHY ----
  const addBibliographyItem = useCallback(
    (item: Omit<StudyBibliographyItem, 'id'>) => {
      commitSnapshot((prev) => ({
        ...prev,
        bibliography: [
          { ...item, id: `bib-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` },
          ...prev.bibliography,
        ],
      }));
    },
    [commitSnapshot]
  );

  const deleteBibliographyItem = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        bibliography: prev.bibliography.filter((b) => b.id !== id),
      }));
    },
    [commitSnapshot]
  );

  // ---- REAL FILE LIBRARY ----
  const createLibraryFolder = useCallback(
    (name: string, parentId: string | null, subjectId?: string) => {
      const clean = name.trim();
      if (!clean) return;
      const folder: StudyLibraryFolder = {
        id: `fld-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: clean,
        parentId,
        subjectId,
        createdAt: new Date().toISOString(),
      };
      commitSnapshot((prev) => ({
        ...prev,
        libraryFolders: [...prev.libraryFolders, folder],
      }));
    },
    [commitSnapshot]
  );

  const deleteLibraryFolder = useCallback(
    (folderId: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        libraryFolders: prev.libraryFolders.filter(
          (f) => f.id !== folderId && f.parentId !== folderId
        ),
        libraryFiles: prev.libraryFiles.map((file) =>
          file.folderId === folderId ? { ...file, folderId: null } : file
        ),
      }));
    },
    [commitSnapshot]
  );

  const uploadLibraryFile: Study2ContextValue['uploadLibraryFile'] = useCallback(
    async (file, opts) => {
      const fileId = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const mimeType = file.type || 'application/octet-stream';
      const [blobSaved, extraction] = await Promise.all([
        saveStudyFileBlob(ownerUid, fileId, file, { name: file.name, mimeType }),
        extractTextFromStudyFile(file, { runImageOcr: opts?.runImageOcr }),
      ]);

      const now = new Date().toISOString();
      const meta: StudyLibraryFileMeta = {
        id: fileId,
        name: file.name,
        mimeType,
        sizeBytes: file.size,
        folderId: opts?.folderId ?? null,
        subjectId: opts?.subjectId || undefined,
        tags: opts?.tags || [],
        favorite: false,
        extractedText: extraction.text,
        pageCount: extraction.pageCount,
        extractionStatus: extraction.status,
        extractionNote: extraction.note,
        hasLocalBlob: blobSaved,
        createdAt: now,
        updatedAt: now,
      };

      commitSnapshot((prev) => ({
        ...prev,
        libraryFiles: [meta, ...prev.libraryFiles],
      }));
      return meta;
    },
    [commitSnapshot, ownerUid]
  );

  const updateLibraryFileMeta = useCallback(
    (id: string, patch: Partial<StudyLibraryFileMeta>) => {
      commitSnapshot((prev) => ({
        ...prev,
        libraryFiles: prev.libraryFiles.map((f) =>
          f.id === id ? { ...f, ...patch, updatedAt: new Date().toISOString() } : f
        ),
      }));
    },
    [commitSnapshot]
  );

  const deleteLibraryFile = useCallback(
    async (id: string) => {
      await deleteStudyFileBlob(ownerUid, id);
      commitSnapshot((prev) => ({
        ...prev,
        libraryFiles: prev.libraryFiles.filter((f) => f.id !== id),
      }));
    },
    [commitSnapshot, ownerUid]
  );

  // ---- UNIFIED CALENDAR ----
  const addCalendarEvent: Study2ContextValue['addCalendarEvent'] = useCallback(
    (payload) => {
      const now = new Date().toISOString();
      const ev: UnifiedCalendarEvent = {
        ...payload,
        id: `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now,
        updatedAt: now,
      };
      commitSnapshot((prev) => ({
        ...prev,
        calendarEvents: [ev, ...prev.calendarEvents],
      }));
      return ev;
    },
    [commitSnapshot]
  );

  const updateCalendarEvent = useCallback(
    (id: string, patch: Partial<UnifiedCalendarEvent>) => {
      commitSnapshot((prev) => ({
        ...prev,
        calendarEvents: prev.calendarEvents.map((e) =>
          e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
        ),
      }));
    },
    [commitSnapshot]
  );

  const deleteCalendarEvent = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        calendarEvents: prev.calendarEvents.filter((e) => e.id !== id),
      }));
    },
    [commitSnapshot]
  );

  const toggleCalendarEventCompleted = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        calendarEvents: prev.calendarEvents.map((e) =>
          e.id === id
            ? { ...e, completed: !e.completed, updatedAt: new Date().toISOString() }
            : e
        ),
      }));
    },
    [commitSnapshot]
  );

  const upsertCalendarCategory = useCallback(
    (category: CalendarCategoryConfig) => {
      commitSnapshot((prev) => {
        const exists = prev.calendarCategories.some((c) => c.id === category.id);
        return {
          ...prev,
          calendarCategories: exists
            ? prev.calendarCategories.map((c) => (c.id === category.id ? category : c))
            : [...prev.calendarCategories, category],
        };
      });
    },
    [commitSnapshot]
  );

  const deleteCalendarCategory = useCallback(
    (id: string) => {
      commitSnapshot((prev) => {
        if (prev.calendarCategories.length <= 1) return prev;
        const remaining = prev.calendarCategories.filter((c) => c.id !== id);
        const fallbackId = remaining[0].id;
        return {
          ...prev,
          calendarCategories: remaining,
          calendarEvents: prev.calendarEvents.map((e) =>
            e.categoryId === id ? { ...e, categoryId: fallbackId } : e
          ),
        };
      });
    },
    [commitSnapshot]
  );

  const moveCalendarCategoryPriority = useCallback(
    (id: string, direction: 'up' | 'down') => {
      commitSnapshot((prev) => {
        const ordered = [...prev.calendarCategories].sort((a, b) => a.priority - b.priority);
        const idx = ordered.findIndex((c) => c.id === id);
        if (idx === -1) return prev;
        const target = direction === 'up' ? idx - 1 : idx + 1;
        if (target < 0 || target >= ordered.length) return prev;
        const copy = [...ordered];
        const tmp = copy[idx];
        copy[idx] = copy[target];
        copy[target] = tmp;
        return {
          ...prev,
          calendarCategories: copy.map((c, priority) => ({ ...c, priority })),
        };
      });
    },
    [commitSnapshot]
  );

  const resetCalendarCategories = useCallback(() => {
    commitSnapshot((prev) => ({
      ...prev,
      calendarCategories: DEFAULT_CALENDAR_CATEGORIES,
    }));
  }, [commitSnapshot]);

  const updateCalendarPreferences = useCallback(
    (patch: Partial<CalendarPreferences>) => {
      commitSnapshot((prev) => ({
        ...prev,
        calendarPreferences: { ...prev.calendarPreferences, ...patch },
      }));
    },
    [commitSnapshot]
  );

  // ---- EVALUATIONS (SYNCED WITH UNIFIED CALENDAR) ----
  const createEvaluation: Study2ContextValue['createEvaluation'] = useCallback(
    (payload) => {
      const now = new Date().toISOString();
      const evalId = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const draft: StudyEvaluation = {
        ...payload,
        id: evalId,
        createdAt: now,
        updatedAt: now,
      };
      commitSnapshot((prev) => {
        const subjectName = prev.subjects.find((s) => s.id === draft.subjectId)?.name || '';
        const synced = upsertCalendarEventForEvaluation(
          prev.calendarEvents,
          draft,
          subjectName
        );
        const finalEval: StudyEvaluation = {
          ...draft,
          calendarEventId: synced.calendarEventId,
        };
        return {
          ...prev,
          evaluations: [finalEval, ...prev.evaluations],
          calendarEvents: synced.events,
        };
      });
      return draft;
    },
    [commitSnapshot]
  );

  const updateEvaluation = useCallback(
    (id: string, patch: Partial<StudyEvaluation>) => {
      commitSnapshot((prev) => {
        const target = prev.evaluations.find((e) => e.id === id);
        if (!target) return prev;
        const updated: StudyEvaluation = {
          ...target,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        const subjectName = prev.subjects.find((s) => s.id === updated.subjectId)?.name || '';
        const synced = upsertCalendarEventForEvaluation(
          prev.calendarEvents,
          updated,
          subjectName
        );
        updated.calendarEventId = synced.calendarEventId;
        return {
          ...prev,
          evaluations: prev.evaluations.map((e) => (e.id === id ? updated : e)),
          calendarEvents: synced.events,
        };
      });
    },
    [commitSnapshot]
  );

  const deleteEvaluation = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        evaluations: prev.evaluations.filter((e) => e.id !== id),
        calendarEvents: prev.calendarEvents.filter((c) => c.linkedEvaluationId !== id),
      }));
    },
    [commitSnapshot]
  );

  // ---- NOTES METADATA ----
  const updateNoteMeta: Study2ContextValue['updateNoteMeta'] = useCallback(
    (noteId, patch) => {
      commitSnapshot((prev) => ({
        ...prev,
        noteMetadata: {
          ...prev.noteMetadata,
          [noteId]: { ...(prev.noteMetadata[noteId] || {}), ...patch },
        },
      }));
    },
    [commitSnapshot]
  );

  // ---- AI HANDOFF & HISTORY ----
  const sendToFabroAi = useCallback((handoff: StudyAiHandoff) => {
    setAiHandoff(handoff);
    setActiveNav('fabro-ia');
  }, []);

  const clearAiHandoff = useCallback(() => setAiHandoff(null), []);

  const appendAiTurn = useCallback(
    (turn: FabroAiSessionTurn) => {
      commitSnapshot((prev) => ({
        ...prev,
        aiHistory: [...prev.aiHistory, turn].slice(-40),
      }));
    },
    [commitSnapshot]
  );

  const clearAiHistory = useCallback(() => {
    commitSnapshot((prev) => ({ ...prev, aiHistory: [] }));
  }, [commitSnapshot]);

  // ---- EDUCATIONAL TOOLS PERSISTENCE ----
  const saveConceptMap = useCallback(
    (map: StudyConceptMap) => {
      commitSnapshot((prev) => {
        const exists = prev.conceptMaps.some((m) => m.id === map.id);
        return {
          ...prev,
          conceptMaps: exists
            ? prev.conceptMaps.map((m) => (m.id === map.id ? map : m))
            : [map, ...prev.conceptMaps],
        };
      });
    },
    [commitSnapshot]
  );

  const deleteConceptMap = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        conceptMaps: prev.conceptMaps.filter((m) => m.id !== id),
      }));
    },
    [commitSnapshot]
  );

  const saveQuizSet = useCallback(
    (set: StudyQuizSet) => {
      commitSnapshot((prev) => {
        const exists = prev.quizSets.some((q) => q.id === set.id);
        return {
          ...prev,
          quizSets: exists
            ? prev.quizSets.map((q) => (q.id === set.id ? set : q))
            : [set, ...prev.quizSets],
        };
      });
    },
    [commitSnapshot]
  );

  const deleteQuizSet = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        quizSets: prev.quizSets.filter((q) => q.id !== id),
      }));
    },
    [commitSnapshot]
  );

  const upsertFlashcard = useCallback(
    (card: StudyFlashcardItem) => {
      commitSnapshot((prev) => {
        const exists = prev.flashcards.some((c) => c.id === card.id);
        return {
          ...prev,
          flashcards: exists
            ? prev.flashcards.map((c) => (c.id === card.id ? card : c))
            : [card, ...prev.flashcards],
        };
      });
    },
    [commitSnapshot]
  );

  const deleteFlashcard = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        flashcards: prev.flashcards.filter((c) => c.id !== id),
      }));
    },
    [commitSnapshot]
  );

  const addTimelineEntry = useCallback(
    (entry: Omit<StudyTimelineEntry, 'id'>) => {
      commitSnapshot((prev) => ({
        ...prev,
        timelineEntries: [
          ...prev.timelineEntries,
          { ...entry, id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` },
        ],
      }));
    },
    [commitSnapshot]
  );

  const deleteTimelineEntry = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        timelineEntries: prev.timelineEntries.filter((t) => t.id !== id),
      }));
    },
    [commitSnapshot]
  );

  const saveComparativeTable = useCallback(
    (table: StudyComparativeTable) => {
      commitSnapshot((prev) => {
        const exists = prev.comparativeTables.some((t) => t.id === table.id);
        return {
          ...prev,
          comparativeTables: exists
            ? prev.comparativeTables.map((t) => (t.id === table.id ? table : t))
            : [table, ...prev.comparativeTables],
        };
      });
    },
    [commitSnapshot]
  );

  const deleteComparativeTable = useCallback(
    (id: string) => {
      commitSnapshot((prev) => ({
        ...prev,
        comparativeTables: prev.comparativeTables.filter((t) => t.id !== id),
      }));
    },
    [commitSnapshot]
  );

  const value = useMemo<Study2ContextValue>(
    () => ({
      ownerUid,
      hydrated,
      cloudSyncNote,
      snapshot,
      activeNav,
      setActiveNav,
      selectedSubjectId,
      setSelectedSubjectId,
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
      createLibraryFolder,
      deleteLibraryFolder,
      uploadLibraryFile,
      updateLibraryFileMeta,
      deleteLibraryFile,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      toggleCalendarEventCompleted,
      upsertCalendarCategory,
      deleteCalendarCategory,
      moveCalendarCategoryPriority,
      resetCalendarCategories,
      updateCalendarPreferences,
      createEvaluation,
      updateEvaluation,
      deleteEvaluation,
      updateNoteMeta,
      aiHandoff,
      sendToFabroAi,
      clearAiHandoff,
      appendAiTurn,
      clearAiHistory,
      saveConceptMap,
      deleteConceptMap,
      saveQuizSet,
      deleteQuizSet,
      upsertFlashcard,
      deleteFlashcard,
      addTimelineEntry,
      deleteTimelineEntry,
      saveComparativeTable,
      deleteComparativeTable,
    }),
    [
      activeNav,
      addBibliographyItem,
      addCalendarEvent,
      addSubjectUnit,
      addTimelineEntry,
      addUnitTopic,
      aiHandoff,
      appendAiTurn,
      clearAiHandoff,
      clearAiHistory,
      cloudSyncNote,
      createEvaluation,
      createLibraryFolder,
      createSubject,
      createTask,
      deleteBibliographyItem,
      deleteCalendarCategory,
      deleteCalendarEvent,
      deleteComparativeTable,
      deleteConceptMap,
      deleteEvaluation,
      deleteFlashcard,
      deleteLibraryFile,
      deleteLibraryFolder,
      deleteQuizSet,
      deleteSubject,
      deleteSubjectUnit,
      deleteTask,
      deleteTimelineEntry,
      deleteUnitTopic,
      hydrated,
      moveCalendarCategoryPriority,
      moveSubjectOrder,
      ownerUid,
      resetCalendarCategories,
      saveComparativeTable,
      saveConceptMap,
      saveQuizSet,
      selectedSubjectId,
      sendToFabroAi,
      snapshot,
      toggleArchiveSubject,
      toggleCalendarEventCompleted,
      toggleTask,
      toggleUnitTopic,
      updateCalendarEvent,
      updateCalendarPreferences,
      updateEvaluation,
      updateLibraryFileMeta,
      updateNoteMeta,
      updateSubject,
      uploadLibraryFile,
      upsertCalendarCategory,
      upsertFlashcard,
    ]
  );

  return <Study2Context.Provider value={value}>{children}</Study2Context.Provider>;
};

export function useStudy2(): Study2ContextValue {
  const ctx = useContext(Study2Context);
  if (!ctx) {
    throw new Error('useStudy2 debe usarse dentro de Study2Provider');
  }
  return ctx;
}
