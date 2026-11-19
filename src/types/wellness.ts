export type WellnessNavId =
  | 'mi-dia'
  | 'nutricion'
  | 'actividad-fisica'
  | 'mente-emociones'
  | 'sueno-descanso'
  | 'salud-prevencion'
  | 'desarrollo-personal'
  | 'relaciones-social'
  | 'naturaleza-ambiente'
  | 'educacion-conocimiento'
  | 'agenda-objetivos'
  | 'fabro-coach'
  | 'mi-historial'
  | 'fabro-desafios'
  | 'fabro-respira'
  | 'primeros-auxilios'
  | 'comunidad-bienestar'
  | 'configuracion-privacidad'
  | 'fabro-deportes';

export interface WellnessSidebarEntry {
  id: WellnessNavId;
  number: number;
  label: string;
  shortDesc: string;
  group: 'nucleo' | 'cuerpo-mente' | 'vida-entorno' | 'herramientas';
  accent: string;
}

// ---------------------------------------------------------------------------
// 2. Nutrición y alimentación
// ---------------------------------------------------------------------------
export type MealSlot = 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'colacion';

export interface FoodCatalogItem {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  servingLabel: string;
  servingGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  source: 'base-local' | 'personalizado' | 'open-food-facts' | 'estimacion-foto';
}

export interface MealLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  slot: MealSlot;
  name: string;
  quantityLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: FoodCatalogItem['source'];
  notes?: string;
  photoDataUrl?: string;
  isEstimate?: boolean;
}

export interface WellnessRecipe {
  id: string;
  title: string;
  mealSlot: MealSlot;
  servings: number;
  caloriesPerServing: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: string[];
  steps: string;
  favorite?: boolean;
}

export interface WeeklyMealPlanEntry {
  id: string;
  dayOfWeek: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';
  slot: MealSlot;
  mealTitle: string;
}

export interface WellnessShoppingItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
}

export interface NutritionPreferences {
  dailyCalorieGoal: number;
  dailyProteinGoalG: number;
  dailyCarbsGoalG: number;
  dailyFatGoalG: number;
  dietStyle: string;
  allergies: string;
  dislikes: string;
}

// ---------------------------------------------------------------------------
// 3. Actividad física y entrenamiento
// ---------------------------------------------------------------------------
export type FitnessCategoryId =
  | 'fuerza'
  | 'hipertrofia'
  | 'cardio'
  | 'hiit'
  | 'movilidad'
  | 'estiramientos'
  | 'flexibilidad'
  | 'core-abdomen'
  | 'piernas-gluteos'
  | 'tren-superior'
  | 'espalda-postura'
  | 'yoga'
  | 'pilates'
  | 'calistenia'
  | 'rehabilitacion-suave';

export interface ExerciseDefinition {
  id: string;
  name: string;
  category: FitnessCategoryId;
  muscles: string[];
  difficulty: 'Principiante' | 'Intermedio' | 'Avanzado';
  equipment: string;
  instructions: string[];
  precautions: string;
  defaultSets: number;
  defaultReps: string;
  defaultRestSec: number;
  videoSearchQuery: string;
  customVideoUrl?: string;
}

export interface RoutineExerciseStep {
  id: string;
  exerciseId?: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  weightKg?: number;
  notes?: string;
}

export interface CustomWorkoutRoutine {
  id: string;
  name: string;
  category: FitnessCategoryId;
  estimatedMin: number;
  difficulty: 'Principiante' | 'Intermedio' | 'Avanzado';
  exercises: RoutineExerciseStep[];
  createdAt: string;
}

export interface WorkoutSessionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  routineName: string;
  category: FitnessCategoryId;
  durationMin: number;
  caloriesEstimated?: number;
  totalReps?: number;
  effortRpe: number; // 1-10
  notes?: string;
}

// ---------------------------------------------------------------------------
// 4. Mente y emociones
// ---------------------------------------------------------------------------
export type EmotionEntryKind =
  | 'diario'
  | 'preocupacion'
  | 'gratitud'
  | 'reflexion'
  | 'autoconocimiento'
  | 'momento-positivo';

export interface EmotionJournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  kind: EmotionEntryKind;
  moodScore: number; // 1-10
  moodLabel: string;
  title: string;
  content: string;
  privateOnly: true;
}

// ---------------------------------------------------------------------------
// 5. Sueño y descanso
// ---------------------------------------------------------------------------
export interface SleepLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  bedtime: string; // HH:mm
  wakeTime: string; // HH:mm
  durationHours: number;
  quality: 1 | 2 | 3 | 4 | 5;
  awakenings: number;
  bedtimeRoutineDone: string[];
  dreamNote?: string;
  notes?: string;
}

export interface SleepPreferences {
  usualBedtime: string;
  usualWakeTime: string;
  targetHours: number;
  routineChecklist: string[];
}

// ---------------------------------------------------------------------------
// 6. Salud y prevención
// ---------------------------------------------------------------------------
export interface HealthMetricEntry {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg?: number;
  heightCm?: number;
  systolicBp?: number;
  diastolicBp?: number;
  heartRateBpm?: number;
  temperatureC?: number;
  notes?: string;
}

export interface MedicalAppointment {
  id: string;
  date: string; // YYYY-MM-DD
  time: string;
  specialty: string;
  professional: string;
  location: string;
  notes: string;
  completed: boolean;
}

export interface VaccineEntry {
  id: string;
  name: string;
  date: string;
  dose: string;
  nextDoseDate?: string;
  notes?: string;
}

export interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  scheduleTime: string;
  frequency: string;
  active: boolean;
  notes?: string;
}

