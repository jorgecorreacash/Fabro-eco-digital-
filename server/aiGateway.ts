import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  getBudgetStatusSnapshot,
  getProviderOverridesSnapshot,
  getSystemLimitsSnapshot,
  type PlanTier,
} from './freemiumStore.ts';

export type AIProviderId = 'gemini' | 'openai';

export type AIModelAccessTier = 'free_quota' | 'open_selfhosted' | 'commercial';
export type AIRoutingMode = 'automatica' | 'manual' | 'comparacion';
export type AIPlanPolicy = 'plan_gratuito' | 'plan_educativo' | 'plan_administrador';

export interface GatewayProviderConfig {
  id: AIProviderId;
  name: string;
  accessTier: AIModelAccessTier;
  enabled: boolean;
  configuredInBackend: boolean;
  envVarName: string;
  defaultModelId: string;
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsDocuments: boolean;
  allowFallback: boolean;
  officialUrl: string;
  pricingNote: string;
}

export interface GatewayModelDefinition {
  id: string; // Firestore-safe doc ID (no slashes)
  apiModelName: string; // Exact provider API model slug
  providerId: AIProviderId;
  label: string;
  accessTier: AIModelAccessTier;
  enabled: boolean;
  maxContextTokens: number;
  supportsVision: boolean;
  supportsDocuments: boolean;
  supportsReasoning: boolean;
  inputCostPer1MUsd: number;
  outputCostPer1MUsd: number;
  recommendedFor: string[];
}

export interface GatewayBudgetPolicy {
  dailyGlobalLimitUsd: number;
  monthlyGlobalLimitUsd: number;
  perUserDailyRequestLimit: number;
  perUserDailyTokenLimit: number;
  alertThresholdPercent: number;
  onBudgetExceeded: 'fallback_free' | 'block';
  activePlanDefault: AIPlanPolicy;
}

export interface GatewayAdminSettings {
  defaultRoutingMode: AIRoutingMode;
  allowAutomaticFallback: boolean;
  blockPaidModelsForFreePlan: boolean;
  minorStrictSafeRouting: boolean;
  enableStreaming: boolean;
}

export interface GatewayAttachment {
  name?: string;
  mimeType: string;
  base64: string;
}

export interface GatewayChatInput {
  userId?: string;
  userEmail?: string;
  planTier?: PlanTier;
  planPolicy?: AIPlanPolicy;
  isMinor?: boolean;
  maxOutputTokens?: number;
  prompt: string;
  systemInstruction?: string;
  history?: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
  routingMode: AIRoutingMode;
  requestedProviderId?: AIProviderId | 'auto';
  requestedModelId?: string;
  useWebSearch?: boolean;
  attachment?: GatewayAttachment | null;
  providerOverrides?: Array<Partial<GatewayProviderConfig> & { id: AIProviderId }>;
  modelOverrides?: Array<Partial<GatewayModelDefinition> & { id: string }>;
  budgetPolicy?: Partial<GatewayBudgetPolicy>;
  adminSettings?: Partial<GatewayAdminSettings>;
}

export interface GatewayCallResult {
  text: string;
  providerId: AIProviderId;
  providerName: string;
  modelId: string;
  apiModelName: string;
  accessTier: AIModelAccessTier;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  routingMode: AIRoutingMode;
  routingReason: string;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  fallbackNotice?: string;
  sources?: Array<{ title: string; url: string; domain?: string }>;
}

export interface GatewayTestResult {
  providerId: AIProviderId;
  configured: boolean;
  status: 'activo' | 'pendiente_configuracion' | 'error' | 'desactivado';
  latencyMs: number;
  modelTested: string;
  error: string;
  testedAt: string;
}

export const DEFAULT_BUDGET_POLICY: GatewayBudgetPolicy = {
  dailyGlobalLimitUsd: 5,
  monthlyGlobalLimitUsd: 30,
  perUserDailyRequestLimit: 5,
  perUserDailyTokenLimit: 180000,
  alertThresholdPercent: 75,
  onBudgetExceeded: 'fallback_free',
  activePlanDefault: 'plan_gratuito',
};

export const DEFAULT_ADMIN_SETTINGS: GatewayAdminSettings = {
  defaultRoutingMode: 'automatica',
  allowAutomaticFallback: true,
  blockPaidModelsForFreePlan: true,
  minorStrictSafeRouting: true,
  enableStreaming: true,
};

export const GATEWAY_PROVIDERS_BASE: Array<Omit<GatewayProviderConfig, 'configuredInBackend'>> = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    accessTier: 'free_quota',
    enabled: true,
    envVarName: 'GEMINI_API_KEY',
    defaultModelId: 'gemini__gemini-4-hydrogen',
    supportsStreaming: true,
    supportsVision: true,
    supportsDocuments: true,
    allowFallback: true,
    officialUrl: 'https://gemini.google.com/',
    pricingNote: 'Cuota gratuita configurable en Google AI Studio / facturación según uso.',
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT API)',
    accessTier: 'commercial',
    enabled: true,
    envVarName: 'OPENAI_API_KEY',
    defaultModelId: 'openai__gpt-4o-mini',
    supportsStreaming: true,
    supportsVision: true,
    supportsDocuments: false,
    allowFallback: true,
    officialUrl: 'https://platform.openai.com/',
    pricingNote: 'API comercial de pago por token consumido (GPT-4o mini / GPT-4o).',
  },
];

