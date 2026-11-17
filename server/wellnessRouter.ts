import express, { type Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  checkAntiSpamWindow,
  getClientIp,
  requireAuth,
  type AuthenticatedRequest,
} from './authMiddleware.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

function getWellnessGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function sanitizeDateKey(raw?: unknown): string {
  const text = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  return new Date().toISOString().slice(0, 10);
}

export interface WellnessSuggestionPayload {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  category: string;
  actionableStep: string;
}

export interface DailyWellnessResponsePayload {
  dateKey: string;
  dailyHeadline: string;
  focusArea: string;
  mentalHealth: WellnessSuggestionPayload[];
  physicalHealth: WellnessSuggestionPayload[];
  nutritionTip: {
    title: string;
    summary: string;
    hydrationReminder: string;
  };
  generatedAt: string;
  modelUsed: string;
}

export interface DailyMealPlanEntry {
  id: string;
  slot: 'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'colacion';
  slotLabel: string;
  title: string;
  foods: string[];
  benefits: string;
  approxKcal: number;
  prepMinutes: number;
}

export interface DailyMealPlanResponsePayload {
  dateKey: string;
  dailySummary: string;
  hydrationNote: string;
  meals: DailyMealPlanEntry[];
  generatedAt: string;
  modelUsed: string;
}

export function buildDailySuggestionsPrompt(params: {
  dateKey: string;
  focusArea: string;
  routinesSummary: string;
  nutritionGoal: string;
  dietaryPreference: string;
}): string {
  return `Sos un especialista en bienestar integral, hábitos saludables, higiene postural, nutrición educativa y cuidado de la salud mental para estudiantes y trabajadores en la plataforma FABRO.
Fecha actual del usuario: ${params.dateKey}.
Enfoque prioritario solicitado: ${params.focusArea || 'equilibrio integral entre mente, cuerpo y estudio'}.
Rutinas activas del usuario: ${params.routinesSummary || 'Jornada mixta de estudio, trabajo y descanso'}.
Objetivo nutricional: ${params.nutritionGoal || 'equilibrio general y energía sostenida'}.
Preferencia alimentaria: ${params.dietaryPreference || 'sin restricciones'}.

Generá recomendaciones FRESCAS, concretas, prácticas y actualizadas para el día ${params.dateKey} en español (rioplatense/neutro claro).
Reglas:
1. En "mentalHealth", proponé exactamente 3 prácticas accionables (respiración, regulación del estrés académico, pausas cognitivas, enfoque atencional o higiene del sueño) con duración estimada en minutos (entre 3 y 30).
2. En "physicalHealth", proponé exactamente 3 prácticas accionables (movilidad cervical/lumbar, pausas activas, caminata, hidratación, descanso visual o ejercicio moderado) adaptadas a la jornada.
3. En "nutritionTip", incluí un consejo práctico de alimentación e hidratación para acompañar las rutinas de hoy.
4. Enfoque exclusivamente preventivo, educativo y de hábitos saludables cotidianos; no emitas diagnósticos médicos ni prescripciones farmacológicas.`;
}

export function buildMealPlanPrompt(params: {
  dateKey: string;
  goal: string;
  preference: string;
  restrictions: string;
  waterTargetGlasses: number;
  routinesSummary: string;
}): string {
  return `Sos un asistente de planificación nutricional educativa en la plataforma FABRO.
Fecha del plan: ${params.dateKey}.
Objetivo nutricional del usuario: ${params.goal || 'energía y concentración'}.
Preferencia alimentaria: ${params.preference || 'sin restricciones'}.
Alergias o restricciones declaradas: ${params.restrictions || 'ninguna declarada'}.
Meta de hidratación: ${params.waterTargetGlasses || 8} vasos de agua al día.
Rutinas del día: ${params.routinesSummary || 'estudio, trabajo y actividad física moderada'}.

Diseñá un menú diario equilibrado, accesible y práctico para hoy (${params.dateKey}) en español, dividido en exactamente 5 momentos en este orden:
1. "desayuno" (Desayuno)
2. "almuerzo" (Almuerzo)
3. "merienda" (Merienda)
4. "cena" (Cena)
5. "colacion" (Colación / Snack saludable)

Respetá estrictamente la preferencia alimentaria y restricciones declaradas. Incluí alimentos cotidianos, beneficios concretos, kcal aproximadas realistas y tiempo de preparación en minutos. Contenido estrictamente educativo sobre alimentación equilibrada.`;
}

