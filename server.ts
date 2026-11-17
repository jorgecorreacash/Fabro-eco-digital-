import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GenerateContentResponse, GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { Mp3Encoder } from '@breezystack/lamejs';
import { runFabroIA2Pipeline } from './server/fabroEngine.ts';
import {
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_BUDGET_POLICY,
  executeGatewayChat,
  executeGatewayCompare,
  getEffectiveModels,
  getEffectiveProviders,
  getRuntimeUsageSummary,
  isProviderConfiguredInBackend,
  testProviderConnection,
  type AIProviderId,
} from './server/aiGateway.ts';
import {
  requireAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from './server/authMiddleware.ts';
import { createConnectRouter } from './server/connectRouter.ts';
import { createPlatformResearchRouter } from './server/platformResearchRoutes.ts';
import { createPortalsRouter } from './server/portalsRouter.ts';
import { createWellnessRouter } from './server/wellnessRouter.ts';
import {
  COUNSELOR_SYSTEM_SAFETY_INSTRUCTION,
  buildCrisisSupportMessage,
  detectEmotionalCrisis,
  getCrisisSupportResources,
} from './shared/emotionalSafety.ts';
import { freemiumAiGuardMiddleware } from './server/freemiumMiddleware.ts';
import {
  PAID_BUDGET_BLOCKED_MESSAGE,
  acknowledgeAdminAlert,
  commitAiUsage,
  getAdminDashboardSnapshot,
  getUserFreemiumStatus,
  grantUserCreditsAdmin,
  releaseAiQuotaReservation,
  setDelegatedAdminRole,
  setProviderOverrideAdmin,
  setUserPlanAdmin,
  syncRegisteredUser,
  updateSystemLimitsAdmin,
  type QuotaReservation,
} from './server/freemiumStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';
const LITE_MODEL_NAME = 'gemini-3.1-flash-lite';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
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

function isGoogleLimitError(err: unknown): boolean {
  const raw = (err instanceof Error ? err.message : String(err)).toUpperCase();
  return (
    raw.includes('429') ||
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('HIGH DEMAND') ||
    raw.includes('OVERLOADED') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('QUOTA') ||
    raw.includes('RATE_LIMIT') ||
    raw.includes('GEMINI_API_KEY_MISSING')
  );
}

function hasValidOpenAIKey(): boolean {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  return key.length >= 20 && (key.startsWith('sk-') || key.startsWith('proj-'));
}

async function callOpenAIChatGPT(params: {
  systemInstruction: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  preferHeavyModel?: boolean;
  responseJson?: boolean;
}): Promise<{ text: string; modelUsed: string }> {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!hasValidOpenAIKey()) {
    throw new Error('OPENAI_API_KEY_MISSING');
  }
  const modelUsed = params.preferHeavyModel
    ? 'gpt-4o'
    : process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const body: Record<string, unknown> = {
    model: modelUsed,
    messages: [
      { role: 'system', content: params.systemInstruction },
      ...params.messages,
    ],
    temperature: 0.4,
  };
  if (params.responseJson) {
    body.response_format = { type: 'json_object' };
  }

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(35000),
  });

  const payload = (await resp.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!resp.ok) {
    throw new Error(payload?.error?.message || `OpenAI HTTP ${resp.status}`);
  }

  return {
    text: payload?.choices?.[0]?.message?.content || '',
    modelUsed,
  };
}

function formatAiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('OPENAI_API_KEY_MISSING')) {
    return {
      status: 400,
      message:
        'ChatGPT (OpenAI) aún no tiene configurada la variable OPENAI_API_KEY en Settings > Secrets. Podés usar el modo Auto (Gemini) mientras tanto o agregarla en Secrets.',
    };
  }
  if (raw.includes('GEMINI_API_KEY_MISSING')) {
    return {
      status: 503,
      message: 'El servicio de inteligencia artificial requiere configurar GEMINI_API_KEY en el panel Secrets del entorno.',
    };
  }
  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED') || raw.includes('403')) {
    return {
      status: 403,
      message: 'La clave de Gemini API no es válida o no tiene permisos suficientes. Verificala en Settings > Secrets.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message:
        'Se alcanzó temporalmente el límite de tiempo/cuota de Google Gemini. Intentá en unos segundos o activá el respaldo de ChatGPT (OPENAI_API_KEY en Secrets).',
    };
  }
  return {
    status: 500,
    message: `Error al procesar la consulta con FABRO AI: ${raw}`,
  };
}

const EDUCATION_LEVEL_LABELS: Record<string, string> = {
  primaria: 'Educación Primaria (lenguaje claro, cercano y didáctico)',
  secundaria: 'Educación Secundaria (rigor escolar medio, ejemplos claros)',
  terciario: 'Nivel Terciario / Tecnicatura (enfoque práctico y profesional)',
  universitario: 'Nivel Universitario (rigor académico, precisión conceptual y metodológica)',
  posgrado: 'Posgrado / Maestría / Doctorado (análisis crítico avanzado y profundidad teórica)',
  autodidacta: 'Formación Profesional y Autodidacta (enfoque aplicado y estructurado)',
};

function canUsePaidModelsFromRes(res: express.Response): boolean {
  const reservation = res.locals?.freemiumReservation as QuotaReservation | undefined;
  if (!reservation) return true;
  return reservation.allowPaidModels;
}

