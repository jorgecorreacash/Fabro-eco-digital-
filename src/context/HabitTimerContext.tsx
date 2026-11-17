import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authFetch } from '../lib/apiClient';
import { playHabitAlertSound, stopHabitAlertSound, type HabitToneId } from '../lib/habitSound';
import type {
  CalorieBurnEntry,
  CalorieFoodEntry,
  DailyMealItem,
  DailyWellnessBundle,
  DietaryPreference,
  HabitRoutine,
  HabitStepCategory,
  NutritionDailyLog,
  NutritionGoal,
  NutritionProfile,
  RoutinePeriod,
  RoutineStep,
  WellnessFocusArea,
  WellnessSuggestionItem,
} from '../types/fabro';
import { useFabro } from './FabroContext';

export type HabitCategory =
  | 'ejercicio'
  | 'trabajo'
  | 'limpieza'
  | 'estudio'
  | 'descanso'
  | 'personalizado';

export const HABIT_CATEGORY_LABELS: Record<HabitCategory, string> = {
  ejercicio: 'Ejercicio físico',
  trabajo: 'Trabajo',
  limpieza: 'Limpieza y orden',
  estudio: 'Estudio',
  descanso: 'Descanso activo',
  personalizado: 'Personalizado',
};

export const ROUTINE_PERIOD_LABELS: Record<RoutinePeriod, string> = {
  manana: 'Mañana',
  tarde: 'Tarde',
  noche: 'Noche',
  personalizada: 'Personalizada',
};

export const NUTRITION_GOAL_LABELS: Record<NutritionGoal, string> = {
  energia_concentracion: 'Energía y concentración',
  equilibrio_general: 'Equilibrio general',
  rendimiento_fisico: 'Rendimiento físico',
  control_saludable: 'Control saludable y saciedad',
};

export const DIETARY_PREFERENCE_LABELS: Record<DietaryPreference, string> = {
  sin_restricciones: 'Sin restricciones',
  vegetariana: 'Vegetariana',
  vegana: 'Vegana',
  sin_tacc: 'Sin TACC (libre de gluten)',
  sin_lactosa: 'Sin lactosa',
  mediterranea: 'Estilo mediterráneo',
};

export const WELLNESS_FOCUS_LABELS: Record<WellnessFocusArea, string> = {
  equilibrio_integral: 'Equilibrio integral',
  estres_estudio: 'Manejo del estrés y estudio',
  energia_movimiento: 'Energía y movimiento físico',
  sueno_descanso: 'Descanso y recuperación mental',
};

export interface HabitItem {
  id: string;
  name: string;
  category: HabitCategory;
  durationMinutes: number;
  tone: HabitToneId;
  volume: number;
  repeats: number;
  soundEnabled: boolean;
  voiceAlert: boolean;
  autoLogStudySession: boolean;
}

export interface HabitCompletionRecord {
  id: string;
  habitId: string;
  habitName: string;
  category: HabitCategory;
  durationMinutes: number;
  completedAt: string;
}

export interface HabitCompletedAlert {
  habit: HabitItem;
  completedAt: string;
}

export interface ActiveRoutineRun {
  routineId: string;
  routineName: string;
  currentStepIndex: number;
}

interface PersistedActiveTimer {
  activeHabitId: string;
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  endTimeMs: number | null;
}

export function getLocalTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DEFAULT_HABITS: HabitItem[] = [
  {
    id: 'hab_ejercicio',
    name: 'Hacer ejercicio',
    category: 'ejercicio',
    durationMinutes: 30,
    tone: 'digital',
    volume: 0.85,
    repeats: 2,
    soundEnabled: true,
    voiceAlert: false,
    autoLogStudySession: false,
  },
  {
    id: 'hab_trabajar',
    name: 'Trabajar',
    category: 'trabajo',
    durationMinutes: 45,
    tone: 'acorde',
    volume: 0.8,
    repeats: 2,
    soundEnabled: true,
    voiceAlert: false,
    autoLogStudySession: false,
  },
  {
    id: 'hab_limpieza',
    name: 'Limpieza',
    category: 'limpieza',
    durationMinutes: 15,
    tone: 'campana',
    volume: 0.85,
    repeats: 2,
    soundEnabled: true,
    voiceAlert: false,
    autoLogStudySession: false,
  },
  {
    id: 'hab_estudiar',
    name: 'Estudiar',
    category: 'estudio',
    durationMinutes: 50,
    tone: 'acorde',
    volume: 0.85,
    repeats: 2,
    soundEnabled: true,
    voiceAlert: true,
    autoLogStudySession: true,
  },
  {
    id: 'hab_pausa_activa',
    name: 'Pausa activa y respiración',
    category: 'descanso',
    durationMinutes: 10,
    tone: 'suave',
    volume: 0.8,
    repeats: 2,
    soundEnabled: true,
    voiceAlert: false,
    autoLogStudySession: false,
  },
];

export const DEFAULT_ROUTINES: HabitRoutine[] = [
  {
    id: 'rt_manana_enfoque',
    name: 'Rutina Matutina y Enfoque',
    description: 'Activación física suave, orden del espacio e hidratación antes de estudiar.',
    period: 'manana',
    daysOfWeek: [1, 2, 3, 4, 5],
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    steps: [
      {
        id: 'step_m_1',
        title: 'Hidratación + movilidad articular',
        category: 'ejercicio',
        durationMinutes: 15,
        scheduledTime: '07:30',
        completedDates: [],
      },
      {
        id: 'step_m_2',
        title: 'Desayuno nutritivo sin pantallas',
        category: 'nutricion',
        durationMinutes: 20,
        scheduledTime: '07:50',
        completedDates: [],
      },
      {
        id: 'step_m_3',
        title: 'Orden rápido de escritorio',
        category: 'limpieza',
        durationMinutes: 10,
        scheduledTime: '08:15',
        completedDates: [],
      },
    ],
  },
  {
    id: 'rt_estudio_pausas',
    name: 'Bloque de Estudio y Pausas Activas',
    description: 'Alterna concentración profunda con estiramientos y descanso visual.',
    period: 'tarde',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    active: true,
    createdAt: '2026-01-01T14:00:00.000Z',
    steps: [
      {
        id: 'step_e_1',
        title: 'Lectura o práctica enfocada',
        category: 'estudio',
        durationMinutes: 50,
        scheduledTime: '15:00',
        habitId: 'hab_estudiar',
        completedDates: [],
      },
      {
        id: 'step_e_2',
        title: 'Pausa activa cervical y agua',
        category: 'descanso',
        durationMinutes: 10,
        scheduledTime: '15:55',
        habitId: 'hab_pausa_activa',
        completedDates: [],
      },
      {
        id: 'step_e_3',
        title: 'Entrenamiento o caminata moderada',
        category: 'ejercicio',
        durationMinutes: 30,
        scheduledTime: '18:00',
        habitId: 'hab_ejercicio',
        completedDates: [],
      },
    ],
  },
  {
    id: 'rt_noche_descanso',
    name: 'Cierre Nocturno y Salud Mental',
    description: 'Desconexión de pantallas, orden liviano y respiración para dormir mejor.',
    period: 'noche',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    active: true,
    createdAt: '2026-01-01T21:00:00.000Z',
    steps: [
      {
        id: 'step_n_1',
        title: 'Preparar materiales para mañana',
        category: 'limpieza',
        durationMinutes: 10,
        scheduledTime: '21:30',
        completedDates: [],
      },
      {
        id: 'step_n_2',
        title: 'Respiración profunda y diario de cierre',
        category: 'salud_mental',
        durationMinutes: 10,
        scheduledTime: '22:00',
        completedDates: [],
      },
    ],
  },
];

