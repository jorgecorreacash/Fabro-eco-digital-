import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Download,
  ExternalLink,
  Feather,
  Film,
  Globe,
  Heart,
  HeartHandshake,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Moon,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Sun,
  Trash2,
  UserPlus,
  Users,
  Video,
} from 'lucide-react';
import lastDayCoverImg from '../../assets/images/last_day_cover_horizon_1794764052341.jpg';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { useHabitTimer } from '../../context/HabitTimerContext';
import { getLocalDateKey, getTomorrowDateKey, useLastDay } from '../../context/LastDayContext';
import { usePlatform } from '../../context/PlatformContext';
import { authFetch } from '../../lib/apiClient';
import {
  detectEmotionalCrisis,
  getCrisisSupportResources,
  type CrisisHelpline,
} from '../../../shared/emotionalSafety';
import { exportMarkdownToText, exportNoteToPdf, exportNoteToWord } from '../../lib/exporters';
import { getSectorAiPreferences } from '../../lib/fabroId';
import { playHabitAlertSound, stopHabitAlertSound } from '../../lib/habitSound';
import type {
  AIProviderId,
  LastDayActivity,
  LastDayActivityCategory,
  LastDayDream,
  LastDayDreamCategory,
  LastDayDreamStatus,
  LastDayLegacy,
  LastDayMemory,
  LastDayMemoryMediaType,
  LastDayMemoryPrefKind,
  LastDayPrimaryEmotion,
  LastDayWriting,
  LastDayWritingType,
  PortalEntry,
  PublicUserProfile,
} from '../../types/fabro';

type LastDayTabId =
  | 'hoy'
  | 'suenos'
  | 'diario'
  | 'recuerdos'
  | 'legado'
  | 'consejero'
  | 'comunidad';

const EMOTION_OPTIONS: Array<{ id: LastDayPrimaryEmotion; label: string }> = [
  { id: 'alegria', label: 'Alegría' },
  { id: 'gratitud', label: 'Gratitud' },
  { id: 'esperanza', label: 'Esperanza' },
  { id: 'calma', label: 'Calma' },
  { id: 'preocupacion', label: 'Preocupación' },
  { id: 'tristeza', label: 'Tristeza' },
  { id: 'enojo', label: 'Enojo' },
  { id: 'otro', label: 'Otra emoción' },
];

const SECONDARY_EMOTION_POOL = [
  'Serenidad',
  'Entusiasmo',
  'Nostalgia',
  'Alivio',
  'Cansancio',
  'Inspiración',
  'Orgullo sano',
  'Ternura',
  'Incertidumbre',
  'Determinación',
];

const ACTIVITY_CATEGORIES: Array<{ id: LastDayActivityCategory; label: string }> = [
  { id: 'felicidad', label: 'Me hace feliz' },
  { id: 'habitual', label: 'Rutina habitual' },
  { id: 'vinculos', label: 'Seres queridos' },
  { id: 'bienestar', label: 'Salud y cuerpo' },
  { id: 'creatividad', label: 'Creatividad' },
  { id: 'sueno', label: 'Paso hacia un sueño' },
  { id: 'descanso', label: 'Descanso' },
  { id: 'otro', label: 'Otro' },
];

const DREAM_CATEGORIES: Array<{ id: LastDayDreamCategory; label: string }> = [
  { id: 'viajes', label: 'Viajes y lugares' },
  { id: 'familia', label: 'Familia y vínculos' },
  { id: 'aprendizaje', label: 'Aprender algo nuevo' },
  { id: 'salud', label: 'Bienestar y vitalidad' },
  { id: 'creatividad', label: 'Arte y creación' },
  { id: 'proyecto', label: 'Proyecto de vida' },
  { id: 'naturaleza', label: 'Naturaleza' },
  { id: 'otro', label: 'Otro' },
];

const WRITING_TYPES: Array<{ id: LastDayWritingType; label: string; hint: string }> = [
  { id: 'diario', label: 'Diario personal', hint: 'Tu crónica honesta del día, aprendizajes y momentos valiosos.' },
  { id: 'carta', label: 'Carta', hint: 'Palabras significativas para alguien especial o para tu yo futuro.' },
  { id: 'poema', label: 'Poema', hint: 'Versos libres o rimados nacidos desde lo que sentís.' },
  { id: 'cancion', label: 'Canción', hint: 'Letras, estribillos y melodías imaginadas.' },
  { id: 'relato', label: 'Relato', hint: 'Historias breves reales o literarias.' },
  { id: 'autobiografia', label: 'Autobiografía', hint: 'Capítulos de tu historia, raíces, logros y huellas.' },
];

const MOTIVATIONAL_REFLECTIONS = [
  'Elegir con intención cómo vivir hoy transforma una jornada común en un recuerdo valioso.',
  'No hace falta esperar una fecha lejana para decir gracias, llamar a alguien querido o disfrutar de algo sencillo.',
  'Cada paso pequeño hacia un sueño pendiente cuenta más que la perfección postergada.',
  'Cuidar tu descanso, tu cuerpo y tu paz mental también es una forma profunda de honrar tu vida.',
  'Tus palabras escritas hoy pueden ordenar la mente y dar claridad a lo que realmente importa.',
];

function extractYoutubeId(url: string): string {
  const raw = (url || '').trim();
  if (!raw) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  const match = raw.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] || '';
}