function mapWellnessError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY_MISSING')) {
    return {
      status: 503,
      message: 'El generador diario con IA requiere configurar GEMINI_API_KEY en Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message: 'Se alcanzó temporalmente el límite de solicitudes de Gemini. Intentá nuevamente en unos segundos.',
    };
  }
  return {
    status: 500,
    message: `No se pudieron generar las sugerencias diarias con IA: ${raw}`,
  };
}

export function normalizeWellnessBundle(
  raw: Record<string, unknown>,
  dateKey: string,
  focusArea: string
): DailyWellnessResponsePayload {
  const normalizeItems = (arr: unknown, prefix: string): WellnessSuggestionPayload[] => {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 4).map((item, idx) => {
      const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      const parsedDuration = Number(obj.durationMinutes);
      return {
        id: String(obj.id || `${prefix}_${dateKey}_${idx + 1}`).slice(0, 80),
        title: String(obj.title || 'Práctica diaria recomendada').slice(0, 140),
        description: String(obj.description || '').slice(0, 500),
        durationMinutes: Math.max(
          2,
          Math.min(60, Math.round(Number.isFinite(parsedDuration) ? parsedDuration : 10))
        ),
        category: String(obj.category || 'Bienestar').slice(0, 60),
        actionableStep: String(obj.actionableStep || '').slice(0, 320),
      };
    });
  };

  const tipObj = (
    raw.nutritionTip && typeof raw.nutritionTip === 'object' ? raw.nutritionTip : {}
  ) as Record<string, unknown>;

  return {
    dateKey,
    dailyHeadline: String(
      raw.dailyHeadline || `Guía diaria de bienestar mental, físico y hábitos · ${dateKey}`
    ).slice(0, 220),
    focusArea: String(focusArea || 'equilibrio_integral').slice(0, 80),
    mentalHealth: normalizeItems(raw.mentalHealth, 'mental'),
    physicalHealth: normalizeItems(raw.physicalHealth, 'physical'),
    nutritionTip: {
      title: String(tipObj.title || 'Nutrición consciente e hidratación').slice(0, 140),
      summary: String(tipObj.summary || 'Priorizá alimentos reales y pausas para hidratarte.').slice(0, 450),
      hydrationReminder: String(
        tipObj.hydrationReminder || 'Tomá un vaso de agua al iniciar cada bloque de estudio.'
      ).slice(0, 260),
    },
    generatedAt: new Date().toISOString(),
    modelUsed: MODEL_NAME,
  };
}

export function normalizeMealPlanBundle(
  raw: Record<string, unknown>,
  dateKey: string
): DailyMealPlanResponsePayload {
  const allowedSlots = new Set(['desayuno', 'almuerzo', 'merienda', 'cena', 'colacion']);
  const slotLabels: Record<string, string> = {
    desayuno: 'Desayuno',
    almuerzo: 'Almuerzo',
    merienda: 'Merienda',
    cena: 'Cena',
    colacion: 'Colación',
  };

  const rawMeals = Array.isArray(raw.meals) ? raw.meals : [];
  const meals: DailyMealPlanEntry[] = rawMeals.slice(0, 6).map((item, idx) => {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const rawSlot = String(obj.slot || '').toLowerCase();
    const fallbackOrder: Array<'desayuno' | 'almuerzo' | 'merienda' | 'cena' | 'colacion'> = [
      'desayuno',
      'almuerzo',
      'merienda',
      'cena',
      'colacion',
    ];
    const slot = (allowedSlots.has(rawSlot) ? rawSlot : fallbackOrder[idx % 5]) as DailyMealPlanEntry['slot'];
    const foods = Array.isArray(obj.foods)
      ? obj.foods.map((f) => String(f || '').trim()).filter(Boolean).slice(0, 8)
      : [];

    return {
      id: `meal_${slot}_${idx + 1}`,
      slot,
      slotLabel: String(obj.slotLabel || slotLabels[slot]).slice(0, 40),
      title: String(obj.title || `Opción equilibrada de ${slotLabels[slot]}`).slice(0, 140),
      foods,
      benefits: String(obj.benefits || '').slice(0, 320),
      approxKcal: Math.max(80, Math.min(1800, Math.round(Number(obj.approxKcal) || 350))),
      prepMinutes: Math.max(2, Math.min(90, Math.round(Number(obj.prepMinutes) || 15))),
    };
  });

  return {
    dateKey,
    dailySummary: String(
      raw.dailySummary || `Plan nutricional diario equilibrado para ${dateKey}`
    ).slice(0, 360),
    hydrationNote: String(
      raw.hydrationNote || 'Distribuí tu ingesta de agua de forma constante a lo largo del día.'
    ).slice(0, 260),
    meals,
    generatedAt: new Date().toISOString(),
    modelUsed: MODEL_NAME,
  };
}

