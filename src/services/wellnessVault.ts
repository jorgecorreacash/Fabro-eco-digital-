import { jsPDF } from 'jspdf';
import { DEFAULT_WELLNESS_STATE } from '../data/wellnessCatalog';
import type {
  CoachDataPermissions,
  FoodCatalogItem,
  WellnessStateSnapshot,
} from '../types/wellness';
import { vaultGet, vaultSetIdbOnly } from './localVault';

const WELLNESS_VAULT_KEY = 'fabro_bienestar_workspace_v2';

export function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function nowTimeLabel(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function computeSleepDurationHours(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  if ([bh, bm, wh, wm].some((n) => Number.isNaN(n))) return 0;
  const bedMin = bh * 60 + bm;
  let wakeMin = wh * 60 + wm;
  if (wakeMin <= bedMin) wakeMin += 24 * 60;
  return Number(((wakeMin - bedMin) / 60).toFixed(1));
}

export function calculateOrientativeBmi(
  weightKg?: number,
  heightCm?: number
): { bmi: number; category: string } | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 50) return null;
  const hMeters = heightCm / 100;
  const bmi = Number((weightKg / (hMeters * hMeters)).toFixed(1));
  let category = 'Rango de referencia (18.5 – 24.9)';
  if (bmi < 18.5) category = 'Por debajo del rango de referencia (< 18.5)';
  else if (bmi >= 25 && bmi < 30) category = 'Sobrepeso orientativo (25.0 – 29.9)';
  else if (bmi >= 30) category = 'Obesidad orientativa (≥ 30.0)';
  return { bmi, category };
}

export async function loadWellnessState(): Promise<WellnessStateSnapshot> {
  const saved = await vaultGet<Partial<WellnessStateSnapshot> | null>(WELLNESS_VAULT_KEY, null);
  if (!saved || typeof saved !== 'object') {
    return DEFAULT_WELLNESS_STATE;
  }
  return {
    ...DEFAULT_WELLNESS_STATE,
    ...saved,
    nutritionPrefs: {
      ...DEFAULT_WELLNESS_STATE.nutritionPrefs,
      ...(saved.nutritionPrefs || {}),
    },
    sleepPrefs: {
      ...DEFAULT_WELLNESS_STATE.sleepPrefs,
      ...(saved.sleepPrefs || {}),
    },
    coachPermissions: {
      ...DEFAULT_WELLNESS_STATE.coachPermissions,
      ...(saved.coachPermissions || {}),
    },
    privacySettings: {
      ...DEFAULT_WELLNESS_STATE.privacySettings,
      ...(saved.privacySettings || {}),
      myDayWidgets: {
        ...DEFAULT_WELLNESS_STATE.privacySettings.myDayWidgets,
        ...(saved.privacySettings?.myDayWidgets || {}),
      },
    },
    customFoods: Array.isArray(saved.customFoods) ? saved.customFoods : [],
    mealLogs: Array.isArray(saved.mealLogs) ? saved.mealLogs : [],
    recipes: Array.isArray(saved.recipes) ? saved.recipes : [],
    weeklyMealPlan: Array.isArray(saved.weeklyMealPlan) ? saved.weeklyMealPlan : [],
    shoppingList: Array.isArray(saved.shoppingList) ? saved.shoppingList : [],
    customExercises: Array.isArray(saved.customExercises) ? saved.customExercises : [],
    customRoutines: Array.isArray(saved.customRoutines) ? saved.customRoutines : [],
    workoutLogs: Array.isArray(saved.workoutLogs) ? saved.workoutLogs : [],
    emotionEntries: Array.isArray(saved.emotionEntries) ? saved.emotionEntries : [],
    sleepLogs: Array.isArray(saved.sleepLogs) ? saved.sleepLogs : [],
    healthMetrics: Array.isArray(saved.healthMetrics) ? saved.healthMetrics : [],
    medicalAppointments: Array.isArray(saved.medicalAppointments) ? saved.medicalAppointments : [],
    vaccines: Array.isArray(saved.vaccines) ? saved.vaccines : [],
    medications: Array.isArray(saved.medications) ? saved.medications : [],
    medicalFiles: Array.isArray(saved.medicalFiles) ? saved.medicalFiles : [],
    personalGoals: Array.isArray(saved.personalGoals) ? saved.personalGoals : [],
    dailyHabits: Array.isArray(saved.dailyHabits) ? saved.dailyHabits : [],
    personalProjects: Array.isArray(saved.personalProjects) ? saved.personalProjects : [],
    achievements: Array.isArray(saved.achievements) ? saved.achievements : [],
    familyEvents: Array.isArray(saved.familyEvents) ? saved.familyEvents : [],
    natureOutings: Array.isArray(saved.natureOutings) ? saved.natureOutings : [],
    naturePlaces: Array.isArray(saved.naturePlaces) ? saved.naturePlaces : [],
    sustainableHabitsChecked: Array.isArray(saved.sustainableHabitsChecked)
      ? saved.sustainableHabitsChecked
      : [],
    challenges: Array.isArray(saved.challenges) ? saved.challenges : [],
    coachMessages: Array.isArray(saved.coachMessages) ? saved.coachMessages : [],
  };
}