export const GATEWAY_MODELS_BASE: GatewayModelDefinition[] = [
  {
    id: 'gemini__gemini-4-hydrogen',
    apiModelName: 'gemini-4-hydrogen',
    providerId: 'gemini',
    label: 'Gemini 4 Hydrogen (Profundo · Multimodal)',
    accessTier: 'free_quota',
    enabled: true,
    maxContextTokens: 1000000,
    supportsVision: true,
    supportsDocuments: true,
    supportsReasoning: true,
    inputCostPer1MUsd: 0.35,
    outputCostPer1MUsd: 1.05,
    recommendedFor: ['documentos', 'investigacion', 'desarrollo_completo', 'multimodal'],
  },
  {
    id: 'gemini__gemini-3.1-flash-lite',
    apiModelName: 'gemini-3.1-flash-lite',
    providerId: 'gemini',
    label: 'Gemini 3.1 Flash Lite (Rápido · Económico)',
    accessTier: 'free_quota',
    enabled: true,
    maxContextTokens: 1000000,
    supportsVision: true,
    supportsDocuments: true,
    supportsReasoning: false,
    inputCostPer1MUsd: 0.075,
    outputCostPer1MUsd: 0.3,
    recommendedFor: ['resumen', 'glosario', 'respuestas_rapidas', 'bajo_costo'],
  },
  {
    id: 'openai__gpt-4o-mini',
    apiModelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    providerId: 'openai',
    label: 'GPT-4o mini (ChatGPT · OpenAI)',
    accessTier: 'commercial',
    enabled: true,
    maxContextTokens: 128000,
    supportsVision: true,
    supportsDocuments: false,
    supportsReasoning: false,
    inputCostPer1MUsd: 0.15,
    outputCostPer1MUsd: 0.6,
    recommendedFor: ['tutoria', 'redaccion', 'vision'],
  },
  {
    id: 'openai__gpt-4o',
    apiModelName: 'gpt-4o',
    providerId: 'openai',
    label: 'GPT-4o (ChatGPT Avanzado)',
    accessTier: 'commercial',
    enabled: true,
    maxContextTokens: 128000,
    supportsVision: true,
    supportsDocuments: false,
    supportsReasoning: true,
    inputCostPer1MUsd: 2.5,
    outputCostPer1MUsd: 10,
    recommendedFor: ['analisis_complejo', 'vision', 'comparacion'],
  },
];

// ------------------------------------------------------------------
// Runtime Credential Detection (Strict Secrets Only)
// ------------------------------------------------------------------
export function isProviderConfiguredInBackend(providerId: AIProviderId): boolean {
  switch (providerId) {
    case 'gemini':
      return Boolean((process.env.GEMINI_API_KEY || '').trim());
    case 'openai': {
      const k = (process.env.OPENAI_API_KEY || '').trim();
      return k.length >= 20 && (k.startsWith('sk-') || k.startsWith('proj-'));
    }
  }
}

export function getEffectiveProviders(
  overrides?: Array<Partial<GatewayProviderConfig> & { id: AIProviderId }>
): GatewayProviderConfig[] {
  const persisted = getProviderOverridesSnapshot();
  const map = new Map<AIProviderId, Partial<GatewayProviderConfig>>();
  for (const item of overrides || []) {
    map.set(item.id, item);
  }
  return GATEWAY_PROVIDERS_BASE.map((base) => {
    const ov = map.get(base.id);
    const persistedOv = persisted[base.id];
    return {
      ...base,
      enabled:
        typeof ov?.enabled === 'boolean'
          ? ov.enabled
          : typeof persistedOv?.enabled === 'boolean'
          ? persistedOv.enabled
          : base.enabled,
      defaultModelId: ov?.defaultModelId || persistedOv?.defaultModelId || base.defaultModelId,
      allowFallback: typeof ov?.allowFallback === 'boolean' ? ov.allowFallback : base.allowFallback,
      configuredInBackend: isProviderConfiguredInBackend(base.id),
    };
  });
}

export function getEffectiveModels(
  overrides?: Array<Partial<GatewayModelDefinition> & { id: string }>
): GatewayModelDefinition[] {
  const map = new Map<string, Partial<GatewayModelDefinition>>();
  for (const item of overrides || []) {
    map.set(item.id, item);
  }
  return GATEWAY_MODELS_BASE.map((base) => {
    const ov = map.get(base.id);
    return {
      ...base,
      enabled: typeof ov?.enabled === 'boolean' ? ov.enabled : base.enabled,
    };
  });
}

// ------------------------------------------------------------------
// Runtime Usage & Budget Ledger (Server-side enforcement)
// ------------------------------------------------------------------
interface DailyUsageBucket {
  dateKey: string;
  monthKey: string;
  globalUsd: number;
  globalRequests: number;
  byUser: Record<string, { requests: number; tokens: number; usd: number }>;
  byProvider: Record<string, { requests: number; tokens: number; usd: number; freeRequests: number; paidRequests: number }>;
}

const runtimeLedger: {
  day: DailyUsageBucket;
  monthlyUsdByMonth: Record<string, number>;
} = {
  day: {
    dateKey: new Date().toISOString().slice(0, 10),
    monthKey: new Date().toISOString().slice(0, 7),
    globalUsd: 0,
    globalRequests: 0,
    byUser: {},
    byProvider: {},
  },
  monthlyUsdByMonth: {},
};