function rejectPaidModelNotAllowed(res: express.Response) {
  const reservation = res.locals?.freemiumReservation as QuotaReservation | undefined;
  const isBudgetBlock =
    reservation?.budgetStatus?.paidBlocked || reservation?.budgetStatus?.paidRestricted;
  res.status(isBudgetBlock ? 429 : 403).json({
    error: isBudgetBlock
      ? PAID_BUDGET_BLOCKED_MESSAGE
      : 'Este modelo comercial pertenece a FABRO PREMIUM. Tu plan GRATIS utiliza los modelos gratuitos disponibles.',
    code: isBudgetBlock ? 'MONTHLY_BUDGET_EXHAUSTED' : 'PREMIUM_REQUIRED',
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'fabro-api' });
  });

  app.get('/api/ai/providers', (_req, res) => {
    res.json({
      geminiConfigured: isProviderConfiguredInBackend('gemini'),
      openaiConfigured: isProviderConfiguredInBackend('openai'),
      geminiModel: MODEL_NAME,
      geminiFallbackModel: LITE_MODEL_NAME,
      openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      youtubeApiConfigured: Boolean((process.env.YOUTUBE_API_KEY || '').trim()),
      publicApis: ['openalex', 'crossref', 'arxiv', 'enciclopedia', 'nasa', 'openverse', 'met', 'youtube-oembed'],
    });
  });

  // ------------------------------------------------------------------
  // 0. Freemium Account Quota, Plans & Central Cost-Control Admin Routes
  // ------------------------------------------------------------------
  app.get('/api/freemium/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const u = req.authUser!;
    const status = getUserFreemiumStatus(u.uid, u.email, u.displayName);
    res.json(status);
  });

  app.post('/api/freemium/sync-profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const u = req.authUser!;
    const { displayName, photoURL, educationLevel } = req.body ?? {};
    syncRegisteredUser({
      uid: u.uid,
      email: u.email,
      displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim() : u.displayName,
      photoURL: typeof photoURL === 'string' ? photoURL.slice(0, 500) : undefined,
      educationLevel: typeof educationLevel === 'string' ? educationLevel.slice(0, 40) : undefined,
    });
    res.json(getUserFreemiumStatus(u.uid, u.email, u.displayName));
  });

  app.get('/api/freemium/admin/dashboard', requireAuth, requireAdmin, (_req, res) => {
    res.json(getAdminDashboardSnapshot());
  });

  app.post('/api/freemium/admin/limits', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const updated = updateSystemLimitsAdmin(req.body ?? {}, req.authUser!.email);
    res.json({ systemLimits: updated, dashboard: getAdminDashboardSnapshot() });
  });

  app.post('/api/freemium/admin/users/:uid/plan', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const targetUid = String(req.params.uid || '').trim();
    const { planTier, status, expiresAt, note } = req.body ?? {};
    if (!targetUid || (planTier !== 'free' && planTier !== 'premium')) {
      res.status(400).json({ error: 'Indicá un usuario válido y el plan ("free" o "premium").' });
      return;
    }
    const sub = setUserPlanAdmin({
      uid: targetUid,
      planTier,
      status: status === 'cancelled' || status === 'expired' ? status : 'active',
      expiresAt: typeof expiresAt === 'string' ? expiresAt : undefined,
      note: typeof note === 'string' ? note.slice(0, 200) : undefined,
      adminEmail: req.authUser!.email,
    });
    res.json({ subscription: sub, dashboard: getAdminDashboardSnapshot() });
  });

  app.post('/api/freemium/admin/users/:uid/credits', requireAuth, requireAdmin, (req, res) => {
    const targetUid = String(req.params.uid || '').trim();
    const { delta, note } = req.body ?? {};
    const numDelta = Number(delta);
    if (!targetUid || !Number.isFinite(numDelta) || numDelta === 0) {
      res.status(400).json({ error: 'Indicá una cantidad válida de créditos.' });
      return;
    }
    const credits = grantUserCreditsAdmin({
      uid: targetUid,
      delta: Math.max(-500, Math.min(2000, Math.round(numDelta))),
      note: typeof note === 'string' ? note.slice(0, 200) : undefined,
    });
    res.json({ credits, dashboard: getAdminDashboardSnapshot() });
  });

  app.post('/api/freemium/admin/alerts/:alertId/ack', requireAuth, requireAdmin, (req, res) => {
    acknowledgeAdminAlert(String(req.params.alertId || ''));
    res.json({ ok: true, dashboard: getAdminDashboardSnapshot() });
  });

  app.post('/api/freemium/admin/providers', requireAuth, requireAdmin, (req, res) => {
    const { providerId, enabled, defaultModelId } = req.body ?? {};
    if (typeof providerId !== 'string' || typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'Datos inválidos para configurar el proveedor.' });
      return;
    }
    setProviderOverrideAdmin(
      providerId,
      enabled,
      typeof defaultModelId === 'string' ? defaultModelId : undefined
    );
    res.json({ providers: getEffectiveProviders() });
  });

  app.post('/api/freemium/admin/roles', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    if (!req.authUser!.isSuperAdmin) {
      res.status(403).json({ error: 'Solo el Superadministrador puede delegar roles.' });
      return;
    }
    const { email, role } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim()) {
      res.status(400).json({ error: 'Email inválido.' });
      return;
    }
    setDelegatedAdminRole(email, role === 'administrador' || role === 'moderador' ? role : null);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------------
  // 0.2 FABRO CONNECT (Personal AI Accounts — BYOK Encrypted + OAuth PKCE)
  // Isolated from FABRO Freemium quota & admin API keys
  // ------------------------------------------------------------------
  app.use('/api/connect', createConnectRouter());

  // ------------------------------------------------------------------
  // 0.3 FABRO EXPLORER, KNOWLEDGE, RESEARCH & TOOLS (Public Academic & Open APIs)
  // ------------------------------------------------------------------
  app.use('/api', createPlatformResearchRouter());

  // ------------------------------------------------------------------
  // 0.4 FABRO EXPLORER & FABRO AI BROWSER (Portals & Honest Frame Probe)
  // ------------------------------------------------------------------
  app.use('/api/portals', createPortalsRouter());

  // ------------------------------------------------------------------
  // 0.45 FABRO HÁBITOS, RUTINAS Y BIENESTAR DIARIO CON IA
  // ------------------------------------------------------------------
  app.use('/api/wellness', createWellnessRouter());

  // Apply unified server-side Freemium Auth, Concurrency Lock, Anti-Spam, Quota & Budget Protection
  app.use('/api/ai', freemiumAiGuardMiddleware);
  app.use('/api/media/explain', freemiumAiGuardMiddleware);
  app.use('/api/gateway/chat', freemiumAiGuardMiddleware);
  app.use('/api/gateway/compare', freemiumAiGuardMiddleware);

  // ------------------------------------------------------------------
  // 0.5 Image Generation & Editing (gemini-3.1-flash-lite-image / gemini-nano-banana-2.1)
  // ------------------------------------------------------------------
  app.post('/api/ai/image', async (req, res) => {
    try {
      const {
        mode = 'create',
        prompt = '',
        imageBase64 = '',
        imageMimeType = 'image/png',
        aspectRatio = '1:1',
        useNanoBanana21 = false,
      } = req.body ?? {};

      const cleanPrompt = String(prompt || '').trim().slice(0, 2000);
      if (!cleanPrompt) {
        res.status(400).json({ error: 'Escribí una descripción para crear o editar la imagen.' });
        return;
      }

      const reservation = res.locals?.freemiumReservation as QuotaReservation | undefined;
      const wantsProImage = Boolean(useNanoBanana21);
      if (wantsProImage && reservation && !reservation.allowPaidModels) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      const targetModel = wantsProImage ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';
      const ai = getGeminiClient();

      const parts: Array<Record<string, unknown>> = [];
      if (mode === 'edit' && imageBase64 && typeof imageBase64 === 'string') {
        parts.push({
          inlineData: {
            mimeType: String(imageMimeType || 'image/png'),
            data: imageBase64,
          },
        });
      }
      parts.push({ text: cleanPrompt });

      const validRatios = new Set(['1:1', '3:4', '4:3', '9:16', '16:9']);
      const safeRatio = validRatios.has(String(aspectRatio)) ? String(aspectRatio) : '1:1';

      let resp: GenerateContentResponse;
      let modelUsed = targetModel;
      try {
        resp = await ai.models.generateContent({
          model: targetModel,
          contents: [{ role: 'user', parts }] as never,
          config: {
            imageConfig: { aspectRatio: safeRatio },
          } as never,
        });
      } catch (err) {
        if (targetModel !== 'gemini-3.1-flash-lite-image') {
          modelUsed = 'gemini-3.1-flash-lite-image';
          resp = await ai.models.generateContent({
            model: modelUsed,
            contents: [{ role: 'user', parts }] as never,
            config: {
              imageConfig: { aspectRatio: safeRatio },
            } as never,
          });
        } else {
          throw err;
        }
      }

      const candidateParts = resp.candidates?.[0]?.content?.parts || [];
      let outBase64 = '';
      let outMime = 'image/png';
      let description = '';
      for (const p of candidateParts) {
        const inline = (p as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
        if (inline?.data && !outBase64) {
          outBase64 = inline.data;
          outMime = inline.mimeType || 'image/png';
        }
        const textPart = (p as { text?: string }).text;
        if (textPart) description += textPart;
      }

      if (!outBase64) {
        res.status(502).json({ error: 'El modelo no devolvió una imagen generada para ese prompt.' });
        return;
      }

      res.json({
        imageDataUrl: `data:${outMime};base64,${outBase64}`,
        mimeType: outMime,
        description: description.trim(),
        modelUsed,
        providerUsed: `gemini (${modelUsed})`,
        inputTokens: resp.usageMetadata?.promptTokenCount || 256,
        outputTokens: resp.usageMetadata?.candidatesTokenCount || 1290,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 1. FABRO IA 2.0 Tutor Endpoint (Dual Research + Full Coverage + 16 Sections)
  // ------------------------------------------------------------------
  app.post('/api/ai/tutor', async (req, res) => {
    try {
      const {
        message,
        history = [],
        mode = 'academico',
        workMode = '',
        educationLevel = 'universitario',
        useWebSearch = true,
        responseDepth = 'desarrollo_completo',
        aiProvider = 'auto',
        subjectContext = '',
        subjectName = '',
        documentsContext = [],
        studyAnalysis = null,
        academicMemory = null,
        attachmentBase64 = '',
        attachmentMimeType = '',
      } = req.body ?? {};

      if (!message && !attachmentBase64) {
        res.status(400).json({ error: 'Debés escribir una consulta o adjuntar un archivo.' });
        return;
      }

      const preferredProvider =
        aiProvider === 'chatgpt' || aiProvider === 'gemini' ? aiProvider : 'auto';
      const allowPaid = canUsePaidModelsFromRes(res);
      if (preferredProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }
      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;

      const rawNotes = Array.isArray(studyAnalysis?.notes) ? studyAnalysis.notes : [];
      const weakTopicsList = Array.isArray(studyAnalysis?.weakTopics)
        ? studyAnalysis.weakTopics.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 15)
        : [];
      const recentExamsSummary =
        typeof studyAnalysis?.recentExamsSummary === 'string' && studyAnalysis.recentExamsSummary.trim()
          ? studyAnalysis.recentExamsSummary.trim().slice(0, 2000)
          : '';
      const activeBooksContext =
        typeof studyAnalysis?.activeBooks === 'string' && studyAnalysis.activeBooks.trim()
          ? studyAnalysis.activeBooks.trim().slice(0, 3000)
          : '';

      const ai = process.env.GEMINI_API_KEY ? getGeminiClient() : null;

      const result = await runFabroIA2Pipeline({
        ai,
        preferredProvider,
        callOpenAI: callOpenAIChatGPT,
        hasOpenAI: hasValidOpenAIKey() && allowPaid,
        isGoogleLimitError,
        rawMessage: String(message || 'Analizá este archivo o ejercicio adjunto con desarrollo universitario completo.'),
        explicitWorkMode: String(workMode || ''),
        mode: mode === 'sencillo' ? 'sencillo' : 'academico',
        responseDepth: String(responseDepth || 'desarrollo_completo'),
        educationLevelLabel: levelDesc,
        useWebSearch: Boolean(useWebSearch),
        subjectContext: String(subjectContext || ''),
        subjectNameHint: String(subjectName || ''),
        documentsContext: Array.isArray(documentsContext) ? documentsContext : [],
        notes: rawNotes,
        weakTopics: weakTopicsList,
        recentExamsSummary,
        activeBooks: activeBooksContext,
        academicMemory,
        history: Array.isArray(history) ? history : [],
        attachmentBase64: String(attachmentBase64 || ''),
        attachmentMimeType: String(attachmentMimeType || ''),
      });

      res.json(result);
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 2. Document Extraction (PDF / Image OCR + Page Coverage & Concept Index)
  // ------------------------------------------------------------------
  app.post('/api/ai/extract-document', async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName, startPage, endPage, existingText = '' } = req.body ?? {};
      if (!fileBase64 || !mimeType) {
        res.status(400).json({ error: 'Falta el archivo para analizar.' });
        return;
      }

      const ai = getGeminiClient();
      const hasRange = Number.isInteger(Number(startPage)) && Number.isInteger(Number(endPage)) && Number(startPage) > 0 && Number(endPage) >= Number(startPage);
      const rangeText = hasRange
        ? `Procesá específicamente el rango de páginas ${Number(startPage)} a ${Number(endPage)} del documento manteniendo los marcadores [Página N].`
        : 'Procesá el documento completo preservando marcadores [Página N] siempre que la paginación sea visible. Si el documento es muy extenso y no alcanza en una sola pasada, extraé tantas páginas contiguas desde la página 1 como sea posible e indicá exactamente cuántas páginas procesaste y cuántas quedaron pendientes.';

      try {
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: fileBase64,
                },
              },
              {
                text: `Sos el módulo de Lectura Completa y Control Documental de FABRO IA 2.0.
Archivo: "${fileName || 'archivo'}" (${mimeType}).
${rangeText}

REGLAS ESTRICTAS:
1. Conservá títulos, subtítulos, autores citados, definiciones, fórmulas, bibliografía y listas en orden original.
2. Nunca inventes contenido ni afirmes cobertura completa si hay páginas pendientes o ilegibles.
3. Si el archivo es una imagen suelta sin numeración de libro, usá totalPages=1, processedPages=1, pendingPages=0 (salvo que sea ilegible).`,
              },
            ],
          },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                totalPages: { type: Type.INTEGER },
                processedPages: { type: Type.INTEGER },
                authorsDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
                conceptIndex: { type: Type.ARRAY, items: { type: Type.STRING } },
                extractionErrors: { type: Type.ARRAY, items: { type: Type.STRING } },
                extractedText: { type: Type.STRING },
              },
              required: [
                'totalPages',
                'processedPages',
                'authorsDetected',
                'conceptIndex',
                'extractionErrors',
                'extractedText',
              ],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          totalPages?: number;
          processedPages?: number;
          authorsDetected?: string[];
          conceptIndex?: string[];
          extractionErrors?: string[];
          extractedText?: string;
        };

        const rawNewText = String(parsed.extractedText || '').slice(0, 280000);
        const combinedText = existingText && rawNewText
          ? `${String(existingText).trim()}\n\n${rawNewText}`.slice(0, 295000)
          : (rawNewText || String(existingText || '')).slice(0, 295000);

        const totalPages = Math.max(1, Number(parsed.totalPages) || 1);
        const rawProcessed = Math.max(0, Number(parsed.processedPages) || (rawNewText ? 1 : 0));
        const cumulativeProcessed = hasRange
          ? Math.min(totalPages, Math.max(rawProcessed, Number(endPage)))
          : Math.min(totalPages, rawProcessed);
        const pendingPages = Math.max(0, totalPages - cumulativeProcessed);
        const extractionErrors = Array.isArray(parsed.extractionErrors)
          ? parsed.extractionErrors.filter((e): e is string => typeof e === 'string' && e.trim().length > 0).slice(0, 20)
          : [];

        const readStatus =
          combinedText.trim().length < 15 && extractionErrors.length > 0
            ? 'error'
            : pendingPages > 0
              ? 'parcial'
              : 'completo';

        res.json({
          extractedText: combinedText,
          coverage: {
            totalPages,
            processedPages: cumulativeProcessed,
            pendingPages,
            readStatus,
            extractionErrors,
            processedAt: new Date().toISOString(),
            fragmentCount: Math.max(1, Math.ceil(combinedText.length / 18000)),
            conceptIndex: Array.isArray(parsed.conceptIndex) ? parsed.conceptIndex.slice(0, 60) : [],
            authorsDetected: Array.isArray(parsed.authorsDetected) ? parsed.authorsDetected.slice(0, 30) : [],
          },
        });
      } catch {
        const fallbackResp = await ai.models.generateContent({
          model: LITE_MODEL_NAME,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: fileBase64,
                },
              },
              {
                text: `Extraé el contenido textual completo y fiel de este documento académico (${fileName || 'archivo'}) conservando títulos y marcadores de página cuando existan.`,
              },
            ],
          },
        });
        const text = (fallbackResp.text ?? '').slice(0, 280000);
        res.json({
          extractedText: text,
          coverage: {
            totalPages: 1,
            processedPages: text.trim() ? 1 : 0,
            pendingPages: text.trim() ? 0 : 1,
            readStatus: text.trim() ? 'completo' : 'parcial',
            extractionErrors: text.trim() ? [] : ['Extracción de respaldo sin conteo exacto de páginas.'],
            processedAt: new Date().toISOString(),
            fragmentCount: Math.max(1, Math.ceil(text.length / 18000)),
            conceptIndex: [],
            authorsDetected: [],
          },
        });
      }
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 3. Document-to-Study-Material Converter
  // ------------------------------------------------------------------
  app.post('/api/ai/convert-document', async (req, res) => {
    try {
      const {
        conversionType = 'resumen_completo',
        title = 'Documento académico',
        textContent = '',
        fileBase64 = '',
        mimeType = '',
        educationLevel = 'universitario',
        mode = 'academico',
      } = req.body ?? {};

      if (!textContent && !fileBase64) {
        res.status(400).json({ error: 'Seleccioná un documento o ingresá texto para convertir.' });
        return;
      }

      const ai = getGeminiClient();
      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;

      const taskPrompts: Record<string, string> = {
        resumen_completo: 'Elaborá un resumen completo y jerarquizado con ideas principales, argumentos clave y conclusiones del material.',
        resumen_capitulos: 'Organizá un resumen estructurado capítulo por capítulo o sección por sección manteniendo fidelidad con el texto.',
        resumen_unidades: 'Dividí el contenido en unidades temáticas de estudio con objetivos de aprendizaje y síntesis de cada unidad.',
        glosario: 'Generá un glosario académico completo con todos los términos técnicos, definiciones precisas y contexto de uso según el documento.',
        preguntas_respuestas: 'Creá un banco de preguntas y respuestas modelo (10 a 15 preguntas) cubriendo los conceptos centrales.',
        opcion_multiple: 'Creá un cuestionario de opción múltiple de 10 preguntas con 4 opciones cada una, indicando al final la clave de respuestas y justificación.',
        preguntas_desarrollo: 'Formulá 6 preguntas de desarrollo universitario con guía de criterios clave que debe incluir una buena respuesta.',
        simulacro: 'Armá un simulacro de examen integrador (combinando opción múltiple, verdadero/falso y desarrollo) con grilla de corrección.',
        guia_estudio: 'Creá una guía de estudio paso a paso con ruta de lectura, conceptos clave, cuadros comparativos y autoevaluación.',
        conceptos_dificiles: 'Identificá los conceptos más complejos o abstractos del documento y explicalos en profundidad con ejemplos claros.',
        fichas_memorizacion: 'Generá entre 8 y 15 fichas de memorización (flashcards) precisas y concisas basadas estrictamente en el documento.',
      };

      const promptText = `Documento: "${title}"
Nivel del estudiante: ${levelDesc}
Modalidad: ${mode === 'sencillo' ? 'Lenguaje sencillo y accesible' : 'Rigor académico universitario'}
Tarea solicitada: ${taskPrompts[conversionType] || taskPrompts.resumen_completo}

REGLA DE FIDELIDAD: Trabajá únicamente sobre la información contenida en el documento. No inventes citas ni autores externos no mencionados.`;

      const parts: Array<Record<string, unknown>> = [];
      if (fileBase64 && mimeType) {
        parts.push({ inlineData: { mimeType, data: fileBase64 } });
      }
      if (textContent) {
        parts.push({ text: `CONTENIDO DEL DOCUMENTO:\n${String(textContent).slice(0, 120000)}` });
      }
      parts.push({ text: promptText });

      if (conversionType === 'fichas_memorizacion') {
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                markdownSummary: {
                  type: Type.STRING,
                  description: 'Resumen en Markdown de todas las fichas generadas para guardar en apuntes.',
                },
                cards: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      answer: { type: Type.STRING },
                      cardType: { type: Type.STRING, description: 'flashcard, vf, or opcion_multiple' },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctOptionIndex: { type: Type.INTEGER },
                    },
                    required: ['question', 'answer', 'cardType', 'options', 'correctOptionIndex'],
                  },
                },
              },
              required: ['markdownSummary', 'cards'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim());
        res.json({
          markdown: parsed.markdownSummary || '',
          cards: Array.isArray(parsed.cards) ? parsed.cards : [],
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
      });

      res.json({
        markdown: response.text ?? '',
        cards: [],
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 4. Exam Generator (Written & Oral)
  // ------------------------------------------------------------------
  app.post('/api/ai/exam-generate', async (req, res) => {
    try {
      const {
        subjectName = 'General',
        units = [],
        difficulty = 'universitario',
        mode = 'escrito',
        questionCount = 6,
        educationLevel = 'universitario',
        studyContext = '',
      } = req.body ?? {};

      const ai = getGeminiClient();
      const clampedCount = Math.max(3, Math.min(15, Number(questionCount) || 6));

      const prompt = `Generá un examen ${mode === 'oral' ? 'oral (preguntas conceptuales argumentativas sucesivas)' : 'escrito (combinando opción múltiple y desarrollo)'} para la materia "${subjectName}".
Unidades temáticas: ${Array.isArray(units) && units.length > 0 ? units.join(', ') : 'Programa general de la materia'}.
Dificultad: ${difficulty}.
Nivel educativo: ${EDUCATION_LEVEL_LABELS[educationLevel] || educationLevel}.
Cantidad de preguntas: ${clampedCount}.
Material de referencia del estudiante (si existe):
${String(studyContext).slice(0, 40000) || 'Sin documentos adicionales adjuntos; evaluá los fundamentos reales de la materia.'}

Devolvé estrictamente el JSON con las preguntas en español.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                    type: { type: Type.STRING, description: 'opcion_multiple or desarrollo' },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctOptionIndex: { type: Type.INTEGER },
                    topic: { type: Type.STRING },
                    expectedKeyPoints: { type: Type.STRING },
                  },
                  required: ['id', 'prompt', 'type', 'options', 'correctOptionIndex', 'topic', 'expectedKeyPoints'],
                },
              },
            },
            required: ['questions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{"questions":[]}').trim());
      res.json({
        questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 5. Exam Evaluator (Written Grading & Oral Turn-by-Turn Examiner)
  // ------------------------------------------------------------------
  app.post('/api/ai/exam-evaluate', async (req, res) => {
    try {
      const {
        subjectName = 'General',
        mode = 'escrito',
        difficulty = 'universitario',
        questions = [],
        oralTranscript = [],
      } = req.body ?? {};

      const ai = getGeminiClient();

      const prompt = `Sos un tribunal evaluador académico para la materia "${subjectName}" (modalidad: ${mode}, dificultad: ${difficulty}).
Evaluá las respuestas del estudiante con rigor y devoluciones constructivas en español.
Detectá errores de comprensión concretos, calculá un porcentaje final realista (0 a 100), listá los temas débiles específicos (weakTopics) y redactá una recomendación clara de qué volver a estudiar.

PREGUNTAS Y RESPUESTAS DEL ESTUDIANTE:
${JSON.stringify(questions, null, 2)}

${Array.isArray(oralTranscript) && oralTranscript.length > 0 ? `TRANSCRIPCIÓN DEL EXAMEN ORAL:\n${JSON.stringify(oralTranscript, null, 2)}` : ''}`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scorePercent: { type: Type.NUMBER },
              weakTopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              aiFeedback: { type: Type.STRING },
              questionEvaluations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    isCorrect: { type: Type.BOOLEAN },
                    score: { type: Type.NUMBER },
                    feedback: { type: Type.STRING },
                  },
                  required: ['id', 'isCorrect', 'score', 'feedback'],
                },
              },
            },
            required: ['scorePercent', 'weakTopics', 'aiFeedback', 'questionEvaluations'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // Oral Exam Interactive Follow-up Turn
  // ------------------------------------------------------------------
  app.post('/api/ai/oral-turn', async (req, res) => {
    try {
      const { subjectName, difficulty, currentQuestion, studentAnswer, history = [] } = req.body ?? {};
      const ai = getGeminiClient();

      const prompt = `Sos un docente universitario tomando un examen oral de "${subjectName}" (nivel: ${difficulty}).
Pregunta actual: "${currentQuestion}"
Respuesta del estudiante: "${studentAnswer}"
Historial previo: ${JSON.stringify(history.slice(-6))}

Evaluá brevemente la solidez argumentativa de esta respuesta (qué estuvo bien y qué faltó precisar) y formulá una repregunta puntual de profundización o conexión conceptual en español.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });

      res.json({
        reply: response.text ?? '',
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 6. Multi-Source & Multi-AI Browser Search (Google + OpenAlex + CrossRef + arXiv + Enciclopedia)
  // ------------------------------------------------------------------
  type SearchSourceKey = 'google' | 'enciclopedia' | 'openalex' | 'crossref' | 'arxiv';

  interface AggregatedSearchSource {
    title: string;
    url: string;
    domain: string;
    sourceOrigin: string;
    snippet?: string;
    authors?: string;
    year?: string;
  }

  function decodeXmlEntities(raw: string): string {
    return String(raw || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function fetchExternalAcademicAndEncyclopediaSources(
    cleanQuery: string,
    enabledSources: Set<SearchSourceKey>
  ): Promise<AggregatedSearchSource[]> {
    const extHeaders = {
      'User-Agent': 'FABRO-Educational-Platform/1.0 (https://aistudio.google.com)',
      Accept: 'application/json, application/atom+xml, text/xml',
    };

    const tasks: Array<Promise<AggregatedSearchSource[]>> = [];

    if (enabledSources.has('enciclopedia')) {
      tasks.push(
        (async (): Promise<AggregatedSearchSource[]> => {
          const url = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
            cleanQuery
          )}&gsrlimit=5&prop=extracts|info&inprop=url&exintro=1&explaintext=1&exsentences=3&format=json&origin=*`;
          const r = await fetch(url, { headers: extHeaders, signal: AbortSignal.timeout(4500) });
          if (!r.ok) return [];
          const data = (await r.json().catch(() => ({}))) as {
            query?: {
              pages?: Record<
                string,
                { title?: string; fullurl?: string; extract?: string }
              >;
            };
          };
          return Object.values(data?.query?.pages || {})
            .filter((p) => p?.title && p?.fullurl)
            .map((p) => ({
              title: String(p.title).trim(),
              url: String(p.fullurl),
              domain: 'es.wikipedia.org',
              sourceOrigin: 'Enciclopedia Libre',
              snippet: String(p.extract || '').trim().slice(0, 260),
            }));
        })().catch(() => [])
      );
    }

    if (enabledSources.has('openalex')) {
      tasks.push(
        (async (): Promise<AggregatedSearchSource[]> => {
          const url = `https://api.openalex.org/works?search=${encodeURIComponent(
            cleanQuery
          )}&per-page=5&select=id,doi,title,publication_year,authorships,primary_location,open_access`;
          const r = await fetch(url, { headers: extHeaders, signal: AbortSignal.timeout(4500) });
          if (!r.ok) return [];
          const data = (await r.json().catch(() => ({}))) as {
            results?: Array<{
              id?: string;
              doi?: string;
              title?: string;
              publication_year?: number;
              authorships?: Array<{ author?: { display_name?: string } }>;
              primary_location?: { landing_page_url?: string; pdf_url?: string; source?: { display_name?: string } };
              open_access?: { oa_url?: string };
            }>;
          };
          return (data.results || [])
            .map((w): AggregatedSearchSource | null => {
              const targetUrl =
                w.open_access?.oa_url ||
                w.primary_location?.pdf_url ||
                w.primary_location?.landing_page_url ||
                w.doi ||
                w.id;
              if (!targetUrl || !/^https?:\/\//i.test(targetUrl) || !w.title) return null;
              let domain = 'openalex.org';
              try {
                domain = new URL(targetUrl).hostname.replace(/^www\./, '');
              } catch {
                // fallback
              }
              const authors = (w.authorships || [])
                .slice(0, 3)
                .map((a) => a.author?.display_name)
                .filter(Boolean)
                .join(', ');
              const venue = w.primary_location?.source?.display_name || '';
              return {
                title: String(w.title).trim().slice(0, 200),
                url: targetUrl,
                domain,
                sourceOrigin: 'OpenAlex',
                authors: authors || undefined,
                year: w.publication_year ? String(w.publication_year) : undefined,
                snippet: venue ? `Publicado en ${venue}` : 'Artículo científico indexado en OpenAlex',
              };
            })
            .filter((x): x is AggregatedSearchSource => Boolean(x));
        })().catch(() => [])
      );
    }

    if (enabledSources.has('crossref')) {
      tasks.push(
        (async (): Promise<AggregatedSearchSource[]> => {
          const url = `https://api.crossref.org/works?query=${encodeURIComponent(
            cleanQuery
          )}&rows=5&select=DOI,title,author,published,container-title,URL`;
          const r = await fetch(url, { headers: extHeaders, signal: AbortSignal.timeout(4500) });
          if (!r.ok) return [];
          const data = (await r.json().catch(() => ({}))) as {
            message?: {
              items?: Array<{
                DOI?: string;
                URL?: string;
                title?: string[];
                'container-title'?: string[];
                author?: Array<{ given?: string; family?: string }>;
                published?: { 'date-parts'?: number[][] };
              }>;
            };
          };
          return (data?.message?.items || [])
            .map((item): AggregatedSearchSource | null => {
              const title = item.title?.[0];
              const targetUrl = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : '');
              if (!title || !targetUrl || !/^https?:\/\//i.test(targetUrl)) return null;
              const authors = (item.author || [])
                .slice(0, 3)
                .map((a) => [a.given, a.family].filter(Boolean).join(' '))
                .filter(Boolean)
                .join(', ');
              const year = item.published?.['date-parts']?.[0]?.[0];
              const journal = item['container-title']?.[0] || '';
              let domain = 'doi.org';
              try {
                domain = new URL(targetUrl).hostname.replace(/^www\./, '');
              } catch {
                // fallback
              }
              return {
                title: decodeXmlEntities(title).slice(0, 200),
                url: targetUrl,
                domain,
                sourceOrigin: 'CrossRef DOI',
                authors: authors || undefined,
                year: year ? String(year) : undefined,
                snippet: journal ? `Revista/Editorial: ${decodeXmlEntities(journal)}` : 'Referencia académica con DOI verificado',
              };
            })
            .filter((x): x is AggregatedSearchSource => Boolean(x));
        })().catch(() => [])
      );
    }

    if (enabledSources.has('arxiv')) {
      tasks.push(
        (async (): Promise<AggregatedSearchSource[]> => {
          const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(
            cleanQuery
          )}&start=0&max_results=4`;
          const r = await fetch(url, { headers: extHeaders, signal: AbortSignal.timeout(4500) });
          if (!r.ok) return [];
          const xml = await r.text();
          const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
          return entries
            .map((entry): AggregatedSearchSource | null => {
              const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
              const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
              const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
              const publishedMatch = entry.match(/<published>(\d{4})/);
              const authorMatches = Array.from(entry.matchAll(/<name>([\s\S]*?)<\/name>/g))
                .slice(0, 3)
                .map((m) => decodeXmlEntities(m[1]));
              const targetUrl = idMatch ? idMatch[1].trim().replace(/^http:\/\//i, 'https://') : '';
              const title = titleMatch ? decodeXmlEntities(titleMatch[1]) : '';
              if (!title || !targetUrl) return null;
              return {
                title: title.slice(0, 200),
                url: targetUrl,
                domain: 'arxiv.org',
                sourceOrigin: 'arXiv',
                authors: authorMatches.join(', ') || undefined,
                year: publishedMatch?.[1] || undefined,
                snippet: summaryMatch ? decodeXmlEntities(summaryMatch[1]).slice(0, 260) : undefined,
              };
            })
            .filter((x): x is AggregatedSearchSource => Boolean(x));
        })().catch(() => [])
      );
    }

    const settled = await Promise.allSettled(tasks);
    const merged: AggregatedSearchSource[] = [];
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        merged.push(...item.value);
      }
    }
    return merged;
  }

  app.post('/api/ai/source-search', async (req, res) => {
    try {
      const {
        query = '',
        scope = 'todo',
        subjectName = '',
        educationLevel = 'universitario',
        aiProvider = 'auto',
        searchSources = ['google', 'enciclopedia', 'openalex', 'crossref', 'arxiv'],
      } = req.body ?? {};

      const cleanQuery = String(query || '').trim();
      if (!cleanQuery) {
        res.status(400).json({ error: 'Ingresá un tema o consulta para buscar fuentes.' });
        return;
      }

      const validKeys = new Set<SearchSourceKey>(['google', 'enciclopedia', 'openalex', 'crossref', 'arxiv']);
      const enabledSources = new Set<SearchSourceKey>(
        Array.isArray(searchSources) && searchSources.length > 0
          ? searchSources.filter((s): s is SearchSourceKey => validKeys.has(s as SearchSourceKey))
          : ['google', 'enciclopedia', 'openalex', 'crossref', 'arxiv']
      );
      if (enabledSources.size === 0) {
        enabledSources.add('google');
        enabledSources.add('enciclopedia');
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const scopeInstructions: Record<string, string> = {
        todo: 'Buscá fuentes web confiables, enciclopedias, artículos educativos, instituciones académicas y papers relevantes.',
        academico: 'Priorizá artículos científicos, repositorios universitarios, papers (OpenAlex, CrossRef, Scielo, Redalyc, PubMed, arXiv) y bibliografía revisada.',
        enciclopedico: 'Priorizá artículos enciclopédicos profundos, diccionarios especializados, manuales introductorios y síntesis educativas verificadas.',
        documentacion: 'Priorizá documentación técnica oficial, especificaciones, guías de referencia y estándares.',
      };

      // Fetch real external academic & encyclopedia repositories in parallel
      const externalPromise = fetchExternalAcademicAndEncyclopediaSources(cleanQuery, enabledSources);

      const seenUrls = new Set<string>();
      const sources: AggregatedSearchSource[] = [];
      let overviewMarkdown = '';
      let secondOpinionMarkdown = '';
      let providerUsed = 'gemini';
      let secondProviderUsed = '';
      let searchQueries: string[] = [];

      const externalSources = await externalPromise;
      const externalDigest = externalSources
        .slice(0, 10)
        .map(
          (s, idx) =>
            `${idx + 1}. [${s.sourceOrigin}] ${s.title}${s.authors ? ` (${s.authors}${s.year ? `, ${s.year}` : ''})` : s.year ? ` (${s.year})` : ''} — ${s.url}${s.snippet ? `\n   Resumen: ${s.snippet}` : ''}`
        )
        .join('\n');

      const systemInstruction = `Sos el motor de investigación multi-fuente y enciclopédico de FABRO.
Respondé en español claro y bien estructurado en Markdown.
Perfil del estudiante: ${levelDesc}.
${subjectName ? `Materia activa: ${subjectName}.` : ''}
Enfoque de búsqueda: ${scopeInstructions[scope] || scopeInstructions.todo}

Presentá una síntesis panorámica rigurosa e integradora de los hallazgos encontrados en los distintos buscadores y repositorios (artículos enciclopédicos, papers científicos y fuentes web). Indicá qué conviene leer según el nivel del estudiante y no inventes URLs.`;

      const userPrompt = `Investigá y sintetizá fuentes confiables sobre: "${cleanQuery}"${
        subjectName ? ` en el contexto de la materia "${subjectName}"` : ''
      }.${
        externalDigest
          ? `\n\nHALLAZGOS DE REPOSITORIOS ABIERTOS CONSULTADOS EN VIVO (Enciclopedia, OpenAlex, CrossRef, arXiv):\n${externalDigest}`
          : ''
      }`;

      const runGeminiSearch = async (useSearchTool: boolean) => {
        const ai = getGeminiClient();
        const resp = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: userPrompt,
          config: {
            systemInstruction,
            ...(useSearchTool ? { tools: [{ googleSearch: {} }] } : {}),
          },
        });
        const metadata = resp.candidates?.[0]?.groundingMetadata;
        const rawChunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
        const googleSources: AggregatedSearchSource[] = [];
        for (const chunk of rawChunks) {
          const uri = chunk?.web?.uri;
          if (!uri || typeof uri !== 'string') continue;
          let domain = '';
          try {
            domain = new URL(uri).hostname.replace(/^www\./, '');
          } catch {
            domain = uri;
          }
          googleSources.push({
            title: (chunk?.web?.title || domain || 'Fuente web').trim(),
            url: uri,
            domain,
            sourceOrigin: 'Google Web',
          });
        }
        return {
          text: resp.text ?? '',
          googleSources,
          webSearchQueries: Array.isArray(metadata?.webSearchQueries) ? metadata.webSearchQueries : [],
        };
      };

      const allowPaid = canUsePaidModelsFromRes(res);
      if (aiProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      if (aiProvider === 'chatgpt') {
        const gpt = await callOpenAIChatGPT({
          systemInstruction,
          messages: [{ role: 'user', content: userPrompt }],
        });
        overviewMarkdown = gpt.text;
        providerUsed = `chatgpt (${gpt.modelUsed})`;
      } else if (aiProvider === 'doble_ia') {
        const geminiTask = runGeminiSearch(enabledSources.has('google')).catch(async (err) => {
          if (isGoogleLimitError(err)) {
            const ai = getGeminiClient();
            const lite = await ai.models.generateContent({ model: LITE_MODEL_NAME, contents: userPrompt, config: { systemInstruction } });
            return { text: lite.text ?? '', googleSources: [] as AggregatedSearchSource[], webSearchQueries: [] as string[], usedLite: true };
          }
          throw err;
        });

        const secondTask = hasValidOpenAIKey() && allowPaid
          ? callOpenAIChatGPT({
              systemInstruction: `${systemInstruction}\n\nAportá una segunda perspectiva analítica complementaria: conceptos clave, posibles sesgos o matices metodológicos y preguntas críticas para contrastar fuentes.`,
              messages: [{ role: 'user', content: userPrompt }],
            }).then((r) => ({ text: r.text, label: `ChatGPT (${r.modelUsed})` }))
          : (async () => {
              const ai = getGeminiClient();
              const lite = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: `Analizá desde un ángulo complementario (puntos clave rápidos, definiciones operativas y criterios para elegir fuente) el tema: "${cleanQuery}".\n${externalDigest}`,
                config: { systemInstruction: 'Respondé en español claro en Markdown conciso.' },
              });
              return { text: lite.text ?? '', label: `Análisis rápido (${LITE_MODEL_NAME})` };
            })();

        const [gemRes, secRes] = await Promise.allSettled([geminiTask, secondTask]);
        if (gemRes.status === 'fulfilled') {
          overviewMarkdown = gemRes.value.text;
          providerUsed = 'usedLite' in gemRes.value && gemRes.value.usedLite ? `gemini-lite (${LITE_MODEL_NAME})` : `gemini (${MODEL_NAME})`;
          searchQueries = gemRes.value.webSearchQueries;
          for (const gs of gemRes.value.googleSources) {
            if (!seenUrls.has(gs.url)) {
              seenUrls.add(gs.url);
              sources.push(gs);
            }
          }
        }
        if (secRes.status === 'fulfilled' && secRes.value.text.trim()) {
          if (!overviewMarkdown) {
            overviewMarkdown = secRes.value.text;
            providerUsed = secRes.value.label;
          } else {
            secondOpinionMarkdown = secRes.value.text;
            secondProviderUsed = secRes.value.label;
          }
        }
        if (!overviewMarkdown) {
          throw new Error('No se pudo obtener respuesta de los motores de IA consultados.');
        }
      } else {
        // 'auto' or 'gemini'
        try {
          const gemRes = await runGeminiSearch(enabledSources.has('google'));
          overviewMarkdown = gemRes.text;
          providerUsed = `gemini (${MODEL_NAME})`;
          searchQueries = gemRes.webSearchQueries;
          for (const gs of gemRes.googleSources) {
            if (!seenUrls.has(gs.url)) {
              seenUrls.add(gs.url);
              sources.push(gs);
            }
          }
        } catch (err) {
          if (aiProvider === 'auto' && isGoogleLimitError(err)) {
            if (hasValidOpenAIKey() && allowPaid) {
              const gpt = await callOpenAIChatGPT({
                systemInstruction,
                messages: [{ role: 'user', content: userPrompt }],
              });
              overviewMarkdown = gpt.text;
              providerUsed = `chatgpt-respaldo (${gpt.modelUsed})`;
            } else {
              const ai = getGeminiClient();
              const lite = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: userPrompt,
                config: { systemInstruction },
              });
              overviewMarkdown = lite.text ?? '';
              providerUsed = 'gemini-lite-respaldo';
            }
          } else {
            throw err;
          }
        }
      }

      // Append external academic/encyclopedic sources without duplicates
      for (const ext of externalSources) {
        if (!seenUrls.has(ext.url)) {
          seenUrls.add(ext.url);
          sources.push(ext);
        }
      }

      res.json({
        overviewMarkdown,
        secondOpinionMarkdown: secondOpinionMarkdown || undefined,
        providerUsed,
        secondProviderUsed: secondProviderUsed || undefined,
        sources,
        searchQueries,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 7. Web Source Reader & Multi-Source Summarizer (URL Context + Multi-IA)
  // ------------------------------------------------------------------
  app.post('/api/ai/source-summarize', async (req, res) => {
    try {
      const {
        sources = [],
        style = 'academico',
        mode = 'academico',
        subjectName = '',
        educationLevel = 'universitario',
        customFocus = '',
        aiProvider = 'auto',
      } = req.body ?? {};

      const validSources = (Array.isArray(sources) ? sources : [])
        .filter((s): s is { title?: string; url: string } => Boolean(s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url.trim())))
        .slice(0, 10)
        .map((s) => ({
          title: String(s.title || '').trim(),
          url: s.url.trim(),
        }));

      if (validSources.length === 0) {
        res.status(400).json({ error: 'Indicá al menos una URL válida (http:// o https://) para resumir.' });
        return;
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const modeDesc =
        mode === 'sencillo'
          ? 'Lenguaje claro, accesible, con definiciones simples y ejemplos cotidianos.'
          : 'Rigor académico, vocabulario técnico preciso, desarrollo conceptual profundo y estructura formal.';

      const stylePrompts: Record<string, string> = {
        interpretativo: 'Elaborá un RESUMEN INTERPRETATIVO Y EXPLICATIVO FABRO IA: explicá con profundidad qué plantea realmente la fuente, por qué ocurren los procesos o argumentos centrales, cómo se relacionan las ideas entre sí, traducí conceptos complejos con 1 o 2 ejemplos claros y cerrá con su implicancia práctica o académica.',
        ejecutivo: 'Elaborá un RESUMEN EJECUTIVO claro y directo: idea central, tesis o propósito de la fuente, conclusiones principales y relevancia práctica.',
        puntos_clave: 'Elaborá una SÍNTESIS EN PUNTOS CLAVE: lista estructurada de conceptos esenciales, definiciones importantes, datos verificados y conclusiones.',
        academico: 'Elaborá un ANÁLISIS ACADÉMICO COMPLETO para imprimir y estudiar: marco conceptual, argumentos desarrollados, conceptos clave, comparación entre fuentes (si hay más de una) y cierre crítico.',
        guia_estudio: 'Elaborá una GUÍA DE ESTUDIO IMPRIMIBLE basada en estas fuentes: objetivos de aprendizaje, resumen temático organizado, cuadro comparativo o definiciones clave y 5 preguntas de autoevaluación.',
      };

      const sourceListText = validSources
        .map((s, idx) => `${idx + 1}. ${s.title ? `${s.title} — ` : ''}${s.url}`)
        .join('\n');

      const prompt = `Analizá y resumí el contenido real de las siguientes fuentes web:
${sourceListText}

Contexto del estudiante: ${levelDesc}
${subjectName ? `Materia: ${subjectName}` : ''}
Modalidad: ${modeDesc}
Formato de resumen solicitado: ${stylePrompts[style] || stylePrompts.academico}
${customFocus ? `Enfoque adicional pedido por el estudiante: ${String(customFocus).slice(0, 500)}` : ''}

REGLAS OBLIGATORIAS:
1. Respondé siempre en español bien maquetado con Markdown (títulos con # / ##, listas limpias, tablas si aportan claridad), listo para guardar o imprimir.
2. Trabajá estrictamente sobre la información verificable de las URLs indicadas (usando lectura de URL y búsqueda si hace falta ampliar un contexto verificado). Si alguna página restringe su lectura completa, aclaralo honestamente sin inventar datos.
3. Incluí al final una sección **"## Fuentes consultadas"** listando únicamente las URLs reales consultadas.`;

      let summaryMarkdown = '';
      let secondOpinionMarkdown = '';
      let providerUsed = 'gemini';
      let secondProviderUsed = '';
      const extraSources: Array<{ title: string; url: string }> = [];

      const runGeminiSummarize = async () => {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            tools: [{ urlContext: {} }, { googleSearch: {} }],
          },
        });
        const candidate = response.candidates?.[0];
        const groundingChunks = Array.isArray(candidate?.groundingMetadata?.groundingChunks)
          ? candidate.groundingMetadata.groundingChunks
          : [];
        const seen = new Set(validSources.map((s) => s.url));
        for (const chunk of groundingChunks) {
          const uri = chunk?.web?.uri;
          if (uri && typeof uri === 'string' && !seen.has(uri)) {
            seen.add(uri);
            extraSources.push({ title: chunk?.web?.title || uri, url: uri });
          }
        }
        return response.text ?? 'No se pudo generar el resumen de esta fuente.';
      };

      const allowPaid = canUsePaidModelsFromRes(res);
      if (aiProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      if (aiProvider === 'chatgpt') {
        const gpt = await callOpenAIChatGPT({
          systemInstruction: 'Sos un analista académico de fuentes en español. Estructurá el texto limpio en Markdown.',
          messages: [{ role: 'user', content: prompt }],
        });
        summaryMarkdown = gpt.text;
        providerUsed = `chatgpt (${gpt.modelUsed})`;
      } else if (aiProvider === 'doble_ia') {
        const gemTask = runGeminiSummarize();
        const secTask = hasValidOpenAIKey() && allowPaid
          ? callOpenAIChatGPT({
              systemInstruction: 'Sos un segundo revisor académico independiente. Sintetizá conceptos críticos, preguntas de examen y matices de las fuentes dadas en Markdown.',
              messages: [{ role: 'user', content: prompt }],
            }).then((r) => ({ text: r.text, label: `ChatGPT (${r.modelUsed})` }))
          : (async () => {
              const ai = getGeminiClient();
              const lite = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: `Extraé un mapa rápido de conceptos clave, definiciones y 3 preguntas de examen sobre:\n${sourceListText}\n${customFocus || ''}`,
              });
              return { text: lite.text ?? '', label: `Síntesis complementaria (${LITE_MODEL_NAME})` };
            })();

        const [gemRes, secRes] = await Promise.allSettled([gemTask, secTask]);
        if (gemRes.status === 'fulfilled') {
          summaryMarkdown = gemRes.value;
          providerUsed = `gemini (${MODEL_NAME})`;
        }
        if (secRes.status === 'fulfilled' && secRes.value.text.trim()) {
          if (!summaryMarkdown) {
            summaryMarkdown = secRes.value.text;
            providerUsed = secRes.value.label;
          } else {
            secondOpinionMarkdown = secRes.value.text;
            secondProviderUsed = secRes.value.label;
          }
        }
        if (!summaryMarkdown) {
          throw new Error('No se pudo resumir la fuente con los motores de IA disponibles.');
        }
      } else {
        try {
          summaryMarkdown = await runGeminiSummarize();
          providerUsed = `gemini (${MODEL_NAME})`;
        } catch (err) {
          if (aiProvider === 'auto' && isGoogleLimitError(err)) {
            if (hasValidOpenAIKey() && allowPaid) {
              const gpt = await callOpenAIChatGPT({
                systemInstruction: 'Sos un analista académico en español. Respondé en Markdown claro.',
                messages: [{ role: 'user', content: prompt }],
              });
              summaryMarkdown = gpt.text;
              providerUsed = `chatgpt-respaldo (${gpt.modelUsed})`;
            } else {
              const ai = getGeminiClient();
              const lite = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: prompt,
              });
              summaryMarkdown = lite.text ?? '';
              providerUsed = 'gemini-lite-respaldo';
            }
          } else {
            throw err;
          }
        }
      }

      res.json({
        summaryMarkdown,
        secondOpinionMarkdown: secondOpinionMarkdown || undefined,
        providerUsed,
        secondProviderUsed: secondProviderUsed || undefined,
        analyzedSources: validSources,
        additionalSources: extraSources.slice(0, 6),
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 8. Multi-Source Comparison & Best Source Recommendation (Multi-IA)
  // ------------------------------------------------------------------
  app.post('/api/ai/source-compare', async (req, res) => {
    try {
      const {
        sources = [],
        topic = '',
        criteria = '',
        subjectName = '',
        educationLevel = 'universitario',
        aiProvider = 'auto',
      } = req.body ?? {};

      const seenUrls = new Set<string>();
      const validSources: Array<{ title: string; url: string; domain: string }> = [];
      for (const item of Array.isArray(sources) ? sources : []) {
        if (!item || typeof item.url !== 'string') continue;
        const cleanUrl = item.url.trim();
        if (!/^https?:\/\//i.test(cleanUrl) || seenUrls.has(cleanUrl)) continue;
        seenUrls.add(cleanUrl);
        let domain = typeof item.domain === 'string' && item.domain.trim() ? item.domain.trim() : '';
        if (!domain) {
          try {
            domain = new URL(cleanUrl).hostname.replace(/^www\./, '');
          } catch {
            domain = cleanUrl;
          }
        }
        validSources.push({
          title: String(item.title || domain || 'Fuente web').trim().slice(0, 200),
          url: cleanUrl,
          domain,
        });
        if (validSources.length >= 8) break;
      }

      if (validSources.length < 2) {
        res.status(400).json({ error: 'Seleccioná al menos 2 fuentes válidas (http:// o https://) para comparar.' });
        return;
      }

      const ai = getGeminiClient();
      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const sourceListText = validSources
        .map((s, idx) => `${idx + 1}. "${s.title}" (${s.domain}) — ${s.url}`)
        .join('\n');

      const analysisPrompt = `Compará en profundidad las siguientes ${validSources.length} fuentes web para ayudar al estudiante a elegir cuál es la mejor para estudiar y guardar como apunte:
${sourceListText}

${topic ? `Tema o búsqueda de referencia: ${String(topic).slice(0, 300)}` : ''}
${subjectName ? `Materia: ${subjectName}` : ''}
Nivel educativo del estudiante: ${levelDesc}
${criteria ? `Criterio prioritario pedido por el estudiante: ${String(criteria).slice(0, 400)}` : ''}

CRITERIOS DE EVALUACIÓN OBLIGATORIOS:
1. Rigor, autoridad y confiabilidad académica (institución, respaldo, precisión técnica).
2. Profundidad y cobertura temática (completitud de definiciones, argumentos o ejemplos).
3. Claridad pedagógica y estructura para estudiar/hacer apuntes.
4. Actualidad y utilidad práctica.

ESTRUCTURA DE RESPUESTA EN ESPAÑOL (MARKDOWN):
- Un título claro (# Análisis comparativo de fuentes).
- Un **Cuadro comparativo** en tabla Markdown comparando todas las fuentes por rigor, profundidad, claridad, puntos fuertes y limitaciones.
- Un **Análisis individual breve** de cada fuente (ventajas, debilidades y para qué conviene).
- Una sección final **"## Veredicto: Mejor fuente recomendada"** señalando explícitamente cuál es la mejor fuente para elegir y guardar como apunte, justificando con precisión por qué supera a las demás.

REGLA DE HONESTIDAD: Basate en el contenido real que puedas leer de cada URL y en información verificable. Si una página restringe lectura o es superficial, indicalo claramente y bajale el puntaje sin inventar datos.`;

      let comparisonMarkdown = '';
      let secondOpinionMarkdown = '';
      let providerUsed = 'gemini';
      let secondProviderUsed = '';

      const allowPaid = canUsePaidModelsFromRes(res);
      if (aiProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      if (aiProvider === 'chatgpt') {
        const gpt = await callOpenAIChatGPT({
          systemInstruction: 'Sos un evaluador académico imparcial. Respondé en Markdown bien estructurado.',
          messages: [{ role: 'user', content: analysisPrompt }],
        });
        comparisonMarkdown = gpt.text;
        providerUsed = `chatgpt (${gpt.modelUsed})`;
      } else {
        try {
          const groundedResponse = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: analysisPrompt,
            config: {
              tools: [{ urlContext: {} }, { googleSearch: {} }],
            },
          });
          comparisonMarkdown =
            groundedResponse.text ?? 'No se pudo completar el análisis comparativo de las fuentes.';
          providerUsed = `gemini (${MODEL_NAME})`;
        } catch (err) {
          if (aiProvider === 'auto' && isGoogleLimitError(err) && hasValidOpenAIKey() && allowPaid) {
            const gpt = await callOpenAIChatGPT({
              systemInstruction: 'Sos un evaluador académico imparcial. Respondé en Markdown claro.',
              messages: [{ role: 'user', content: analysisPrompt }],
            });
            comparisonMarkdown = gpt.text;
            providerUsed = `chatgpt-respaldo (${gpt.modelUsed})`;
          } else {
            throw err;
          }
        }

        if (aiProvider === 'doble_ia') {
          if (hasValidOpenAIKey()) {
            try {
              const gptSecond = await callOpenAIChatGPT({
                systemInstruction: 'Sos un segundo evaluador bibliográfico independiente en español.',
                messages: [
                  {
                    role: 'user',
                    content: `Revisá críticamente estas fuentes para el tema "${topic || 'estudio'}" (${levelDesc}) y señalá cuál priorizarías y qué vacíos cubrir complementando fuentes:\n${sourceListText}`,
                  },
                ],
              });
              secondOpinionMarkdown = gptSecond.text;
              secondProviderUsed = `ChatGPT (${gptSecond.modelUsed})`;
            } catch {
              // ignore secondary error
            }
          } else {
            try {
              const liteSecond = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: `Como segundo evaluador, indicá brevemente en Markdown qué combinación de estas fuentes da el apunte más completo:\n${sourceListText}`,
              });
              secondOpinionMarkdown = liteSecond.text ?? '';
              secondProviderUsed = `Revisión complementaria (${LITE_MODEL_NAME})`;
            } catch {
              // ignore secondary error
            }
          }
        }
      }

      const structPrompt = `A partir del siguiente análisis comparativo y la lista exacta de fuentes, extraé el ranking estructurado y la mejor fuente recomendada en JSON válido con las claves verdictSummary, recommendedUrl y rankings (array de {url, title, score, strengths, weaknesses, bestFor, summaryPreview}).

FUENTES EXACTAS (usá exactamente estas URLs sin modificarlas):
${sourceListText}

ANÁLISIS COMPARATIVO:
${comparisonMarkdown.slice(0, 60000)}`;

      let parsed: {
        verdictSummary?: string;
        recommendedUrl?: string;
        rankings?: Array<{
          url?: string;
          title?: string;
          score?: number;
          strengths?: string[];
          weaknesses?: string[];
          bestFor?: string;
          summaryPreview?: string;
        }>;
      } = {};

      if (aiProvider === 'chatgpt') {
        const gptStruct = await callOpenAIChatGPT({
          systemInstruction: 'Respondé únicamente JSON válido con las claves verdictSummary, recommendedUrl y rankings.',
          messages: [{ role: 'user', content: structPrompt }],
          responseJson: true,
        });
        parsed = JSON.parse((gptStruct.text || '{}').trim());
      } else {
        const structResponse = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: structPrompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                verdictSummary: {
                  type: Type.STRING,
                  description: 'Resumen breve en 2 a 3 oraciones explicando cuál es la mejor fuente recomendada y por qué.',
                },
                recommendedUrl: {
                  type: Type.STRING,
                  description: 'La URL exacta de la mejor fuente recomendada.',
                },
                rankings: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      url: { type: Type.STRING },
                      title: { type: Type.STRING },
                      score: { type: Type.INTEGER, description: 'Puntaje global de 0 a 100.' },
                      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                      weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                      bestFor: { type: Type.STRING },
                      summaryPreview: { type: Type.STRING },
                    },
                    required: ['url', 'title', 'score', 'strengths', 'weaknesses', 'bestFor', 'summaryPreview'],
                  },
                },
              },
              required: ['verdictSummary', 'recommendedUrl', 'rankings'],
            },
          },
        });
        parsed = JSON.parse((structResponse.text ?? '{}').trim());
      }

      const rawRankings = Array.isArray(parsed.rankings) ? parsed.rankings : [];
      const normalizedRankings = validSources.map((src, idx) => {
        const matched = rawRankings.find(
          (r) =>
            r.url === src.url ||
            (typeof r.url === 'string' && r.url.replace(/\/+$/, '') === src.url.replace(/\/+$/, ''))
        );
        const clampedScore =
          typeof matched?.score === 'number'
            ? Math.max(0, Math.min(100, Math.round(matched.score)))
            : Math.max(50, 85 - idx * 7);

        return {
          title: (matched?.title || src.title || src.domain).trim(),
          url: src.url,
          domain: src.domain,
          score: clampedScore,
          isRecommended: false,
          strengths: Array.isArray(matched?.strengths) ? matched.strengths.slice(0, 4) : [],
          weaknesses: Array.isArray(matched?.weaknesses) ? matched.weaknesses.slice(0, 3) : [],
          bestFor: matched?.bestFor || 'Consulta y referencia de estudio',
          summaryPreview: matched?.summaryPreview || '',
        };
      });

      normalizedRankings.sort((a, b) => b.score - a.score);
      const recUrlNorm = (parsed.recommendedUrl || '').replace(/\/+$/, '');
      const recIndex = normalizedRankings.findIndex(
        (r) => r.url === parsed.recommendedUrl || r.url.replace(/\/+$/, '') === recUrlNorm
      );
      if (recIndex >= 0) {
        normalizedRankings[recIndex].isRecommended = true;
      } else if (normalizedRankings.length > 0) {
        normalizedRankings[0].isRecommended = true;
      }

      const recommendedSource =
        normalizedRankings.find((r) => r.isRecommended) || normalizedRankings[0];

      res.json({
        comparisonMarkdown,
        secondOpinionMarkdown: secondOpinionMarkdown || undefined,
        providerUsed,
        secondProviderUsed: secondProviderUsed || undefined,
        verdictSummary: parsed.verdictSummary || '',
        recommendedUrl: recommendedSource?.url || validSources[0].url,
        rankings: normalizedRankings,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 9. Book Writing & Outlining Assistant
  // ------------------------------------------------------------------
  app.post('/api/ai/book-assist', async (req, res) => {
    try {
      const {
        action = 'continue',
        bookTitle = 'Libro sin título',
        bookSubtitle = '',
        genre = 'academico',
        synopsis = '',
        chapterTitle = '',
        chapterSummary = '',
        chapterText = '',
        existingChapters = [],
        customPrompt = '',
        educationLevel = 'universitario',
      } = req.body ?? {};

      const ai = getGeminiClient();
      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const chaptersList = Array.isArray(existingChapters)
        ? existingChapters.slice(0, 30).map((c, idx) => `${idx + 1}. ${String(c)}`).join('\n')
        : '';

      if (action === 'outline') {
        const outlinePrompt = `Sos un editor literario y académico experto trabajando dentro de FABRO.
Diseñá una propuesta de índice de capítulos coherente, progresiva y atractiva en español para este libro:
- Título: "${String(bookTitle).slice(0, 200)}"
${bookSubtitle ? `- Subtítulo: "${String(bookSubtitle).slice(0, 300)}"` : ''}
- Género: ${genre}
- Nivel de referencia: ${levelDesc}
- Sinopsis / propósito: ${String(synopsis).slice(0, 3000) || 'Sin sinopsis previa; proponé un desarrollo sólido acorde al título y género.'}
${chaptersList ? `- Capítulos ya creados:\n${chaptersList}` : ''}
${customPrompt ? `- Indicaciones del autor: ${String(customPrompt).slice(0, 800)}` : ''}

Devolvé un esquema JSON con una nota editorial breve y entre 5 y 10 capítulos bien estructurados (título y resumen breve de qué trata cada capítulo).`;

        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: outlinePrompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                editorialNote: {
                  type: Type.STRING,
                  description: 'Breve recomendación editorial en español sobre la estructura propuesta.',
                },
                chapters: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      summary: { type: Type.STRING },
                    },
                    required: ['title', 'summary'],
                  },
                },
              },
              required: ['editorialNote', 'chapters'],
            },
          },
        });

        const parsed = JSON.parse((response.text ?? '{}').trim()) as {
          editorialNote?: string;
          chapters?: Array<{ title?: string; summary?: string }>;
        };

        res.json({
          text: parsed.editorialNote || 'Propuesta de índice generada.',
          suggestedChapters: Array.isArray(parsed.chapters)
            ? parsed.chapters
                .filter((c) => c && typeof c.title === 'string' && c.title.trim())
                .map((c) => ({
                  title: String(c.title).trim().slice(0, 180),
                  summary: String(c.summary || '').trim().slice(0, 800),
                }))
            : [],
        });
        return;
      }

      const actionDirectives: Record<string, string> = {
        continue: 'Continuá redactando el capítulo actual de forma natural y fluida, manteniendo exactamente el tono, la voz, el tiempo verbal y la coherencia con lo ya escrito (2 a 4 párrafos bien logrados).',
        rewrite: 'Reescribí y pulí el fragmento o texto actual del capítulo para mejorar su ritmo, precisión léxica, claridad y elegancia literaria o académica, sin alterar la intención del autor.',
        expand: 'Ampliá y profundizá el desarrollo actual del capítulo agregando detalles sensoriales, argumentos sólidos, ejemplos o transiciones más ricas según el género del libro.',
        review: 'Realizá una revisión editorial crítica del capítulo actual: marcá fortalezas, posibles inconsistencias de ritmo/argumento, repeticiones y sugerencias concretas de mejora.',
        custom: String(customPrompt || '').trim() || 'Aportá ideas y un borrador útil para avanzar en este capítulo.',
      };

      const systemInstruction = `Sos el coautor y editor literario/académico de FABRO.
Respondé siempre en español cuidado, sin inventar citas bibliográficas ni datos falsos.
Si el usuario te pide texto narrativo o de ensayo para insertar en su libro, entregalo limpio y listo para leer (usando subtítulos con ## solo si corresponde al género).`;

      const prompt = `LIBRO: "${String(bookTitle).slice(0, 200)}"${bookSubtitle ? ` — ${String(bookSubtitle).slice(0, 200)}` : ''}
GÉNERO: ${genre}
SINOPSIS DEL LIBRO: ${String(synopsis).slice(0, 2500) || 'No especificada.'}
CAPÍTULO ACTUAL: "${String(chapterTitle || 'Capítulo sin título').slice(0, 200)}"
OBJETIVO / RESUMEN DEL CAPÍTULO: ${String(chapterSummary || '').slice(0, 800) || 'No especificado.'}
${chaptersList ? `ÍNDICE DEL LIBRO:\n${chaptersList}` : ''}

TEXTO ACTUAL DEL CAPÍTULO (extracto):
${String(chapterText || '').slice(-14000) || '(El capítulo aún está vacío; podés redactar la apertura).'}

TAREA SOLICITADA:
${actionDirectives[action] || actionDirectives.custom}
${action !== 'custom' && customPrompt ? `\nINDICACIÓN EXTRA DEL AUTOR: ${String(customPrompt).slice(0, 600)}` : ''}`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { systemInstruction },
      });

      res.json({
        text: response.text ?? 'No se pudo generar una sugerencia en este momento.',
        suggestedChapters: [],
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 10. Neural Text-to-Speech & MP3 Generator (gemini-3.8-flash-lite-tts)
  // ------------------------------------------------------------------
  const ALLOWED_TTS_VOICES = new Set(['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir']);

  function cleanTextForSpeech(raw: string): string {
    return (raw || '')
      .replace(/```[\s\S]*?```/g, ' Bloque de código. ')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
      .replace(/https?:\/\/[^\s)]+/gi, '')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^>\s+/gm, '')
      .replace(/\|/g, ', ')
      .replace(/^[-*_]{3,}$/gm, '. ')
      .replace(/\n{2,}/g, '. ')
      .replace(/\n+/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function splitSpeechChunks(text: string, maxChunkChars = 2200, maxChunks = 6): { chunks: string[]; truncated: boolean } {
    const maxTotal = maxChunkChars * maxChunks;
    const truncated = text.length > maxTotal;
    const bounded = truncated ? text.slice(0, maxTotal) : text;
    const sentences = bounded.split(/(?<=[.!?])\s+/);
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const piece = sentence.trim();
      if (!piece) continue;
      if (piece.length > maxChunkChars) {
        if (current) {
          chunks.push(current.trim());
          current = '';
        }
        for (let i = 0; i < piece.length; i += maxChunkChars) {
          chunks.push(piece.slice(i, i + maxChunkChars).trim());
        }
        continue;
      }
      if (current && current.length + piece.length + 1 > maxChunkChars) {
        chunks.push(current.trim());
        current = piece;
      } else {
        current = current ? `${current} ${piece}` : piece;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return { chunks: chunks.slice(0, maxChunks), truncated };
  }

  function extractWavPcmData(wavBuffer: Buffer): { pcm: Buffer; sampleRate: number; channels: number } {
    if (wavBuffer.length < 44 || wavBuffer.toString('ascii', 0, 4) !== 'RIFF') {
      return { pcm: wavBuffer, sampleRate: 24000, channels: 1 };
    }
    let offset = 12;
    let sampleRate = 24000;
    let channels = 1;
    while (offset + 8 <= wavBuffer.length) {
      const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = wavBuffer.readUInt32LE(offset + 4);
      const dataStart = offset + 8;
      if (chunkId === 'fmt ' && dataStart + 16 <= wavBuffer.length) {
        channels = wavBuffer.readUInt16LE(dataStart + 2) || 1;
        sampleRate = wavBuffer.readUInt32LE(dataStart + 4) || 24000;
      } else if (chunkId === 'data') {
        const end = Math.min(wavBuffer.length, dataStart + chunkSize);
        return { pcm: wavBuffer.subarray(dataStart, end), sampleRate, channels };
      }
      offset = dataStart + chunkSize + (chunkSize % 2);
    }
    return { pcm: wavBuffer.subarray(44), sampleRate, channels };
  }

  function encodePcmToMp3(pcmBuffer: Buffer, sampleRate = 24000, channels = 1): Buffer {
    const sampleCount = Math.floor(pcmBuffer.length / 2);
    const samples = new Int16Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      samples[i] = pcmBuffer.readInt16LE(i * 2);
    }
    const encoder = new Mp3Encoder(channels, sampleRate, 128);
    const mp3Parts: Buffer[] = [];
    const blockSize = 1152;
    for (let i = 0; i < samples.length; i += blockSize) {
      const slice = samples.subarray(i, i + blockSize);
      const encoded = encoder.encodeBuffer(slice);
      if (encoded.length > 0) mp3Parts.push(Buffer.from(encoded));
    }
    const flushed = encoder.flush();
    if (flushed.length > 0) mp3Parts.push(Buffer.from(flushed));
    return Buffer.concat(mp3Parts);
  }

  app.post('/api/ai/tts', async (req, res) => {
    try {
      const {
        text = '',
        title = 'audio-fabro',
        voiceName = 'Kore',
        style = 'Lectura educativa en español, clara, natural, articulada y con pausas didácticas adecuadas.',
        format = 'json',
      } = req.body ?? {};

      const spokenText = cleanTextForSpeech(String(text || ''));
      if (!spokenText || spokenText.length < 2) {
        res.status(400).json({ error: 'No hay texto suficiente para leer en voz alta o convertir a MP3.' });
        return;
      }

      const ai = getGeminiClient();
      const safeVoice = ALLOWED_TTS_VOICES.has(String(voiceName)) ? String(voiceName) : 'Kore';
      const safeStyle = String(style || '').trim().slice(0, 200) || 'Clear, warm Spanish academic narration';
      const { chunks, truncated } = splitSpeechChunks(spokenText);

      const pcmSegments: Buffer[] = [];
      let detectedSampleRate = 24000;
      let detectedChannels = 1;

      const apiKey = process.env.GEMINI_API_KEY;
      const aiBeta = apiKey
        ? new GoogleGenAI({
            apiKey,
            apiVersion: 'v1beta',
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          })
        : ai;
      const aiAlpha = apiKey
        ? new GoogleGenAI({
            apiKey,
            apiVersion: 'v1alpha',
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
          })
        : ai;

      for (const chunk of chunks) {
        let ttsResponse: GenerateContentResponse | undefined;
        const attempts: Array<() => Promise<GenerateContentResponse>> = [
          () =>
            aiBeta.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: [
                {
                  role: 'user',
                  parts: [{ text: chunk, speechMetadata: { style: safeStyle } }],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: safeVoice } },
                },
              },
            }),
          () =>
            aiAlpha.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: [
                {
                  role: 'user',
                  parts: [{ text: chunk, speechMetadata: { style: safeStyle } }],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: safeVoice } },
                },
              },
            }),
          () =>
            aiBeta.models.generateContent({
              model: 'gemini-2.5-flash-preview-tts',
              contents: [{ role: 'user', parts: [{ text: `Leé en español con tono claro y natural: ${chunk}` }] }],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: safeVoice } },
                },
              },
            }),
        ];

        let lastErr: unknown = null;
        for (const runAttempt of attempts) {
          try {
            ttsResponse = await runAttempt();
            if (ttsResponse?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data) {
              break;
            }
          } catch (err) {
            lastErr = err;
          }
        }
        if (!ttsResponse) {
          throw lastErr || new Error('TTS_UNAVAILABLE');
        }

        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          const wavBuf = Buffer.from(base64Audio, 'base64');
          const extracted = extractWavPcmData(wavBuf);
          detectedSampleRate = extracted.sampleRate;
          detectedChannels = extracted.channels;
          if (extracted.pcm.length > 0) {
            pcmSegments.push(extracted.pcm);
          }
        }
      }

      if (pcmSegments.length === 0) {
        res.status(502).json({ error: 'No se pudo sintetizar audio para este texto.' });
        return;
      }

      const fullPcm = Buffer.concat(pcmSegments);
      const mp3Buffer = encodePcmToMp3(fullPcm, detectedSampleRate, detectedChannels);

      if (format === 'binary') {
        const safeSlug = String(title || 'audio-fabro')
          .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]+/g, '_')
          .slice(0, 72);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', `attachment; filename="${safeSlug || 'audio-fabro'}.mp3"`);
        res.send(mp3Buffer);
        return;
      }

      res.json({
        audioBase64: mp3Buffer.toString('base64'),
        mimeType: 'audio/mpeg',
        byteLength: mp3Buffer.length,
        chunksCount: chunks.length,
        truncated,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // Subject AI Analysis & Google AI Mode Multi-Source Search
  // ------------------------------------------------------------------
  app.post('/api/ai/subject-research', async (req, res) => {
    try {
      const {
        subject = {},
        notesSummary = '',
        docsSummary = '',
        weakTopics = [],
        educationLevel = 'universitario',
        customFocus = '',
      } = req.body ?? {};

      const subjectName = String(subject?.name || '').trim();
      if (!subjectName) {
        res.status(400).json({ error: 'Falta el nombre de la materia para analizar.' });
        return;
      }

      const ai = getGeminiClient();
      const levelDesc = EDUCATION_LEVEL_LABELS[subject?.level || educationLevel] || EDUCATION_LEVEL_LABELS.universitario;

      const unitsList = Array.isArray(subject?.units)
        ? subject.units.map((u: unknown) => String(u)).filter(Boolean)
        : [];
      const weakList = Array.isArray(weakTopics)
        ? weakTopics.map((w: unknown) => String(w)).filter(Boolean)
        : [];

      const subjectContext = [
        `MATERIA: ${subjectName}`,
        `NIVEL EDUCATIVO: ${levelDesc}`,
        subject?.career ? `CARRERA / ÁREA: ${String(subject.career).slice(0, 150)}` : '',
        subject?.institution ? `INSTITUCIÓN: ${String(subject.institution).slice(0, 150)}` : '',
        subject?.professor ? `CÁTEDRA / DOCENTE: ${String(subject.professor).slice(0, 150)}` : '',
        subject?.description ? `DESCRIPCIÓN: ${String(subject.description).slice(0, 2000)}` : '',
        unitsList.length > 0 ? `UNIDADES CARGADAS:\n${unitsList.map((u: string, i: number) => `${i + 1}. ${u}`).join('\n')}` : 'UNIDADES CARGADAS: Ninguna aún.',
        subject?.bibliography ? `BIBLIOGRAFÍA CARGADA:\n${String(subject.bibliography).slice(0, 5000)}` : '',
        subject?.syllabus ? `PROGRAMA ESCRITO:\n${String(subject.syllabus).slice(0, 10000)}` : '',
        subject?.syllabusExtractedText
          ? `PROGRAMA DE ESTUDIO ADJUNTO (${String(subject.syllabusFileName || 'archivo')}):\n${String(subject.syllabusExtractedText).slice(0, 45000)}`
          : '',
        notesSummary ? `APUNTES DEL ESTUDIANTE EN ESTA MATERIA:\n${String(notesSummary).slice(0, 15000)}` : '',
        docsSummary ? `DOCUMENTOS EN BIBLIOTECA VINCULADOS:\n${String(docsSummary).slice(0, 15000)}` : '',
        weakList.length > 0 ? `TEMAS DÉBILES DETECTADOS EN EXÁMENES:\n- ${weakList.join('\n- ')}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const systemInstruction = `Sos el motor de análisis curricular y búsqueda multi-fuente Modo IA de FABRO (herramienta educativa gratuita para facilitar el conocimiento de los estudiantes).
Tu tarea es analizar TODOS los datos cargados en la materia del estudiante (incluyendo el programa de estudio adjunto, unidades, bibliografía, apuntes, biblioteca y exámenes) y buscar en Google múltiples fuentes académicas variadas para potenciar su estudio.

REGLAS OBLIGATORIAS:
1. Respondé siempre en español claro, riguroso y didáctico adaptado al nivel (${levelDesc}).
2. Integrá todos los datos cargados de la materia: detectá qué unidades cubre el programa oficial, qué material ya tiene cubierto el estudiante en sus apuntes/biblioteca y qué áreas faltan reforzar.
3. Si hay búsqueda web activa, contrastá y sintetizá MÚLTIPLES fuentes académicas diversas (apuntes universitarios abiertos, repositorios científicos como SciELO/Dialnet/Redalyc/arXiv, manuales reconocidos, guías de ejercicios y documentación oficial).
4. Incluí ejemplos concretos aplicados a la materia y recomendaciones de estudio por bloques.
5. Estructurá la respuesta en Markdown profesional con estas secciones:
   ## 1. Diagnóstico integral de la materia y del programa
   ## 2. Mapa de contenidos y prioridades por unidad
   ## 3. Síntesis multi-fuente (Modo IA) y ejemplos clave
   ## 4. Bibliografía complementaria y plan de acción
6. Nunca inventes URLs ni papers inexistentes.`;

      const userPrompt = customFocus
        ? `Analizá toda la información cargada en esta materia y realizá una búsqueda multi-fuente Modo IA priorizando este enfoque: "${String(customFocus).slice(0, 500)}".\n\n${subjectContext}`
        : `Analizá en profundidad toda la información cargada en esta materia (programa de estudio adjunto y escrito, unidades, bibliografía, apuntes, documentos y puntos débiles) y buscá múltiples fuentes académicas actualizadas en Google para enriquecer la cursada.\n\n${subjectContext}`;

      let response: GenerateContentResponse;
      let webFallbackUsed = false;

      try {
        response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            tools: [{ googleSearch: {} }],
          },
        });
      } catch {
        webFallbackUsed = true;
        response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          config: {
            systemInstruction: `${systemInstruction}\n\nNOTA OPERATIVA: La búsqueda web en vivo no estuvo disponible momentáneamente por límite de cuota; realizá el análisis integral completo sobre los datos cargados de la materia y tu conocimiento académico consolidado, sin inventar URLs.`,
            thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          },
        });
      }

      const metadata = response.candidates?.[0]?.groundingMetadata;
      const rawChunks = Array.isArray(metadata?.groundingChunks) ? metadata.groundingChunks : [];
      const seenUrls = new Set<string>();
      const sources: Array<{ title: string; url: string; domain: string; category: string }> = [];

      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        if (!uri || typeof uri !== 'string' || seenUrls.has(uri)) continue;
        seenUrls.add(uri);
        let domain = '';
        try {
          domain = new URL(uri).hostname.replace(/^www\./, '');
        } catch {
          domain = uri;
        }
        const category = /edu|ac\.|uva\.|uba\.|unc\.|unam\.|mit\.|stanford\.|scielo|redalyc|dialnet|arxiv|scholar|gob\./i.test(
          domain
        )
          ? 'Académica / Institucional'
          : /wikipedia|britannica|khanacademy|coursera/i.test(domain)
            ? 'Enciclopedia / Curso abierto'
            : 'Referencia web';
        sources.push({
          title: String(chunk?.web?.title || domain || 'Fuente académica').trim().slice(0, 200),
          url: uri.slice(0, 2000),
          domain: domain.slice(0, 200),
          category,
        });
        if (sources.length >= 16) break;
      }

      const searchQueries = Array.isArray(metadata?.webSearchQueries)
        ? metadata.webSearchQueries.filter((q): q is string => typeof q === 'string').slice(0, 6)
        : [];

      // Secondary fast structured extraction: detect units from syllabus if present
      let suggestedUnits: string[] = [];
      let suggestedBibliography: string[] = [];
      const rawSyllabusSource = [
        subject?.syllabus ? String(subject.syllabus) : '',
        subject?.syllabusExtractedText ? String(subject.syllabusExtractedText) : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      if (rawSyllabusSource.trim().length > 25) {
        try {
          const extractResp = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: `Extraé las unidades o módulos temáticos reales y las obras bibliográficas mencionadas en este programa de estudio de la materia "${subjectName}". Si ya están bien definidos en el programa, conservalos limpios y ordenados.\n\n${rawSyllabusSource.slice(0, 30000)}`,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  units: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  bibliography: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['units', 'bibliography'],
              },
            },
          });
          const parsedStruct = JSON.parse((extractResp.text ?? '{}').trim()) as {
            units?: unknown[];
            bibliography?: unknown[];
          };
          if (Array.isArray(parsedStruct.units)) {
            suggestedUnits = parsedStruct.units
              .map((u) => String(u).trim().slice(0, 200))
              .filter(Boolean)
              .slice(0, 25);
          }
          if (Array.isArray(parsedStruct.bibliography)) {
            suggestedBibliography = parsedStruct.bibliography
              .map((b) => String(b).trim().slice(0, 250))
              .filter(Boolean)
              .slice(0, 20);
          }
        } catch {
          // Optional extraction failure shouldn't block primary analysis
        }
      }

      res.json({
        analysisMarkdown: (response.text ?? '').slice(0, 60000),
        sources,
        searchQueries,
        suggestedUnits,
        suggestedBibliography,
        webFallbackUsed,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // Academic Dictionary Lookup (with Gemini + ChatGPT fallback)
  // ------------------------------------------------------------------
  app.post('/api/ai/dictionary', async (req, res) => {
    try {
      const {
        term = '',
        subjectName = '',
        educationLevel = 'universitario',
        aiProvider = 'auto',
      } = req.body ?? {};

      const cleanTerm = String(term).trim().slice(0, 160);
      if (!cleanTerm) {
        res.status(400).json({ error: 'Ingresá un término o concepto para buscar en el diccionario.' });
        return;
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const prompt = `Sos un diccionario académico enciclopédico en español.
Definí con rigor el término: "${cleanTerm}".
${subjectName ? `Contexto de materia: ${String(subjectName).slice(0, 120)}.` : ''}
Nivel del estudiante: ${levelDesc}.

Devolvé un objeto JSON estricto con estas claves exactas:
{
  "term": "Término con ortografía normalizada",
  "category": "Categoría gramatical o disciplina (ej. Sustantivo / Derecho Constitucional)",
  "phonetic": "Pronunciación aproximada o IPA si aplica (cadena vacía si no aplica)",
  "definition": "Definición clara, directa y comprensible en 2-4 oraciones",
  "academicDefinition": "Desarrollo conceptual riguroso con matices, contexto teórico y uso técnico",
  "examples": ["Ejemplo 1 en contexto", "Ejemplo 2 aplicado"],
  "synonyms": ["sinónimo o término afín 1", "término afín 2"],
  "etymology": "Breve origen etimológico o raíz histórica del término"
}`;

      let parsed: Record<string, unknown> = {};
      let providerUsed = 'gemini';

      const runOpenAIDict = async () => {
        const gpt = await callOpenAIChatGPT({
          systemInstruction: 'Respondé únicamente JSON válido con la estructura solicitada.',
          messages: [{ role: 'user', content: prompt }],
          responseJson: true,
        });
        providerUsed = `chatgpt (${gpt.modelUsed})`;
        return JSON.parse((gpt.text || '{}').trim());
      };

      const allowPaid = canUsePaidModelsFromRes(res);
      if (aiProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      if (aiProvider === 'chatgpt') {
        parsed = await runOpenAIDict();
      } else {
        const ai = getGeminiClient();
        try {
          const resp = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  category: { type: Type.STRING },
                  phonetic: { type: Type.STRING },
                  definition: { type: Type.STRING },
                  academicDefinition: { type: Type.STRING },
                  examples: { type: Type.ARRAY, items: { type: Type.STRING } },
                  synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
                  etymology: { type: Type.STRING },
                },
                required: ['term', 'category', 'phonetic', 'definition', 'academicDefinition', 'examples', 'synonyms', 'etymology'],
              },
            },
          });
          parsed = JSON.parse((resp.text ?? '{}').trim());
        } catch (err) {
          if (aiProvider === 'auto' && isGoogleLimitError(err)) {
            if (hasValidOpenAIKey() && allowPaid) {
              parsed = await runOpenAIDict();
            } else {
              const respLite = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: prompt,
                config: { responseMimeType: 'application/json' },
              });
              parsed = JSON.parse((respLite.text ?? '{}').trim());
              providerUsed = 'gemini-lite-respaldo';
            }
          } else {
            throw err;
          }
        }
      }

      res.json({
        term: String(parsed.term || cleanTerm).slice(0, 160),
        category: String(parsed.category || 'Concepto académico').slice(0, 80),
        phonetic: String(parsed.phonetic || '').slice(0, 120),
        definition: String(parsed.definition || 'Definición no disponible.').slice(0, 4000),
        academicDefinition: String(parsed.academicDefinition || '').slice(0, 6000),
        examples: Array.isArray(parsed.examples)
          ? parsed.examples.map((e) => String(e).slice(0, 800)).filter(Boolean).slice(0, 10)
          : [],
        synonyms: Array.isArray(parsed.synonyms)
          ? parsed.synonyms.map((s) => String(s).slice(0, 120)).filter(Boolean).slice(0, 20)
          : [],
        etymology: String(parsed.etymology || '').slice(0, 1500),
        providerUsed,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // Unit Topic-by-Topic Breakdown into Separate Study Notes
  // ------------------------------------------------------------------
  app.post('/api/ai/unit-topics-notes', async (req, res) => {
    try {
      const {
        subjectName = '',
        unit = '',
        syllabusContext = '',
        educationLevel = 'universitario',
        aiProvider = 'auto',
      } = req.body ?? {};

      if (!subjectName || !unit) {
        res.status(400).json({ error: 'Indicá la materia y la unidad a desarrollar.' });
        return;
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const prompt = `Sos un profesor universitario experto preparando apuntes de estudio organizados tema por tema para que el estudiante empiece de forma ordenada por esta unidad.
Materia: "${String(subjectName).slice(0, 120)}"
Unidad a desarrollar: "${String(unit).slice(0, 200)}"
Nivel: ${levelDesc}
${syllabusContext ? `Programa / contexto cargado:\n${String(syllabusContext).slice(0, 15000)}` : ''}

Desglosá esta unidad en entre 3 y 5 temas fundamentales progresivos. Para cada tema, redactá un apunte independiente completo en Markdown claro (con definición conceptual, desarrollo profundo paso a paso, al menos 1 ejemplo concreto aplicado, puntos clave para recordar y 2 preguntas rápidas de autoevaluación).

Devolvé un objeto JSON estricto:
{
  "topics": [
    {
      "title": "Tema 1: Nombre claro del tema",
      "summary": "Síntesis de 1 oración sobre qué aporta este tema",
      "markdownContent": "## ...",
      "tags": ["unidad", "tema1"]
    }
  ]
}`;

      let parsed: { topics?: unknown[] } = {};
      let providerUsed = 'gemini';

      const runOpenAI = async () => {
        const gpt = await callOpenAIChatGPT({
          systemInstruction: 'Respondé únicamente JSON válido con el arreglo topics.',
          messages: [{ role: 'user', content: prompt }],
          preferHeavyModel: true,
          responseJson: true,
        });
        providerUsed = `chatgpt (${gpt.modelUsed})`;
        return JSON.parse((gpt.text || '{}').trim()) as { topics?: unknown[] };
      };

      const allowPaid = canUsePaidModelsFromRes(res);
      if (aiProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      if (aiProvider === 'chatgpt') {
        parsed = await runOpenAI();
      } else {
        const ai = getGeminiClient();
        try {
          const resp = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  topics: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        markdownContent: { type: Type.STRING },
                        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      },
                      required: ['title', 'summary', 'markdownContent', 'tags'],
                    },
                  },
                },
                required: ['topics'],
              },
            },
          });
          parsed = JSON.parse((resp.text ?? '{}').trim()) as { topics?: unknown[] };
        } catch (err) {
          if (aiProvider === 'auto' && isGoogleLimitError(err)) {
            if (hasValidOpenAIKey() && allowPaid) {
              parsed = await runOpenAI();
            } else {
              const respLite = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: prompt,
                config: { responseMimeType: 'application/json' },
              });
              parsed = JSON.parse((respLite.text ?? '{}').trim()) as { topics?: unknown[] };
              providerUsed = 'gemini-lite-respaldo';
            }
          } else {
            throw err;
          }
        }
      }

      const topics = Array.isArray(parsed.topics)
        ? parsed.topics.slice(0, 6).map((item, idx) => {
            const obj = (item || {}) as Record<string, unknown>;
            return {
              title: String(obj.title || `Tema ${idx + 1}`).slice(0, 180),
              summary: String(obj.summary || '').slice(0, 400),
              markdownContent: String(obj.markdownContent || '').slice(0, 40000),
              tags: Array.isArray(obj.tags)
                ? obj.tags.map((t) => String(t).slice(0, 40)).filter(Boolean).slice(0, 8)
                : [],
            };
          })
        : [];

      res.json({ unit, topics, providerUsed });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // Visual Study Studio: Schemas & Periodic Historical Chronological Timelines
  // ------------------------------------------------------------------
  app.post('/api/ai/visual-study', async (req, res) => {
    try {
      const {
        kind = 'esquema',
        topic = '',
        contextText = '',
        subjectName = '',
        educationLevel = 'universitario',
        aiProvider = 'auto',
      } = req.body ?? {};

      const cleanTopic = String(topic || subjectName || '').trim();
      if (!cleanTopic && !contextText) {
        res.status(400).json({ error: 'Indicá un tema o contenido para construir el esquema o la línea cronológica.' });
        return;
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const isTimeline = kind === 'linea_cronologica';
      let providerUsed = 'gemini';

      if (isTimeline) {
        const prompt = `Construí una LÍNEA PERIÓDICA HISTÓRICA CRONOLÓGICA rigurosa y didáctica en español.
Tema / Materia: "${cleanTopic}" ${subjectName ? `(${String(subjectName).slice(0, 120)})` : ''}
Nivel: ${levelDesc}
${contextText ? `Material base del estudiante:\n${String(contextText).slice(0, 20000)}` : ''}

Organizá los acontecimientos estrictamente en orden cronológico agrupados por PERÍODOS HISTÓRICOS o ETAPAS claras (entre 3 y 6 períodos, cada uno con entre 2 y 5 hitos concretos con fecha/año, título, descripción, protagonistas/autores e importancia o consecuencia histórica).

Devolvé un JSON estricto:
{
  "title": "Título de la línea periódica cronológica",
  "subtitle": "Alcance temático y criterio de periodización",
  "timeSpan": "Ej. Siglo XVIII – 1945",
  "periods": [
    {
      "periodName": "Nombre del período o etapa",
      "dateRange": "Ej. 1789 – 1815",
      "focus": "Idea rectora del período",
      "events": [
        {
          "date": "1789",
          "title": "Hito histórico o conceptual",
          "description": "Explicación clara de qué ocurrió y por qué",
          "protagonists": "Actores, pensadores o procesos clave",
          "significance": "Impacto o consecuencia directa"
        }
      ]
    }
  ]
}`;

        const allowPaid = canUsePaidModelsFromRes(res);
        if (aiProvider === 'chatgpt' && !allowPaid) {
          rejectPaidModelNotAllowed(res);
          return;
        }

        let parsed: Record<string, unknown> = {};
        if (aiProvider === 'chatgpt') {
          const gpt = await callOpenAIChatGPT({
            systemInstruction: 'Respondé únicamente JSON válido con la estructura solicitada.',
            messages: [{ role: 'user', content: prompt }],
            responseJson: true,
          });
          providerUsed = `chatgpt (${gpt.modelUsed})`;
          parsed = JSON.parse((gpt.text || '{}').trim());
        } else {
          const ai = getGeminiClient();
          try {
            const resp = await ai.models.generateContent({
              model: MODEL_NAME,
              contents: prompt,
              config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    subtitle: { type: Type.STRING },
                    timeSpan: { type: Type.STRING },
                    periods: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          periodName: { type: Type.STRING },
                          dateRange: { type: Type.STRING },
                          focus: { type: Type.STRING },
                          events: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                date: { type: Type.STRING },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                protagonists: { type: Type.STRING },
                                significance: { type: Type.STRING },
                              },
                              required: ['date', 'title', 'description', 'protagonists', 'significance'],
                            },
                          },
                        },
                        required: ['periodName', 'dateRange', 'focus', 'events'],
                      },
                    },
                  },
                  required: ['title', 'subtitle', 'timeSpan', 'periods'],
                },
              },
            });
            parsed = JSON.parse((resp.text ?? '{}').trim());
          } catch (err) {
            if (aiProvider === 'auto' && isGoogleLimitError(err)) {
              if (hasValidOpenAIKey() && allowPaid) {
                const gpt = await callOpenAIChatGPT({
                  systemInstruction: 'Respondé únicamente JSON válido con la estructura solicitada.',
                  messages: [{ role: 'user', content: prompt }],
                  responseJson: true,
                });
                providerUsed = `chatgpt-respaldo (${gpt.modelUsed})`;
                parsed = JSON.parse((gpt.text || '{}').trim());
              } else {
                const respLite = await ai.models.generateContent({
                  model: LITE_MODEL_NAME,
                  contents: prompt,
                  config: { responseMimeType: 'application/json' },
                });
                providerUsed = 'gemini-lite-respaldo';
                parsed = JSON.parse((respLite.text ?? '{}').trim());
              }
            } else {
              throw err;
            }
          }
        }

        res.json({ kind: 'linea_cronologica', timelineData: parsed, providerUsed });
        return;
      }

      // Mode: 'esquema' (Conceptual / Synoptic Schema)
      const prompt = `Construí un ESQUEMA DE ESTUDIO JERÁRQUICO Y CUADRO SINÓPTICO claro y completo en español.
Tema / Materia: "${cleanTopic}" ${subjectName ? `(${String(subjectName).slice(0, 120)})` : ''}
Nivel: ${levelDesc}
${contextText ? `Material base del estudiante:\n${String(contextText).slice(0, 20000)}` : ''}

Descomponé el tema en entre 4 y 7 ramas principales lógicas, cada una con síntesis, subpuntos jerarquizados, ejemplo breve y relaciones cruzadas entre ramas.

Devolvé un JSON estricto:
{
  "title": "Título del esquema",
  "subtitle": "Propósito o enfoque del esquema",
  "rootConcept": "Concepto o núcleo central",
  "branches": [
    {
      "label": "1. Rama principal",
      "summary": "Síntesis clara en 1-2 oraciones",
      "subitems": ["Subpunto A: ...", "Subpunto B: ...", "Subpunto C: ..."],
      "example": "Ejemplo concreto o caso ilustrativo"
    }
  ],
  "connections": ["Relación clave 1 entre ramas", "Relación clave 2"]
}`;

      const allowPaid = canUsePaidModelsFromRes(res);
      if (aiProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      let parsed: Record<string, unknown> = {};
      if (aiProvider === 'chatgpt') {
        const gpt = await callOpenAIChatGPT({
          systemInstruction: 'Respondé únicamente JSON válido con la estructura solicitada.',
          messages: [{ role: 'user', content: prompt }],
          responseJson: true,
        });
        providerUsed = `chatgpt (${gpt.modelUsed})`;
        parsed = JSON.parse((gpt.text || '{}').trim());
      } else {
        const ai = getGeminiClient();
        try {
          const resp = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  subtitle: { type: Type.STRING },
                  rootConcept: { type: Type.STRING },
                  branches: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        subitems: { type: Type.ARRAY, items: { type: Type.STRING } },
                        example: { type: Type.STRING },
                      },
                      required: ['label', 'summary', 'subitems', 'example'],
                    },
                  },
                  connections: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['title', 'subtitle', 'rootConcept', 'branches', 'connections'],
              },
            },
          });
          parsed = JSON.parse((resp.text ?? '{}').trim());
        } catch (err) {
          if (aiProvider === 'auto' && isGoogleLimitError(err)) {
            if (hasValidOpenAIKey() && allowPaid) {
              const gpt = await callOpenAIChatGPT({
                systemInstruction: 'Respondé únicamente JSON válido con la estructura solicitada.',
                messages: [{ role: 'user', content: prompt }],
                responseJson: true,
              });
              providerUsed = `chatgpt-respaldo (${gpt.modelUsed})`;
              parsed = JSON.parse((gpt.text || '{}').trim());
            } else {
              const respLite = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: prompt,
                config: { responseMimeType: 'application/json' },
              });
              providerUsed = 'gemini-lite-respaldo';
              parsed = JSON.parse((respLite.text ?? '{}').trim());
            }
          } else {
            throw err;
          }
        }
      }

      res.json({ kind: 'esquema', schemaData: parsed, providerUsed });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // Multi-Repository Encyclopedic & Archival Visual Explorer
  // ------------------------------------------------------------------
  const handleEncyclopediaImagesSearch = async (req: express.Request, res: express.Response) => {
    try {
      const q = String(req.query.q || '').trim().slice(0, 160);
      const limit = Math.min(28, Math.max(4, Number(req.query.limit || 18)));
      const sourcesParam = String(req.query.sources || 'all').toLowerCase();
      if (!q) {
        res.status(400).json({ error: 'Indicá un término o tema para explorar imágenes enciclopédicas.' });
        return;
      }

      const requestedSet = new Set(
        sourcesParam === 'all'
          ? ['enciclopedia', 'commons', 'nasa', 'openverse', 'met']
          : sourcesParam.split(',').map((s) => s.trim()).filter(Boolean)
      );
      if (requestedSet.size === 0) {
        requestedSet.add('enciclopedia');
        requestedSet.add('commons');
      }

      const headers = {
        'User-Agent': 'FABRO-Educational-Platform/1.0 (https://aistudio.google.com)',
        Accept: 'application/json',
      };

      const stripHtml = (raw: string): string =>
        String(raw || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&')
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/\s+/g, ' ')
          .trim();

      interface EncyclopediaImageResult {
        id: string;
        title: string;
        thumbUrl: string;
        fullUrl: string;
        description: string;
        extendedInfo?: string;
        author: string;
        license: string;
        dateCreated?: string;
        dimensions?: string;
        mimeType?: string;
        categoryTag?: string;
        sourceName: string;
        sourceDomain: string;
        sourcePageUrl: string;
        width?: number;
        height?: number;
        source: 'enciclopedia' | 'commons' | 'nasa' | 'openverse' | 'met';
      }

      interface EncyclopediaArticleSummary {
        title: string;
        summary: string;
        url: string;
        sourceName: string;
      }

      const results: EncyclopediaImageResult[] = [];
      const seenUrls = new Set<string>();
      const sourceCounts: Record<string, number> = {};
      let primaryArticle: EncyclopediaArticleSummary | null = null;

      const pushResult = (item: EncyclopediaImageResult) => {
        if (!item.thumbUrl || !item.fullUrl) return;
        const norm = item.fullUrl.split('?')[0];
        if (seenUrls.has(norm)) return;
        seenUrls.add(norm);
        results.push(item);
        sourceCounts[item.source] = (sourceCounts[item.source] || 0) + 1;
      };

      const fetchEncyclopediaES = async () => {
        const wpUrl = `https://es.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          q
        )}&gsrlimit=8&prop=pageimages|extracts|info&inprop=url&piprop=thumbnail|original&pithumbsize=720&exintro=1&explaintext=1&exsentences=5&format=json&origin=*`;
        const wpResp = await fetch(wpUrl, { headers, signal: AbortSignal.timeout(4500) });
        if (!wpResp.ok) return;
        const wpData = (await wpResp.json().catch(() => ({}))) as {
          query?: {
            pages?: Record<
              string,
              {
                pageid?: number;
                title?: string;
                fullurl?: string;
                extract?: string;
                thumbnail?: { source?: string; width?: number; height?: number };
                original?: { source?: string; width?: number; height?: number };
              }
            >;
          };
        };
        const pages = Object.values(wpData?.query?.pages || {});
        for (const page of pages) {
          const cleanExtract = stripHtml(page.extract || '');
          if (!primaryArticle && cleanExtract.length > 60 && page.fullurl) {
            primaryArticle = {
              title: String(page.title || q),
              summary: cleanExtract.slice(0, 750),
              url: page.fullurl,
              sourceName: 'Enciclopedia Libre (ES)',
            };
          }
          const thumb = page.thumbnail?.source;
          const full = page.original?.source || thumb;
          if (!thumb || !full) continue;
          if (/\.svg(\?|$)/i.test(full) && !thumb) continue;
          const w = page.original?.width || page.thumbnail?.width;
          const h = page.original?.height || page.thumbnail?.height;
          pushResult({
            id: `enc_es_${page.pageid || results.length}`,
            title: String(page.title || q),
            thumbUrl: thumb,
            fullUrl: full,
            description: cleanExtract.slice(0, 280) || `Lámina enciclopédica de referencia sobre ${page.title || q}.`,
            extendedInfo: cleanExtract.slice(0, 900) || undefined,
            author: 'Archivo enciclopédico colaborativo',
            license: 'CC BY-SA / Libre uso educativo',
            dimensions: w && h ? `${w} × ${h} px` : undefined,
            categoryTag: 'Enciclopedia',
            sourceName: 'Enciclopedia Libre ES',
            sourceDomain: 'es.wikipedia.org',
            sourcePageUrl: page.fullurl || `https://es.wikipedia.org/wiki/${encodeURIComponent(page.title || q)}`,
            width: w,
            height: h,
            source: 'enciclopedia',
          });
        }
      };

      const fetchCommons = async () => {
        const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
          q
        )}&gsrlimit=12&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=760&format=json&origin=*`;
        const cmResp = await fetch(commonsUrl, { headers, signal: AbortSignal.timeout(4500) });
        if (!cmResp.ok) return;
        const cmData = (await cmResp.json().catch(() => ({}))) as {
          query?: {
            pages?: Record<
              string,
              {
                pageid?: number;
                title?: string;
                imageinfo?: Array<{
                  url?: string;
                  thumburl?: string;
                  descriptionurl?: string;
                  mime?: string;
                  width?: number;
                  height?: number;
                  extmetadata?: Record<string, { value?: string }>;
                }>;
              }
            >;
          };
        };
        const pages = Object.values(cmData?.query?.pages || {});
        for (const page of pages) {
          const info = page.imageinfo?.[0];
          if (!info) continue;
          if (info.mime && !info.mime.startsWith('image/')) continue;
          const thumb = info.thumburl || info.url;
          const full = info.url || info.thumburl;
          if (!thumb || !full) continue;
          const meta = info.extmetadata || {};
          const rawTitle = String(page.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/_/g, ' ');
          const objName = stripHtml(meta.ObjectName?.value || '');
          const desc = stripHtml(meta.ImageDescription?.value || '');
          const artist = stripHtml(meta.Artist?.value || '') || 'Wikimedia Commons';
          const license = stripHtml(meta.LicenseShortName?.value || '') || 'Dominio público / CC';
          const dateVal = stripHtml(meta.DateTimeOriginal?.value || meta.DateTime?.value || '');
          const cats = stripHtml(meta.Categories?.value || '')
            .split('|')
            .slice(0, 3)
            .join(' · ');
          pushResult({
            id: `cm_${page.pageid || results.length}`,
            title: (objName || rawTitle || q).slice(0, 140),
            thumbUrl: thumb,
            fullUrl: full,
            description: (desc || rawTitle || `Recurso gráfico documental sobre ${q}`).slice(0, 320),
            extendedInfo: desc.length > 320 ? desc.slice(0, 900) : cats || undefined,
            author: artist.slice(0, 120),
            license: license.slice(0, 80),
            dateCreated: dateVal ? dateVal.slice(0, 40) : undefined,
            dimensions: info.width && info.height ? `${info.width} × ${info.height} px` : undefined,
            mimeType: info.mime || undefined,
            categoryTag: cats ? cats.slice(0, 80) : 'Mediateca científica y documental',
            sourceName: 'Wikimedia Commons',
            sourceDomain: 'commons.wikimedia.org',
            sourcePageUrl: info.descriptionurl || full,
            width: info.width,
            height: info.height,
            source: 'commons',
          });
        }
      };

      const fetchNasa = async () => {
        const nasaUrl = `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=6`;
        const resp = await fetch(nasaUrl, { headers, signal: AbortSignal.timeout(4500) });
        if (!resp.ok) return;
        const data = (await resp.json().catch(() => ({}))) as {
          collection?: {
            items?: Array<{
              href?: string;
              data?: Array<{
                nasa_id?: string;
                title?: string;
                description?: string;
                date_created?: string;
                center?: string;
                photographer?: string;
                keywords?: string[];
              }>;
              links?: Array<{ href?: string; rel?: string; render?: string }>;
            }>;
          };
        };
        for (const item of (data?.collection?.items || []).slice(0, 6)) {
          const meta = item.data?.[0];
          const previewLink = item.links?.find((l) => l.rel === 'preview' || l.render === 'image')?.href;
          if (!meta || !previewLink) continue;
          const fullDesc = stripHtml(meta.description || '');
          pushResult({
            id: `nasa_${meta.nasa_id || results.length}`,
            title: String(meta.title || q).slice(0, 140),
            thumbUrl: previewLink,
            fullUrl: previewLink,
            description: (fullDesc || meta.title || '').slice(0, 320),
            extendedInfo: fullDesc.slice(0, 900) || undefined,
            author: meta.photographer || (meta.center ? `NASA (${meta.center})` : 'NASA Image Library'),
            license: 'Dominio Público / NASA Open Media',
            dateCreated: meta.date_created ? meta.date_created.slice(0, 10) : undefined,
            categoryTag: Array.isArray(meta.keywords) ? meta.keywords.slice(0, 3).join(' · ') : 'Ciencia / Espacio',
            sourceName: 'Archivo NASA',
            sourceDomain: 'images.nasa.gov',
            sourcePageUrl: meta.nasa_id ? `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}` : previewLink,
            source: 'nasa',
          });
        }
      };

      const fetchOpenverse = async () => {
        const ovUrl = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=6`;
        const resp = await fetch(ovUrl, { headers, signal: AbortSignal.timeout(4500) });
        if (!resp.ok) return;
        const data = (await resp.json().catch(() => ({}))) as {
          results?: Array<{
            id?: string;
            title?: string;
            url?: string;
            thumbnail?: string;
            creator?: string;
            license?: string;
            license_version?: string;
            foreign_landing_url?: string;
            source?: string;
            width?: number;
            height?: number;
            tags?: Array<{ name?: string }>;
          }>;
        };
        for (const img of (data?.results || []).slice(0, 6)) {
          if (!img.url) continue;
          const thumb = img.thumbnail || img.url;
          const tagsStr = Array.isArray(img.tags) ? img.tags.slice(0, 3).map((t) => t.name).filter(Boolean).join(' · ') : '';
          pushResult({
            id: `ov_${img.id || results.length}`,
            title: String(img.title || q).slice(0, 140),
            thumbUrl: thumb,
            fullUrl: img.url,
            description: `Fotografía o recurso visual con licencia abierta${img.source ? ` (${img.source})` : ''}: ${img.title || q}`.slice(0, 320),
            extendedInfo: tagsStr ? `Etiquetas temáticas: ${tagsStr}` : undefined,
            author: img.creator || img.source || 'Openverse Creator',
            license: [img.license?.toUpperCase(), img.license_version].filter(Boolean).join(' ') || 'Creative Commons',
            dimensions: img.width && img.height ? `${img.width} × ${img.height} px` : undefined,
            categoryTag: tagsStr || 'Fotografía e ilustración libre',
            sourceName: img.source ? `Openverse · ${img.source}` : 'Openverse CC',
            sourceDomain: 'openverse.org',
            sourcePageUrl: img.foreign_landing_url || img.url,
            width: img.width,
            height: img.height,
            source: 'openverse',
          });
        }
      };

      const fetchMetMuseum = async () => {
        const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(q)}`;
        const searchResp = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(4000) });
        if (!searchResp.ok) return;
        const searchData = (await searchResp.json().catch(() => ({}))) as { objectIDs?: number[] | null };
        const ids = Array.isArray(searchData.objectIDs) ? searchData.objectIDs.slice(0, 4) : [];
        if (ids.length === 0) return;

        const details = await Promise.allSettled(
          ids.map(async (id) => {
            const r = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, {
              headers,
              signal: AbortSignal.timeout(3500),
            });
            if (!r.ok) return null;
            return (await r.json().catch(() => null)) as {
              objectID?: number;
              title?: string;
              primaryImage?: string;
              primaryImageSmall?: string;
              artistDisplayName?: string;
              objectDate?: string;
              medium?: string;
              department?: string;
              culture?: string;
              classification?: string;
              objectURL?: string;
            } | null;
          })
        );

        for (const d of details) {
          if (d.status !== 'fulfilled' || !d.value) continue;
          const obj = d.value;
          const thumb = obj.primaryImageSmall || obj.primaryImage;
          const full = obj.primaryImage || obj.primaryImageSmall;
          if (!thumb || !full) continue;
          const extraParts = [obj.medium, obj.culture, obj.department, obj.classification].filter(Boolean);
          pushResult({
            id: `met_${obj.objectID || results.length}`,
            title: String(obj.title || q).slice(0, 140),
            thumbUrl: thumb,
            fullUrl: full,
            description: extraParts.length > 0 ? extraParts.join(' · ').slice(0, 320) : `Obra de colección museográfica sobre ${q}`,
            extendedInfo: extraParts.length > 0 ? `Colección del Museo Metropolitano: ${extraParts.join(' · ')}` : undefined,
            author: obj.artistDisplayName || 'Artista / Colección histórica',
            license: 'CC0 Dominio Público (Open Access)',
            dateCreated: obj.objectDate || undefined,
            categoryTag: obj.department || obj.classification || 'Arte e Historia',
            sourceName: 'Museo Metropolitano (Open Access)',
            sourceDomain: 'metmuseum.org',
            sourcePageUrl: obj.objectURL || full,
            source: 'met',
          });
        }
      };

      const fetchTasks: Array<Promise<void>> = [];
      if (requestedSet.has('enciclopedia')) fetchTasks.push(fetchEncyclopediaES());
      if (requestedSet.has('commons')) fetchTasks.push(fetchCommons());
      if (requestedSet.has('nasa')) fetchTasks.push(fetchNasa());
      if (requestedSet.has('openverse')) fetchTasks.push(fetchOpenverse());
      if (requestedSet.has('met')) fetchTasks.push(fetchMetMuseum());

      await Promise.allSettled(fetchTasks);

      res.json({
        query: q,
        images: results.slice(0, limit),
        sourceCounts,
        articleSummary: primaryArticle,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudieron obtener imágenes enciclopédicas.';
      res.status(500).json({ error: msg });
    }
  };

  app.get('/api/media/encyclopedia-images', handleEncyclopediaImagesSearch);
  app.get('/api/media/wiki-images', handleEncyclopediaImagesSearch);

  // ------------------------------------------------------------------
  // Multi-AI Visual & Encyclopedic Image Inspector Explainer
  // ------------------------------------------------------------------
  app.post('/api/media/explain', async (req, res) => {
    try {
      const {
        title = '',
        description = '',
        extendedInfo = '',
        author = '',
        license = '',
        sourceName = '',
        sourcePageUrl = '',
        subjectName = '',
        educationLevel = 'universitario',
        aiProvider = 'auto',
      } = req.body ?? {};

      const cleanTitle = String(title || '').trim();
      if (!cleanTitle && !description) {
        res.status(400).json({ error: 'Faltan datos de la imagen o tema para explicar.' });
        return;
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const prompt = `Sos el editor enciclopédico y tutor académico de FABRO.
Elaborá una ficha enciclopédica completa y didáctica en español para estudiar esta imagen y su tema asociado:
- Título / tema: "${cleanTitle.slice(0, 180)}"
${subjectName ? `- Materia del estudiante: ${String(subjectName).slice(0, 120)}` : ''}
- Nivel educativo: ${levelDesc}
- Descripción de origen: ${String(description || '').slice(0, 800)}
${extendedInfo ? `- Información extendida del repositorio: ${String(extendedInfo).slice(0, 1200)}` : ''}
- Fuente / archivo: ${String(sourceName || 'Repositorio enciclopédico').slice(0, 120)}
${author ? `- Autoría: ${String(author).slice(0, 120)}` : ''}
${license ? `- Licencia: ${String(license).slice(0, 80)}` : ''}
${sourcePageUrl ? `- Enlace documental: ${String(sourcePageUrl).slice(0, 500)}` : ''}