export const DEFAULT_NUTRITION_PROFILE: NutritionProfile = {
  goal: 'energia_concentracion',
  preference: 'sin_restricciones',
  restrictions: '',
  waterTargetGlasses: 8,
  notes: 'Priorizar alimentos frescos, fibra y pausas reales para comer sin apuro.',
};

export const DEFAULT_DAILY_MEALS: DailyMealItem[] = [
  {
    id: 'meal_desayuno_default',
    slot: 'desayuno',
    slotLabel: 'Desayuno',
    title: 'Avena tibia o tostadas integrales con proteína y fruta',
    foods: ['2 tostadas integrales o 4 cdas de avena', '1 huevo o yogur natural', '1 fruta de estación', 'Infusión sin azúcar'],
    benefits: 'Libera glucosa de forma sostenida para mantener la atención durante las primeras horas.',
    approxKcal: 390,
    prepMinutes: 10,
  },
  {
    id: 'meal_almuerzo_default',
    slot: 'almuerzo',
    slotLabel: 'Almuerzo',
    title: 'Plato completo con vegetales, proteína magra y cereal integral',
    foods: ['1/2 plato de vegetales variados crudos o cocidos', '1 porción de pollo, pescado, legumbres o tofu', '1/4 plato de arroz integral o papa', '1 cda de aceite de oliva'],
    benefits: 'Aporta hierro, fibra y micronutrientes evitando picos de somnolencia vespertina.',
    approxKcal: 580,
    prepMinutes: 25,
  },
  {
    id: 'meal_merienda_default',
    slot: 'merienda',
    slotLabel: 'Merienda',
    title: 'Yogur o bebida vegetal con frutos secos y fruta',
    foods: ['1 taza de yogur natural o kéfir', '1 puñado de nueces o almendras', '1 banana o frutos rojos'],
    benefits: 'Suma grasas saludables omega-3 y magnesio ideales para la memoria de trabajo.',
    approxKcal: 280,
    prepMinutes: 5,
  },
  {
    id: 'meal_cena_default',
    slot: 'cena',
    slotLabel: 'Cena',
    title: 'Cena liviana rica en vegetales y proteínas de fácil digestión',
    foods: ['Tortilla de verduras o salteado de vegetales', 'Ensalada verde con semillas', '1 rebanada de pan integral o batata chica'],
    benefits: 'Favorece la digestión nocturna sin interferir en la calidad del sueño profundo.',
    approxKcal: 460,
    prepMinutes: 20,
  },
  {
    id: 'meal_colacion_default',
    slot: 'colacion',
    slotLabel: 'Colación',
    title: 'Fruta fresca y semillas entre bloques de estudio',
    foods: ['1 manzana o mandarina', '10-12 almendras o semillas de zapallo', '1 vaso grande de agua'],
    benefits: 'Evita llegar con hambre excesiva a la comida principal y sostiene la hidratación.',
    approxKcal: 170,
    prepMinutes: 3,
  },
];

interface HabitTimerContextValue {
  // Core Habit Timer
  habits: HabitItem[];
  activeHabitId: string;
  activeHabit: HabitItem;
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  completedAlert: HabitCompletedAlert | null;
  completions: HabitCompletionRecord[];
  openConfigSignal: number;
  requestOpenHabitStudio: () => void;
  selectHabit: (id: string) => void;
  startHabit: (id?: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  addMinutes: (mins: number) => void;
  completeNow: () => void;
  addHabit: (input: Omit<HabitItem, 'id'>) => HabitItem;
  updateHabit: (id: string, patch: Partial<Omit<HabitItem, 'id'>>) => void;
  deleteHabit: (id: string) => void;
  restoreDefaultHabits: () => void;
  testSound: (opts?: {
    tone?: HabitToneId;
    volume?: number;
    repeats?: number;
    habitName?: string;
    voiceAlert?: boolean;
  }) => void;
  dismissCompletedAlert: () => void;
  clearTodayCompletions: () => void;

  // Configurable Routines Controller
  routines: HabitRoutine[];
  activeRoutineRun: ActiveRoutineRun | null;
  addRoutine: (input: {
    name: string;
    description: string;
    period: RoutinePeriod;
    daysOfWeek: number[];
    steps?: Array<Omit<RoutineStep, 'id' | 'completedDates'>>;
  }) => HabitRoutine;
  updateRoutine: (id: string, patch: Partial<Omit<HabitRoutine, 'id' | 'createdAt'>>) => void;
  deleteRoutine: (id: string) => void;
  toggleRoutineActive: (id: string) => void;
  addRoutineStep: (routineId: string, step: Omit<RoutineStep, 'id' | 'completedDates'>) => void;
  updateRoutineStep: (routineId: string, stepId: string, patch: Partial<Omit<RoutineStep, 'id'>>) => void;
  deleteRoutineStep: (routineId: string, stepId: string) => void;
  toggleRoutineStepDoneToday: (routineId: string, stepId: string) => void;
  startRoutineStepWithTimer: (routineId: string, stepId: string) => void;
  startFullRoutine: (routineId: string) => void;
  advanceRoutineStep: () => void;
  stopRoutineRun: () => void;
  restoreDefaultRoutines: () => void;

  // Nutritional Plan & Hydration Tracker
  nutritionProfile: NutritionProfile;
  updateNutritionProfile: (patch: Partial<NutritionProfile>) => void;
  dailyMeals: DailyMealItem[];
  nutritionLog: NutritionDailyLog;
  addWaterGlass: (delta: number) => void;
  toggleMealCompleted: (mealId: string) => void;
  updateMealItem: (mealId: string, patch: Partial<Omit<DailyMealItem, 'id'>>) => void;
  resetDefaultMeals: () => void;
  mealPlanLoading: boolean;
  mealPlanError: string | null;
  generateDailyMealPlanWithAI: () => Promise<boolean>;

  // Daily AI Mental & Physical Health Suggestions
  dailyWellness: DailyWellnessBundle | null;
  wellnessFocus: WellnessFocusArea;
  setWellnessFocus: (focus: WellnessFocusArea) => void;
  wellnessLoading: boolean;
  wellnessError: string | null;
  refreshDailyWellnessWithAI: (focusOverride?: WellnessFocusArea) => Promise<boolean>;
  convertSuggestionToHabit: (suggestion: WellnessSuggestionItem, type: 'mental' | 'fisico') => HabitItem;

  // Calorie Counter
  calorieTarget: number;
  setCalorieTarget: (kcal: number) => void;
  calorieFoodEntries: CalorieFoodEntry[];
  addCalorieFoodEntry: (entry: Omit<CalorieFoodEntry, 'id' | 'createdAt'>) => void;
  deleteCalorieFoodEntry: (id: string) => void;
  calorieBurnEntries: CalorieBurnEntry[];
  addCalorieBurnEntry: (entry: Omit<CalorieBurnEntry, 'id' | 'createdAt'>) => void;
  deleteCalorieBurnEntry: (id: string) => void;
}

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota failures
  }
}

