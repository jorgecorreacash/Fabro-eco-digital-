import React, { useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  ArrowRight,
  BellRing,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Droplets,
  Dumbbell,
  Flame,
  HeartPulse,
  Info,
  ListChecks,
  Minus,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  Timer,
  Trash2,
  Utensils,
  Volume2,
  X,
} from 'lucide-react';
import {
  DIETARY_PREFERENCE_LABELS,
  HABIT_CATEGORY_LABELS,
  NUTRITION_GOAL_LABELS,
  ROUTINE_PERIOD_LABELS,
  WELLNESS_FOCUS_LABELS,
  getLocalTodayDateKey,
  useHabitTimer,
  type HabitCategory,
  type HabitItem,
} from '../../context/HabitTimerContext';
import { useEffect } from 'react';
import { useFabro } from '../../context/FabroContext';
import { useAIGateway } from '../../context/AIGatewayContext';
import { getSectorAiPreferences } from '../../lib/fabroId';
import { HABIT_TONE_LABELS, type HabitToneId } from '../../lib/habitSound';
import type {
  DailyMealItem,
  DietaryPreference,
  HabitRoutine,
  HabitStepCategory,
  NutritionGoal,
  RoutinePeriod,
  WellnessFocusArea,
} from '../../types/fabro';

type WellnessTab = 'temporizador' | 'rutinas' | 'nutricion' | 'salud_ia';

const WEEKDAY_LABELS: Array<{ day: number; short: string }> = [
  { day: 1, short: 'L' },
  { day: 2, short: 'M' },
  { day: 3, short: 'X' },
  { day: 4, short: 'J' },
  { day: 5, short: 'V' },
  { day: 6, short: 'S' },
  { day: 0, short: 'D' },
];

const STEP_CATEGORY_LABELS: Record<HabitStepCategory, string> = {
  ejercicio: 'Ejercicio físico',
  trabajo: 'Trabajo',
  limpieza: 'Limpieza y orden',
  estudio: 'Estudio',
  descanso: 'Descanso activo',
  nutricion: 'Nutrición',
  salud_mental: 'Salud mental',
  personalizado: 'Personalizado',
};

