import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type ConnectProviderId =
  | 'openai'
  | 'gemini'
  | 'claude'
  | 'deepseek'
  | 'qwen'
  | 'mistral'
  | 'grok';

export type ConnectAuthMethod = 'byok' | 'oauth_pkce' | 'web_viewer';

export interface ConnectProviderCatalogEntry {
  id: ConnectProviderId;
  name: string;
  shortName: string;
  description: string;
  officialUrl: string;
  docsKeyUrl: string;
  authMethods: ConnectAuthMethod[];
  oauthSupported: boolean;
  oauthConfigured: boolean;
  oauthStatusNote: string;
  defaultEndpoint: string;
  regionalEndpoints?: Array<{ id: string; label: string; url: string }>;
  defaultModel: string;
  models: Array<{ id: string; label: string; contextK?: number }>;
  billingNote: string;
  supportsPersonalLimit: boolean;
}

export interface PersonalConnectionRecord {
  id: string;
  uid: string;
  providerId: ConnectProviderId;
  providerName: string;
  label: string;
  authMethod: 'byok' | 'oauth_pkce';
  status: 'connected' | 'disconnected' | 'error';
  lastTestStatus: 'verified' | 'failed' | 'untested';
  lastTestedAt: string;
  lastError: string;
  endpointUrl: string;
  regionId?: string;
  selectedModel: string;
  maskedKey: string;
  encryptedSecret: string; // AES-256-GCM iv:tag:cipher (never sent to frontend)
  encryptedRefreshToken?: string;
  oauthAccountEmail?: string;
  oauthPlanScope?: 'identity_only' | 'plan_usage' | 'none';
  isDefault: boolean;
  dailyRequestLimit: number; // 0 = unlimited by FABRO (governed by provider)
  monthlyBudgetAlertUsd: number; // 0 = disabled
  createdAt: string;
  updatedAt: string;
}

