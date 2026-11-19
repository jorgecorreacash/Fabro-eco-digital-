import type {
  ByokProviderKey,
  WellnessAiEngine,
  WellnessDietPlanItem,
  WellnessEquipmentId,
  WellnessGoalId,
  WellnessHabitPlanItem,
  WellnessLevelId,
  WellnessPhysicalProfile,
  WellnessStoicSessionItem,
  WellnessWorkoutPlanItem,
} from '../types/ecosystem';
import { sendByokChatCompletion } from './byokChatClient';

export const DEFAULT_WELLNESS_PHYSICAL_PROFILE: WellnessPhysicalProfile = {
  age: '',
  goal: 'movilidad-salud',
  level: 'intermedio',
  dietPreferences: '',
  equipment: 'sin-equipo',
};

export const WELLNESS_GOAL_LABELS: Record<WellnessGoalId, string> = {
  'ganar-musculo': 'Ganar masa muscular',
  'bajar-grasa': 'Bajar grasa corporal',
  resistencia: 'Resistencia y energía',
  'movilidad-salud': 'Movilidad y salud general',
  'manejo-estres': 'Manejo del estrés y calma',
};

export const WELLNESS_LEVEL_LABELS: Record<WellnessLevelId, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
};

export const WELLNESS_EQUIPMENT_LABELS: Record<WellnessEquipmentId, string> = {
  'sin-equipo': 'En casa sin equipo',
  'mancuernas-bandas': 'Mancuernas / Bandas',
  gimnasio: 'Gimnasio completo',
};

export function findByokKeyForWellnessEngine(
  byokKeys: ByokProviderKey[],
  getByokSecret: (id: string) => string,
  engine: WellnessAiEngine
): { keyMeta: ByokProviderKey; secret: string } | null {
  const matcher = (k: ByokProviderKey) => {
    const name = k.providerName.toLowerCase();
    if (engine === 'gemini') {
      return k.endpointFormat === 'gemini' || name.includes('gemini') || name.includes('google');
    }
    return (
      (k.endpointFormat === 'openai-compatible' &&
        (name.includes('openai') || name.includes('chatgpt') || name.includes('gpt'))) ||
      name.includes('chatgpt') ||
      name.includes('openai')
    );
  };

  const candidates = byokKeys.filter(matcher);
  for (const keyMeta of candidates) {
    const secret = getByokSecret(keyMeta.id).trim();
    if (secret) {
      return { keyMeta, secret };
    }
  }
  return null;
}