ESTRUCTURA OBLIGATORIA EN MARKDOWN:
## Síntesis enciclopédica
Explicá claramente qué representa la imagen, su importancia científica, histórica, artística o conceptual y cómo se interpreta en profundidad.
## Conceptos clave y contexto
Enumerá entre 4 y 6 conceptos o datos verificables esenciales relacionados con la lámina.
## Aplicación práctica y ejemplo de estudio
Incluí 1 ejemplo o conexión clara con la materia y 2 preguntas rápidas de autoevaluación para repasar.

No inventes datos no verificables.`;

      let explanationMarkdown = '';
      let secondOpinionMarkdown = '';
      let providerUsed = 'gemini';
      let secondProviderUsed = '';

      const allowPaid = canUsePaidModelsFromRes(res);
      if (aiProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      if (aiProvider === 'chatgpt') {
        const gpt = await callOpenAIChatGPT({
          systemInstruction: 'Sos un redactor de enciclopedias académicas en español. Escribí con claridad y rigor.',
          messages: [{ role: 'user', content: prompt }],
        });
        explanationMarkdown = gpt.text;
        providerUsed = `chatgpt (${gpt.modelUsed})`;
      } else {
        const ai = getGeminiClient();
        try {
          const resp = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              tools: [{ googleSearch: {} }],
            },
          });
          explanationMarkdown = resp.text ?? '';
          providerUsed = `gemini (${MODEL_NAME})`;
        } catch (err) {
          if (aiProvider === 'auto' && isGoogleLimitError(err)) {
            if (hasValidOpenAIKey() && allowPaid) {
              const gpt = await callOpenAIChatGPT({
                systemInstruction: 'Sos un redactor de enciclopedias académicas en español.',
                messages: [{ role: 'user', content: prompt }],
              });
              explanationMarkdown = gpt.text;
              providerUsed = `chatgpt-respaldo (${gpt.modelUsed})`;
            } else {
              const lite = await ai.models.generateContent({ model: LITE_MODEL_NAME, contents: prompt });
              explanationMarkdown = lite.text ?? '';
              providerUsed = 'gemini-lite-respaldo';
            }
          } else {
            throw err;
          }
        }

        if (aiProvider === 'doble_ia') {
          if (hasValidOpenAIKey() && allowPaid) {
            try {
              const gpt2 = await callOpenAIChatGPT({
                systemInstruction: 'Aportá notas críticas complementarias y conexiones interdisciplinarias en español.',
                messages: [{ role: 'user', content: prompt }],
              });
              secondOpinionMarkdown = gpt2.text;
              secondProviderUsed = `ChatGPT (${gpt2.modelUsed})`;
            } catch {
              // ignore secondary error
            }
          } else {
            try {
              const lite2 = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: `Agregá un bloque breve de glosario técnico y datos curiosos verificados sobre "${cleanTitle}" (${description.slice(0, 200)}).`,
              });
              secondOpinionMarkdown = lite2.text ?? '';
              secondProviderUsed = `Glosario complementario (${LITE_MODEL_NAME})`;
            } catch {
              // ignore secondary error
            }
          }
        }
      }

      res.json({
        explanationMarkdown,
        secondOpinionMarkdown: secondOpinionMarkdown || undefined,
        providerUsed,
        secondProviderUsed: secondProviderUsed || undefined,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // AI Reading Mode Assistant (Guided Adaptation + Contextual Q&A + Multi-IA)
  // ------------------------------------------------------------------
  app.post('/api/ai/reading-mode', async (req, res) => {
    try {
      const {
        action = 'enhance',
        title = '',
        content = '',
        subjectName = '',
        readingStyle = 'claro',
        question = '',
        educationLevel = 'universitario',
        aiProvider = 'auto',
      } = req.body ?? {};

      const cleanContent = String(content || '').trim().slice(0, 40000);
      if (!cleanContent && !title) {
        res.status(400).json({ error: 'No hay contenido disponible para analizar en el modo de lectura IA.' });
        return;
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      let providerUsed = 'gemini';

      if (action === 'ask') {
        const cleanQ = String(question || '').trim().slice(0, 1000);
        if (!cleanQ) {
          res.status(400).json({ error: 'Escribí una pregunta sobre esta lectura.' });
          return;
        }
        const prompt = `Sos el asistente de Modo de Lectura IA de FABRO.