export interface MedicalFileAttachment {
  id: string;
  date: string;
  title: string;
  category: 'Laboratorio' | 'Imagen' | 'Receta' | 'Control' | 'Otro';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// 7. Desarrollo personal
// ---------------------------------------------------------------------------
export interface PersonalGoal {
  id: string;
  title: string;
  horizon: 'corto' | 'mediano' | 'largo';
  targetValue: number;
  currentValue: number;
  unit: string;
  dueDate: string;
  completed: boolean;
  notes?: string;
}

export interface DailyHabitItem {
  id: string;
  title: string;
  category: string;
  targetDaysPerWeek: number;
  completedDates: string[]; // YYYY-MM-DD[]
  archived?: boolean;
}

export interface PersonalProjectItem {
  id: string;
  title: string;
  status: 'en-curso' | 'pausado' | 'completado';
  nextStep: string;
  progressPct: number;
  reflection?: string;
}

export interface PersonalAchievement {
  id: string;
  date: string;
  title: string;
  category: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// 8. Relaciones y vida social
// ---------------------------------------------------------------------------
export interface FamilySocialEvent {
  id: string;
  date: string;
  time?: string;
  title: string;
  kind: 'familia' | 'fecha-importante' | 'reunion' | 'actividad-compartida' | 'proyecto-familiar';
  participants: string;
  sharedConsent: boolean;
  notes?: string;
}

// ---------------------------------------------------------------------------
// 9. Naturaleza y bienestar ambiental
// ---------------------------------------------------------------------------
export interface NatureOutingEntry {
  id: string;
  date: string;
  activity: 'caminata-verde' | 'jardineria' | 'aire-libre' | 'desconexion-digital' | 'habito-sostenible';
  place: string;
  durationMin: number;
  feeling: string;
  notes?: string;
}

export interface NatureFavoritePlace {
  id: string;
  name: string;
  location: string;
  bestFor: string;
}

// ---------------------------------------------------------------------------
// 12. FABRO COACH
// ---------------------------------------------------------------------------
export interface CoachDataPermissions {
  nutrition: boolean;
  fitness: boolean;
  sleep: boolean;
  habitsAndGoals: boolean;
  mood: boolean;
  healthMetrics: boolean;
}

export interface CoachMessageItem {
  id: string;
  role: 'user' | 'coach';
  createdAt: string;
  text: string;
  sourceLabel?: string;
}

// ---------------------------------------------------------------------------
// 14. FABRO DESAFÍOS
// ---------------------------------------------------------------------------
export interface WellnessChallengeItem {
  id: string;
  title: string;
  category:
    | 'hidratacion'
    | 'caminatas'
    | 'sueno'
    | 'frutas-verduras'
    | 'estiramientos'
    | 'meditacion'
    | 'lectura'
    | 'menos-pantalla'
    | 'personalizado';
  description: string;
  durationDays: number;
  dailyGoalLabel: string;
  startDate: string;
  completedDates: string[]; // YYYY-MM-DD[]
  active: boolean;
  badgeTitle: string;
}

// ---------------------------------------------------------------------------
// 17. Comunidad de bienestar
// ---------------------------------------------------------------------------
export type WellnessCommunitySpaceId =
  | 'Alimentación'
  | 'Entrenamiento'
  | 'Caminatas'
  | 'Meditación'
  | 'Desarrollo personal'
  | 'Hábitos saludables'
  | 'Actividades recreativas';

// ---------------------------------------------------------------------------
// 18. Configuración y privacidad
// ---------------------------------------------------------------------------
export interface MyDayWidgetVisibility {
  nutrition: boolean;
  hydration: boolean;
  fitness: boolean;
  sleep: boolean;
  mood: boolean;
  habits: boolean;
  goals: boolean;
  challenges: boolean;
  agenda: boolean;
}

export interface WellnessPrivacySettings {
  keepHealthPrivate: boolean;
  keepEmotionalPrivate: boolean;
  keepNutritionPrivate: boolean;
  requireShareConfirmation: boolean;
  myDayWidgets: MyDayWidgetVisibility;
  lastBackupAt?: string;
}

// ---------------------------------------------------------------------------
// Snapshot completo en IndexedDB
// ---------------------------------------------------------------------------
export interface WellnessStateSnapshot {
  version: 2;
  updatedAt: string;
  nutritionPrefs: NutritionPreferences;
  customFoods: FoodCatalogItem[];
  mealLogs: MealLogEntry[];
  recipes: WellnessRecipe[];
  weeklyMealPlan: WeeklyMealPlanEntry[];
  shoppingList: WellnessShoppingItem[];
  customExercises: ExerciseDefinition[];
  customRoutines: CustomWorkoutRoutine[];
  workoutLogs: WorkoutSessionRecord[];
  emotionEntries: EmotionJournalEntry[];
  sleepLogs: SleepLogEntry[];
  sleepPrefs: SleepPreferences;
  healthMetrics: HealthMetricEntry[];
  medicalAppointments: MedicalAppointment[];
  vaccines: VaccineEntry[];
  medications: MedicationEntry[];
  medicalFiles: MedicalFileAttachment[];
  personalGoals: PersonalGoal[];
  dailyHabits: DailyHabitItem[];
  personalProjects: PersonalProjectItem[];
  achievements: PersonalAchievement[];
  familyEvents: FamilySocialEvent[];
  natureOutings: NatureOutingEntry[];
  naturePlaces: NatureFavoritePlace[];
  sustainableHabitsChecked: string[];
  challenges: WellnessChallengeItem[];
  coachPermissions: CoachDataPermissions;
  coachMessages: CoachMessageItem[];
  privacySettings: WellnessPrivacySettings;
}