function getTodayBucket(): DailyUsageBucket {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  if (runtimeLedger.day.dateKey !== today) {
    runtimeLedger.day = {
      dateKey: today,
      monthKey: month,
      globalUsd: 0,
      globalRequests: 0,
      byUser: {},
      byProvider: {},
    };
  }
  return runtimeLedger.day;
}

export function getRuntimeUsageSummary() {
  const bucket = getTodayBucket();
  return {
    dateKey: bucket.dateKey,
    monthKey: bucket.monthKey,
    dailyGlobalUsd: Number(bucket.globalUsd.toFixed(6)),
    monthlyGlobalUsd: Number((runtimeLedger.monthlyUsdByMonth[bucket.monthKey] || 0).toFixed(6)),
    dailyGlobalRequests: bucket.globalRequests,
    byUser: bucket.byUser,
    byProvider: bucket.byProvider,
  };
}

function estimateTokensFromText(text: string): number {
  const clean = (text || '').trim();
  if (!clean) return 0;
  return Math.max(1, Math.ceil(clean.length / 4));
}

export function calculateEstimatedCostUsd(
  model: GatewayModelDefinition,
  inputTokens: number,
  outputTokens: number
): number {
  if (model.accessTier === 'open_selfhosted') return 0;
  const inCost = (inputTokens / 1_000_000) * model.inputCostPer1MUsd;
  const outCost = (outputTokens / 1_000_000) * model.outputCostPer1MUsd;
  return Number((inCost + outCost).toFixed(6));
}

function recordRuntimeUsage(params: {
  userId: string;
  providerId: AIProviderId;
  accessTier: AIModelAccessTier;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}) {
  const bucket = getTodayBucket();
  const totalTokens = params.inputTokens + params.outputTokens;
  bucket.globalRequests += 1;
  bucket.globalUsd = Number((bucket.globalUsd + params.estimatedCostUsd).toFixed(6));
  runtimeLedger.monthlyUsdByMonth[bucket.monthKey] = Number(
    ((runtimeLedger.monthlyUsdByMonth[bucket.monthKey] || 0) + params.estimatedCostUsd).toFixed(6)
  );

  const u = bucket.byUser[params.userId] || { requests: 0, tokens: 0, usd: 0 };
  u.requests += 1;
  u.tokens += totalTokens;
  u.usd = Number((u.usd + params.estimatedCostUsd).toFixed(6));
  bucket.byUser[params.userId] = u;

  const p = bucket.byProvider[params.providerId] || {
    requests: 0,
    tokens: 0,
    usd: 0,
    freeRequests: 0,
    paidRequests: 0,
  };
  p.requests += 1;
  p.tokens += totalTokens;
  p.usd = Number((p.usd + params.estimatedCostUsd).toFixed(6));
  if (params.accessTier === 'commercial') {
    p.paidRequests += 1;
  } else {
    p.freeRequests += 1;
  }
  bucket.byProvider[params.providerId] = p;
}

// ------------------------------------------------------------------
// Provider Adapters (Unified Execution & Streaming)
// ------------------------------------------------------------------
function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING');
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function invokeGemini(params: {
  model: GatewayModelDefinition;
  prompt: string;
  systemInstruction: string;
  history: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
  attachment?: GatewayAttachment | null;
  useWebSearch?: boolean;
  maxOutputTokens?: number;
  onChunk?: (delta: string) => void;
}): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  sources?: Array<{ title: string; url: string; domain?: string }>;
}> {
  const ai = getGeminiClient();
  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];
  for (const turn of params.history.slice(-12)) {
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.text }],
    });
  }

  const userParts: Array<Record<string, unknown>> = [];
  if (params.attachment?.base64 && params.attachment?.mimeType) {
    userParts.push({
      inlineData: {
        mimeType: params.attachment.mimeType,
        data: params.attachment.base64,
      },
    });
  }
  userParts.push({ text: params.prompt });
  contents.push({ role: 'user', parts: userParts });

  const config: Record<string, unknown> = {
    systemInstruction: params.systemInstruction,
    ...(params.maxOutputTokens ? { maxOutputTokens: params.maxOutputTokens } : {}),
  };
  if (params.model.apiModelName === 'gemini-4-hydrogen') {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }
  if (params.useWebSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  if (params.onChunk) {
    const stream = await ai.models.generateContentStream({
      model: params.model.apiModelName,
      contents: contents as never,
      config: config as never,
    });
    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const sources: Array<{ title: string; url: string; domain?: string }> = [];
    for await (const chunk of stream) {
      const piece = chunk.text || '';
      if (piece) {
        fullText += piece;
        params.onChunk(piece);
      }
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount || inputTokens;
        outputTokens = chunk.usageMetadata.candidatesTokenCount || outputTokens;
      }
      const chunksMeta = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (Array.isArray(chunksMeta)) {
        for (const ch of chunksMeta) {
          if (ch.web?.uri && !sources.some((s) => s.url === ch.web?.uri)) {
            let domain = '';
            try {
              domain = new URL(ch.web.uri).hostname;
            } catch {
              domain = '';
            }
            sources.push({
              title: ch.web.title || domain || ch.web.uri,
              url: ch.web.uri,
              domain,
            });
          }
        }
      }
    }
    return {
      text: fullText,
      inputTokens: inputTokens || estimateTokensFromText(params.prompt + params.systemInstruction),
      outputTokens: outputTokens || estimateTokensFromText(fullText),
      ...(sources.length > 0 ? { sources } : {}),
    };
  }

  const resp = await ai.models.generateContent({
    model: params.model.apiModelName,
    contents: contents as never,
    config: config as never,
  });

  const text = resp.text || '';
  const inputTokens =
    resp.usageMetadata?.promptTokenCount || estimateTokensFromText(params.prompt + params.systemInstruction);
  const outputTokens = resp.usageMetadata?.candidatesTokenCount || estimateTokensFromText(text);

  const sources: Array<{ title: string; url: string; domain?: string }> = [];
  const chunksMeta = resp.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunksMeta)) {
    for (const ch of chunksMeta) {
      if (ch.web?.uri && !sources.some((s) => s.url === ch.web?.uri)) {
        let domain = '';
        try {
          domain = new URL(ch.web.uri).hostname;
        } catch {
          domain = '';
        }
        sources.push({
          title: ch.web.title || domain || ch.web.uri,
          url: ch.web.uri,
          domain,
        });
      }
    }
  }

  return {
    text,
    inputTokens,
    outputTokens,
    ...(sources.length > 0 ? { sources } : {}),
  };
}