El estudiante (${levelDesc}) está leyendo el texto titulado "${String(title).slice(0, 180)}"${
          subjectName ? ` de la materia "${String(subjectName).slice(0, 120)}"` : ''
        }.

CONTENIDO QUE ESTÁ LEYENDO:
${cleanContent}

PREGUNTA DEL ESTUDIANTE DURANTE LA LECTURA:
"${cleanQ}"

Respondé en español claro, bien estructurado en Markdown, citando partes del texto cuando corresponda, aclarando conceptos difíciles y dando 1 ejemplo breve si ayuda a fijar la idea.`;

        const allowPaid = canUsePaidModelsFromRes(res);
        if (aiProvider === 'chatgpt' && !allowPaid) {
          rejectPaidModelNotAllowed(res);
          return;
        }
        let answerMarkdown = '';
        if (aiProvider === 'chatgpt') {
          const gpt = await callOpenAIChatGPT({
            systemInstruction: 'Sos un tutor académico de lectura guiada en español.',
            messages: [{ role: 'user', content: prompt }],
          });
          providerUsed = `chatgpt (${gpt.modelUsed})`;
          answerMarkdown = gpt.text;
        } else {
          const ai = getGeminiClient();
          try {
            const resp = await ai.models.generateContent({
              model: MODEL_NAME,
              contents: prompt,
              config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
            });
            answerMarkdown = resp.text ?? '';
            providerUsed = `gemini (${MODEL_NAME})`;
          } catch (err) {
            if (aiProvider === 'auto' && isGoogleLimitError(err)) {
              if (hasValidOpenAIKey() && allowPaid) {
                const gpt = await callOpenAIChatGPT({
                  systemInstruction: 'Sos un tutor académico de lectura guiada en español.',
                  messages: [{ role: 'user', content: prompt }],
                });
                providerUsed = `chatgpt-respaldo (${gpt.modelUsed})`;
                answerMarkdown = gpt.text;
              } else {
                const lite = await ai.models.generateContent({
                  model: LITE_MODEL_NAME,
                  contents: prompt,
                });
                providerUsed = 'gemini-lite-respaldo';
                answerMarkdown = lite.text ?? '';
              }
            } else {
              throw err;
            }
          }
        }

        res.json({ answerMarkdown, providerUsed });
        return;
      }

      // action === 'enhance'
      const styleInstructions: Record<string, string> = {
        claro: 'Reorganizá y explicá el texto con redacción fluida estilo enciclopedia moderna (como un gran artículo divulgativo), subtítulos claros con ##, términos clave en negrita y notas aclaratorias breves para que se entienda sin esfuerzo.',
        profundo: 'Enriquecé la lectura con rigor académico: agregá contexto teórico, relaciones causa-efecto, definiciones técnicas precisas, subtítulos con ## y notas críticas para estudiar en profundidad.',
        resumen: 'Generá una versión de lectura condensada y limpia con las tesis centrales, estructura por bloques con ## y síntesis directa lista para repasar rápido.',
        autoevaluacion: 'Presentá primero una lectura guiada estructurada con ## y al final agregá una sección "## Preguntas de comprensión lectora" con 4 preguntas abiertas y sus respuestas breves ocultables/explicadas.',
      };

      const prompt = `Sos el editor de Modo de Lectura IA de FABRO.
