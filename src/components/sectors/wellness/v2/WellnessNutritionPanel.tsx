import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  Camera,
  Check,
  ChefHat,
  KeyRound,
  ListChecks,
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  Sliders,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import { BUILTIN_FOOD_DB } from '../../../../data/wellnessCatalog';
import { sendByokChatCompletion } from '../../../../services/byokChatClient';
import { findByokKeyForWellnessEngine } from '../../../../services/wellnessAiService';
import {
  lookupBarcodeOpenFoodFacts,
  nowTimeLabel,
  todayIsoDate,
} from '../../../../services/wellnessVault';
import type {
  FoodCatalogItem,
  MealLogEntry,
  MealSlot,
  WellnessRecipe,
  WellnessStateSnapshot,
} from '../../../../types/wellness';
import { WellnessAiStudioPanel } from '../WellnessAiStudioPanel';
import { WellnessBarChart } from './WellnessCharts';

interface WellnessNutritionPanelProps {
  state: WellnessStateSnapshot;
  onUpdateState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
}

type NutritionSubTab =
  | 'registro'
  | 'escaner-foto'
  | 'recetas-plan'
  | 'compras-prefs'
  | 'asistente-ia';

const MEAL_SLOTS: Array<{ id: MealSlot; label: string }> = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'almuerzo', label: 'Almuerzo' },
  { id: 'merienda', label: 'Merienda' },
  { id: 'cena', label: 'Cena' },
  { id: 'colacion', label: 'Colaciones' },
];

const DAYS_OF_WEEK = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