async function invokeOpenAICompatible(params: {
  endpoint: string;
  apiKey: string;
  modelName: string;
  prompt: string;
  systemInstruction: string;
  history: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
  attachment?: GatewayAttachment | null;
  maxOutputTokens?: number;
  extraHeaders?: Record<string, string>;
  onChunk?: (delta: string) => void;
}): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: unknown }> = [
    { role: 'system', content: params.systemInstruction },
  ];
  for (const turn of params.history.slice(-12)) {
    messages.push({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.text,
    });
  }

  if (params.attachment?.base64 && params.attachment?.mimeType?.startsWith('image/')) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: params.prompt },
        {
          type: 'image_url',
          image_url: { url: `data:${params.attachment.mimeType};base64,${params.attachment.base64}` },
        },
      ],
    });
  } else {
    messages.push({ role: 'user', content: params.prompt });
  }

  const stream = Boolean(params.onChunk);
  const resp = await fetch(params.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      ...(params.extraHeaders || {}),
    },
    body: JSON.stringify({
      model: params.modelName,
      messages,
      temperature: 0.4,
      ...(params.maxOutputTokens ? { max_tokens: params.maxOutputTokens } : {}),
      stream,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!resp.ok) {
    const errBody = (await resp.json().catch(() => ({}))) as { error?: { message?: string }; message?: string };
    throw new Error(errBody?.error?.message || errBody?.message || `HTTP ${resp.status}`);
  }

  if (stream && resp.body && params.onChunk) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let inTokens = 0;
    let outTokens = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payloadStr = line.slice(5).trim();
        if (!payloadStr || payloadStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payloadStr) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const delta = parsed?.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            params.onChunk(delta);
          }
          if (parsed?.usage) {
            inTokens = parsed.usage.prompt_tokens || inTokens;
            outTokens = parsed.usage.completion_tokens || outTokens;
          }
        } catch {
          // ignore partial SSE JSON
        }
      }
    }
    return {
      text: fullText,
      inputTokens: inTokens || estimateTokensFromText(params.prompt + params.systemInstruction),
      outputTokens: outTokens || estimateTokensFromText(fullText),
    };
  }

  const payload = (await resp.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = payload?.choices?.[0]?.message?.content || '';
  return {
    text,
    inputTokens: payload?.usage?.prompt_tokens || estimateTokensFromText(params.prompt + params.systemInstruction),
    outputTokens: payload?.usage?.completion_tokens || estimateTokensFromText(text),
  };
}

type SingleAdapterInvoker = (params: {
  model: GatewayModelDefinition;
  prompt: string;
  systemInstruction: string;
  history: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
  attachment?: GatewayAttachment | null;
  useWebSearch?: boolean;
  maxOutputTokens?: number;
  onChunk?: (delta: string) => void;
}) => Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  sources?: Array<{ title: string; url: string; domain?: string }>;
}>;

let adapterOverrideForTests: SingleAdapterInvoker | null = null;
export function setAdapterInvokerForTests(invoker: SingleAdapterInvoker | null) {
  adapterOverrideForTests = invoker;
}

async function callSingleAdapter(params: {
  model: GatewayModelDefinition;
  prompt: string;
  systemInstruction: string;
  history: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
  attachment?: GatewayAttachment | null;
  useWebSearch?: boolean;
  maxOutputTokens?: number;
  onChunk?: (delta: string) => void;
}): Promise<{
  text: string;
  inputTokens: number;
  outputTokens: number;
  sources?: Array<{ title: string; url: string; domain?: string }>;
}> {
  if (adapterOverrideForTests) {
    return adapterOverrideForTests(params);
  }
  switch (params.model.providerId) {
    case 'gemini':
      return invokeGemini(params);
    case 'openai':
      return invokeOpenAICompatible({
        endpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: (process.env.OPENAI_API_KEY || '').trim(),
        modelName: params.model.apiModelName,
        ...params,
      });
  }
}