Transformá el siguiente material en una experiencia de lectura editorial y enciclopédica óptima en español para ${levelDesc}.
Título: "${String(title).slice(0, 180)}"
${subjectName ? `Materia: "${String(subjectName).slice(0, 120)}"` : ''}
Estilo solicitado: ${styleInstructions[readingStyle] || styleInstructions.claro}

MATERIAL ORIGINAL:
${cleanContent}

Devolvé un JSON estricto con estas claves:
{
  "adaptedMarkdown": "Texto completo adaptado en Markdown limpio con secciones ##",
  "keyTakeaways": ["Idea clave 1", "Idea clave 2", "Idea clave 3"],
  "imageQueries": ["Término enciclopédico concreto 1 para ilustrar en atlas visual", "Término 2"],
  "estimatedReadMinutes": 4
}`;

      const allowPaid = canUsePaidModelsFromRes(res);
      if (aiProvider === 'chatgpt' && !allowPaid) {
        rejectPaidModelNotAllowed(res);
        return;
      }

      let parsed: Record<string, unknown> = {};
      const runOpenAI = async () => {
        const gpt = await callOpenAIChatGPT({
          systemInstruction: 'Respondé únicamente JSON válido con la estructura solicitada.',
          messages: [{ role: 'user', content: prompt }],
          responseJson: true,
        });
        providerUsed = `chatgpt (${gpt.modelUsed})`;
        return JSON.parse((gpt.text || '{}').trim()) as Record<string, unknown>;
      };

      if (aiProvider === 'chatgpt') {
        parsed = await runOpenAI();
      } else {
        const ai = getGeminiClient();
        try {
          const resp = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  adaptedMarkdown: { type: Type.STRING },
                  keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
                  imageQueries: { type: Type.ARRAY, items: { type: Type.STRING } },
                  estimatedReadMinutes: { type: Type.INTEGER },
                },
                required: ['adaptedMarkdown', 'keyTakeaways', 'imageQueries', 'estimatedReadMinutes'],
              },
            },
          });
          providerUsed = `gemini (${MODEL_NAME})`;
          parsed = JSON.parse((resp.text ?? '{}').trim());
        } catch (err) {
          if (aiProvider === 'auto' && isGoogleLimitError(err)) {
            if (hasValidOpenAIKey() && allowPaid) {
              parsed = await runOpenAI();
            } else {
              const respLite = await ai.models.generateContent({
                model: LITE_MODEL_NAME,
                contents: prompt,
                config: { responseMimeType: 'application/json' },
              });
              providerUsed = 'gemini-lite-respaldo';
              parsed = JSON.parse((respLite.text ?? '{}').trim());
            }
          } else {
            throw err;
          }
        }
      }

      res.json({
        adaptedMarkdown: String(parsed.adaptedMarkdown || cleanContent),
        keyTakeaways: Array.isArray(parsed.keyTakeaways)
          ? parsed.keyTakeaways.map((t) => String(t)).filter(Boolean).slice(0, 6)
          : [],
        imageQueries: Array.isArray(parsed.imageQueries)
          ? parsed.imageQueries.map((q) => String(q)).filter(Boolean).slice(0, 4)
          : [String(title || subjectName || 'Ciencia').slice(0, 80)],
        estimatedReadMinutes: Math.max(1, Math.min(60, Number(parsed.estimatedReadMinutes) || 3)),
        providerUsed,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 11. Notes Timeline Extractor (Extract Key Dates & Events from Selected Text)
  // ------------------------------------------------------------------
  function fallbackExtractDatesFromText(rawText: string, noteTitle: string) {
    const sentences = rawText
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    const events: Array<{
      id: string;
      dateLabel: string;
      sortYear: number;
      period: string;
      title: string;
      description: string;
      significance: string;
    }> = [];

    const datePattern =
      /(\b\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+\d{3,4}\b|\bsiglo\s+[IVXLC]+\b|\b\d{3,4}\s*(?:a\.?\s*C\.?|d\.?\s*C\.?)\b|\b(?:1[0-9]{3}|20[0-9]{2})\b)/i;

    for (const sentence of sentences) {
      const match = sentence.match(datePattern);
      if (!match) continue;
      const dateLabel = match[1].trim();
      const yearMatch = dateLabel.match(/\d{3,4}/);
      let sortYear = yearMatch ? Number(yearMatch[0]) : 0;
      if (/a\.?\s*C/i.test(dateLabel)) sortYear = -Math.abs(sortYear);

      const cleanTitle = sentence.replace(datePattern, '').replace(/^[\s:,\-–—]+/, '').slice(0, 85) || `Hito (${dateLabel})`;
      events.push({
        id: `tl_${events.length + 1}`,
        dateLabel,
        sortYear,
        period: sortYear > 0 ? `Año ${Math.abs(sortYear)}` : 'Cronología detectada',
        title: cleanTitle,
        description: sentence.slice(0, 260),
        significance: 'Fecha clave identificada directamente en el texto seleccionado.',
      });
      if (events.length >= 16) break;
    }

    events.sort((a, b) => a.sortYear - b.sortYear);
    return {
      timelineTitle: `Línea de tiempo: ${noteTitle || 'Apunte seleccionado'}`,
      timeSpan:
        events.length >= 2
          ? `${events[0].dateLabel} – ${events[events.length - 1].dateLabel}`
          : events[0]?.dateLabel || 'Fechas detectadas',
      summary:
        events.length > 0
          ? `Se detectaron ${events.length} hitos cronológicos ordenados desde el texto del apunte.`
          : 'No se detectaron fechas explícitas mediante análisis automático.',
      events,
      providerUsed: 'extractor-local',
    };
  }

  app.post('/api/ai/timeline-extract', async (req, res) => {
    try {
      const {
        selectedText = '',
        noteTitle = 'Apunte',
        subjectName = '',
        educationLevel = 'universitario',
      } = req.body ?? {};

      const cleanText = String(selectedText || '').trim().slice(0, 35000);
      if (!cleanText || cleanText.length < 15) {
        res.status(400).json({ error: 'Seleccioná o escribí un texto con contenido suficiente para extraer fechas clave.' });
        return;
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const prompt = `Sos el asistente cronológico de FABRO Apuntes (${levelDesc}).
Analizá estrictamente el siguiente fragmento de texto del estudiante${subjectName ? ` (materia: ${subjectName})` : ''} llamado "${String(noteTitle).slice(0, 140)}".
Extraé TODAS las fechas clave, años, siglos, períodos o secuencias temporales mencionadas en el texto (sin inventar acontecimientos ajenos al texto) y ordenalas cronológicamente de más antigua a más reciente.

