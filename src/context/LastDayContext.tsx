import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { cacheSnapshotCollection, getCachedCollection } from '../lib/offlineStore';
import { useFabro } from './FabroContext';
import type {
  ContactRequest,
  LastDayActivity,
  LastDayActivityCategory,
  LastDayActivityStatus,
  LastDayDream,
  LastDayDreamCategory,
  LastDayDreamStatus,
  LastDayLegacy,
  LastDayMemory,
  LastDayMemoryMediaType,
  LastDayMemoryPrefKind,
  LastDayPrimaryEmotion,
  LastDayReflection,
  LastDayWriting,
  LastDayWritingType,
  PublicUserProfile,
} from '../types/fabro';

function makeSafeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTomorrowDateKey(baseDateKey = getLocalDateKey()): string {
  const [y, m, d] = baseDateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + 1);
  return getLocalDateKey(dt);
}

function clampString(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function clampStringList(list: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => clampString(item, maxLen))
    .filter((s) => s.length > 0)
    .slice(0, maxItems);
}

function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 960;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
        canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen en el navegador.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        if (dataUrl.length > 340000) {
          resolve(canvas.toDataURL('image/jpeg', 0.55).slice(0, 345000));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => reject(new Error('No se pudo decodificar la imagen seleccionada.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de imagen.'));
    reader.readAsDataURL(file);
  });
}

interface LastDayContextValue {
  reflections: LastDayReflection[];
  activities: LastDayActivity[];
  dreams: LastDayDream[];
  writings: LastDayWriting[];
  memories: LastDayMemory[];
  legacyItems: LastDayLegacy[];
  sentContactRequests: ContactRequest[];
  receivedContactRequests: ContactRequest[];
  loading: boolean;
  saveReflection: (input: {
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
  }) => Promise<void>;
  createActivity: (input: {
    dateKey: string;
    title: string;
    category: LastDayActivityCategory;
    scheduledTime: string;
    durationMinutes: number;
    notes: string;
    isHabitualTemplate: boolean;
    rolledOverFromDate?: string;
  }) => Promise<string>;
  updateActivity: (
    activity: LastDayActivity,
    patch: Partial<{
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
    }>
  ) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  rolloverPendingActivitiesToNextDay: (fromDateKey: string, toDateKey?: string) => Promise<number>;
  saveDream: (input: {
    id?: string;
    title: string;
    description: string;
    category: LastDayDreamCategory;
    status: LastDayDreamStatus;
    targetDate: string;
    steps: string[];
    linkedCalendarEventId?: string;
  }) => Promise<string>;
  deleteDream: (dreamId: string) => Promise<void>;
  linkDreamToFabroCalendar: (dream: LastDayDream) => Promise<string>;
  saveWriting: (input: {
    id?: string;
    writingType: LastDayWritingType;
    title: string;
    contentHtml: string;
    contentText: string;
    moodTag: string;
    dateKey: string;
    aiSummary?: string;
  }) => Promise<string>;
  deleteWriting: (writingId: string) => Promise<void>;
  saveMemory: (input: {
    id?: string;
    mediaType: LastDayMemoryMediaType;
    prefKind: LastDayMemoryPrefKind;
    title: string;
    story: string;
    mediaUrl?: string;
    file?: File | null;
    youtubeVideoId?: string;
    creatorOrArtist?: string;
    locationOrPeople?: string;
    memoryDate?: string;
    favorite?: boolean;
  }) => Promise<string>;
  toggleMemoryFavorite: (memory: LastDayMemory) => Promise<void>;
  deleteMemory: (memoryId: string) => Promise<void>;
  saveLegacy: (input: {
    id?: string;
    recipientName: string;
    relationship: string;
    title: string;
    message: string;
    mediaHint: string;
    consentConfirmed: boolean;
  }) => Promise<string>;
  deleteLegacy: (legacyId: string) => Promise<void>;
  sendContactRequest: (target: PublicUserProfile, message: string) => Promise<string>;
  respondContactRequest: (reqItem: ContactRequest, decision: 'aceptada' | 'rechazada') => Promise<void>;
  deleteContactRequest: (requestId: string) => Promise<void>;
  setDirectoryVisibility: (searchable: boolean) => Promise<void>;
}

