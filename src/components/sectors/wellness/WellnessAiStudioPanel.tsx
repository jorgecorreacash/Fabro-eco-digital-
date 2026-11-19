import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Brain,
  CalendarPlus,
  Check,
  CheckSquare,
  Droplets,
  Dumbbell,
  Feather,
  Info,
  KeyRound,
  Loader2,
  Moon,
  Play,
  Save,
  Sparkles,
  Square,
  Trash2,
  Utensils,
  Volume2,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  findByokKeyForWellnessEngine,
  generateDietPlanWithByok,
  generateHabitPlanWithByok,
  generateStoicReflectionWithByok,
  generateWorkoutPlanWithByok,
  getOfflineBaseDietPlan,
  getOfflineBaseHabitPlan,
  getOfflineBaseWorkoutPlan,
  getOfflineStoicSession,
} from '../../../services/wellnessAiService';
import type {
  WellnessDietPlanItem,
  WellnessHabitPlanItem,
  WellnessStoicSessionItem,
  WellnessWorkoutPlanItem,
} from '../../../types/ecosystem';
import { WellnessWorkoutTimerModal } from './WellnessWorkoutTimerModal';

export type WellnessAiTabId = 'dietas' | 'entrenador' | 'habitos' | 'claridad' | 'guardados';

interface WellnessAiStudioPanelProps {
  initialTab?: WellnessAiTabId;
}

const WORKOUT_DURATIONS = ['15 min', '30 min', '45 min', '1 hora'] as const;

const HABIT_CATEGORIES: Array<{ id: WellnessHabitPlanItem['category']; label: string }> = [
  { id: 'manana', label: 'Ritual de mañana' },
  { id: 'sueno', label: 'Descanso nocturno' },
  { id: 'pausas-estudio', label: 'Pausas activas' },
  { id: 'antiprocrastinacion', label: 'Vencer procrastinación' },
];