// ------------------------------------------------------------------
// FABRO MODEL ROUTER + Freemium & Monthly Budget Guard
// ------------------------------------------------------------------
export function selectRoutePlan(params: {
  input: GatewayChatInput;
  providers: GatewayProviderConfig[];
  models: GatewayModelDefinition[];
  budget: GatewayBudgetPolicy;
  settings: GatewayAdminSettings;
}): {
  primary: GatewayModelDefinition;
  fallbacks: GatewayModelDefinition[];
  routingReason: string;
  budgetFallbackNotice?: string;
} {
  const { input, providers, models, settings } = params;
  const providerMap = new Map(providers.map((p) => [p.id, p]));
  const limits = getSystemLimitsSnapshot();
  const budgetSnap = getBudgetStatusSnapshot();

  const planTier: PlanTier = input.planTier || (input.planPolicy === 'plan_educativo' || input.planPolicy === 'plan_administrador' ? 'premium' : 'free');
  const paidBlockedByBudget = budgetSnap.paidBlocked || budgetSnap.paidRestricted;
  const paidAllowedForPlan = planTier === 'premium' || limits.allowPaidModelsOnFree;
  const allowPaid = paidAllowedForPlan && !paidBlockedByBudget;

  let budgetFallbackNotice: string | undefined;
  if (budgetSnap.paidBlocked) {
    budgetFallbackNotice =
      'Presupuesto mensual de modelos pagos al 100%: FABRO bloqueó automáticamente operaciones pagas y utiliza únicamente modelos gratuitos disponibles.';
  } else if (budgetSnap.paidRestricted) {
    budgetFallbackNotice =
      'Presupuesto mensual supera el 90%: FABRO restringió modelos comerciales y priorizó proveedores gratuitos.';
  }

  const hasImage = Boolean(input.attachment?.mimeType?.startsWith('image/'));
  const hasPdf = input.attachment?.mimeType === 'application/pdf';

  const isCompatible = (m: GatewayModelDefinition, canUsePaid: boolean): boolean => {
    const prov = providerMap.get(m.providerId);
    if (!prov || !prov.enabled || !prov.configuredInBackend || !m.enabled) return false;
    if (!canUsePaid && m.accessTier === 'commercial') return false;
    if (hasImage && !m.supportsVision) return false;
    if (hasPdf && !m.supportsDocuments) return false;
    return true;
  };

  if (input.routingMode === 'manual') {
    const reqModel =
      (input.requestedModelId && models.find((m) => m.id === input.requestedModelId)) ||
      (input.requestedProviderId &&
        input.requestedProviderId !== 'auto' &&
        models.find((m) => {
          const p = providerMap.get(input.requestedProviderId as AIProviderId);
          return p ? m.id === p.defaultModelId : m.providerId === input.requestedProviderId;
        }));

    if (!reqModel) {
      throw new Error('MODEL_NOT_FOUND: El modelo o proveedor seleccionado no existe en el catálogo.');
    }

    const reqProv = providerMap.get(reqModel.providerId)!;
    if (!reqProv.enabled || !reqModel.enabled) {
      throw new Error(
        `PROVIDER_DISABLED: ${reqProv.name} (${reqModel.label}) fue desactivado por el administrador.`
      );
    }
    if (!reqProv.configuredInBackend) {
      throw new Error(
        `PROVIDER_NOT_CONFIGURED: ${reqProv.name} aún no tiene su credencial (${reqProv.envVarName}) configurada en Secrets del backend.`
      );
    }
    if (hasImage && !reqModel.supportsVision) {
      throw new Error(
        `INCOMPATIBLE_ATTACHMENT: ${reqModel.label} no soporta análisis de imágenes. Elegí un modelo multimodal o activá Enrutamiento Automático.`
      );
    }
    if (hasPdf && !reqModel.supportsDocuments) {
      throw new Error(
        `INCOMPATIBLE_ATTACHMENT: ${reqModel.label} no soporta adjuntos PDF directos. Elegí Gemini o usá Enrutamiento Automático.`
      );
    }
    if (!allowPaid && reqModel.accessTier === 'commercial') {
      throw new Error(
        budgetSnap.paidBlocked || budgetSnap.paidRestricted
          ? `BUDGET_PAID_BLOCKED: El presupuesto mensual alcanzó el umbral de protección (${budgetSnap.percentUsed.toFixed(1)}%). Los modelos pagos están bloqueados; seleccioná un modelo gratuito o modo Automático.`
          : `PLAN_OR_BUDGET_RESTRICTED: ${reqModel.label} pertenece a FABRO PREMIUM. Tu plan GRATIS utiliza modelos gratuitos o podés conocer FABRO PREMIUM.`
      );
    }

    const fallbackPool = settings.allowAutomaticFallback && reqProv.allowFallback
      ? models.filter((m) => m.id !== reqModel.id && isCompatible(m, allowPaid))
      : [];

    return {
      primary: reqModel,
      fallbacks: fallbackPool.slice(0, 3),
      routingReason: `Selección manual explícita: ${reqProv.name} · ${reqModel.label}.`,
      budgetFallbackNotice,
    };
  }

  // Modo Automático: analizar prompt, complejidad, adjuntos, costo y disponibilidad
  const candidates = models.filter((m) => isCompatible(m, allowPaid));
  if (candidates.length === 0) {
    throw new Error(
      'NO_AVAILABLE_PROVIDER: No hay ningún proveedor activo, configurado y compatible con tu plan y presupuesto actual.'
    );
  }

  const lower = input.prompt.toLowerCase();
  const promptLen = input.prompt.length + (input.history || []).reduce((acc, h) => acc + h.text.length, 0);
  const needsDeepReasoning =
    promptLen > 2400 ||
    hasPdf ||
    hasImage ||
    Boolean(input.useWebSearch) ||
    /\/(desarrollo|comparar|examen|investigar)|teor|demostr|compar|código|algoritmo|análisis|jurídic|ecuación|integral/i.test(
      lower
    );

  const ranked = [...candidates].sort((a, b) => {
    const score = (m: GatewayModelDefinition): number => {
      let s = 0;
      if (m.accessTier === 'open_selfhosted') s += 35;
      else if (m.accessTier === 'free_quota') s += 25;
      else s += 5;

      if (needsDeepReasoning && m.supportsReasoning) s += 30;
      if (!needsDeepReasoning && m.inputCostPer1MUsd <= 0.25) s += 22;
      if (input.useWebSearch && m.providerId === 'gemini') s += 40;
      if ((hasPdf || hasImage) && m.providerId === 'gemini') s += 30;
      if (promptLen > 30000 && m.maxContextTokens >= 200000) s += 25;
      if (m.providerId === 'gemini' && needsDeepReasoning && m.apiModelName === 'gemini-4-hydrogen') s += 20;
      if (m.providerId === 'gemini' && !needsDeepReasoning && m.apiModelName === 'gemini-3.1-flash-lite') s += 16;
      return s;
    };
    return score(b) - score(a);
  });

  const primary = ranked[0];
  const primaryProv = providerMap.get(primary.providerId)!;
  const reasonParts: string[] = [];
  if (hasPdf) reasonParts.push('soporta lectura multimodal PDF');
  else if (hasImage) reasonParts.push('soporta visión de imágenes');
  if (input.useWebSearch) reasonParts.push('investigación web fundamentada');
  if (needsDeepReasoning) reasonParts.push('razonamiento académico complejo');
  else reasonParts.push('respuesta ágil con mínimo costo');
  if (primary.accessTier !== 'commercial') reasonParts.push('prioridad cuota gratuita / abierta');

  return {
    primary,
    fallbacks: settings.allowAutomaticFallback ? ranked.slice(1, 4) : [],
    routingReason: `FABRO Model Router eligió ${primaryProv.name} (${primary.apiModelName}): ${reasonParts.join(', ')}.`,
    budgetFallbackNotice,
  };
}