export interface SafePersonalConnectionDTO {
  id: string;
  uid: string;
  providerId: ConnectProviderId;
  providerName: string;
  label: string;
  authMethod: 'byok' | 'oauth_pkce';
  status: 'connected' | 'disconnected' | 'error';
  lastTestStatus: 'verified' | 'failed' | 'untested';
  lastTestedAt: string;
  lastError: string;
  endpointUrl: string;
  regionId?: string;
  selectedModel: string;
  maskedKey: string;
  oauthAccountEmail?: string;
  oauthPlanScope?: 'identity_only' | 'plan_usage' | 'none';
  isDefault: boolean;
  dailyRequestLimit: number;
  monthlyBudgetAlertUsd: number;
  usedToday: number;
  usedThisMonth: number;
  tokensThisMonth: number;
  estimatedPersonalUsdThisMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalUsageLogRecord {
  id: string;
  uid: string;
  connectionId: string;
  connectionLabel: string;
  providerId: ConnectProviderId;
  modelId: string;
  authMethod: 'byok' | 'oauth_pkce';
  billingOwner: 'personal';
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  status: 'success' | 'error' | 'blocked';
  errorMessage?: string;
  latencyMs: number;
  timestamp: string;
  dateKey: string;
  monthKey: string;
}

export interface OAuthPkceSession {
  state: string;
  uid: string;
  providerId: 'openai';
  codeVerifier: string;
  redirectUri: string;
  createdAtMs: number;
}

interface PersistedConnectStore {
  connections: PersonalConnectionRecord[];
  usageLogs: PersonalUsageLogRecord[];
}

export function isChatGptOAuthConfigured(): boolean {
  return Boolean((process.env.OPENAI_CHATGPT_OAUTH_CLIENT_ID || '').trim());
}

export function getConnectProviderCatalog(): ConnectProviderCatalogEntry[] {
  const chatGptOAuthReady = isChatGptOAuthConfigured();
  return [
    {
      id: 'openai',
      name: 'ChatGPT / OpenAI',
      shortName: 'ChatGPT',
      description:
        'Conectá tu propia API Key de OpenAI (BYOK) o vinculá Sign in with ChatGPT cuando esté autorizado.',
      officialUrl: 'https://chatgpt.com/',
      docsKeyUrl: 'https://platform.openai.com/api-keys',
      authMethods: ['byok', 'oauth_pkce', 'web_viewer'],
      oauthSupported: true,
      oauthConfigured: chatGptOAuthReady,
      oauthStatusNote: chatGptOAuthReady
        ? 'OAuth 2.0 + PKCE activo para identidad ChatGPT / uso de plan elegible.'
        : 'Sign in with ChatGPT usa OIDC/OAuth 2.0 PKCE (auth.openai.com) y requiere aprobación/Client ID de OpenAI para apps web alojadas. BYOK con API Key personal está 100% operativo ahora.',
      defaultEndpoint: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      models: [
        { id: 'gpt-4o-mini', label: 'GPT-4o mini (Rápido y económico)', contextK: 128 },
        { id: 'gpt-4o', label: 'GPT-4o (Multimodal avanzado)', contextK: 128 },
        { id: 'o3-mini', label: 'o3-mini (Razonamiento)', contextK: 200 },
        { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', contextK: 1000 },
      ],
      billingNote: 'Consumo personal: facturado directamente por OpenAI a tu cuenta o API Key.',
      supportsPersonalLimit: true,
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      shortName: 'Gemini',
      description:
        'Usá tu propia API Key de Google AI Studio con cuota personal sin consumir las consultas de FABRO.',
      officialUrl: 'https://gemini.google.com/',
      docsKeyUrl: 'https://aistudio.google.com/apikey',
      authMethods: ['byok', 'web_viewer'],
      oauthSupported: false,
      oauthConfigured: false,
      oauthStatusNote:
        'Las sesiones web de Gemini requieren API Key oficial de Google AI Studio para ejecución directa dentro de FABRO.',
      defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
      defaultModel: 'gemini-2.5-flash',
      models: [
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Rápido y multimodal)', contextK: 1000 },
        { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Razonamiento complejo)', contextK: 1000 },
        { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', contextK: 1000 },
      ],
      billingNote: 'Consumo personal: usa la cuota gratuita o facturación de tu cuenta Google AI Studio.',
      supportsPersonalLimit: true,
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      shortName: 'Claude',
      description:
        'Conectá tu API Key de Anthropic Console para usar Claude Sonnet / Haiku con tu propio consumo.',
      officialUrl: 'https://claude.ai/',
      docsKeyUrl: 'https://console.anthropic.com/settings/keys',
      authMethods: ['byok', 'web_viewer'],
      oauthSupported: false,
      oauthConfigured: false,
      oauthStatusNote:
        'Requiere API Key de Anthropic Console (independiente de suscripciones Claude Pro web).',
      defaultEndpoint: 'https://api.anthropic.com/v1',
      defaultModel: 'claude-3-5-haiku-latest',
      models: [
        { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Ágil)', contextK: 200 },
        { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet (Análisis profundo)', contextK: 200 },
      ],
      billingNote: 'Consumo personal: facturado por Anthropic según saldo de tu consola API.',
      supportsPersonalLimit: true,
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      shortName: 'DeepSeek',
      description:
        'Conectá tu API Key de DeepSeek Platform para razonamiento matemático y programación.',
      officialUrl: 'https://chat.deepseek.com/',
      docsKeyUrl: 'https://platform.deepseek.com/api_keys',
      authMethods: ['byok', 'web_viewer'],
      oauthSupported: false,
      oauthConfigured: false,
      oauthStatusNote: 'Conexión BYOK oficial mediante plataforma de desarrolladores DeepSeek.',
      defaultEndpoint: 'https://api.deepseek.com/v1',
      defaultModel: 'deepseek-chat',
      models: [
        { id: 'deepseek-chat', label: 'DeepSeek V3 Chat', contextK: 64 },
        { id: 'deepseek-reasoner', label: 'DeepSeek R1 Reasoner', contextK: 64 },
      ],
      billingNote: 'Consumo personal: facturado en tu saldo de DeepSeek Platform.',
      supportsPersonalLimit: true,
    },
    {
      id: 'qwen',
      name: 'Qwen (Alibaba Cloud)',
      shortName: 'Qwen',
      description:
        'Conectá tu API Key de Alibaba Cloud Model Studio (DashScope compatible OpenAI).',
      officialUrl: 'https://chat.qwen.ai/',
      docsKeyUrl: 'https://bailian.console.alibabacloud.com/',
      authMethods: ['byok', 'web_viewer'],
      oauthSupported: false,
      oauthConfigured: false,
      oauthStatusNote: 'Compatible con endpoint internacional DashScope + API Key personal.',
      defaultEndpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
      defaultModel: 'qwen-plus',
      models: [
        { id: 'qwen-plus', label: 'Qwen Plus (Equilibrado)', contextK: 128 },
        { id: 'qwen-turbo', label: 'Qwen Turbo (Rápido)', contextK: 128 },
        { id: 'qwen-max', label: 'Qwen Max (Avanzado)', contextK: 32 },
      ],
      billingNote: 'Consumo personal: gestionado en tu cuenta Alibaba Cloud Model Studio.',
      supportsPersonalLimit: true,
    },
    {
      id: 'mistral',
      name: 'Mistral AI',
      shortName: 'Mistral',
      description:
        'Conectá tu API Key de La Plateforme (Mistral AI) para modelos europeos de alta velocidad.',
      officialUrl: 'https://chat.mistral.ai/',
      docsKeyUrl: 'https://console.mistral.ai/api-keys/',
      authMethods: ['byok', 'web_viewer'],
      oauthSupported: false,
      oauthConfigured: false,
      oauthStatusNote: 'Requiere API Key de Mistral Console (La Plateforme).',
      defaultEndpoint: 'https://api.mistral.ai/v1',
      defaultModel: 'mistral-small-latest',
      models: [
        { id: 'mistral-small-latest', label: 'Mistral Small', contextK: 32 },
        { id: 'mistral-large-latest', label: 'Mistral Large', contextK: 128 },
      ],
      billingNote: 'Consumo personal: facturado directamente en tu cuenta Mistral Console.',
      supportsPersonalLimit: true,
    },
    {
      id: 'grok',
      name: 'Grok (xAI)',
      shortName: 'Grok',
      description:
        'Conectá tu API Key de xAI Console para utilizar modelos Grok directamente desde FABRO.',
      officialUrl: 'https://grok.com/',
      docsKeyUrl: 'https://console.x.ai/',
      authMethods: ['byok', 'web_viewer'],
      oauthSupported: false,
      oauthConfigured: false,
      oauthStatusNote: 'Requiere API Key personal emitida en console.x.ai.',
      defaultEndpoint: 'https://api.x.ai/v1',
      defaultModel: 'grok-2-latest',
      models: [
        { id: 'grok-2-latest', label: 'Grok 2', contextK: 131 },
        { id: 'grok-3-mini-beta', label: 'Grok 3 Mini', contextK: 131 },
      ],
      billingNote: 'Consumo personal: facturado en tu consola xAI.',
      supportsPersonalLimit: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// AES-256-GCM Master Key & Encryption Helpers (Strictly Backend-Only)
// ---------------------------------------------------------------------------
let storePath = path.join(process.cwd(), 'server', 'data', 'connect-store.json');
const masterKeyPath = path.join(process.cwd(), 'server', 'data', '.connect-master.key');
let cachedMasterKey: Buffer | null = null;
let cachedStore: PersistedConnectStore | null = null;
let writeChain: Promise<void> = Promise.resolve();
const oauthSessions = new Map<string, OAuthPkceSession>();

function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;
  const envKey = (process.env.FABRO_CONNECT_MASTER_KEY || '').trim();
  if (envKey) {
    cachedMasterKey = crypto.createHash('sha256').update(envKey).digest();
    return cachedMasterKey;
  }
  try {
    fs.mkdirSync(path.dirname(masterKeyPath), { recursive: true });
    if (fs.existsSync(masterKeyPath)) {
      const hex = fs.readFileSync(masterKeyPath, 'utf8').trim();
      if (hex.length === 64) {
        cachedMasterKey = Buffer.from(hex, 'hex');
        return cachedMasterKey;
      }
    }
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(masterKeyPath, generated.toString('hex'), { mode: 0o600 });
    cachedMasterKey = generated;
    return cachedMasterKey;
  } catch {
    // Fallback deterministic in-process random key if FS is read-only
    cachedMasterKey = crypto.randomBytes(32);
    return cachedMasterKey;
  }
}

export function encryptSecret(plaintext: string): string {
  const clean = String(plaintext || '');
  if (!clean) return '';
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  if (!payload || !payload.includes(':')) return '';
  const parts = payload.split(':');
  if (parts.length !== 3) return '';
  try {
    const key = getMasterKey();
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const cipherText = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export function maskSecret(secret: string): string {
  const clean = String(secret || '').trim();
  if (!clean) return 'Sin clave (local)';
  if (clean.length <= 8) return '••••' + clean.slice(-2);
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

export function sanitizeSecretFromText(text: string, secret?: string): string {
  let out = String(text || '');
  if (secret && secret.length >= 6) {
    out = out.split(secret).join('[REDACTED]');
  }
  return out
    .replace(/sk-[A-Za-z0-9_\-]{10,}/g, '[REDACTED_KEY]')
    .replace(/AIza[A-Za-z0-9_\-]{10,}/g, '[REDACTED_KEY]')
    .replace(/xai-[A-Za-z0-9_\-]{10,}/g, '[REDACTED_KEY]');
}

function loadConnectStore(): PersistedConnectStore {
  if (cachedStore) return cachedStore;
  try {
    if (fs.existsSync(storePath)) {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as Partial<PersistedConnectStore>;
      cachedStore = {
        connections: Array.isArray(parsed.connections) ? parsed.connections : [],
        usageLogs: Array.isArray(parsed.usageLogs) ? parsed.usageLogs : [],
      };
      return cachedStore;
    }
  } catch {
    // ignore corrupt disk read
  }
  cachedStore = { connections: [], usageLogs: [] };
  return cachedStore;
}

async function persistConnectStore(): Promise<void> {
  const store = loadConnectStore();
  const snapshot = JSON.stringify(store, null, 2);
  writeChain = writeChain.then(async () => {
    try {
      await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
      await fs.promises.writeFile(storePath, snapshot, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // keep in memory if disk unavailable
    }
  });
  await writeChain;
}

export function getDateMonthKeys(timezone = 'America/Argentina/Buenos_Aires'): { dateKey: string; monthKey: string } {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateKey = fmt.format(now);
  return { dateKey, monthKey: dateKey.slice(0, 7) };
}

function toSafeDTO(conn: PersonalConnectionRecord, logs: PersonalUsageLogRecord[]): SafePersonalConnectionDTO {
  const { dateKey, monthKey } = getDateMonthKeys();
  const connLogs = logs.filter((l) => l.connectionId === conn.id && l.uid === conn.uid && l.status === 'success');
  const usedToday = connLogs.filter((l) => l.dateKey === dateKey).length;
  const monthLogs = connLogs.filter((l) => l.monthKey === monthKey);
  const tokensThisMonth = monthLogs.reduce((acc, l) => acc + l.inputTokens + l.outputTokens, 0);
  const estimatedPersonalUsdThisMonth = Number(
    monthLogs.reduce((acc, l) => acc + (l.estimatedCostUsd || 0), 0).toFixed(4)
  );

  return {
    id: conn.id,
    uid: conn.uid,
    providerId: conn.providerId,
    providerName: conn.providerName,
    label: conn.label,
    authMethod: conn.authMethod,
    status: conn.status,
    lastTestStatus: conn.lastTestStatus,
    lastTestedAt: conn.lastTestedAt,
    lastError: conn.lastError,
    endpointUrl: conn.endpointUrl,
    regionId: conn.regionId,
    selectedModel: conn.selectedModel,
    maskedKey: conn.maskedKey,
    oauthAccountEmail: conn.oauthAccountEmail,
    oauthPlanScope: conn.oauthPlanScope,
    isDefault: conn.isDefault,
    dailyRequestLimit: conn.dailyRequestLimit,
    monthlyBudgetAlertUsd: conn.monthlyBudgetAlertUsd,
    usedToday,
    usedThisMonth: monthLogs.length,
    tokensThisMonth,
    estimatedPersonalUsdThisMonth,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
  };
}

export function listUserConnectionsDTO(uid: string): SafePersonalConnectionDTO[] {
  const store = loadConnectStore();
  return store.connections
    .filter((c) => c.uid === uid)
    .sort((a, b) => (a.isDefault === b.isDefault ? b.updatedAt.localeCompare(a.updatedAt) : a.isDefault ? -1 : 1))
    .map((c) => toSafeDTO(c, store.usageLogs));
}

export function getOwnedConnectionInternal(uid: string, connectionId: string): PersonalConnectionRecord | null {
  const store = loadConnectStore();
  const found = store.connections.find((c) => c.id === connectionId && c.uid === uid);
  return found || null;
}

export function getDefaultOwnedConnectionInternal(
  uid: string,
  providerId?: ConnectProviderId
): PersonalConnectionRecord | null {
  const store = loadConnectStore();
  const mine = store.connections.filter(
    (c) => c.uid === uid && c.status === 'connected' && c.lastTestStatus === 'verified'
  );
  if (providerId) {
    const matching = mine.filter((c) => c.providerId === providerId);
    return matching.find((c) => c.isDefault) || matching[0] || null;
  }
  return mine.find((c) => c.isDefault) || mine[0] || null;
}

export async function upsertPersonalConnection(input: {
  id?: string;
  uid: string;
  providerId: ConnectProviderId;
  providerName: string;
  label: string;
  authMethod: 'byok' | 'oauth_pkce';
  rawSecret: string;
  rawRefreshToken?: string;
  endpointUrl: string;
  regionId?: string;
  selectedModel: string;
  verified: boolean;
  errorMessage?: string;
  oauthAccountEmail?: string;
  oauthPlanScope?: 'identity_only' | 'plan_usage' | 'none';
  isDefault?: boolean;
  dailyRequestLimit?: number;
  monthlyBudgetAlertUsd?: number;
}): Promise<SafePersonalConnectionDTO> {
  const store = loadConnectStore();
  const now = new Date().toISOString();

  if (input.isDefault) {
    for (const c of store.connections) {
      if (c.uid === input.uid) c.isDefault = false;
    }
  }

  const existing = input.id
    ? store.connections.find((c) => c.id === input.id && c.uid === input.uid)
    : undefined;

  const encryptedSecret = input.rawSecret
    ? encryptSecret(input.rawSecret)
    : existing?.encryptedSecret || '';
  const maskedKey = input.rawSecret ? maskSecret(input.rawSecret) : existing?.maskedKey || 'Sin clave';

  if (existing) {
    existing.label = input.label || existing.label;
    existing.endpointUrl = input.endpointUrl || existing.endpointUrl;
    existing.regionId = input.regionId ?? existing.regionId;
    existing.selectedModel = input.selectedModel || existing.selectedModel;
    existing.encryptedSecret = encryptedSecret;
    existing.maskedKey = maskedKey;
    if (input.rawRefreshToken) {
      existing.encryptedRefreshToken = encryptSecret(input.rawRefreshToken);
    }
    existing.status = input.verified ? 'connected' : 'error';
    existing.lastTestStatus = input.verified ? 'verified' : 'failed';
    existing.lastTestedAt = now;
    existing.lastError = input.verified ? '' : input.errorMessage || '';
    if (typeof input.isDefault === 'boolean') existing.isDefault = input.isDefault;
    if (typeof input.dailyRequestLimit === 'number') {
      existing.dailyRequestLimit = Math.max(0, Math.min(5000, Math.round(input.dailyRequestLimit)));
    }
    if (typeof input.monthlyBudgetAlertUsd === 'number') {
      existing.monthlyBudgetAlertUsd = Math.max(0, Math.min(10000, Number(input.monthlyBudgetAlertUsd)));
    }
    existing.updatedAt = now;
    await persistConnectStore();
    return toSafeDTO(existing, store.usageLogs);
  }

  const shouldMakeDefault =
    Boolean(input.isDefault) ||
    !store.connections.some((c) => c.uid === input.uid && c.status === 'connected');

  const created: PersonalConnectionRecord = {
    id: `pconn_${crypto.randomBytes(8).toString('hex')}`,
    uid: input.uid,
    providerId: input.providerId,
    providerName: input.providerName,
    label: input.label.trim() || `${input.providerName} personal`,
    authMethod: input.authMethod,
    status: input.verified ? 'connected' : 'error',
    lastTestStatus: input.verified ? 'verified' : 'failed',
    lastTestedAt: now,
    lastError: input.verified ? '' : input.errorMessage || '',
    endpointUrl: input.endpointUrl,
    regionId: input.regionId,
    selectedModel: input.selectedModel,
    maskedKey,
    encryptedSecret,
    ...(input.rawRefreshToken ? { encryptedRefreshToken: encryptSecret(input.rawRefreshToken) } : {}),
    ...(input.oauthAccountEmail ? { oauthAccountEmail: input.oauthAccountEmail } : {}),
    ...(input.oauthPlanScope ? { oauthPlanScope: input.oauthPlanScope } : {}),
    isDefault: shouldMakeDefault,
    dailyRequestLimit: Math.max(0, Math.min(5000, Math.round(input.dailyRequestLimit || 0))),
    monthlyBudgetAlertUsd: Math.max(0, Math.min(10000, Number(input.monthlyBudgetAlertUsd || 0))),
    createdAt: now,
    updatedAt: now,
  };

  store.connections.push(created);
  await persistConnectStore();
  return toSafeDTO(created, store.usageLogs);
}

export async function updateOwnedConnectionMeta(
  uid: string,
  connectionId: string,
  patch: {
    label?: string;
    selectedModel?: string;
    endpointUrl?: string;
    regionId?: string;
    isDefault?: boolean;
    dailyRequestLimit?: number;
    monthlyBudgetAlertUsd?: number;
    status?: 'connected' | 'disconnected' | 'error';
    lastTestStatus?: 'verified' | 'failed' | 'untested';
    lastTestedAt?: string;
    lastError?: string;
  }
): Promise<SafePersonalConnectionDTO | null> {
  const store = loadConnectStore();
  const target = store.connections.find((c) => c.id === connectionId && c.uid === uid);
  if (!target) return null;

  if (patch.isDefault) {
    for (const c of store.connections) {
      if (c.uid === uid) c.isDefault = false;
    }
    target.isDefault = true;
  } else if (patch.isDefault === false) {
    target.isDefault = false;
  }

  if (typeof patch.label === 'string' && patch.label.trim()) target.label = patch.label.trim().slice(0, 80);
  if (typeof patch.selectedModel === 'string' && patch.selectedModel.trim()) {
    target.selectedModel = patch.selectedModel.trim().slice(0, 120);
  }
  if (typeof patch.endpointUrl === 'string' && patch.endpointUrl.trim()) {
    target.endpointUrl = patch.endpointUrl.trim().slice(0, 300);
  }
  if (typeof patch.regionId === 'string') target.regionId = patch.regionId.slice(0, 60);
  if (typeof patch.dailyRequestLimit === 'number') {
    target.dailyRequestLimit = Math.max(0, Math.min(5000, Math.round(patch.dailyRequestLimit)));
  }
  if (typeof patch.monthlyBudgetAlertUsd === 'number') {
    target.monthlyBudgetAlertUsd = Math.max(0, Math.min(10000, Number(patch.monthlyBudgetAlertUsd)));
  }
  if (patch.status) target.status = patch.status;
  if (patch.lastTestStatus) target.lastTestStatus = patch.lastTestStatus;
  if (patch.lastTestedAt) target.lastTestedAt = patch.lastTestedAt;
  if (typeof patch.lastError === 'string') target.lastError = patch.lastError;
  target.updatedAt = new Date().toISOString();

  await persistConnectStore();
  return toSafeDTO(target, store.usageLogs);
}

export async function disconnectOwnedConnection(uid: string, connectionId: string): Promise<SafePersonalConnectionDTO | null> {
  const store = loadConnectStore();
  const target = store.connections.find((c) => c.id === connectionId && c.uid === uid);
  if (!target) return null;
  target.status = 'disconnected';
  target.isDefault = false;
  target.updatedAt = new Date().toISOString();
  await persistConnectStore();
  return toSafeDTO(target, store.usageLogs);
}

export async function deleteOwnedConnection(uid: string, connectionId: string): Promise<boolean> {
  const store = loadConnectStore();
  const before = store.connections.length;
  store.connections = store.connections.filter((c) => !(c.id === connectionId && c.uid === uid));
  if (store.connections.length === before) return false;
  await persistConnectStore();
  return true;
}

export function checkPersonalConnectionLimit(uid: string, connection: PersonalConnectionRecord): {
  allowed: boolean;
  usedToday: number;
  dailyLimit: number;
  message?: string;
} {
  if (!connection.dailyRequestLimit || connection.dailyRequestLimit <= 0) {
    return { allowed: true, usedToday: 0, dailyLimit: 0 };
  }
  const store = loadConnectStore();
  const { dateKey } = getDateMonthKeys();
  const usedToday = store.usageLogs.filter(
    (l) =>
      l.uid === uid &&
      l.connectionId === connection.id &&
      l.dateKey === dateKey &&
      l.status === 'success'
  ).length;

  if (usedToday >= connection.dailyRequestLimit) {
    return {
      allowed: false,
      usedToday,
      dailyLimit: connection.dailyRequestLimit,
      message: `Alcanzaste tu límite personal configurado (${usedToday}/${connection.dailyRequestLimit}) para "${connection.label}". Podés ampliarlo en Mis Conexiones.`,
    };
  }
  return { allowed: true, usedToday, dailyLimit: connection.dailyRequestLimit };
}

export async function recordPersonalUsage(entry: Omit<PersonalUsageLogRecord, 'id' | 'timestamp' | 'dateKey' | 'monthKey' | 'billingOwner'>): Promise<PersonalUsageLogRecord> {
  const store = loadConnectStore();
  const { dateKey, monthKey } = getDateMonthKeys();
  const record: PersonalUsageLogRecord = {
    ...entry,
    id: `pusg_${crypto.randomBytes(8).toString('hex')}`,
    billingOwner: 'personal',
    timestamp: new Date().toISOString(),
    dateKey,
    monthKey,
  };
  store.usageLogs.unshift(record);
  if (store.usageLogs.length > 2500) {
    store.usageLogs = store.usageLogs.slice(0, 2500);
  }
  await persistConnectStore();
  return record;
}

export function getUserPersonalUsageSummary(uid: string): {
  monthKey: string;
  dateKey: string;
  queriesToday: number;
  queriesThisMonth: number;
  tokensInThisMonth: number;
  tokensOutThisMonth: number;
  estimatedPersonalUsdThisMonth: number;
  recentLogs: PersonalUsageLogRecord[];
} {
  const store = loadConnectStore();
  const { dateKey, monthKey } = getDateMonthKeys();
  const mine = store.usageLogs.filter((l) => l.uid === uid);
  const todayLogs = mine.filter((l) => l.dateKey === dateKey && l.status === 'success');
  const monthLogs = mine.filter((l) => l.monthKey === monthKey && l.status === 'success');
  return {
    monthKey,
    dateKey,
    queriesToday: todayLogs.length,
    queriesThisMonth: monthLogs.length,
    tokensInThisMonth: monthLogs.reduce((acc, l) => acc + l.inputTokens, 0),
    tokensOutThisMonth: monthLogs.reduce((acc, l) => acc + l.outputTokens, 0),
    estimatedPersonalUsdThisMonth: Number(
      monthLogs.reduce((acc, l) => acc + (l.estimatedCostUsd || 0), 0).toFixed(4)
    ),
    recentLogs: mine.slice(0, 40),
  };
}

// ---------------------------------------------------------------------------
// OAuth PKCE Helpers
// ---------------------------------------------------------------------------
export function createOAuthPkceSession(uid: string, redirectUri: string): {
  state: string;
  codeChallenge: string;
} {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const state = crypto.randomBytes(24).toString('base64url');

  // Evict expired sessions (>15 mins)
  const cutoff = Date.now() - 15 * 60_000;
  for (const [k, v] of oauthSessions.entries()) {
    if (v.createdAtMs < cutoff) oauthSessions.delete(k);
  }

  oauthSessions.set(state, {
    state,
    uid,
    providerId: 'openai',
    codeVerifier,
    redirectUri,
    createdAtMs: Date.now(),
  });
  return { state, codeChallenge };
}

export function consumeOAuthPkceSession(state: string): OAuthPkceSession | null {
  const sess = oauthSessions.get(state) || null;
  if (sess) oauthSessions.delete(state);
  if (!sess || Date.now() - sess.createdAtMs > 15 * 60_000) return null;
  return sess;
}

export function resetConnectStoreForTests(customPath?: string) {
  if (customPath) {
    storePath = customPath;
  }
  cachedStore = { connections: [], usageLogs: [] };
  oauthSessions.clear();
}