export const WellnessAiStudioPanel: React.FC<WellnessAiStudioPanelProps> = ({
  initialTab = 'dietas',
}) => {
  const {
    byokKeys,
    getByokSecret,
    wellnessAiEngine,
    wellnessPhysicalProfile,
    wellnessDietPlans,
    saveWellnessDietPlan,
    toggleWellnessShoppingItem,
    deleteWellnessDietPlan,
    wellnessWorkoutPlans,
    saveWellnessWorkoutPlan,
    deleteWellnessWorkoutPlan,
    wellnessHabitPlans,
    saveWellnessHabitPlan,
    markWellnessHabitAdded,
    deleteWellnessHabitPlan,
    wellnessStoicSessions,
    saveWellnessStoicSession,
    updateWellnessStoicSessionNotes,
    deleteWellnessStoicSession,
    addTimeBlock,
    addOrganizerTask,
    navigateTo,
    authUser,
  } = useEcosystem();

  const [activeTab, setActiveTab] = useState<WellnessAiTabId>(initialTab);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [timerPlan, setTimerPlan] = useState<WellnessWorkoutPlanItem | null>(null);

  // Module 1: Dietas
  const [dietMode, setDietMode] = useState<'semanal' | 'heladera'>('semanal');
  const [dietInput, setDietInput] = useState('');
  const [activeDiet, setActiveDiet] = useState<WellnessDietPlanItem | null>(
    () => wellnessDietPlans[0] || getOfflineBaseDietPlan(wellnessPhysicalProfile, 'semanal', '')
  );

  // Module 2: Entrenador Personal
  const [workoutDuration, setWorkoutDuration] =
    useState<(typeof WORKOUT_DURATIONS)[number]>('30 min');
  const [workoutFocus, setWorkoutFocus] = useState('Cuerpo completo y core');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [activeWorkout, setActiveWorkout] = useState<WellnessWorkoutPlanItem | null>(
    () =>
      wellnessWorkoutPlans[0] ||
      getOfflineBaseWorkoutPlan(wellnessPhysicalProfile, '30 min', 'Cuerpo completo y core')
  );

  // Module 3: Hábitos, Sueño y Energía
  const [habitCategory, setHabitCategory] = useState<WellnessHabitPlanItem['category']>('manana');
  const [habitPrompt, setHabitPrompt] = useState('');
  const [activeHabitPlan, setActiveHabitPlan] = useState<WellnessHabitPlanItem | null>(
    () => wellnessHabitPlans[0] || getOfflineBaseHabitPlan('manana')
  );

  // Module 4: Claridad Mental & Estoicismo
  const [moodFeeling, setMoodFeeling] = useState('');
  const [activeStoic, setActiveStoic] = useState<WellnessStoicSessionItem | null>(
    () => wellnessStoicSessions[0] || getOfflineStoicSession('')
  );

  const activeByok = useMemo(
    () => findByokKeyForWellnessEngine(byokKeys, getByokSecret, wellnessAiEngine),
    [byokKeys, getByokSecret, wellnessAiEngine]
  );

  const engineLabel = wellnessAiEngine === 'gemini' ? 'Gemini' : 'ChatGPT';

  const notify = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 3200);
  };

  const speakText = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  };

  const sendPlanToTimeBlock = (title: string, duration: 30 | 45 | 60 = 45) => {
    addTimeBlock({
      title: title.slice(0, 80),
      startHour: 18,
      startMinute: 0,
      durationMinutes: duration,
      sector: 'bienestar',
      subject: 'Bienestar IA',
    });
    notify(`"${title.slice(0, 42)}" agendado en Bloques de Tiempo (18:00).`);
  };

  // --- Generators ---
  const handleGenerateDiet = async () => {
    setErrorMsg(null);
    if (!activeByok) {
      const offline = getOfflineBaseDietPlan(wellnessPhysicalProfile, dietMode, dietInput);
      setActiveDiet(offline);
      saveWellnessDietPlan(offline);
      notify('Plantilla base offline cargada. Conectá tu clave BYOK para recetas 100% personalizadas.');
      return;
    }
    setLoading(true);
    try {
      const res = await generateDietPlanWithByok({
        keyMeta: activeByok.keyMeta,
        rawApiKey: activeByok.secret,
        profile: wellnessPhysicalProfile,
        mode: dietMode,
        userRequest: dietInput,
      });
      if (!res.ok || !res.plan) {
        setErrorMsg(res.error || 'No se pudo generar el plan nutricional.');
        return;
      }
      setActiveDiet(res.plan);
      saveWellnessDietPlan(res.plan);
      notify(`Plan nutricional generado con ${engineLabel} y guardado offline.`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWorkout = async () => {
    setErrorMsg(null);
    if (!activeByok) {
      const offline = getOfflineBaseWorkoutPlan(
        wellnessPhysicalProfile,
        workoutDuration,
        workoutFocus
      );
      setActiveWorkout(offline);
      saveWellnessWorkoutPlan(offline);
      notify('Rutina base offline cargada. Conectá tu clave BYOK para entrenamientos a medida.');
      return;
    }
    setLoading(true);
    try {
      const res = await generateWorkoutPlanWithByok({
        keyMeta: activeByok.keyMeta,
        rawApiKey: activeByok.secret,
        profile: wellnessPhysicalProfile,
        durationLabel: workoutDuration,
        focusLabel: workoutFocus,
        extraNotes: workoutNotes,
      });
      if (!res.ok || !res.plan) {
        setErrorMsg(res.error || 'No se pudo generar la rutina de ejercicio.');
        return;
      }
      setActiveWorkout(res.plan);
      saveWellnessWorkoutPlan(res.plan);
      notify(`Rutina generada con ${engineLabel} y guardada para usar sin internet.`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateHabits = async () => {
    setErrorMsg(null);
    if (!activeByok) {
      const offline = getOfflineBaseHabitPlan(habitCategory);
      setActiveHabitPlan(offline);
      saveWellnessHabitPlan(offline);
      notify('Protocolo base offline cargado. Conectá tu clave BYOK para diseñarlo a tu medida.');
      return;
    }
    setLoading(true);
    try {
      const res = await generateHabitPlanWithByok({
        keyMeta: activeByok.keyMeta,
        rawApiKey: activeByok.secret,
        profile: wellnessPhysicalProfile,
        category: habitCategory,
        userRequest: habitPrompt,
      });
      if (!res.ok || !res.plan) {
        setErrorMsg(res.error || 'No se pudo generar el protocolo de hábitos.');
        return;
      }
      setActiveHabitPlan(res.plan);
      saveWellnessHabitPlan(res.plan);
      notify(`Protocolo de hábitos generado con ${engineLabel} y guardado.`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateStoic = async () => {
    setErrorMsg(null);
    if (!moodFeeling.trim()) {
      setErrorMsg('Contanos brevemente cómo te sentís hoy o qué tenés en mente.');
      return;
    }
    if (!activeByok) {
      const offline = getOfflineStoicSession(moodFeeling);
      setActiveStoic(offline);
      saveWellnessStoicSession(offline);
      notify('Guía estoica offline guardada en tu cuaderno privado.');
      return;
    }
    setLoading(true);
    try {
      const res = await generateStoicReflectionWithByok({
        keyMeta: activeByok.keyMeta,
        rawApiKey: activeByok.secret,
        moodFeeling,
      });
      if (!res.ok || !res.session) {
        setErrorMsg(res.error || 'No se pudo generar la reflexión guiada.');
        return;
      }
      setActiveStoic(res.session);
      saveWellnessStoicSession(res.session);
      notify(`Reflexión estoica generada con ${engineLabel} y guardada en tu cuaderno privado.`);
    } finally {
      setLoading(false);
    }
  };

  const totalSavedCount =
    wellnessDietPlans.length +
    wellnessWorkoutPlans.length +
    wellnessHabitPlans.length +
    wellnessStoicSessions.length;

  // Resolve live diet plan from saved store so checkbox toggles stay reactive
  const displayedDiet =
    (activeDiet && wellnessDietPlans.find((p) => p.id === activeDiet.id)) || activeDiet;
  const displayedHabitPlan =
    (activeHabitPlan && wellnessHabitPlans.find((p) => p.id === activeHabitPlan.id)) ||
    activeHabitPlan;
  const displayedStoic =
    (activeStoic && wellnessStoicSessions.find((s) => s.id === activeStoic.id)) || activeStoic;

  return (
    <section className="rounded-2xl border fabro-surface p-4 sm:p-5 space-y-4">
      {/* Module Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b fabro-border pb-3">
        {(
          [
            { id: 'dietas', label: 'Dietas y Nutrición', icon: Utensils },
            { id: 'entrenador', label: 'Entrenador y Rutinas', icon: Dumbbell },
            { id: 'habitos', label: 'Hábitos y Sueño', icon: Moon },
            { id: 'claridad', label: 'Claridad Estoica', icon: Brain },
            { id: 'guardados', label: `Mis Planes (${totalSavedCount})`, icon: Bookmark },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const isAct = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(t.id);
                setErrorMsg(null);
              }}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 transition-all whitespace-nowrap ${
                isAct
                  ? 'border-[#10B981] bg-[#10B981] text-white'
                  : 'fabro-border fabro-surface-elevated hover:border-[#10B981]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Friendly BYOK banner if selected engine isn't configured yet */}
      {!activeByok && activeTab !== 'guardados' && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
            <strong>Modo BYOK sin clave de {engineLabel} cargada:</strong> podés usar ahora mismo
            las <strong>plantillas base offline</strong> sin costo, o conectar tu propia API key de{' '}
            <strong>Gemini</strong> o <strong>ChatGPT</strong> para generar planes 100% a medida.
          </p>
          <button
            type="button"
            onClick={() => navigateTo('ia', 'claves-byok')}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-amber-500 bg-amber-500 text-slate-950 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Configuración BYOK
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {toastMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          {toastMsg}
        </div>
      )}

      {/* ============================================================
          MÓDULO 1: ARMADOR DE DIETAS Y NUTRICIÓN PRÁCTICA
         ============================================================ */}
      {activeTab === 'dietas' && (
        <div className="space-y-4">
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm sm:text-base font-bold flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#10B981]" />
                Armador de Dietas y Nutrición Práctica
              </h3>
              <div className="inline-flex rounded-xl border fabro-border fabro-surface p-0.5 gap-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDietMode('semanal')}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    dietMode === 'semanal' ? 'bg-[#10B981] text-white' : 'fabro-muted'
                  }`}
                >
                  Plan diario / semanal
                </button>
                <button
                  type="button"
                  onClick={() => setDietMode('heladera')}
                  className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                    dietMode === 'heladera' ? 'bg-[#F59E0B] text-white' : 'fabro-muted'
                  }`}
                >
                  ¿Qué cocino con lo que tengo?
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={dietInput}
                onChange={(e) => setDietInput(e.target.value)}
                placeholder={
                  dietMode === 'heladera'
                    ? 'Ej: Tengo huevos, arroz, pollo, tomate, avena y espinaca...'
                    : 'Ej: Plan económico alto en proteína, comidas rápidas de 20 min...'
                }
                className="flex-1 min-h-[42px] rounded-xl border fabro-border fabro-surface px-3.5 py-2 text-xs sm:text-sm fabro-input"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleGenerateDiet()}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#10B981] bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 text-xs sm:text-sm font-bold cursor-pointer active:scale-95 disabled:opacity-60 whitespace-nowrap"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {activeByok ? `Generar con ${engineLabel}` : 'Usar plantilla offline'}
              </button>
            </div>
          </div>

          {displayedDiet && (
            <article className="rounded-2xl border fabro-border fabro-surface-elevated p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-[#047857] dark:text-[#34D399]">
                    {displayedDiet.providerLabel} · {displayedDiet.createdAt}
                  </p>
                  <h4 className="font-display text-base sm:text-lg font-extrabold mt-0.5">
                    {displayedDiet.title}
                  </h4>
                  <p className="text-xs fabro-muted mt-1">{displayedDiet.summary}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      saveWellnessDietPlan(displayedDiet);
                      notify('Plan nutricional guardado en Mi Plan.');
                    }}
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#10B981]" />
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => sendPlanToTimeBlock(`Preparar comida: ${displayedDiet.title}`, 45)}
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-[#0EA5E9]" />
                    A Bloques
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      speakText(
                        displayedDiet.id,
                        `${displayedDiet.title}. Desayuno: ${displayedDiet.meals.desayuno}. Almuerzo: ${displayedDiet.meals.almuerzo}. Merienda: ${displayedDiet.meals.merienda}. Cena: ${displayedDiet.meals.cena}.`
                      )
                    }
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {speakingId === displayedDiet.id ? 'Detener' : 'Leer'}
                  </button>
                </div>
              </div>

              {/* Meals Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {(
                  [
                    { key: 'desayuno', label: 'Desayuno' },
                    { key: 'almuerzo', label: 'Almuerzo' },
                    { key: 'merienda', label: 'Merienda' },
                    { key: 'cena', label: 'Cena' },
                  ] as const
                ).map((m) => (
                  <div key={m.key} className="rounded-xl border fabro-border fabro-surface p-3.5 space-y-1">
                    <p className="font-bold text-[#047857] dark:text-[#34D399]">{m.label}</p>
                    <p className="leading-relaxed">{displayedDiet.meals[m.key]}</p>
                  </div>
                ))}
              </div>

              {/* Checkable Shopping List + Hydration Reminder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border fabro-border fabro-surface p-3.5 space-y-2">
                  <p className="font-bold">Lista de compras tildable</p>
                  <div className="space-y-1.5">
                    {displayedDiet.shoppingList.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          if (!wellnessDietPlans.some((p) => p.id === displayedDiet.id)) {
                            saveWellnessDietPlan(displayedDiet);
                          }
                          toggleWellnessShoppingItem(displayedDiet.id, it.id);
                        }}
                        className="w-full flex items-center gap-2 text-left py-1 cursor-pointer"
                      >
                        {it.checked ? (
                          <CheckSquare className="w-4 h-4 text-[#10B981] shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 fabro-muted shrink-0" />
                        )}
                        <span className={it.checked ? 'line-through opacity-60' : ''}>
                          {it.item}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-cyan-500/35 bg-cyan-500/10 p-3.5 space-y-2 flex flex-col justify-between">
                  <div className="space-y-1">
                    <p className="font-bold text-cyan-800 dark:text-cyan-200 flex items-center gap-1.5">
                      <Droplets className="w-4 h-4" />
                      Recordatorio de hidratación diaria
                    </p>
                    <p className="leading-relaxed">{displayedDiet.hydrationTip}</p>
                  </div>
                  <p className="text-[11px] fabro-muted flex items-start gap-1.5 pt-2 border-t fabro-border">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Nota de bienestar: estas sugerencias son orientativas y no reemplazan la
                      consulta con un nutricionista o profesional de la salud.
                    </span>
                  </p>
                </div>
              </div>
            </article>
          )}
        </div>
      )}

      {/* ============================================================
          MÓDULO 2: ENTRENADOR PERSONAL Y RUTINAS DE EJERCICIO
         ============================================================ */}
      {activeTab === 'entrenador' && (
        <div className="space-y-4">
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-3">
            <h3 className="font-display text-sm sm:text-base font-bold flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#10B981]" />
              Entrenador Personal y Rutinas de Ejercicio
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <input
                type="text"
                value={workoutFocus}
                onChange={(e) => setWorkoutFocus(e.target.value)}
                placeholder="Grupo muscular o enfoque (Ej: Piernas y glúteos, Tren superior, Movilidad...)"
                className="sm:col-span-5 min-h-[42px] rounded-xl border fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
              />
              <select
                value={workoutDuration}
                onChange={(e) =>
                  setWorkoutDuration(e.target.value as (typeof WORKOUT_DURATIONS)[number])
                }
                aria-label="Duración de la rutina"
                className="sm:col-span-3 min-h-[42px] rounded-xl border fabro-border fabro-surface px-3 py-2 text-xs font-semibold outline-none"
              >
                {WORKOUT_DURATIONS.map((d) => (
                  <option key={d} value={d} className="text-slate-900">
                    Tiempo: {d}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={workoutNotes}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                placeholder="Detalle opcional (ej. sin saltos)"
                className="sm:col-span-4 min-h-[42px] rounded-xl border fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleGenerateWorkout()}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#10B981] bg-[#10B981] hover:bg-[#059669] text-white px-4 py-2 text-xs sm:text-sm font-bold cursor-pointer active:scale-95 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {activeByok ? `Diseñar rutina con ${engineLabel}` : 'Cargar rutina base offline'}
              </button>
            </div>
          </div>

          {activeWorkout && (
            <article className="rounded-2xl border fabro-border fabro-surface-elevated p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold text-[#047857] dark:text-[#34D399]">
                    {activeWorkout.providerLabel} · {activeWorkout.durationLabel} ·{' '}
                    {activeWorkout.equipmentLabel}
                  </p>
                  <h4 className="font-display text-base sm:text-lg font-extrabold mt-0.5">
                    {activeWorkout.title}
                  </h4>
                  <p className="text-xs fabro-muted mt-1">{activeWorkout.daysSummary}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTimerPlan(activeWorkout)}
                    className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#10B981] bg-[#10B981] hover:bg-[#059669] text-white px-4 py-1.5 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Iniciar Rutina Ahora
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      saveWellnessWorkoutPlan(activeWorkout);
                      notify('Rutina guardada para consultar sin internet.');
                    }}
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#10B981]" />
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendPlanToTimeBlock(
                        activeWorkout.title,
                        activeWorkout.durationLabel === '1 hora' ? 60 : 45
                      )
                    }
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-[#0EA5E9]" />
                    Agendar
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      speakText(
                        activeWorkout.id,
                        `${activeWorkout.title}. ${activeWorkout.exercises
                          .map((e, i) => `Ejercicio ${i + 1}: ${e.name}, ${e.sets} series de ${e.reps}. ${e.technique}`)
                          .join('. ')}`
                      )
                    }
                    className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-2.5 py-1 text-xs font-semibold cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {speakingId === activeWorkout.id ? 'Detener' : 'Leer'}
                  </button>
                </div>
              </div>

              {/* Exercises List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {activeWorkout.exercises.map((ex, idx) => (
                  <div
                    key={ex.id}
                    className="rounded-xl border fabro-border fabro-surface p-3.5 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-sm">
                        {idx + 1}. {ex.name}
                      </p>
                      <span className="font-mono text-[11px] font-bold text-[#047857] dark:text-[#34D399] shrink-0 tabular-nums">
                        {ex.sets} × {ex.reps}
                      </span>
                    </div>
                    <p className="text-[11px] fabro-muted font-mono tabular-nums">
                      Descanso entre series: {ex.restSec} seg
                    </p>
                    <p className="leading-relaxed fabro-muted">
                      <strong className="text-current">Técnica clave:</strong> {ex.technique}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>
      )}

      {/* ============================================================
          MÓDULO 3: LABORATORIO DE HÁBITOS, SUEÑO Y ENERGÍA
         ============================================================ */}
      {activeTab === 'habitos' && (
        <div className="space-y-4">
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-3">
            <h3 className="font-display text-sm sm:text-base font-bold flex items-center gap-2">
              <Moon className="w-4 h-4 text-[#0EA5E9]" />
              Laboratorio de Hábitos, Sueño y Energía
            </h3>

            <div className="flex flex-wrap gap-1.5">
              {HABIT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setHabitCategory(cat.id)}
                  className={`min-h-[36px] rounded-xl border px-3 py-1 text-xs font-semibold cursor-pointer ${
                    habitCategory === cat.id
                      ? 'border-[#0EA5E9] bg-[#0EA5E9] text-white'
                      : 'fabro-border fabro-surface fabro-muted'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={habitPrompt}
                onChange={(e) => setHabitPrompt(e.target.value)}
                placeholder="Ej: Me cuesta dormirme después de estudiar a la noche / Quiero un arranque sin celular..."
                className="flex-1 min-h-[42px] rounded-xl border fabro-border fabro-surface px-3.5 py-2 text-xs fabro-input"
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleGenerateHabits()}
                className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl border border-[#0EA5E9] bg-[#0EA5E9] hover:bg-[#0284C7] text-white px-4 py-2 text-xs sm:text-sm font-bold cursor-pointer active:scale-95 disabled:opacity-60 whitespace-nowrap"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {activeByok ? `Diseñar con ${engineLabel}` : 'Usar protocolo offline'}
              </button>
            </div>
          </div>

          {displayedHabitPlan && (
            <article className="rounded-2xl border fabro-border fabro-surface-elevated p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-[#0284C7] dark:text-[#38BDF8]">
                    {displayedHabitPlan.providerLabel} · {displayedHabitPlan.createdAt}
                  </p>
                  <h4 className="font-display text-base font-extrabold mt-0.5">
                    {displayedHabitPlan.title}
                  </h4>
                  <p className="text-xs fabro-muted mt-0.5">{displayedHabitPlan.summary}</p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    speakText(
                      displayedHabitPlan.id,
                      `${displayedHabitPlan.title}. ${displayedHabitPlan.summary}. ${displayedHabitPlan.habits
                        .map((h) => `${h.title} (${h.scheduleHint})`)
                        .join('. ')}`
                    )
                  }
                  className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-3 py-1 text-xs font-semibold cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {speakingId === displayedHabitPlan.id ? 'Detener' : 'Leer'}
                </button>
              </div>

              <div className="space-y-2 text-xs">
                {displayedHabitPlan.habits.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl border fabro-border fabro-surface p-3 flex flex-wrap items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{h.title}</p>
                      <p className="text-[11px] fabro-muted">{h.scheduleHint}</p>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(h.addedToOrganizer)}
                      onClick={() => {
                        if (!wellnessHabitPlans.some((p) => p.id === displayedHabitPlan.id)) {
                          saveWellnessHabitPlan(displayedHabitPlan);
                        }
                        addOrganizerTask(
                          `[Hábito diario] ${h.title}`,
                          'planificar',
                          'Bienestar · Hábitos',
                          'bienestar'
                        );
                        markWellnessHabitAdded(displayedHabitPlan.id, h.id);
                        notify('Hábito enviado como checklist al Organizador de FABRO.');
                      }}
                      className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap ${
                        h.addedToOrganizer
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'border-[#10B981] bg-[#10B981]/10 text-[#047857] dark:text-[#34D399]'
                      }`}
                    >
                      {h.addedToOrganizer ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          En Organizador
                        </>
                      ) : (
                        <>
                          <CalendarPlus className="w-3.5 h-3.5" />
                          Convertir en Checklist diario
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>
      )}

      {/* ============================================================
          MÓDULO 4: COMPAÑERO DE CLARIDAD MENTAL Y FILOSOFÍA ESTOICA
         ============================================================ */}
      {activeTab === 'claridad' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#F59E0B]/40 fabro-surface-elevated p-4 space-y-3">
            <div>
              <h3 className="font-display text-sm sm:text-base font-bold flex items-center gap-2">
                <Feather className="w-4 h-4 text-[#F59E0B]" />
                Compañero de Claridad Mental y Filosofía Estoica («El último día de tu vida»)
              </h3>
              <p className="text-xs fabro-muted mt-0.5">
                Solo cuando vos lo pedís: compartí cómo te sentís hoy para recibir un reencuadre
                sereno, un ejercicio práctico de calma y una pregunta de journaling privado.
              </p>
            </div>

            <textarea
              rows={3}
              value={moodFeeling}
              onChange={(e) => setMoodFeeling(e.target.value)}
              placeholder="Ej: Hoy siento presión por los exámenes y me cuesta frenar la mente..."
              className="w-full rounded-xl border fabro-border fabro-surface p-3 text-xs sm:text-sm leading-relaxed fabro-input"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] fabro-muted">
                Se guarda en tu cuaderno privado local (y en tu cuenta privada si iniciaste sesión).
              </span>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleGenerateStoic()}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-xl border border-[#F59E0B] bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 px-4 py-2 text-xs sm:text-sm font-bold cursor-pointer active:scale-95 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {activeByok ? `Reflexionar con ${engineLabel}` : 'Guía estoica offline'}
              </button>
            </div>
          </div>

          {displayedStoic && (
            <article className="rounded-2xl border border-[#F59E0B]/35 fabro-surface-elevated p-4 sm:p-5 space-y-3.5 text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-[#B45309] dark:text-[#FBBF24]">
                    {displayedStoic.providerLabel} · {displayedStoic.createdAt}
                  </p>
                  <h4 className="font-display text-base font-extrabold mt-0.5">
                    {displayedStoic.reframeTitle}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    speakText(
                      displayedStoic.id,
                      `${displayedStoic.reframeTitle}. ${displayedStoic.guidance}. Ejercicio práctico: ${displayedStoic.calmExercise}.`
                    )
                  }
                  className="min-h-[36px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface px-3 py-1 text-xs font-semibold cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {speakingId === displayedStoic.id ? 'Detener' : 'Escuchar'}
                </button>
              </div>

              <p className="text-sm leading-relaxed">{displayedStoic.guidance}</p>

              <div className="rounded-xl border border-[#10B981]/35 bg-[#10B981]/10 p-3.5 space-y-1">
                <p className="font-bold text-[#047857] dark:text-[#34D399]">
                  Ejercicio práctico de calma mental
                </p>
                <p className="leading-relaxed">{displayedStoic.calmExercise}</p>
              </div>

              <div className="rounded-xl border fabro-border fabro-surface p-3.5 space-y-2">
                <p className="font-bold">Journaling guiado para hoy:</p>
                <p className="italic fabro-muted">{displayedStoic.journalPrompt}</p>
                <textarea
                  rows={3}
                  value={displayedStoic.userNotes || ''}
                  onChange={(e) => {
                    if (!wellnessStoicSessions.some((s) => s.id === displayedStoic.id)) {
                      saveWellnessStoicSession({ ...displayedStoic, userNotes: e.target.value });
                    } else {
                      updateWellnessStoicSessionNotes(displayedStoic.id, e.target.value);
                    }
                  }}
                  placeholder="Escribí tu respuesta personal acá (guardado automático privado)..."
                  className="w-full rounded-xl border fabro-border fabro-surface-elevated p-2.5 text-xs leading-relaxed fabro-input"
                />
              </div>
            </article>
          )}
        </div>
      )}

      {/* ============================================================
          PANEL DE GUARDADO Y SEGUIMIENTO OFFLINE & NUBE
         ============================================================ */}
      {activeTab === 'guardados' && (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-bold">
                Mis Planes de Bienestar Guardados
              </h3>
              <p className="fabro-muted">
                {authUser
                  ? 'Guardados offline en IndexedDB y sincronizados en tu nube privada (users/wellness).'
                  : 'Guardados offline en IndexedDB/LocalStorage para usar en el gimnasio o la cocina sin internet.'}
              </p>
            </div>
          </div>

          {totalSavedCount === 0 ? (
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-6 text-center fabro-muted">
              Todavía no guardaste planes generados. Probá cualquiera de los 4 generadores de arriba
              y quedarán disponibles acá incluso sin conexión.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {wellnessDietPlans.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 flex items-start justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDiet(d);
                      setActiveTab('dietas');
                    }}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <p className="text-[11px] font-bold text-[#10B981]">Dieta · {d.createdAt}</p>
                    <p className="font-bold truncate">{d.title}</p>
                    <p className="fabro-muted line-clamp-2 mt-0.5">{d.summary}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWellnessDietPlan(d.id)}
                    aria-label="Eliminar dieta"
                    className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border flex items-center justify-center text-rose-500 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {wellnessWorkoutPlans.map((w) => (
                <div
                  key={w.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 flex items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveWorkout(w);
                        setActiveTab('entrenador');
                      }}
                      className="text-left w-full cursor-pointer"
                    >
                      <p className="text-[11px] font-bold text-[#0EA5E9]">
                        Rutina ({w.durationLabel}) · {w.createdAt}
                      </p>
                      <p className="font-bold truncate">{w.title}</p>
                      <p className="fabro-muted truncate">
                        {w.exercises.length} ejercicios · {w.equipmentLabel}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimerPlan(w)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#10B981] text-white px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      Iniciar Rutina
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteWellnessWorkoutPlan(w.id)}
                    aria-label="Eliminar rutina"
                    className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border flex items-center justify-center text-rose-500 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {wellnessHabitPlans.map((h) => (
                <div
                  key={h.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 flex items-start justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveHabitPlan(h);
                      setActiveTab('habitos');
                    }}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <p className="text-[11px] font-bold text-[#0284C7] dark:text-[#38BDF8]">
                      Hábitos · {h.createdAt}
                    </p>
                    <p className="font-bold truncate">{h.title}</p>
                    <p className="fabro-muted truncate">{h.habits.length} hábitos accionables</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWellnessHabitPlan(h.id)}
                    aria-label="Eliminar protocolo de hábitos"
                    className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border flex items-center justify-center text-rose-500 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {wellnessStoicSessions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 flex items-start justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStoic(s);
                      setActiveTab('claridad');
                    }}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <p className="text-[11px] font-bold text-[#B45309] dark:text-[#FBBF24]">
                      Claridad Estoica · {s.createdAt}
                    </p>
                    <p className="font-bold truncate">{s.reframeTitle}</p>
                    <p className="fabro-muted line-clamp-2 mt-0.5">{s.moodFeeling}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteWellnessStoicSession(s.id)}
                    aria-label="Eliminar reflexión"
                    className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border flex items-center justify-center text-rose-500 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Interactive Workout Timer Modal */}
      <WellnessWorkoutTimerModal plan={timerPlan} onClose={() => setTimerPlan(null)} />
    </section>
  );
};