export function buildPhysicalProfileContext(p: WellnessPhysicalProfile): string {
  const parts = [
    p.age.trim() ? `Edad: ${p.age.trim()} años` : null,
    `Objetivo principal: ${WELLNESS_GOAL_LABELS[p.goal]}`,
    `Nivel físico: ${WELLNESS_LEVEL_LABELS[p.level]}`,
    `Equipamiento disponible: ${WELLNESS_EQUIPMENT_LABELS[p.equipment]}`,
    p.dietPreferences.trim()
      ? `Preferencias / alergias alimentarias: ${p.dietPreferences.trim()}`
      : 'Preferencias alimentarias: sin restricciones declaradas',
  ].filter(Boolean);
  return parts.join(' | ');
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw.trim();
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function nowLabel(): string {
  return new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ------------------------------------------------------------------
// Plantillas Base Offline (Para que la pantalla nunca quede vacía sin clave)
// ------------------------------------------------------------------
export function getOfflineBaseDietPlan(
  profile: WellnessPhysicalProfile,
  mode: 'semanal' | 'heladera',
  userInput: string
): WellnessDietPlanItem {
  const goalName = WELLNESS_GOAL_LABELS[profile.goal];
  return {
    id: `diet-off-${Date.now()}`,
    title:
      mode === 'heladera'
        ? 'Plan práctico con lo que tenés (Plantilla base offline)'
        : `Menú equilibrado para ${goalName} (Plantilla base offline)`,
    mode,
    providerLabel: 'Plantilla base offline (sin consumo API)',
    createdAt: nowLabel(),
    summary:
      mode === 'heladera' && userInput.trim()
        ? `Base adaptable a tus ingredientes (${userInput.trim().slice(0, 90)}). Conectá tu clave BYOK de Gemini o ChatGPT para generar recetas exactas al instante.`
        : `Distribución orientativa de energía, proteína y fibra pensada para "${goalName}".`,
    meals: {
      desayuno:
        'Avena o pan integral con 2 huevos revueltos o yogur natural + 1 fruta fresca y té o café sin exceso de azúcar.',
      almuerzo:
        'Plato completo: 1/2 vegetales coloridos (ensalada o salteado), 1/4 proteína magra (pollo, legumbres, pescado o tofu) y 1/4 carbohidrato complejo (arroz integral, papa o quinoa).',
      merienda:
        'Un puñado de frutos secos + 1 fruta o tostada integral con queso untable / palta.',
      cena:
        'Omelette de vegetales o sopa tibia + porción liviana de proteína y hojas verdes para favorecer el descanso.',
    },
    shoppingList: [
      { id: 'sh-1', item: 'Huevos frescos (1 docena)', checked: false },
      { id: 'sh-2', item: 'Avena arrollada o pan integral', checked: false },
      { id: 'sh-3', item: 'Verduras de estación (espinaca, tomate, zanahoria, calabaza)', checked: false },
      { id: 'sh-4', item: 'Proteína principal (pollo, legumbres, atún o tofu)', checked: false },
      { id: 'sh-5', item: 'Frutas variadas y frutos secos naturales', checked: false },
      { id: 'sh-6', item: 'Aceite de oliva y limón para condimentar', checked: false },
    ],
    hydrationTip:
      'Objetivo sugerido: 2 a 2,5 litros de agua repartidos en 8 vasos a lo largo del día (un vaso al despertar y otro antes de cada comida).',
  };
}

export function getOfflineBaseWorkoutPlan(
  profile: WellnessPhysicalProfile,
  durationLabel: string,
  focusLabel: string
): WellnessWorkoutPlanItem {
  const equip = WELLNESS_EQUIPMENT_LABELS[profile.equipment];
  return {
    id: `wrk-off-${Date.now()}`,
    title: `Rutina ${focusLabel || 'Full Body'} · ${durationLabel} (Plantilla base offline)`,
    providerLabel: 'Plantilla base offline (sin consumo API)',
    durationLabel,
    equipmentLabel: equip,
    focusLabel: focusLabel || 'Cuerpo completo',
    createdAt: nowLabel(),
    daysSummary: `Adaptada a nivel ${WELLNESS_LEVEL_LABELS[profile.level]} (${equip}). Conectá tu clave BYOK de Gemini o ChatGPT para rutinas 100% personalizadas por día.`,
    exercises: [
      {
        id: 'ex-1',
        name: 'Movilidad articular + Sentadillas controladas',
        sets: 3,
        reps: '12 reps',
        restSec: 45,
        workSec: 40,
        technique: 'Pecho erguido, rodillas alineadas con la punta de los pies y bajada controlada en 2 segundos.',
      },
      {
        id: 'ex-2',
        name: 'Flexiones (en piso o inclinadas)',
        sets: 3,
        reps: '10 a 12 reps',
        restSec: 45,
        workSec: 35,
        technique: 'Cuerpo en línea recta activando abdomen; codos a 45° respecto al torso.',
      },
      {
        id: 'ex-3',
        name: 'Zancadas alternas o Puente de glúteos',
        sets: 3,
        reps: '10 por lado',
        restSec: 45,
        workSec: 40,
        technique: 'Empuje firme desde el talón delantero manteniendo el torso estable.',
      },
      {
        id: 'ex-4',
        name: 'Plancha abdominal isométrica',
        sets: 3,
        reps: '30 a 45 seg',
        restSec: 35,
        workSec: 35,
        technique: 'Hombros sobre codos, glúteos activos y respiración constante sin arquear la zona lumbar.',
      },
    ],
  };
}

export function getOfflineBaseHabitPlan(
  category: WellnessHabitPlanItem['category']
): WellnessHabitPlanItem {
  const presets: Record<
    WellnessHabitPlanItem['category'],
    { title: string; summary: string; habits: Array<{ title: string; scheduleHint: string }> }
  > = {
    manana: {
      title: 'Ritual de Mañana con Claridad (Base offline)',
      summary: 'Secuencia de 20 minutos para arrancar con energía sin revisar redes apenas despertás.',
      habits: [
        { title: 'Tomar 1 vaso grande de agua al despertar', scheduleHint: '07:30 · 5 min' },
        { title: 'Recibir luz natural y estirar espalda/cuello', scheduleHint: '07:40 · 10 min' },
        { title: 'Definir las 3 prioridades del día antes de abrir el chat', scheduleHint: '08:00 · 5 min' },
      ],
    },
    sueno: {
      title: 'Protocolo de Descanso Nocturno (Base offline)',
      summary: 'Baja la activación mental 45 minutos antes de dormir para mejorar sueño profundo.',
      habits: [
        { title: 'Reducir brillo de pantallas y activar modo cálido', scheduleHint: '22:15 · Diario' },
        { title: 'Vaciar pendientes en la Bandeja Rápida de FABRO', scheduleHint: '22:30 · 5 min' },
        { title: '4 ciclos de respiración 4-7-8 en cama', scheduleHint: '22:45 · 5 min' },
      ],
    },
    'pausas-estudio': {
      title: 'Pausas Activas entre Bloques de Estudio (Base offline)',
      summary: 'Mantené la atención alta cada 50 minutos sin agotamiento visual ni cervical.',
      habits: [
        { title: 'Regla 20-20-20 visual + 10 rotaciones de hombros', scheduleHint: 'Cada 50 min' },
        { title: 'Caminar 3 minutos lejos del escritorio y tomar agua', scheduleHint: 'Entre Pomodoros' },
        { title: 'Respiración cuadrada (4-4-4-4) antes de volver a leer', scheduleHint: '2 min' },
      ],
    },
    antiprocrastinacion: {
      title: 'Desbloqueo Anti-Procrastinación (Base offline)',
      summary: 'Reduce la fricción inicial convirtiendo tareas intimidantes en un arranque de 5 minutos.',
      habits: [
        { title: 'Regla de los 5 minutos: abrir el documento y escribir solo 3 líneas', scheduleHint: 'Al iniciar bloque' },
        { title: 'Dejar el celular fuera del alcance por 1 bloque de 25 min', scheduleHint: 'Bloque enfoque' },
        { title: 'Celebrar el primer avance tachando la subtarea en el Organizador', scheduleHint: 'Al cerrar bloque' },
      ],
    },
  };
  const chosen = presets[category];
  return {
    id: `hab-off-${Date.now()}`,
    title: chosen.title,
    category,
    providerLabel: 'Plantilla base offline (sin consumo API)',
    createdAt: nowLabel(),
    summary: chosen.summary,
    habits: chosen.habits.map((h, i) => ({
      id: `hs-${Date.now()}-${i}`,
      title: h.title,
      scheduleHint: h.scheduleHint,
      addedToOrganizer: false,
    })),
  };
}

export function getOfflineStoicSession(moodFeeling: string): WellnessStoicSessionItem {
  return {
    id: `stoic-off-${Date.now()}`,
    createdAt: nowLabel(),
    moodFeeling: moodFeeling.trim() || 'Buscando calma y claridad mental',
    providerLabel: 'Guía base estoica offline',
    reframeTitle: 'Dicotomía del Control (Epicteto)',
    guidance:
      'Cuando la mente se acelera, suele estar luchando contra cosas que están fuera de tu control inmediato. Separar lo que depende de tu acción hoy de lo que no depende de vos devuelve serenidad al instante.',
    calmExercise:
      '1) Inhalá suave en 4 segundos, sostené 4 y exhalá en 6 (repetí 4 veces). 2) Nombrá en una frase lo único que sí está bajo tu control en la próxima hora. 3) Hacé ese primer paso pequeño sin exigirte perfección.',
    journalPrompt:
      'Si miraras este momento desde dentro de un año, ¿qué gesto amable y sereno agradecerías haber tenido hoy contigo mismo?',
  };
}

// ------------------------------------------------------------------
// Generadores Reales vía BYOK (Gemini / ChatGPT)
// ------------------------------------------------------------------
export async function generateDietPlanWithByok(params: {
  keyMeta: ByokProviderKey;
  rawApiKey: string;
  profile: WellnessPhysicalProfile;
  mode: 'semanal' | 'heladera';
  userRequest: string;
}): Promise<{ ok: boolean; plan?: WellnessDietPlanItem; error?: string }> {
  const { keyMeta, rawApiKey, profile, mode, userRequest } = params;
  const ctx = buildPhysicalProfileContext(profile);

  const prompt = `Contexto del usuario (100% local): ${ctx}
Modo solicitado: ${
    mode === 'heladera'
      ? '¿Qué cocino hoy con los ingredientes que tengo en mi heladera/alacena?'
      : 'Plan nutricional práctico y equilibrado'
  }
Solicitud específica: ${userRequest.trim() || 'Armá un menú práctico, económico y equilibrado para hoy.'}

Devolvé EXCLUSIVAMENTE un JSON válido con esta estructura exacta (sin texto extra fuera del JSON):
{
  "title": "Título claro del plan",
  "summary": "Resumen breve en 2 líneas",
  "meals": {
    "desayuno": "Propuesta concreta de desayuno",
    "almuerzo": "Propuesta concreta de almuerzo",
    "merienda": "Propuesta concreta de merienda",
    "cena": "Propuesta concreta de cena"
  },
  "shoppingList": ["Ingrediente 1", "Ingrediente 2", "Ingrediente 3", "Ingrediente 4", "Ingrediente 5", "Ingrediente 6"],
  "hydrationTip": "Recordatorio práctico de hidratación diaria"
}`;

  const res = await sendByokChatCompletion({
    keyMeta,
    rawApiKey,
    history: [],
    userText: prompt,
    systemInstructionOverride:
      'Sos un asistente de nutrición práctica y hábitos saludables dentro de FABRO. Respondé siempre en español rioplatense/neutro claro, orientativo (nunca diagnóstico médico), devolviendo JSON limpio y realista.',
  });

  if (!res.ok) return { ok: false, error: res.error };

  const parsed = extractJsonObject(res.content);
  const providerLabel = `${keyMeta.providerName} · ${keyMeta.modelName}`;

  if (parsed && parsed.meals && typeof parsed.meals === 'object') {
    const mealsObj = parsed.meals as Record<string, unknown>;
    const rawList = Array.isArray(parsed.shoppingList) ? parsed.shoppingList : [];
    const plan: WellnessDietPlanItem = {
      id: `diet-${Date.now()}`,
      title: String(parsed.title || 'Plan Nutricional Personalizado'),
      mode,
      providerLabel,
      createdAt: nowLabel(),
      summary: String(parsed.summary || 'Plan orientativo generado con tu clave BYOK.'),
      meals: {
        desayuno: String(mealsObj.desayuno || 'Desayuno equilibrado con proteína y fruta.'),
        almuerzo: String(mealsObj.almuerzo || 'Almuerzo balanceado con vegetales y proteína.'),
        merienda: String(mealsObj.merienda || 'Merienda liviana y saciante.'),
        cena: String(mealsObj.cena || 'Cena suave y nutritiva.'),
      },
      shoppingList: rawList.slice(0, 14).map((it, idx) => ({
        id: `sh-${Date.now()}-${idx}`,
        item: String(it),
        checked: false,
      })),
      hydrationTip: String(
        parsed.hydrationTip || 'Recordá hidratarte con 2 a 2,5 L de agua repartidos durante el día.'
      ),
      rawMarkdown: res.content,
    };
    return { ok: true, plan };
  }

  // Graceful Markdown fallback if provider didn't strictly return JSON
  return {
    ok: true,
    plan: {
      id: `diet-${Date.now()}`,
      title: mode === 'heladera' ? 'Ideas con tus ingredientes' : 'Plan Nutricional IA',
      mode,
      providerLabel,
      createdAt: nowLabel(),
      summary: res.content.slice(0, 260),
      meals: {
        desayuno: 'Consultá el detalle completo generado abajo.',
        almuerzo: 'Consultá el detalle completo generado abajo.',
        merienda: 'Consultá el detalle completo generado abajo.',
        cena: 'Consultá el detalle completo generado abajo.',
      },
      shoppingList: [{ id: `sh-${Date.now()}-0`, item: 'Revisar ingredientes en detalle del plan', checked: false }],
      hydrationTip: 'Recordá mantener una hidratación constante durante todo el día.',
      rawMarkdown: res.content,
    },
  };
}

export async function generateWorkoutPlanWithByok(params: {
  keyMeta: ByokProviderKey;
  rawApiKey: string;
  profile: WellnessPhysicalProfile;
  durationLabel: string;
  focusLabel: string;
  extraNotes: string;
}): Promise<{ ok: boolean; plan?: WellnessWorkoutPlanItem; error?: string }> {
  const { keyMeta, rawApiKey, profile, durationLabel, focusLabel, extraNotes } = params;
  const ctx = buildPhysicalProfileContext(profile);

  const prompt = `Contexto físico del usuario: ${ctx}
Duración disponible por sesión: ${durationLabel}
Enfoque o grupo muscular: ${focusLabel}
Indicaciones extra: ${extraNotes.trim() || 'Priorizar buena técnica y seguridad articular.'}

Devolvé EXCLUSIVAMENTE un JSON válido con esta estructura exacta:
{
  "title": "Nombre motivador de la rutina",
  "daysSummary": "Cómo distribuirla en la semana + calentamiento breve de 2 min",
  "exercises": [
    {
      "name": "Nombre del ejercicio",
      "sets": 3,
      "reps": "10-12 reps o 40 seg",
      "restSec": 45,
      "workSec": 40,
      "technique": "Clave técnica corta y segura"
    }
  ]
}
Incluí entre 4 y 6 ejercicios claros y ejecutables.`;

  const res = await sendByokChatCompletion({
    keyMeta,
    rawApiKey,
    history: [],
    userText: prompt,
    systemInstructionOverride:
      'Sos un entrenador personal responsable dentro de FABRO. Diseñá rutinas seguras, progresivas y adaptadas al nivel y equipamiento del usuario. Devolvé JSON limpio en español.',
  });

  if (!res.ok) return { ok: false, error: res.error };

  const parsed = extractJsonObject(res.content);
  const providerLabel = `${keyMeta.providerName} · ${keyMeta.modelName}`;

  if (parsed && Array.isArray(parsed.exercises) && parsed.exercises.length > 0) {
    const plan: WellnessWorkoutPlanItem = {
      id: `wrk-${Date.now()}`,
      title: String(parsed.title || `Rutina ${focusLabel} (${durationLabel})`),
      providerLabel,
      durationLabel,
      equipmentLabel: WELLNESS_EQUIPMENT_LABELS[profile.equipment],
      focusLabel,
      createdAt: nowLabel(),
      daysSummary: String(parsed.daysSummary || 'Rutina personalizada generada con tu clave BYOK.'),
      exercises: parsed.exercises.slice(0, 10).map((ex, idx) => {
        const obj = (ex || {}) as Record<string, unknown>;
        return {
          id: `ex-${Date.now()}-${idx}`,
          name: String(obj.name || `Ejercicio ${idx + 1}`),
          sets: Math.min(8, Math.max(1, Number(obj.sets) || 3)),
          reps: String(obj.reps || '12 reps'),
          restSec: Math.min(180, Math.max(15, Number(obj.restSec) || 45)),
          workSec: Math.min(120, Math.max(20, Number(obj.workSec) || 40)),
          technique: String(obj.technique || 'Mantené postura firme y respiración fluida.'),
        };
      }),
      rawMarkdown: res.content,
    };
    return { ok: true, plan };
  }

  return {
    ok: true,
    plan: {
      ...getOfflineBaseWorkoutPlan(profile, durationLabel, focusLabel),
      id: `wrk-${Date.now()}`,
      title: `Rutina ${focusLabel} · ${durationLabel}`,
      providerLabel,
      daysSummary: res.content.slice(0, 320),
      rawMarkdown: res.content,
    },
  };
}

export async function generateHabitPlanWithByok(params: {
  keyMeta: ByokProviderKey;
  rawApiKey: string;
  profile: WellnessPhysicalProfile;
  category: WellnessHabitPlanItem['category'];
  userRequest: string;
}): Promise<{ ok: boolean; plan?: WellnessHabitPlanItem; error?: string }> {
  const { keyMeta, rawApiKey, profile, category, userRequest } = params;
  const ctx = buildPhysicalProfileContext(profile);
  const categoryLabels: Record<WellnessHabitPlanItem['category'], string> = {
    manana: 'Ritual de mañana y energía inicial',
    sueno: 'Protocolo de descanso nocturno para dormir mejor',
    'pausas-estudio': 'Pausas activas entre horas de estudio',
    antiprocrastinacion: 'Estrategias prácticas para vencer la procrastinación',
  };

  const prompt = `Contexto del usuario: ${ctx}
Objetivo del laboratorio de hábitos: ${categoryLabels[category]}
Detalle del usuario: ${userRequest.trim() || 'Diseñá un protocolo realista y sostenible.'}

Devolvé EXCLUSIVAMENTE un JSON válido:
{
  "title": "Título del protocolo",
  "summary": "Explicación clara en 2 frases",
  "habits": [
    { "title": "Acción concreta y corta (máx 80 caracteres)", "scheduleHint": "Horario o frecuencia sugerida" }
  ]
}
Incluí entre 4 y 6 hábitos accionables.`;

  const res = await sendByokChatCompletion({
    keyMeta,
    rawApiKey,
    history: [],
    userText: prompt,
    systemInstructionOverride:
      'Sos especialista en ciencia de hábitos, cronobiología y foco sostenible dentro de FABRO. Respondé en español con JSON limpio.',
  });

  if (!res.ok) return { ok: false, error: res.error };

  const parsed = extractJsonObject(res.content);
  const providerLabel = `${keyMeta.providerName} · ${keyMeta.modelName}`;

  if (parsed && Array.isArray(parsed.habits) && parsed.habits.length > 0) {
    return {
      ok: true,
      plan: {
        id: `hab-${Date.now()}`,
        title: String(parsed.title || categoryLabels[category]),
        category,
        providerLabel,
        createdAt: nowLabel(),
        summary: String(parsed.summary || 'Protocolo personalizado generado con tu clave BYOK.'),
        habits: parsed.habits.slice(0, 8).map((h, idx) => {
          const obj = (h || {}) as Record<string, unknown>;
          return {
            id: `hs-${Date.now()}-${idx}`,
            title: String(obj.title || `Hábito ${idx + 1}`),
            scheduleHint: String(obj.scheduleHint || 'Diario'),
            addedToOrganizer: false,
          };
        }),
        rawMarkdown: res.content,
      },
    };
  }

  return {
    ok: true,
    plan: {
      ...getOfflineBaseHabitPlan(category),
      id: `hab-${Date.now()}`,
      providerLabel,
      summary: res.content.slice(0, 320),
      rawMarkdown: res.content,
    },
  };
}

export async function generateStoicReflectionWithByok(params: {
  keyMeta: ByokProviderKey;
  rawApiKey: string;
  moodFeeling: string;
  journalContext?: string;
}): Promise<{ ok: boolean; session?: WellnessStoicSessionItem; error?: string }> {
  const { keyMeta, rawApiKey, moodFeeling, journalContext } = params;

  const prompt = `Cómo se siente hoy el usuario: ${moodFeeling.trim()}
${journalContext?.trim() ? `Extracto opcional de su diario: ${journalContext.trim().slice(0, 600)}` : ''}

Desde la filosofía estoica práctica («Si hoy fuera el último día de tu vida») y técnicas breves de reencuadre cognitivo y calma mental, devolvé EXCLUSIVAMENTE un JSON válido:
{
  "reframeTitle": "Título breve del principio o reencuadre",
  "guidance": "Acompañamiento empático, claro y sereno (3 a 4 frases)",
  "calmExercise": "Ejercicio práctico de 2 minutos paso a paso para bajar ruido mental ahora",
  "journalPrompt": "Una pregunta profunda de journaling guiado para que responda hoy"
}`;

  const res = await sendByokChatCompletion({
    keyMeta,
    rawApiKey,
    history: [],
    userText: prompt,
    systemInstructionOverride:
      'Sos un compañero de claridad mental y filosofía estoica práctica en FABRO. Hablás con calidez, serenidad y brevedad en español. No reemplazás atención profesional de salud mental. Devolvé JSON limpio.',
  });

  if (!res.ok) return { ok: false, error: res.error };

  const parsed = extractJsonObject(res.content);
  const providerLabel = `${keyMeta.providerName} · ${keyMeta.modelName}`;

  if (parsed && parsed.guidance) {
    return {
      ok: true,
      session: {
        id: `stoic-${Date.now()}`,
        createdAt: nowLabel(),
        moodFeeling: moodFeeling.trim(),
        providerLabel,
        reframeTitle: String(parsed.reframeTitle || 'Claridad y presencia'),
        guidance: String(parsed.guidance),
        calmExercise: String(
          parsed.calmExercise || 'Realizá 4 ciclos de respiración 4-7-8 y soltá la tensión de los hombros.'
        ),
        journalPrompt: String(
          parsed.journalPrompt || '¿Qué pequeña acción honesta te daría paz hoy?'
        ),
      },
    };
  }

  return {
    ok: true,
    session: {
      id: `stoic-${Date.now()}`,
      createdAt: nowLabel(),
      moodFeeling: moodFeeling.trim(),
      providerLabel,
      reframeTitle: 'Reflexión guiada con tu IA',
      guidance: res.content.slice(0, 900),
      calmExercise: 'Tomate 60 segundos para respirar lento y releer la idea que más resuene contigo.',
      journalPrompt: '¿Qué aprendizaje concreto te llevás para el resto del día?',
    },
  };
}