export async function saveWellnessState(next: WellnessStateSnapshot): Promise<void> {
  await vaultSetIdbOnly(WELLNESS_VAULT_KEY, {
    ...next,
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Open Food Facts — Consulta pública gratuita ($0, sin clave API)
// ---------------------------------------------------------------------------
export async function lookupBarcodeOpenFoodFacts(
  barcodeRaw: string
): Promise<{ ok: boolean; item?: FoodCatalogItem; error?: string }> {
  const code = barcodeRaw.replace(/[^0-9]/g, '').trim();
  if (code.length < 6) {
    return { ok: false, error: 'Ingresá un código de barras numérico válido (al menos 6 dígitos).' };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      ok: false,
      error:
        'Sin conexión a internet. Podés registrar este producto manualmente y quedará guardado en tu base local.',
    };
  }
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
      { signal: controller.signal }
    );
    window.clearTimeout(timer);
    if (!resp.ok) {
      return {
        ok: false,
        error: 'No se pudo consultar Open Food Facts en este momento. Podés cargarlo manualmente.',
      };
    }
    const json = (await resp.json()) as {
      status?: number;
      product?: {
        product_name?: string;
        brands?: string;
        serving_size?: string;
        nutriments?: Record<string, number | undefined>;
      };
    };
    if (json.status !== 1 || !json.product) {
      return {
        ok: false,
        error: `Producto con código ${code} no encontrado en Open Food Facts. Podés cargarlo manualmente.`,
      };
    }
    const p = json.product;
    const n = p.nutriments || {};
    const kcal = Math.round(Number(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0));
    const protein = Number(Number(n.proteins_100g ?? 0).toFixed(1));
    const carbs = Number(Number(n.carbohydrates_100g ?? 0).toFixed(1));
    const fat = Number(Number(n.fat_100g ?? 0).toFixed(1));
    const fiber = Number(Number(n.fiber_100g ?? 0).toFixed(1));

    const item: FoodCatalogItem = {
      id: `off-${code}`,
      name: p.product_name?.trim() || `Producto ${code}`,
      brand: p.brands?.trim() || undefined,
      barcode: code,
      servingLabel: p.serving_size?.trim() ? `100 g (envase: ${p.serving_size.trim()})` : '100 g',
      servingGrams: 100,
      calories: Number.isFinite(kcal) ? kcal : 0,
      proteinG: Number.isFinite(protein) ? protein : 0,
      carbsG: Number.isFinite(carbs) ? carbs : 0,
      fatG: Number.isFinite(fat) ? fat : 0,
      fiberG: Number.isFinite(fiber) ? fiber : 0,
      source: 'open-food-facts',
    };
    return { ok: true, item };
  } catch {
    return {
      ok: false,
      error:
        'Tiempo de espera agotado al consultar Open Food Facts. Podés ingresar los valores del envase manualmente.',
    };
  }
}

// ---------------------------------------------------------------------------
// Exportación e importación real (JSON, CSV, PDF $0 en cliente)
// ---------------------------------------------------------------------------
export function exportWellnessBackupJson(state: WellnessStateSnapshot): string {
  return JSON.stringify(
    {
      app: 'FABRO BIENESTAR',
      exportedAt: new Date().toISOString(),
      version: 2,
      data: state,
    },
    null,
    2
  );
}