function mapStepCatToHabitCat(cat: HabitStepCategory): HabitCategory {
  if (cat === 'ejercicio' || cat === 'trabajo' || cat === 'limpieza' || cat === 'estudio' || cat === 'descanso') {
    return cat;
  }
  if (cat === 'salud_mental' || cat === 'nutricion') {
    return 'descanso';
  }
  return 'personalizado';
}

const HabitTimerContext = createContext<HabitTimerContextValue | null>(null);

export const HabitTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logStudySession, selectedSubjectId, subjects, setActiveSection } = useFabro();
  const uid = user?.uid || 'anon';

  const habitsKey = `fabro_habits_list_${uid}`;
  const logsKey = `fabro_habits_logs_${uid}`;
  const activeKey = `fabro_habits_active_${uid}`;
  const routinesKey = `fabro_habits_routines_${uid}`;
  const nutritionProfileKey = `fabro_nutrition_profile_${uid}`;
  const mealsKey = `fabro_nutrition_meals_${uid}`;
  const nutritionLogKey = `fabro_nutrition_log_${uid}`;
  const wellnessKey = `fabro_daily_wellness_ai_${uid}`;
  const wellnessFocusKey = `fabro_daily_wellness_focus_${uid}`;
  const calorieTargetKey = `fabro_calorie_target_${uid}`;
  const calorieFoodsKey = `fabro_calorie_foods_${uid}`;
  const calorieBurnsKey = `fabro_calorie_burns_${uid}`;

  const [habits, setHabits] = useState<HabitItem[]>(() => {
    const loaded = safeReadJson<HabitItem[]>(habitsKey, DEFAULT_HABITS);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : DEFAULT_HABITS;
  });

  const [completions, setCompletions] = useState<HabitCompletionRecord[]>(() =>
    safeReadJson<HabitCompletionRecord[]>(logsKey, [])
  );

  const [routines, setRoutines] = useState<HabitRoutine[]>(() => {
    const loaded = safeReadJson<HabitRoutine[]>(routinesKey, DEFAULT_ROUTINES);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : DEFAULT_ROUTINES;
  });

  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfile>(() =>
    safeReadJson<NutritionProfile>(nutritionProfileKey, DEFAULT_NUTRITION_PROFILE)
  );

  const [dailyMeals, setDailyMeals] = useState<DailyMealItem[]>(() => {
    const loaded = safeReadJson<DailyMealItem[]>(mealsKey, DEFAULT_DAILY_MEALS);
    return Array.isArray(loaded) && loaded.length > 0 ? loaded : DEFAULT_DAILY_MEALS;
  });

  const [nutritionLog, setNutritionLog] = useState<NutritionDailyLog>(() => {
    const todayKey = getLocalTodayDateKey();
    const saved = safeReadJson<NutritionDailyLog | null>(nutritionLogKey, null);
    if (saved && saved.dateKey === todayKey) return saved;
    return { dateKey: todayKey, waterGlasses: 0, completedMealIds: [] };
  });

  const [wellnessFocus, setWellnessFocusState] = useState<WellnessFocusArea>(() =>
    safeReadJson<WellnessFocusArea>(wellnessFocusKey, 'equilibrio_integral')
  );

  const [dailyWellness, setDailyWellness] = useState<DailyWellnessBundle | null>(() =>
    safeReadJson<DailyWellnessBundle | null>(wellnessKey, null)
  );

  const [wellnessLoading, setWellnessLoading] = useState(false);
  const [wellnessError, setWellnessError] = useState<string | null>(null);
  const [mealPlanLoading, setMealPlanLoading] = useState(false);
  const [mealPlanError, setMealPlanError] = useState<string | null>(null);
  const [activeRoutineRun, setActiveRoutineRun] = useState<ActiveRoutineRun | null>(null);

  const [calorieTarget, setCalorieTargetState] = useState<number>(() => {
    const saved = safeReadJson<number>(calorieTargetKey, 2000);
    return typeof saved === 'number' && saved >= 800 && saved <= 6000 ? saved : 2000;
  });
  const [calorieFoodEntries, setCalorieFoodEntries] = useState<CalorieFoodEntry[]>(() => {
    const loaded = safeReadJson<CalorieFoodEntry[]>(calorieFoodsKey, []);
    return Array.isArray(loaded) ? loaded : [];
  });
  const [calorieBurnEntries, setCalorieBurnEntries] = useState<CalorieBurnEntry[]>(() => {
    const loaded = safeReadJson<CalorieBurnEntry[]>(calorieBurnsKey, []);
    return Array.isArray(loaded) ? loaded : [];
  });

  const initialTimer = useMemo(() => {
    const saved = safeReadJson<PersistedActiveTimer | null>(activeKey, null);
    const firstHabit = habits[0] || DEFAULT_HABITS[0];
    if (!saved) {
      return {
        activeHabitId: firstHabit.id,
        remainingSeconds: firstHabit.durationMinutes * 60,
        isRunning: false,
        isPaused: false,
        endTimeMs: null as number | null,
      };
    }
    const matching = habits.find((h) => h.id === saved.activeHabitId) || firstHabit;
    if (saved.isRunning && saved.endTimeMs) {
      const diffSec = Math.max(0, Math.ceil((saved.endTimeMs - Date.now()) / 1000));
      if (diffSec > 0) {
        return {
          activeHabitId: matching.id,
          remainingSeconds: diffSec,
          isRunning: true,
          isPaused: false,
          endTimeMs: saved.endTimeMs,
        };
      }
      return {
        activeHabitId: matching.id,
        remainingSeconds: matching.durationMinutes * 60,
        isRunning: false,
        isPaused: false,
        endTimeMs: null,
      };
    }
    return {
      activeHabitId: matching.id,
      remainingSeconds: saved.remainingSeconds || matching.durationMinutes * 60,
      isRunning: false,
      isPaused: Boolean(saved.isPaused),
      endTimeMs: null,
    };
  }, [activeKey]);

  const [activeHabitId, setActiveHabitId] = useState<string>(initialTimer.activeHabitId);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(initialTimer.remainingSeconds);
  const [isRunning, setIsRunning] = useState<boolean>(initialTimer.isRunning);
  const [isPaused, setIsPaused] = useState<boolean>(initialTimer.isPaused);
  const [completedAlert, setCompletedAlert] = useState<HabitCompletedAlert | null>(null);
  const [openConfigSignal, setOpenConfigSignal] = useState(0);

  const endTimeRef = useRef<number | null>(initialTimer.endTimeMs);
  const autoAttemptedDateRef = useRef<string>('');

  // Reload user-scoped data on account change
  useEffect(() => {
    const nextHabits = safeReadJson<HabitItem[]>(habitsKey, DEFAULT_HABITS);
    const validHabits = Array.isArray(nextHabits) && nextHabits.length > 0 ? nextHabits : DEFAULT_HABITS;
    setHabits(validHabits);
    setCompletions(safeReadJson<HabitCompletionRecord[]>(logsKey, []));

    const nextRoutines = safeReadJson<HabitRoutine[]>(routinesKey, DEFAULT_ROUTINES);
    setRoutines(Array.isArray(nextRoutines) && nextRoutines.length > 0 ? nextRoutines : DEFAULT_ROUTINES);

    setNutritionProfile(safeReadJson<NutritionProfile>(nutritionProfileKey, DEFAULT_NUTRITION_PROFILE));

    const nextMeals = safeReadJson<DailyMealItem[]>(mealsKey, DEFAULT_DAILY_MEALS);
    setDailyMeals(Array.isArray(nextMeals) && nextMeals.length > 0 ? nextMeals : DEFAULT_DAILY_MEALS);

    const todayKey = getLocalTodayDateKey();
    const savedNutLog = safeReadJson<NutritionDailyLog | null>(nutritionLogKey, null);
    setNutritionLog(
      savedNutLog && savedNutLog.dateKey === todayKey
        ? savedNutLog
        : { dateKey: todayKey, waterGlasses: 0, completedMealIds: [] }
    );

    setWellnessFocusState(safeReadJson<WellnessFocusArea>(wellnessFocusKey, 'equilibrio_integral'));
    setDailyWellness(safeReadJson<DailyWellnessBundle | null>(wellnessKey, null));
    setWellnessError(null);
    setMealPlanError(null);
    autoAttemptedDateRef.current = '';

    const loadedTarget = safeReadJson<number>(calorieTargetKey, 2000);
    setCalorieTargetState(typeof loadedTarget === 'number' && loadedTarget >= 800 && loadedTarget <= 6000 ? loadedTarget : 2000);
    const loadedFoods = safeReadJson<CalorieFoodEntry[]>(calorieFoodsKey, []);
    setCalorieFoodEntries(Array.isArray(loadedFoods) ? loadedFoods : []);
    const loadedBurns = safeReadJson<CalorieBurnEntry[]>(calorieBurnsKey, []);
    setCalorieBurnEntries(Array.isArray(loadedBurns) ? loadedBurns : []);

    const saved = safeReadJson<PersistedActiveTimer | null>(activeKey, null);
    const target = (saved && validHabits.find((h) => h.id === saved.activeHabitId)) || validHabits[0];
    setActiveHabitId(target.id);
    if (saved?.isRunning && saved.endTimeMs && saved.endTimeMs > Date.now()) {
      endTimeRef.current = saved.endTimeMs;
      setRemainingSeconds(Math.ceil((saved.endTimeMs - Date.now()) / 1000));
      setIsRunning(true);
      setIsPaused(false);
    } else {
      endTimeRef.current = null;
      setRemainingSeconds(target.durationMinutes * 60);
      setIsRunning(false);
      setIsPaused(false);
    }
  }, [
    habitsKey,
    logsKey,
    activeKey,
    routinesKey,
    nutritionProfileKey,
    mealsKey,
    nutritionLogKey,
    wellnessKey,
    wellnessFocusKey,
    calorieTargetKey,
    calorieFoodsKey,
    calorieBurnsKey,
  ]);

  // Persist slices to localStorage
  useEffect(() => {
    safeWriteJson(habitsKey, habits);
  }, [habits, habitsKey]);

  useEffect(() => {
    safeWriteJson(logsKey, completions.slice(0, 120));
  }, [completions, logsKey]);

  useEffect(() => {
    safeWriteJson(routinesKey, routines);
  }, [routines, routinesKey]);

  useEffect(() => {
    safeWriteJson(nutritionProfileKey, nutritionProfile);
  }, [nutritionProfile, nutritionProfileKey]);

  useEffect(() => {
    safeWriteJson(mealsKey, dailyMeals);
  }, [dailyMeals, mealsKey]);

  useEffect(() => {
    safeWriteJson(nutritionLogKey, nutritionLog);
  }, [nutritionLog, nutritionLogKey]);

  useEffect(() => {
    safeWriteJson(wellnessFocusKey, wellnessFocus);
  }, [wellnessFocus, wellnessFocusKey]);

  useEffect(() => {
    if (dailyWellness) {
      safeWriteJson(wellnessKey, dailyWellness);
    }
  }, [dailyWellness, wellnessKey]);

  useEffect(() => {
    safeWriteJson(calorieTargetKey, calorieTarget);
  }, [calorieTarget, calorieTargetKey]);

  useEffect(() => {
    safeWriteJson(calorieFoodsKey, calorieFoodEntries.slice(0, 500));
  }, [calorieFoodEntries, calorieFoodsKey]);

  useEffect(() => {
    safeWriteJson(calorieBurnsKey, calorieBurnEntries.slice(0, 300));
  }, [calorieBurnEntries, calorieBurnsKey]);

  useEffect(() => {
    safeWriteJson(activeKey, {
      activeHabitId,
      remainingSeconds,
      isRunning,
      isPaused,
      endTimeMs: endTimeRef.current,
    } satisfies PersistedActiveTimer);
  }, [activeHabitId, remainingSeconds, isRunning, isPaused, activeKey]);

  const activeHabit = useMemo(
    () => habits.find((h) => h.id === activeHabitId) || habits[0] || DEFAULT_HABITS[0],
    [habits, activeHabitId]
  );

  const activeRoutineRunRef = useRef<ActiveRoutineRun | null>(activeRoutineRun);
  activeRoutineRunRef.current = activeRoutineRun;

  const triggerHabitCompletion = useCallback(
    (habit: HabitItem) => {
      endTimeRef.current = null;
      setIsRunning(false);
      setIsPaused(false);
      setRemainingSeconds(habit.durationMinutes * 60);

      const nowIso = new Date().toISOString();
      const todayKey = getLocalTodayDateKey();
      setCompletedAlert({ habit, completedAt: nowIso });
      setCompletions((prev) => [
        {
          id: `hc_${Date.now().toString(36)}`,
          habitId: habit.id,
          habitName: habit.name,
          category: habit.category,
          durationMinutes: habit.durationMinutes,
          completedAt: nowIso,
        },
        ...prev,
      ]);

      // If running inside a routine sequence, mark current routine step completed today
      const currentRun = activeRoutineRunRef.current;
      if (currentRun) {
        setRoutines((prev) =>
          prev.map((rt) => {
            if (rt.id !== currentRun.routineId) return rt;
            const step = rt.steps[currentRun.currentStepIndex];
            if (!step) return rt;
            return {
              ...rt,
              steps: rt.steps.map((s) =>
                s.id === step.id && !s.completedDates.includes(todayKey)
                  ? { ...s, completedDates: [...s.completedDates, todayKey] }
                  : s
              ),
            };
          })
        );
      }

      if (habit.soundEnabled || habit.voiceAlert) {
        playHabitAlertSound({
          tone: habit.soundEnabled ? habit.tone : 'suave',
          volume: habit.soundEnabled ? habit.volume : 0,
          repeats: habit.soundEnabled ? habit.repeats : 1,
          spokenMessage: habit.voiceAlert ? `Tiempo completado: ${habit.name}` : undefined,
        });
      }

      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        try {
          new window.Notification(`FABRO · Hábito completado`, {
            body: `${habit.name} (${habit.durationMinutes} min) finalizado.`,
            icon: '/pwa-192x192.png',
          });
        } catch {
          // ignore notification blocks
        }
      }

      if ((habit.autoLogStudySession || habit.category === 'estudio') && user) {
        void logStudySession({
          subjectId: selectedSubjectId || subjects[0]?.id || '',
          activityType: 'lectura',
          durationMinutes: Math.max(1, habit.durationMinutes),
          topic: `Hábito completado: ${habit.name}`,
          date: todayKey,
        }).catch(() => undefined);
      }
    },
    [logStudySession, selectedSubjectId, subjects, user]
  );

  const activeHabitRef = useRef(activeHabit);
  activeHabitRef.current = activeHabit;
  const triggerRef = useRef(triggerHabitCompletion);
  triggerRef.current = triggerHabitCompletion;

  useEffect(() => {
    if (!isRunning) return;
    if (!endTimeRef.current) {
      endTimeRef.current = Date.now() + remainingSeconds * 1000;
    }

    const tick = () => {
      if (!endTimeRef.current) return;
      const diff = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      if (diff <= 0) {
        setRemainingSeconds(0);
        triggerRef.current(activeHabitRef.current);
      } else {
        setRemainingSeconds(diff);
      }
    };

    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [isRunning]);

  const selectHabit = useCallback(
    (id: string) => {
      const target = habits.find((h) => h.id === id);
      if (!target) return;
      endTimeRef.current = null;
      setIsRunning(false);
      setIsPaused(false);
      setActiveHabitId(target.id);
      setRemainingSeconds(target.durationMinutes * 60);
    },
    [habits]
  );

  const startHabit = useCallback(
    (id?: string) => {
      stopHabitAlertSound();
      setCompletedAlert(null);
      const target = (id ? habits.find((h) => h.id === id) : activeHabit) || activeHabit;
      const sec =
        id && id !== activeHabit.id
          ? target.durationMinutes * 60
          : isPaused && remainingSeconds > 0
          ? remainingSeconds
          : target.durationMinutes * 60;

      if (target.id !== activeHabitId) {
        setActiveHabitId(target.id);
      }
      endTimeRef.current = Date.now() + sec * 1000;
      setRemainingSeconds(sec);
      setIsPaused(false);
      setIsRunning(true);
    },
    [activeHabit, activeHabitId, habits, isPaused, remainingSeconds]
  );

  const pauseTimer = useCallback(() => {
    if (!isRunning) return;
    if (endTimeRef.current) {
      setRemainingSeconds(Math.max(1, Math.ceil((endTimeRef.current - Date.now()) / 1000)));
    }
    endTimeRef.current = null;
    setIsRunning(false);
    setIsPaused(true);
  }, [isRunning]);

  const resumeTimer = useCallback(() => {
    if (isRunning) return;
    const sec = Math.max(1, remainingSeconds || activeHabit.durationMinutes * 60);
    endTimeRef.current = Date.now() + sec * 1000;
    setIsPaused(false);
    setIsRunning(true);
  }, [activeHabit.durationMinutes, isRunning, remainingSeconds]);

  const resetTimer = useCallback(() => {
    endTimeRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setRemainingSeconds(activeHabit.durationMinutes * 60);
  }, [activeHabit.durationMinutes]);

  const addMinutes = useCallback((mins: number) => {
    const delta = mins * 60;
    setRemainingSeconds((prev) => {
      const next = Math.max(60, prev + delta);
      if (endTimeRef.current) {
        endTimeRef.current = Date.now() + next * 1000;
      }
      return next;
    });
  }, []);

  const completeNow = useCallback(() => {
    triggerHabitCompletion(activeHabit);
  }, [activeHabit, triggerHabitCompletion]);

  const addHabit = useCallback((input: Omit<HabitItem, 'id'>): HabitItem => {
    const created: HabitItem = {
      ...input,
      id: `hab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: input.name.trim().slice(0, 60) || 'Nuevo hábito',
      durationMinutes: Math.max(1, Math.min(240, Math.round(input.durationMinutes || 20))),
    };
    setHabits((prev) => [...prev, created]);
    return created;
  }, []);

  const updateHabit = useCallback(
    (id: string, patch: Partial<Omit<HabitItem, 'id'>>) => {
      setHabits((prev) =>
        prev.map((h) => {
          if (h.id !== id) return h;
          const next = { ...h, ...patch };
          if (typeof patch.durationMinutes === 'number') {
            next.durationMinutes = Math.max(1, Math.min(240, Math.round(patch.durationMinutes)));
          }
          if (id === activeHabitId && !isRunning && !isPaused && typeof next.durationMinutes === 'number') {
            setRemainingSeconds(next.durationMinutes * 60);
          }
          return next;
        })
      );
    },
    [activeHabitId, isPaused, isRunning]
  );

  const deleteHabit = useCallback(
    (id: string) => {
      setHabits((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((h) => h.id !== id);
        if (id === activeHabitId && next[0]) {
          endTimeRef.current = null;
          setIsRunning(false);
          setIsPaused(false);
          setActiveHabitId(next[0].id);
          setRemainingSeconds(next[0].durationMinutes * 60);
        }
        return next;
      });
    },
    [activeHabitId]
  );

  const restoreDefaultHabits = useCallback(() => {
    setHabits(DEFAULT_HABITS);
    endTimeRef.current = null;
    setIsRunning(false);
    setIsPaused(false);
    setActiveHabitId(DEFAULT_HABITS[0].id);
    setRemainingSeconds(DEFAULT_HABITS[0].durationMinutes * 60);
  }, []);

  const testSound = useCallback(
    (opts?: {
      tone?: HabitToneId;
      volume?: number;
      repeats?: number;
      habitName?: string;
      voiceAlert?: boolean;
    }) => {
      playHabitAlertSound({
        tone: opts?.tone || activeHabit.tone,
        volume: opts?.volume ?? activeHabit.volume,
        repeats: opts?.repeats ?? 1,
        spokenMessage:
          opts?.voiceAlert
            ? `Alerta de hábito completado: ${opts?.habitName || activeHabit.name}`
            : undefined,
      });
    },
    [activeHabit]
  );

  const dismissCompletedAlert = useCallback(() => {
    stopHabitAlertSound();
    setCompletedAlert(null);
  }, []);

  const clearTodayCompletions = useCallback(() => {
    const todayIsoPrefix = new Date().toISOString().slice(0, 10);
    const localToday = getLocalTodayDateKey();
    setCompletions((prev) =>
      prev.filter((c) => !c.completedAt.startsWith(todayIsoPrefix) && !c.completedAt.startsWith(localToday))
    );
  }, []);

  const requestOpenHabitStudio = useCallback(() => {
    setOpenConfigSignal((n) => n + 1);
    setActiveSection('habitos');
  }, [setActiveSection]);

  // ------------------------------------------------------------------
  // Configurable Routines Controller
  // ------------------------------------------------------------------
  const addRoutine = useCallback(
    (input: {
      name: string;
      description: string;
      period: RoutinePeriod;
      daysOfWeek: number[];
      steps?: Array<Omit<RoutineStep, 'id' | 'completedDates'>>;
    }): HabitRoutine => {
      const created: HabitRoutine = {
        id: `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: input.name.trim().slice(0, 80) || 'Nueva rutina',
        description: input.description.trim().slice(0, 220),
        period: input.period,
        daysOfWeek: input.daysOfWeek.length > 0 ? input.daysOfWeek : [1, 2, 3, 4, 5],
        active: true,
        createdAt: new Date().toISOString(),
        steps: (input.steps || []).map((st, idx) => ({
          ...st,
          id: `step_${Date.now().toString(36)}_${idx}`,
          completedDates: [],
        })),
      };
      setRoutines((prev) => [created, ...prev]);
      return created;
    },
    []
  );

  const updateRoutine = useCallback(
    (id: string, patch: Partial<Omit<HabitRoutine, 'id' | 'createdAt'>>) => {
      setRoutines((prev) => prev.map((rt) => (rt.id === id ? { ...rt, ...patch } : rt)));
    },
    []
  );

  const deleteRoutine = useCallback((id: string) => {
    setRoutines((prev) => prev.filter((rt) => rt.id !== id));
    setActiveRoutineRun((curr) => (curr?.routineId === id ? null : curr));
  }, []);

  const toggleRoutineActive = useCallback((id: string) => {
    setRoutines((prev) => prev.map((rt) => (rt.id === id ? { ...rt, active: !rt.active } : rt)));
  }, []);

  const addRoutineStep = useCallback(
    (routineId: string, step: Omit<RoutineStep, 'id' | 'completedDates'>) => {
      const newStep: RoutineStep = {
        ...step,
        id: `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        title: step.title.trim().slice(0, 90) || 'Paso de rutina',
        durationMinutes: Math.max(1, Math.min(240, Math.round(step.durationMinutes || 15))),
        scheduledTime: step.scheduledTime || '09:00',
        completedDates: [],
      };
      setRoutines((prev) =>
        prev.map((rt) => (rt.id === routineId ? { ...rt, steps: [...rt.steps, newStep] } : rt))
      );
    },
    []
  );

  const updateRoutineStep = useCallback(
    (routineId: string, stepId: string, patch: Partial<Omit<RoutineStep, 'id'>>) => {
      setRoutines((prev) =>
        prev.map((rt) =>
          rt.id === routineId
            ? {
                ...rt,
                steps: rt.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)),
              }
            : rt
        )
      );
    },
    []
  );

  const deleteRoutineStep = useCallback((routineId: string, stepId: string) => {
    setRoutines((prev) =>
      prev.map((rt) =>
        rt.id === routineId
          ? { ...rt, steps: rt.steps.filter((st) => st.id !== stepId) }
          : rt
      )
    );
  }, []);

  const toggleRoutineStepDoneToday = useCallback((routineId: string, stepId: string) => {
    const todayKey = getLocalTodayDateKey();
    setRoutines((prev) =>
      prev.map((rt) => {
        if (rt.id !== routineId) return rt;
        return {
          ...rt,
          steps: rt.steps.map((st) => {
            if (st.id !== stepId) return st;
            const done = st.completedDates.includes(todayKey);
            return {
              ...st,
              completedDates: done
                ? st.completedDates.filter((d) => d !== todayKey)
                : [...st.completedDates.slice(-29), todayKey],
            };
          }),
        };
      })
    );
  }, []);

  const launchStepInTimer = useCallback(
    (routine: HabitRoutine, step: RoutineStep, stepIndex: number) => {
      stopHabitAlertSound();
      setCompletedAlert(null);

      // Find linked habit or match/create a dedicated habit block cleanly
      let targetHabit = step.habitId ? habits.find((h) => h.id === step.habitId) : undefined;
      if (!targetHabit) {
        targetHabit = habits.find(
          (h) => h.name.toLowerCase() === step.title.toLowerCase() && h.durationMinutes === step.durationMinutes
        );
      }
      if (!targetHabit) {
        const created: HabitItem = {
          id: `hab_rt_${step.id}`,
          name: step.title.slice(0, 60),
          category: mapStepCatToHabitCat(step.category),
          durationMinutes: Math.max(1, Math.min(240, step.durationMinutes)),
          tone: 'acorde',
          volume: 0.85,
          repeats: 2,
          soundEnabled: true,
          voiceAlert: true,
          autoLogStudySession: step.category === 'estudio',
        };
        setHabits((prev) => {
          if (prev.some((h) => h.id === created.id)) return prev;
          return [...prev, created];
        });
        targetHabit = created;
      }

      setActiveRoutineRun({
        routineId: routine.id,
        routineName: routine.name,
        currentStepIndex: stepIndex,
      });

      const sec = targetHabit.durationMinutes * 60;
      setActiveHabitId(targetHabit.id);
      endTimeRef.current = Date.now() + sec * 1000;
      setRemainingSeconds(sec);
      setIsPaused(false);
      setIsRunning(true);
    },
    [habits]
  );

  const startRoutineStepWithTimer = useCallback(
    (routineId: string, stepId: string) => {
      const rt = routines.find((r) => r.id === routineId);
      if (!rt) return;
      const idx = rt.steps.findIndex((s) => s.id === stepId);
      if (idx === -1) return;
      launchStepInTimer(rt, rt.steps[idx], idx);
    },
    [launchStepInTimer, routines]
  );

  const startFullRoutine = useCallback(
    (routineId: string) => {
      const rt = routines.find((r) => r.id === routineId);
      if (!rt || rt.steps.length === 0) return;
      const todayKey = getLocalTodayDateKey();
      const firstPendingIdx = rt.steps.findIndex((s) => !s.completedDates.includes(todayKey));
      const idx = firstPendingIdx >= 0 ? firstPendingIdx : 0;
      launchStepInTimer(rt, rt.steps[idx], idx);
    },
    [launchStepInTimer, routines]
  );

  const advanceRoutineStep = useCallback(() => {
    if (!activeRoutineRun) return;
    const rt = routines.find((r) => r.id === activeRoutineRun.routineId);
    if (!rt) {
      setActiveRoutineRun(null);
      return;
    }
    const nextIdx = activeRoutineRun.currentStepIndex + 1;
    if (nextIdx >= rt.steps.length) {
      setActiveRoutineRun(null);
      return;
    }
    launchStepInTimer(rt, rt.steps[nextIdx], nextIdx);
  }, [activeRoutineRun, launchStepInTimer, routines]);

  const stopRoutineRun = useCallback(() => {
    setActiveRoutineRun(null);
  }, []);

  const restoreDefaultRoutines = useCallback(() => {
    setRoutines(DEFAULT_ROUTINES);
    setActiveRoutineRun(null);
  }, []);

  // ------------------------------------------------------------------
  // Nutrition Plan & Hydration
  // ------------------------------------------------------------------
  const updateNutritionProfile = useCallback((patch: Partial<NutritionProfile>) => {
    setNutritionProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const addWaterGlass = useCallback((delta: number) => {
    const todayKey = getLocalTodayDateKey();
    setNutritionLog((prev) => {
      const base = prev.dateKey === todayKey ? prev : { dateKey: todayKey, waterGlasses: 0, completedMealIds: [] };
      return {
        ...base,
        waterGlasses: Math.max(0, Math.min(20, base.waterGlasses + delta)),
      };
    });
  }, []);

  const toggleMealCompleted = useCallback((mealId: string) => {
    const todayKey = getLocalTodayDateKey();
    setNutritionLog((prev) => {
      const base = prev.dateKey === todayKey ? prev : { dateKey: todayKey, waterGlasses: 0, completedMealIds: [] };
      const exists = base.completedMealIds.includes(mealId);
      return {
        ...base,
        completedMealIds: exists
          ? base.completedMealIds.filter((id) => id !== mealId)
          : [...base.completedMealIds, mealId],
      };
    });
  }, []);

  const updateMealItem = useCallback((mealId: string, patch: Partial<Omit<DailyMealItem, 'id'>>) => {
    setDailyMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, ...patch } : m)));
  }, []);

  const resetDefaultMeals = useCallback(() => {
    setDailyMeals(DEFAULT_DAILY_MEALS);
  }, []);

  const buildRoutinesSummaryText = useCallback(() => {
    const active = routines.filter((r) => r.active);
    if (active.length === 0) return 'Jornada general de estudio, trabajo y autocuidado';
    return active
      .map((r) => `${r.name} (${r.steps.map((s) => `${s.title} ${s.durationMinutes}m`).join(', ')})`)
      .join(' | ')
      .slice(0, 900);
  }, [routines]);

  const generateDailyMealPlanWithAI = useCallback(async (): Promise<boolean> => {
    if (!user?.emailVerified) return false;
    setMealPlanLoading(true);
    setMealPlanError(null);
    try {
      const resp = await authFetch('/api/wellness/generate-meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateKey: getLocalTodayDateKey(),
          goal: NUTRITION_GOAL_LABELS[nutritionProfile.goal],
          preference: DIETARY_PREFERENCE_LABELS[nutritionProfile.preference],
          restrictions: nutritionProfile.restrictions,
          waterTargetGlasses: nutritionProfile.waterTargetGlasses,
          routinesSummary: buildRoutinesSummaryText(),
        }),
      });
      const payload = (await resp.json().catch(() => ({}))) as {
        error?: string;
        meals?: DailyMealItem[];
      };
      if (!resp.ok || !Array.isArray(payload.meals) || payload.meals.length === 0) {
        setMealPlanError(payload.error || 'No se pudo generar el plan nutricional con IA.');
        return false;
      }
      setDailyMeals(payload.meals);
      return true;
    } catch {
      setMealPlanError('Error de conexión al generar el menú nutricional con IA.');
      return false;
    } finally {
      setMealPlanLoading(false);
    }
  }, [buildRoutinesSummaryText, nutritionProfile, user?.emailVerified]);

  // ------------------------------------------------------------------
  // Daily AI Mental & Physical Health Suggestions (Auto-updated daily)
  // ------------------------------------------------------------------
  const setWellnessFocus = useCallback((focus: WellnessFocusArea) => {
    setWellnessFocusState(focus);
  }, []);

  const refreshDailyWellnessWithAI = useCallback(
    async (focusOverride?: WellnessFocusArea): Promise<boolean> => {
      if (!user?.emailVerified) return false;
      const targetFocus = focusOverride || wellnessFocus;
      const todayKey = getLocalTodayDateKey();
      setWellnessLoading(true);
      setWellnessError(null);
      try {
        const resp = await authFetch('/api/wellness/daily-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateKey: todayKey,
            focusArea: WELLNESS_FOCUS_LABELS[targetFocus],
            routinesSummary: buildRoutinesSummaryText(),
            nutritionGoal: NUTRITION_GOAL_LABELS[nutritionProfile.goal],
            dietaryPreference: DIETARY_PREFERENCE_LABELS[nutritionProfile.preference],
          }),
        });
        const payload = (await resp.json().catch(() => ({}))) as DailyWellnessBundle & { error?: string };
        if (!resp.ok || !Array.isArray(payload.mentalHealth)) {
          setWellnessError(payload.error || 'No se pudieron actualizar las sugerencias diarias con IA.');
          return false;
        }
        setDailyWellness(payload);
        return true;
      } catch {
        setWellnessError('Error de conexión al actualizar las sugerencias diarias.');
        return false;
      } finally {
        setWellnessLoading(false);
      }
    },
    [buildRoutinesSummaryText, nutritionProfile.goal, nutritionProfile.preference, user?.emailVerified, wellnessFocus]
  );

  // Automatic daily refresh when signed-in user enters on a new calendar date
  useEffect(() => {
    if (!user?.uid || !user?.emailVerified) return;
    const todayKey = getLocalTodayDateKey();
    if (dailyWellness?.dateKey === todayKey) return;
    if (autoAttemptedDateRef.current === `${user.uid}:${todayKey}`) return;
    autoAttemptedDateRef.current = `${user.uid}:${todayKey}`;
    void refreshDailyWellnessWithAI();
  }, [dailyWellness?.dateKey, refreshDailyWellnessWithAI, user?.emailVerified, user?.uid]);

  const convertSuggestionToHabit = useCallback(
    (suggestion: WellnessSuggestionItem, type: 'mental' | 'fisico'): HabitItem => {
      const cat: HabitCategory = type === 'fisico' ? 'ejercicio' : 'descanso';
      const created = addHabit({
        name: suggestion.title.slice(0, 60),
        category: cat,
        durationMinutes: Math.max(3, Math.min(90, suggestion.durationMinutes || 10)),
        tone: 'suave',
        volume: 0.85,
        repeats: 2,
        soundEnabled: true,
        voiceAlert: true,
        autoLogStudySession: false,
      });
      selectHabit(created.id);
      return created;
    },
    [addHabit, selectHabit]
  );

  // Calorie Counter actions
  const setCalorieTarget = useCallback((kcal: number) => {
    const clean = Math.max(800, Math.min(6000, Math.round(Number(kcal) || 2000)));
    setCalorieTargetState(clean);
  }, []);

  const addCalorieFoodEntry = useCallback(
    (entry: Omit<CalorieFoodEntry, 'id' | 'createdAt'>) => {
      const next: CalorieFoodEntry = {
        ...entry,
        id: `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: entry.name.trim().slice(0, 100) || 'Alimento',
        portion: entry.portion.trim().slice(0, 60) || '1 porción',
        calories: Math.max(0, Math.min(5000, Math.round(Number(entry.calories) || 0))),
        proteinG: entry.proteinG !== undefined ? Math.max(0, Math.round(Number(entry.proteinG) || 0)) : undefined,
        carbsG: entry.carbsG !== undefined ? Math.max(0, Math.round(Number(entry.carbsG) || 0)) : undefined,
        fatG: entry.fatG !== undefined ? Math.max(0, Math.round(Number(entry.fatG) || 0)) : undefined,
        createdAt: new Date().toISOString(),
      };
      setCalorieFoodEntries((prev) => [next, ...prev]);
    },
    []
  );

  const deleteCalorieFoodEntry = useCallback((id: string) => {
    setCalorieFoodEntries((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const addCalorieBurnEntry = useCallback(
    (entry: Omit<CalorieBurnEntry, 'id' | 'createdAt'>) => {
      const next: CalorieBurnEntry = {
        ...entry,
        id: `cb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        activity: entry.activity.trim().slice(0, 100) || 'Actividad física',
        minutes: Math.max(1, Math.min(600, Math.round(Number(entry.minutes) || 20))),
        caloriesBurned: Math.max(1, Math.min(5000, Math.round(Number(entry.caloriesBurned) || 0))),
        createdAt: new Date().toISOString(),
      };
      setCalorieBurnEntries((prev) => [next, ...prev]);
    },
    []
  );

  const deleteCalorieBurnEntry = useCallback((id: string) => {
    setCalorieBurnEntries((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <HabitTimerContext.Provider
      value={{
        habits,
        activeHabitId,
        activeHabit,
        remainingSeconds,
        isRunning,
        isPaused,
        completedAlert,
        completions,
        openConfigSignal,
        requestOpenHabitStudio,
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
        dismissCompletedAlert,
        clearTodayCompletions,
        routines,
        activeRoutineRun,
        addRoutine,
        updateRoutine,
        deleteRoutine,
        toggleRoutineActive,
        addRoutineStep,
        updateRoutineStep,
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
        calorieTarget,
        setCalorieTarget,
        calorieFoodEntries,
        addCalorieFoodEntry,
        deleteCalorieFoodEntry,
        calorieBurnEntries,
        addCalorieBurnEntry,
        deleteCalorieBurnEntry,
      }}
    >
      {children}
    </HabitTimerContext.Provider>
  );
};

export function useHabitTimer(): HabitTimerContextValue {
  const ctx = useContext(HabitTimerContext);
  if (!ctx) {
    throw new Error('useHabitTimer debe usarse dentro de HabitTimerProvider');
  }
  return ctx;
}
