import fs from 'fs';
import path from 'path';
import { registerAdminResolver, SUPERADMIN_EMAIL } from './authMiddleware.ts';

export type PlanTier = 'free' | 'premium';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType =
  | 'budget_50'
  | 'budget_75'
  | 'budget_90'
  | 'budget_100'
  | 'provider_error'
  | 'rate_limit';

export interface SystemLimitsRecord {
  freeDailyLimit: number;
  premiumDailyLimit: number;
  resetTimezone: string;
  monthlyBudgetUsd: number;
  warn50Percent: number;
  alert75Percent: number;
  restrictPaid90Percent: number;
  blockPaid100Percent: number;
  freeMaxInputChars: number;
  freeMaxOutputTokens: number;
  premiumMaxInputChars: number;
  premiumMaxOutputTokens: number;
  antiSpamPerMinute: number;
  allowPaidModelsOnFree: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface RegisteredUserRecord {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  educationLevel?: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface SubscriptionRecord {
  uid: string;
  planTier: PlanTier;
  status: SubscriptionStatus;
  assignedBy: string;
  updatedAt: string;
  expiresAt?: string;
  note?: string;
}

export interface DailyUsageRecord {
  uid: string;
  dateKey: string;
  timezone: string;
  queriesUsed: number;
  creditsUsed: number;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  lastQueryAt: string;
}

export interface UserCreditRecord {
  uid: string;
  balance: number;
  grantedTotal: number;
  usedTotal: number;
  updatedAt: string;
  lastNote?: string;
}

export interface AIRequestLogRecord {
  id: string;
  uid: string;
  userEmail: string;
  planTier: PlanTier;
  endpoint: string;
  operationType: string;
  providerId: string;
  modelId: string;
  tierUsed: 'free' | 'paid';
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  actualBillingUsd?: number;
  status: 'success' | 'error' | 'blocked';
  errorMessage?: string;
  fallbackUsed: boolean;
  latencyMs: number;
  timestamp: string;
  dateKey: string;
  monthKey: string;
}

export interface ProviderModelBreakdown {
  queries: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  errors: number;
}

export interface MonthlyCostRecord {
  monthKey: string;
  totalUsd: number;
  freeQueries: number;
  paidQueries: number;
  tokensIn: number;
  tokensOut: number;
  triggeredThresholds: number[];
  byProvider: Record<string, ProviderModelBreakdown>;
  byModel: Record<string, ProviderModelBreakdown>;
  updatedAt: string;
}

export interface DailyCostRecord {
  dateKey: string;
  queries: number;
  freeQueries: number;
  paidQueries: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

export interface AdminAlertRecord {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  thresholdPercent?: number;
  monthKey?: string;
  providerId?: string;
  title: string;
  message: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface BudgetStatusSnapshot {
  monthKey: string;
  monthlyBudgetUsd: number;
  monthCostUsd: number;
  percentUsed: number;
  paidRestricted: boolean;
  paidBlocked: boolean;
  activeThreshold: 0 | 50 | 75 | 90 | 100;
  statusLabel: string;
}

export interface FreemiumUserStatus {
  uid: string;
  email: string;
  displayName: string;
  planTier: PlanTier;
  planLabel: 'GRATIS' | 'PREMIUM';
  subscription: SubscriptionRecord;
  dateKey: string;
  timezone: string;
  usedToday: number;
  dailyLimit: number;
  remainingToday: number;
  extraCredits: number;
  totalAvailableToday: number;
  nextResetAt: string;
  nextResetFormatted: string;
  maxInputChars: number;
  maxOutputTokens: number;
  allowPaidModels: boolean;
  budgetStatus: BudgetStatusSnapshot;
  recentRequests: AIRequestLogRecord[];
}

export interface PersistedFreemiumStore {
  systemLimits: SystemLimitsRecord;
  users: Record<string, RegisteredUserRecord>;
  adminEmails: Record<string, 'administrador' | 'moderador'>;
  subscriptions: Record<string, SubscriptionRecord>;
  dailyUsage: Record<string, DailyUsageRecord>;
  userCredits: Record<string, UserCreditRecord>;
  aiRequests: AIRequestLogRecord[];
  monthlyCosts: Record<string, MonthlyCostRecord>;
  dailyCosts: Record<string, DailyCostRecord>;
  adminAlerts: AdminAlertRecord[];
  providerSettings: Record<string, { enabled: boolean; defaultModelId?: string }>;
}

export const FREE_QUOTA_EXHAUSTED_MESSAGE =
  'Alcanzaste el límite diario de consultas gratuitas. Podés continuar mañana o conocer FABRO PREMIUM';

export const PREMIUM_QUOTA_EXHAUSTED_MESSAGE =
  'Alcanzaste el límite diario de consultas de FABRO PREMIUM por hoy. Podés usar créditos adicionales o esperar al próximo reinicio.';

export const PAID_BUDGET_BLOCKED_MESSAGE =
  'Se alcanzó el límite del presupuesto mensual para modelos pagos. La operación continúa protegida y podés utilizar los modelos gratuitos disponibles.';

export class FreemiumQuotaError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 429, code = 'QUOTA_EXHAUSTED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const DEFAULT_SYSTEM_LIMITS: SystemLimitsRecord = {
  freeDailyLimit: 5,
  premiumDailyLimit: 50,
  resetTimezone: 'America/Argentina/Buenos_Aires',
  monthlyBudgetUsd: 30,
  warn50Percent: 50,
  alert75Percent: 75,
  restrictPaid90Percent: 90,
  blockPaid100Percent: 100,
  freeMaxInputChars: 12000,
  freeMaxOutputTokens: 2048,
  premiumMaxInputChars: 60000,
  premiumMaxOutputTokens: 8192,
  antiSpamPerMinute: 12,
  allowPaidModelsOnFree: false,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

let storeFilePath = path.join(process.cwd(), 'server', 'data', 'freemium-store.json');
let inMemoryStore: PersistedFreemiumStore | null = null;
let diskWriteChain: Promise<void> = Promise.resolve();
const userLocks = new Map<string, Promise<unknown>>();

function createEmptyStore(): PersistedFreemiumStore {
  return {
    systemLimits: { ...DEFAULT_SYSTEM_LIMITS },
    users: {},
    adminEmails: {},
    subscriptions: {},
    dailyUsage: {},
    userCredits: {},
    aiRequests: [],
    monthlyCosts: {},
    dailyCosts: {},
    adminAlerts: [],
    providerSettings: {},
  };
}

function loadStore(): PersistedFreemiumStore {
  if (inMemoryStore) return inMemoryStore;
  try {
    if (fs.existsSync(storeFilePath)) {
      const raw = fs.readFileSync(storeFilePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedFreemiumStore>;
      inMemoryStore = {
        ...createEmptyStore(),
        ...parsed,
        systemLimits: {
          ...DEFAULT_SYSTEM_LIMITS,
          ...(parsed.systemLimits || {}),
        },
      };
      return inMemoryStore;
    }
  } catch {
    // Fallback to clean store if corrupted
  }
  inMemoryStore = createEmptyStore();
  return inMemoryStore;
}

function schedulePersist() {
  const snapshot = JSON.stringify(loadStore(), null, 2);
  const targetPath = storeFilePath;
  diskWriteChain = diskWriteChain
    .then(async () => {
      const dir = path.dirname(targetPath);
      await fs.promises.mkdir(dir, { recursive: true });
      const tmp = `${targetPath}.${process.pid}.tmp`;
      await fs.promises.writeFile(tmp, snapshot, 'utf8');
      await fs.promises.rename(tmp, targetPath);
    })
    .catch(() => {
      // keep running safely even if disk write briefly fails
    });
}

export async function flushFreemiumStoreForTests() {
  await diskWriteChain;
}

export function setFreemiumStorePathForTests(customPath: string) {
  storeFilePath = customPath;
  inMemoryStore = null;
  if (fs.existsSync(customPath)) {
    try {
      fs.unlinkSync(customPath);
    } catch {
      // ignore
    }
  }
}

export function resetFreemiumStoreInMemory() {
  inMemoryStore = createEmptyStore();
  schedulePersist();
}

// Per-user sequential async mutex preventing parallel quota race conditions
export async function withUserLock<T>(uid: string, task: () => Promise<T>): Promise<T> {
  const prev = userLocks.get(uid) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  const chained = prev.then(() => gate);
  userLocks.set(uid, chained);
  await prev;
  try {
    return await task();
  } finally {
    release();
    if (userLocks.get(uid) === chained) {
      userLocks.delete(uid);
    }
  }
}

registerAdminResolver((_uid, email) => {
  const store = loadStore();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail === SUPERADMIN_EMAIL) return true;
  return store.adminEmails[cleanEmail] === 'administrador';
});

export function setDelegatedAdminRole(email: string, role: 'administrador' | 'moderador' | null) {
  const store = loadStore();
  const clean = email.trim().toLowerCase();
  if (!clean || clean === SUPERADMIN_EMAIL) return;
  if (!role) {
    delete store.adminEmails[clean];
  } else {
    store.adminEmails[clean] = role;
  }
  schedulePersist();
}

// Timezone-aware date & next-reset calculations
export function getDateKeysInTimezone(
  timezone: string,
  referenceDate = new Date()
): { dateKey: string; monthKey: string; nextResetAt: string; nextResetFormatted: string } {
  const safeTz = (() => {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(referenceDate);
      return timezone;
    } catch {
      return 'America/Argentina/Buenos_Aires';
    }
  })();

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(referenceDate);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const dateKey = `${map.year}-${map.month}-${map.day}`;
  const monthKey = `${map.year}-${map.month}`;

  // Calculate remaining seconds until local midnight cleanly
  const hour = Number(map.hour || '0') % 24;
  const minute = Number(map.minute || '0');
  const second = Number(map.second || '0');
  const elapsedSecToday = hour * 3600 + minute * 60 + second;
  const remainingSec = Math.max(1, 86400 - elapsedSecToday);
  const resetDate = new Date(referenceDate.getTime() + remainingSec * 1000);

  const nextResetFormatted = new Intl.DateTimeFormat('es-AR', {
    timeZone: safeTz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(resetDate);

  return {
    dateKey,
    monthKey,
    nextResetAt: resetDate.toISOString(),
    nextResetFormatted: `${nextResetFormatted} (${safeTz.split('/').pop()?.replace(/_/g, ' ') || safeTz})`,
  };
}

function getUsageKey(uid: string, dateKey: string): string {
  return `${uid}__${dateKey}`;
}

function ensureMonthlyCost(store: PersistedFreemiumStore, monthKey: string): MonthlyCostRecord {
  if (!store.monthlyCosts[monthKey]) {
    store.monthlyCosts[monthKey] = {
      monthKey,
      totalUsd: 0,
      freeQueries: 0,
      paidQueries: 0,
      tokensIn: 0,
      tokensOut: 0,
      triggeredThresholds: [],
      byProvider: {},
      byModel: {},
      updatedAt: new Date().toISOString(),
    };
  }
  return store.monthlyCosts[monthKey];
}

function ensureDailyCost(store: PersistedFreemiumStore, dateKey: string): DailyCostRecord {
  if (!store.dailyCosts[dateKey]) {
    store.dailyCosts[dateKey] = {
      dateKey,
      queries: 0,
      freeQueries: 0,
      paidQueries: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    };
  }
  return store.dailyCosts[dateKey];
}

function pushAdminAlert(
  store: PersistedFreemiumStore,
  alert: Omit<AdminAlertRecord, 'id' | 'acknowledged' | 'createdAt'>
) {
  const entry: AdminAlertRecord = {
    ...alert,
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    acknowledged: false,
    createdAt: new Date().toISOString(),
  };
  store.adminAlerts.unshift(entry);
  if (store.adminAlerts.length > 250) {
    store.adminAlerts = store.adminAlerts.slice(0, 250);
  }
}

export function evaluateBudgetThresholds(store: PersistedFreemiumStore, monthKey: string): BudgetStatusSnapshot {
  const limits = store.systemLimits;
  const monthly = ensureMonthlyCost(store, monthKey);
  const budget = Math.max(0.01, Number(limits.monthlyBudgetUsd) || 30);
  const percentUsed = Math.round(((monthly.totalUsd / budget) * 100) * 100) / 100;

  const checkAndTrigger = (
    pctThreshold: number,
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string
  ) => {
    if (percentUsed >= pctThreshold && !monthly.triggeredThresholds.includes(pctThreshold)) {
      monthly.triggeredThresholds.push(pctThreshold);
      pushAdminAlert(store, {
        severity,
        type,
        thresholdPercent: pctThreshold,
        monthKey,
        title,
        message,
      });
    }
  };

  checkAndTrigger(
    limits.warn50Percent,
    'budget_50',
    'info',
    `Presupuesto mensual al ${limits.warn50Percent}% (${monthKey})`,
    `El gasto acumulado de IA alcanzó $${monthly.totalUsd.toFixed(2)} USD sobre un presupuesto de $${budget.toFixed(2)} USD.`
  );
  checkAndTrigger(
    limits.alert75Percent,
    'budget_75',
    'warning',
    `Alerta de consumo al ${limits.alert75Percent}% (${monthKey})`,
    `El gasto mensual alcanzó $${monthly.totalUsd.toFixed(2)} USD (${percentUsed.toFixed(1)}%). Revisá modelos pagos activos.`
  );
  checkAndTrigger(
    limits.restrictPaid90Percent,
    'budget_90',
    'warning',
    `Restricción automática de modelos pagos (${limits.restrictPaid90Percent}%)`,
    `Se superó el ${limits.restrictPaid90Percent}% del presupuesto mensual ($${monthly.totalUsd.toFixed(2)}/$${budget.toFixed(2)} USD). FABRO prioriza modelos gratuitos.`
  );
  checkAndTrigger(
    limits.blockPaid100Percent,
    'budget_100',
    'critical',
    `Presupuesto mensual agotado (${limits.blockPaid100Percent}%)`,
    `Se alcanzó el tope de $${budget.toFixed(2)} USD. Todas las operaciones pagas quedaron bloqueadas automáticamente desde el servidor.`
  );

  const paidBlocked = percentUsed >= limits.blockPaid100Percent;
  const paidRestricted = percentUsed >= limits.restrictPaid90Percent;
  const activeThreshold: 0 | 50 | 75 | 90 | 100 = paidBlocked
    ? 100
    : paidRestricted
    ? 90
    : percentUsed >= limits.alert75Percent
    ? 75
    : percentUsed >= limits.warn50Percent
    ? 50
    : 0;

  const statusLabel = paidBlocked
    ? 'Bloqueado para modelos pagos (100%)'
    : paidRestricted
    ? 'Modelos pagos restringidos (90%+)'
    : percentUsed >= limits.alert75Percent
    ? 'Alerta de presupuesto (75%+)'
    : percentUsed >= limits.warn50Percent
    ? 'Advertencia preventiva (50%+)'
    : 'Consumo saludable';

  return {
    monthKey,
    monthlyBudgetUsd: budget,
    monthCostUsd: Number(monthly.totalUsd.toFixed(6)),
    percentUsed,
    paidRestricted,
    paidBlocked,
    activeThreshold,
    statusLabel,
  };
}

export function getBudgetStatusSnapshot(referenceDate = new Date()): BudgetStatusSnapshot {
  const store = loadStore();
  const { monthKey } = getDateKeysInTimezone(store.systemLimits.resetTimezone, referenceDate);
  return evaluateBudgetThresholds(store, monthKey);
}

export function syncRegisteredUser(params: {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  educationLevel?: string;
}) {
  const store = loadStore();
  const now = new Date().toISOString();
  const existing = store.users[params.uid];
  store.users[params.uid] = {
    uid: params.uid,
    email: params.email.trim().toLowerCase(),
    displayName: (params.displayName || existing?.displayName || params.email.split('@')[0] || 'Estudiante').slice(0, 120),
    photoURL: params.photoURL || existing?.photoURL,
    educationLevel: params.educationLevel || existing?.educationLevel || 'universitario',
    createdAt: existing?.createdAt || now,
    lastSeenAt: now,
  };
  if (!store.subscriptions[params.uid]) {
    store.subscriptions[params.uid] = {
      uid: params.uid,
      planTier: 'free',
      status: 'active',
      assignedBy: 'system',
      updatedAt: now,
    };
  }
  schedulePersist();
  return store.users[params.uid];
}

export function getUserSubscription(uid: string): SubscriptionRecord {
  const store = loadStore();
  const sub = store.subscriptions[uid];
  if (sub) {
    if (sub.planTier === 'premium' && sub.expiresAt && new Date(sub.expiresAt).getTime() <= Date.now()) {
      sub.planTier = 'free';
      sub.status = 'expired';
      sub.updatedAt = new Date().toISOString();
      schedulePersist();
    }
    return sub;
  }
  const fresh: SubscriptionRecord = {
    uid,
    planTier: 'free',
    status: 'active',
    assignedBy: 'system',
    updatedAt: new Date().toISOString(),
  };
  store.subscriptions[uid] = fresh;
  schedulePersist();
  return fresh;
}

export function getUserCredits(uid: string): UserCreditRecord {
  const store = loadStore();
  if (!store.userCredits[uid]) {
    store.userCredits[uid] = {
      uid,
      balance: 0,
      grantedTotal: 0,
      usedTotal: 0,
      updatedAt: new Date().toISOString(),
    };
  }
  return store.userCredits[uid];
}

export function getUserFreemiumStatus(
  uid: string,
  email = '',
  displayName = '',
  referenceDate = new Date()
): FreemiumUserStatus {
  const store = loadStore();
  if (email) {
    syncRegisteredUser({ uid, email, displayName });
  }
  const sub = getUserSubscription(uid);
  const credits = getUserCredits(uid);
  const limits = store.systemLimits;
  const { dateKey, monthKey, nextResetAt, nextResetFormatted } = getDateKeysInTimezone(
    limits.resetTimezone,
    referenceDate
  );

  const usageKey = getUsageKey(uid, dateKey);
  const usage = store.dailyUsage[usageKey] || {
    uid,
    dateKey,
    timezone: limits.resetTimezone,
    queriesUsed: 0,
    creditsUsed: 0,
    tokensIn: 0,
    tokensOut: 0,
    estimatedCostUsd: 0,
    lastQueryAt: '',
  };

  const planTier: PlanTier = sub.planTier === 'premium' && sub.status === 'active' ? 'premium' : 'free';
  const dailyLimit = planTier === 'premium' ? limits.premiumDailyLimit : limits.freeDailyLimit;
  const remainingToday = Math.max(0, dailyLimit - usage.queriesUsed);
  const budgetStatus = evaluateBudgetThresholds(store, monthKey);
  const userRec = store.users[uid];

  const recentRequests = store.aiRequests.filter((r) => r.uid === uid).slice(0, 20);

  return {
    uid,
    email: userRec?.email || email,
    displayName: userRec?.displayName || displayName || 'Estudiante',
    planTier,
    planLabel: planTier === 'premium' ? 'PREMIUM' : 'GRATIS',
    subscription: sub,
    dateKey,
    timezone: limits.resetTimezone,
    usedToday: usage.queriesUsed,
    dailyLimit,
    remainingToday,
    extraCredits: credits.balance,
    totalAvailableToday: remainingToday + credits.balance,
    nextResetAt,
    nextResetFormatted,
    maxInputChars: planTier === 'premium' ? limits.premiumMaxInputChars : limits.freeMaxInputChars,
    maxOutputTokens: planTier === 'premium' ? limits.premiumMaxOutputTokens : limits.freeMaxOutputTokens,
    allowPaidModels:
      (planTier === 'premium' || limits.allowPaidModelsOnFree) && !budgetStatus.paidBlocked,
    budgetStatus,
    recentRequests,
  };
}

export interface QuotaReservation {
  reservationId: string;
  uid: string;
  userEmail: string;
  planTier: PlanTier;
  dateKey: string;
  monthKey: string;
  usedExtraCredit: boolean;
  maxInputChars: number;
  maxOutputTokens: number;
  allowPaidModels: boolean;
  budgetStatus: BudgetStatusSnapshot;
  released: boolean;
  committed: boolean;
}

export async function reserveAiQuota(params: {
  uid: string;
  email: string;
  displayName?: string;
  endpoint: string;
  operationType?: string;
  requirePaidModel?: boolean;
  referenceDate?: Date;
}): Promise<QuotaReservation> {
  return withUserLock(params.uid, async () => {
    const store = loadStore();
    syncRegisteredUser({
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
    });

    const limits = store.systemLimits;
    const refDate = params.referenceDate || new Date();
    const { dateKey, monthKey } = getDateKeysInTimezone(limits.resetTimezone, refDate);
    const sub = getUserSubscription(params.uid);
    const planTier: PlanTier = sub.planTier === 'premium' && sub.status === 'active' ? 'premium' : 'free';
    const dailyLimit = planTier === 'premium' ? limits.premiumDailyLimit : limits.freeDailyLimit;

    const usageKey = getUsageKey(params.uid, dateKey);
    const usage: DailyUsageRecord = store.dailyUsage[usageKey] || {
      uid: params.uid,
      dateKey,
      timezone: limits.resetTimezone,
      queriesUsed: 0,
      creditsUsed: 0,
      tokensIn: 0,
      tokensOut: 0,
      estimatedCostUsd: 0,
      lastQueryAt: '',
    };

    const credits = getUserCredits(params.uid);
    let usedExtraCredit = false;

    if (usage.queriesUsed < dailyLimit) {
      usage.queriesUsed += 1;
      usage.lastQueryAt = refDate.toISOString();
      store.dailyUsage[usageKey] = usage;
    } else if (credits.balance > 0) {
      credits.balance -= 1;
      credits.usedTotal += 1;
      credits.updatedAt = refDate.toISOString();
      usage.creditsUsed += 1;
      usage.lastQueryAt = refDate.toISOString();
      store.dailyUsage[usageKey] = usage;
      usedExtraCredit = true;
    } else {
      const msg = planTier === 'free' ? FREE_QUOTA_EXHAUSTED_MESSAGE : PREMIUM_QUOTA_EXHAUSTED_MESSAGE;
      store.aiRequests.unshift({
        id: `req_blk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        uid: params.uid,
        userEmail: params.email,
        planTier,
        endpoint: params.endpoint,
        operationType: params.operationType || params.endpoint,
        providerId: 'router',
        modelId: 'blocked',
        tierUsed: 'free',
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        status: 'blocked',
        errorMessage: msg,
        fallbackUsed: false,
        latencyMs: 0,
        timestamp: refDate.toISOString(),
        dateKey,
        monthKey,
      });
      if (store.aiRequests.length > 1000) store.aiRequests = store.aiRequests.slice(0, 1000);
      schedulePersist();
      throw new FreemiumQuotaError(msg, 429, 'DAILY_LIMIT_REACHED');
    }

    const budgetStatus = evaluateBudgetThresholds(store, monthKey);
    const allowPaidModels =
      (planTier === 'premium' || limits.allowPaidModelsOnFree) &&
      !budgetStatus.paidBlocked &&
      !budgetStatus.paidRestricted;

    if (params.requirePaidModel && budgetStatus.paidBlocked) {
      // Refund before throwing since no request executed
      if (usedExtraCredit) {
        credits.balance += 1;
        credits.usedTotal = Math.max(0, credits.usedTotal - 1);
        usage.creditsUsed = Math.max(0, usage.creditsUsed - 1);
      } else {
        usage.queriesUsed = Math.max(0, usage.queriesUsed - 1);
      }
      schedulePersist();
      throw new FreemiumQuotaError(PAID_BUDGET_BLOCKED_MESSAGE, 429, 'MONTHLY_BUDGET_EXHAUSTED');
    }

    schedulePersist();

    return {
      reservationId: `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      uid: params.uid,
      userEmail: params.email,
      planTier,
      dateKey,
      monthKey,
      usedExtraCredit,
      maxInputChars: planTier === 'premium' ? limits.premiumMaxInputChars : limits.freeMaxInputChars,
      maxOutputTokens: planTier === 'premium' ? limits.premiumMaxOutputTokens : limits.freeMaxOutputTokens,
      allowPaidModels,
      budgetStatus,
      released: false,
      committed: false,
    };
  });
}

// Non-destructive rollback: internal provider errors NEVER consume the user's daily quota
export async function releaseAiQuotaReservation(
  reservation: QuotaReservation,
  reason: { endpoint: string; providerId?: string; modelId?: string; errorMessage: string; latencyMs?: number }
): Promise<void> {
  if (reservation.released || reservation.committed) return;
  reservation.released = true;

  await withUserLock(reservation.uid, async () => {
    const store = loadStore();
    const usageKey = getUsageKey(reservation.uid, reservation.dateKey);
    const usage = store.dailyUsage[usageKey];
    if (usage) {
      if (reservation.usedExtraCredit) {
        const credits = getUserCredits(reservation.uid);
        credits.balance += 1;
        credits.usedTotal = Math.max(0, credits.usedTotal - 1);
        usage.creditsUsed = Math.max(0, usage.creditsUsed - 1);
      } else {
        usage.queriesUsed = Math.max(0, usage.queriesUsed - 1);
      }
    }

    const pid = reason.providerId || 'router';
    const monthly = ensureMonthlyCost(store, reservation.monthKey);
    if (!monthly.byProvider[pid]) {
      monthly.byProvider[pid] = { queries: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, errors: 0 };
    }
    monthly.byProvider[pid].errors += 1;

    store.aiRequests.unshift({
      id: `req_err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uid: reservation.uid,
      userEmail: reservation.userEmail,
      planTier: reservation.planTier,
      endpoint: reason.endpoint,
      operationType: reason.endpoint,
      providerId: pid,
      modelId: reason.modelId || 'error',
      tierUsed: 'free',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      status: 'error',
      errorMessage: reason.errorMessage.slice(0, 300),
      fallbackUsed: false,
      latencyMs: reason.latencyMs || 0,
      timestamp: new Date().toISOString(),
      dateKey: reservation.dateKey,
      monthKey: reservation.monthKey,
    });
    if (store.aiRequests.length > 1000) store.aiRequests = store.aiRequests.slice(0, 1000);

    pushAdminAlert(store, {
      severity: 'warning',
      type: 'provider_error',
      providerId: pid,
      monthKey: reservation.monthKey,
      title: `Fallo interno del proveedor ${pid}`,
      message: `No se descontó consulta al usuario (${reservation.userEmail}): ${reason.errorMessage.slice(0, 220)}`,
    });

    schedulePersist();
  });
}

export async function commitAiUsage(
  reservation: QuotaReservation,
  usageData: {
    endpoint: string;
    operationType?: string;
    providerId: string;
    modelId: string;
    tierUsed: 'free' | 'paid';
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    actualBillingUsd?: number;
    fallbackUsed?: boolean;
    latencyMs?: number;
  }
): Promise<BudgetStatusSnapshot> {
  if (reservation.committed || reservation.released) {
    return getBudgetStatusSnapshot();
  }
  reservation.committed = true;

  return withUserLock(reservation.uid, async () => {
    const store = loadStore();
    const safeCost = Math.max(0, Number(usageData.actualBillingUsd ?? usageData.costUsd) || 0);
    const inTok = Math.max(0, Math.round(usageData.inputTokens || 0));
    const outTok = Math.max(0, Math.round(usageData.outputTokens || 0));

    const usageKey = getUsageKey(reservation.uid, reservation.dateKey);
    const daily = store.dailyUsage[usageKey];
    if (daily) {
      daily.tokensIn += inTok;
      daily.tokensOut += outTok;
      daily.estimatedCostUsd = Number((daily.estimatedCostUsd + safeCost).toFixed(6));
    }

    const monthly = ensureMonthlyCost(store, reservation.monthKey);
    monthly.totalUsd = Number((monthly.totalUsd + safeCost).toFixed(6));
    monthly.tokensIn += inTok;
    monthly.tokensOut += outTok;
    if (usageData.tierUsed === 'paid') monthly.paidQueries += 1;
    else monthly.freeQueries += 1;
    monthly.updatedAt = new Date().toISOString();

    if (!monthly.byProvider[usageData.providerId]) {
      monthly.byProvider[usageData.providerId] = { queries: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, errors: 0 };
    }
    const pStats = monthly.byProvider[usageData.providerId];
    pStats.queries += 1;
    pStats.tokensIn += inTok;
    pStats.tokensOut += outTok;
    pStats.costUsd = Number((pStats.costUsd + safeCost).toFixed(6));

    if (!monthly.byModel[usageData.modelId]) {
      monthly.byModel[usageData.modelId] = { queries: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, errors: 0 };
    }
    const mStats = monthly.byModel[usageData.modelId];
    mStats.queries += 1;
    mStats.tokensIn += inTok;
    mStats.tokensOut += outTok;
    mStats.costUsd = Number((mStats.costUsd + safeCost).toFixed(6));

    const dayCost = ensureDailyCost(store, reservation.dateKey);
    dayCost.queries += 1;
    if (usageData.tierUsed === 'paid') dayCost.paidQueries += 1;
    else dayCost.freeQueries += 1;
    dayCost.tokensIn += inTok;
    dayCost.tokensOut += outTok;
    dayCost.costUsd = Number((dayCost.costUsd + safeCost).toFixed(6));

    store.aiRequests.unshift({
      id: `req_ok_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      uid: reservation.uid,
      userEmail: reservation.userEmail,
      planTier: reservation.planTier,
      endpoint: usageData.endpoint,
      operationType: usageData.operationType || usageData.endpoint,
      providerId: usageData.providerId,
      modelId: usageData.modelId,
      tierUsed: usageData.tierUsed,
      inputTokens: inTok,
      outputTokens: outTok,
      costUsd: safeCost,
      actualBillingUsd: usageData.actualBillingUsd,
      status: 'success',
      fallbackUsed: Boolean(usageData.fallbackUsed),
      latencyMs: usageData.latencyMs || 0,
      timestamp: new Date().toISOString(),
      dateKey: reservation.dateKey,
      monthKey: reservation.monthKey,
    });
    if (store.aiRequests.length > 1000) store.aiRequests = store.aiRequests.slice(0, 1000);

    const budgetStatus = evaluateBudgetThresholds(store, reservation.monthKey);
    schedulePersist();
    return budgetStatus;
  });
}

// Administrative operations
export function updateSystemLimitsAdmin(
  patch: Partial<SystemLimitsRecord>,
  adminEmail: string
): SystemLimitsRecord {
  const store = loadStore();
  const prev = store.systemLimits;
  const next: SystemLimitsRecord = {
    ...prev,
    ...(typeof patch.freeDailyLimit === 'number' ? { freeDailyLimit: Math.max(0, Math.min(500, Math.round(patch.freeDailyLimit))) } : {}),
    ...(typeof patch.premiumDailyLimit === 'number' ? { premiumDailyLimit: Math.max(1, Math.min(2000, Math.round(patch.premiumDailyLimit))) } : {}),
    ...(typeof patch.resetTimezone === 'string' && patch.resetTimezone.trim() ? { resetTimezone: patch.resetTimezone.trim() } : {}),
    ...(typeof patch.monthlyBudgetUsd === 'number' ? { monthlyBudgetUsd: Math.max(0.5, Number(patch.monthlyBudgetUsd)) } : {}),
    ...(typeof patch.warn50Percent === 'number' ? { warn50Percent: Math.max(1, Math.min(99, Number(patch.warn50Percent))) } : {}),
    ...(typeof patch.alert75Percent === 'number' ? { alert75Percent: Math.max(1, Math.min(99, Number(patch.alert75Percent))) } : {}),
    ...(typeof patch.restrictPaid90Percent === 'number' ? { restrictPaid90Percent: Math.max(1, Math.min(100, Number(patch.restrictPaid90Percent))) } : {}),
    ...(typeof patch.blockPaid100Percent === 'number' ? { blockPaid100Percent: Math.max(1, Math.min(100, Number(patch.blockPaid100Percent))) } : {}),
    ...(typeof patch.freeMaxInputChars === 'number' ? { freeMaxInputChars: Math.max(1000, Math.min(120000, Math.round(patch.freeMaxInputChars))) } : {}),
    ...(typeof patch.freeMaxOutputTokens === 'number' ? { freeMaxOutputTokens: Math.max(256, Math.min(16384, Math.round(patch.freeMaxOutputTokens))) } : {}),
    ...(typeof patch.premiumMaxInputChars === 'number' ? { premiumMaxInputChars: Math.max(2000, Math.min(250000, Math.round(patch.premiumMaxInputChars))) } : {}),
    ...(typeof patch.premiumMaxOutputTokens === 'number' ? { premiumMaxOutputTokens: Math.max(512, Math.min(32768, Math.round(patch.premiumMaxOutputTokens))) } : {}),
    ...(typeof patch.antiSpamPerMinute === 'number' ? { antiSpamPerMinute: Math.max(2, Math.min(120, Math.round(patch.antiSpamPerMinute))) } : {}),
    ...(typeof patch.allowPaidModelsOnFree === 'boolean' ? { allowPaidModelsOnFree: patch.allowPaidModelsOnFree } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail,
  };
  store.systemLimits = next;
  const { monthKey } = getDateKeysInTimezone(next.resetTimezone);
  evaluateBudgetThresholds(store, monthKey);
  schedulePersist();
  return next;
}

export function getSystemLimitsSnapshot(): SystemLimitsRecord {
  return { ...loadStore().systemLimits };
}

export function setUserPlanAdmin(params: {
  uid: string;
  planTier: PlanTier;
  status?: SubscriptionStatus;
  expiresAt?: string;
  note?: string;
  adminEmail: string;
}): SubscriptionRecord {
  const store = loadStore();
  const next: SubscriptionRecord = {
    uid: params.uid,
    planTier: params.planTier,
    status: params.status || 'active',
    assignedBy: params.adminEmail,
    updatedAt: new Date().toISOString(),
    ...(params.expiresAt ? { expiresAt: params.expiresAt } : {}),
    ...(params.note ? { note: params.note } : {}),
  };
  store.subscriptions[params.uid] = next;
  schedulePersist();
  return next;
}

export function grantUserCreditsAdmin(params: {
  uid: string;
  delta: number;
  note?: string;
}): UserCreditRecord {
  const store = loadStore();
  const current = getUserCredits(params.uid);
  const cleanDelta = Math.round(params.delta);
  current.balance = Math.max(0, current.balance + cleanDelta);
  if (cleanDelta > 0) {
    current.grantedTotal += cleanDelta;
  }
  current.updatedAt = new Date().toISOString();
  if (params.note) current.lastNote = params.note;
  store.userCredits[params.uid] = current;
  schedulePersist();
  return { ...current };
}

export function acknowledgeAdminAlert(alertId: string) {
  const store = loadStore();
  const target = store.adminAlerts.find((a) => a.id === alertId);
  if (target) {
    target.acknowledged = true;
    schedulePersist();
  }
}

export function recordDirectSpendForTests(amountUsd: number, providerId = 'openai', modelId = 'gpt-4o') {
  const store = loadStore();
  const { dateKey, monthKey } = getDateKeysInTimezone(store.systemLimits.resetTimezone);
  const monthly = ensureMonthlyCost(store, monthKey);
  monthly.totalUsd = Number((monthly.totalUsd + amountUsd).toFixed(6));
  monthly.paidQueries += 1;
  if (!monthly.byProvider[providerId]) {
    monthly.byProvider[providerId] = { queries: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, errors: 0 };
  }
  monthly.byProvider[providerId].queries += 1;
  monthly.byProvider[providerId].costUsd = Number((monthly.byProvider[providerId].costUsd + amountUsd).toFixed(6));
  if (!monthly.byModel[modelId]) {
    monthly.byModel[modelId] = { queries: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, errors: 0 };
  }
  monthly.byModel[modelId].queries += 1;
  monthly.byModel[modelId].costUsd = Number((monthly.byModel[modelId].costUsd + amountUsd).toFixed(6));
  const daily = ensureDailyCost(store, dateKey);
  daily.queries += 1;
  daily.paidQueries += 1;
  daily.costUsd = Number((daily.costUsd + amountUsd).toFixed(6));
  const status = evaluateBudgetThresholds(store, monthKey);
  schedulePersist();
  return status;
}

export function setProviderOverrideAdmin(providerId: string, enabled: boolean, defaultModelId?: string) {
  const store = loadStore();
  store.providerSettings[providerId] = {
    enabled,
    ...(defaultModelId ? { defaultModelId } : {}),
  };
  schedulePersist();
  return store.providerSettings;
}

export function getProviderOverridesSnapshot() {
  return { ...loadStore().providerSettings };
}

export function getAdminDashboardSnapshot() {
  const store = loadStore();
  const limits = store.systemLimits;
  const { dateKey, monthKey, nextResetFormatted } = getDateKeysInTimezone(limits.resetTimezone);
  const budgetStatus = evaluateBudgetThresholds(store, monthKey);
  const monthly = ensureMonthlyCost(store, monthKey);
  const todayCost = ensureDailyCost(store, dateKey);

  const usersList = Object.values(store.users).map((u) => {
    const sub = getUserSubscription(u.uid);
    const credits = getUserCredits(u.uid);
    const daily = store.dailyUsage[getUsageKey(u.uid, dateKey)];
    const planTier: PlanTier = sub.planTier === 'premium' && sub.status === 'active' ? 'premium' : 'free';
    const limit = planTier === 'premium' ? limits.premiumDailyLimit : limits.freeDailyLimit;
    const usedToday = daily?.queriesUsed || 0;
    return {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      planTier,
      subscriptionStatus: sub.status,
      usedToday,
      dailyLimit: limit,
      atLimit: usedToday >= limit && credits.balance === 0,
      extraCredits: credits.balance,
      tokensToday: (daily?.tokensIn || 0) + (daily?.tokensOut || 0),
      costTodayUsd: daily?.estimatedCostUsd || 0,
      lastSeenAt: u.lastSeenAt,
    };
  });

  const freeUsersCount = usersList.filter((u) => u.planTier === 'free').length;
  const premiumUsersCount = usersList.filter((u) => u.planTier === 'premium').length;
  const usersAtLimitCount = usersList.filter((u) => u.atLimit).length;

  const dailySeries = Object.values(store.dailyCosts)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .slice(-14);

  const monthlySeries = Object.values(store.monthlyCosts)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-12)
    .map((m) => ({
      monthKey: m.monthKey,
      queries: m.freeQueries + m.paidQueries,
      freeQueries: m.freeQueries,
      paidQueries: m.paidQueries,
      tokensIn: m.tokensIn,
      tokensOut: m.tokensOut,
      costUsd: m.totalUsd,
    }));

  return {
    generatedAt: new Date().toISOString(),
    nextResetFormatted,
    systemLimits: limits,
    budgetStatus,
    summary: {
      totalRegisteredUsers: usersList.length,
      freeUsersCount,
      premiumUsersCount,
      usersAtLimitCount,
      queriesToday: todayCost.queries,
      costTodayUsd: todayCost.costUsd,
      queriesThisMonth: monthly.freeQueries + monthly.paidQueries,
      freeQueriesThisMonth: monthly.freeQueries,
      paidQueriesThisMonth: monthly.paidQueries,
      tokensInThisMonth: monthly.tokensIn,
      tokensOutThisMonth: monthly.tokensOut,
      monthCostUsd: monthly.totalUsd,
      unacknowledgedAlerts: store.adminAlerts.filter((a) => !a.acknowledged).length,
    },
    byProvider: monthly.byProvider,
    byModel: monthly.byModel,
    dailySeries,
    monthlySeries,
    users: usersList.sort((a, b) => b.usedToday - a.usedToday),
    alerts: store.adminAlerts.slice(0, 50),
    recentRequests: store.aiRequests.slice(0, 80),
  };
}