const LastDayContext = createContext<LastDayContextValue | undefined>(undefined);

export const LastDayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authReady, profile, calendarEvents, createCalendarEvent, updateCalendarEvent } = useFabro();

  const [reflections, setReflections] = useState<LastDayReflection[]>([]);
  const [activities, setActivities] = useState<LastDayActivity[]>([]);
  const [dreams, setDreams] = useState<LastDayDream[]>([]);
  const [writings, setWritings] = useState<LastDayWriting[]>([]);
  const [memories, setMemories] = useState<LastDayMemory[]>([]);
  const [legacyItems, setLegacyItems] = useState<LastDayLegacy[]>([]);
  const [sentContactRequests, setSentContactRequests] = useState<ContactRequest[]>([]);
  const [receivedContactRequests, setReceivedContactRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setReflections([]);
      setActivities([]);
      setDreams([]);
      setWritings([]);
      setMemories([]);
      setLegacyItems([]);
      setSentContactRequests([]);
      setReceivedContactRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const uid = user.uid;

    // Pre-hydrate cached LastDay data from IndexedDB so offline sessions load instantaneously
    void getCachedCollection('lastDayCache').then((rows) => {
      const items = rows as Array<{ id: string; kind?: string; data?: unknown }>;
      if (!items.length) return;
      const refs = items.filter((i) => i.kind === 'reflection').map((i) => i.data as LastDayReflection);
      const acts = items.filter((i) => i.kind === 'activity').map((i) => i.data as LastDayActivity);
      const drms = items.filter((i) => i.kind === 'dream').map((i) => i.data as LastDayDream);
      const wrts = items.filter((i) => i.kind === 'writing').map((i) => i.data as LastDayWriting);
      if (refs.length) setReflections((p) => (p.length ? p : refs));
      if (acts.length) setActivities((p) => (p.length ? p : acts));
      if (drms.length) setDreams((p) => (p.length ? p : drms));
      if (wrts.length) setWritings((p) => (p.length ? p : wrts));
    }).catch(() => {});

    const unsubReflections = onSnapshot(
      query(collection(db, 'lastDayReflections'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as LastDayReflection);
        list.sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
        setReflections(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'lastDayReflections');
      }
    );

    const unsubActivities = onSnapshot(
      query(collection(db, 'lastDayActivities'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as LastDayActivity);
        list.sort((a, b) => {
          const dCmp = (b.dateKey || '').localeCompare(a.dateKey || '');
          if (dCmp !== 0) return dCmp;
          return (a.scheduledTime || '99:99').localeCompare(b.scheduledTime || '99:99');
        });
        setActivities(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'lastDayActivities')
    );

    const unsubDreams = onSnapshot(
      query(collection(db, 'lastDayDreams'), where('userId', '==', uid)),
      (snap) => {
        setDreams(snap.docs.map((d) => d.data() as LastDayDream));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'lastDayDreams')
    );

    const unsubWritings = onSnapshot(
      query(collection(db, 'lastDayWritings'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as LastDayWriting);
        list.sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
        setWritings(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'lastDayWritings')
    );

    const unsubMemories = onSnapshot(
      query(collection(db, 'lastDayMemories'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as LastDayMemory);
        list.sort((a, b) => (b.memoryDate || '').localeCompare(a.memoryDate || ''));
        setMemories(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'lastDayMemories')
    );

    const unsubLegacy = onSnapshot(
      query(collection(db, 'lastDayLegacy'), where('userId', '==', uid)),
      (snap) => {
        setLegacyItems(snap.docs.map((d) => d.data() as LastDayLegacy));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'lastDayLegacy')
    );

    const unsubSentReq = onSnapshot(
      query(
        collection(db, 'contactRequests'),
        where('fromUserId', '==', uid),
        where('hasMinorParticipant', '==', false)
      ),
      (snap) => {
        setSentContactRequests(snap.docs.map((d) => d.data() as ContactRequest));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'contactRequests')
    );

    const unsubRecReq = onSnapshot(
      query(
        collection(db, 'contactRequests'),
        where('toUserId', '==', uid),
        where('hasMinorParticipant', '==', false)
      ),
      (snap) => {
        setReceivedContactRequests(snap.docs.map((d) => d.data() as ContactRequest));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'contactRequests')
    );

    return () => {
      unsubReflections();
      unsubActivities();
      unsubDreams();
      unsubWritings();
      unsubMemories();
      unsubLegacy();
      unsubSentReq();
      unsubRecReq();
    };
  }, [authReady, user]);

  // Mirror personal LastDay writings, reflections, dreams & activities into IndexedDB offline vault
  useEffect(() => {
    if (!user?.uid) return;
    const packed: Array<{ id: string; kind: string; data: unknown }> = [
      ...reflections.slice(0, 40).map((r) => ({ id: `ref_${r.id}`, kind: 'reflection', data: r })),
      ...activities.slice(0, 60).map((a) => ({ id: `act_${a.id}`, kind: 'activity', data: a })),
      ...dreams.slice(0, 40).map((d) => ({ id: `drm_${d.id}`, kind: 'dream', data: d })),
      ...writings.slice(0, 50).map((w) => ({ id: `wrt_${w.id}`, kind: 'writing', data: w })),
    ];
    if (packed.length > 0) {
      void cacheSnapshotCollection('lastDayCache', packed).catch(() => {});
    }
  }, [user?.uid, reflections, activities, dreams, writings]);

  const saveReflection = useCallback<LastDayContextValue['saveReflection']>(
    async (input) => {
      if (!user) throw new Error('Necesitás iniciar sesión para guardar tu reflexión.');
      const dateKey = clampString(input.dateKey || getLocalDateKey(), 20);
      const id = `ref_${user.uid}_${dateKey}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
      const path = `lastDayReflections/${id}`;
      const existing = reflections.find((r) => r.id === id);

      const safeFields = {
        dailyAnswer: clampString(input.dailyAnswer, 8000),
        gratitudeNote: clampString(input.gratitudeNote, 3000),
        tomorrowPriorities: clampStringList(input.tomorrowPriorities, 12, 200),
        tomorrowPrepDone: Boolean(input.tomorrowPrepDone),
        eveningNote: clampString(input.eveningNote, 3000),
        happinessScore: Math.max(1, Math.min(10, Math.round(Number(input.happinessScore) || 7))),
        primaryEmotion: input.primaryEmotion,
        secondaryEmotions: clampStringList(input.secondaryEmotions, 10, 60),
        emotionNote: clampString(input.emotionNote, 2000),
      };

      try {
        if (existing) {
          await updateDoc(doc(db, 'lastDayReflections', id), {
            ...safeFields,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'lastDayReflections', id), {
            id,
            userId: user.uid,
            dateKey,
            ...safeFields,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, path);
      }
    },
    [user, reflections]
  );

  const createActivity = useCallback<LastDayContextValue['createActivity']>(
    async (input) => {
      if (!user) throw new Error('Necesitás iniciar sesión para crear actividades.');
      const id = makeSafeId('ldact');
      const path = `lastDayActivities/${id}`;
      try {
        await setDoc(doc(db, 'lastDayActivities', id), {
          id,
          userId: user.uid,
          dateKey: clampString(input.dateKey || getLocalDateKey(), 20),
          title: clampString(input.title, 180) || 'Actividad personal',
          category: input.category,
          scheduledTime: clampString(input.scheduledTime || '09:00', 10),
          durationMinutes: Math.max(1, Math.min(720, Math.round(Number(input.durationMinutes) || 25))),
          elapsedSeconds: 0,
          status: 'pendiente',
          notes: clampString(input.notes, 1500),
          rolledOverFromDate: clampString(input.rolledOverFromDate || '', 20),
          isHabitualTemplate: Boolean(input.isHabitualTemplate),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return id;
      } catch (err) {
        return handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user]
  );

  const updateActivity = useCallback<LastDayContextValue['updateActivity']>(
    async (activity, patch) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      const path = `lastDayActivities/${activity.id}`;
      try {
        await updateDoc(doc(db, 'lastDayActivities', activity.id), {
          dateKey: clampString(patch.dateKey ?? activity.dateKey, 20),
          title: clampString(patch.title ?? activity.title, 180) || activity.title,
          category: patch.category ?? activity.category,
          scheduledTime: clampString(patch.scheduledTime ?? activity.scheduledTime, 10),
          durationMinutes: Math.max(
            1,
            Math.min(720, Math.round(Number(patch.durationMinutes ?? activity.durationMinutes) || 15))
          ),
          elapsedSeconds: Math.max(
            0,
            Math.min(86400, Math.round(Number(patch.elapsedSeconds ?? activity.elapsedSeconds) || 0))
          ),
          status: patch.status ?? activity.status,
          notes: clampString(patch.notes ?? activity.notes, 1500),
          rolledOverFromDate: clampString(
            patch.rolledOverFromDate ?? activity.rolledOverFromDate ?? '',
            20
          ),
          isHabitualTemplate: patch.isHabitualTemplate ?? activity.isHabitualTemplate,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const deleteActivity = useCallback<LastDayContextValue['deleteActivity']>(
    async (activityId) => {
      const path = `lastDayActivities/${activityId}`;
      try {
        await deleteDoc(doc(db, 'lastDayActivities', activityId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    []
  );

  const rolloverPendingActivitiesToNextDay = useCallback<
    LastDayContextValue['rolloverPendingActivitiesToNextDay']
  >(
    async (fromDateKey, toDateKey) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      const destinationDate = clampString(toDateKey || getTomorrowDateKey(fromDateKey), 20);
      const pending = activities.filter(
        (a) =>
          a.dateKey === fromDateKey &&
          (a.status === 'pendiente' || a.status === 'pausado' || a.status === 'en_curso')
      );
      if (pending.length === 0) return 0;

      for (const act of pending) {
        await updateActivity(act, { status: 'trasladada' });
        await createActivity({
          dateKey: destinationDate,
          title: act.title,
          category: act.category,
          scheduledTime: act.scheduledTime,
          durationMinutes: act.durationMinutes,
          notes: act.notes,
          isHabitualTemplate: act.isHabitualTemplate,
          rolledOverFromDate: fromDateKey,
        });
      }
      return pending.length;
    },
    [user, activities, updateActivity, createActivity]
  );

  const saveDream = useCallback<LastDayContextValue['saveDream']>(
    async (input) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      const existing = input.id ? dreams.find((d) => d.id === input.id) : undefined;
      const id = existing ? existing.id : makeSafeId('lddrm');
      const path = `lastDayDreams/${id}`;

      const payload = {
        title: clampString(input.title, 180) || 'Sueño personal',
        description: clampString(input.description, 3000),
        category: input.category,
        status: input.status,
        targetDate: clampString(input.targetDate, 20),
        steps: clampStringList(input.steps, 20, 200),
        linkedCalendarEventId: clampString(
          input.linkedCalendarEventId ?? existing?.linkedCalendarEventId ?? '',
          128
        ),
      };

      try {
        if (existing) {
          await updateDoc(doc(db, 'lastDayDreams', id), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'lastDayDreams', id), {
            id,
            userId: user.uid,
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (err) {
        return handleFirestoreError(
          err,
          existing ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [user, dreams]
  );

  const deleteDream = useCallback<LastDayContextValue['deleteDream']>(async (dreamId) => {
    const path = `lastDayDreams/${dreamId}`;
    try {
      await deleteDoc(doc(db, 'lastDayDreams', dreamId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }, []);

  const linkDreamToFabroCalendar = useCallback<LastDayContextValue['linkDreamToFabroCalendar']>(
    async (dream) => {
      const eventDate = dream.targetDate || getLocalDateKey();
      const hasLinked = Boolean(
        dream.linkedCalendarEventId &&
          calendarEvents.some((ev) => ev.id === dream.linkedCalendarEventId)
      );
      if (hasLinked && dream.linkedCalendarEventId) {
        await updateCalendarEvent(dream.linkedCalendarEventId, {
          title: `Objetivo vital: ${dream.title}`,
          date: eventDate,
          notes: dream.description || 'Agendado desde EL ÚLTIMO DÍA DE TU VIDA en FABRO.',
        });
        return dream.linkedCalendarEventId;
      }

      const eventId = await createCalendarEvent({
        subjectId: '',
        title: `Objetivo vital: ${dream.title}`,
        type: 'objetivo',
        date: eventDate,
        time: '10:00',
        notes: dream.description || 'Agendado desde EL ÚLTIMO DÍA DE TU VIDA en FABRO.',
        completed: false,
      });
      await saveDream({
        id: dream.id,
        title: dream.title,
        description: dream.description,
        category: dream.category,
        status: dream.status,
        targetDate: dream.targetDate,
        steps: dream.steps,
        linkedCalendarEventId: eventId,
      });
      return eventId;
    },
    [calendarEvents, createCalendarEvent, updateCalendarEvent, saveDream]
  );

  const saveWriting = useCallback<LastDayContextValue['saveWriting']>(
    async (input) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      const existing = input.id ? writings.find((w) => w.id === input.id) : undefined;
      const id = existing ? existing.id : makeSafeId('ldwrt');
      const path = `lastDayWritings/${id}`;
      const cleanText = clampString(input.contentText, 300000);
      const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;

      const payload = {
        writingType: input.writingType,
        title: clampString(input.title, 200) || 'Escrito sin título',
        contentHtml: clampString(input.contentHtml, 300000),
        contentText: cleanText,
        moodTag: clampString(input.moodTag, 80),
        wordCount: Math.max(0, Math.min(500000, wordCount)),
        dateKey: clampString(input.dateKey || getLocalDateKey(), 20),
        aiSummary: clampString(input.aiSummary ?? existing?.aiSummary ?? '', 20000),
      };

      try {
        if (existing) {
          await updateDoc(doc(db, 'lastDayWritings', id), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'lastDayWritings', id), {
            id,
            userId: user.uid,
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (err) {
        return handleFirestoreError(
          err,
          existing ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [user, writings]
  );

  const deleteWriting = useCallback<LastDayContextValue['deleteWriting']>(async (writingId) => {
    const path = `lastDayWritings/${writingId}`;
    try {
      await deleteDoc(doc(db, 'lastDayWritings', writingId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }, []);

  const saveMemory = useCallback<LastDayContextValue['saveMemory']>(
    async (input) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      const existing = input.id ? memories.find((m) => m.id === input.id) : undefined;
      const id = existing ? existing.id : makeSafeId('ldmem');
      const path = `lastDayMemories/${id}`;

      let resolvedUrl = clampString(input.mediaUrl ?? existing?.mediaUrl ?? '', 350000);
      let resolvedStoragePath = existing?.storagePath ?? '';

      if (input.file) {
        try {
          const cleanName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
          const sPath = `lastDay/${user.uid}/${id}_${cleanName}`;
          const fileRef = storageRef(storage, sPath);
          await uploadBytes(fileRef, input.file);
          const dl = await getDownloadURL(fileRef);
          resolvedUrl = clampString(dl, 350000);
          resolvedStoragePath = clampString(sPath, 500);
        } catch {
          // Graceful fallback to compressed in-doc image URL if Storage bucket rules or CORS block upload
          resolvedUrl = await compressImageFileToDataUrl(input.file);
          resolvedStoragePath = '';
        }
      }

      const payload = {
        mediaType: input.mediaType,
        prefKind: input.prefKind,
        title: clampString(input.title, 180) || 'Recuerdo personal',
        story: clampString(input.story, 4000),
        mediaUrl: resolvedUrl,
        storagePath: resolvedStoragePath,
        youtubeVideoId: clampString(input.youtubeVideoId ?? existing?.youtubeVideoId ?? '', 32),
        creatorOrArtist: clampString(input.creatorOrArtist ?? existing?.creatorOrArtist ?? '', 150),
        locationOrPeople: clampString(input.locationOrPeople ?? existing?.locationOrPeople ?? '', 200),
        memoryDate: clampString(input.memoryDate ?? existing?.memoryDate ?? getLocalDateKey(), 20),
        favorite: Boolean(input.favorite ?? existing?.favorite ?? false),
      };

      try {
        if (existing) {
          await updateDoc(doc(db, 'lastDayMemories', id), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'lastDayMemories', id), {
            id,
            userId: user.uid,
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (err) {
        return handleFirestoreError(
          err,
          existing ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [user, memories]
  );

  const toggleMemoryFavorite = useCallback<LastDayContextValue['toggleMemoryFavorite']>(
    async (memory) => {
      await saveMemory({
        id: memory.id,
        mediaType: memory.mediaType,
        prefKind: memory.prefKind,
        title: memory.title,
        story: memory.story,
        mediaUrl: memory.mediaUrl,
        youtubeVideoId: memory.youtubeVideoId,
        creatorOrArtist: memory.creatorOrArtist,
        locationOrPeople: memory.locationOrPeople,
        memoryDate: memory.memoryDate,
        favorite: !memory.favorite,
      });
    },
    [saveMemory]
  );

  const deleteMemory = useCallback<LastDayContextValue['deleteMemory']>(async (memoryId) => {
    const path = `lastDayMemories/${memoryId}`;
    try {
      await deleteDoc(doc(db, 'lastDayMemories', memoryId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }, []);

  const saveLegacy = useCallback<LastDayContextValue['saveLegacy']>(
    async (input) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      if (!input.consentConfirmed) {
        throw new Error('Debés confirmar tu consentimiento explícito y privacidad antes de guardar en Mi Legado.');
      }
      const existing = input.id ? legacyItems.find((l) => l.id === input.id) : undefined;
      const id = existing ? existing.id : makeSafeId('ldleg');
      const path = `lastDayLegacy/${id}`;

      const payload = {
        recipientName: clampString(input.recipientName, 120),
        relationship: clampString(input.relationship, 80),
        title: clampString(input.title, 180),
        message: clampString(input.message, 40000),
        mediaHint: clampString(input.mediaHint, 500),
        consentConfirmed: true as const,
        privateOnly: true as const,
        autoSendDisabled: true as const,
      };

      if (!payload.recipientName || !payload.title || !payload.message) {
        throw new Error('Completá destinatario, título y contenido del mensaje.');
      }

      try {
        if (existing) {
          await updateDoc(doc(db, 'lastDayLegacy', id), {
            ...payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'lastDayLegacy', id), {
            id,
            userId: user.uid,
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return id;
      } catch (err) {
        return handleFirestoreError(
          err,
          existing ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [user, legacyItems]
  );

  const deleteLegacy = useCallback<LastDayContextValue['deleteLegacy']>(async (legacyId) => {
    const path = `lastDayLegacy/${legacyId}`;
    try {
      await deleteDoc(doc(db, 'lastDayLegacy', legacyId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }, []);

  const sendContactRequest = useCallback<LastDayContextValue['sendContactRequest']>(
    async (target, message) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      if (profile?.isMinor) {
        throw new Error('Las cuentas de menores de edad no pueden enviar ni recibir solicitudes privadas.');
      }
      if (target.isMinor) {
        throw new Error('Por protección infantil, no está permitido solicitar contacto directo con menores.');
      }
      if (target.uid === user.uid) {
        throw new Error('No podés enviarte una solicitud a vos mismo.');
      }
      const existingPending = [...sentContactRequests, ...receivedContactRequests].find(
        (r) =>
          ((r.fromUserId === user.uid && r.toUserId === target.uid) ||
            (r.fromUserId === target.uid && r.toUserId === user.uid)) &&
          r.status === 'pendiente'
      );
      if (existingPending) {
        return existingPending.id;
      }

      const id = makeSafeId('creq');
      const path = `contactRequests/${id}`;
      try {
        await setDoc(doc(db, 'contactRequests', id), {
          id,
          fromUserId: user.uid,
          fromName: clampString(profile?.displayName || user.displayName || 'Usuario FABRO', 120),
          toUserId: target.uid,
          toName: clampString(target.displayName || 'Integrante FABRO', 120),
          message: clampString(message || 'Hola, me gustaría conectar en la comunidad de FABRO.', 500),
          hasMinorParticipant: false,
          status: 'pendiente',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return id;
      } catch (err) {
        return handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user, profile, sentContactRequests, receivedContactRequests]
  );

  const respondContactRequest = useCallback<LastDayContextValue['respondContactRequest']>(
    async (reqItem, decision) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      const path = `contactRequests/${reqItem.id}`;
      try {
        await updateDoc(doc(db, 'contactRequests', reqItem.id), {
          status: decision,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const deleteContactRequest = useCallback<LastDayContextValue['deleteContactRequest']>(
    async (requestId) => {
      const path = `contactRequests/${requestId}`;
      try {
        await deleteDoc(doc(db, 'contactRequests', requestId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    []
  );

  const setDirectoryVisibility = useCallback<LastDayContextValue['setDirectoryVisibility']>(
    async (searchable) => {
      if (!user) throw new Error('Necesitás iniciar sesión.');
      const isMinorAccount = Boolean(profile?.isMinor);
      const effectiveSearchable = isMinorAccount ? false : Boolean(searchable);
      const path = `publicProfiles/${user.uid}`;
      const pubRef = doc(db, 'publicProfiles', user.uid);
      try {
        const snap = await getDoc(pubRef);
        if (snap.exists()) {
          await updateDoc(pubRef, {
            searchableInDirectory: effectiveSearchable,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(pubRef, {
            uid: user.uid,
            displayName: (profile?.displayName || user.displayName || 'Usuario FABRO').slice(0, 100),
            username: (profile?.username || '').slice(0, 50),
            customFabroId: (profile?.customFabroId || '').slice(0, 32),
            photoURL: (profile?.photoURL || '').slice(0, 135000),
            galleryPhotos: (profile?.galleryPhotos || []).slice(0, 6),
            sharedPhrase: (profile?.sharedPhrase || '').slice(0, 400),
            favoriteBooks: (profile?.favoriteBooks || '').slice(0, 300),
            favoriteMovies: (profile?.favoriteMovies || '').slice(0, 300),
            favoriteMusic: (profile?.favoriteMusic || '').slice(0, 300),
            country: (profile?.country || '').slice(0, 100),
            province: (profile?.province || '').slice(0, 100),
            city: (profile?.city || '').slice(0, 100),
            bio: (profile?.bio || '').slice(0, 1000),
            interests: (profile?.interests || []).slice(0, 25),
            institutions: (
              profile?.institutions ||
              (profile?.institution ? [profile.institution] : [])
            ).slice(0, 15),
            isStudent: profile?.isStudent ?? false,
            isInstructor: profile?.isInstructor ?? false,
            instructorCategory: profile?.instructorCategory || 'instructor_independiente',
            verificationStatus: profile?.verificationStatus || 'no_solicitado',
            specialty: (profile?.specialty || '').slice(0, 150),
            experienceSummary: (profile?.experienceSummary || '').slice(0, 1500),
            isMinor: isMinorAccount,
            searchableInDirectory: effectiveSearchable,
            presenceStatus:
              profile?.presenceMode === 'invisible'
                ? 'offline'
                : profile?.presenceMode || 'online',
            reputationPoints: profile?.reputationPoints || 0,
            followersCount: 0,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user, profile]
  );

  const value = useMemo<LastDayContextValue>(
    () => ({
      reflections,
      activities,
      dreams,
      writings,
      memories,
      legacyItems,
      sentContactRequests,
      receivedContactRequests,
      loading,
      saveReflection,
      createActivity,
      updateActivity,
      deleteActivity,
      rolloverPendingActivitiesToNextDay,
      saveDream,
      deleteDream,
      linkDreamToFabroCalendar,
      saveWriting,
      deleteWriting,
      saveMemory,
      toggleMemoryFavorite,
      deleteMemory,
      saveLegacy,
      deleteLegacy,
      sendContactRequest,
      respondContactRequest,
      deleteContactRequest,
      setDirectoryVisibility,
    }),
    [
      reflections,
      activities,
      dreams,
      writings,
      memories,
      legacyItems,
      sentContactRequests,
      receivedContactRequests,
      loading,
      saveReflection,
      createActivity,
      updateActivity,
      deleteActivity,
      rolloverPendingActivitiesToNextDay,
      saveDream,
      deleteDream,
      linkDreamToFabroCalendar,
      saveWriting,
      deleteWriting,
      saveMemory,
      toggleMemoryFavorite,
      deleteMemory,
      saveLegacy,
      deleteLegacy,
      sendContactRequest,
      respondContactRequest,
      deleteContactRequest,
      setDirectoryVisibility,
    ]
  );

  return <LastDayContext.Provider value={value}>{children}</LastDayContext.Provider>;
};

export function useLastDay() {
  const ctx = useContext(LastDayContext);
  if (!ctx) throw new Error('useLastDay debe usarse dentro de LastDayProvider');
  return ctx;
}