function formatCountdown(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const HabitWellnessView: React.FC = () => {
  const {
    habits,
    activeHabit,
    remainingSeconds,
    isRunning,
    isPaused,
    completions,
    selectHabit,
    startHabit,
    pauseTimer,
    resumeTimer,
    resetTimer,
    addMinutes,
    completeNow,
    addHabit,
    updateHabit,
    deleteHabit,
    restoreDefaultHabits,
    testSound,
    clearTodayCompletions,

    routines,
    activeRoutineRun,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    toggleRoutineActive,
    addRoutineStep,
    deleteRoutineStep,
    toggleRoutineStepDoneToday,
    startRoutineStepWithTimer,
    startFullRoutine,
    advanceRoutineStep,
    stopRoutineRun,
    restoreDefaultRoutines,

    nutritionProfile,
    updateNutritionProfile,
    dailyMeals,
    nutritionLog,
    addWaterGlass,
    toggleMealCompleted,
    updateMealItem,
    resetDefaultMeals,
    mealPlanLoading,
    mealPlanError,
    generateDailyMealPlanWithAI,

    dailyWellness,
    wellnessFocus,
    setWellnessFocus,
    wellnessLoading,
    wellnessError,
    refreshDailyWellnessWithAI,
    convertSuggestionToHabit,
  } = useHabitTimer();

  const { user, setActiveSection } = useFabro();
  const { personalConnections } = useAIGateway();
  const [tab, setTab] = useState<WellnessTab>('temporizador');
  const [notice, setNotice] = useState<string | null>(null);
  const [bienestarAiLabel, setBienestarAiLabel] = useState('Auto FABRO');

  useEffect(() => {
    const syncLabel = () => {
      const pref = getSectorAiPreferences(user?.uid).bienestar;
      if (pref.providerMode === 'personal' && pref.personalConnectionId) {
        const conn = personalConnections.find((c) => c.id === pref.personalConnectionId);
        setBienestarAiLabel(conn ? `${conn.label} (${conn.selectedModel})` : 'IA Personal');
      } else if (pref.providerMode === 'fabro_gemini') {
        setBienestarAiLabel('Gemini (FABRO)');
      } else if (pref.providerMode === 'fabro_openai') {
        setBienestarAiLabel('ChatGPT (FABRO)');
      } else {
        setBienestarAiLabel('Auto FABRO');
      }
    };
    syncLabel();
    window.addEventListener('fabro-sector-ai-updated', syncLabel);
    return () => window.removeEventListener('fabro-sector-ai-updated', syncLabel);
  }, [user?.uid, personalConnections]);

  const todayKey = getLocalTodayDateKey();
  const todayIsoPrefix = new Date().toISOString().slice(0, 10);

  // ------------------------------------------------------------------
  // 1. Habit Editor State
  // ------------------------------------------------------------------
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState<HabitCategory>('ejercicio');
  const [habitMinutes, setHabitMinutes] = useState<number>(30);
  const [habitTone, setHabitTone] = useState<HabitToneId>('acorde');
  const [habitVolume, setHabitVolume] = useState<number>(0.85);
  const [habitRepeats, setHabitRepeats] = useState<number>(2);
  const [habitSoundEnabled, setHabitSoundEnabled] = useState<boolean>(true);
  const [habitVoiceAlert, setHabitVoiceAlert] = useState<boolean>(false);
  const [habitAutoLog, setHabitAutoLog] = useState<boolean>(false);

  const resetHabitForm = () => {
    setEditingHabitId(null);
    setHabitName('');
    setHabitCategory('ejercicio');
    setHabitMinutes(30);
    setHabitTone('acorde');
    setHabitVolume(0.85);
    setHabitRepeats(2);
    setHabitSoundEnabled(true);
    setHabitVoiceAlert(false);
    setHabitAutoLog(false);
  };

  const handleLoadHabitIntoEditor = (h: HabitItem) => {
    setEditingHabitId(h.id);
    setHabitName(h.name);
    setHabitCategory(h.category);
    setHabitMinutes(h.durationMinutes);
    setHabitTone(h.tone);
    setHabitVolume(h.volume);
    setHabitRepeats(h.repeats);
    setHabitSoundEnabled(h.soundEnabled);
    setHabitVoiceAlert(h.voiceAlert);
    setHabitAutoLog(h.autoLogStudySession);
  };

  const handleSaveHabitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitName.trim()) return;
    const payload: Omit<HabitItem, 'id'> = {
      name: habitName.trim(),
      category: habitCategory,
      durationMinutes: Math.max(1, Math.min(240, Number(habitMinutes) || 15)),
      tone: habitTone,
      volume: Math.max(0.1, Math.min(1, Number(habitVolume) || 0.8)),
      repeats: Math.max(1, Math.min(4, Number(habitRepeats) || 2)),
      soundEnabled: habitSoundEnabled,
      voiceAlert: habitVoiceAlert,
      autoLogStudySession: habitAutoLog || habitCategory === 'estudio',
    };
    if (editingHabitId) {
      updateHabit(editingHabitId, payload);
      setNotice(`Hábito "${payload.name}" actualizado.`);
    } else {
      const created = addHabit(payload);
      selectHabit(created.id);
      setNotice(`Hábito "${created.name}" agregado (${created.durationMinutes} min).`);
    }
    resetHabitForm();
  };

  // ------------------------------------------------------------------
  // 2. Routine Creator & Step Editor State
  // ------------------------------------------------------------------
  const [routineName, setRoutineName] = useState('');
  const [routineDesc, setRoutineDesc] = useState('');
  const [routinePeriod, setRoutinePeriod] = useState<RoutinePeriod>('manana');
  const [routineDays, setRoutineDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [addingStepRoutineId, setAddingStepRoutineId] = useState<string | null>(null);
  const [stepTitle, setStepTitle] = useState('');
  const [stepCategory, setStepCategory] = useState<HabitStepCategory>('ejercicio');
  const [stepMinutes, setStepMinutes] = useState<number>(20);
  const [stepTime, setStepTime] = useState<string>('08:30');

  const handleToggleRoutineDay = (day: number) => {
    setRoutineDays((prev) =>
      prev.includes(day) ? (prev.length > 1 ? prev.filter((d) => d !== day) : prev) : [...prev, day]
    );
  };

  const handleCreateRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineName.trim()) return;
    const created = addRoutine({
      name: routineName.trim(),
      description: routineDesc.trim() || 'Rutina configurable diaria.',
      period: routinePeriod,
      daysOfWeek: routineDays,
      steps: [],
    });
    setRoutineName('');
    setRoutineDesc('');
    setAddingStepRoutineId(created.id);
    setNotice(`Rutina "${created.name}" creada. Ahora podés agregar sus pasos.`);
  };

  const handleAddStepSubmit = (e: React.FormEvent, routineId: string) => {
    e.preventDefault();
    if (!stepTitle.trim()) return;
    addRoutineStep(routineId, {
      title: stepTitle.trim(),
      category: stepCategory,
      durationMinutes: Math.max(1, Math.min(240, Number(stepMinutes) || 15)),
      scheduledTime: stepTime || '09:00',
    });
    setStepTitle('');
    setStepMinutes(20);
    setNotice('Paso agregado a la rutina.');
  };

  // ------------------------------------------------------------------
  // 3. Meal Inline Editor State
  // ------------------------------------------------------------------
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [mealTitleDraft, setMealTitleDraft] = useState('');
  const [mealFoodsDraft, setMealFoodsDraft] = useState('');
  const [mealKcalDraft, setMealKcalDraft] = useState<number>(350);

  const openMealEditor = (meal: DailyMealItem) => {
    setEditingMealId(meal.id);
    setMealTitleDraft(meal.title);
    setMealFoodsDraft(meal.foods.join(', '));
    setMealKcalDraft(meal.approxKcal);
  };

  const handleSaveMealEdit = (mealId: string) => {
    const foods = mealFoodsDraft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateMealItem(mealId, {
      title: mealTitleDraft.trim() || 'Comida personalizada',
      foods: foods.length > 0 ? foods : ['Plato equilibrado'],
      approxKcal: Math.max(50, Math.min(2000, Number(mealKcalDraft) || 300)),
    });
    setEditingMealId(null);
    setNotice('Comida actualizada en tu plan diario.');
  };

  // ------------------------------------------------------------------
  // Metrics & Derived Data
  // ------------------------------------------------------------------
  const todayHabitLogs = useMemo(
    () =>
      completions.filter(
        (c) => c.completedAt.startsWith(todayKey) || c.completedAt.startsWith(todayIsoPrefix)
      ),
    [completions, todayIsoPrefix, todayKey]
  );

  const todayHabitMinutes = useMemo(
    () => todayHabitLogs.reduce((sum, c) => sum + c.durationMinutes, 0),
    [todayHabitLogs]
  );

  const routineMetrics = useMemo(() => {
    let totalSteps = 0;
    let completedSteps = 0;
    for (const rt of routines) {
      if (!rt.active) continue;
      for (const st of rt.steps) {
        totalSteps += 1;
        if (st.completedDates.includes(todayKey)) completedSteps += 1;
      }
    }
    return { totalSteps, completedSteps };
  }, [routines, todayKey]);

  const activeRoutineDetails = useMemo(() => {
    if (!activeRoutineRun) return null;
    const rt = routines.find((r) => r.id === activeRoutineRun.routineId);
    if (!rt) return null;
    return { routine: rt, run: activeRoutineRun };
  }, [activeRoutineRun, routines]);

  const totalEstimatedKcal = useMemo(
    () => dailyMeals.reduce((acc, m) => acc + (m.approxKcal || 0), 0),
    [dailyMeals]
  );

  const completedKcal = useMemo(
    () =>
      dailyMeals
        .filter((m) => nutritionLog.completedMealIds.includes(m.id))
        .reduce((acc, m) => acc + (m.approxKcal || 0), 0),
    [dailyMeals, nutritionLog.completedMealIds]
  );

  const renderCategoryIcon = (cat: HabitCategory | HabitStepCategory) => {
    if (cat === 'ejercicio') return <Dumbbell className="w-4 h-4 text-emerald-500 shrink-0" />;
    if (cat === 'trabajo') return <Clock className="w-4 h-4 text-sky-500 shrink-0" />;
    if (cat === 'limpieza') return <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />;
    if (cat === 'estudio') return <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />;
    if (cat === 'descanso') return <Coffee className="w-4 h-4 text-teal-500 shrink-0" />;
    if (cat === 'nutricion') return <Apple className="w-4 h-4 text-lime-500 shrink-0" />;
    if (cat === 'salud_mental') return <Brain className="w-4 h-4 text-violet-500 shrink-0" />;
    return <Timer className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  return (
    <div className="space-y-6">
      {/* Header & Always-Visible Quick Timer Strip */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              HÁBITOS · RUTINAS · NUTRICIÓN · SALUD IA
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Temporizador de Hábitos y Bienestar Integral
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl">
              Controlá bloques configurables con alertas sonoras, organizá tus rutinas diarias, seguí tu plan nutricional e hidratación y recibí recomendaciones de salud mental y física actualizadas cada día por IA. Motor activo de Bienestar: <strong className="text-slate-900 dark:text-white">{bienestarAiLabel}</strong>.
            </p>
          </div>

          {/* Persistent Live Mini-Timer Control */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-4 py-3 flex flex-wrap items-center gap-3 shrink-0">
            <div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                {activeHabit.name}
              </p>
              <p className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {formatCountdown(remainingSeconds)}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {isRunning ? (
                <button
                  type="button"
                  onClick={pauseTimer}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pausar</span>
                </button>
              ) : isPaused ? (
                <button
                  type="button"
                  onClick={resumeTimer}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Reanudar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startHabit()}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar</span>
                </button>
              )}
              <button
                type="button"
                onClick={resetTimer}
                title="Reiniciar temporizador"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-500/50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Daily Metrics Summary Bar (zero pills, clean tabular alignment) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Hábitos hoy</p>
            <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {todayHabitLogs.length} · {todayHabitMinutes}m
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Pasos de rutina hoy</p>
            <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {routineMetrics.completedSteps}/{routineMetrics.totalSteps}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Agua y comidas hoy</p>
            <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
              {nutritionLog.waterGlasses}/{nutritionProfile.waterTargetGlasses} vasos · {nutritionLog.completedMealIds.length}/{dailyMeals.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-3.5 py-2.5">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Guía IA del día</p>
            <p className="text-base font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 truncate">
              {dailyWellness?.dateKey === todayKey ? `Actualizada · ${todayKey}` : `Pendiente · ${todayKey}`}
            </p>
          </div>
        </div>

        {/* Active Routine Execution Banner */}
        {activeRoutineDetails && (
          <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-bold text-sky-800 dark:text-sky-200">
                Ejecutando rutina: {activeRoutineDetails.routine.name}
              </p>
              <p className="text-sky-700 dark:text-sky-300 mt-0.5 font-mono tabular-nums">
                Paso {activeRoutineDetails.run.currentStepIndex + 1} de {activeRoutineDetails.routine.steps.length}:{' '}
                {activeRoutineDetails.routine.steps[activeRoutineDetails.run.currentStepIndex]?.title || 'Completado'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeRoutineDetails.run.currentStepIndex + 1 < activeRoutineDetails.routine.steps.length && (
                <button
                  type="button"
                  onClick={advanceRoutineStep}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Siguiente paso</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={stopRoutineRun}
                className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:text-sky-200 hover:bg-sky-500/15 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Square className="w-3 h-3" />
                <span>Detener rutina</span>
              </button>
            </div>
          </div>
        )}

        {/* Primary Tool Switcher Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'temporizador', label: 'Temporizador y Hábitos', icon: Timer },
            { id: 'rutinas', label: 'Rutinas Configurables', icon: ListChecks },
            { id: 'nutricion', label: 'Dieta Nutricional', icon: Utensils },
            { id: 'salud_ia', label: 'Salud Mental y Física (IA Diaria)', icon: HeartPulse },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as WellnessTab)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'border-sky-500 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300 hover:border-sky-500/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {notice && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-medium text-sky-800 dark:text-sky-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-sky-700 dark:text-sky-300 hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: TEMPORIZADOR DE HÁBITOS CONFIGURABLE + ALERTAS SONORAS       */}
      {/* =================================================================== */}
      {tab === 'temporizador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {renderCategoryIcon(activeHabit.category)}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {HABIT_CATEGORY_LABELS[activeHabit.category]} · {activeHabit.durationMinutes} min
                  </p>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {activeHabit.name}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <BellRing className="w-3.5 h-3.5 text-sky-500" />
                <span>
                  {activeHabit.soundEnabled
                    ? `${HABIT_TONE_LABELS[activeHabit.tone]} (${activeHabit.repeats}x)`
                    : 'Sin tono'}
                  {activeHabit.voiceAlert ? ' · Voz activa' : ''}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-6 sm:p-8 text-center space-y-5">
              <p className="font-mono text-6xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
                {formatCountdown(remainingSeconds)}
              </p>

              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-600 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        Math.round(
                          ((activeHabit.durationMinutes * 60 - remainingSeconds) /
                            Math.max(1, activeHabit.durationMinutes * 60)) *
                            100
                        )
                      )
                    )}%`,
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {isRunning ? (
                  <button
                    type="button"
                    onClick={pauseTimer}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Pausar</span>
                  </button>
                ) : isPaused ? (
                  <button
                    type="button"
                    onClick={resumeTimer}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4" />
                    <span>Reanudar</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startHabit()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4" />
                    <span>Iniciar hábito</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={resetTimer}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-sky-500/50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reiniciar</span>
                </button>

                <button
                  type="button"
                  onClick={() => addMinutes(5)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 hover:border-sky-500/50 cursor-pointer whitespace-nowrap shrink-0"
                >
                  +5 min
                </button>

                <button
                  type="button"
                  onClick={completeNow}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Completar y sonar</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Tus hábitos configurados ({habits.length})
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    restoreDefaultHabits();
                    setNotice('Hábitos base restaurados.');
                  }}
                  className="text-[11px] font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Restaurar sugeridos
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {habits.map((h) => {
                  const selected = h.id === activeHabit.id;
                  return (
                    <div
                      key={h.id}
                      className={`rounded-xl border p-3 transition-colors flex items-start justify-between gap-2 ${
                        selected
                          ? 'border-sky-500 bg-sky-500/10'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectHabit(h.id)}
                        className="flex-1 min-w-0 flex items-start gap-2.5 text-left cursor-pointer"
                      >
                        <div className="mt-0.5">{renderCategoryIcon(h.category)}</div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {h.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                            {h.durationMinutes} min · {HABIT_TONE_LABELS[h.tone]}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadHabitIntoEditor(h)}
                          title="Editar hábito"
                          className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-sky-600 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {habits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteHabit(h.id)}
                            title="Eliminar hábito"
                            className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleSaveHabitForm}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {editingHabitId ? (
                    <Pencil className="w-4 h-4 text-sky-500" />
                  ) : (
                    <Plus className="w-4 h-4 text-sky-500" />
                  )}
                  <span>
                    {editingHabitId ? 'Editar hábito seleccionado' : 'Configurar nuevo hábito'}
                  </span>
                </h4>
                {editingHabitId && (
                  <button
                    type="button"
                    onClick={resetHabitForm}
                    className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre del hábito o actividad
                  </label>
                  <input
                    type="text"
                    required
                    value={habitName}
                    onChange={(e) => setHabitName(e.target.value)}
                    placeholder="Ej: Hacer ejercicio, Limpieza, Trabajar, Estudiar..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Categoría
                    </label>
                    <select
                      value={habitCategory}
                      onChange={(e) => setHabitCategory(e.target.value as HabitCategory)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-slate-900 dark:text-white"
                    >
                      {(Object.keys(HABIT_CATEGORY_LABELS) as HabitCategory[]).map((cat) => (
                        <option key={cat} value={cat}>
                          {HABIT_CATEGORY_LABELS[cat]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Duración (minutos)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={240}
                      required
                      value={habitMinutes}
                      onChange={(e) => setHabitMinutes(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 font-mono tabular-nums text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[5, 10, 15, 25, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setHabitMinutes(m)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-mono tabular-nums cursor-pointer ${
                        habitMinutes === m
                          ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={habitSoundEnabled}
                      onChange={(e) => setHabitSoundEnabled(e.target.checked)}
                    />
                    <span>Activar alerta sonora</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      testSound({
                        tone: habitTone,
                        volume: habitVolume,
                        repeats: 1,
                        habitName: habitName || activeHabit.name,
                        voiceAlert: habitVoiceAlert,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Probar sonido</span>
                  </button>
                </div>

                {habitSoundEnabled && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        Tono de alerta
                      </label>
                      <select
                        value={habitTone}
                        onChange={(e) => setHabitTone(e.target.value as HabitToneId)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
                      >
                        {(Object.keys(HABIT_TONE_LABELS) as HabitToneId[]).map((t) => (
                          <option key={t} value={t}>
                            {HABIT_TONE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        Repeticiones
                      </label>
                      <select
                        value={habitRepeats}
                        onChange={(e) => setHabitRepeats(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 font-mono text-slate-900 dark:text-white"
                      >
                        <option value={1}>1 vez</option>
                        <option value={2}>2 veces</option>
                        <option value={3}>3 veces</option>
                        <option value={4}>4 veces</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        <span>Volumen de alerta</span>
                        <span className="font-mono tabular-nums">{Math.round(habitVolume * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={habitVolume}
                        onChange={(e) => setHabitVolume(Number(e.target.value))}
                        className="w-full accent-sky-600"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={habitVoiceAlert}
                    onChange={(e) => setHabitVoiceAlert(e.target.checked)}
                  />
                  <span>Anunciar por voz al finalizar (&ldquo;Tiempo completado...&rdquo;)</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={habitAutoLog || habitCategory === 'estudio'}
                    onChange={(e) => setHabitAutoLog(e.target.checked)}
                  />
                  <span>Registrar automáticamente en Mi Progreso al completar</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                {editingHabitId ? 'Guardar cambios del hábito' : 'Agregar hábito al temporizador'}
              </button>
            </form>

            {/* Today's Completed Habit Log */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Registro de hoy
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {todayHabitLogs.length} completados · {todayHabitMinutes} min totales
                  </p>
                </div>
                {todayHabitLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={clearTodayCompletions}
                    className="text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    Limpiar hoy
                  </button>
                )}
              </div>

              {todayHabitLogs.length === 0 ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Aún no completaste ningún bloque hoy. Seleccioná un hábito y presioná Iniciar.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {todayHabitLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {renderCategoryIcon(log.category)}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {log.habitName}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                        {log.durationMinutes} min ·{' '}
                        {new Date(log.completedAt).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: CONTROL DE RUTINAS CONFIGURABLES                             */}
      {/* =================================================================== */}
      {tab === 'rutinas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Routines List & Step Execution */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Tus rutinas configurables ({routines.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  restoreDefaultRoutines();
                  setNotice('Rutinas base restauradas.');
                }}
                className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Restaurar rutinas sugeridas
              </button>
            </div>

            {routines.map((rt: HabitRoutine) => {
              const doneTodayCount = rt.steps.filter((s) => s.completedDates.includes(todayKey)).length;
              const progressPct =
                rt.steps.length > 0 ? Math.round((doneTodayCount / rt.steps.length) * 100) : 0;
              const isAddingHere = addingStepRoutineId === rt.id;

              return (
                <section
                  key={rt.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        <span className="uppercase tracking-wide text-sky-600 dark:text-sky-400">
                          {ROUTINE_PERIOD_LABELS[rt.period]}
                        </span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          {doneTodayCount}/{rt.steps.length} pasos hoy ({progressPct}%)
                        </span>
                        <span>·</span>
                        <span>{rt.active ? 'Activa' : 'Pausada'}</span>
                      </div>
                      <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        {rt.name}
                      </h4>
                      {rt.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300">{rt.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {rt.steps.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            startFullRoutine(rt.id);
                            setNotice(`Rutina "${rt.name}" iniciada en el temporizador.`);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Ejecutar rutina</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleRoutineActive(rt.id)}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-sky-500/40 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {rt.active ? 'Pausar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRoutine(rt.id)}
                        title="Eliminar rutina"
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Weekday Schedule Selector */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1">
                      {WEEKDAY_LABELS.map((wd) => {
                        const enabled = rt.daysOfWeek.includes(wd.day);
                        return (
                          <button
                            key={wd.day}
                            type="button"
                            onClick={() => {
                              const nextDays = enabled
                                ? rt.daysOfWeek.length > 1
                                  ? rt.daysOfWeek.filter((d) => d !== wd.day)
                                  : rt.daysOfWeek
                                : [...rt.daysOfWeek, wd.day];
                              updateRoutine(rt.id, { daysOfWeek: nextDays });
                            }}
                            className={`w-7 h-7 rounded-lg border text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                              enabled
                                ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                : 'border-slate-200 dark:border-slate-800 text-slate-400'
                            }`}
                          >
                            {wd.short}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex-1 min-w-[140px] max-w-xs h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Ordered Routine Steps */}
                  <div className="space-y-2">
                    {rt.steps.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Sin pasos configurados todavía. Agregá tu primer bloque de hábito abajo.
                      </p>
                    ) : (
                      rt.steps.map((st, idx) => {
                        const done = st.completedDates.includes(todayKey);
                        const isActiveStep =
                          activeRoutineRun?.routineId === rt.id &&
                          activeRoutineRun.currentStepIndex === idx;
                        return (
                          <div
                            key={st.id}
                            className={`rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 ${
                              isActiveStep
                                ? 'border-sky-500 bg-sky-500/10'
                                : done
                                ? 'border-emerald-500/30 bg-emerald-500/5'
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => toggleRoutineStepDoneToday(rt.id, st.id)}
                                aria-label={`Marcar paso ${st.title}`}
                                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
                                  done
                                    ? 'border-emerald-500 bg-emerald-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-sky-500'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              {renderCategoryIcon(st.category)}
                              <div className="min-w-0">
                                <p
                                  className={`text-xs font-semibold truncate ${
                                    done
                                      ? 'line-through text-slate-400 dark:text-slate-500'
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {st.title}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                  {st.scheduledTime} · {st.durationMinutes} min ·{' '}
                                  {STEP_CATEGORY_LABELS[st.category]}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  startRoutineStepWithTimer(rt.id, st.id);
                                  setNotice(`Paso "${st.title}" (${st.durationMinutes} min) iniciado.`);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <Play className="w-3 h-3" />
                                <span>Temporizar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteRoutineStep(rt.id, st.id)}
                                title="Eliminar paso"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Step Inline Form */}
                  {isAddingHere ? (
                    <form
                      onSubmit={(e) => handleAddStepSubmit(e, rt.id)}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3.5 space-y-2.5 text-xs"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          required
                          value={stepTitle}
                          onChange={(e) => setStepTitle(e.target.value)}
                          placeholder="Actividad del paso (ej. Estiramiento lumbar)"
                          className="sm:col-span-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-1.5 text-slate-900 dark:text-white"
                        />
                        <select
                          value={stepCategory}
                          onChange={(e) => setStepCategory(e.target.value as HabitStepCategory)}
                          className="sm:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-2.5 py-1.5 text-slate-900 dark:text-white"
                        >
                          {(Object.keys(STEP_CATEGORY_LABELS) as HabitStepCategory[]).map((c) => (
                            <option key={c} value={c}>
                              {STEP_CATEGORY_LABELS[c]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={stepTime}
                          onChange={(e) => setStepTime(e.target.value)}
                          className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-2 py-1.5 font-mono text-slate-900 dark:text-white"
                        />
                        <input
                          type="number"
                          min={1}
                          max={240}
                          value={stepMinutes}
                          onChange={(e) => setStepMinutes(Math.max(1, Number(e.target.value) || 1))}
                          className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-2.5 py-1.5 font-mono text-slate-900 dark:text-white"
                          title="Minutos"
                        />
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setAddingStepRoutineId(null)}
                          className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          Cerrar
                        </button>
                        <button
                          type="submit"
                          className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                        >
                          Guardar paso
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingStepRoutineId(rt.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar paso a esta rutina</span>
                    </button>
                  )}
                </section>
              );
            })}
          </div>

          {/* Right: Create New Routine */}
          <form
            onSubmit={handleCreateRoutine}
            className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3.5 text-xs"
          >
            <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-sky-500" />
              <span>Crear nueva rutina configurable</span>
            </h4>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nombre de la rutina
              </label>
              <input
                type="text"
                required
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="Ej: Rutina previa al examen, Entrenamiento tarde..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Franja del día
              </label>
              <select
                value={routinePeriod}
                onChange={(e) => setRoutinePeriod(e.target.value as RoutinePeriod)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-slate-900 dark:text-white"
              >
                {(Object.keys(ROUTINE_PERIOD_LABELS) as RoutinePeriod[]).map((p) => (
                  <option key={p} value={p}>
                    {ROUTINE_PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Días de la semana
              </label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((wd) => {
                  const selected = routineDays.includes(wd.day);
                  return (
                    <button
                      key={wd.day}
                      type="button"
                      onClick={() => handleToggleRoutineDay(wd.day)}
                      className={`w-8 h-8 rounded-lg border font-mono font-bold cursor-pointer ${
                        selected
                          ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          : 'border-slate-200 dark:border-slate-800 text-slate-400'
                      }`}
                    >
                      {wd.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Objetivo o descripción (opcional)
              </label>
              <textarea
                rows={2}
                value={routineDesc}
                onChange={(e) => setRoutineDesc(e.target.value)}
                placeholder="Ej: Mantener foco sin fatiga visual..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-sky-600 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              Crear rutina
            </button>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: DIETA NUTRICIONAL INTEGRADA & HIDRATACIÓN                    */}
      {/* =================================================================== */}
      {tab === 'nutricion' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Hydration & Nutritional Profile Config */}
          <div className="lg:col-span-4 space-y-5">
            {/* Water Intake Tracker */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-sky-500" />
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Hidratación diaria
                  </h4>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-sky-600 dark:text-sky-400">
                  {nutritionLog.waterGlasses}/{nutritionProfile.waterTargetGlasses} vasos
                </span>
              </div>

              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(
                        (nutritionLog.waterGlasses / Math.max(1, nutritionProfile.waterTargetGlasses)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => addWaterGlass(-1)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-sky-500/40 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>1 vaso</span>
                </button>
                <button
                  type="button"
                  onClick={() => addWaterGlass(1)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Sumar vaso de agua</span>
                </button>
              </div>
            </section>

            {/* Nutritional Preferences */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3.5 text-xs">
              <div className="flex items-center gap-2">
                <Apple className="w-4 h-4 text-emerald-500" />
                <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Perfil nutricional
                </h4>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Objetivo nutricional
                </label>
                <select
                  value={nutritionProfile.goal}
                  onChange={(e) =>
                    updateNutritionProfile({ goal: e.target.value as NutritionGoal })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-slate-900 dark:text-white"
                >
                  {(Object.keys(NUTRITION_GOAL_LABELS) as NutritionGoal[]).map((g) => (
                    <option key={g} value={g}>
                      {NUTRITION_GOAL_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Estilo de alimentación
                </label>
                <select
                  value={nutritionProfile.preference}
                  onChange={(e) =>
                    updateNutritionProfile({ preference: e.target.value as DietaryPreference })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-slate-900 dark:text-white"
                >
                  {(Object.keys(DIETARY_PREFERENCE_LABELS) as DietaryPreference[]).map((p) => (
                    <option key={p} value={p}>
                      {DIETARY_PREFERENCE_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alergias o alimentos a evitar
                </label>
                <input
                  type="text"
                  value={nutritionProfile.restrictions}
                  onChange={(e) => updateNutritionProfile({ restrictions: e.target.value })}
                  placeholder="Ej: maní, mariscos, azúcar refinada..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Meta diaria de agua (vasos)
                </label>
                <input
                  type="number"
                  min={4}
                  max={16}
                  value={nutritionProfile.waterTargetGlasses}
                  onChange={(e) =>
                    updateNutritionProfile({
                      waterTargetGlasses: Math.max(4, Math.min(16, Number(e.target.value) || 8)),
                    })
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 font-mono tabular-nums text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                disabled={mealPlanLoading}
                onClick={async () => {
                  const ok = await generateDailyMealPlanWithAI();
                  if (ok) {
                    setNotice('Plan nutricional diario adaptado con IA a tu perfil y rutinas.');
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
              >
                {mealPlanLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>
                  {mealPlanLoading ? 'Generando menú con IA...' : 'Generar menú de hoy con IA'}
                </span>
              </button>

              {mealPlanError && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{mealPlanError}</p>
              )}
            </section>
          </div>

          {/* Right: Daily Meal Cards */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Plan alimentario del día ({todayKey})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Completado: {completedKcal} / {totalEstimatedKcal} kcal estimadas ·{' '}
                  {nutritionLog.completedMealIds.length}/{dailyMeals.length} comidas
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveSection('calorias')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-[#F5D77F] hover:bg-amber-500/20 cursor-pointer whitespace-nowrap"
                >
                  <Flame className="w-3.5 h-3.5" />
                  Abrir Contador de Calorías
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetDefaultMeals();
                    setNotice('Plan nutricional base restaurado.');
                  }}
                  className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                >
                  Restaurar menú base
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {dailyMeals.map((meal) => {
                const completed = nutritionLog.completedMealIds.includes(meal.id);
                const isEditing = editingMealId === meal.id;

                return (
                  <article
                    key={meal.id}
                    className={`rounded-2xl border p-4 sm:p-5 space-y-3 transition-colors ${
                      completed
                        ? 'border-emerald-500/40 bg-emerald-500/5'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleMealCompleted(meal.id)}
                          aria-label={`Marcar ${meal.slotLabel} completado`}
                          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 cursor-pointer ${
                            completed
                              ? 'border-emerald-500 bg-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-500'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                            {meal.slotLabel} · {meal.approxKcal} kcal · {meal.prepMinutes} min prep
                          </p>
                          <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                            {meal.title}
                          </h4>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          isEditing ? setEditingMealId(null) : openMealEditor(meal)
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-sky-500/50 cursor-pointer shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>{isEditing ? 'Cerrar' : 'Editar'}</span>
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3.5 space-y-2.5 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Título del plato
                          </label>
                          <input
                            type="text"
                            value={mealTitleDraft}
                            onChange={(e) => setMealTitleDraft(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-1.5 text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="sm:col-span-3">
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Alimentos (separados por coma)
                            </label>
                            <input
                              type="text"
                              value={mealFoodsDraft}
                              onChange={(e) => setMealFoodsDraft(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-1.5 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Kcal aprox.
                            </label>
                            <input
                              type="number"
                              min={50}
                              max={2000}
                              value={mealKcalDraft}
                              onChange={(e) => setMealKcalDraft(Number(e.target.value) || 250)}
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-3 py-1.5 font-mono text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveMealEdit(meal.id)}
                            className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                          >
                            Guardar comida
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <ul className="text-xs text-slate-700 dark:text-slate-300 list-disc pl-5 space-y-0.5">
                          {meal.foods.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                        {meal.benefits && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Aporte: {meal.benefits}
                          </p>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-4 py-3 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
              <span>
                Esta guía nutricional es educativa y orientativa para acompañar hábitos saludables. Ante patologías, requerimientos deportivos específicos o embarazo, consultá con un licenciado en nutrición o profesional de la salud.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: SUGERENCIAS DIARIAS DE SALUD MENTAL Y FÍSICA POR IA          */}
      {/* =================================================================== */}
      {tab === 'salud_ia' && (
        <div className="space-y-5">
          {/* Controls & Focus Bar */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                ACTUALIZACIÓN DIARIA AUTOMÁTICA POR IA · {dailyWellness?.dateKey || todayKey}
              </p>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {dailyWellness?.dailyHeadline ||
                  'Sugerencias personalizadas de salud mental y física para hoy'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Se renuevan automáticamente cada día según tus rutinas y objetivo nutricional. También podés elegir un enfoque y actualizarlas ahora.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select
                value={wellnessFocus}
                onChange={(e) => setWellnessFocus(e.target.value as WellnessFocusArea)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs font-medium text-slate-900 dark:text-white"
              >
                {(Object.keys(WELLNESS_FOCUS_LABELS) as WellnessFocusArea[]).map((fk) => (
                  <option key={fk} value={fk}>
                    {WELLNESS_FOCUS_LABELS[fk]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={wellnessLoading}
                onClick={async () => {
                  const ok = await refreshDailyWellnessWithAI();
                  if (ok) {
                    setNotice('Sugerencias de salud mental y física actualizadas para hoy.');
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${wellnessLoading ? 'animate-spin' : ''}`} />
                <span>
                  {wellnessLoading ? 'Actualizando con IA...' : 'Actualizar hoy con IA'}
                </span>
              </button>
            </div>
          </section>

          {wellnessError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
              {wellnessError}
            </div>
          )}

          {wellnessLoading && !dailyWellness && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Generando recomendaciones de salud mental y física para hoy con IA...
            </div>
          )}

          {dailyWellness && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Mental Health Column */}
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-violet-500" />
                    <div>
                      <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Cuidado de Salud Mental
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Regulación del estrés, atención y descanso cognitivo
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {dailyWellness.mentalHealth.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 font-mono tabular-nums">
                              {item.category} · {item.durationMinutes} min
                            </p>
                            <h5 className="font-display text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                              {item.title}
                            </h5>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {item.description}
                        </p>

                        {item.actionableStep && (
                          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 border-l-2 border-violet-500 pl-2.5">
                            Paso concreto: {item.actionableStep}
                          </p>
                        )}

                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const created = convertSuggestionToHabit(item, 'mental');
                              setTab('temporizador');
                              setNotice(`"${created.name}" (${created.durationMinutes} min) listo en tu temporizador.`);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Timer className="w-3.5 h-3.5" />
                            <span>Pasar al temporizador</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                {/* Physical Health Column */}
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                        Cuidado de Salud Física
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Movilidad, postura, pausas activas y vitalidad corporal
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {dailyWellness.physicalHealth.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                              {item.category} · {item.durationMinutes} min
                            </p>
                            <h5 className="font-display text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                              {item.title}
                            </h5>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                          {item.description}
                        </p>

                        {item.actionableStep && (
                          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 border-l-2 border-emerald-500 pl-2.5">
                            Paso concreto: {item.actionableStep}
                          </p>
                        )}

                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const created = convertSuggestionToHabit(item, 'fisico');
                              setTab('temporizador');
                              setNotice(`"${created.name}" (${created.durationMinutes} min) listo en tu temporizador.`);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Timer className="w-3.5 h-3.5" />
                            <span>Pasar al temporizador</span>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>

              {/* Daily Nutrition & Hydration Tip */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                    CONSEJO NUTRICIONAL E HIDRATACIÓN DEL DÍA
                  </p>
                  <h4 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    {dailyWellness.nutritionTip.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {dailyWellness.nutritionTip.summary}
                  </p>
                  <p className="text-[11px] font-medium text-sky-700 dark:text-sky-300">
                    Recordatorio: {dailyWellness.nutritionTip.hydrationReminder}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    addWaterGlass(1);
                    setNotice('Vaso de agua registrado en tu seguimiento nutricional de hoy.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>Registrar 1 vaso de agua</span>
                </button>
              </section>
            </>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-4 py-3 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
            <span>
              Las sugerencias diarias de bienestar físico y mental tienen carácter preventivo y educativo para mejorar hábitos de estudio y descanso. No reemplazan la consulta con médicos, psicólogos o profesionales de la salud.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