TEXTO SELECCIONADO:
${cleanText}

Devolvé un JSON estricto con esta estructura:
{
  "timelineTitle": "Título claro de la línea histórica o cronológica",
  "timeSpan": "Rango temporal cubierto (ej. 1810 – 1983)",
  "summary": "Síntesis interpretativa de 2 oraciones explicando la evolución temporal que muestra el texto",
  "events": [
    {
      "id": "ev_1",
      "dateLabel": "Fecha, año o siglo exacto del texto",
      "sortYear": 1810,
      "period": "Etapa o período histórico",
      "title": "Título breve del hito",
      "description": "Qué ocurrió exactamente según el texto",
      "significance": "Importancia o consecuencia explicativa del hito"
    }
  ]
}`;

      try {
        const ai = getGeminiClient();
        const resp = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                timelineTitle: { type: Type.STRING },
                timeSpan: { type: Type.STRING },
                summary: { type: Type.STRING },
                events: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      dateLabel: { type: Type.STRING },
                      sortYear: { type: Type.NUMBER },
                      period: { type: Type.STRING },
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      significance: { type: Type.STRING },
                    },
                    required: ['id', 'dateLabel', 'sortYear', 'period', 'title', 'description', 'significance'],
                  },
                },
              },
              required: ['timelineTitle', 'timeSpan', 'summary', 'events'],
            },
          },
        });

        const parsed = JSON.parse((resp.text ?? '{}').trim()) as {
          timelineTitle?: string;
          timeSpan?: string;
          summary?: string;
          events?: Array<Record<string, unknown>>;
        };

        const events = (Array.isArray(parsed.events) ? parsed.events : [])
          .slice(0, 24)
          .map((ev, idx) => ({
            id: String(ev.id || `ev_${idx + 1}`),
            dateLabel: String(ev.dateLabel || 'Fecha').slice(0, 80),
            sortYear: Number.isFinite(Number(ev.sortYear)) ? Number(ev.sortYear) : idx,
            period: String(ev.period || 'Etapa').slice(0, 90),
            title: String(ev.title || 'Hito cronológico').slice(0, 140),
            description: String(ev.description || '').slice(0, 500),
            significance: String(ev.significance || '').slice(0, 400),
          }))
          .sort((a, b) => a.sortYear - b.sortYear);

        if (events.length === 0) {
          res.json(fallbackExtractDatesFromText(cleanText, String(noteTitle)));
          return;
        }

        res.json({
          timelineTitle: String(parsed.timelineTitle || `Línea cronológica: ${noteTitle}`).slice(0, 180),
          timeSpan: String(parsed.timeSpan || `${events[0].dateLabel} – ${events[events.length - 1].dateLabel}`).slice(0, 100),
          summary: String(parsed.summary || '').slice(0, 600),
          events,
          providerUsed: `gemini (${MODEL_NAME})`,
        });
      } catch {
        res.json(fallbackExtractDatesFromText(cleanText, String(noteTitle)));
      }
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 12. FABRO HUB: Honest Parallel Multi-AI Comparison Engine
  // ------------------------------------------------------------------
  app.post('/api/ai/hub-multi', async (req, res) => {
    try {
      const {
        prompt = '',
        models = ['gemini-pro', 'gemini-lite', 'openai'],
        mode = 'interpretativo',
        educationLevel = 'universitario',
        subjectName = '',
      } = req.body ?? {};

      const cleanPrompt = String(prompt || '').trim().slice(0, 8000);
      if (!cleanPrompt) {
        res.status(400).json({ error: 'Escribí una consulta o tema para comparar entre los modelos de IA.' });
        return;
      }

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const modeText =
        mode === 'sencillo'
          ? 'Lenguaje claro, accesible, analogías didácticas y pasos concretos.'
          : 'Resumen interpretativo y explicativo riguroso: qué significa, por qué ocurre, ejemplos reales y conexión conceptual.';
      const systemInstruction = `Sos un modelo de IA consultado desde FABRO HUB (herramienta gratuita educativa).