function formatChrono(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export const LastDayView: React.FC = () => {
  const { user, profile, calendarEvents, createNote, setActiveSection } = useFabro();
  const {
    publicProfiles,
    myPublicProfile,
    groups,
    createGroup,
    joinGroup,
    leaveGroup,
    toggleBlockUser,
    startOrGetDirectThread,
    submitModerationReport,
    myReports,
  } = usePlatform();
  const { requestOpenHabitStudio } = useHabitTimer();
  const {
    providers,
    models,
    freemiumStatus,
    openPlansModal,
    personalConnections,
    sendPersonalChat,
  } = useAIGateway();

  const {
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
  } = useLastDay();

  const todayKey = useMemo(() => getLocalDateKey(), []);
  const tomorrowKey = useMemo(() => getTomorrowDateKey(todayKey), [todayKey]);

  const [activeTab, setActiveTab] = useState<LastDayTabId>('hoy');
  const [statusNotice, setStatusNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const flashNotice = (type: 'ok' | 'err', text: string) => {
    setStatusNotice({ type, text });
  };

  // ============================================================================
  // TAB 1: HOY, REFLEXIÓN, EMOCIONES & PLANIFICADOR CON TEMPORIZADOR
  // ============================================================================
  const [plannerDateKey, setPlannerDateKey] = useState<string>(todayKey);
  const todayReflection = useMemo(
    () => reflections.find((r) => r.dateKey === plannerDateKey),
    [reflections, plannerDateKey]
  );

  const [dailyAnswer, setDailyAnswer] = useState('');
  const [gratitudeNote, setGratitudeNote] = useState('');
  const [happinessScore, setHappinessScore] = useState<number>(8);
  const [primaryEmotion, setPrimaryEmotion] = useState<LastDayPrimaryEmotion>('gratitud');
  const [secondaryEmotions, setSecondaryEmotions] = useState<string[]>([]);
  const [emotionNote, setEmotionNote] = useState('');
  const [eveningNote, setEveningNote] = useState('');
  const [tomorrowPrioritiesText, setTomorrowPrioritiesText] = useState('');
  const [tomorrowPrepDone, setTomorrowPrepDone] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);
  const [motivationIndex, setMotivationIndex] = useState(0);

  useEffect(() => {
    setDailyAnswer(todayReflection?.dailyAnswer || '');
    setGratitudeNote(todayReflection?.gratitudeNote || '');
    setHappinessScore(todayReflection?.happinessScore || 8);
    setPrimaryEmotion(todayReflection?.primaryEmotion || 'gratitud');
    setSecondaryEmotions(todayReflection?.secondaryEmotions || []);
    setEmotionNote(todayReflection?.emotionNote || '');
    setEveningNote(todayReflection?.eveningNote || '');
    setTomorrowPrioritiesText((todayReflection?.tomorrowPriorities || []).join('\n'));
    setTomorrowPrepDone(Boolean(todayReflection?.tomorrowPrepDone));
  }, [todayReflection, plannerDateKey]);

  // Activity form + live running timer
  const [actTitle, setActTitle] = useState('');
  const [actCategory, setActCategory] = useState<LastDayActivityCategory>('felicidad');
  const [actTime, setActTime] = useState('09:00');
  const [actDuration, setActDuration] = useState(30);
  const [actNotes, setActNotes] = useState('');
  const [actIsHabitual, setActIsHabitual] = useState(false);
  const [runningActivityId, setRunningActivityId] = useState<string | null>(null);
  const [liveSeconds, setLiveSeconds] = useState<number>(0);
  const [alarmDoneActivityTitle, setAlarmDoneActivityTitle] = useState<string | null>(null);

  const plannerActivities = useMemo(
    () => activities.filter((a) => a.dateKey === plannerDateKey),
    [activities, plannerDateKey]
  );

  const habitualTemplates = useMemo(() => {
    const seen = new Set<string>();
    return activities.filter((a) => {
      if (!a.isHabitualTemplate) return false;
      const k = a.title.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [activities]);

  useEffect(() => {
    if (!runningActivityId) return;
    const act = activities.find((a) => a.id === runningActivityId);
    if (!act) {
      setRunningActivityId(null);
      return;
    }
    const targetSec = Math.max(60, (act.durationMinutes || 25) * 60);
    const interval = window.setInterval(() => {
      setLiveSeconds((prev) => {
        const next = prev + 1;
        if (next === targetSec) {
          playHabitAlertSound({
            tone: 'acorde',
            volume: 0.85,
            repeats: 2,
            spokenMessage: `Bloque completado: ${act.title}`,
          });
          setAlarmDoneActivityTitle(act.title);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [runningActivityId, activities]);

  const handleToggleSecondaryEmotion = (label: string) => {
    setSecondaryEmotions((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label].slice(0, 10)
    );
  };

  const handleSaveReflection = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSavingReflection(true);
    try {
      await saveReflection({
        dateKey: plannerDateKey,
        dailyAnswer,
        gratitudeNote,
        tomorrowPriorities: tomorrowPrioritiesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        tomorrowPrepDone,
        eveningNote,
        happinessScore,
        primaryEmotion,
        secondaryEmotions,
        emotionNote,
      });
      flashNotice('ok', `Reflexión y registro emocional de ${plannerDateKey} guardados.`);
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'No se pudo guardar la reflexión.');
    } finally {
      setSavingReflection(false);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;
    try {
      await createActivity({
        dateKey: plannerDateKey,
        title: actTitle.trim(),
        category: actCategory,
        scheduledTime: actTime || '09:00',
        durationMinutes: actDuration,
        notes: actNotes,
        isHabitualTemplate: actIsHabitual,
      });
      setActTitle('');
      setActNotes('');
      setActIsHabitual(false);
      flashNotice('ok', 'Actividad agregada a tu planificador.');
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'No se pudo crear la actividad.');
    }
  };

  const handleActivityTimerAction = async (
    act: LastDayActivity,
    action: 'start' | 'pause' | 'resume' | 'finish'
  ) => {
    try {
      if (action === 'start' || action === 'resume') {
        if (runningActivityId && runningActivityId !== act.id) {
          const prevAct = activities.find((a) => a.id === runningActivityId);
          if (prevAct) {
            await updateActivity(prevAct, { status: 'pausado', elapsedSeconds: liveSeconds });
          }
        }
        setRunningActivityId(act.id);
        setLiveSeconds(act.elapsedSeconds || 0);
        await updateActivity(act, { status: 'en_curso', elapsedSeconds: act.elapsedSeconds || 0 });
      } else if (action === 'pause') {
        const currentElapsed = runningActivityId === act.id ? liveSeconds : act.elapsedSeconds;
        if (runningActivityId === act.id) setRunningActivityId(null);
        await updateActivity(act, { status: 'pausado', elapsedSeconds: currentElapsed });
      } else if (action === 'finish') {
        const currentElapsed = runningActivityId === act.id ? liveSeconds : act.elapsedSeconds;
        if (runningActivityId === act.id) setRunningActivityId(null);
        stopHabitAlertSound();
        setAlarmDoneActivityTitle(null);
        await updateActivity(act, { status: 'completada', elapsedSeconds: currentElapsed });
        flashNotice('ok', `Actividad "${act.title}" finalizada.`);
      }
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'Error actualizando el temporizador.');
    }
  };

  const handleRolloverPending = async () => {
    try {
      const movedCount = await rolloverPendingActivitiesToNextDay(plannerDateKey, tomorrowKey);
      if (movedCount === 0) {
        flashNotice('ok', 'No había actividades pendientes para trasladar.');
      } else {
        flashNotice('ok', `${movedCount} actividad(es) pendiente(s) trasladadas al ${tomorrowKey}.`);
      }
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'No se pudieron trasladar las actividades.');
    }
  };

  // Crisis detector watching active text fields silently
  const clientCrisisBanner = useMemo(() => {
    const combined = [dailyAnswer, emotionNote, eveningNote].join('\n');
    const check = detectEmotionalCrisis(combined);
    if (!check.isCrisis) return null;
    return getCrisisSupportResources(profile?.country).slice(0, 4);
  }, [dailyAnswer, emotionNote, eveningNote, profile?.country]);

  // ============================================================================
  // TAB 2: SUEÑOS, OBJETIVOS & CALENDARIO FABRO
  // ============================================================================
  const [editingDreamId, setEditingDreamId] = useState<string | undefined>(undefined);
  const [dreamTitle, setDreamTitle] = useState('');
  const [dreamDesc, setDreamDesc] = useState('');
  const [dreamCat, setDreamCat] = useState<LastDayDreamCategory>('viajes');
  const [dreamTargetDate, setDreamTargetDate] = useState('');
  const [dreamStepsText, setDreamStepsText] = useState('');

  const loadDreamIntoEditor = (dream: LastDayDream) => {
    setEditingDreamId(dream.id);
    setDreamTitle(dream.title);
    setDreamDesc(dream.description || '');
    setDreamCat(dream.category);
    setDreamTargetDate(dream.targetDate || '');
    setDreamStepsText((dream.steps || []).join('\n'));
  };

  const clearDreamEditor = () => {
    setEditingDreamId(undefined);
    setDreamTitle('');
    setDreamDesc('');
    setDreamCat('viajes');
    setDreamTargetDate('');
    setDreamStepsText('');
  };

  const handleCreateDream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dreamTitle.trim()) return;
    try {
      const existing = editingDreamId ? dreams.find((d) => d.id === editingDreamId) : undefined;
      await saveDream({
        id: editingDreamId,
        title: dreamTitle.trim(),
        description: dreamDesc.trim(),
        category: dreamCat,
        status: existing?.status || 'pendiente',
        targetDate: dreamTargetDate,
        steps: dreamStepsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        linkedCalendarEventId: existing?.linkedCalendarEventId,
      });
      clearDreamEditor();
      flashNotice(
        'ok',
        existing ? 'Sueño / objetivo actualizado correctamente.' : 'Sueño / objetivo guardado en tu lista personal.'
      );
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'No se pudo guardar el objetivo.');
    }
  };

  const handleCycleDreamStatus = async (dream: LastDayDream) => {
    const nextStatus: LastDayDreamStatus =
      dream.status === 'pendiente'
        ? 'en_marcha'
        : dream.status === 'en_marcha'
        ? 'cumplido'
        : 'pendiente';
    await saveDream({
      id: dream.id,
      title: dream.title,
      description: dream.description,
      category: dream.category,
      status: nextStatus,
      targetDate: dream.targetDate,
      steps: dream.steps,
      linkedCalendarEventId: dream.linkedCalendarEventId,
    });
  };

  // ============================================================================
  // TAB 3: DIARIO PERSONAL & ESCRITURA CREATIVA / AUTOBIOGRÁFICA
  // ============================================================================
  const [writingFilter, setWritingFilter] = useState<LastDayWritingType | 'todas'>('todas');
  const [editingWritingId, setEditingWritingId] = useState<string | undefined>(undefined);
  const [writingType, setWritingType] = useState<LastDayWritingType>('diario');
  const [writingTitle, setWritingTitle] = useState('');
  const [writingBody, setWritingBody] = useState('');
  const [writingMoodTag, setWritingMoodTag] = useState('');
  const [writingDate, setWritingDate] = useState(todayKey);
  const [writingAiSummary, setWritingAiSummary] = useState('');
  const [writingAiLoading, setWritingAiLoading] = useState(false);

  const filteredWritings = useMemo(() => {
    if (writingFilter === 'todas') return writings;
    return writings.filter((w) => w.writingType === writingFilter);
  }, [writings, writingFilter]);

  const loadWritingIntoEditor = (w: LastDayWriting) => {
    setEditingWritingId(w.id);
    setWritingType(w.writingType);
    setWritingTitle(w.title);
    setWritingBody(w.contentText);
    setWritingMoodTag(w.moodTag || '');
    setWritingDate(w.dateKey || todayKey);
    setWritingAiSummary(w.aiSummary || '');
  };

  const clearWritingEditor = () => {
    setEditingWritingId(undefined);
    setWritingTitle('');
    setWritingBody('');
    setWritingMoodTag('');
    setWritingDate(todayKey);
    setWritingAiSummary('');
  };

  const handleSaveWriting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!writingTitle.trim() && !writingBody.trim()) return;
    try {
      const html = writingBody
        .split('\n')
        .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join('');
      const savedId = await saveWriting({
        id: editingWritingId,
        writingType,
        title: writingTitle.trim() || 'Escrito personal',
        contentHtml: html,
        contentText: writingBody,
        moodTag: writingMoodTag,
        dateKey: writingDate || todayKey,
        aiSummary: writingAiSummary,
      });
      setEditingWritingId(savedId);
      flashNotice('ok', 'Escrito guardado en tu archivo privado.');
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'No se pudo guardar el escrito.');
    }
  };

  // ============================================================================
  // TAB 4: RECUERDOS, FOTOS, VIDEOS, GUSTOS Y PORTALES
  // ============================================================================
  const [editingMemoryId, setEditingMemoryId] = useState<string | undefined>(undefined);
  const [memoryMediaType, setMemoryMediaType] = useState<LastDayMemoryMediaType>('foto');
  const [memoryPrefKind, setMemoryPrefKind] = useState<LastDayMemoryPrefKind>('recuerdo');
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryStory, setMemoryStory] = useState('');
  const [memoryUrl, setMemoryUrl] = useState('');
  const [memoryCreator, setMemoryCreator] = useState('');
  const [memoryPeoplePlace, setMemoryPeoplePlace] = useState('');
  const [memoryDate, setMemoryDate] = useState(todayKey);
  const [memoryFile, setMemoryFile] = useState<File | null>(null);
  const [savingMemory, setSavingMemory] = useState(false);

  const loadMemoryIntoEditor = (mem: LastDayMemory) => {
    setEditingMemoryId(mem.id);
    setMemoryMediaType(mem.mediaType);
    setMemoryPrefKind(mem.prefKind);
    setMemoryTitle(mem.title);
    setMemoryStory(mem.story || '');
    setMemoryUrl(mem.mediaUrl || '');
    setMemoryCreator(mem.creatorOrArtist || '');
    setMemoryPeoplePlace(mem.locationOrPeople || '');
    setMemoryDate(mem.memoryDate || todayKey);
    setMemoryFile(null);
  };

  const clearMemoryEditor = () => {
    setEditingMemoryId(undefined);
    setMemoryTitle('');
    setMemoryStory('');
    setMemoryUrl('');
    setMemoryCreator('');
    setMemoryPeoplePlace('');
    setMemoryDate(todayKey);
    setMemoryFile(null);
  };

  const [favoritePortals, setFavoritePortals] = useState<PortalEntry[]>([]);
  const [loadingPortals, setLoadingPortals] = useState(false);

  useEffect(() => {
    if (activeTab !== 'recuerdos') return;
    let active = true;
    setLoadingPortals(true);
    const loadFavPortals = async () => {
      try {
        const resp = await authFetch('/api/portals/me/explorer');
        if (!resp.ok) return;
        const data = (await resp.json()) as {
          portals?: PortalEntry[];
          userPrefs?: { favoritePortalIds?: string[]; customPortals?: PortalEntry[] };
        };
        const all = [...(data.portals || []), ...(data.userPrefs?.customPortals || [])];
        const favIds = data.userPrefs?.favoritePortalIds || [];
        const picked =
          favIds.length > 0
            ? all.filter((p) => favIds.includes(p.id))
            : all.filter((p) => p.active).slice(0, 6);
        if (active) setFavoritePortals(picked.slice(0, 8));
      } catch {
        // non-blocking
      } finally {
        if (active) setLoadingPortals(false);
      }
    };
    void loadFavPortals();
    return () => {
      active = false;
    };
  }, [activeTab]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryTitle.trim()) return;
    setSavingMemory(true);
    try {
      const existing = editingMemoryId ? memories.find((m) => m.id === editingMemoryId) : undefined;
      const ytId = memoryMediaType === 'video' ? extractYoutubeId(memoryUrl) : '';
      await saveMemory({
        id: editingMemoryId,
        mediaType: memoryMediaType,
        prefKind: memoryMediaType === 'preferencia' ? memoryPrefKind : 'recuerdo',
        title: memoryTitle.trim(),
        story: memoryStory.trim(),
        mediaUrl: memoryUrl.trim(),
        file: memoryFile,
        youtubeVideoId: ytId,
        creatorOrArtist: memoryCreator.trim(),
        locationOrPeople: memoryPeoplePlace.trim(),
        memoryDate: memoryDate || todayKey,
        favorite: existing?.favorite,
      });
      clearMemoryEditor();
      flashNotice(
        'ok',
        existing ? 'Recuerdo o preferencia actualizado correctamente.' : 'Recuerdo o preferencia guardado en tu galería privada.'
      );
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'No se pudo guardar el recuerdo.');
    } finally {
      setSavingMemory(false);
    }
  };

  // ============================================================================
  // TAB 5: MI LEGADO (100% PRIVADO, CONSENTIMIENTO EXPLÍCITO, SIN ENVÍO AUTOMÁTICO)
  // ============================================================================
  const [editingLegacyId, setEditingLegacyId] = useState<string | undefined>(undefined);
  const [legRecipient, setLegRecipient] = useState('');
  const [legRelation, setLegRelation] = useState('');
  const [legTitle, setLegTitle] = useState('');
  const [legMessage, setLegMessage] = useState('');
  const [legMediaHint, setLegMediaHint] = useState('');
  const [legConsent, setLegConsent] = useState(false);

  const loadLegacyIntoEditor = (item: LastDayLegacy) => {
    setEditingLegacyId(item.id);
    setLegRecipient(item.recipientName);
    setLegRelation(item.relationship || '');
    setLegTitle(item.title);
    setLegMessage(item.message);
    setLegMediaHint(item.mediaHint || '');
    setLegConsent(Boolean(item.consentConfirmed));
  };

  const clearLegacyEditor = () => {
    setEditingLegacyId(undefined);
    setLegRecipient('');
    setLegRelation('');
    setLegTitle('');
    setLegMessage('');
    setLegMediaHint('');
    setLegConsent(false);
  };

  const handleSaveLegacy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const wasEditing = Boolean(editingLegacyId);
      await saveLegacy({
        id: editingLegacyId,
        recipientName: legRecipient,
        relationship: legRelation,
        title: legTitle,
        message: legMessage,
        mediaHint: legMediaHint,
        consentConfirmed: legConsent,
      });
      clearLegacyEditor();
      flashNotice(
        'ok',
        wasEditing ? 'Mensaje actualizado en tu bóveda privada de Mi Legado.' : 'Mensaje guardado en tu bóveda privada de Mi Legado.'
      );
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'Revisá los campos y el consentimiento.');
    }
  };

  // ============================================================================
  // TAB 6: FABRO IA — CONSEJERO PERSONAL
  // ============================================================================
  const [counselorProvider, setCounselorProvider] = useState<'auto' | AIProviderId>('auto');
  const [counselorModelId, setCounselorModelId] = useState<string>('');
  const [counselorPersonalId, setCounselorPersonalId] = useState<string>('');
  const [counselorTask, setCounselorTask] = useState<string>('reflexion');
  const [counselorPrompt, setCounselorPrompt] = useState('');
  const [counselorSending, setCounselorSending] = useState(false);
  const [counselorMessages, setCounselorMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      text: string;
      meta?: string;
      isCrisisSupport?: boolean;
      helplines?: CrisisHelpline[];
    }>
  >([]);

  const verifiedPersonalCounselorConns = useMemo(
    () => personalConnections.filter((c) => c.status === 'connected' && c.lastTestStatus === 'verified'),
    [personalConnections]
  );

  useEffect(() => {
    const syncBienestarPref = () => {
      const pref = getSectorAiPreferences(user?.uid).bienestar;
      if (pref.providerMode === 'personal' && pref.personalConnectionId) {
        const found = verifiedPersonalCounselorConns.find((c) => c.id === pref.personalConnectionId);
        if (found) {
          setCounselorPersonalId(found.id);
          return;
        }
      }
      setCounselorPersonalId('');
      if (pref.providerMode === 'fabro_gemini') {
        setCounselorProvider('gemini');
      } else if (pref.providerMode === 'fabro_openai') {
        setCounselorProvider('openai');
      } else {
        setCounselorProvider('auto');
      }
    };
    syncBienestarPref();
    window.addEventListener('fabro-sector-ai-updated', syncBienestarPref);
    return () => window.removeEventListener('fabro-sector-ai-updated', syncBienestarPref);
  }, [user?.uid, verifiedPersonalCounselorConns]);

  const enabledCounselorProviders = useMemo(
    () => providers.filter((p) => p.enabled),
    [providers]
  );

  const availableCounselorModels = useMemo(() => {
    if (counselorProvider === 'auto') return [];
    return models.filter((m) => m.providerId === counselorProvider && m.enabled);
  }, [models, counselorProvider]);

  const askCounselorIA = async (override?: {
    taskType: string;
    prompt: string;
    diaryText?: string;
    writingType?: string;
  }) => {
    const finalPrompt = (override?.prompt ?? counselorPrompt).trim();
    const finalTask = override?.taskType || counselorTask;
    if (!finalPrompt && !override?.diaryText) return;

    const userBubbleText = finalPrompt;
    setCounselorMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', text: userBubbleText },
    ]);
    if (!override) setCounselorPrompt('');

    // Zero-quota client pre-check if self-harm phrase detected
    const localSafety = detectEmotionalCrisis(`${finalPrompt}\n${override?.diaryText || ''}`);
    if (localSafety.isCrisis) {
      const helplines = getCrisisSupportResources(profile?.country);
      setCounselorMessages((prev) => [
        ...prev,
        {
          id: `c_${Date.now()}`,
          role: 'assistant',
          isCrisisSupport: true,
          helplines,
          meta: 'Protección emocional inmediata · Sin consumo de cuota',
          text:
            'Tu vida y tu bienestar son prioridad absoluta. Si estás atravesando un momento difícil o pensás en hacerte daño, por favor buscá compañía humana inmediata y comunicarte con estas líneas gratuitas de apoyo:',
        },
      ]);
      return;
    }

    setCounselorSending(true);
    try {
      const activitiesCtx = plannerActivities
        .slice(0, 8)
        .map((a) => `- [${a.scheduledTime}] ${a.title} (${a.status})`)
        .join('\n');
      const prefsCtx = memories
        .filter((m) => m.mediaType === 'preferencia' || m.favorite)
        .slice(0, 8)
        .map((m) => `- ${m.prefKind}: ${m.title}${m.creatorOrArtist ? ` (${m.creatorOrArtist})` : ''}`)
        .join('\n');

      if (counselorPersonalId) {
        const conn = verifiedPersonalCounselorConns.find((c) => c.id === counselorPersonalId);
        if (conn) {
          const personalPrompt = [
            finalPrompt,
            override?.diaryText ? `\n\nTexto personal (${override.writingType || 'diario'}):\n${override.diaryText}` : '',
            `\nEstado emocional actual: Felicidad ${happinessScore}/10, ${primaryEmotion}.`,
            activitiesCtx ? `\nActividades de hoy:\n${activitiesCtx}` : '',
            prefsCtx ? `\nGustos personales:\n${prefsCtx}` : '',
          ]
            .filter(Boolean)
            .join('');
          const pRes = await sendPersonalChat({
            connectionId: conn.id,
            prompt: personalPrompt,
            systemInstruction:
              'Sos FABRO IA — Consejero Personal empático y respetuoso. Acompañá reflexiones, redacción y organización de hábitos en español sin realizar diagnósticos médicos ni psicológicos.',
            history: counselorMessages
              .filter((m) => !m.isCrisisSupport)
              .slice(-8)
              .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text })),
          });
          setCounselorMessages((prev) => [
            ...prev,
            {
              id: `a_${Date.now()}`,
              role: 'assistant',
              text: pRes.text,
              meta: `Personal BYOK · ${pRes.connectionLabel} (${pRes.modelUsed})`,
            },
          ]);
          return;
        }
      }

      const resp = await authFetch('/api/ai/counselor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: finalTask,
          prompt: finalPrompt,
          diaryText: override?.diaryText || '',
          writingType: override?.writingType || '',
          happinessScore,
          emotionsContext: `Principal: ${primaryEmotion}. Secundarias: ${secondaryEmotions.join(', ') || 'ninguna'}. Nota: ${emotionNote || 'sin nota'}`,
          activitiesSummary: activitiesCtx,
          preferencesSummary: prefsCtx,
          country: profile?.country || '',
          isMinor: Boolean(profile?.isMinor),
          routingMode: counselorProvider === 'auto' ? 'automatica' : 'manual',
          requestedProviderId: counselorProvider === 'auto' ? undefined : counselorProvider,
          requestedModelId: counselorModelId || undefined,
          history: counselorMessages
            .filter((m) => !m.isCrisisSupport)
            .slice(-8)
            .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text })),
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
        code?: string;
        providerUsed?: string;
        modelUsed?: string;
        isCrisisSupport?: boolean;
        helplines?: CrisisHelpline[];
      };

      if (resp.status === 429) {
        openPlansModal(data.error || 'Límite diario de FABRO IA alcanzado.');
        return;
      }

      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo conectar con FABRO IA.');
      }

      setCounselorMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.text || '',
          isCrisisSupport: Boolean(data.isCrisisSupport),
          helplines: data.helplines || [],
          meta: data.providerUsed
            ? `${data.providerUsed}${data.modelUsed ? ` · ${data.modelUsed}` : ''}`
            : 'FABRO IA Consejero Personal',
        },
      ]);
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'Error al consultar al Consejero IA.');
    } finally {
      setCounselorSending(false);
    }
  };

  const handleWritingAiAction = async (mode: 'mejorar' | 'resumir') => {
    if (!writingBody.trim()) {
      flashNotice('err', 'Escribí primero un texto para que el Consejero IA pueda ayudarte.');
      return;
    }
    setWritingAiLoading(true);
    try {
      const prompt =
        mode === 'resumir'
          ? `Resumí con sensibilidad y claridad esta entrada de ${writingType} titulada "${writingTitle || 'Sin título'}", destacando sus ideas y sentimientos principales:`
          : `Ayudame a revisar, enriquecer o proponer continuaciones respetando mi voz para este ${writingType} titulado "${writingTitle || 'Sin título'}":`;

      const resp = await authFetch('/api/ai/counselor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: mode === 'resumir' ? 'resumen_diario' : 'redaccion_texto',
          prompt,
          diaryText: writingBody,
          writingType,
          country: profile?.country || '',
          isMinor: Boolean(profile?.isMinor),
          routingMode: counselorProvider === 'auto' ? 'automatica' : 'manual',
          requestedProviderId: counselorProvider === 'auto' ? undefined : counselorProvider,
          requestedModelId: counselorModelId || undefined,
        }),
      });
      const data = (await resp.json().catch(() => ({}))) as { text?: string; error?: string };
      if (resp.status === 429) {
        openPlansModal(data.error || 'Límite diario alcanzado.');
        return;
      }
      if (!resp.ok) throw new Error(data.error || 'No se pudo procesar el texto con IA.');

      if (mode === 'resumir') {
        setWritingAiSummary(data.text || '');
        flashNotice('ok', 'Resumen generado. Podés guardarlo junto a tu escrito.');
      } else {
        setCounselorMessages((prev) => [
          ...prev,
          { id: `u_${Date.now()}`, role: 'user', text: `${prompt}\n\n${writingBody.slice(0, 400)}...` },
          { id: `a_${Date.now() + 1}`, role: 'assistant', text: data.text || '', meta: 'Sugerencia de escritura' },
        ]);
        setActiveTab('consejero');
      }
    } catch (err) {
      flashNotice('err', err instanceof Error ? err.message : 'Error trabajando con FABRO IA.');
    } finally {
      setWritingAiLoading(false);
    }
  };

  // ============================================================================
  // TAB 7: COMUNIDAD, GRUPOS, SOLICITUDES DE CONTACTO & MODERACIÓN
  // ============================================================================
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [contactIntroByUid, setContactIntroByUid] = useState<Record<string, string>>({});
  const [reportTarget, setReportTarget] = useState<PublicUserProfile | null>(null);
  const [reportReason, setReportReason] = useState('Contenido inapropiado o irrespetuoso');

  const blockedSet = useMemo(() => new Set(profile?.blockedUserIds || []), [profile?.blockedUserIds]);

  const visibleAdultPeers = useMemo(
    () =>
      publicProfiles.filter(
        (p) => p.uid !== user?.uid && !p.isMinor && !blockedSet.has(p.uid)
      ),
    [publicProfiles, user?.uid, blockedSet]
  );

  const pendingRolloverCount = useMemo(
    () =>
      plannerActivities.filter(
        (a) => a.status === 'pendiente' || a.status === 'pausado' || a.status === 'en_curso'
      ).length,
    [plannerActivities]
  );

  const upcomingCalendarItems = useMemo(
    () =>
      calendarEvents
        .filter((e) => !e.completed && e.date >= todayKey)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5),
    [calendarEvents, todayKey]
  );

  return (
    <div className="space-y-6">
      {/* PREMIUM COVER HERO — AZUL NOCHE · DORADO · VIOLETA · BLANCO CÁLIDO */}
      <section className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-[#0B1120] text-[#FAF6F0] shadow-xl">
        <img
          src={lastDayCoverImg}
          alt="Amanecer sobre horizonte cálido"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0B1120]/95 via-[#131B31]/85 to-[#2D1B4E]/85" />

        <div className="relative p-5 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-amber-300">
              <Sun className="w-4 h-4 text-amber-300 shrink-0" />
              <span>Módulo Oficial Integrado en FABRO</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveSection('calendario')}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#FAF6F0]/20 bg-[#FAF6F0]/5 px-3 py-2 text-xs font-semibold text-[#FAF6F0] hover:bg-[#FAF6F0]/15 transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-300" />
                Calendario FABRO
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('bienestar-panel')}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-300 px-3.5 py-2 text-xs font-bold text-[#0B1120] hover:from-amber-300 hover:to-amber-200 transition-colors cursor-pointer"
              >
                Volver a Bienestar Personal
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-8 space-y-2.5">
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#FAF6F0]">
                EL ÚLTIMO DÍA DE TU VIDA
              </h2>
              <p className="text-base sm:text-lg font-medium text-amber-200/95 italic">
                «Si hoy fuera tu último día, ¿cómo elegirías vivirlo?»
              </p>
              <p className="text-xs sm:text-sm text-[#FAF6F0]/75 max-w-2xl leading-relaxed">
                Un espacio sereno para valorar tu presente, cuidar tu bienestar, cumplir sueños pendientes,
                escribir tu historia y acompañar cada día con sentido — conectado con las herramientas de FABRO.
              </p>
            </div>

            <div className="lg:col-span-4 grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl border border-amber-300/20 bg-[#0B1120]/65 px-2.5 py-3">
                <p className="text-[10px] uppercase tracking-wider text-amber-300/80">Felicidad hoy</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-[#FAF6F0]">
                  {happinessScore}/10
                </p>
              </div>
              <div className="rounded-xl border border-violet-300/20 bg-[#0B1120]/65 px-2.5 py-3">
                <p className="text-[10px] uppercase tracking-wider text-violet-300/80">Sueños</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-[#FAF6F0]">
                  {dreams.filter((d) => d.status !== 'cumplido').length}
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-[#0B1120]/65 px-2.5 py-3">
                <p className="text-[10px] uppercase tracking-wider text-amber-200/80">Escritos</p>
                <p className="mt-1 font-display text-xl font-bold tabular-nums text-[#FAF6F0]">
                  {writings.length}
                </p>
              </div>
            </div>
          </div>

          {/* STICKY RESPONSIVE TAB RAIL (min-h 44px for Android touch) */}
          <div
            role="tablist"
            aria-label="Secciones de EL ÚLTIMO DÍA DE TU VIDA"
            className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-t border-[#FAF6F0]/15"
          >
            {(
              [
                { id: 'hoy', label: 'Hoy y Planificador', icon: Sun },
                { id: 'suenos', label: 'Sueños y Agenda', icon: Compass },
                { id: 'diario', label: 'Diario y Escritura', icon: Feather },
                { id: 'recuerdos', label: 'Recuerdos y Gustos', icon: ImageIcon },
                { id: 'legado', label: 'Mi Legado', icon: Lock },
                { id: 'consejero', label: 'Consejero IA', icon: Sparkles },
                { id: 'comunidad', label: 'Comunidad', icon: Users },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-400 to-amber-300 text-[#0B1120] shadow-md'
                      : 'border border-[#FAF6F0]/15 bg-[#0B1120]/50 text-[#FAF6F0]/85 hover:bg-[#FAF6F0]/10'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {statusNotice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-xs flex items-center justify-between gap-3 ${
            statusNotice.type === 'ok'
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
          }`}
        >
          <span>{statusNotice.text}</span>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-xs font-bold underline cursor-pointer shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {alarmDoneActivityTitle && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Tiempo cumplido para: «{alarmDoneActivityTitle}»</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopHabitAlertSound();
              setAlarmDoneActivityTitle(null);
            }}
            className="min-h-[40px] rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-[#0B1120] cursor-pointer"
          >
            Silenciar aviso
          </button>
        </div>
      )}

      {clientCrisisBanner && (
        <aside
          aria-label="Apoyo humano inmediato"
          className="rounded-2xl border border-violet-500/40 bg-violet-950/90 text-[#FAF6F0] p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <HeartHandshake className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-amber-200">
                Acompañamiento humano disponible ahora
              </h3>
              <p className="text-xs text-[#FAF6F0]/85 leading-relaxed">
                Tu vida y tu bienestar importan mucho. Si estás pasando por un momento de angustia intensa,
                hablá con alguien de confianza o comunicarte gratis con una línea de ayuda:
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {clientCrisisBanner.map((line) => (
              <div
                key={`${line.country}_${line.number}`}
                className="rounded-xl border border-[#FAF6F0]/15 bg-[#0B1120]/70 p-3 text-xs"
              >
                <p className="font-bold text-amber-300">{line.country} — {line.service}</p>
                <p className="font-mono text-sm font-semibold text-[#FAF6F0] mt-0.5">{line.number}</p>
                <p className="text-[11px] text-[#FAF6F0]/70">{line.availability}</p>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* ======================================================================== */}
      {/* TAB 1: HOY Y PLANIFICADOR */}
      {/* ======================================================================== */}
      {activeTab === 'hoy' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Reflexión diaria, Felicidad 1-10, Emociones & Rutina Nocturna */}
          <div className="lg:col-span-6 space-y-6">
            <form
              onSubmit={(e) => void handleSaveReflection(e)}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Reflexión y Bienestar del Día
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Fecha activa: {plannerDateKey}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPlannerDateKey(todayKey)}
                    className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      plannerDateKey === todayKey
                        ? 'bg-[#131B31] text-amber-300'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlannerDateKey(tomorrowKey)}
                    className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                      plannerDateKey === tomorrowKey
                        ? 'bg-[#131B31] text-amber-300'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    Mañana
                  </button>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Si hoy fuera tu último día, ¿qué elegirías hacer, decir o agradecer?
                </span>
                <textarea
                  rows={4}
                  value={dailyAnswer}
                  onChange={(e) => setDailyAnswer(e.target.value)}
                  placeholder="Escribí con sinceridad lo que le da valor real a este día..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  ¿Qué te hace bien o feliz hoy? (gratitud y pequeños placeres)
                </span>
                <input
                  type="text"
                  value={gratitudeNote}
                  onChange={(e) => setGratitudeNote(e.target.value)}
                  placeholder="Ej: Un café tranquilo, charlar con mi familia, música favorita..."
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </label>

              {/* Felicidad 1-10 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    Registro de felicidad (1 al 10)
                  </span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-300">
                    {happinessScore} / 10
                  </span>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setHappinessScore(num)}
                      className={`min-h-[44px] rounded-lg font-mono text-sm font-bold transition-colors cursor-pointer ${
                        happinessScore === num
                          ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-[#0B1120] shadow-sm'
                          : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300 hover:border-amber-400'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Registro de Emociones */}
              <div className="space-y-2.5">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Emoción principal de hoy
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {EMOTION_OPTIONS.map((em) => (
                    <button
                      key={em.id}
                      type="button"
                      onClick={() => setPrimaryEmotion(em.id)}
                      className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        primaryEmotion === em.id
                          ? 'bg-violet-600 text-white shadow-sm'
                          : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300 hover:border-violet-400'
                      }`}
                    >
                      {em.label}
                    </button>
                  ))}
                </div>

                <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 pt-1">
                  Matices emocionales (opcional)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {SECONDARY_EMOTION_POOL.map((label) => {
                    const selected = secondaryEmotions.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => handleToggleSecondaryEmotion(label)}
                        className={`min-h-[38px] rounded-lg px-2 py-1 text-[11px] font-medium cursor-pointer transition-colors ${
                          selected
                            ? 'bg-violet-500/20 border border-violet-500 text-violet-700 dark:text-violet-300'
                            : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  value={emotionNote}
                  onChange={(e) => setEmotionNote(e.target.value)}
                  placeholder="¿Por qué te sentís así hoy? (privado para vos)"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>

              {/* Rutina nocturna: preparar el día siguiente */}
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Moon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-violet-800 dark:text-violet-200">
                      Rutina para preparar el día siguiente
                    </h4>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tomorrowPrepDone}
                      onChange={(e) => setTomorrowPrepDone(e.target.checked)}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span>Lista para mañana</span>
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={tomorrowPrioritiesText}
                  onChange={(e) => setTomorrowPrioritiesText(e.target.value)}
                  placeholder="Tus 1 a 3 prioridades para mañana (una por línea)..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={eveningNote}
                  onChange={(e) => setEveningNote(e.target.value)}
                  placeholder="Cierre en calma de hoy: ¿qué soltás antes de dormir?"
                  className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="submit"
                  disabled={savingReflection}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#131B31] px-5 py-2.5 text-xs font-bold text-amber-300 hover:bg-[#1E2947] disabled:opacity-60 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {savingReflection ? 'Guardando...' : 'Guardar reflexión de hoy'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('consejero');
                    void askCounselorIA({
                      taskType: 'ordenar_emociones',
                      prompt:
                        'Acabo de registrar mi reflexión y emociones de hoy. ¿Me ayudás a ordenar mis pensamientos y sugerir un pequeño ejercicio de reflexión positiva?',
                    });
                  }}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 px-4 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Conversar con Consejero IA
                </button>
              </div>
            </form>

            {/* Motivación y reflexión positiva */}
            <section className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[#131B31] to-[#1E1638] p-5 text-[#FAF6F0] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <Heart className="w-4 h-4" />
                  <span>Motivación y enfoque positivo</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMotivationIndex((prev) => (prev + 1) % MOTIVATIONAL_REFLECTIONS.length)}
                  className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-[#FAF6F0]/20 px-2.5 py-1 text-[11px] font-semibold text-[#FAF6F0] hover:bg-[#FAF6F0]/10 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Otra idea
                </button>
              </div>
              <p className="text-sm leading-relaxed text-[#FAF6F0]/95">
                «{MOTIVATIONAL_REFLECTIONS[motivationIndex]}»
              </p>
            </section>
          </div>

          {/* Right Column: Planificador de actividades con horarios, temporizadores y traslado al día siguiente */}
          <div className="lg:col-span-6 space-y-6">
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Planificador y Temporizadores ({plannerDateKey})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Iniciá, pausá, continuá o finalizá tus bloques con aviso sonoro.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={requestOpenHabitStudio}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-amber-400 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Abrir Hábitos y Bienestar
                  </button>

                  {pendingRolloverCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleRolloverPending()}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      Trasladar {pendingRolloverCount} pendientes al día siguiente
                    </button>
                  )}
                </div>
              </div>

              <form onSubmit={(e) => void handleAddActivity(e)} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#090D16]/70 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    type="text"
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                    placeholder="Nueva actividad (ej: Llamar a mamá, caminar, leer...)"
                    className="sm:col-span-7 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                  <input
                    type="time"
                    value={actTime}
                    onChange={(e) => setActTime(e.target.value)}
                    className="sm:col-span-3 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={480}
                    value={actDuration}
                    onChange={(e) => setActDuration(Number(e.target.value) || 25)}
                    title="Duración en minutos"
                    className="sm:col-span-2 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <select
                    value={actCategory}
                    onChange={(e) => setActCategory(e.target.value as LastDayActivityCategory)}
                    className="sm:col-span-5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
                  >
                    {ACTIVITY_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={actNotes}
                    onChange={(e) => setActNotes(e.target.value)}
                    placeholder="Nota breve (opcional)"
                    className="sm:col-span-7 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-2 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={actIsHabitual}
                      onChange={(e) => setActIsHabitual(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span>Guardar también como actividad habitual / que me hace feliz</span>
                  </label>
                  <button
                    type="submit"
                    className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar bloque
                  </button>
                </div>
              </form>

              {habitualTemplates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Reutilizar tus actividades que te hacen feliz
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {habitualTemplates.slice(0, 8).map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() =>
                          void createActivity({
                            dateKey: plannerDateKey,
                            title: tpl.title,
                            category: tpl.category,
                            scheduledTime: tpl.scheduledTime,
                            durationMinutes: tpl.durationMinutes,
                            notes: tpl.notes,
                            isHabitualTemplate: true,
                          })
                        }
                        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-amber-400 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-amber-500" />
                        {tpl.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loading && plannerActivities.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Cargando tu planificador...</p>
              ) : plannerActivities.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center space-y-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Todavía no sumaste actividades para {plannerDateKey}.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Agregá cosas simples que disfrutes o pasos concretos para vivir con plenitud hoy.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {plannerActivities.map((act) => {
                    const isRunningHere = runningActivityId === act.id;
                    const shownSeconds = isRunningHere ? liveSeconds : act.elapsedSeconds || 0;
                    const targetSeconds = (act.durationMinutes || 25) * 60;
                    const pct = Math.min(100, Math.round((shownSeconds / Math.max(1, targetSeconds)) * 100));

                    return (
                      <article
                        key={act.id}
                        className={`rounded-xl border p-4 space-y-3 transition-colors ${
                          isRunningHere
                            ? 'border-amber-400 bg-amber-500/5'
                            : act.status === 'completada'
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-[#090D16]/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                              <span>{act.scheduledTime || '--:--'}</span>
                              <span>·</span>
                              <span>{act.durationMinutes} min</span>
                              {act.rolledOverFromDate && (
                                <span className="text-amber-600 dark:text-amber-400">
                                  · Trasladada del {act.rolledOverFromDate}
                                </span>
                              )}
                            </div>
                            <h4
                              className={`text-sm font-bold ${
                                act.status === 'completada'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {act.title}
                            </h4>
                            {act.notes && (
                              <p className="text-xs text-slate-600 dark:text-slate-400">{act.notes}</p>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                              {formatChrono(shownSeconds)}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                              {act.status.replace('_', ' ')}
                            </p>
                          </div>
                        </div>

                        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-violet-500 to-amber-400 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {act.status === 'pendiente' && !isRunningHere && (
                              <button
                                type="button"
                                onClick={() => void handleActivityTimerAction(act, 'start')}
                                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-[#131B31] px-3 py-1.5 text-xs font-semibold text-amber-300 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Iniciar
                              </button>
                            )}
                            {isRunningHere && (
                              <button
                                type="button"
                                onClick={() => void handleActivityTimerAction(act, 'pause')}
                                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#0B1120] cursor-pointer"
                              >
                                <Pause className="w-3.5 h-3.5" />
                                Pausar
                              </button>
                            )}
                            {act.status === 'pausado' && !isRunningHere && (
                              <button
                                type="button"
                                onClick={() => void handleActivityTimerAction(act, 'resume')}
                                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Continuar
                              </button>
                            )}
                            {act.status !== 'completada' && act.status !== 'trasladada' && (
                              <button
                                type="button"
                                onClick={() => void handleActivityTimerAction(act, 'finish')}
                                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                              >
                                <Square className="w-3.5 h-3.5" />
                                Finalizar
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => void deleteActivity(act.id)}
                            aria-label={`Eliminar ${act.title}`}
                            className="min-h-[40px] p-2 rounded-lg text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 2: SUEÑOS, OBJETIVOS Y CALENDARIO */}
      {/* ======================================================================== */}
      {activeTab === 'suenos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={(e) => void handleCreateDream(e)}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {editingDreamId
                    ? 'Editando Sueño u Objetivo'
                    : 'Nuevo Sueño, Objetivo o Experiencia Pendiente'}
                </h3>
                {editingDreamId && (
                  <button
                    type="button"
                    onClick={clearDreamEditor}
                    className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <input
                type="text"
                required
                value={dreamTitle}
                onChange={(e) => setDreamTitle(e.target.value)}
                placeholder="Ej: Aprender a tocar guitarra / Viajar al sur con mis hijos"
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-sm text-slate-900 dark:text-white"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={dreamCat}
                  onChange={(e) => setDreamCat(e.target.value as LastDayDreamCategory)}
                  className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {DREAM_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={dreamTargetDate}
                  onChange={(e) => setDreamTargetDate(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <textarea
                rows={3}
                value={dreamDesc}
                onChange={(e) => setDreamDesc(e.target.value)}
                placeholder="¿Por qué es importante para vos vivir esta experiencia?"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
              />
              <textarea
                rows={2}
                value={dreamStepsText}
                onChange={(e) => setDreamStepsText(e.target.value)}
                placeholder="Pasos concretos para empezar (uno por línea)..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#131B31] px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-[#1E2947] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {editingDreamId ? 'Guardar cambios del sueño' : 'Agregar a mi lista de sueños'}
              </button>
            </form>

            {/* Resumen de Calendario FABRO y Recordatorios */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Agenda personal y recordatorios en FABRO
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveSection('calendario')}
                  className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                >
                  Abrir Calendario completo
                </button>
              </div>
              {upcomingCalendarItems.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No tenés próximos recordatorios agendados. Podés agendar cualquier sueño directo desde la lista.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {upcomingCalendarItems.map((ev) => (
                    <div key={ev.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{ev.title}</p>
                        <p className="text-[11px] text-slate-500">{ev.type}</p>
                      </div>
                      <span className="font-mono text-[11px] text-amber-600 dark:text-amber-300 shrink-0">
                        {ev.date}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Mis Sueños y Experiencias ({dreams.length})
            </h3>
            {dreams.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
                Aún no registraste sueños o metas vitales. Anotá el primero para transformarlo en pasos reales.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dreams.map((dream) => (
                  <article
                    key={dream.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="uppercase tracking-wider text-violet-600 dark:text-violet-400">
                          {DREAM_CATEGORIES.find((c) => c.id === dream.category)?.label || dream.category}
                        </span>
                        {dream.targetDate && (
                          <span className="font-mono text-slate-500">{dream.targetDate}</span>
                        )}
                      </div>
                      <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {dream.title}
                      </h4>
                      {dream.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {dream.description}
                        </p>
                      )}
                      {dream.steps.length > 0 && (
                        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          {dream.steps.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => void handleCycleDreamStatus(dream)}
                        className={`min-h-[38px] rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer ${
                          dream.status === 'cumplido'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : dream.status === 'en_marcha'
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        Estado: {dream.status.replace('_', ' ')}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => loadDreamIntoEditor(dream)}
                          aria-label={`Editar ${dream.title}`}
                          className="min-h-[38px] p-2 text-slate-500 hover:text-violet-600 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await linkDreamToFabroCalendar(dream);
                              flashNotice('ok', 'Objetivo agendado en tu Calendario FABRO.');
                            } catch (err) {
                              flashNotice('err', err instanceof Error ? err.message : 'Error agendando en calendario.');
                            }
                          }}
                          className="min-h-[38px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-violet-500 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-violet-500" />
                          {dream.linkedCalendarEventId ? 'Reagendar' : 'Agendar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (editingDreamId === dream.id) clearDreamEditor();
                            void deleteDream(dream.id);
                          }}
                          aria-label={`Eliminar ${dream.title}`}
                          className="min-h-[38px] p-2 text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 3: DIARIO PERSONAL Y EDITOR AVANZADO DE ESCRITURA */}
      {/* ======================================================================== */}
      {activeTab === 'diario' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <form
              onSubmit={(e) => void handleSaveWriting(e)}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {editingWritingId ? 'Editando escrito' : 'Nuevo Escrito Personal'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {WRITING_TYPES.find((t) => t.id === writingType)?.hint}
                  </p>
                </div>
                {editingWritingId && (
                  <button
                    type="button"
                    onClick={clearWritingEditor}
                    className="min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    + Crear nuevo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WRITING_TYPES.map((wt) => (
                  <button
                    key={wt.id}
                    type="button"
                    onClick={() => setWritingType(wt.id)}
                    className={`min-h-[42px] rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer ${
                      writingType === wt.id
                        ? 'bg-[#131B31] text-amber-300'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {wt.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <input
                  type="text"
                  required
                  value={writingTitle}
                  onChange={(e) => setWritingTitle(e.target.value)}
                  placeholder="Título de tu escrito..."
                  className="sm:col-span-6 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-sm font-semibold text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={writingMoodTag}
                  onChange={(e) => setWritingMoodTag(e.target.value)}
                  placeholder="Tono / emoción (ej: Gratitud)"
                  className="sm:col-span-3 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="date"
                  value={writingDate}
                  onChange={(e) => setWritingDate(e.target.value)}
                  className="sm:col-span-3 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <textarea
                rows={12}
                value={writingBody}
                onChange={(e) => setWritingBody(e.target.value)}
                placeholder="Escribí libremente tu diario, carta, poema, canción, relato o capítulo autobiográfico..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-4 text-sm leading-relaxed text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-mono tabular-nums">
                  {writingBody.trim() ? writingBody.trim().split(/\s+/).filter(Boolean).length : 0} palabras
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={writingAiLoading}
                    onClick={() => void handleWritingAiAction('mejorar')}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/10 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Mejorar con Consejero IA
                  </button>
                  <button
                    type="button"
                    disabled={writingAiLoading}
                    onClick={() => void handleWritingAiAction('resumir')}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                  >
                    Resumir esta entrada
                  </button>
                </div>
              </div>

              {writingAiSummary && (
                <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3.5 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                    Resumen generado bajo tu pedido
                  </p>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                    {writingAiSummary}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      void exportNoteToPdf({
                        title: writingTitle || 'Escrito personal',
                        subjectName: 'EL ÚLTIMO DÍA DE TU VIDA',
                        folder: writingType,
                        contentHtml: `<p>${writingBody.replace(/\n/g, '</p><p>')}</p>`,
                        contentText: writingBody,
                      })
                    }
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void exportNoteToWord({
                        title: writingTitle || 'Escrito personal',
                        subjectName: 'EL ÚLTIMO DÍA DE TU VIDA',
                        folder: writingType,
                        contentHtml: `<p>${writingBody.replace(/\n/g, '</p><p>')}</p>`,
                        contentText: writingBody,
                      })
                    }
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Word
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportMarkdownToText({
                        title: writingTitle || 'escrito',
                        markdown: `# ${writingTitle}\n\n${writingBody}`,
                        format: 'txt',
                      })
                    }
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
                  >
                    TXT
                  </button>
                  <button
                    type="button"
                    disabled={!writingTitle.trim() && !writingBody.trim()}
                    onClick={async () => {
                      try {
                        const html = writingBody
                          .split('\n')
                          .map((line) => `<p>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
                          .join('');
                        await createNote({
                          subjectId: '',
                          unit: '',
                          folder: 'El Último Día',
                          title: writingTitle.trim() || 'Escrito de El Último Día',
                          contentHtml: html,
                          contentText: writingBody,
                          tags: ['ultimo-dia', writingType],
                          attachments: [],
                          offlineAvailable: true,
                        });
                        flashNotice('ok', 'Escrito copiado también a tus Apuntes FABRO.');
                      } catch (err) {
                        flashNotice(
                          'err',
                          err instanceof Error ? err.message : 'No se pudo copiar a Apuntes FABRO.'
                        );
                      }
                    }}
                    className="min-h-[40px] inline-flex items-center gap-1 rounded-lg border border-sky-500/35 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/10 disabled:opacity-50 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Enviar a Apuntes FABRO
                  </button>
                </div>

                <button
                  type="submit"
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#131B31] px-5 py-2.5 text-xs font-bold text-amber-300 hover:bg-[#1E2947] cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Guardar escrito
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Tu Archivo Literario y Diario ({filteredWritings.length})
              </h3>
              <select
                value={writingFilter}
                onChange={(e) => setWritingFilter(e.target.value as LastDayWritingType | 'todas')}
                className="min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-1.5 text-xs font-semibold"
              >
                <option value="todas">Todos los géneros</option>
                {WRITING_TYPES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>

            {filteredWritings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center text-xs text-slate-500">
                No tenés escritos guardados en esta categoría todavía.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWritings.map((w) => (
                  <article
                    key={w.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="uppercase font-bold text-violet-600 dark:text-violet-400">
                        {w.writingType}
                      </span>
                      <span className="font-mono">{w.dateKey} · {w.wordCount} pal.</span>
                    </div>
                    <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                      {w.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                      {w.contentText}
                    </p>
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => loadWritingIntoEditor(w)}
                        className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                      >
                        Abrir y editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteWriting(w.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                        aria-label={`Eliminar ${w.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 4: RECUERDOS, FOTOS, VIDEOS, PREFERENCIAS & PANEL DE PORTALES */}
      {/* ======================================================================== */}
      {activeTab === 'recuerdos' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={(e) => void handleAddMemory(e)}
              className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {editingMemoryId ? 'Editando Recuerdo o Gusto' : 'Guardar Recuerdo o Gusto Personal'}
                </h3>
                {editingMemoryId && (
                  <button
                    type="button"
                    onClick={clearMemoryEditor}
                    className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'foto', label: 'Fotografía', icon: ImageIcon },
                    { id: 'video', label: 'Video', icon: Video },
                    { id: 'preferencia', label: 'Preferencia', icon: Music },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setMemoryMediaType(t.id)}
                      className={`min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold cursor-pointer ${
                        memoryMediaType === t.id
                          ? 'bg-[#131B31] text-amber-300'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {memoryMediaType === 'preferencia' && (
                <select
                  value={memoryPrefKind}
                  onChange={(e) => setMemoryPrefKind(e.target.value as LastDayMemoryPrefKind)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs font-semibold"
                >
                  <option value="musica">Música / Canción favorita</option>
                  <option value="pelicula">Película o serie favorita</option>
                  <option value="libro">Libro que me marcó</option>
                  <option value="lugar">Lugar especial</option>
                  <option value="frase">Frase o cita inspiradora</option>
                  <option value="otro">Otro gusto personal</option>
                </select>
              )}

              <input
                type="text"
                required
                value={memoryTitle}
                onChange={(e) => setMemoryTitle(e.target.value)}
                placeholder={
                  memoryMediaType === 'preferencia'
                    ? 'Ej: Bohemian Rhapsody / El Principito / Bariloche'
                    : 'Título del recuerdo...'
                }
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-sm"
              />

              {memoryMediaType === 'foto' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Subir foto desde tu dispositivo o pegar URL
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setMemoryFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white cursor-pointer"
                  />
                  <input
                    type="url"
                    value={memoryUrl}
                    onChange={(e) => setMemoryUrl(e.target.value)}
                    placeholder="O pegá enlace de imagen https://..."
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs"
                  />
                </div>
              )}

              {memoryMediaType === 'video' && (
                <input
                  type="url"
                  value={memoryUrl}
                  onChange={(e) => setMemoryUrl(e.target.value)}
                  placeholder="Enlace de YouTube o video personal https://..."
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-xs"
                />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={memoryCreator}
                  onChange={(e) => setMemoryCreator(e.target.value)}
                  placeholder={memoryMediaType === 'preferencia' ? 'Artista / Autor / Director' : 'Personas o etiqueta'}
                  className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs"
                />
                <input
                  type="date"
                  value={memoryDate}
                  onChange={(e) => setMemoryDate(e.target.value)}
                  className="min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs"
                />
              </div>

              <textarea
                rows={3}
                value={memoryStory}
                onChange={(e) => setMemoryStory(e.target.value)}
                placeholder="¿Qué historia, canción o emoción acompaña este recuerdo?"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2.5 text-sm"
              />

              <button
                type="submit"
                disabled={savingMemory}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {savingMemory
                  ? 'Guardando...'
                  : editingMemoryId
                  ? 'Guardar cambios del recuerdo'
                  : 'Guardar en mi biblioteca'}
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Recuerdos, Música, Películas y Libros ({memories.length})
              </h3>
              {memories.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
                  Guardá acá tus fotos entrañables, videos, canciones favoritas, libros y lugares que amás.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {memories.map((mem) => (
                    <article
                      key={mem.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden flex flex-col justify-between"
                    >
                      {mem.mediaType === 'foto' && mem.mediaUrl && (
                        <img
                          src={mem.mediaUrl}
                          alt={mem.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-44 object-cover"
                        />
                      )}
                      {mem.mediaType === 'video' && mem.youtubeVideoId && (
                        <div className="aspect-video bg-black">
                          <iframe
                            title={mem.title}
                            src={`https://www.youtube-nocookie.com/embed/${mem.youtubeVideoId}`}
                            className="w-full h-full"
                            allowFullScreen
                          />
                        </div>
                      )}
                      <div className="p-4 space-y-2 flex-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="uppercase font-bold text-amber-600 dark:text-amber-300 flex items-center gap-1">
                            {mem.prefKind === 'musica' ? <Music className="w-3 h-3" /> : mem.prefKind === 'pelicula' ? <Film className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                            {mem.mediaType === 'preferencia' ? mem.prefKind : mem.mediaType}
                          </span>
                          <span className="font-mono">{mem.memoryDate}</span>
                        </div>
                        <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          {mem.title}
                        </h4>
                        {mem.creatorOrArtist && (
                          <p className="text-xs font-medium text-violet-600 dark:text-violet-300">
                            {mem.creatorOrArtist}
                          </p>
                        )}
                        {mem.story && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {mem.story}
                          </p>
                        )}
                        {mem.mediaType === 'video' && !mem.youtubeVideoId && mem.mediaUrl && (
                          <a
                            href={mem.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline"
                          >
                            Ver video externo
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => void toggleMemoryFavorite(mem)}
                          className="min-h-[36px] inline-flex items-center gap-1 text-xs font-semibold text-amber-500 cursor-pointer"
                        >
                          <Star className={`w-4 h-4 ${mem.favorite ? 'fill-amber-500' : ''}`} />
                          {mem.favorite ? 'Favorito' : 'Destacar'}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => loadMemoryIntoEditor(mem)}
                            aria-label={`Editar ${mem.title}`}
                            className="min-h-[36px] p-1.5 text-slate-500 hover:text-violet-600 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingMemoryId === mem.id) clearMemoryEditor();
                              void deleteMemory(mem.id);
                            }}
                            aria-label={`Eliminar ${mem.title}`}
                            className="min-h-[36px] p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reused Panel de Portales y Recursos Favoritos (FABRO Explorer) */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Panel de Portales y Recursos Favoritos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Accesos reutilizados directamente desde FABRO Explorer y tu selección personal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('explorer')}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                Abrir FABRO EXPLORER
              </button>
            </div>

            {loadingPortals ? (
              <p className="text-xs text-slate-500">Cargando portales...</p>
            ) : favoritePortals.length === 0 ? (
              <p className="text-xs text-slate-500">
                No tenés portales favoritos marcados todavía en FABRO Explorer.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {favoritePortals.map((portal) => (
                  <a
                    key={portal.id}
                    href={portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 hover:border-amber-400 transition-colors flex flex-col justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {portal.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{portal.categoryName}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                      Abrir recurso
                      <ExternalLink className="w-3 h-3" />
                    </span>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 5: MI LEGADO (ESTRICTAMENTE PRIVADO, SIN ENVÍOS AUTOMÁTICOS) */}
      {/* ======================================================================== */}
      {activeTab === 'legado' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-400/40 bg-[#131B31] text-[#FAF6F0] p-5 flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-amber-200">
                «Mi Legado» — Bóveda Personal Estrictamente Privada
              </h3>
              <p className="text-xs text-[#FAF6F0]/85 leading-relaxed">
                Todo lo que escribís aquí pertenece exclusivamente a tu cuenta autenticada.
                <strong> FABRO nunca envía ni publica automáticamente ningún mensaje</strong> por inactividad,
                ausencia ni falta de conexión. Vos decidís si exportarlo a PDF/Word y compartirlo personalmente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={(e) => void handleSaveLegacy(e)}
              className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {editingLegacyId
                    ? 'Editando mensaje de Mi Legado'
                    : 'Redactar mensaje o recuerdo dedicado'}
                </h4>
                {editingLegacyId && (
                  <button
                    type="button"
                    onClick={clearLegacyEditor}
                    className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={legRecipient}
                  onChange={(e) => setLegRecipient(e.target.value)}
                  placeholder="Destinatario (ej: Mi hija Sofía)"
                  className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-sm"
                />
                <input
                  type="text"
                  value={legRelation}
                  onChange={(e) => setLegRelation(e.target.value)}
                  placeholder="Vínculo (ej: Madre, Amigo, Hermano)"
                  className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-sm"
                />
              </div>
              <input
                type="text"
                required
                value={legTitle}
                onChange={(e) => setLegTitle(e.target.value)}
                placeholder="Título del mensaje..."
                className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-sm"
              />
              <textarea
                rows={7}
                required
                value={legMessage}
                onChange={(e) => setLegMessage(e.target.value)}
                placeholder="Escribí lo que querés expresar con amor, gratitud, recuerdos o consejos..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-3.5 text-sm leading-relaxed"
              />
              <input
                type="text"
                value={legMediaHint}
                onChange={(e) => setLegMediaHint(e.target.value)}
                placeholder="Foto, canción o recuerdo asociado (opcional)"
                className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2 text-xs"
              />
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={legConsent}
                  onChange={(e) => setLegConsent(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-amber-500 shrink-0"
                />
                <span>
                  Confirmo mi consentimiento explícito: este mensaje es privado bajo mi cuenta y entiendo que
                  FABRO jamás lo enviará automáticamente por inactividad o ausencia.
                </span>
              </label>

              <button
                type="submit"
                disabled={!legConsent}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#131B31] px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-[#1E2947] disabled:opacity-50 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {editingLegacyId ? 'Actualizar en Mi Legado privado' : 'Guardar en Mi Legado privado'}
              </button>
            </form>

            <div className="lg:col-span-6 space-y-4">
              <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Mensajes guardados ({legacyItems.length})
              </h4>
              {legacyItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500">
                  Tu bóveda de Mi Legado está vacía y resguardada únicamente para vos.
                </div>
              ) : (
                <div className="space-y-3">
                  {legacyItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-amber-600 dark:text-amber-300">
                          Para: {item.recipientName}{item.relationship ? ` (${item.relationship})` : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <Lock className="w-3 h-3" />
                          Privado · Sin envío automático
                        </span>
                      </div>
                      <h5 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </h5>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                        {item.message}
                      </p>
                      {item.mediaHint && (
                        <p className="text-[11px] text-violet-600 dark:text-violet-300">
                          Referencia adjunta: {item.mediaHint}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void exportNoteToPdf({
                                title: item.title,
                                subjectName: `Para: ${item.recipientName}`,
                                folder: 'Mi Legado (Uso personal)',
                                contentHtml: `<p>${item.message.replace(/\n/g, '</p><p>')}</p>`,
                                contentText: item.message,
                              })
                            }
                            className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Exportar PDF
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void exportNoteToWord({
                                title: item.title,
                                subjectName: `Para: ${item.recipientName}`,
                                folder: 'Mi Legado (Uso personal)',
                                contentHtml: `<p>${item.message.replace(/\n/g, '</p><p>')}</p>`,
                                contentText: item.message,
                              })
                            }
                            className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium cursor-pointer"
                          >
                            Word
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              exportMarkdownToText({
                                title: item.title || 'legado',
                                markdown: `# ${item.title}\nPara: ${item.recipientName}${item.relationship ? ` (${item.relationship})` : ''}\n\n${item.message}`,
                                format: 'txt',
                              })
                            }
                            className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium cursor-pointer"
                          >
                            TXT
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => loadLegacyIntoEditor(item)}
                            aria-label={`Editar legado ${item.title}`}
                            className="min-h-[36px] p-1.5 text-slate-500 hover:text-violet-600 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingLegacyId === item.id) clearLegacyEditor();
                              void deleteLegacy(item.id);
                            }}
                            aria-label={`Eliminar legado ${item.title}`}
                            className="min-h-[36px] p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 6: FABRO IA — CONSEJERO PERSONAL */}
      {/* ======================================================================== */}
      {activeTab === 'consejero' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-violet-500/30 bg-[#131B31] text-[#FAF6F0] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Sparkles className="w-4 h-4" />
                <span>FABRO IA — CONSEJERO PERSONAL</span>
              </div>
              <p className="text-xs text-[#FAF6F0]/80 leading-relaxed max-w-2xl">
                Acompaña tu escritura, organización emocional, prioridades y reflexiones usando los motores activos de FABRO
                (ChatGPT y Gemini). No realiza diagnósticos médicos ni psicológicos y no reemplaza a profesionales de la salud.
              </p>
            </div>
            {freemiumStatus && (
              <button
                type="button"
                onClick={() => openPlansModal()}
                className="min-h-[40px] rounded-xl border border-amber-400/35 bg-[#0B1120]/70 px-3.5 py-2 text-xs font-mono text-amber-200 shrink-0 cursor-pointer"
              >
                {freemiumStatus.usedToday}/{freemiumStatus.dailyLimit} consultas hoy
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
                <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Motor de Inteligencia Artificial
                </h4>
                <select
                  value={counselorPersonalId ? `personal:${counselorPersonalId}` : counselorProvider}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('personal:')) {
                      setCounselorPersonalId(val.slice('personal:'.length));
                    } else {
                      setCounselorPersonalId('');
                      setCounselorProvider(val as 'auto' | AIProviderId);
                      setCounselorModelId('');
                    }
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs font-semibold"
                >
                  <option value="auto">Automático FABRO Gateway (Recomendado)</option>
                  {enabledCounselorProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {verifiedPersonalCounselorConns.map((c) => (
                    <option key={c.id} value={`personal:${c.id}`}>
                      Personal: {c.label} ({c.selectedModel})
                    </option>
                  ))}
                </select>

                {availableCounselorModels.length > 0 && (
                  <select
                    value={counselorModelId}
                    onChange={(e) => setCounselorModelId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs"
                  >
                    <option value="">Modelo predeterminado del proveedor</option>
                    {availableCounselorModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}

                <div className="pt-2 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Accesos rápidos de acompañamiento
                  </p>
                  {(
                    [
                      {
                        task: 'redaccion',
                        label: 'Ayudarme a redactar o mejorar un texto',
                        prompt: 'Ayudame a redactar una carta o reflexión sincera y clara para alguien que aprecio.',
                      },
                      {
                        task: 'reflexion',
                        label: 'Proponer un ejercicio de introspección',
                        prompt: 'Proponeme un ejercicio breve de introspección y gratitud para vivir mejor el día de hoy.',
                      },
                      {
                        task: 'priorizar',
                        label: 'Priorizar mis actividades de hoy',
                        prompt: 'Revisá mis actividades planificadas de hoy y ayudame a elegir qué es lo más valioso priorizar sin agobiarme.',
                      },
                      {
                        task: 'ordenar_emociones',
                        label: 'Ordenar pensamientos y emociones',
                        prompt: 'Ayudame a poner en palabras claras lo que estoy sintiendo hoy y qué paso pequeño me puede dar calma.',
                      },
                      {
                        task: 'gustos_positivos',
                        label: 'Actividades positivas según mis gustos',
                        prompt: 'Según mis gustos guardados y mi energía de hoy, sugerime 4 ideas concretas y saludables para disfrutar el día.',
                      },
                      {
                        task: 'motivacion',
                        label: 'Palabras de aliento y foco vital',
                        prompt: 'Dame una reflexión breve, honesta y motivadora para aprovechar hoy sin culpas ni presiones.',
                      },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.task}
                      type="button"
                      disabled={counselorSending}
                      onClick={() => {
                        setCounselorTask(item.task);
                        void askCounselorIA({ taskType: item.task, prompt: item.prompt });
                      }}
                      className="w-full min-h-[42px] text-left rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-violet-500 hover:bg-violet-500/5 cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col justify-between gap-4 min-h-[480px]">
              <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
                {counselorMessages.length === 0 ? (
                  <div className="py-12 text-center space-y-2 max-w-md mx-auto">
                    <Sparkles className="w-8 h-8 text-violet-500 mx-auto" />
                    <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Bienvenido a tu Consejero Personal
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Elegí una acción rápida de la izquierda o contame qué querés escribir, ordenar o planificar hoy.
                    </p>
                  </div>
                ) : (
                  counselorMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-2xl p-4 space-y-2 ${
                        msg.role === 'user'
                          ? 'ml-6 bg-[#131B31] text-[#FAF6F0]'
                          : msg.isCrisisSupport
                          ? 'border border-amber-400 bg-violet-950 text-[#FAF6F0]'
                          : 'mr-6 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {msg.meta && (
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                          {msg.meta}
                        </p>
                      )}
                      <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.text}
                      </div>
                      {msg.helplines && msg.helplines.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          {msg.helplines.slice(0, 4).map((hl) => (
                            <div
                              key={`${hl.country}_${hl.number}`}
                              className="rounded-lg border border-amber-300/30 bg-[#0B1120]/70 p-2.5 text-xs"
                            >
                              <p className="font-bold text-amber-300">{hl.country}</p>
                              <p className="font-mono text-white font-semibold">{hl.number}</p>
                              <p className="text-[11px] text-[#FAF6F0]/75">{hl.service}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void askCounselorIA();
                }}
                className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800"
              >
                <input
                  type="text"
                  value={counselorPrompt}
                  onChange={(e) => setCounselorPrompt(e.target.value)}
                  placeholder="Escribí lo que querés conversar con FABRO IA — Consejero Personal..."
                  className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-4 py-2 text-sm text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={counselorSending || !counselorPrompt.trim()}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                  {counselorSending ? 'Pensando...' : 'Consultar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* TAB 7: COMUNIDAD, GRUPOS, SOLICITUDES DE CONTACTO Y MODERACIÓN */}
      {/* ======================================================================== */}
      {activeTab === 'comunidad' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Privacidad & Grupos Temáticos */}
            <div className="lg:col-span-5 space-y-5">
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Tu Privacidad Social
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveSection('perfil')}
                    className="text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                  >
                    Editar perfil
                  </button>
                </div>

                {profile?.isMinor ? (
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <p className="font-bold">Protección activa para menores de edad</p>
                    <p>
                      Las solicitudes de contacto y los mensajes privados 1 a 1 están deshabilitados por seguridad.
                      Podés seguir participando en grupos moderados aptos en Comunidad FABRO.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        Visible en directorio de adultos
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Permite recibir solicitudes de contacto respetuosas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void setDirectoryVisibility(!(myPublicProfile?.searchableInDirectory ?? false))
                      }
                      className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-bold cursor-pointer ${
                        myPublicProfile?.searchableInDirectory
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {myPublicProfile?.searchableInDirectory ? 'Visible' : 'Oculto'}
                    </button>
                  </div>
                )}
              </section>

              {/* Crear y unirse a grupos de comunidad FABRO */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    Grupos de reflexión y comunidad ({groups.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveSection('comunidad')}
                    className="text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
                  >
                    Ir a Comunidad
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!groupName.trim()) return;
                    try {
                      await createGroup({
                        name: groupName.trim(),
                        description: groupDesc.trim() || 'Grupo de apoyo, reflexión positiva y metas.',
                        groupType: 'libre',
                        visibility: 'publico',
                        country: profile?.country || '',
                        province: profile?.province || '',
                        city: profile?.city || '',
                        institutionName: '',
                        career: '',
                        courseName: '',
                        subjectName: 'Desarrollo personal y bienestar',
                        specialty: 'EL ÚLTIMO DÍA DE TU VIDA',
                        allowMinors: false,
                      });
                      setGroupName('');
                      setGroupDesc('');
                      flashNotice('ok', 'Grupo creado dentro de la Comunidad FABRO.');
                    } catch (err) {
                      flashNotice('err', err instanceof Error ? err.message : 'No se pudo crear el grupo.');
                    }
                  }}
                  className="space-y-2.5"
                >
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Nombre del nuevo grupo (ej: Gratitud y Proyectos)"
                    className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={groupDesc}
                      onChange={(e) => setGroupDesc(e.target.value)}
                      placeholder="Propósito del grupo..."
                      className="flex-1 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs"
                    />
                    <button
                      type="submit"
                      className="min-h-[42px] rounded-xl bg-[#131B31] px-4 py-2 text-xs font-bold text-amber-300 cursor-pointer shrink-0"
                    >
                      Crear grupo
                    </button>
                  </div>
                </form>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {groups.slice(0, 6).map((g) => (
                    <div
                      key={g.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{g.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {g.memberCount} miembros · {g.specialty || g.groupType}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await joinGroup(g);
                              flashNotice('ok', `Solicitud/ingreso procesado para ${g.name}.`);
                            } catch (err) {
                              flashNotice('err', err instanceof Error ? err.message : 'No se pudo unir al grupo.');
                            }
                          }}
                          className="min-h-[36px] rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white cursor-pointer"
                        >
                          Unirse
                        </button>
                        <button
                          type="button"
                          onClick={() => void leaveGroup(g.id)}
                          className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs cursor-pointer"
                        >
                          Salir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Solicitudes de contacto, Mensajería Adultos, Bloqueos y Denuncias */}
            <div className="lg:col-span-7 space-y-5">
              {!profile?.isMinor && (
                <>
                  {/* Solicitudes recibidas y enviadas */}
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Solicitudes de Contacto (Adultos Verificados)
                      </h4>
                      <button
                        type="button"
                        onClick={() => setActiveSection('mensajes')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:underline cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Mensajes FABRO
                      </button>
                    </div>

                    {receivedContactRequests.length === 0 && sentContactRequests.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No tenés solicitudes pendientes ni aceptadas por el momento.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        {receivedContactRequests.map((reqItem) => {
                          const senderProf = publicProfiles.find((p) => p.uid === reqItem.fromUserId);
                          return (
                            <div
                              key={reqItem.id}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white">
                                  Solicitud de {reqItem.fromName} · <span className="uppercase text-violet-500">{reqItem.status}</span>
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">{reqItem.message}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {reqItem.status === 'pendiente' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void respondContactRequest(reqItem, 'aceptada')}
                                      className="min-h-[38px] rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                                    >
                                      Aceptar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void respondContactRequest(reqItem, 'rechazada')}
                                      className="min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                                    >
                                      Rechazar
                                    </button>
                                  </>
                                )}
                                {reqItem.status === 'aceptada' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await startOrGetDirectThread(
                                        senderProf || {
                                          uid: reqItem.fromUserId,
                                          displayName: reqItem.fromName,
                                          isMinor: false,
                                        }
                                      );
                                      setActiveSection('mensajes');
                                    }}
                                    className="min-h-[40px] inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                    Chatear
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {sentContactRequests.map((reqItem) => {
                          const targetProf = publicProfiles.find((p) => p.uid === reqItem.toUserId);
                          return (
                            <div
                              key={reqItem.id}
                              className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                            >
                              <span>
                                Enviada a <strong>{reqItem.toName}</strong> · Estado: {reqItem.status}
                              </span>
                              <div className="flex items-center gap-2">
                                {reqItem.status === 'aceptada' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await startOrGetDirectThread(
                                        targetProf || {
                                          uid: reqItem.toUserId,
                                          displayName: reqItem.toName,
                                          isMinor: false,
                                        }
                                      );
                                      setActiveSection('mensajes');
                                    }}
                                    className="min-h-[40px] rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                                  >
                                    Abrir mensajes
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void deleteContactRequest(reqItem.id)}
                                  className="min-h-[40px] px-2 text-slate-400 hover:text-red-500 cursor-pointer"
                                >
                                  Quitar
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Directorio de personas adultas con solicitud, bloqueo y reporte */}
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
                    <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Personas en la Comunidad ({visibleAdultPeers.length})
                    </h4>
                    {visibleAdultPeers.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No hay otros perfiles adultos visibles actualmente en el directorio.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {visibleAdultPeers.slice(0, 8).map((peer) => (
                          <article
                            key={peer.uid}
                            className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {peer.displayName}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">
                                {[peer.city, peer.country].filter(Boolean).join(', ') || 'Integrante FABRO'}
                              </p>
                              {peer.bio && (
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                                  {peer.bio}
                                </p>
                              )}
                            </div>

                            <input
                              type="text"
                              value={contactIntroByUid[peer.uid] || ''}
                              onChange={(e) =>
                                setContactIntroByUid((prev) => ({ ...prev, [peer.uid]: e.target.value }))
                              }
                              placeholder="Saludo breve para solicitud..."
                              className="w-full min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                            />

                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await sendContactRequest(peer, contactIntroByUid[peer.uid] || '');
                                    flashNotice('ok', `Solicitud de contacto enviada a ${peer.displayName}.`);
                                  } catch (err) {
                                    flashNotice('err', err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
                                  }
                                }}
                                className="min-h-[38px] inline-flex items-center gap-1 rounded-lg bg-[#131B31] px-3 py-1.5 text-xs font-semibold text-amber-300 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Conectar
                              </button>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => void toggleBlockUser(peer.uid)}
                                  className="min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                                >
                                  Bloquear
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setReportTarget(peer)}
                                  aria-label={`Reportar a ${peer.displayName}`}
                                  className="min-h-[38px] rounded-lg border border-red-500/30 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400 cursor-pointer"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* Modal inline simple de reporte de moderación */}
              {reportTarget && (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/5 p-5 space-y-3">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300">
                    Reportar conducta de {reportTarget.displayName} ante Moderación FABRO
                  </p>
                  <input
                    type="text"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 py-2 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await submitModerationReport({
                          targetType: 'usuario',
                          targetId: reportTarget.uid,
                          targetSummary: reportTarget.displayName,
                          reason: reportReason,
                          details: 'Reportado desde el módulo EL ÚLTIMO DÍA DE TU VIDA.',
                        });
                        setReportTarget(null);
                        flashNotice('ok', 'Reporte enviado al equipo de moderación de FABRO.');
                      }}
                      className="min-h-[38px] rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer"
                    >
                      Enviar reporte
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportTarget(null)}
                      className="min-h-[38px] rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {myReports.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  Tus reportes enviados: {myReports.length} registrados en Moderación FABRO.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