export interface WellnessRouterDeps {
  generateDailySuggestionsFn?: (prompt: string) => Promise<Record<string, unknown>>;
  generateMealPlanFn?: (prompt: string) => Promise<Record<string, unknown>>;
}

export function createWellnessRouter(deps?: WellnessRouterDeps) {
  const router = express.Router();

  const enforceWellnessRateLimit = (req: AuthenticatedRequest, res: Response): boolean => {
    const uid = req.authUser?.uid || 'anon';
    const ip = getClientIp(req);
    const check = checkAntiSpamWindow(`wellness:${uid}:${ip}`, 12);
    if (!check.allowed) {
      res.status(429).json({
        error: `Demasiadas solicitudes de bienestar seguidas. Esperá ${check.retryAfterSec} segundos.`,
        code: 'RATE_LIMIT',
      });
      return false;
    }
    return true;
  };

  router.post('/daily-suggestions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!enforceWellnessRateLimit(req, res)) return;

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const dateKey = sanitizeDateKey(body.dateKey);
      const focusArea = String(body.focusArea || 'equilibrio_integral').slice(0, 80);
      const routinesSummary = String(body.routinesSummary || '').slice(0, 1200);
      const nutritionGoal = String(body.nutritionGoal || '').slice(0, 120);
      const dietaryPreference = String(body.dietaryPreference || '').slice(0, 120);

      const prompt = buildDailySuggestionsPrompt({
        dateKey,
        focusArea,
        routinesSummary,
        nutritionGoal,
        dietaryPreference,
      });

      let parsed: Record<string, unknown>;
      if (deps?.generateDailySuggestionsFn) {
        parsed = await deps.generateDailySuggestionsFn(prompt);
      } else {
        const ai = getWellnessGeminiClient();
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                dailyHeadline: { type: Type.STRING },
                mentalHealth: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      durationMinutes: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                      actionableStep: { type: Type.STRING },
                    },
                    required: ['title', 'description', 'durationMinutes', 'category', 'actionableStep'],
                  },
                },
                physicalHealth: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      durationMinutes: { type: Type.INTEGER },
                      category: { type: Type.STRING },
                      actionableStep: { type: Type.STRING },
                    },
                    required: ['title', 'description', 'durationMinutes', 'category', 'actionableStep'],
                  },
                },
                nutritionTip: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    hydrationReminder: { type: Type.STRING },
                  },
                  required: ['title', 'summary', 'hydrationReminder'],
                },
              },
              required: ['dailyHeadline', 'mentalHealth', 'physicalHealth', 'nutritionTip'],
            },
          },
        });
        parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      }

      res.json(normalizeWellnessBundle(parsed, dateKey, focusArea));
    } catch (err) {
      const mapped = mapWellnessError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  router.post('/generate-meal-plan', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    if (!enforceWellnessRateLimit(req, res)) return;

    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const dateKey = sanitizeDateKey(body.dateKey);
      const goal = String(body.goal || 'energia_concentracion').slice(0, 120);
      const preference = String(body.preference || 'sin_restricciones').slice(0, 120);
      const restrictions = String(body.restrictions || '').slice(0, 300);
      const waterTargetGlasses = Math.max(4, Math.min(18, Math.round(Number(body.waterTargetGlasses) || 8)));
      const routinesSummary = String(body.routinesSummary || '').slice(0, 1000);

      const prompt = buildMealPlanPrompt({
        dateKey,
        goal,
        preference,
        restrictions,
        waterTargetGlasses,
        routinesSummary,
      });

      let parsed: Record<string, unknown>;
      if (deps?.generateMealPlanFn) {
        parsed = await deps.generateMealPlanFn(prompt);
      } else {
        const ai = getWellnessGeminiClient();
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                dailySummary: { type: Type.STRING },
                hydrationNote: { type: Type.STRING },
                meals: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      slot: { type: Type.STRING },
                      slotLabel: { type: Type.STRING },
                      title: { type: Type.STRING },
                      foods: { type: Type.ARRAY, items: { type: Type.STRING } },
                      benefits: { type: Type.STRING },
                      approxKcal: { type: Type.INTEGER },
                      prepMinutes: { type: Type.INTEGER },
                    },
                    required: ['slot', 'slotLabel', 'title', 'foods', 'benefits', 'approxKcal', 'prepMinutes'],
                  },
                },
              },
              required: ['dailySummary', 'hydrationNote', 'meals'],
            },
          },
        });
        parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
      }

      res.json(normalizeMealPlanBundle(parsed, dateKey));
    } catch (err) {
      const mapped = mapWellnessError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  return router;
}