Nivel del estudiante: ${levelDesc}.
${subjectName ? `Materia: ${subjectName}.` : ''}
Estilo solicitado: ${modeText}
Respondé siempre en español claro y bien estructurado en Markdown, sin inventar citas ni enlaces.`;

      const requestedIds: string[] = Array.isArray(models)
        ? models.map((m) => String(m)).slice(0, 4)
        : ['gemini-pro', 'gemini-lite', 'openai'];

      interface MultiAiEntry {
        modelId: string;
        label: string;
        provider: string;
        status: 'ok' | 'not_configured' | 'error';
        modelUsed?: string;
        text?: string;
        error?: string;
        latencyMs?: number;
        officialUrl: string;
      }

      const allowPaid = canUsePaidModelsFromRes(res);
      const reservation = res.locals?.freemiumReservation as QuotaReservation | undefined;

      const executeOne = async (modelId: string): Promise<MultiAiEntry> => {
        const start = Date.now();
        if (modelId === 'openai' && !allowPaid) {
          return {
            modelId,
            label: 'ChatGPT (OpenAI)',
            provider: 'FABRO PREMIUM',
            status: 'not_configured',
            error: reservation?.budgetStatus?.paidBlocked
              ? 'Bloqueado por límite de presupuesto mensual de modelos pagos.'
              : 'Modelo avanzado exclusivo de FABRO PREMIUM.',
            officialUrl: 'https://chatgpt.com/',
          };
        }
        if (modelId === 'gemini-pro') {
          if (!process.env.GEMINI_API_KEY) {
            return {
              modelId,
              label: 'Google Gemini Pro',
              provider: 'Google Gemini API',
              status: 'not_configured',
              error: 'GEMINI_API_KEY no está configurada en Secrets.',
              officialUrl: 'https://gemini.google.com/',
            };
          }
          try {
            const ai = getGeminiClient();
            const resp = await ai.models.generateContent({
              model: MODEL_NAME,
              contents: cleanPrompt,
              config: {
                systemInstruction,
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              },
            });
            return {
              modelId,
              label: 'Google Gemini (Profundo)',
              provider: 'Google Gemini API',
              status: 'ok',
              modelUsed: MODEL_NAME,
              text: resp.text || '',
              latencyMs: Date.now() - start,
              officialUrl: 'https://gemini.google.com/',
            };
          } catch (err) {
            return {
              modelId,
              label: 'Google Gemini (Profundo)',
              provider: 'Google Gemini API',
              status: 'error',
              error: err instanceof Error ? err.message : 'Error consultando Gemini',
              latencyMs: Date.now() - start,
              officialUrl: 'https://gemini.google.com/',
            };
          }
        }

        if (modelId === 'gemini-lite') {
          if (!process.env.GEMINI_API_KEY) {
            return {
              modelId,
              label: 'Google Gemini Flash Lite',
              provider: 'Google Gemini API',
              status: 'not_configured',
              error: 'GEMINI_API_KEY no está configurada en Secrets.',
              officialUrl: 'https://gemini.google.com/',
            };
          }
          try {
            const ai = getGeminiClient();
            const resp = await ai.models.generateContent({
              model: LITE_MODEL_NAME,
              contents: cleanPrompt,
              config: { systemInstruction },
            });
            return {
              modelId,
              label: 'Google Gemini Flash Lite',
              provider: 'Google Gemini API',
              status: 'ok',
              modelUsed: LITE_MODEL_NAME,
              text: resp.text || '',
              latencyMs: Date.now() - start,
              officialUrl: 'https://gemini.google.com/',
            };
          } catch (err) {
            return {
              modelId,
              label: 'Google Gemini Flash Lite',
              provider: 'Google Gemini API',
              status: 'error',
              error: err instanceof Error ? err.message : 'Error consultando Gemini Flash Lite',
              latencyMs: Date.now() - start,
              officialUrl: 'https://gemini.google.com/',
            };
          }
        }

        if (modelId === 'openai') {
          if (!hasValidOpenAIKey()) {
            return {
              modelId,
              label: 'ChatGPT (OpenAI)',
              provider: 'OpenAI API',
              status: 'not_configured',
              error: 'API oficial disponible configurando OPENAI_API_KEY en Settings > Secrets. Podés abrir la web oficial directamente.',
              officialUrl: 'https://chatgpt.com/',
            };
          }
          try {
            const gpt = await callOpenAIChatGPT({
              systemInstruction,
              messages: [{ role: 'user', content: cleanPrompt }],
            });
            return {
              modelId,
              label: 'ChatGPT (OpenAI)',
              provider: 'OpenAI API',
              status: 'ok',
              modelUsed: gpt.modelUsed,
              text: gpt.text,
              latencyMs: Date.now() - start,
              officialUrl: 'https://chatgpt.com/',
            };
          } catch (err) {
            return {
              modelId,
              label: 'ChatGPT (OpenAI)',
              provider: 'OpenAI API',
              status: 'error',
              error: err instanceof Error ? err.message : 'Error consultando OpenAI',
              latencyMs: Date.now() - start,
              officialUrl: 'https://chatgpt.com/',
            };
          }
        }

        return {
          modelId,
          label: modelId,
          provider: 'No habilitado',
          status: 'not_configured',
          error: 'Solo Google Gemini y ChatGPT (OpenAI) están habilitados en FABRO.',
          officialUrl: 'https://gemini.google.com/',
        };
      };

      const results = await Promise.all(requestedIds.map(executeOne));
      const successful = results.filter((r) => r.status === 'ok' && r.text);

      let synthesisMarkdown = '';
      if (successful.length >= 2 && process.env.GEMINI_API_KEY) {
        try {
          const ai = getGeminiClient();
          const digest = successful
            .map((r) => `### Respuesta de ${r.label} (${r.modelUsed}):\n${String(r.text).slice(0, 3500)}`)
            .join('\n\n---\n\n');
          const synthResp = await ai.models.generateContent({
            model: LITE_MODEL_NAME,
            contents: `Sos FABRO IA enfocada en resumen interpretativo y explicativo.
Compará en paralelo las siguientes ${successful.length} respuestas reales recibidas para la consulta: "${cleanPrompt}".
Destacá:
1. Puntos de consenso y certezas clave.
2. Matices o enfoques distintos entre modelos.
3. Síntesis interpretativa final lista para estudiar.

${digest}`,
          });
          synthesisMarkdown = synthResp.text || '';
        } catch {
          synthesisMarkdown = '';
        }
      }

      res.json({
        prompt: cleanPrompt,
        results,
        synthesisMarkdown,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 13. FABRO HUB: Smart Study Tool Recommender
  // ------------------------------------------------------------------
  app.post('/api/ai/hub-recommend', async (req, res) => {
    try {
      const { need = '', catalog = [], educationLevel = 'universitario' } = req.body ?? {};
      const cleanNeed = String(need || '').trim().slice(0, 1200);
      if (!cleanNeed) {
        res.status(400).json({ error: 'Describí qué tarea académica necesitás resolver para recomendarte herramientas.' });
        return;
      }

      const compactCatalog = (Array.isArray(catalog) ? catalog : [])
        .slice(0, 80)
        .map((t: Record<string, unknown>) => ({
          id: String(t.id || ''),
          name: String(t.name || ''),
          category: String(t.category || ''),
          description: String(t.description || '').slice(0, 180),
          educationalUse: String(t.educationalUse || '').slice(0, 160),
          tags: Array.isArray(t.tags) ? t.tags.slice(0, 6) : [],
        }))
        .filter((t) => t.id && t.name);

      const levelDesc = EDUCATION_LEVEL_LABELS[educationLevel] || EDUCATION_LEVEL_LABELS.universitario;
      const prompt = `Sos el recomendador inteligente de herramientas de estudio de FABRO HUB (${levelDesc}).
Necesidad del estudiante: "${cleanNeed}"

Catálogo real disponible en FABRO HUB (elegí ÚNICAMENTE IDs de esta lista):
${JSON.stringify(compactCatalog)}

Devolvé un JSON estricto con:
- summaryMarkdown: explicación interpretativa y práctica en español (2-3 párrafos o viñetas) de por qué esas herramientas combinan mejor para su necesidad.
- recommendedToolIds: entre 3 y 6 IDs exactos del catálogo ordenados por prioridad.
- workflowSteps: 3 a 4 pasos concretos para combinar esas herramientas sin perder tiempo.`;

      try {
        const ai = getGeminiClient();
        const resp = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryMarkdown: { type: Type.STRING },
                recommendedToolIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                workflowSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['summaryMarkdown', 'recommendedToolIds', 'workflowSteps'],
            },
          },
        });
        const parsed = JSON.parse((resp.text ?? '{}').trim()) as {
          summaryMarkdown?: string;
          recommendedToolIds?: string[];
          workflowSteps?: string[];
        };
        const validIds = new Set(compactCatalog.map((c) => c.id));
        const recommendedToolIds = (Array.isArray(parsed.recommendedToolIds) ? parsed.recommendedToolIds : [])
          .filter((id) => validIds.has(id))
          .slice(0, 6);

        res.json({
          summaryMarkdown: String(parsed.summaryMarkdown || ''),
          recommendedToolIds,
          workflowSteps: Array.isArray(parsed.workflowSteps) ? parsed.workflowSteps.slice(0, 5) : [],
          providerUsed: `gemini (${MODEL_NAME})`,
        });
      } catch {
        // Honest deterministic keyword matcher fallback
        const terms = cleanNeed.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        const scored = compactCatalog
          .map((item) => {
            const hay = `${item.name} ${item.category} ${item.description} ${item.educationalUse} ${item.tags.join(' ')}`.toLowerCase();
            let score = 0;
            for (const t of terms) {
              if (hay.includes(t)) score += 2;
            }
            return { id: item.id, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        res.json({
          summaryMarkdown: `Seleccionamos las herramientas de **FABRO HUB** con mayor afinidad para "${cleanNeed}".`,
          recommendedToolIds: scored.map((s) => s.id),
          workflowSteps: [
            '1. Explorá primero las fuentes o conceptos base con la primera plataforma.',
            '2. Contrastá o procesá el material con la segunda herramienta.',
            '3. Guardá la síntesis interpretativa final en tus Apuntes de FABRO.',
          ],
          providerUsed: 'recomendador-local',
        });
      }
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 14. PROYECTO FABRO: Minor Protection Age Check
  // ------------------------------------------------------------------
  app.post('/api/platform/check-minor', (req, res) => {
    const { birthDate } = req.body ?? {};
    const clean = String(birthDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      res.json({ isMinor: false, age: null, directMessagesAllowed: true, note: 'Sin fecha de nacimiento ingresada.' });
      return;
    }
    const birth = new Date(`${clean}T00:00:00Z`);
    if (Number.isNaN(birth.getTime())) {
      res.status(400).json({ error: 'Fecha de nacimiento inválida.' });
      return;
    }
    const now = new Date();
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    const mDiff = now.getUTCMonth() - birth.getUTCMonth();
    if (mDiff < 0 || (mDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
      age -= 1;
    }
    const isMinor = age < 18;
    res.json({
      isMinor,
      age,
      requiresParentalSafeguards: isMinor,
      directMessagesAllowed: !isMinor,
    });
  });

  // ------------------------------------------------------------------
  // 15. PROYECTO FABRO: YouTube oEmbed, Search & Real Captions Extractor
  // ------------------------------------------------------------------
  const extractYoutubeVideoId = (input: string): string => {
    const raw = (input || '').trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
    try {
      const url = new URL(raw);
      if (url.hostname.includes('youtu.be')) {
        const id = url.pathname.replace(/^\//, '').split('/')[0];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      const embedIdx = parts.findIndex((p) => p === 'embed' || p === 'shorts' || p === 'live');
      if (embedIdx >= 0 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) {
        return parts[embedIdx + 1];
      }
    } catch {
      // ignore invalid URL
    }
    const match = raw.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:[?&/]|$)/);
    return match ? match[1] : '';
  };

  app.post('/api/youtube/oembed', async (req, res) => {
    try {
      const { url = '' } = req.body ?? {};
      const videoId = extractYoutubeVideoId(String(url));
      if (!videoId) {
        res.status(400).json({ error: 'Pegá una URL o ID válido de YouTube (por ejemplo https://www.youtube.com/watch?v=...).' });
        return;
      }
      const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const oembedResp = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!oembedResp.ok) {
        res.json({
          videoId,
          title: `Video de YouTube (${videoId})`,
          channelTitle: 'YouTube',
          thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          youtubeUrl: canonicalUrl,
        });
        return;
      }
      const data = (await oembedResp.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      res.json({
        videoId,
        title: String(data.title || `Video ${videoId}`),
        channelTitle: String(data.author_name || 'YouTube'),
        thumbnailUrl: String(data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
        youtubeUrl: canonicalUrl,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'No se pudo consultar el video de YouTube.' });
    }
  });

  app.get('/api/youtube/search', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim().slice(0, 200);
      if (!q) {
        res.status(400).json({ error: 'Ingresá un tema o consulta para buscar videos educativos.' });
        return;
      }

      const ytKey = (process.env.YOUTUBE_API_KEY || '').trim();
      if (ytKey) {
        const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12&q=${encodeURIComponent(q)}&key=${encodeURIComponent(ytKey)}`;
        const ytResp = await fetch(ytUrl, { signal: AbortSignal.timeout(12000) });
        if (ytResp.ok) {
          const ytJson = (await ytResp.json()) as {
            items?: Array<{
              id?: { videoId?: string };
              snippet?: {
                title?: string;
                channelTitle?: string;
                description?: string;
                thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
              };
            }>;
          };
          const items = (ytJson.items || [])
            .map((it) => {
              const videoId = it.id?.videoId || '';
              if (!videoId) return null;
              return {
                videoId,
                title: it.snippet?.title || 'Video educativo',
                channelTitle: it.snippet?.channelTitle || 'YouTube',
                description: it.snippet?.description || '',
                thumbnailUrl:
                  it.snippet?.thumbnails?.high?.url ||
                  it.snippet?.thumbnails?.medium?.url ||
                  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
              };
            })
            .filter(Boolean);
          res.json({ items, sourceMode: 'youtube_api_v3' });
          return;
        }
      }

      // Honest fallback using Gemini googleSearch grounding + real youtube.com/oembed verification
      if (!process.env.GEMINI_API_KEY) {
        res.json({
          items: [],
          sourceMode: 'none',
          note: 'Configurá YOUTUBE_API_KEY o GEMINI_API_KEY para buscar videos, o pegá cualquier enlace directo de YouTube.',
        });
        return;
      }

      const ai = getGeminiClient();
      const searchResp = await ai.models.generateContent({
        model: LITE_MODEL_NAME,
        contents: `Buscá videos educativos reales en YouTube sobre "${q}" (clases universitarias, tutoriales de oficios, idiomas o explicaciones académicas). Devolvé sus URLs exactas de youtube.com/watch?v=...`,
        config: { tools: [{ googleSearch: {} }] },
      });

      const candidateUrls = new Set<string>();
      const chunks = searchResp.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      for (const ch of chunks) {
        const uri = ch?.web?.uri || '';
        if (uri.includes('youtube.com') || uri.includes('youtu.be')) {
          candidateUrls.add(uri);
        }
      }
      const textUrls = (searchResp.text || '').match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/g) || [];
      for (const u of textUrls) candidateUrls.add(u);

      const videoIds = Array.from(
        new Set(Array.from(candidateUrls).map((u) => extractYoutubeVideoId(u)).filter(Boolean))
      ).slice(0, 8);

      const resolved = await Promise.all(
        videoIds.map(async (videoId) => {
          const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
          try {
            const oe = await fetch(
              `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
              { signal: AbortSignal.timeout(6000) }
            );
            if (!oe.ok) return null;
            const d = (await oe.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
            return {
              videoId,
              title: String(d.title || `Video ${videoId}`),
              channelTitle: String(d.author_name || 'YouTube'),
              description: '',
              thumbnailUrl: String(d.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
              youtubeUrl: canonicalUrl,
            };
          } catch {
            return null;
          }
        })
      );

      res.json({
        items: resolved.filter(Boolean),
        sourceMode: 'google_search_oembed',
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Error buscando videos.' });
    }
  });

  app.post('/api/youtube/transcript', async (req, res) => {
    try {
      const { videoId: rawId = '', lang = 'es' } = req.body ?? {};
      const videoId = extractYoutubeVideoId(String(rawId));
      if (!videoId) {
        res.status(400).json({ error: 'ID de video inválido.' });
        return;
      }

      const watchResp = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=${encodeURIComponent(String(lang || 'es'))}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!watchResp.ok) {
        res.json({
          transcriptAvailable: false,
          transcriptText: '',
          language: '',
          note: 'No se pudo obtener la transcripción pública automáticamente. Podés pegar el texto o apuntes del video manualmente.',
        });
        return;
      }

      const html = await watchResp.text();
      const tracksMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])\s*,\s*"audioTracks"/);
      if (!tracksMatch) {
        res.json({
          transcriptAvailable: false,
          transcriptText: '',
          language: '',
          note: 'Este video no tiene subtítulos públicos disponibles (captions). Podés pegar notas o fragmentos del video para que FABRO IA los analice sin inventar datos.',
        });
        return;
      }

      const tracks = JSON.parse(tracksMatch[1]) as Array<{
        baseUrl?: string;
        languageCode?: string;
        kind?: string;
      }>;
      if (!Array.isArray(tracks) || tracks.length === 0) {
        res.json({
          transcriptAvailable: false,
          transcriptText: '',
          language: '',
          note: 'No se encontraron pistas de subtítulos en este video.',
        });
        return;
      }

      const preferred =
        tracks.find((t) => t.languageCode?.startsWith('es') && t.kind !== 'asr') ||
        tracks.find((t) => t.languageCode?.startsWith('es')) ||
        tracks.find((t) => t.languageCode?.startsWith('en')) ||
        tracks[0];

      if (!preferred?.baseUrl) {
        res.json({
          transcriptAvailable: false,
          transcriptText: '',
          language: '',
          note: 'No se encontró URL de subtítulos válida.',
        });
        return;
      }

      const captionUrl = `${preferred.baseUrl}&fmt=json3`;
      const capResp = await fetch(captionUrl, { signal: AbortSignal.timeout(10000) });
      if (!capResp.ok) {
        res.json({
          transcriptAvailable: false,
          transcriptText: '',
          language: preferred.languageCode || '',
          note: 'YouTube restringió la descarga de captions para este video. Podés pegar notas manualmente.',
        });
        return;
      }

      const capJson = (await capResp.json().catch(() => null)) as {
        events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>;
      } | null;

      if (!capJson?.events) {
        res.json({
          transcriptAvailable: false,
          transcriptText: '',
          language: preferred.languageCode || '',
          note: 'Formato de subtítulos no disponible automáticamente.',
        });
        return;
      }

      const lines: string[] = [];
      for (const ev of capJson.events) {
        const text = (ev.segs || [])
          .map((s) => s.utf8 || '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
        if (!text) continue;
        const totalSec = Math.floor((ev.tStartMs || 0) / 1000);
        const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const ss = String(totalSec % 60).padStart(2, '0');
        lines.push(`[${mm}:${ss}] ${text}`);
      }

      const transcriptText = lines.join('\n').slice(0, 120000);
      res.json({
        transcriptAvailable: transcriptText.length > 0,
        transcriptText,
        language: preferred.languageCode || 'es',
        note: transcriptText.length > 0
          ? `Subtítulos reales cargados (${preferred.languageCode || 'idioma detectado'}).`
          : 'La pista de subtítulos está vacía.',
      });
    } catch {
      res.json({
        transcriptAvailable: false,
        transcriptText: '',
        language: '',
        note: 'No se pudo extraer la transcripción automática. Podés pegar notas del video manualmente debajo.',
      });
    }
  });

  // ------------------------------------------------------------------
  // 16. PROYECTO FABRO: FABRO IA Explica Videos + Asistente Docente
  // ------------------------------------------------------------------
  app.post('/api/ai/explain-video', async (req, res) => {
    try {
      const {
        videoId = '',
        title = '',
        channelTitle = '',
        area = '',
        mode = 'resumen_completo',
        transcriptText = '',
        userNotes = '',
        qaQuestion = '',
        history = [],
      } = req.body ?? {};

      const cleanTitle = String(title || '').trim().slice(0, 250);
      const cleanTranscript = String(transcriptText || '').trim().slice(0, 60000);
      const cleanNotes = String(userNotes || '').trim().slice(0, 25000);
      const cleanQuestion = String(qaQuestion || '').trim().slice(0, 2000);

      if (!cleanTitle && !cleanTranscript && !cleanNotes) {
        res.status(400).json({ error: 'Seleccioná un video o cargá su transcripción/notas primero.' });
        return;
      }

      const modeInstructions: Record<string, string> = {
        resumen_breve: 'Generá un **Resumen Breve** ejecutivo con ideas nucleares, objetivos y conclusiones en viñetas claras.',
        resumen_completo: 'Generá un **Resumen Completo** estructurado por bloques/temas, definiciones, argumentos, procedimientos y síntesis final.',
        explicacion_detallada: 'Generá una **Explicación Didáctica Detallada** paso a paso, desmenuzando conceptos difíciles con ejemplos concretos.',
        principiantes: 'Explicá el contenido para **Principiantes**, desde cero, sin asumir conocimientos previos y usando analogías cotidianas.',
        universitario: 'Desarrollá un **Análisis Universitario Riguroso**, conectando marcos teóricos, terminología disciplinar y debate conceptual.',
        examen: 'Extraé **Puntos Clave para Examen**: preguntas probables, definiciones exactas, errores frecuentes y trampas conceptuales.',
        cuestionario: 'Creá un **Cuestionario de Autoevaluación** de 8 preguntas (opción múltiple y desarrollo) con clave de respuestas explicada al final.',
        tarjetas: 'Generá **10 Tarjetas de Estudio (Flashcards)** con Pregunta / Concepto en el frente y Respuesta precisa al dorso.',
      };

      const hasTranscript = cleanTranscript.length > 40;
      const hasNotes = cleanNotes.length > 20;
      const honestyGuard = hasTranscript
        ? 'Tenés acceso a la transcripción real del video. Basate prioritariamente en ella y citá marcas de tiempo [MM:SS] cuando ayuden.'
        : hasNotes
          ? 'No hubo subtítulos automáticos de YouTube; trabajá con los apuntes reales aportados por el usuario y con contexto temático identificable, aclarando qué proviene de sus notas y qué es contexto general del tema.'
          : 'ADVERTENCIA DE HONESTIDAD: No hay transcripción disponible para este video. Aclaralo explícitamente en la primera línea antes de explicar el tema general sugerido por el título/canal, sin inventar citas ni afirmar textualmente qué dijo el orador minuto a minuto.';

      const historyDigest = (Array.isArray(history) ? history : [])
        .slice(-6)
        .map((m: { role?: string; text?: string }) => `${m.role === 'model' ? 'FABRO IA' : 'Estudiante'}: ${String(m.text || '').slice(0, 600)}`)
        .join('\n');

      const taskInstruction = cleanQuestion
        ? `Respondé de manera clara, honesta y didáctica la siguiente duda del estudiante sobre este video:\n"${cleanQuestion}"`
        : modeInstructions[mode] || modeInstructions.resumen_completo;

      const fullPrompt = `Sos FABRO IA Explica Videos, módulo educativo de PROYECTO FABRO.
Video: "${cleanTitle}" (${videoId}) · Canal: ${String(channelTitle || 'YouTube')} · Área: ${String(area || 'Educación general')}

${honestyGuard}

${hasTranscript ? `TRANSCRIPCIÓN REAL DEL VIDEO:\n"""\n${cleanTranscript}\n"""\n` : ''}
${hasNotes ? `APUNTES / NOTAS ADJUNTAS DEL ESTUDIANTE:\n"""\n${cleanNotes}\n"""\n` : ''}
${historyDigest ? `HISTORIAL RECIENTE:\n${historyDigest}\n` : ''}

TAREA SOLICITADA:
${taskInstruction}`;

      let text = '';
      let providerUsed = '';

      const allowPaid = canUsePaidModelsFromRes(res);
      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = getGeminiClient();
          const resp = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: fullPrompt,
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });
          text = resp.text || '';
          providerUsed = `gemini (${MODEL_NAME})`;
        } catch (err) {
          if (isGoogleLimitError(err) && hasValidOpenAIKey() && allowPaid) {
            const oa = await callOpenAIChatGPT({
              systemInstruction: 'Sos FABRO IA Explica Videos. Respondé en español claro y didáctico sin inventar contenido inexistente.',
              messages: [{ role: 'user', content: fullPrompt }],
            });
            text = oa.text;
            providerUsed = `chatgpt (${oa.modelUsed})`;
          } else {
            const ai = getGeminiClient();
            const fallbackResp = await ai.models.generateContent({
              model: LITE_MODEL_NAME,
              contents: fullPrompt,
            });
            text = fallbackResp.text || '';
            providerUsed = `gemini (${LITE_MODEL_NAME})`;
          }
        }
      } else if (hasValidOpenAIKey() && allowPaid) {
        const oa = await callOpenAIChatGPT({
          systemInstruction: 'Sos FABRO IA Explica Videos. Respondé en español claro y didáctico sin inventar contenido inexistente.',
          messages: [{ role: 'user', content: fullPrompt }],
        });
        text = oa.text;
        providerUsed = `chatgpt (${oa.modelUsed})`;
      } else {
        throw new Error('GEMINI_API_KEY_MISSING');
      }

      res.json({
        text,
        providerUsed,
        groundedOnTranscript: hasTranscript,
        groundedOnUserNotes: hasNotes,
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  app.post('/api/ai/course-assist', async (req, res) => {
    try {
      const {
        action = 'syllabus',
        courseTitle = '',
        area = '',
        category = '',
        level = 'inicial',
        topic = '',
      } = req.body ?? {};

      const cleanTitle = String(courseTitle || topic || '').trim().slice(0, 200);
      if (!cleanTitle) {
        res.status(400).json({ error: 'Indicá el título o tema del curso para generar el borrador.' });
        return;
      }

      const actionPrompts: Record<string, string> = {
        syllabus: `Diseñá una propuesta de **Programa y Objetivos** completa para un curso gratuito en FABRO Academy llamado "${cleanTitle}" (Área: ${area} / ${category}, Nivel: ${level}). Incluí: objetivos de aprendizaje, 5 a 8 módulos secuenciales con temas concretos, metodología sugerida y bibliografía inicial.`,
        activity: `Diseñá **2 Actividades Prácticas Evaluables** y criterios de corrección claros para la lección/curso "${cleanTitle}" (${area} / ${level}), orientadas a aplicar lo aprendido en situaciones reales.`,
        quiz: `Generá **5 Preguntas de Autoevaluación** de opción múltiple (4 opciones cada una, marcando la correcta y justificando brevemente) para verificar comprensión sobre "${cleanTitle}" (${area} / ${level}).`,
      };

      const prompt = `Sos el Asistente Pedagógico para Docentes e Instructores de FABRO Academy (borrador editable sujeto a revisión humana del instructor).
${actionPrompts[String(action)] || actionPrompts.syllabus}
Respondé en español claro, inclusivo y didáctico.`;

      const ai = getGeminiClient();
      let text = '';
      try {
        const resp = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
        });
        text = resp.text || '';
      } catch {
        const fallback = await ai.models.generateContent({
          model: LITE_MODEL_NAME,
          contents: prompt,
        });
        text = fallback.text || '';
      }

      res.json({
        text,
        isAiDraft: true,
        notice: 'Borrador asistido por IA · Revisá y adaptá el contenido antes de publicarlo como material oficial.',
      });
    } catch (err) {
      const mapped = formatAiError(err);
      res.status(mapped.status).json({ error: mapped.message });
    }
  });

  // ------------------------------------------------------------------
  // 16. FABRO AI GATEWAY + FABRO MODEL ROUTER (Unified Hybrid Multi-IA)
  // ------------------------------------------------------------------
  app.get('/api/gateway/catalog', (_req, res) => {
    res.json({
      providers: getEffectiveProviders(),
      models: getEffectiveModels(),
      defaultBudget: DEFAULT_BUDGET_POLICY,
      defaultSettings: DEFAULT_ADMIN_SETTINGS,
      usage: getRuntimeUsageSummary(),
    });
  });

  app.get('/api/gateway/usage', requireAuth, (req: AuthenticatedRequest, res) => {
    if (!req.authUser?.isAdmin) {
      const me = getUserFreemiumStatus(req.authUser!.uid, req.authUser!.email);
      res.json({
        dateKey: me.dateKey,
        monthKey: me.budgetStatus.monthKey,
        planTier: me.planTier,
        usedToday: me.usedToday,
        dailyLimit: me.dailyLimit,
        remainingToday: me.remainingToday,
      });
      return;
    }
    res.json(getRuntimeUsageSummary());
  });

  app.post('/api/gateway/providers/test', requireAuth, requireAdmin, async (req, res) => {
    try {
      const { providerId, enabled, defaultModelId } = req.body ?? {};
      const validIds: AIProviderId[] = ['gemini', 'openai'];
      if (!validIds.includes(providerId)) {
        res.status(400).json({ error: 'Proveedor no reconocido.' });
        return;
      }
      if (typeof enabled === 'boolean') {
        setProviderOverrideAdmin(
          providerId,
          enabled,
          typeof defaultModelId === 'string' && defaultModelId ? defaultModelId : undefined
        );
      }
      const result = await testProviderConnection(providerId, {
        ...(typeof enabled === 'boolean' ? { enabled } : {}),
        ...(typeof defaultModelId === 'string' && defaultModelId ? { defaultModelId } : {}),
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Error probando conexión.' });
    }
  });

  app.post('/api/gateway/chat', async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body ?? {};
      const prompt = String(body.prompt || '').trim();
      if (!prompt && !body.attachment?.base64) {
        res.status(400).json({ error: 'Escribí una consulta o adjuntá un archivo para procesarla en el Gateway.' });
        return;
      }
      const reservation = res.locals?.freemiumReservation as QuotaReservation | undefined;
      const authUser = req.authUser!;
      const result = await executeGatewayChat({
        userId: authUser.uid,
        userEmail: authUser.email,
        planTier: reservation?.planTier || 'free',
        maxOutputTokens: reservation?.maxOutputTokens,
        isMinor: Boolean(body.isMinor),
        prompt: prompt.slice(0, reservation?.maxInputChars || 12000),
        systemInstruction: typeof body.systemInstruction === 'string' ? body.systemInstruction : undefined,
        history: Array.isArray(body.history) ? body.history.slice(-16) : [],
        routingMode: body.routingMode === 'manual' ? 'manual' : 'automatica',
        requestedProviderId: body.requestedProviderId,
        requestedModelId: body.requestedModelId,
        useWebSearch: Boolean(body.useWebSearch),
        attachment: body.attachment || null,
        providerOverrides: Array.isArray(body.providerOverrides) ? body.providerOverrides : undefined,
        modelOverrides: Array.isArray(body.modelOverrides) ? body.modelOverrides : undefined,
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isLimit = msg.includes('BUDGET_') || msg.includes('PLAN_OR_BUDGET');
      const isConfig =
        msg.includes('PROVIDER_NOT_CONFIGURED') ||
        msg.includes('PROVIDER_DISABLED') ||
        msg.includes('INCOMPATIBLE_ATTACHMENT') ||
        msg.includes('MODEL_NOT_FOUND');
      res.status(isLimit ? 429 : isConfig ? 400 : 500).json({ error: msg });
    }
  });

  app.post('/api/gateway/chat/stream', async (req: AuthenticatedRequest, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const reservation = res.locals?.freemiumReservation as QuotaReservation | undefined;
    const authUser = req.authUser!;
    const startedAt = Number(res.locals?.aiStartedAt || Date.now());

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const body = req.body ?? {};
      const prompt = String(body.prompt || '').trim();
      if (!prompt && !body.attachment?.base64) {
        if (reservation) {
          await releaseAiQuotaReservation(reservation, {
            endpoint: '/api/gateway/chat/stream',
            errorMessage: 'Prompt vacío.',
            latencyMs: Date.now() - startedAt,
          });
        }
        sendEvent('error', { error: 'Escribí una consulta o adjuntá un archivo.' });
        res.end();
        return;
      }
      const result = await executeGatewayChat(
        {
          userId: authUser.uid,
          userEmail: authUser.email,
          planTier: reservation?.planTier || 'free',
          maxOutputTokens: reservation?.maxOutputTokens,
          isMinor: Boolean(body.isMinor),
          prompt: prompt.slice(0, reservation?.maxInputChars || 12000),
          systemInstruction: typeof body.systemInstruction === 'string' ? body.systemInstruction : undefined,
          history: Array.isArray(body.history) ? body.history.slice(-16) : [],
          routingMode: body.routingMode === 'manual' ? 'manual' : 'automatica',
          requestedProviderId: body.requestedProviderId,
          requestedModelId: body.requestedModelId,
          useWebSearch: Boolean(body.useWebSearch),
          attachment: body.attachment || null,
          providerOverrides: Array.isArray(body.providerOverrides) ? body.providerOverrides : undefined,
          modelOverrides: Array.isArray(body.modelOverrides) ? body.modelOverrides : undefined,
        },
        (delta) => {
          sendEvent('chunk', { delta });
        }
      );
      if (reservation) {
        await commitAiUsage(reservation, {
          endpoint: '/api/gateway/chat/stream',
          operationType: 'gateway-stream',
          providerId: result.providerId,
          modelId: result.apiModelName,
          tierUsed: result.accessTier === 'commercial' ? 'paid' : 'free',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.estimatedCostUsd,
          fallbackUsed: result.fallbackUsed,
          latencyMs: result.latencyMs,
        });
      }
      sendEvent('done', result);
      res.end();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (reservation) {
        await releaseAiQuotaReservation(reservation, {
          endpoint: '/api/gateway/chat/stream',
          errorMessage: errMsg,
          latencyMs: Date.now() - startedAt,
        });
      }
      sendEvent('error', { error: errMsg });
      res.end();
    }
  });

  app.post('/api/gateway/compare', async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body ?? {};
      const reservation = res.locals?.freemiumReservation as QuotaReservation | undefined;
      const authUser = req.authUser!;
      const prompt = String(body.prompt || '').trim().slice(0, reservation?.maxInputChars || 12000);
      if (!prompt) {
        res.status(400).json({ error: 'Escribí una consulta para comparar en paralelo.' });
        return;
      }
      const modelIds = Array.isArray(body.modelIds)
        ? body.modelIds.map((m: unknown) => String(m)).slice(0, 4)
        : ['gemini__gemini-4-hydrogen', 'gemini__gemini-3.1-flash-lite'];
      if (modelIds.length === 0) {
        res.status(400).json({ error: 'Seleccioná al menos 1 modelo para consultar.' });
        return;
      }
      const result = await executeGatewayCompare({
        userId: authUser.uid,
        planTier: reservation?.planTier || 'free',
        maxOutputTokens: reservation?.maxOutputTokens,
        prompt,
        modelIds,
        mode: body.mode === 'sencillo' ? 'sencillo' : 'interpretativo',
        educationLevel: String(body.educationLevel || 'universitario'),
        subjectName: String(body.subjectName || ''),
        providerOverrides: Array.isArray(body.providerOverrides) ? body.providerOverrides : undefined,
        modelOverrides: Array.isArray(body.modelOverrides) ? body.modelOverrides : undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Error comparando modelos.' });
    }
  });

  // ------------------------------------------------------------------
  // 10. EL ÚLTIMO DÍA DE TU VIDA — FABRO IA Consejero Personal
  // ------------------------------------------------------------------
  app.post('/api/ai/counselor', async (req: AuthenticatedRequest, res) => {
    try {
      const body = req.body ?? {};
      const reservation = res.locals?.freemiumReservation as QuotaReservation | undefined;
      const authUser = req.authUser!;

      const taskType = String(body.taskType || 'libre').slice(0, 60);
      const userPrompt = String(body.prompt || '').trim().slice(0, reservation?.maxInputChars || 10000);
      const diaryExcerpt = String(body.diaryText || '').trim().slice(0, 6000);
      const writingType = String(body.writingType || '').slice(0, 40);
      const emotionsContext = String(body.emotionsContext || '').slice(0, 800);
      const activitiesSummary = String(body.activitiesSummary || '').slice(0, 1200);
      const preferencesSummary = String(body.preferencesSummary || '').slice(0, 1200);
      const country = String(body.country || '').slice(0, 80);
      const happinessScore =
        typeof body.happinessScore === 'number' && Number.isFinite(body.happinessScore)
          ? Math.max(1, Math.min(10, Math.round(body.happinessScore)))
          : undefined;

      if (!userPrompt && !diaryExcerpt) {
        res.status(400).json({ error: 'Escribí una consulta o texto para trabajar con FABRO IA — Consejero Personal.' });
        return;
      }

      const safetyCheck = detectEmotionalCrisis(`${userPrompt}\n${diaryExcerpt}`);
      if (safetyCheck.isCrisis) {
        if (reservation) {
          await releaseAiQuotaReservation(reservation, {
            endpoint: '/api/ai/counselor',
            errorMessage: 'Protección emocional activada (sin consumo de cuota)',
            latencyMs: 1,
          });
        }
        res.json({
          isCrisisSupport: true,
          text: buildCrisisSupportMessage(country),
          helplines: getCrisisSupportResources(country),
          providerId: 'gemini',
          providerUsed: 'Cuidado Emocional FABRO',
          modelUsed: 'human-support-guard',
          accessTier: 'free_quota',
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          latencyMs: 1,
          routingReason: 'Prioridad absoluta a la contención humana y líneas de asistencia inmediata.',
        });
        return;
      }

      const contextBlocks: string[] = [];
      if (taskType) contextBlocks.push(`Modalidad solicitada: ${taskType}${writingType ? ` (${writingType})` : ''}`);
      if (happinessScore !== undefined) contextBlocks.push(`Bienestar / felicidad declarada hoy: ${happinessScore}/10`);
      if (emotionsContext) contextBlocks.push(`Estado emocional actual: ${emotionsContext}`);
      if (activitiesSummary) contextBlocks.push(`Actividades y prioridades del usuario:\n${activitiesSummary}`);
      if (preferencesSummary) contextBlocks.push(`Gustos, música, libros, películas o intereses:\n${preferencesSummary}`);
      if (diaryExcerpt) contextBlocks.push(`Texto o fragmento aportado expresamente por el usuario para esta consulta:\n${diaryExcerpt}`);

      const composedPrompt = [
        contextBlocks.length > 0 ? `CONTEXTO DEL USUARIO (NO INVENTAR DATOS EXTERNOS):\n${contextBlocks.join('\n\n')}` : '',
        userPrompt ? `SOLICITUD DEL USUARIO:\n${userPrompt}` : 'Ayudame con una orientación práctica y reflexiva sobre este texto.',
      ]
        .filter(Boolean)
        .join('\n\n');

      const result = await executeGatewayChat({
        userId: authUser.uid,
        userEmail: authUser.email,
        planTier: reservation?.planTier || 'free',
        maxOutputTokens: reservation?.maxOutputTokens,
        isMinor: Boolean(body.isMinor),
        prompt: composedPrompt.slice(0, reservation?.maxInputChars || 12000),
        systemInstruction: COUNSELOR_SYSTEM_SAFETY_INSTRUCTION,
        history: Array.isArray(body.history) ? body.history.slice(-12) : [],
        routingMode: body.routingMode === 'manual' ? 'manual' : 'automatica',
        requestedProviderId: body.requestedProviderId,
        requestedModelId: body.requestedModelId,
        useWebSearch: false,
      });

      res.json({
        ...result,
        isCrisisSupport: false,
        helplines: [],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isLimit = msg.includes('BUDGET_') || msg.includes('PLAN_OR_BUDGET');
      const isConfig =
        msg.includes('PROVIDER_NOT_CONFIGURED') ||
        msg.includes('PROVIDER_DISABLED') ||
        msg.includes('MODEL_NOT_FOUND');
      res.status(isLimit ? 429 : isConfig ? 400 : 500).json({ error: msg });
    }
  });

  // ------------------------------------------------------------------
  // Vite Middleware (Dev) or Static Assets (Prod)
  // ------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ------------------------------------------------------------------
  // Real-Time WebSocket Server (/ws) for Classroom Sync & Presence
  // ------------------------------------------------------------------
  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  interface WsMeta {
    uid: string;
    displayName: string;
    presenceMode: 'online' | 'away' | 'dnd' | 'invisible';
    classroomId: string | null;
  }

  const clientMeta = new Map<WebSocket, WsMeta>();
  const classroomLatestSync = new Map<string, Record<string, unknown>>();

  const broadcastPresenceRoster = () => {
    const visibleByUid = new Map<string, { uid: string; displayName: string; presenceMode: 'online' | 'away' | 'dnd' }>();
    for (const meta of clientMeta.values()) {
      if (!meta.uid || meta.presenceMode === 'invisible') continue;
      visibleByUid.set(meta.uid, {
        uid: meta.uid,
        displayName: meta.displayName,
        presenceMode: meta.presenceMode,
      });
    }
    const payload = JSON.stringify({
      type: 'presence:roster',
      peers: Array.from(visibleByUid.values()),
    });
    for (const ws of wss.clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  };

  const broadcastClassroomRoster = (classroomId: string) => {
    if (!classroomId) return;
    const roomSockets: WebSocket[] = [];
    const uids = new Set<string>();
    for (const [ws, meta] of clientMeta.entries()) {
      if (meta.classroomId === classroomId && ws.readyState === WebSocket.OPEN) {
        roomSockets.push(ws);
        if (meta.uid) uids.add(meta.uid);
      }
    }
    const frame = JSON.stringify({
      type: 'classroom:roster',
      classroomId,
      count: uids.size,
    });
    for (const ws of roomSockets) {
      ws.send(frame);
    }
  };

  wss.on('connection', (ws) => {
    clientMeta.set(ws, {
      uid: '',
      displayName: 'Estudiante',
      presenceMode: 'online',
      classroomId: null,
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw || '{}')) as {
          type?: string;
          uid?: string;
          displayName?: string;
          presenceMode?: 'online' | 'away' | 'dnd' | 'invisible';
          classroomId?: string;
          payload?: Record<string, unknown>;
        };
        const current = clientMeta.get(ws);
        if (!current) return;

        if (msg.type === 'presence:hello') {
          current.uid = String(msg.uid || '').slice(0, 128);
          current.displayName = String(msg.displayName || 'Estudiante').slice(0, 120);
          current.presenceMode =
            msg.presenceMode === 'away' || msg.presenceMode === 'dnd' || msg.presenceMode === 'invisible'
              ? msg.presenceMode
              : 'online';
          broadcastPresenceRoster();
          return;
        }

        if (msg.type === 'classroom:join') {
          const prevRoom = current.classroomId;
          const nextRoom = String(msg.classroomId || '').slice(0, 128);
          current.classroomId = nextRoom || null;
          if (msg.uid) current.uid = String(msg.uid).slice(0, 128);
          if (msg.displayName) current.displayName = String(msg.displayName).slice(0, 120);
          if (prevRoom && prevRoom !== nextRoom) broadcastClassroomRoster(prevRoom);
          if (nextRoom) {
            broadcastClassroomRoster(nextRoom);
            const cached = classroomLatestSync.get(nextRoom);
            if (cached) {
              ws.send(JSON.stringify({ type: 'classroom:sync', payload: cached }));
            }
          }
          return;
        }

        if (msg.type === 'classroom:sync' && msg.payload) {
          const roomId = String(msg.payload.classroomId || current.classroomId || '').slice(0, 128);
          if (!roomId) return;
          classroomLatestSync.set(roomId, msg.payload);
          const frame = JSON.stringify({ type: 'classroom:sync', payload: msg.payload });
          for (const [peerWs, peerMeta] of clientMeta.entries()) {
            if (peerWs !== ws && peerMeta.classroomId === roomId && peerWs.readyState === WebSocket.OPEN) {
              peerWs.send(frame);
            }
          }
        }
      } catch {
        // ignore invalid frames
      }
    });

    ws.on('close', () => {
      const prev = clientMeta.get(ws);
      clientMeta.delete(ws);
      if (prev?.classroomId) {
        broadcastClassroomRoster(prev.classroomId);
      }
      broadcastPresenceRoster();
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`FABRO server + WebSocket running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FABRO server:', err);
  process.exit(1);
});
