import React, { useMemo, useState } from 'react';
import {
  Activity,
  Apple,
  Calculator,
  Calendar,
  CheckCircle2,
  Flame,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { getLocalTodayDateKey, useHabitTimer } from '../../context/HabitTimerContext';
import type { CalorieMealCategory } from '../../types/fabro';

const MEAL_CATEGORY_LABELS: Record<CalorieMealCategory, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  merienda: 'Merienda',
  cena: 'Cena',
  snack: 'Snack',
  bebida: 'Bebida',
};

interface QuickFoodPreset {
  id: string;
  name: string;
  category: CalorieMealCategory;
  portion: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const COMMON_FOODS_CATALOG: QuickFoodPreset[] = [
  { id: 'f_cafe_leche', name: 'Café con leche descremada', category: 'desayuno', portion: '1 taza (250 ml)', calories: 95, proteinG: 6, carbsG: 9, fatG: 3 },
  { id: 'f_mate_amargo', name: 'Mate o té sin azúcar', category: 'bebida', portion: '1 termo / taza', calories: 5, proteinG: 0, carbsG: 1, fatG: 0 },
  { id: 'f_tostadas_queso', name: '2 tostadas integrales con queso untable', category: 'desayuno', portion: '2 rebanadas', calories: 230, proteinG: 9, carbsG: 28, fatG: 8 },
  { id: 'f_avena_fruta', name: 'Avena cocida con fruta y chía', category: 'desayuno', portion: '1 bol (250 g)', calories: 290, proteinG: 10, carbsG: 48, fatG: 7 },
  { id: 'f_huevos_rev', name: '2 huevos revueltos', category: 'desayuno', portion: '2 unidades', calories: 165, proteinG: 13, carbsG: 2, fatG: 11 },
  { id: 'f_yogur_granola', name: 'Yogur natural con granola', category: 'merienda', portion: '1 pote (200 g)', calories: 240, proteinG: 11, carbsG: 32, fatG: 7 },
  { id: 'f_banana', name: 'Banana mediana', category: 'snack', portion: '1 unidad (120 g)', calories: 105, proteinG: 1, carbsG: 27, fatG: 0 },
  { id: 'f_manzana', name: 'Manzana roja o verde', category: 'snack', portion: '1 unidad (180 g)', calories: 95, proteinG: 0, carbsG: 25, fatG: 0 },
  { id: 'f_almendras', name: 'Almendras o nueces', category: 'snack', portion: '1 puñado (25 g)', calories: 150, proteinG: 5, carbsG: 5, fatG: 13 },
  { id: 'f_pollo_plancha', name: 'Pechuga de pollo a la plancha', category: 'almuerzo', portion: '150 g cocidos', calories: 245, proteinG: 45, carbsG: 0, fatG: 6 },
  { id: 'f_carne_magra', name: 'Bife de carne magra a la plancha', category: 'almuerzo', portion: '160 g cocidos', calories: 280, proteinG: 42, carbsG: 0, fatG: 12 },
  { id: 'f_pescado_horno', name: 'Filet de merluza o salmón al horno', category: 'cena', portion: '160 g', calories: 260, proteinG: 34, carbsG: 0, fatG: 13 },
  { id: 'f_arroz_integral', name: 'Arroz integral cocido', category: 'almuerzo', portion: '1 taza (160 g)', calories: 185, proteinG: 4, carbsG: 38, fatG: 2 },
  { id: 'f_fideos_salsa', name: 'Fideos con fileto natural', category: 'almuerzo', portion: '1 plato (250 g)', calories: 360, proteinG: 12, carbsG: 64, fatG: 6 },
  { id: 'f_ensalada_mixta', name: 'Ensalada mixta con oliva', category: 'almuerzo', portion: '1 bol grande', calories: 145, proteinG: 3, carbsG: 11, fatG: 10 },
  { id: 'f_lentejas_guiso', name: 'Lentejas guisadas con verduras', category: 'almuerzo', portion: '1 plato (300 g)', calories: 340, proteinG: 19, carbsG: 52, fatG: 6 },
  { id: 'f_empanada', name: 'Empanada al horno (carne o pollo)', category: 'cena', portion: '1 unidad', calories: 240, proteinG: 11, carbsG: 26, fatG: 10 },
  { id: 'f_pizza_porcion', name: 'Porción de pizza muzzarella', category: 'cena', portion: '1 porción', calories: 285, proteinG: 12, carbsG: 33, fatG: 11 },
  { id: 'f_sopa_verduras', name: 'Sopa casera de verduras', category: 'cena', portion: '1 plato hondo', calories: 120, proteinG: 4, carbsG: 18, fatG: 3 },
  { id: 'f_palta_tostada', name: 'Tostada con media palta', category: 'merienda', portion: '1 unidad', calories: 210, proteinG: 5, carbsG: 18, fatG: 13 },
  { id: 'f_licuado_leche', name: 'Licuado de banana con leche', category: 'merienda', portion: '1 vaso (300 ml)', calories: 210, proteinG: 9, carbsG: 36, fatG: 3 },
  { id: 'f_agua_500', name: 'Agua mineral / filtrada', category: 'bebida', portion: '500 ml', calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  { id: 'f_gaseosa_comun', name: 'Bebida azucarada / jugo comercial', category: 'bebida', portion: '1 vaso (250 ml)', calories: 110, proteinG: 0, carbsG: 27, fatG: 0 },
  { id: 'f_chocolate_amargo', name: 'Chocolate amargo 70%', category: 'snack', portion: '2 cuadritos (20 g)', calories: 115, proteinG: 2, carbsG: 9, fatG: 8 },
];

const BURN_PRESETS: Array<{ activity: string; minutes: number; caloriesBurned: number }> = [
  { activity: 'Caminata a paso firme', minutes: 30, caloriesBurned: 135 },
  { activity: 'Trote / Running suave', minutes: 30, caloriesBurned: 280 },
  { activity: 'Bicicleta fija o paseo', minutes: 30, caloriesBurned: 230 },
  { activity: 'Entrenamiento de fuerza', minutes: 40, caloriesBurned: 220 },
  { activity: 'Yoga / Estiramientos', minutes: 30, caloriesBurned: 105 },
  { activity: 'Natación moderada', minutes: 30, caloriesBurned: 260 },
];

export const CalorieCounterView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { setActiveSection } = useFabro();
  const {
    calorieTarget,
    setCalorieTarget,
    calorieFoodEntries,
    addCalorieFoodEntry,
    deleteCalorieFoodEntry,
    calorieBurnEntries,
    addCalorieBurnEntry,
    deleteCalorieBurnEntry,
    dailyMeals,
  } = useHabitTimer();

  const todayKey = getLocalTodayDateKey();
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedMealCat, setSelectedMealCat] = useState<CalorieMealCategory>('almuerzo');
  const [notice, setNotice] = useState<string | null>(null);