export async function executeGatewayChat(
  input: GatewayChatInput,
  onChunk?: (delta: string) => void
): Promise<GatewayCallResult> {
  const providers = getEffectiveProviders(input.providerOverrides);
  const models = getEffectiveModels(input.modelOverrides);
  const budget: GatewayBudgetPolicy = { ...DEFAULT_BUDGET_POLICY, ...(input.budgetPolicy || {}) };
  const settings: GatewayAdminSettings = { ...DEFAULT_ADMIN_SETTINGS, ...(input.adminSettings || {}) };

  const route = selectRoutePlan({ input, providers, models, budget, settings });
  const providerMap = new Map(providers.map((p) => [p.id, p]));
  const systemInstruction =
    input.systemInstruction ||
    'Sos FABRO IA, tutor académico universitario claro, riguroso y honesto en español. Nunca inventes fuentes.';

  const queue = [route.primary, ...route.fallbacks];
  let firstErrorMsg = '';
  let firstModelLabel = '';

  for (let i = 0; i < queue.length; i += 1) {
    const candidate = queue[i];
    const prov = providerMap.get(candidate.providerId)!;
    const started = Date.now();
    try {
      const res = await callSingleAdapter({
        model: candidate,
        prompt: input.prompt,
        systemInstruction,
        history: input.history || [],
        attachment: input.attachment,
        useWebSearch: input.useWebSearch && candidate.providerId === 'gemini',
        maxOutputTokens: input.maxOutputTokens,
        onChunk: i === 0 ? onChunk : undefined,
      });
      if (i > 0 && onChunk && res.text) {
        onChunk(res.text);
      }

      const latencyMs = Date.now() - started;
      const estimatedCostUsd = calculateEstimatedCostUsd(candidate, res.inputTokens, res.outputTokens);
      recordRuntimeUsage({
        userId: input.userId || 'anon',
        providerId: candidate.providerId,
        accessTier: candidate.accessTier,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        estimatedCostUsd,
      });

      const fallbackUsed = i > 0;
      const fallbackNotice = fallbackUsed
        ? `Respaldo automático activado: ${firstModelLabel} falló (${firstErrorMsg}). Se respondió con ${prov.name} (${candidate.apiModelName}).`
        : route.budgetFallbackNotice;

      return {
        text: res.text,
        providerId: candidate.providerId,
        providerName: prov.name,
        modelId: candidate.id,
        apiModelName: candidate.apiModelName,
        accessTier: candidate.accessTier,
        inputTokens: res.inputTokens,
        outputTokens: res.outputTokens,
        totalTokens: res.inputTokens + res.outputTokens,
        estimatedCostUsd,
        latencyMs,
        routingMode: input.routingMode,
        routingReason: route.routingReason,
        fallbackUsed,
        ...(fallbackUsed ? { fallbackFrom: firstModelLabel } : {}),
        ...(fallbackNotice ? { fallbackNotice } : {}),
        ...(res.sources ? { sources: res.sources } : {}),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (i === 0) {
        firstErrorMsg = msg.slice(0, 140);
        firstModelLabel = `${prov.name} (${candidate.apiModelName})`;
      }
      if (!settings.allowAutomaticFallback || i === queue.length - 1) {
        throw new Error(
          firstModelLabel && firstModelLabel !== `${prov.name} (${candidate.apiModelName})`
            ? `Fallo en ${firstModelLabel} (${firstErrorMsg}) y en respaldo ${prov.name}: ${msg}`
            : `${prov.name} (${candidate.apiModelName}) error: ${msg}`
        );
      }
    }
  }

  throw new Error('No se pudo completar la solicitud en FABRO AI Gateway.');
}

// ------------------------------------------------------------------
// Live Honest Connection Tester
// ------------------------------------------------------------------
export async function testProviderConnection(
  providerId: AIProviderId,
  providerOverride?: Partial<GatewayProviderConfig>
): Promise<GatewayTestResult> {
  const providers = getEffectiveProviders(providerOverride ? [{ ...providerOverride, id: providerId }] : undefined);
  const prov = providers.find((p) => p.id === providerId);
  const testedAt = new Date().toISOString();

  if (!prov) {
    return {
      providerId,
      configured: false,
      status: 'error',
      latencyMs: 0,
      modelTested: '',
      error: 'Proveedor desconocido.',
      testedAt,
    };
  }

  if (!prov.configuredInBackend) {
    return {
      providerId,
      configured: false,
      status: 'pendiente_configuracion',
      latencyMs: 0,
      modelTested: prov.defaultModelId,
      error: `Falta configurar ${prov.envVarName} en Secrets del backend.`,
      testedAt,
    };
  }

  if (!prov.enabled) {
    return {
      providerId,
      configured: true,
      status: 'desactivado',
      latencyMs: 0,
      modelTested: prov.defaultModelId,
      error: 'Proveedor desactivado manualmente desde el Panel Administrativo.',
      testedAt,
    };
  }

  const models = getEffectiveModels();
  const targetModel =
    models.find((m) => m.id === prov.defaultModelId && m.providerId === providerId) ||
    models.find((m) => m.providerId === providerId);

  if (!targetModel) {
    return {
      providerId,
      configured: true,
      status: 'error',
      latencyMs: 0,
      modelTested: '',
      error: 'No hay modelo configurado para este proveedor.',
      testedAt,
    };
  }

  const start = Date.now();
  try {
    await callSingleAdapter({
      model: targetModel,
      prompt: 'Respondé únicamente con la palabra: OK',
      systemInstruction: 'Verificación de conectividad.',
      history: [],
    });

    return {
      providerId,
      configured: true,
      status: 'activo',
      latencyMs: Date.now() - start,
      modelTested: targetModel.apiModelName,
      error: '',
      testedAt,
    };
  } catch (err) {
    return {
      providerId,
      configured: true,
      status: 'error',
      latencyMs: Date.now() - start,
      modelTested: targetModel.apiModelName,
      error: err instanceof Error ? err.message : 'Fallo de conexión con el proveedor.',
      testedAt,
    };
  }
}

// ------------------------------------------------------------------
// Parallel Multi-AI Comparator (2-4 models)
// ------------------------------------------------------------------
export interface GatewayCompareEntry {
  modelId: string;
  providerId: AIProviderId;
  providerName: string;
  label: string;
  apiModelName: string;
  accessTier: AIModelAccessTier;
  status: 'ok' | 'not_configured' | 'disabled' | 'error';
  text: string;
  error: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  officialUrl: string;
}

export async function executeGatewayCompare(params: {
  userId?: string;
  planTier?: PlanTier;
  maxOutputTokens?: number;
  prompt: string;
  modelIds: string[];
  mode?: 'interpretativo' | 'sencillo';
  educationLevel?: string;
  subjectName?: string;
  providerOverrides?: Array<Partial<GatewayProviderConfig> & { id: AIProviderId }>;
  modelOverrides?: Array<Partial<GatewayModelDefinition> & { id: string }>;
  budgetPolicy?: Partial<GatewayBudgetPolicy>;
}): Promise<{
  prompt: string;
  results: GatewayCompareEntry[];
  synthesisMarkdown: string;
  agreements: string[];
  differences: string[];
  limitations: string[];
  totalEstimatedCostUsd: number;
}> {
  const providers = getEffectiveProviders(params.providerOverrides);
  const models = getEffectiveModels(params.modelOverrides);
  const providerMap = new Map(providers.map((p) => [p.id, p]));
  const selectedIds = Array.from(new Set(params.modelIds)).slice(0, 4);
  const limits = getSystemLimitsSnapshot();
  const budgetSnap = getBudgetStatusSnapshot();
  const planTier: PlanTier = params.planTier || 'free';
  const allowPaid = (planTier === 'premium' || limits.allowPaidModelsOnFree) && !budgetSnap.paidBlocked && !budgetSnap.paidRestricted;

  const modeDesc =
    params.mode === 'sencillo'
      ? 'Explicación didáctica clara, pasos concretos y lenguaje accesible.'
      : 'Resumen interpretativo y explicativo riguroso: significado, fundamentos, ejemplos y contraste conceptual.';
  const systemInstruction = `Sos un modelo consultado en paralelo desde FABRO AI GATEWAY (${params.educationLevel || 'universitario'}).
${params.subjectName ? `Materia: ${params.subjectName}.` : ''}
Estilo solicitado: ${modeDesc}
Respondé siempre en español claro en Markdown sin inventar citas ni datos.`;

  const results = await Promise.all(
    selectedIds.map(async (id): Promise<GatewayCompareEntry> => {
      const m = models.find((item) => item.id === id) || models.find((item) => item.providerId === id);
      if (!m) {
        return {
          modelId: id,
          providerId: 'gemini',
          providerName: 'Desconocido',
          label: id,
          apiModelName: '',
          accessTier: 'commercial',
          status: 'error',
          text: '',
          error: 'Modelo no encontrado en catálogo.',
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          officialUrl: 'https://www.google.com/',
        };
      }
      const prov = providerMap.get(m.providerId)!;
      if (!prov.enabled || !m.enabled) {
        return {
          modelId: m.id,
          providerId: m.providerId,
          providerName: prov.name,
          label: m.label,
          apiModelName: m.apiModelName,
          accessTier: m.accessTier,
          status: 'disabled',
          text: '',
          error: `${prov.name} o el modelo seleccionado está desactivado en el Panel Administrativo.`,
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          officialUrl: prov.officialUrl,
        };
      }
      if (m.accessTier === 'commercial' && !allowPaid) {
        return {
          modelId: m.id,
          providerId: m.providerId,
          providerName: prov.name,
          label: m.label,
          apiModelName: m.apiModelName,
          accessTier: m.accessTier,
          status: 'disabled',
          text: '',
          error:
            budgetSnap.paidBlocked || budgetSnap.paidRestricted
              ? 'Bloqueado temporalmente por límite de presupuesto mensual de modelos pagos.'
              : 'Modelo avanzado exclusivo de FABRO PREMIUM.',
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          officialUrl: prov.officialUrl,
        };
      }
      if (!prov.configuredInBackend) {
        return {
          modelId: m.id,
          providerId: m.providerId,
          providerName: prov.name,
          label: m.label,
          apiModelName: m.apiModelName,
          accessTier: m.accessTier,
          status: 'not_configured',
          text: '',
          error: `Credencial ${prov.envVarName} pendiente de configuración en Secrets del backend.`,
          latencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          officialUrl: prov.officialUrl,
        };
      }

      const start = Date.now();
      try {
        const res = await callSingleAdapter({
          model: m,
          prompt: params.prompt,
          systemInstruction,
          history: [],
          maxOutputTokens: params.maxOutputTokens,
        });
        const cost = calculateEstimatedCostUsd(m, res.inputTokens, res.outputTokens);
        recordRuntimeUsage({
          userId: params.userId || 'anon',
          providerId: m.providerId,
          accessTier: m.accessTier,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          estimatedCostUsd: cost,
        });
        return {
          modelId: m.id,
          providerId: m.providerId,
          providerName: prov.name,
          label: m.label,
          apiModelName: m.apiModelName,
          accessTier: m.accessTier,
          status: 'ok',
          text: res.text,
          error: '',
          latencyMs: Date.now() - start,
          inputTokens: res.inputTokens,
          outputTokens: res.outputTokens,
          estimatedCostUsd: cost,
          officialUrl: prov.officialUrl,
        };
      } catch (err) {
        return {
          modelId: m.id,
          providerId: m.providerId,
          providerName: prov.name,
          label: m.label,
          apiModelName: m.apiModelName,
          accessTier: m.accessTier,
          status: 'error',
          text: '',
          error: err instanceof Error ? err.message : 'Error consultando proveedor.',
          latencyMs: Date.now() - start,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          officialUrl: prov.officialUrl,
        };
      }
    })
  );

  const okResults = results.filter((r) => r.status === 'ok' && r.text.trim());
  const totalEstimatedCostUsd = Number(
    results.reduce((acc, r) => acc + (r.estimatedCostUsd || 0), 0).toFixed(6)
  );

  let synthesisMarkdown = '';
  let agreements: string[] = [];
  let differences: string[] = [];
  let limitations: string[] = [];

  if (okResults.length >= 2 && isProviderConfiguredInBackend('gemini')) {
    try {
      const ai = getGeminiClient();
      const digest = okResults
        .map((r) => `### ${r.label} (${r.providerName} · ${r.apiModelName})\n${r.text.slice(0, 3200)}`)
        .join('\n\n---\n\n');
      const synthResp = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Sos FABRO IA comparando respuestas reales sobre: "${params.prompt}".
Respondé en JSON estricto con:
{
  "agreements": ["punto de coincidencia 1", ...],
  "differences": ["diferencia o matiz 1", ...],
  "limitations": ["limitación o punto pendiente de verificar 1", ...],
  "synthesisMarkdown": "Síntesis interpretativa final en Markdown para estudiar"
}

Respuestas recibidas:
${digest}`,
        config: { responseMimeType: 'application/json' },
      });
      const parsed = JSON.parse((synthResp.text || '{}').trim()) as {
        agreements?: string[];
        differences?: string[];
        limitations?: string[];
        synthesisMarkdown?: string;
      };
      agreements = Array.isArray(parsed.agreements) ? parsed.agreements.slice(0, 5) : [];
      differences = Array.isArray(parsed.differences) ? parsed.differences.slice(0, 5) : [];
      limitations = Array.isArray(parsed.limitations) ? parsed.limitations.slice(0, 5) : [];
      synthesisMarkdown = String(parsed.synthesisMarkdown || '');
    } catch {
      synthesisMarkdown = '';
    }
  }

  return {
    prompt: params.prompt,
    results,
    synthesisMarkdown,
    agreements,
    differences,
    limitations,
    totalEstimatedCostUsd,
  };
}