export function parseWellnessBackupJson(raw: string): WellnessStateSnapshot | null {
  try {
    const parsed = JSON.parse(raw) as { data?: Partial<WellnessStateSnapshot> } | Partial<WellnessStateSnapshot>;
    const candidate =
      parsed && typeof parsed === 'object' && 'data' in parsed && parsed.data
        ? parsed.data
        : (parsed as Partial<WellnessStateSnapshot>);
    if (!candidate || typeof candidate !== 'object') return null;
    if (!Array.isArray(candidate.mealLogs) && !Array.isArray(candidate.workoutLogs) && !Array.isArray(candidate.sleepLogs)) {
      return null;
    }
    return {
      ...DEFAULT_WELLNESS_STATE,
      ...candidate,
      version: 2,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function exportWellnessCsv(state: WellnessStateSnapshot): string {
  const rows: string[][] = [
    ['Tipo', 'Fecha', 'Detalle', 'Valor principal', 'Notas'],
    ...state.mealLogs.map((m) => [
      'Nutrición',
      m.date,
      `${m.slot} - ${m.name}`,
      `${m.calories} kcal (P:${m.proteinG}g C:${m.carbsG}g G:${m.fatG}g)`,
      m.notes || '',
    ]),
    ...state.workoutLogs.map((w) => [
      'Entrenamiento',
      w.date,
      `${w.routineName} (${w.category})`,
      `${w.durationMin} min · RPE ${w.effortRpe}/10`,
      w.notes || '',
    ]),
    ...state.sleepLogs.map((s) => [
      'Sueño',
      s.date,
      `${s.bedtime} a ${s.wakeTime}`,
      `${s.durationHours} h · Calidad ${s.quality}/5`,
      s.notes || '',
    ]),
    ...state.healthMetrics.map((h) => [
      'Salud',
      h.date,
      'Indicadores personales',
      [
        h.weightKg ? `Peso ${h.weightKg} kg` : null,
        h.systolicBp && h.diastolicBp ? `PA ${h.systolicBp}/${h.diastolicBp}` : null,
        h.heartRateBpm ? `FC ${h.heartRateBpm} lpm` : null,
      ]
        .filter(Boolean)
        .join(' | '),
      h.notes || '',
    ]),
  ];

  return rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadWellnessPdfReport(
  state: WellnessStateSnapshot,
  userName: string,
  includePrivateEmotional = false
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 44;
  let y = 52;

  const ensureSpace = (needed = 28) => {
    if (y + needed > 780) {
      doc.addPage();
      y = 52;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('FABRO BIENESTAR — Historial Personal', marginX, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `Titular: ${userName || 'Usuario FABRO'} | Emitido: ${new Date().toLocaleString('es-AR')}`,
    marginX,
    y
  );
  y += 14;
  doc.text(
    'Aviso: Este reporte compila únicamente registros declarados por el usuario. No constituye diagnóstico médico.',
    marginX,
    y
  );
  y += 22;

  const addSection = (title: string, lines: string[]) => {
    ensureSpace(44);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, marginX, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    if (lines.length === 0) {
      doc.text('Sin registros cargados en esta sección.', marginX + 8, y);
      y += 16;
      return;
    }
    for (const line of lines.slice(0, 25)) {
      const wrapped = doc.splitTextToSize(`• ${line}`, 500);
      ensureSpace(wrapped.length * 12 + 4);
      doc.text(wrapped, marginX + 8, y);
      y += wrapped.length * 12 + 4;
    }
    y += 8;
  };

  addSection(
    `1. Indicadores de salud (${state.healthMetrics.length})`,
    state.healthMetrics.map((h) => {
      const bmi = calculateOrientativeBmi(h.weightKg, h.heightCm);
      return `${h.date}: ${[
        h.weightKg ? `Peso ${h.weightKg} kg` : null,
        h.heightCm ? `Altura ${h.heightCm} cm` : null,
        bmi ? `IMC orientativo ${bmi.bmi}` : null,
        h.systolicBp && h.diastolicBp ? `Presión ${h.systolicBp}/${h.diastolicBp} mmHg` : null,
        h.heartRateBpm ? `Pulso ${h.heartRateBpm} lpm` : null,
        h.temperatureC ? `Temp ${h.temperatureC} °C` : null,
      ]
        .filter(Boolean)
        .join(' · ')}`;
    })
  );

  addSection(
    `2. Medicación y vacunas (${state.medications.length} med. / ${state.vaccines.length} vac.)`,
    [
      ...state.medications.map(
        (m) => `Medicación: ${m.name} (${m.dosage}) · ${m.frequency} ${m.scheduleTime} [${m.active ? 'Activa' : 'Inactiva'}]`
      ),
      ...state.vaccines.map((v) => `Vacuna: ${v.name} · ${v.dose} (${v.date})`),
    ]
  );

  addSection(
    `3. Nutrición registrada (${state.mealLogs.length} comidas)`,
    state.mealLogs.map(
      (m) => `${m.date} ${m.time} [${m.slot}] ${m.name}: ${m.calories} kcal (P ${m.proteinG}g · C ${m.carbsG}g · G ${m.fatG}g)`
    )
  );

  addSection(
    `4. Actividad física (${state.workoutLogs.length} sesiones)`,
    state.workoutLogs.map(
      (w) => `${w.date}: ${w.routineName} (${w.category}) — ${w.durationMin} min, esfuerzo ${w.effortRpe}/10`
    )
  );

  addSection(
    `5. Sueño y descanso (${state.sleepLogs.length} registros)`,
    state.sleepLogs.map(
      (s) => `${s.date}: ${s.bedtime}–${s.wakeTime} (${s.durationHours} h) · Calidad ${s.quality}/5 · Despertares: ${s.awakenings}`
    )
  );

  addSection(
    `6. Metas y hábitos (${state.personalGoals.length} metas / ${state.dailyHabits.length} hábitos)`,
    [
      ...state.personalGoals.map(
        (g) => `Meta (${g.horizon}): ${g.title} — ${g.currentValue}/${g.targetValue} ${g.unit}`
      ),
      ...state.dailyHabits.map(
        (h) => `Hábito: ${h.title} — ${h.completedDates.length} días registrados`
      ),
    ]
  );

  if (includePrivateEmotional) {
    addSection(
      `7. Diario emocional privado (${state.emotionEntries.length})`,
      state.emotionEntries.map(
        (e) => `${e.date} [${e.kind}] Ánimo ${e.moodScore}/10 — ${e.title}: ${e.content.slice(0, 140)}`
      )
    );
  }

  doc.save(`fabro-bienestar-historial-${todayIsoDate()}.pdf`);
}

// ---------------------------------------------------------------------------
// Motor de sonido ambiental 100% offline (Web Audio API) para FABRO RESPIRA
// ---------------------------------------------------------------------------
export type AmbientSoundKind = 'rain' | 'brown' | 'ocean' | 'harmonic';

class WellnessAmbientAudioController {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private stopFns: Array<() => void> = [];
  private activeKind: AmbientSoundKind | null = null;

  public start(kind: AmbientSoundKind, volume = 0.25): boolean {
    this.stop();
    if (typeof window === 'undefined') return false;
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = Math.min(0.6, Math.max(0.02, volume));
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.gainNode = master;
    this.activeKind = kind;

    if (kind === 'harmonic') {
      const freqs = [174, 261.63, 349.23];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        g.gain.value = idx === 0 ? 0.32 : 0.16;
        osc.connect(g);
        g.connect(master);
        osc.start();
        this.stopFns.push(() => {
          try {
            osc.stop();
          } catch {
            // ignore
          }
        });
      });
      return true;
    }

    // Filtered noise buffer for rain, brown noise, or ocean waves
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      if (kind === 'brown' || kind === 'ocean') {
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.2;
      } else {
        data[i] = white * 0.45;
      }
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = kind === 'rain' ? 'bandpass' : 'lowpass';
    filter.frequency.value = kind === 'rain' ? 1100 : kind === 'ocean' ? 420 : 320;
    filter.Q.value = kind === 'rain' ? 0.7 : 0.9;

    noise.connect(filter);

    if (kind === 'ocean') {
      const waveGain = ctx.createGain();
      waveGain.gain.value = 0.65;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.12; // ~8.3s gentle wave cycle
      lfoGain.gain.value = 0.32;
      lfo.connect(lfoGain);
      lfoGain.connect(waveGain.gain);
      filter.connect(waveGain);
      waveGain.connect(master);
      lfo.start();
      this.stopFns.push(() => {
        try {
          lfo.stop();
        } catch {
          // ignore
        }
      });
    } else {
      filter.connect(master);
    }

    noise.start();
    this.stopFns.push(() => {
      try {
        noise.stop();
      } catch {
        // ignore
      }
    });
    return true;
  }

  public setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.min(0.6, Math.max(0.02, volume));
    }
  }

  public stop(): void {
    this.stopFns.forEach((fn) => fn());
    this.stopFns = [];
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.gainNode = null;
    this.activeKind = null;
  }

  public getActiveKind(): AmbientSoundKind | null {
    return this.activeKind;
  }
}

export const wellnessAmbientAudio = new WellnessAmbientAudioController();

// ---------------------------------------------------------------------------
// Motor analítico local (offline, honesto y verificable) para FABRO COACH
// ---------------------------------------------------------------------------
export function buildAuthorizedCoachContext(
  state: WellnessStateSnapshot,
  permissions: CoachDataPermissions,
  extra: { moodLogsCount: number; waterMlToday?: number }
): { authorizedCount: number; summaryLines: string[] } {
  const lines: string[] = [];
  let authorizedCount = 0;
  const today = todayIsoDate();

  if (permissions.nutrition) {
    authorizedCount += 1;
    const todayMeals = state.mealLogs.filter((m) => m.date === today);
    const todayKcal = todayMeals.reduce((acc, m) => acc + m.calories, 0);
    const todayProt = Math.round(todayMeals.reduce((acc, m) => acc + m.proteinG, 0));
    lines.push(
      `[Datos registrados · Nutrición] Hoy: ${todayMeals.length} comidas (${todayKcal} kcal de meta ${state.nutritionPrefs.dailyCalorieGoal} kcal, proteína ${todayProt} g). Total histórico: ${state.mealLogs.length} registros.`
    );
  }

  if (permissions.fitness) {
    authorizedCount += 1;
    const last7 = state.workoutLogs.slice(0, 7);
    const totalMin = last7.reduce((acc, w) => acc + w.durationMin, 0);
    lines.push(
      `[Datos registrados · Actividad física] Sesiones totales: ${state.workoutLogs.length}. Últimas ${last7.length} sesiones suman ${totalMin} min. Rutinas guardadas: ${state.customRoutines.length}.`
    );
  }

  if (permissions.sleep) {
    authorizedCount += 1;
    const last7 = state.sleepLogs.slice(0, 7);
    const avg =
      last7.length > 0
        ? (last7.reduce((a, b) => a + b.durationHours, 0) / last7.length).toFixed(1)
        : null;
    lines.push(
      avg
        ? `[Datos registrados · Sueño] Promedio de las últimas ${last7.length} noches: ${avg} h (meta ${state.sleepPrefs.targetHours} h).`
        : `[Datos registrados · Sueño] Aún no hay noches registradas (meta configurada: ${state.sleepPrefs.targetHours} h).`
    );
  }

  if (permissions.habitsAndGoals) {
    authorizedCount += 1;
    const pendingGoals = state.personalGoals.filter((g) => !g.completed);
    const doneTodayHabits = state.dailyHabits.filter((h) => h.completedDates.includes(today)).length;
    lines.push(
      `[Datos registrados · Hábitos y metas] Hábitos activos: ${state.dailyHabits.length} (${doneTodayHabits} cumplidos hoy). Metas pendientes: ${pendingGoals.length}. Desafíos activos: ${state.challenges.filter((c) => c.active).length}.`
    );
  }

  if (permissions.mood) {
    authorizedCount += 1;
    const recent = state.emotionEntries.slice(0, 7);
    const avgMood =
      recent.length > 0
        ? (recent.reduce((a, b) => a + b.moodScore, 0) / recent.length).toFixed(1)
        : null;
    lines.push(
      avgMood
        ? `[Datos registrados · Ánimo] Promedio reciente (${recent.length} entradas): ${avgMood}/10. Registros rápidos adicionales: ${extra.moodLogsCount}.`
        : `[Datos registrados · Ánimo] Sin entradas recientes en el diario emocional (registros rápidos previos: ${extra.moodLogsCount}).`
    );
  }

  if (permissions.healthMetrics) {
    authorizedCount += 1;
    const latest = state.healthMetrics[0];
    if (latest) {
      const bmi = calculateOrientativeBmi(latest.weightKg, latest.heightCm);
      lines.push(
        `[Datos registrados · Salud] Último registro (${latest.date}): ${[
          latest.weightKg ? `Peso ${latest.weightKg} kg` : null,
          bmi ? `IMC orientativo ${bmi.bmi}` : null,
          latest.systolicBp && latest.diastolicBp
            ? `Presión ${latest.systolicBp}/${latest.diastolicBp}`
            : null,
        ]
          .filter(Boolean)
          .join(', ')}. Turnos pendientes: ${state.medicalAppointments.filter((a) => !a.completed).length}.`
      );
    } else {
      lines.push('[Datos registrados · Salud] Aún no cargaste indicadores de salud.');
    }
  }

  if (typeof extra.waterMlToday === 'number' && extra.waterMlToday > 0) {
    lines.push(`[Datos registrados · Hidratación] Agua declarada hoy: ${extra.waterMlToday} ml.`);
  }

  return { authorizedCount, summaryLines: lines };
}

export function generateLocalCoachReply(
  prompt: string,
  state: WellnessStateSnapshot,
  permissions: CoachDataPermissions,
  extra: { moodLogsCount: number; waterMlToday?: number }
): string {
  const { authorizedCount, summaryLines } = buildAuthorizedCoachContext(state, permissions, extra);
  const q = prompt.toLowerCase();

  const sections: string[] = [];

  if (authorizedCount === 0) {
    sections.push(
      '[Datos registrados]\nNo autorizaste ningún módulo todavía, por lo que no leí tus registros personales (tu privacidad queda intacta). Podés activar los permisos puntuales arriba si querés que analice tus números reales.'
    );
  } else {
    sections.push(`[Datos registrados]\n${summaryLines.map((l) => `• ${l}`).join('\n')}`);
  }

  if (q.includes('imc') || q.includes('peso') || q.includes('presion') || q.includes('salud')) {
    sections.push(
      '[Estimación orientativa]\nEl IMC es solo una referencia poblacional peso/altura² y no distingue masa muscular de masa grasa ni reemplaza una evaluación clínica.'
    );
  } else if (q.includes('caloria') || q.includes('nutri') || q.includes('comida') || q.includes('macro')) {
    sections.push(
      '[Estimación orientativa]\nLos valores nutricionales dependen del tamaño real de la porción y la cocción. Priorizá regularidad semanal por encima de la exactitud perfecta en una sola comida.'
    );
  } else if (q.includes('sueno') || q.includes('dormir') || q.includes('descanso')) {
    sections.push(
      '[Estimación orientativa]\nLa duración se calcula según la hora de acostarse y levantarse que declarás; sin sensores externos no se miden fases de sueño profundo ni REM.'
    );
  }

  const suggestions: string[] = [];
  if (permissions.nutrition && state.mealLogs.filter((m) => m.date === todayIsoDate()).length === 0) {
    suggestions.push('Registrá tu primera comida del día en «2. Nutrición» para empezar a ver tu balance real.');
  }
  if (permissions.fitness && state.workoutLogs.length === 0) {
    suggestions.push('Elegí una rutina corta de 15 min en «3. Actividad física» y marcá tu primera sesión.');
  }
  if (permissions.habitsAndGoals && state.personalGoals.some((g) => !g.completed)) {
    const nextGoal = state.personalGoals.find((g) => !g.completed);
    if (nextGoal) {
      suggestions.push(`Tenés pendiente la meta «${nextGoal.title}» (${nextGoal.currentValue}/${nextGoal.targetValue} ${nextGoal.unit}). Dividila en un paso de 10 minutos hoy.`);
    }
  }
  if (suggestions.length === 0) {
    suggestions.push(
      'Definí 1 prioridad física (movimiento o hidratación) y 1 pausa breve de respiración en FABRO RESPIRA para sostener el ritmo sin sobrecarga.'
    );
  }

  sections.push(
    `[Sugerencias generales]\n${suggestions.map((s) => `• ${s}`).join('\n')}\n\nNota importante: FABRO COACH ofrece orientación educativa y organización personal. No realiza diagnósticos médicos ni reemplaza profesionales de la salud.`
  );

  return sections.join('\n\n');
}