  // Target editor & BMR calculator
  const [targetInput, setTargetInput] = useState(String(calorieTarget));
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcSex, setCalcSex] = useState<'femenino' | 'masculino'>('femenino');
  const [calcAge, setCalcAge] = useState('28');
  const [calcWeightKg, setCalcWeightKg] = useState('68');
  const [calcHeightCm, setCalcHeightCm] = useState('170');
  const [calcActivity, setCalcActivity] = useState('1.45');
  const [calcGoalDelta, setCalcGoalDelta] = useState('0');

  // Custom Food Form
  const [foodName, setFoodName] = useState('');
  const [foodPortion, setFoodPortion] = useState('1 porción');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodCategory, setFoodCategory] = useState<CalorieMealCategory>('almuerzo');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');

  // Burned Calories Form
  const [burnActivity, setBurnActivity] = useState('');
  const [burnMinutes, setBurnMinutes] = useState('30');
  const [burnKcal, setBurnKcal] = useState('');

  const dayFoods = useMemo(
    () => calorieFoodEntries.filter((e) => e.dateKey === selectedDate),
    [calorieFoodEntries, selectedDate]
  );

  const dayBurns = useMemo(
    () => calorieBurnEntries.filter((e) => e.dateKey === selectedDate),
    [calorieBurnEntries, selectedDate]
  );

  const stats = useMemo(() => {
    const consumed = dayFoods.reduce((acc, f) => acc + (f.calories || 0), 0);
    const burned = dayBurns.reduce((acc, b) => acc + (b.caloriesBurned || 0), 0);
    const proteinG = dayFoods.reduce((acc, f) => acc + (f.proteinG || 0), 0);
    const carbsG = dayFoods.reduce((acc, f) => acc + (f.carbsG || 0), 0);
    const fatG = dayFoods.reduce((acc, f) => acc + (f.fatG || 0), 0);
    const netCalories = Math.max(0, consumed - burned);
    const remaining = calorieTarget + burned - consumed;
    const adjustedBudget = Math.max(1, calorieTarget + burned);
    const progressPct = Math.min(100, Math.round((consumed / adjustedBudget) * 100));
    return {
      consumed,
      burned,
      netCalories,
      remaining,
      proteinG,
      carbsG,
      fatG,
      progressPct,
    };
  }, [dayFoods, dayBurns, calorieTarget]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return COMMON_FOODS_CATALOG.filter((item) => {
      if (!q) return true;
      return `${item.name} ${MEAL_CATEGORY_LABELS[item.category]} ${item.portion}`
        .toLowerCase()
        .includes(q);
    });
  }, [catalogSearch]);

  const computedRecommendedKcal = useMemo(() => {
    const age = Math.max(12, Math.min(100, Number(calcAge) || 28));
    const weight = Math.max(30, Math.min(250, Number(calcWeightKg) || 68));
    const height = Math.max(120, Math.min(230, Number(calcHeightCm) || 170));
    const factor = Number(calcActivity) || 1.45;
    const delta = Number(calcGoalDelta) || 0;
    const bmr =
      calcSex === 'masculino'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;
    return Math.max(1100, Math.min(4800, Math.round(bmr * factor + delta)));
  }, [calcSex, calcAge, calcWeightKg, calcHeightCm, calcActivity, calcGoalDelta]);

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(targetInput);
    if (!Number.isFinite(val) || val < 800) return;
    setCalorieTarget(val);
    setTargetInput(String(Math.round(Math.max(800, Math.min(6000, val)))));
    showTempNotice('Meta diaria de calorías actualizada.');
  };

  const handleAddCustomFood = (e: React.FormEvent) => {
    e.preventDefault();
    const kcal = Number(foodCalories);
    if (!foodName.trim() || !Number.isFinite(kcal) || kcal <= 0) return;
    addCalorieFoodEntry({
      dateKey: selectedDate,
      name: foodName.trim(),
      category: foodCategory,
      portion: foodPortion.trim() || '1 porción',
      calories: Math.round(kcal),
      proteinG: foodProtein ? Number(foodProtein) : undefined,
      carbsG: foodCarbs ? Number(foodCarbs) : undefined,
      fatG: foodFat ? Number(foodFat) : undefined,
    });
    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodCarbs('');
    setFoodFat('');
    showTempNotice('Alimento registrado en tu contador diario.');
  };

  const handleQuickAddPreset = (preset: QuickFoodPreset) => {
    addCalorieFoodEntry({
      dateKey: selectedDate,
      name: preset.name,
      category: selectedMealCat || preset.category,
      portion: preset.portion,
      calories: preset.calories,
      proteinG: preset.proteinG,
      carbsG: preset.carbsG,
      fatG: preset.fatG,
    });
    showTempNotice(`+${preset.calories} kcal (${preset.name}) agregadas.`);
  };

  const handleAddBurn = (e: React.FormEvent) => {
    e.preventDefault();
    const kcal = Number(burnKcal);
    const mins = Number(burnMinutes) || 20;
    if (!burnActivity.trim() || !Number.isFinite(kcal) || kcal <= 0) return;
    addCalorieBurnEntry({
      dateKey: selectedDate,
      activity: burnActivity.trim(),
      minutes: mins,
      caloriesBurned: Math.round(kcal),
    });
    setBurnActivity('');
    setBurnKcal('');
    showTempNotice(`Actividad registrada (-${Math.round(kcal)} kcal).`);
  };

  const handleImportDailyMeals = () => {
    if (!dailyMeals || dailyMeals.length === 0) return;
    let addedCount = 0;
    for (const meal of dailyMeals) {
      const cat: CalorieMealCategory =
        meal.slot === 'colacion'
          ? 'snack'
          : (meal.slot as CalorieMealCategory);
      addCalorieFoodEntry({
        dateKey: selectedDate,
        name: meal.title,
        category: cat,
        portion: `${meal.foods.length || 1} ingredientes`,
        calories: meal.approxKcal || 250,
      });
      addedCount += 1;
    }
    showTempNotice(`Se importaron ${addedCount} comidas de tu plan nutricional.`);
  };

  return (
    <div className="space-y-6">
      {!embedded && (
        <section className="rounded-2xl border border-emerald-500/30 fabro-shell-surface p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                Sector 02 · Bienestar y Salud
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('bienestar-panel')}
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer whitespace-nowrap"
              >
                ← Volver a Bienestar
              </button>
            </div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-[#FAF6EE]">
              Contador de Calorías y Balance Diario
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
              Registrá tus comidas, calculá tu objetivo calórico diario, sumá calorías quemadas por ejercicio y controlá macronutrientes de forma clara.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/15 fabro-shell-surface-2 px-3 py-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || todayKey)}
                aria-label="Seleccionar fecha del registro"
                className="bg-transparent text-slate-900 dark:text-[#FAF6EE] font-mono text-xs focus:outline-none"
              />
            </label>
            {selectedDate !== todayKey && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayKey)}
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer whitespace-nowrap"
              >
                Ir a hoy
              </button>
            )}
          </div>
        </section>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Daily Summary KPIs & Progress Bar */}
      <section className="rounded-2xl border fabro-shell-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <h3 className="font-display text-base font-bold text-slate-900 dark:text-[#FAF6EE]">
              Balance energético · {selectedDate}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {embedded && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || todayKey)}
                aria-label="Fecha del contador"
                className="rounded-lg border border-slate-200 dark:border-white/15 fabro-shell-surface-2 px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-[#FAF6EE]"
              />
            )}
            <form onSubmit={handleSaveTarget} className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Meta (kcal):</span>
              <input
                type="number"
                min={800}
                max={6000}
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                aria-label="Meta diaria en kilocalorías"
                className="w-20 rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
              >
                Fijar
              </button>
            </form>
            <button
              type="button"
              onClick={() => setCalcOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/15 fabro-shell-surface-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-emerald-500/40 cursor-pointer whitespace-nowrap"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-500" />
              {calcOpen ? 'Ocultar calculadora' : 'Calcular mi meta'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 fabro-shell-surface-2">
          <div className="p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Consumidas</p>
            <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">
              {stats.consumed} <span className="text-xs font-normal text-slate-500">kcal</span>
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Meta base</p>
            <p className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">
              {calorieTarget} <span className="text-xs font-normal text-slate-500">kcal</span>
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Quemadas (ejercicio)</p>
            <p className="font-mono text-xl font-bold tabular-nums text-amber-600 dark:text-[#E5B842] mt-0.5">
              {stats.burned} <span className="text-xs font-normal text-slate-500">kcal</span>
            </p>
          </div>
          <div className="p-3.5">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {stats.remaining >= 0 ? 'Disponibles hoy' : 'Excedente hoy'}
            </p>
            <p
              className={`font-mono text-xl font-bold tabular-nums mt-0.5 ${
                stats.remaining >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {stats.remaining >= 0 ? stats.remaining : Math.abs(stats.remaining)}{' '}
              <span className="text-xs font-normal text-slate-500">kcal</span>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-300 font-mono tabular-nums">
              Consumo neto: {stats.netCalories} kcal · {stats.progressPct}% del presupuesto ajustado
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              Macros del día: {stats.proteinG}g prot · {stats.carbsG}g carb · {stats.fatG}g grasas
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                stats.remaining < 0 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
        </div>

        {calcOpen && (
          <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-slate-800 dark:text-[#FAF6EE]">
                Estimador orientativo Mifflin-St Jeor (TMB × actividad)
              </p>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Sugerencia: {computedRecommendedKcal} kcal/día
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Sexo biológico</span>
                <select
                  value={calcSex}
                  onChange={(e) => setCalcSex(e.target.value as 'femenino' | 'masculino')}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 text-slate-900 dark:text-[#FAF6EE]"
                >
                  <option value="femenino">Femenino</option>
                  <option value="masculino">Masculino</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Edad (años)</span>
                <input
                  type="number"
                  min={12}
                  max={100}
                  value={calcAge}
                  onChange={(e) => setCalcAge(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Peso (kg)</span>
                <input
                  type="number"
                  min={30}
                  max={250}
                  value={calcWeightKg}
                  onChange={(e) => setCalcWeightKg(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Altura (cm)</span>
                <input
                  type="number"
                  min={120}
                  max={230}
                  value={calcHeightCm}
                  onChange={(e) => setCalcHeightCm(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Actividad física</span>
                <select
                  value={calcActivity}
                  onChange={(e) => setCalcActivity(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 text-slate-900 dark:text-[#FAF6EE]"
                >
                  <option value="1.2">Sedentario (×1.2)</option>
                  <option value="1.375">Ligero 1-3 días (×1.38)</option>
                  <option value="1.55">Moderado 3-5 días (×1.55)</option>
                  <option value="1.725">Activo 6-7 días (×1.73)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Enfoque</span>
                <select
                  value={calcGoalDelta}
                  onChange={(e) => setCalcGoalDelta(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 text-slate-900 dark:text-[#FAF6EE]"
                >
                  <option value="-350">Déficit suave (-350 kcal)</option>
                  <option value="0">Mantenimiento (0)</option>
                  <option value="300">Superávit suave (+300 kcal)</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Valor estimativo orientativo; consultá con un profesional en nutrición para un plan clínico personalizado.
              </p>
              <button
                type="button"
                onClick={() => {
                  setCalorieTarget(computedRecommendedKcal);
                  setTargetInput(String(computedRecommendedKcal));
                  setCalcOpen(false);
                  showTempNotice(`Meta diaria ajustada a ${computedRecommendedKcal} kcal.`);
                }}
                className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
              >
                Aplicar {computedRecommendedKcal} kcal como meta
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Main Workspace: Food Log + Quick Catalog & Exercise Burn */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Custom Food Entry + Quick Catalog */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleAddCustomFood}
            className="rounded-2xl border fabro-shell-surface p-5 space-y-4 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-emerald-500" />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Agregar alimento o comida
                </h3>
              </div>
              {dailyMeals.length > 0 && (
                <button
                  type="button"
                  onClick={handleImportDailyMeals}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-300 hover:underline cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Importar plan nutricional ({dailyMeals.length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="sm:col-span-2 space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Alimento o plato *</span>
                <input
                  type="text"
                  required
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  placeholder="Ej: Pollo al horno con calabaza"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Momento</span>
                <select
                  value={foodCategory}
                  onChange={(e) => setFoodCategory(e.target.value as CalorieMealCategory)}
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-2 text-slate-900 dark:text-[#FAF6EE]"
                >
                  {(Object.keys(MEAL_CATEGORY_LABELS) as CalorieMealCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {MEAL_CATEGORY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-200">Calorías (kcal) *</span>
                <input
                  type="number"
                  required
                  min={1}
                  max={5000}
                  value={foodCalories}
                  onChange={(e) => setFoodCalories(e.target.value)}
                  placeholder="320"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-3 py-2 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Porción</span>
                <input
                  type="text"
                  value={foodPortion}
                  onChange={(e) => setFoodPortion(e.target.value)}
                  placeholder="1 plato"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Proteínas (g opc.)</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={foodProtein}
                  onChange={(e) => setFoodProtein(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Carbohidratos (g opc.)</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={foodCarbs}
                  onChange={(e) => setFoodCarbs(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">Grasas (g opc.)</span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={foodFat}
                  onChange={(e) => setFoodFat(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Registrar comida
              </button>
            </div>
          </form>

          {/* Quick Add Common Foods Catalog */}
          <section className="rounded-2xl border fabro-shell-surface p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Apple className="w-4 h-4 text-emerald-500" />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Catálogo rápido de alimentos frecuentes
                </h3>
              </div>
              <select
                value={selectedMealCat}
                onChange={(e) => setSelectedMealCat(e.target.value as CalorieMealCategory)}
                aria-label="Momento para carga rápida"
                className="rounded-lg border border-slate-200 dark:border-white/10 fabro-shell-surface-2 px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200"
              >
                {(Object.keys(MEAL_CATEGORY_LABELS) as CalorieMealCategory[]).map((k) => (
                  <option key={k} value={k}>
                    Agregar como: {MEAL_CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Buscar alimento rápido (ej: café, pollo, banana, arroz)..."
                className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-[#FAF6EE]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
              {filteredCatalog.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleQuickAddPreset(item)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-white/10 fabro-shell-surface-2 p-2.5 text-left hover:border-emerald-500/50 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-[#FAF6EE] truncate">
                      {item.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {item.portion} · {item.proteinG}g P · {item.carbsG}g C
                    </p>
                  </div>
                  <span className="font-mono text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
                    +{item.calories} kcal
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Right: Daily Food Log + Burned Calories Log */}
        <div className="lg:col-span-5 space-y-6">
          {/* Today's Food Entries */}
          <section className="rounded-2xl border fabro-shell-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                Registro de comidas ({dayFoods.length})
              </h3>
              <span className="font-mono text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {stats.consumed} kcal
              </span>
            </div>

            {dayFoods.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
                Todavía no cargaste alimentos para esta fecha. Usá el catálogo rápido o el formulario.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200/70 dark:divide-white/10 max-h-80 overflow-y-auto">
                {dayFoods.map((entry) => (
                  <li key={entry.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-[#FAF6EE] truncate">
                        {entry.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {MEAL_CATEGORY_LABELS[entry.category]} · {entry.portion}
                        {(entry.proteinG || entry.carbsG || entry.fatG)
                          ? ` · P ${entry.proteinG || 0}g / C ${entry.carbsG || 0}g / G ${entry.fatG || 0}g`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE]">
                        {entry.calories} kcal
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteCalorieFoodEntry(entry.id)}
                        aria-label={`Eliminar ${entry.name}`}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Exercise / Burned Calories */}
          <section className="rounded-2xl border fabro-shell-surface p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-500" />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-[#FAF6EE]">
                  Calorías quemadas
                </h3>
              </div>
              <span className="font-mono font-bold tabular-nums text-amber-600 dark:text-[#E5B842]">
                -{stats.burned} kcal
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {BURN_PRESETS.map((preset) => (
                <button
                  key={preset.activity}
                  type="button"
                  onClick={() => {
                    addCalorieBurnEntry({
                      dateKey: selectedDate,
                      activity: preset.activity,
                      minutes: preset.minutes,
                      caloriesBurned: preset.caloriesBurned,
                    });
                    showTempNotice(`-${preset.caloriesBurned} kcal (${preset.activity}).`);
                  }}
                  className="rounded-lg border border-slate-200 dark:border-white/10 fabro-shell-surface-2 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-amber-500/50 cursor-pointer whitespace-nowrap"
                >
                  {preset.activity.split(' ')[0]} {preset.minutes}m (-{preset.caloriesBurned})
                </button>
              ))}
            </div>

            <form onSubmit={handleAddBurn} className="grid grid-cols-12 gap-2">
              <input
                type="text"
                required
                value={burnActivity}
                onChange={(e) => setBurnActivity(e.target.value)}
                placeholder="Actividad física"
                className="col-span-6 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2.5 py-1.5 text-slate-900 dark:text-[#FAF6EE]"
              />
              <input
                type="number"
                min={1}
                max={600}
                value={burnMinutes}
                onChange={(e) => setBurnMinutes(e.target.value)}
                placeholder="Min"
                title="Duración en minutos"
                className="col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
              />
              <input
                type="number"
                required
                min={1}
                max={5000}
                value={burnKcal}
                onChange={(e) => setBurnKcal(e.target.value)}
                placeholder="kcal"
                title="Calorías quemadas"
                className="col-span-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/25 px-2 py-1.5 font-mono tabular-nums text-slate-900 dark:text-[#FAF6EE]"
              />
              <button
                type="submit"
                className="col-span-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 cursor-pointer"
              >
                +
              </button>
            </form>

            {dayBurns.length > 0 && (
              <ul className="divide-y divide-slate-200/70 dark:divide-white/10 pt-1">
                {dayBurns.map((b) => (
                  <li key={b.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-[#FAF6EE] truncate">
                        {b.activity}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {b.minutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold tabular-nums text-amber-600 dark:text-[#E5B842]">
                        -{b.caloriesBurned} kcal
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteCalorieBurnEntry(b.id)}
                        aria-label={`Quitar ${b.activity}`}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