export const WellnessNutritionPanel: React.FC<WellnessNutritionPanelProps> = ({
  state,
  onUpdateState,
}) => {
  const { byokKeys, getByokSecret, wellnessAiEngine, navigateTo } = useEcosystem();
  const [subTab, setSubTab] = useState<NutritionSubTab>('registro');
  const [selectedDate, setSelectedDate] = useState(todayIsoDate());
  const [activeSlot, setActiveSlot] = useState<MealSlot>('almuerzo');
  const [foodQuery, setFoodQuery] = useState('');
  const [portionMultiplier, setPortionMultiplier] = useState(1);

  // Manual quick entry / custom food
  const [customName, setCustomName] = useState('');
  const [customServing, setCustomServing] = useState('1 porción');
  const [customKcal, setCustomKcal] = useState('');
  const [customProt, setCustomProt] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [saveAsCustomFood, setSaveAsCustomFood] = useState(true);

  // Barcode scanner
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState<FoodCatalogItem | null>(null);
  const [barcodeMsg, setBarcodeMsg] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  // Photo food estimation
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoDescription, setPhotoDescription] = useState('');
  const [photoEstName, setPhotoEstName] = useState('');
  const [photoEstKcal, setPhotoEstKcal] = useState('');
  const [photoEstProt, setPhotoEstProt] = useState('');
  const [photoEstCarbs, setPhotoEstCarbs] = useState('');
  const [photoEstFat, setPhotoEstFat] = useState('');
  const [photoAiLoading, setPhotoAiLoading] = useState(false);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);

  // Recipes & weekly plan
  const [recTitle, setRecTitle] = useState('');
  const [recSlot, setRecSlot] = useState<MealSlot>('almuerzo');
  const [recKcal, setRecKcal] = useState('');
  const [recProt, setRecProt] = useState('');
  const [recCarbs, setRecCarbs] = useState('');
  const [recFat, setRecFat] = useState('');
  const [recIngredients, setRecIngredients] = useState('');
  const [recSteps, setRecSteps] = useState('');

  const [planDay, setPlanDay] = useState<(typeof DAYS_OF_WEEK)[number]>('Lunes');
  const [planSlot, setPlanSlot] = useState<MealSlot>('almuerzo');
  const [planTitle, setPlanTitle] = useState('');

  // Shopping list
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState('Verdulería');

  const [feedback, setFeedback] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  const stopCamera = () => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);

  const allFoods = useMemo(
    () => [...state.customFoods, ...BUILTIN_FOOD_DB],
    [state.customFoods]
  );

  const filteredFoods = useMemo(() => {
    const q = foodQuery.trim().toLowerCase();
    if (!q) return allFoods.slice(0, 12);
    return allFoods
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.brand && f.brand.toLowerCase().includes(q)) ||
          (f.barcode && f.barcode.includes(q))
      )
      .slice(0, 18);
  }, [allFoods, foodQuery]);

  const dayLogs = useMemo(
    () => state.mealLogs.filter((m) => m.date === selectedDate),
    [state.mealLogs, selectedDate]
  );

  const dayTotals = useMemo(
    () =>
      dayLogs.reduce(
        (acc, m) => ({
          calories: acc.calories + m.calories,
          proteinG: Number((acc.proteinG + m.proteinG).toFixed(1)),
          carbsG: Number((acc.carbsG + m.carbsG).toFixed(1)),
          fatG: Number((acc.fatG + m.fatG).toFixed(1)),
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
      ),
    [dayLogs]
  );

  const last7Calories = useMemo(() => {
    const arr: Array<{ label: string; value: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      arr.push({
        label: iso.slice(5),
        value: state.mealLogs
          .filter((m) => m.date === iso)
          .reduce((acc, m) => acc + m.calories, 0),
      });
    }
    return arr;
  }, [state.mealLogs]);

  const logFoodItem = (food: FoodCatalogItem, mult = 1, customSlot?: MealSlot) => {
    const entry: MealLogEntry = {
      id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: selectedDate,
      time: nowTimeLabel(),
      slot: customSlot || activeSlot,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      quantityLabel: mult === 1 ? food.servingLabel : `${mult} × ${food.servingLabel}`,
      calories: Math.round(food.calories * mult),
      proteinG: Number((food.proteinG * mult).toFixed(1)),
      carbsG: Number((food.carbsG * mult).toFixed(1)),
      fatG: Number((food.fatG * mult).toFixed(1)),
      source: food.source,
    };
    onUpdateState((prev) => ({
      ...prev,
      mealLogs: [entry, ...prev.mealLogs],
    }));
    notify(`Agregado «${entry.name}» (${entry.calories} kcal) a ${entry.slot}.`);
  };

  const handleAddManualMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const kcal = Math.max(0, Number(customKcal) || 0);
    const prot = Math.max(0, Number(customProt) || 0);
    const carbs = Math.max(0, Number(customCarbs) || 0);
    const fat = Math.max(0, Number(customFat) || 0);

    const newFood: FoodCatalogItem = {
      id: `cf-${Date.now()}`,
      name: customName.trim(),
      servingLabel: customServing.trim() || '1 porción',
      servingGrams: 100,
      calories: Math.round(kcal),
      proteinG: prot,
      carbsG: carbs,
      fatG: fat,
      source: 'personalizado',
    };

    const entry: MealLogEntry = {
      id: `meal-${Date.now()}`,
      date: selectedDate,
      time: nowTimeLabel(),
      slot: activeSlot,
      name: newFood.name,
      quantityLabel: newFood.servingLabel,
      calories: newFood.calories,
      proteinG: newFood.proteinG,
      carbsG: newFood.carbsG,
      fatG: newFood.fatG,
      source: 'personalizado',
    };

    onUpdateState((prev) => ({
      ...prev,
      customFoods: saveAsCustomFood ? [newFood, ...prev.customFoods] : prev.customFoods,
      mealLogs: [entry, ...prev.mealLogs],
    }));
    setCustomName('');
    setCustomKcal('');
    setCustomProt('');
    setCustomCarbs('');
    setCustomFat('');
    notify('Comida registrada en tu diario nutricional.');
  };

  const handleBarcodeLookup = async (codeOverride?: string) => {
    const code = (codeOverride ?? barcodeInput).trim();
    if (!code) return;
    setBarcodeLoading(true);
    setBarcodeMsg(null);
    setBarcodeResult(null);

    const localMatch = allFoods.find((f) => f.barcode === code);
    if (localMatch) {
      setBarcodeResult(localMatch);
      setBarcodeMsg('Producto encontrado en tu base local (sin consumo de red).');
      setBarcodeLoading(false);
      return;
    }

    const res = await lookupBarcodeOpenFoodFacts(code);
    setBarcodeLoading(false);
    if (res.ok && res.item) {
      setBarcodeResult(res.item);
      setBarcodeMsg('Datos obtenidos de Open Food Facts (API pública gratuita, por cada 100 g). Revisá la porción real antes de guardar.');
    } else {
      setBarcodeMsg(res.error || 'No encontrado. Podés cargarlo manualmente abajo.');
    }
  };

  const startBarcodeCamera = async () => {
    setCameraError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Tu navegador no permite acceso a la cámara. Ingresá el código de barras manualmente.');
      return;
    }
    const BarcodeDetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);

      if (!BarcodeDetectorCtor) {
        setCameraError(
          'Cámara abierta, pero este navegador no expone la API nativa BarcodeDetector. Escribí el número del código de barras manualmente abajo.'
        );
        return;
      }

      const detector = new BarcodeDetectorCtor({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
      });
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const hits = await detector.detect(videoRef.current);
          const raw = hits[0]?.rawValue;
          if (raw) {
            setBarcodeInput(raw);
            stopCamera();
            void handleBarcodeLookup(raw);
          }
        } catch {
          // ignore transient frame read errors
        }
      }, 600);
    } catch {
      setCameraError('No se pudo abrir la cámara (permiso denegado o dispositivo sin cámara). Podés ingresar el código manualmente.');
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        setPhotoNotice(
          'Foto cargada localmente. Recordá: una foto solo permite estimaciones aproximadas. Describí los ingredientes o corregí los valores antes de guardar.'
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEstimatePhotoWithByok = async () => {
    if (!photoDescription.trim()) {
      setPhotoNotice('Describí brevemente qué alimentos y porciones se ven en el plato para estimar con mayor precisión.');
      return;
    }
    const found = findByokKeyForWellnessEngine(byokKeys, getByokSecret, wellnessAiEngine);
    if (!found) {
      setPhotoNotice(
        'No tenés una clave BYOK activa. Podés cargar tus propios valores estimados manualmente abajo sin costo.'
      );
      return;
    }
    setPhotoAiLoading(true);
    setPhotoNotice(null);
    const res = await sendByokChatCompletion({
      keyMeta: found.keyMeta,
      rawApiKey: found.secret,
      history: [],
      userText: `El usuario subió una foto de su plato y lo describe así: "${photoDescription.trim()}".
Devolvé EXCLUSIVAMENTE JSON válido con una estimación aproximada (no exacta):
{"name":"Nombre corto del plato","calories":450,"proteinG":25,"carbsG":45,"fatG":15,"note":"Advertencia corta sobre margen de estimación"}`,
      systemInstructionOverride:
        'Sos un asistente nutricional prudente en FABRO. Devolvé estimaciones aproximadas realistas en JSON limpio sin inventar precisión clínica.',
    });
    setPhotoAiLoading(false);
    if (!res.ok) {
      setPhotoNotice(`No se pudo consultar tu clave BYOK: ${res.error}. Podés completar los valores manualmente.`);
      return;
    }
    try {
      const m = res.content.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as Record<string, unknown>;
        setPhotoEstName(String(parsed.name || photoDescription.slice(0, 50)));
        setPhotoEstKcal(String(Math.round(Number(parsed.calories) || 0)));
        setPhotoEstProt(String(Number(parsed.proteinG) || 0));
        setPhotoEstCarbs(String(Number(parsed.carbsG) || 0));
        setPhotoEstFat(String(Number(parsed.fatG) || 0));
        setPhotoNotice(
          `Estimación orientativa generada con tu clave (${found.keyMeta.providerName}). Revisá y corregí los valores antes de confirmar.`
        );
        return;
      }
    } catch {
      // fallback below
    }
    setPhotoNotice('Respuesta recibida. Completá o ajustá los campos numéricos manualmente antes de guardar.');
  };

  const handleSavePhotoMeal = () => {
    if (!photoEstName.trim() && !photoDescription.trim()) return;
    const entry: MealLogEntry = {
      id: `meal-photo-${Date.now()}`,
      date: selectedDate,
      time: nowTimeLabel(),
      slot: activeSlot,
      name: photoEstName.trim() || photoDescription.trim().slice(0, 60),
      quantityLabel: 'Porción estimada por foto (revisada)',
      calories: Math.max(0, Number(photoEstKcal) || 0),
      proteinG: Math.max(0, Number(photoEstProt) || 0),
      carbsG: Math.max(0, Number(photoEstCarbs) || 0),
      fatG: Math.max(0, Number(photoEstFat) || 0),
      source: 'estimacion-foto',
      photoDataUrl: photoDataUrl || undefined,
      isEstimate: true,
      notes: 'Estimación orientativa revisada por el usuario',
    };
    onUpdateState((prev) => ({
      ...prev,
      mealLogs: [entry, ...prev.mealLogs],
    }));
    setPhotoDataUrl(null);
    setPhotoDescription('');
    setPhotoEstName('');
    setPhotoEstKcal('');
    setPhotoEstProt('');
    setPhotoEstCarbs('');
    setPhotoEstFat('');
    notify('Plato con foto guardado en tu registro diario (marcado como estimación orientativa).');
  };

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recTitle.trim()) return;
    const recipe: WellnessRecipe = {
      id: `rec-${Date.now()}`,
      title: recTitle.trim(),
      mealSlot: recSlot,
      servings: 1,
      caloriesPerServing: Math.max(0, Number(recKcal) || 0),
      proteinG: Math.max(0, Number(recProt) || 0),
      carbsG: Math.max(0, Number(recCarbs) || 0),
      fatG: Math.max(0, Number(recFat) || 0),
      ingredients: recIngredients
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      steps: recSteps.trim(),
      favorite: true,
    };
    onUpdateState((prev) => ({ ...prev, recipes: [recipe, ...prev.recipes] }));
    setRecTitle('');
    setRecKcal('');
    setRecProt('');
    setRecCarbs('');
    setRecFat('');
    setRecIngredients('');
    setRecSteps('');
    notify('Receta guardada en tus preparaciones frecuentes.');
  };

  const calPct = Math.min(
    100,
    Math.round((dayTotals.calories / Math.max(1, state.nutritionPrefs.dailyCalorieGoal)) * 100)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#D97706]">
              02 · Nutrición y alimentación
            </p>
            <h2 className="font-display text-xl font-bold">
              Diario alimentario, macros, escáner y recetas
            </h2>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium">
            <span className="fabro-muted">Fecha:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 text-xs font-mono fabro-input"
            />
          </label>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1">
            <p className="fabro-muted">Calorías ({selectedDate})</p>
            <p className="font-mono text-lg font-bold tabular-nums">
              {dayTotals.calories} / {state.nutritionPrefs.dailyCalorieGoal} kcal
            </p>
            <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div className="h-full bg-[#D97706]" style={{ width: `${calPct}%` }} />
            </div>
          </div>
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1">
            <p className="fabro-muted">Proteínas</p>
            <p className="font-mono text-lg font-bold tabular-nums">
              {dayTotals.proteinG} / {state.nutritionPrefs.dailyProteinGoalG} g
            </p>
          </div>
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1">
            <p className="fabro-muted">Carbohidratos</p>
            <p className="font-mono text-lg font-bold tabular-nums">
              {dayTotals.carbsG} / {state.nutritionPrefs.dailyCarbsGoalG} g
            </p>
          </div>
          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1">
            <p className="fabro-muted">Grasas</p>
            <p className="font-mono text-lg font-bold tabular-nums">
              {dayTotals.fatG} / {state.nutritionPrefs.dailyFatGoalG} g
            </p>
          </div>
        </div>

        {/* Subtabs */}
        <div className="flex flex-wrap gap-1.5 border-t fabro-border pt-3 text-xs">
          {(
            [
              ['registro', 'Registro y buscador', Utensils],
              ['escaner-foto', 'Escáner de barras y foto', Barcode],
              ['recetas-plan', 'Recetas y plan semanal', ChefHat],
              ['compras-prefs', 'Lista de compras y metas', ShoppingCart],
              ['asistente-ia', 'Armador IA BYOK', Sparkles],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-semibold cursor-pointer transition-colors ${
                subTab === id
                  ? 'border-[#D97706] bg-[#D97706] text-white'
                  : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {feedback && (
          <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399] flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {feedback}
          </p>
        )}
      </section>

      {subTab === 'registro' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Food Search & Manual Form */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">Registrar alimento por comida</h3>
                <div className="flex flex-wrap gap-1">
                  {MEAL_SLOTS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSlot(s.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                        activeSlot === s.id
                          ? 'bg-[#D97706] text-white'
                          : 'fabro-surface-elevated fabro-muted'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 fabro-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={foodQuery}
                    onChange={(e) => setFoodQuery(e.target.value)}
                    placeholder="Buscar en base local (ej. avena, pollo, lentejas, huevo, palta)..."
                    className="w-full min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated pl-9 pr-3 text-xs fabro-input"
                  />
                </div>
                <label className="inline-flex items-center gap-1.5 text-xs fabro-muted shrink-0">
                  Porciones:
                  <input
                    type="number"
                    min={0.25}
                    max={10}
                    step={0.25}
                    value={portionMultiplier}
                    onChange={(e) => setPortionMultiplier(Math.max(0.25, Number(e.target.value) || 1))}
                    className="w-20 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 text-xs font-mono fabro-input"
                  />
                </label>
              </div>

              <div className="divide-y fabro-border max-h-72 overflow-y-auto text-xs">
                {filteredFoods.map((food) => (
                  <div key={food.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {food.name}
                        {food.brand ? ` · ${food.brand}` : ''}
                      </p>
                      <p className="text-[11px] fabro-muted font-mono tabular-nums">
                        {food.servingLabel} · {Math.round(food.calories * portionMultiplier)} kcal · P {Number((food.proteinG * portionMultiplier).toFixed(1))}g · C {Number((food.carbsG * portionMultiplier).toFixed(1))}g · G {Number((food.fatG * portionMultiplier).toFixed(1))}g
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => logFoodItem(food, portionMultiplier)}
                      className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-[#D97706] bg-[#D97706]/10 text-[#B45309] dark:text-[#FBBF24] px-2.5 text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Food / Manual Log */}
            <form
              onSubmit={handleAddManualMeal}
              className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs"
            >
              <h3 className="text-sm font-bold">Carga manual / alimento personalizado</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Nombre del alimento o plato"
                  required
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
                <input
                  type="text"
                  value={customServing}
                  onChange={(e) => setCustomServing(e.target.value)}
                  placeholder="Porción (ej. 1 plato, 100 g)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  type="number"
                  min={0}
                  value={customKcal}
                  onChange={(e) => setCustomKcal(e.target.value)}
                  placeholder="Calorías (kcal)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={customProt}
                  onChange={(e) => setCustomProt(e.target.value)}
                  placeholder="Proteína (g)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={customCarbs}
                  onChange={(e) => setCustomCarbs(e.target.value)}
                  placeholder="Carbos (g)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={customFat}
                  onChange={(e) => setCustomFat(e.target.value)}
                  placeholder="Grasas (g)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={saveAsCustomFood}
                    onChange={(e) => setSaveAsCustomFood(e.target.checked)}
                    className="accent-[#D97706]"
                  />
                  <span>Guardar también en mi biblioteca local para reutilizar</span>
                </label>
                <button
                  type="submit"
                  className="min-h-[38px] rounded-xl bg-[#D97706] text-white px-4 font-semibold cursor-pointer"
                >
                  Registrar en {MEAL_SLOTS.find((s) => s.id === activeSlot)?.label}
                </button>
              </div>
            </form>
          </div>

          {/* Right: Day Log by Slot + 7-day Chart */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
              <h3 className="text-sm font-bold">Comidas registradas ({selectedDate})</h3>
              {dayLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed fabro-border p-6 text-center text-xs fabro-muted">
                  Sin comidas registradas en esta fecha. Elegí un alimento a la izquierda o usá el escáner.
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {MEAL_SLOTS.map((slot) => {
                    const items = dayLogs.filter((l) => l.slot === slot.id);
                    if (items.length === 0) return null;
                    const slotKcal = items.reduce((a, b) => a + b.calories, 0);
                    return (
                      <div key={slot.id} className="space-y-1.5">
                        <div className="flex items-center justify-between font-semibold border-b fabro-border pb-1">
                          <span>{slot.label}</span>
                          <span className="font-mono tabular-nums fabro-muted">{slotKcal} kcal</span>
                        </div>
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-2 py-1"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {item.name}
                                {item.isEstimate ? ' (estimación)' : ''}
                              </p>
                              <p className="text-[11px] fabro-muted font-mono tabular-nums">
                                {item.quantityLabel} · {item.calories} kcal · P{item.proteinG} C{item.carbsG} G{item.fatG}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateState((prev) => ({
                                  ...prev,
                                  mealLogs: prev.mealLogs.filter((m) => m.id !== item.id),
                                }))
                              }
                              aria-label="Eliminar registro"
                              className="p-1 fabro-muted hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <WellnessBarChart
              title="Calorías de los últimos 7 días"
              data={last7Calories}
              accentColor="#D97706"
              unit="kcal"
              goalValue={state.nutritionPrefs.dailyCalorieGoal}
            />
          </div>
        </div>
      )}

      {subTab === 'escaner-foto' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          {/* Barcode Scanner */}
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Barcode className="w-4 h-4 text-[#D97706]" />
                Escáner de código de barras (Open Food Facts · $0)
              </h3>
              <p className="fabro-muted">
                Escaneá con la cámara del dispositivo o escribí el código EAN/UPC del envase. Si no existe en la base gratuita o estás sin internet, podés cargarlo manualmente sin inventar datos.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Ej. 7790895000997"
                className="flex-1 min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
              <button
                type="button"
                onClick={() => void handleBarcodeLookup()}
                disabled={barcodeLoading}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#D97706] text-white px-4 font-semibold cursor-pointer disabled:opacity-60"
              >
                {barcodeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Buscar
              </button>
              <button
                type="button"
                onClick={() => (cameraActive ? stopCamera() : void startBarcodeCamera())}
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 font-semibold cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                {cameraActive ? 'Cerrar cámara' : 'Usar cámara'}
              </button>
            </div>

            {cameraActive && (
              <div className="rounded-xl overflow-hidden border fabro-border bg-black">
                <video ref={videoRef} playsInline muted className="w-full max-h-56 object-cover" />
              </div>
            )}

            {cameraError && (
              <p className="text-amber-700 dark:text-amber-400">{cameraError}</p>
            )}

            {barcodeMsg && <p className="fabro-muted">{barcodeMsg}</p>}

            {barcodeResult && (
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-2.5">
                <p className="font-bold text-sm">
                  {barcodeResult.name}
                  {barcodeResult.brand ? ` · ${barcodeResult.brand}` : ''}
                </p>
                <p className="font-mono tabular-nums fabro-muted">
                  Por {barcodeResult.servingLabel}: {barcodeResult.calories} kcal · Proteína {barcodeResult.proteinG}g · Carbos {barcodeResult.carbsG}g · Grasas {barcodeResult.fatG}g
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      logFoodItem(barcodeResult, 1);
                      onUpdateState((prev) => ({
                        ...prev,
                        customFoods: prev.customFoods.some((f) => f.id === barcodeResult.id)
                          ? prev.customFoods
                          : [barcodeResult, ...prev.customFoods],
                      }));
                    }}
                    className="min-h-[38px] rounded-xl bg-[#059669] text-white px-4 font-semibold cursor-pointer"
                  >
                    Registrar en {MEAL_SLOTS.find((s) => s.id === activeSlot)?.label} y guardar offline
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Photo Food Estimation */}
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#0284C7]" />
                Registro con foto del plato (estimación transparente)
              </h3>
              <p className="text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Aviso honesto: el análisis visual o por descripción es únicamente una estimación aproximada. Siempre podés revisar y corregir los gramos y calorías manualmente antes de guardar.
                </span>
              </p>
            </div>

            <label className="block rounded-xl border border-dashed fabro-border p-4 text-center cursor-pointer hover:border-[#0284C7]">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <span className="font-semibold">Subir foto o tomar fotografía del plato</span>
              <span className="block fabro-muted mt-0.5">Se guarda solo en tu navegador (IndexedDB local).</span>
            </label>

            {photoDataUrl && (
              <img
                src={photoDataUrl}
                alt="Plato cargado"
                className="w-full max-h-44 object-cover rounded-xl border fabro-border"
              />
            )}

            <textarea
              rows={2}
              value={photoDescription}
              onChange={(e) => setPhotoDescription(e.target.value)}
              placeholder="Describí tu plato (ej. 1 pechuga a la plancha mediana, 1 taza de arroz integral y ensalada de tomate con aceite de oliva)..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated p-3 fabro-input"
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleEstimatePhotoWithByok()}
                disabled={photoAiLoading}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-[#4F46E5] bg-[#4F46E5]/10 text-[#4338CA] dark:text-[#A5B4FC] px-3.5 font-semibold cursor-pointer disabled:opacity-60"
              >
                {photoAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Estimar con mi IA BYOK (opcional)
              </button>
              <button
                type="button"
                onClick={() => navigateTo('ia', 'claves-byok')}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-muted cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Claves BYOK
              </button>
            </div>

            {photoNotice && <p className="fabro-muted">{photoNotice}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={photoEstName}
                onChange={(e) => setPhotoEstName(e.target.value)}
                placeholder="Nombre final del plato"
                className="sm:col-span-2 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="number"
                value={photoEstKcal}
                onChange={(e) => setPhotoEstKcal(e.target.value)}
                placeholder="Kcal estimadas"
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
              <input
                type="number"
                value={photoEstProt}
                onChange={(e) => setPhotoEstProt(e.target.value)}
                placeholder="Proteína (g)"
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
              <input
                type="number"
                value={photoEstCarbs}
                onChange={(e) => setPhotoEstCarbs(e.target.value)}
                placeholder="Carbos (g)"
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
              <input
                type="number"
                value={photoEstFat}
                onChange={(e) => setPhotoEstFat(e.target.value)}
                placeholder="Grasas (g)"
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
            </div>

            <button
              type="button"
              onClick={handleSavePhotoMeal}
              className="min-h-[40px] w-full rounded-xl bg-[#059669] text-white font-semibold cursor-pointer"
            >
              Confirmar y guardar en mi registro diario
            </button>
          </div>
        </div>
      )}

      {subTab === 'recetas-plan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          {/* Custom Recipes */}
          <div className="space-y-4">
            <form
              onSubmit={handleSaveRecipe}
              className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3"
            >
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ChefHat className="w-4 h-4 text-[#D97706]" />
                Crear receta / comida frecuente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={recTitle}
                  onChange={(e) => setRecTitle(e.target.value)}
                  placeholder="Nombre de la receta"
                  required
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
                <select
                  value={recSlot}
                  onChange={(e) => setRecSlot(e.target.value as MealSlot)}
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  value={recKcal}
                  onChange={(e) => setRecKcal(e.target.value)}
                  placeholder="Kcal"
                  className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
                />
                <input
                  type="number"
                  value={recProt}
                  onChange={(e) => setRecProt(e.target.value)}
                  placeholder="P (g)"
                  className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
                />
                <input
                  type="number"
                  value={recCarbs}
                  onChange={(e) => setRecCarbs(e.target.value)}
                  placeholder="C (g)"
                  className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
                />
                <input
                  type="number"
                  value={recFat}
                  onChange={(e) => setRecFat(e.target.value)}
                  placeholder="G (g)"
                  className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
                />
              </div>
              <textarea
                rows={2}
                value={recIngredients}
                onChange={(e) => setRecIngredients(e.target.value)}
                placeholder="Ingredientes (uno por línea)"
                className="w-full rounded-xl border fabro-border fabro-surface-elevated p-2.5 fabro-input"
              />
              <textarea
                rows={2}
                value={recSteps}
                onChange={(e) => setRecSteps(e.target.value)}
                placeholder="Preparación rápida..."
                className="w-full rounded-xl border fabro-border fabro-surface-elevated p-2.5 fabro-input"
              />
              <button
                type="submit"
                className="min-h-[38px] rounded-xl bg-[#D97706] text-white px-4 font-semibold cursor-pointer"
              >
                Guardar receta
              </button>
            </form>

            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5">
              <h3 className="text-sm font-bold">Mis recetas guardadas ({state.recipes.length})</h3>
              {state.recipes.length === 0 ? (
                <p className="fabro-muted">Todavía no guardaste recetas personalizadas.</p>
              ) : (
                <div className="divide-y fabro-border">
                  {state.recipes.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{r.title}</p>
                        <p className="text-[11px] fabro-muted font-mono tabular-nums">
                          {r.caloriesPerServing} kcal · P{r.proteinG}g C{r.carbsG}g G{r.fatG}g
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            logFoodItem(
                              {
                                id: r.id,
                                name: r.title,
                                servingLabel: '1 porción (receta)',
                                servingGrams: 100,
                                calories: r.caloriesPerServing,
                                proteinG: r.proteinG,
                                carbsG: r.carbsG,
                                fatG: r.fatG,
                                source: 'personalizado',
                              },
                              1,
                              r.mealSlot
                            )
                          }
                          className="min-h-[32px] rounded-lg border border-[#059669] px-2.5 font-semibold text-[#047857] dark:text-[#34D399] cursor-pointer"
                        >
                          Registrar hoy
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateState((prev) => ({
                              ...prev,
                              recipes: prev.recipes.filter((x) => x.id !== r.id),
                            }))
                          }
                          className="p-1.5 fabro-muted hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Weekly Meal Planner */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-[#059669]" />
              Planificador semanal de comidas
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <select
                value={planDay}
                onChange={(e) => setPlanDay(e.target.value as (typeof DAYS_OF_WEEK)[number])}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={planSlot}
                onChange={(e) => setPlanSlot(e.target.value as MealSlot)}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                {MEAL_SLOTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="col-span-2 sm:col-span-1 flex gap-1.5">
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="Comida planificada"
                  className="flex-1 min-w-0 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!planTitle.trim()) return;
                    onUpdateState((prev) => ({
                      ...prev,
                      weeklyMealPlan: [
                        ...prev.weeklyMealPlan,
                        {
                          id: `wp-${Date.now()}`,
                          dayOfWeek: planDay,
                          slot: planSlot,
                          mealTitle: planTitle.trim(),
                        },
                      ],
                    }));
                    setPlanTitle('');
                  }}
                  className="min-h-[38px] rounded-xl bg-[#059669] text-white px-3 font-semibold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {DAYS_OF_WEEK.map((day) => {
                const dayPlans = state.weeklyMealPlan.filter((p) => p.dayOfWeek === day);
                return (
                  <div
                    key={day}
                    className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1"
                  >
                    <p className="font-semibold">{day}</p>
                    {dayPlans.length === 0 ? (
                      <p className="text-[11px] fabro-muted">Sin comidas agendadas</p>
                    ) : (
                      dayPlans.map((p) => (
                        <div key={p.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span>
                            <strong className="capitalize">{p.slot}:</strong> {p.mealTitle}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateState((prev) => ({
                                ...prev,
                                weeklyMealPlan: prev.weeklyMealPlan.filter((x) => x.id !== p.id),
                              }))
                            }
                            className="fabro-muted hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'compras-prefs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          {/* Shopping list */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#059669]" />
              Lista de compras saludable
            </h3>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ej. Espinaca fresca, avena, huevos..."
                className="flex-1 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <select
                value={shopCategory}
                onChange={(e) => setShopCategory(e.target.value)}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                <option value="Verdulería">Verdulería</option>
                <option value="Proteínas">Proteínas</option>
                <option value="Almacén">Almacén</option>
                <option value="Lácteos / Bebidas">Lácteos / Bebidas</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!shopName.trim()) return;
                  onUpdateState((prev) => ({
                    ...prev,
                    shoppingList: [
                      {
                        id: `sh-${Date.now()}`,
                        name: shopName.trim(),
                        category: shopCategory,
                        checked: false,
                      },
                      ...prev.shoppingList,
                    ],
                  }));
                  setShopName('');
                }}
                className="min-h-[38px] rounded-xl bg-[#059669] text-white px-4 font-semibold cursor-pointer"
              >
                Sumar
              </button>
            </div>
            {state.shoppingList.length === 0 ? (
              <p className="fabro-muted">Tu lista de compras está vacía.</p>
            ) : (
              <div className="divide-y fabro-border">
                {state.shoppingList.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            shoppingList: prev.shoppingList.map((x) =>
                              x.id === item.id ? { ...x, checked: !x.checked } : x
                            ),
                          }))
                        }
                        className="accent-[#059669]"
                      />
                      <span className={item.checked ? 'line-through opacity-60' : ''}>
                        {item.name}
                      </span>
                      <span className="text-[10px] fabro-muted">· {item.category}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          shoppingList: prev.shoppingList.filter((x) => x.id !== item.id),
                        }))
                      }
                      className="fabro-muted hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Preferences & Daily Goals */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#D97706]" />
              Metas nutricionales y preferencias
            </h3>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="fabro-muted">Meta calórica diaria (kcal)</span>
                <input
                  type="number"
                  value={state.nutritionPrefs.dailyCalorieGoal}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      nutritionPrefs: {
                        ...prev.nutritionPrefs,
                        dailyCalorieGoal: Math.max(800, Number(e.target.value) || 2000),
                      },
                    }))
                  }
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">Meta proteína (g)</span>
                <input
                  type="number"
                  value={state.nutritionPrefs.dailyProteinGoalG}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      nutritionPrefs: {
                        ...prev.nutritionPrefs,
                        dailyProteinGoalG: Math.max(20, Number(e.target.value) || 100),
                      },
                    }))
                  }
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">Meta carbohidratos (g)</span>
                <input
                  type="number"
                  value={state.nutritionPrefs.dailyCarbsGoalG}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      nutritionPrefs: {
                        ...prev.nutritionPrefs,
                        dailyCarbsGoalG: Math.max(20, Number(e.target.value) || 200),
                      },
                    }))
                  }
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">Meta grasas (g)</span>
                <input
                  type="number"
                  value={state.nutritionPrefs.dailyFatGoalG}
                  onChange={(e) =>
                    onUpdateState((prev) => ({
                      ...prev,
                      nutritionPrefs: {
                        ...prev.nutritionPrefs,
                        dailyFatGoalG: Math.max(15, Number(e.target.value) || 65),
                      },
                    }))
                  }
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="fabro-muted">Estilo alimentario</span>
              <input
                type="text"
                value={state.nutritionPrefs.dietStyle}
                onChange={(e) =>
                  onUpdateState((prev) => ({
                    ...prev,
                    nutritionPrefs: { ...prev.nutritionPrefs, dietStyle: e.target.value },
                  }))
                }
                placeholder="Ej. Equilibrada, vegetariana, mediterránea..."
                className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
            <label className="block space-y-1">
              <span className="fabro-muted">Alergias o intolerancias</span>
              <input
                type="text"
                value={state.nutritionPrefs.allergies}
                onChange={(e) =>
                  onUpdateState((prev) => ({
                    ...prev,
                    nutritionPrefs: { ...prev.nutritionPrefs, allergies: e.target.value },
                  }))
                }
                placeholder="Ej. Sin TACC, lactosa, maní..."
                className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
            </label>
          </div>
        </div>
      )}

      {subTab === 'asistente-ia' && (
        <WellnessAiStudioPanel key="well-v2-dietas" initialTab="dietas" />
      )}
    </div>
  );
};
