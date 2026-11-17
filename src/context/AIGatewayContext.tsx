import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { authFetch, type LiveQuotaSnapshot } from '../lib/apiClient';
import { db } from '../lib/firebase';
import { useFabro } from './FabroContext';
import { usePlatform } from './PlatformContext';
import type {
  AIAdminSettingsRecord,
  AIBudgetConfig,
  AIConversationRecord,
  AIMessageRecord,
  AIModelRecord,
  AIPlanPolicy,
  AIProviderId,
  AIProviderRecord,
  AIProviderStatusRecord,
  AIRequestRecord,
  AIRoutingMode,
  AIUsageRecord,
  ConnectProviderCatalogEntry,
  ConnectProviderId,
  FabroBillingSummary,
  FreemiumStatus,
  PersonalChatResponse,
  PersonalCompareResponse,
  PersonalConnectionDTO,
  PersonalUsageSummary,
} from '../types/fabro';

export interface GatewayRuntimeCatalog {
  providers: AIProviderRecord[];
  models: AIModelRecord[];
  defaultBudget: AIBudgetConfig;
  defaultSettings: AIAdminSettingsRecord;
}

export interface GatewayChatResponsePayload {
  text: string;
  providerId: AIProviderId;
  providerName: string;
  modelId: string;
  apiModelName: string;
  accessTier: AIProviderRecord['accessTier'];
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

export interface GatewayCompareEntry {
  modelId: string;
  providerId: AIProviderId;
  providerName: string;
  label: string;
  apiModelName: string;
  accessTier: AIProviderRecord['accessTier'];
  status: 'ok' | 'not_configured' | 'disabled' | 'error';
  text: string;
  error: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  officialUrl: string;
}

export interface GatewayComparePayload {
  prompt: string;
  results: GatewayCompareEntry[];
  synthesisMarkdown: string;
  agreements: string[];
  differences: string[];
  limitations: string[];
  totalEstimatedCostUsd: number;
}

export interface RuntimeUsageSummary {
  dateKey: string;
  monthKey: string;
  dailyGlobalUsd: number;
  monthlyGlobalUsd: number;
  dailyGlobalRequests: number;
  byUser: Record<string, { requests: number; tokens: number; usd: number }>;
  byProvider: Record<
    string,
    { requests: number; tokens: number; usd: number; freeRequests: number; paidRequests: number }
  >;
}

const FALLBACK_BUDGET: AIBudgetConfig = {
  id: 'global',
  dailyGlobalLimitUsd: 5,
  monthlyGlobalLimitUsd: 50,
  perUserDailyRequestLimit: 80,
  perUserDailyTokenLimit: 400000,
  alertThresholdPercent: 80,
  onBudgetExceeded: 'fallback_free',
  activePlanDefault: 'plan_educativo',
};

const FALLBACK_SETTINGS: AIAdminSettingsRecord = {
  id: 'global',
  defaultRoutingMode: 'automatica',
  allowAutomaticFallback: true,
  blockPaidModelsForFreePlan: true,
  minorStrictSafeRouting: true,
  enableStreaming: true,
  retentionDays: 180,
};

function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`.slice(0, 120);
}

function sortDescByTime<T extends { createdAt?: unknown; updatedAt?: unknown }>(list: T[]): T[] {
  const toMs = (val: unknown): number => {
    if (!val) return 0;
    if (typeof val === 'object' && val !== null && 'toMillis' in val) {
      return Number((val as { toMillis: () => number }).toMillis()) || 0;
    }
    if (typeof val === 'string') return Date.parse(val) || 0;
    return 0;
  };
  return [...list].sort((a, b) => {
    const tA = toMs(a.updatedAt) || toMs(a.createdAt);
    const tB = toMs(b.updatedAt) || toMs(b.createdAt);
    return tB - tA;
  });
}

interface AIGatewayContextValue {
  providers: AIProviderRecord[];
  models: AIModelRecord[];
  providerStatuses: Record<string, AIProviderStatusRecord>;
  budgetConfig: AIBudgetConfig;
  adminSettings: AIAdminSettingsRecord;
  effectivePlanPolicy: AIPlanPolicy;
  requestsHistory: AIRequestRecord[];
  usageRecords: AIUsageRecord[];
  runtimeUsage: RuntimeUsageSummary | null;
  conversations: AIConversationRecord[];
  messagesByConversation: Record<string, AIMessageRecord[]>;
  testingProviderId: string | null;
  freemiumStatus: FreemiumStatus | null;
  freemiumLoading: boolean;
  plansModalOpen: boolean;
  plansLimitMessage: string;
  openPlansModal: (limitMessage?: string) => void;
  closePlansModal: () => void;
  refreshFreemiumStatus: () => Promise<void>;
  refreshRuntimeCatalog: () => Promise<void>;
  seedDefaultGatewayConfig: () => Promise<void>;
  toggleProviderEnabled: (providerId: AIProviderId, enabled: boolean) => Promise<void>;
  updateProviderDefaultModel: (providerId: AIProviderId, modelId: string) => Promise<void>;
  toggleModelEnabled: (modelId: string, enabled: boolean) => Promise<void>;
  runProviderConnectionTest: (providerId: AIProviderId) => Promise<AIProviderStatusRecord | null>;
  saveBudgetConfig: (next: Partial<AIBudgetConfig>) => Promise<void>;
  saveAdminSettings: (next: Partial<AIAdminSettingsRecord>) => Promise<void>;
  ensureConversation: (params: {
    conversationId?: string | null;
    subjectId: string;
    title: string;
    routingMode: AIRoutingMode;
    preferredProviderId: AIProviderId | 'auto';
    preferredModelId: string;
  }) => Promise<string>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  toggleFavoriteConversation: (conversationId: string, favorite: boolean) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  recordGatewayTurn: (params: {
    conversationId: string;
    userPrompt: string;
    result: GatewayChatResponsePayload;
  }) => Promise<void>;
  toggleFavoriteMessage: (messageId: string, favorite: boolean) => Promise<void>;
  sendGatewayChat: (params: {
    prompt: string;
    systemInstruction?: string;
    history?: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
    routingMode: AIRoutingMode;
    requestedProviderId?: AIProviderId | 'auto';
    requestedModelId?: string;
    useWebSearch?: boolean;
    attachment?: { name?: string; mimeType: string; base64: string } | null;
  }) => Promise<GatewayChatResponsePayload>;
  sendGatewayChatStream: (params: {
    prompt: string;
    systemInstruction?: string;
    history?: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
    routingMode: AIRoutingMode;
    requestedProviderId?: AIProviderId | 'auto';
    requestedModelId?: string;
    useWebSearch?: boolean;
    attachment?: { name?: string; mimeType: string; base64: string } | null;
    onChunk: (delta: string) => void;
  }) => Promise<GatewayChatResponsePayload>;
  runGatewayCompare: (params: {
    prompt: string;
    modelIds: string[];
    mode: 'interpretativo' | 'sencillo';
    subjectName?: string;
  }) => Promise<GatewayComparePayload>;
  // FABRO CONNECT — Personal AI Accounts
  connectCatalog: ConnectProviderCatalogEntry[];
  chatgptOAuthConfigured: boolean;
  personalConnections: PersonalConnectionDTO[];
  personalUsage: PersonalUsageSummary | null;
  fabroBillingSummary: FabroBillingSummary | null;
  connectLoading: boolean;
  refreshConnectState: () => Promise<void>;
  testPersonalConnection: (params: {
    connectionId?: string;
    providerId?: ConnectProviderId;
    apiKey?: string;
    endpointUrl?: string;
    selectedModel?: string;
  }) => Promise<{ ok: boolean; verified: boolean; message?: string; error?: string; latencyMs?: number }>;
  savePersonalConnection: (params: {
    id?: string;
    providerId: ConnectProviderId;
    label?: string;
    apiKey?: string;
    endpointUrl?: string;
    regionId?: string;
    selectedModel?: string;
    isDefault?: boolean;
    dailyRequestLimit?: number;
    monthlyBudgetAlertUsd?: number;
  }) => Promise<{ connection: PersonalConnectionDTO; verified: boolean }>;
  updatePersonalConnection: (
    id: string,
    patch: Partial<
      Pick<
        PersonalConnectionDTO,
        'label' | 'selectedModel' | 'endpointUrl' | 'regionId' | 'isDefault' | 'dailyRequestLimit' | 'monthlyBudgetAlertUsd'
      >
    >
  ) => Promise<PersonalConnectionDTO>;
  disconnectPersonalConnection: (id: string) => Promise<void>;
  deletePersonalConnection: (id: string) => Promise<void>;
  startChatGptOAuth: () => Promise<{ oauthConfigured: boolean; authorizeUrl?: string; error?: string }>;
  sendPersonalChat: (params: {
    connectionId: string;
    prompt: string;
    systemInstruction?: string;
    history?: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
    maxOutputTokens?: number;
  }) => Promise<PersonalChatResponse>;
  comparePersonalConnections: (params: {
    connectionIds: string[];
    prompt: string;
    systemInstruction?: string;
  }) => Promise<PersonalCompareResponse>;
}

const AIGatewayContext = createContext<AIGatewayContextValue | null>(null);

export const AIGatewayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, authReady } = useFabro();
  const { isAdmin, isSuperAdmin } = usePlatform();

  const [runtimeProviders, setRuntimeProviders] = useState<AIProviderRecord[]>([]);
  const [runtimeModels, setRuntimeModels] = useState<AIModelRecord[]>([]);
  const [fsProviders, setFsProviders] = useState<AIProviderRecord[]>([]);
  const [fsModels, setFsModels] = useState<AIModelRecord[]>([]);
  const [fsStatuses, setFsStatuses] = useState<Record<string, AIProviderStatusRecord>>({});
  const [liveStatuses, setLiveStatuses] = useState<Record<string, AIProviderStatusRecord>>({});
  const [budgetConfig, setBudgetConfig] = useState<AIBudgetConfig>(FALLBACK_BUDGET);
  const [adminSettings, setAdminSettings] = useState<AIAdminSettingsRecord>(FALLBACK_SETTINGS);
  const [requestsHistory, setRequestsHistory] = useState<AIRequestRecord[]>([]);
  const [usageRecords, setUsageRecords] = useState<AIUsageRecord[]>([]);
  const [runtimeUsage, setRuntimeUsage] = useState<RuntimeUsageSummary | null>(null);
  const [conversations, setConversations] = useState<AIConversationRecord[]>([]);
  const [allUserMessages, setAllUserMessages] = useState<AIMessageRecord[]>([]);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [seededOnce, setSeededOnce] = useState(false);
  const [freemiumStatus, setFreemiumStatus] = useState<FreemiumStatus | null>(null);
  const [freemiumLoading, setFreemiumLoading] = useState<boolean>(false);
  const [plansModalOpen, setPlansModalOpen] = useState<boolean>(false);
  const [plansLimitMessage, setPlansLimitMessage] = useState<string>('');
  const [connectCatalog, setConnectCatalog] = useState<ConnectProviderCatalogEntry[]>([]);
  const [chatgptOAuthConfigured, setChatgptOAuthConfigured] = useState<boolean>(false);
  const [personalConnections, setPersonalConnections] = useState<PersonalConnectionDTO[]>([]);
  const [personalUsage, setPersonalUsage] = useState<PersonalUsageSummary | null>(null);
  const [fabroBillingSummary, setFabroBillingSummary] = useState<FabroBillingSummary | null>(null);
  const [connectLoading, setConnectLoading] = useState<boolean>(false);

  const openPlansModal = useCallback((limitMessage?: string) => {
    setPlansLimitMessage(limitMessage || '');
    setPlansModalOpen(true);
  }, []);

  const closePlansModal = useCallback(() => {
    setPlansModalOpen(false);
    setPlansLimitMessage('');
  }, []);

  const refreshFreemiumStatus = useCallback(async () => {
    if (!authReady || !user || !user.emailVerified) {
      setFreemiumStatus(null);
      return;
    }
    setFreemiumLoading(true);
    try {
      const resp = await authFetch('/api/freemium/me');
      if (resp.ok) {
        const data = (await resp.json()) as FreemiumStatus;
        setFreemiumStatus(data);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setFreemiumLoading(false);
    }
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setFreemiumStatus(null);
      return;
    }
    let cancelled = false;
    const syncAndLoad = async () => {
      try {
        await authFetch('/api/freemium/sync-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: profile?.displayName || user.displayName || '',
          }),
        });
      } catch {
        // ignore
      }
      if (!cancelled) {
        await refreshFreemiumStatus();
      }
    };
    void syncAndLoad();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, profile?.displayName, refreshFreemiumStatus]);

  useEffect(() => {
    const onQuotaUpdated = (evt: Event) => {
      const detail = (evt as CustomEvent<LiveQuotaSnapshot>).detail;
      if (!detail) return;
      setFreemiumStatus((prev) =>
        prev
          ? {
              ...prev,
              planTier: detail.planTier,
              planLabel: detail.planTier === 'premium' ? 'PREMIUM' : 'GRATIS',
              usedToday: detail.usedToday,
              dailyLimit: detail.dailyLimit,
              remainingToday: detail.remainingToday,
              extraCredits: detail.extraCredits,
              nextResetFormatted: detail.nextResetFormatted || prev.nextResetFormatted,
            }
          : prev
      );
    };
    const onQuotaExceeded = (evt: Event) => {
      const detail = (evt as CustomEvent<{ message?: string; code?: string }>).detail;
      if (detail?.message) {
        setPlansLimitMessage(detail.message);
        setPlansModalOpen(true);
      }
      void refreshFreemiumStatus();
    };
    window.addEventListener('fabro:quota-updated', onQuotaUpdated);
    window.addEventListener('fabro:quota-exceeded', onQuotaExceeded);
    return () => {
      window.removeEventListener('fabro:quota-updated', onQuotaUpdated);
      window.removeEventListener('fabro:quota-exceeded', onQuotaExceeded);
    };
  }, [refreshFreemiumStatus]);

  const refreshRuntimeCatalog = useCallback(async () => {
    try {
      const resp = await fetch('/api/gateway/catalog');
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data.providers)) {
        setRuntimeProviders(data.providers);
      }
      if (Array.isArray(data.models)) {
        setRuntimeModels(data.models);
      }
      if (data.usage) {
        setRuntimeUsage(data.usage as RuntimeUsageSummary);
      }
    } catch {
      // Offline or unreachable server
    }
  }, []);

  useEffect(() => {
    void refreshRuntimeCatalog();
  }, [refreshRuntimeCatalog]);

  const refreshConnectState = useCallback(async () => {
    try {
      const catResp = await fetch('/api/connect/catalog');
      if (catResp.ok) {
        const catData = await catResp.json();
        if (Array.isArray(catData.providers)) {
          setConnectCatalog(catData.providers as ConnectProviderCatalogEntry[]);
        }
        setChatgptOAuthConfigured(Boolean(catData.chatgptOAuthConfigured));
      }
    } catch {
      // ignore
    }

    if (!authReady || !user || !user.emailVerified) {
      setPersonalConnections([]);
      setPersonalUsage(null);
      setFabroBillingSummary(null);
      return;
    }

    setConnectLoading(true);
    try {
      const resp = await authFetch('/api/connect/connections');
      if (resp.ok) {
        const data = await resp.json();
        setPersonalConnections(Array.isArray(data.connections) ? data.connections : []);
        setPersonalUsage(data.personalUsage || null);
        setFabroBillingSummary(data.fabroBillingSummary || null);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setConnectLoading(false);
    }
  }, [authReady, user]);

  useEffect(() => {
    void refreshConnectState();
  }, [refreshConnectState]);

  // Verified Firestore subscriptions
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setFsProviders([]);
      setFsModels([]);
      setFsStatuses({});
      setRequestsHistory([]);
      setUsageRecords([]);
      setConversations([]);
      setAllUserMessages([]);
      return;
    }

    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(
        collection(db, 'AIProviders'),
        (snap) => {
          setFsProviders(snap.docs.map((d) => ({ ...(d.data() as AIProviderRecord), id: d.id as AIProviderId })));
        },
        () => undefined
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'AIModels'),
        (snap) => {
          setFsModels(snap.docs.map((d) => ({ ...(d.data() as AIModelRecord), id: d.id })));
        },
        () => undefined
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'AIProviderStatus'),
        (snap) => {
          const map: Record<string, AIProviderStatusRecord> = {};
          for (const d of snap.docs) {
            map[d.id] = { ...(d.data() as AIProviderStatusRecord), id: d.id as AIProviderId };
          }
          setFsStatuses(map);
        },
        () => undefined
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'AIBudgets', 'global'),
        (snap) => {
          if (snap.exists()) {
            setBudgetConfig({ ...FALLBACK_BUDGET, ...(snap.data() as Partial<AIBudgetConfig>), id: 'global' });
          }
        },
        () => undefined
      )
    );

    unsubs.push(
      onSnapshot(
        doc(db, 'AIAdminSettings', 'global'),
        (snap) => {
          if (snap.exists()) {
            setAdminSettings({
              ...FALLBACK_SETTINGS,
              ...(snap.data() as Partial<AIAdminSettingsRecord>),
              id: 'global',
            });
          }
        },
        () => undefined
      )
    );

    const reqQuery = isSuperAdmin
      ? collection(db, 'AIRequests')
      : query(collection(db, 'AIRequests'), where('userId', '==', user.uid));
    unsubs.push(
      onSnapshot(
        reqQuery,
        (snap) => {
          setRequestsHistory(
            sortDescByTime(snap.docs.map((d) => ({ ...(d.data() as AIRequestRecord), id: d.id }))).slice(0, 80)
          );
        },
        () => undefined
      )
    );

    const usageQuery = isSuperAdmin
      ? collection(db, 'AIUsage')
      : query(collection(db, 'AIUsage'), where('scope', '==', 'user'), where('scopeKey', '==', user.uid));
    unsubs.push(
      onSnapshot(
        usageQuery,
        (snap) => {
          setUsageRecords(snap.docs.map((d) => ({ ...(d.data() as AIUsageRecord), id: d.id })));
        },
        () => undefined
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'AIConversations'), where('userId', '==', user.uid)),
        (snap) => {
          setConversations(
            sortDescByTime(snap.docs.map((d) => ({ ...(d.data() as AIConversationRecord), id: d.id })))
          );
        },
        () => undefined
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'AIMessages'), where('userId', '==', user.uid)),
        (snap) => {
          const list = snap.docs.map((d) => ({ ...(d.data() as AIMessageRecord), id: d.id }));
          list.sort((a, b) => {
            const toMs = (val: unknown): number =>
              val && typeof val === 'object' && 'toMillis' in val
                ? Number((val as { toMillis: () => number }).toMillis()) || 0
                : 0;
            return toMs(a.createdAt) - toMs(b.createdAt);
          });
          setAllUserMessages(list);
        },
        () => undefined
      )
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [authReady, user, isSuperAdmin]);

  // Effective merged catalog: runtime Secrets availability ALWAYS overrides Firestore configuredInBackend
  const providers = useMemo<AIProviderRecord[]>(() => {
    const fsMap = new Map(fsProviders.map((p) => [p.id, p]));
    if (runtimeProviders.length === 0) return fsProviders;
    return runtimeProviders.map((rt) => {
      const ov = fsMap.get(rt.id);
      return {
        ...rt,
        enabled: typeof ov?.enabled === 'boolean' ? ov.enabled : rt.enabled,
        defaultModelId: ov?.defaultModelId || rt.defaultModelId,
        allowFallback: typeof ov?.allowFallback === 'boolean' ? ov.allowFallback : rt.allowFallback,
        configuredInBackend: Boolean(rt.configuredInBackend),
      };
    });
  }, [runtimeProviders, fsProviders]);

  const models = useMemo<AIModelRecord[]>(() => {
    const fsMap = new Map(fsModels.map((m) => [m.id, m]));
    if (runtimeModels.length === 0) return fsModels;
    return runtimeModels.map((rt) => {
      const ov = fsMap.get(rt.id);
      return {
        ...rt,
        enabled: typeof ov?.enabled === 'boolean' ? ov.enabled : rt.enabled,
      };
    });
  }, [runtimeModels, fsModels]);

  const providerStatuses = useMemo<Record<string, AIProviderStatusRecord>>(() => {
    const result: Record<string, AIProviderStatusRecord> = {};
    for (const p of providers) {
      const fs = fsStatuses[p.id];
      const live = liveStatuses[p.id];
      if (!p.configuredInBackend) {
        result[p.id] = {
          id: p.id,
          configured: false,
          status: 'pendiente_configuracion',
          lastTestedAt: live?.lastTestedAt || fs?.lastTestedAt || '',
          lastLatencyMs: 0,
          lastError: `Variable ${p.envVarName} pendiente de configurar en Secrets del backend.`,
          modelTested: p.defaultModelId,
        };
      } else if (!p.enabled) {
        result[p.id] = {
          id: p.id,
          configured: true,
          status: 'desactivado',
          lastTestedAt: live?.lastTestedAt || fs?.lastTestedAt || '',
          lastLatencyMs: live?.lastLatencyMs || fs?.lastLatencyMs || 0,
          lastError: 'Desactivado desde el Panel Administrativo.',
          modelTested: p.defaultModelId,
        };
      } else if (live) {
        result[p.id] = live;
      } else if (fs && fs.configured) {
        result[p.id] = fs;
      } else {
        result[p.id] = {
          id: p.id,
          configured: true,
          status: 'activo',
          lastTestedAt: '',
          lastLatencyMs: 0,
          lastError: '',
          modelTested: p.defaultModelId,
        };
      }
    }
    return result;
  }, [providers, fsStatuses, liveStatuses]);

  const seedDefaultGatewayConfig = useCallback(async () => {
    if (!user || !isAdmin || runtimeProviders.length === 0) return;
    const batch = writeBatch(db);
    for (const p of runtimeProviders) {
      batch.set(
        doc(db, 'AIProviders', p.id),
        {
          id: p.id,
          name: p.name,
          accessTier: p.accessTier,
          enabled: p.enabled,
          configuredInBackend: Boolean(p.configuredInBackend),
          envVarName: p.envVarName,
          defaultModelId: p.defaultModelId,
          supportsStreaming: Boolean(p.supportsStreaming),
          supportsVision: Boolean(p.supportsVision),
          supportsDocuments: Boolean(p.supportsDocuments),
          allowFallback: Boolean(p.allowFallback),
          officialUrl: p.officialUrl,
          pricingNote: p.pricingNote,
          updatedBy: user.email || user.uid,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      batch.set(
        doc(db, 'AIProviderStatus', p.id),
        {
          id: p.id,
          configured: Boolean(p.configuredInBackend),
          status: !p.configuredInBackend
            ? 'pendiente_configuracion'
            : p.enabled
              ? 'activo'
              : 'desactivado',
          lastTestedAt: '',
          lastLatencyMs: 0,
          lastError: p.configuredInBackend ? '' : `Pendiente ${p.envVarName} en Secrets`,
          modelTested: p.defaultModelId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    for (const m of runtimeModels) {
      batch.set(
        doc(db, 'AIModels', m.id),
        {
          id: m.id,
          providerId: m.providerId,
          label: m.label,
          accessTier: m.accessTier,
          enabled: m.enabled,
          maxContextTokens: Number(m.maxContextTokens || 32000),
          supportsVision: Boolean(m.supportsVision),
          supportsDocuments: Boolean(m.supportsDocuments),
          supportsReasoning: Boolean(m.supportsReasoning),
          inputCostPer1MUsd: Number(m.inputCostPer1MUsd || 0),
          outputCostPer1MUsd: Number(m.outputCostPer1MUsd || 0),
          recommendedFor: Array.isArray(m.recommendedFor) ? m.recommendedFor.slice(0, 20) : [],
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
    batch.set(
      doc(db, 'AIBudgets', 'global'),
      {
        ...budgetConfig,
        id: 'global',
        updatedBy: user.email || user.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    batch.set(
      doc(db, 'AIAdminSettings', 'global'),
      {
        ...adminSettings,
        id: 'global',
        updatedBy: user.email || user.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();
  }, [user, isAdmin, runtimeProviders, runtimeModels, budgetConfig, adminSettings]);

  // Auto-seed once for admin if AIProviders collection is empty
  useEffect(() => {
    if (!isAdmin || seededOnce || runtimeProviders.length === 0 || fsProviders.length > 0) return;
    setSeededOnce(true);
    void seedDefaultGatewayConfig();
  }, [isAdmin, seededOnce, runtimeProviders.length, fsProviders.length, seedDefaultGatewayConfig]);

  const effectivePlanPolicy = useMemo<AIPlanPolicy>(() => {
    if (isAdmin || isSuperAdmin) return 'plan_administrador';
    return budgetConfig.activePlanDefault || 'plan_educativo';
  }, [isAdmin, isSuperAdmin, budgetConfig.activePlanDefault]);

  const messagesByConversation = useMemo<Record<string, AIMessageRecord[]>>(() => {
    const map: Record<string, AIMessageRecord[]> = {};
    for (const msg of allUserMessages) {
      if (!map[msg.conversationId]) map[msg.conversationId] = [];
      map[msg.conversationId].push(msg);
    }
    return map;
  }, [allUserMessages]);

  const toggleProviderEnabled = useCallback(
    async (providerId: AIProviderId, enabled: boolean) => {
      if (!user || !isAdmin) return;
      const target = providers.find((p) => p.id === providerId);
      if (!target) return;
      await setDoc(doc(db, 'AIProviders', providerId), {
        id: target.id,
        name: target.name,
        accessTier: target.accessTier,
        enabled,
        configuredInBackend: Boolean(target.configuredInBackend),
        envVarName: target.envVarName,
        defaultModelId: target.defaultModelId,
        supportsStreaming: Boolean(target.supportsStreaming),
        supportsVision: Boolean(target.supportsVision),
        supportsDocuments: Boolean(target.supportsDocuments),
        allowFallback: Boolean(target.allowFallback),
        officialUrl: target.officialUrl,
        pricingNote: target.pricingNote,
        updatedBy: user.email || user.uid,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'AIProviderStatus', providerId), {
        id: providerId,
        configured: Boolean(target.configuredInBackend),
        status: !target.configuredInBackend
          ? 'pendiente_configuracion'
          : enabled
            ? 'activo'
            : 'desactivado',
        lastTestedAt: providerStatuses[providerId]?.lastTestedAt || '',
        lastLatencyMs: providerStatuses[providerId]?.lastLatencyMs || 0,
        lastError: enabled ? '' : 'Desactivado manualmente desde Admin',
        modelTested: target.defaultModelId,
        updatedAt: serverTimestamp(),
      });
    },
    [user, isAdmin, providers, providerStatuses]
  );

  const updateProviderDefaultModel = useCallback(
    async (providerId: AIProviderId, modelId: string) => {
      if (!user || !isAdmin) return;
      const target = providers.find((p) => p.id === providerId);
      if (!target) return;
      await setDoc(doc(db, 'AIProviders', providerId), {
        id: target.id,
        name: target.name,
        accessTier: target.accessTier,
        enabled: target.enabled,
        configuredInBackend: Boolean(target.configuredInBackend),
        envVarName: target.envVarName,
        defaultModelId: modelId,
        supportsStreaming: Boolean(target.supportsStreaming),
        supportsVision: Boolean(target.supportsVision),
        supportsDocuments: Boolean(target.supportsDocuments),
        allowFallback: Boolean(target.allowFallback),
        officialUrl: target.officialUrl,
        pricingNote: target.pricingNote,
        updatedBy: user.email || user.uid,
        updatedAt: serverTimestamp(),
      });
    },
    [user, isAdmin, providers]
  );

  const toggleModelEnabled = useCallback(
    async (modelId: string, enabled: boolean) => {
      if (!user || !isAdmin) return;
      const m = models.find((item) => item.id === modelId);
      if (!m) return;
      await setDoc(doc(db, 'AIModels', modelId), {
        id: m.id,
        providerId: m.providerId,
        label: m.label,
        accessTier: m.accessTier,
        enabled,
        maxContextTokens: m.maxContextTokens,
        supportsVision: m.supportsVision,
        supportsDocuments: m.supportsDocuments,
        supportsReasoning: m.supportsReasoning,
        inputCostPer1MUsd: m.inputCostPer1MUsd,
        outputCostPer1MUsd: m.outputCostPer1MUsd,
        recommendedFor: m.recommendedFor,
        updatedAt: serverTimestamp(),
      });
    },
    [user, isAdmin, models]
  );

  const runProviderConnectionTest = useCallback(
    async (providerId: AIProviderId): Promise<AIProviderStatusRecord | null> => {
      setTestingProviderId(providerId);
      try {
        const target = providers.find((p) => p.id === providerId);
        const resp = await authFetch('/api/gateway/providers/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            enabled: target?.enabled ?? true,
            defaultModelId: target?.defaultModelId,
          }),
        });
        const data = await resp.json();
        const record: AIProviderStatusRecord = {
          id: providerId,
          configured: Boolean(data.configured),
          status: data.status || 'error',
          lastTestedAt: String(data.testedAt || new Date().toISOString()),
          lastLatencyMs: Number(data.latencyMs || 0),
          lastError: String(data.error || '').slice(0, 950),
          modelTested: String(data.modelTested || target?.defaultModelId || ''),
        };
        setLiveStatuses((prev) => ({ ...prev, [providerId]: record }));
        if (user && isAdmin) {
          await setDoc(doc(db, 'AIProviderStatus', providerId), {
            ...record,
            updatedAt: serverTimestamp(),
          });
        }
        return record;
      } catch {
        return null;
      } finally {
        setTestingProviderId(null);
      }
    },
    [providers, user, isAdmin]
  );

  const saveBudgetConfig = useCallback(
    async (next: Partial<AIBudgetConfig>) => {
      if (!user || !isAdmin) return;
      const merged: AIBudgetConfig = { ...budgetConfig, ...next, id: 'global' };
      await setDoc(doc(db, 'AIBudgets', 'global'), {
        id: 'global',
        dailyGlobalLimitUsd: Number(merged.dailyGlobalLimitUsd),
        monthlyGlobalLimitUsd: Number(merged.monthlyGlobalLimitUsd),
        perUserDailyRequestLimit: Number(merged.perUserDailyRequestLimit),
        perUserDailyTokenLimit: Number(merged.perUserDailyTokenLimit),
        alertThresholdPercent: Number(merged.alertThresholdPercent),
        onBudgetExceeded: merged.onBudgetExceeded,
        activePlanDefault: merged.activePlanDefault,
        updatedBy: user.email || user.uid,
        updatedAt: serverTimestamp(),
      });
    },
    [user, isAdmin, budgetConfig]
  );

  const saveAdminSettings = useCallback(
    async (next: Partial<AIAdminSettingsRecord>) => {
      if (!user || !isAdmin) return;
      const merged: AIAdminSettingsRecord = { ...adminSettings, ...next, id: 'global' };
      await setDoc(doc(db, 'AIAdminSettings', 'global'), {
        id: 'global',
        defaultRoutingMode: merged.defaultRoutingMode,
        allowAutomaticFallback: Boolean(merged.allowAutomaticFallback),
        blockPaidModelsForFreePlan: Boolean(merged.blockPaidModelsForFreePlan),
        minorStrictSafeRouting: Boolean(merged.minorStrictSafeRouting),
        enableStreaming: Boolean(merged.enableStreaming),
        retentionDays: Number(merged.retentionDays || 180),
        updatedBy: user.email || user.uid,
        updatedAt: serverTimestamp(),
      });
    },
    [user, isAdmin, adminSettings]
  );

  const ensureConversation = useCallback(
    async (params: {
      conversationId?: string | null;
      subjectId: string;
      title: string;
      routingMode: AIRoutingMode;
      preferredProviderId: AIProviderId | 'auto';
      preferredModelId: string;
    }): Promise<string> => {
      if (!user) throw new Error('Usuario no autenticado.');
      if (params.conversationId) {
        const existing = conversations.find((c) => c.id === params.conversationId);
        if (existing) return existing.id;
      }
      const id = makeId('conv');
      await setDoc(doc(db, 'AIConversations', id), {
        id,
        userId: user.uid,
        subjectId: params.subjectId || '',
        title: (params.title || 'Consulta FABRO Multi-IA').slice(0, 180),
        routingMode: params.routingMode,
        preferredProviderId: params.preferredProviderId,
        preferredModelId: params.preferredModelId || '',
        favorite: false,
        messageCount: 0,
        lastModelUsed: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return id;
    },
    [user, conversations]
  );

  const renameConversation = useCallback(
    async (conversationId: string, title: string) => {
      if (!user) return;
      const clean = title.trim().slice(0, 180);
      if (!clean) return;
      await updateDoc(doc(db, 'AIConversations', conversationId), {
        title: clean,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const toggleFavoriteConversation = useCallback(
    async (conversationId: string, favorite: boolean) => {
      if (!user) return;
      await updateDoc(doc(db, 'AIConversations', conversationId), {
        favorite,
        updatedAt: serverTimestamp(),
      });
    },
    [user]
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      const msgsSnap = await getDocs(
        query(
          collection(db, 'AIMessages'),
          where('userId', '==', user.uid),
          where('conversationId', '==', conversationId)
        )
      );
      const batch = writeBatch(db);
      for (const d of msgsSnap.docs) {
        batch.delete(d.ref);
      }
      batch.delete(doc(db, 'AIConversations', conversationId));
      await batch.commit();
    },
    [user]
  );

  const toggleFavoriteMessage = useCallback(
    async (messageId: string, favorite: boolean) => {
      if (!user) return;
      await updateDoc(doc(db, 'AIMessages', messageId), { favorite });
    },
    [user]
  );

  const recordGatewayTurn = useCallback(
    async (params: {
      conversationId: string;
      userPrompt: string;
      result: GatewayChatResponsePayload;
    }) => {
      if (!user) return;
      const convId = params.conversationId;
      const existingConv = conversations.find((c) => c.id === convId);
      const userMsgId = makeId('msg');
      const aiMsgId = makeId('msg');
      const reqId = makeId('req');
      const dateKey = new Date().toISOString().slice(0, 10);
      const monthKey = dateKey.slice(0, 7);

      // Persist conversation metadata update
      if (existingConv) {
        await updateDoc(doc(db, 'AIConversations', convId), {
          messageCount: (existingConv.messageCount || 0) + 2,
          lastModelUsed: `${params.result.providerName} · ${params.result.apiModelName}`.slice(0, 115),
          updatedAt: serverTimestamp(),
        });
      }

      // Persist user + assistant messages in AIMessages
      const batch = writeBatch(db);
      batch.set(doc(db, 'AIMessages', userMsgId), {
        id: userMsgId,
        conversationId: convId,
        userId: user.uid,
        role: 'user',
        content: params.userPrompt.slice(0, 240000),
        favorite: false,
        createdAt: serverTimestamp(),
      });
      batch.set(doc(db, 'AIMessages', aiMsgId), {
        id: aiMsgId,
        conversationId: convId,
        userId: user.uid,
        role: 'assistant',
        content: (params.result.text || '').slice(0, 240000) || '(Sin texto)',
        providerId: params.result.providerId,
        modelId: params.result.apiModelName,
        accessTier: params.result.accessTier,
        inputTokens: params.result.inputTokens,
        outputTokens: params.result.outputTokens,
        estimatedCostUsd: params.result.estimatedCostUsd,
        latencyMs: params.result.latencyMs,
        routingReason: (params.result.routingReason || '').slice(0, 480),
        fallbackNotice: (params.result.fallbackNotice || '').slice(0, 480),
        favorite: false,
        createdAt: serverTimestamp(),
      });

      // Audit request record in AIRequests
      batch.set(doc(db, 'AIRequests', reqId), {
        id: reqId,
        userId: user.uid,
        userEmail: user.email || '',
        conversationId: convId,
        routingMode: params.result.routingMode,
        providerId: params.result.providerId,
        modelId: params.result.apiModelName,
        accessTier: params.result.accessTier,
        status: 'completada',
        inputTokens: params.result.inputTokens,
        outputTokens: params.result.outputTokens,
        totalTokens: params.result.totalTokens,
        estimatedCostUsd: params.result.estimatedCostUsd,
        latencyMs: params.result.latencyMs,
        fallbackUsed: params.result.fallbackUsed,
        ...(params.result.fallbackFrom ? { fallbackFrom: params.result.fallbackFrom.slice(0, 115) } : {}),
        ...(params.result.routingReason ? { routingReason: params.result.routingReason.slice(0, 480) } : {}),
        createdAt: serverTimestamp(),
      });

      // Update daily user usage rollup in AIUsage
      const userUsageDocId = `user_${user.uid}_${dateKey}`.slice(0, 120);
      const prevUserUsage = usageRecords.find((u) => u.id === userUsageDocId);
      const isPaid = params.result.accessTier === 'commercial';
      batch.set(doc(db, 'AIUsage', userUsageDocId), {
        id: userUsageDocId,
        scope: 'user',
        scopeKey: user.uid,
        dateKey,
        monthKey,
        requestsCount: (prevUserUsage?.requestsCount || 0) + 1,
        freeRequestsCount: (prevUserUsage?.freeRequestsCount || 0) + (isPaid ? 0 : 1),
        paidRequestsCount: (prevUserUsage?.paidRequestsCount || 0) + (isPaid ? 1 : 0),
        inputTokens: (prevUserUsage?.inputTokens || 0) + params.result.inputTokens,
        outputTokens: (prevUserUsage?.outputTokens || 0) + params.result.outputTokens,
        estimatedCostUsd: Number(
          ((prevUserUsage?.estimatedCostUsd || 0) + params.result.estimatedCostUsd).toFixed(6)
        ),
        updatedAt: serverTimestamp(),
      });

      if (isAdmin) {
        const provUsageDocId = `provider_${params.result.providerId}_${dateKey}`.slice(0, 120);
        const prevProvUsage = usageRecords.find((u) => u.id === provUsageDocId);
        batch.set(doc(db, 'AIUsage', provUsageDocId), {
          id: provUsageDocId,
          scope: 'provider',
          scopeKey: params.result.providerId,
          dateKey,
          monthKey,
          requestsCount: (prevProvUsage?.requestsCount || 0) + 1,
          freeRequestsCount: (prevProvUsage?.freeRequestsCount || 0) + (isPaid ? 0 : 1),
          paidRequestsCount: (prevProvUsage?.paidRequestsCount || 0) + (isPaid ? 1 : 0),
          inputTokens: (prevProvUsage?.inputTokens || 0) + params.result.inputTokens,
          outputTokens: (prevProvUsage?.outputTokens || 0) + params.result.outputTokens,
          estimatedCostUsd: Number(
            ((prevProvUsage?.estimatedCostUsd || 0) + params.result.estimatedCostUsd).toFixed(6)
          ),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      void refreshRuntimeCatalog();
    },
    [user, conversations, usageRecords, isAdmin, refreshRuntimeCatalog]
  );

  const sendGatewayChat = useCallback(
    async (params: {
      prompt: string;
      systemInstruction?: string;
      history?: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
      routingMode: AIRoutingMode;
      requestedProviderId?: AIProviderId | 'auto';
      requestedModelId?: string;
      useWebSearch?: boolean;
      attachment?: { name?: string; mimeType: string; base64: string } | null;
    }): Promise<GatewayChatResponsePayload> => {
      const resp = await authFetch('/api/gateway/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'anon',
          userEmail: user?.email || '',
          planPolicy: effectivePlanPolicy,
          isMinor: Boolean(profile?.isMinor),
          prompt: params.prompt,
          systemInstruction: params.systemInstruction,
          history: params.history,
          routingMode: params.routingMode,
          requestedProviderId: params.requestedProviderId,
          requestedModelId: params.requestedModelId,
          useWebSearch: params.useWebSearch,
          attachment: params.attachment || null,
          providerOverrides: providers,
          modelOverrides: models,
          budgetPolicy: budgetConfig,
          adminSettings,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'Error ejecutando consulta en FABRO AI Gateway.');
      }
      return data as GatewayChatResponsePayload;
    },
    [user, effectivePlanPolicy, profile?.isMinor, providers, models, budgetConfig, adminSettings]
  );

  const sendGatewayChatStream = useCallback(
    async (params: {
      prompt: string;
      systemInstruction?: string;
      history?: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
      routingMode: AIRoutingMode;
      requestedProviderId?: AIProviderId | 'auto';
      requestedModelId?: string;
      useWebSearch?: boolean;
      attachment?: { name?: string; mimeType: string; base64: string } | null;
      onChunk: (delta: string) => void;
    }): Promise<GatewayChatResponsePayload> => {
      const resp = await authFetch('/api/gateway/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'anon',
          userEmail: user?.email || '',
          planPolicy: effectivePlanPolicy,
          isMinor: Boolean(profile?.isMinor),
          prompt: params.prompt,
          systemInstruction: params.systemInstruction,
          history: params.history,
          routingMode: params.routingMode,
          requestedProviderId: params.requestedProviderId,
          requestedModelId: params.requestedModelId,
          useWebSearch: params.useWebSearch,
          attachment: params.attachment || null,
          providerOverrides: providers,
          modelOverrides: models,
          budgetPolicy: budgetConfig,
          adminSettings,
        }),
      });
      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({} as { error?: string }));
        throw new Error(errBody.error || 'No se pudo abrir la transmisión en tiempo real del Gateway.');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalPayload: GatewayChatResponsePayload | null = null;
      let streamError = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';
        for (const frame of frames) {
          const lines = frame.split('\n');
          let eventName = 'message';
          let dataLine = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            if (line.startsWith('data:')) dataLine += line.slice(5).trim();
          }
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine);
            if (eventName === 'chunk' && typeof parsed.delta === 'string') {
              params.onChunk(parsed.delta);
            } else if (eventName === 'done') {
              finalPayload = parsed as GatewayChatResponsePayload;
            } else if (eventName === 'error') {
              streamError = String(parsed.error || 'Error en streaming del Gateway.');
            }
          } catch {
            // ignore malformed frame
          }
        }
      }

      if (streamError) throw new Error(streamError);
      if (!finalPayload) throw new Error('La transmisión finalizó sin respuesta completa.');
      void refreshFreemiumStatus();
      return finalPayload;
    },
    [user, effectivePlanPolicy, profile?.isMinor, providers, models, budgetConfig, adminSettings, refreshFreemiumStatus]
  );

  const runGatewayCompare = useCallback(
    async (params: {
      prompt: string;
      modelIds: string[];
      mode: 'interpretativo' | 'sencillo';
      subjectName?: string;
    }): Promise<GatewayComparePayload> => {
      const resp = await authFetch('/api/gateway/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'anon',
          prompt: params.prompt,
          modelIds: params.modelIds.slice(0, 4),
          mode: params.mode,
          educationLevel: profile?.educationLevel || 'universitario',
          subjectName: params.subjectName || '',
          providerOverrides: providers,
          modelOverrides: models,
          budgetPolicy: budgetConfig,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo completar la comparación Multi-IA.');
      }
      void refreshRuntimeCatalog();
      return data as GatewayComparePayload;
    },
    [user, profile?.educationLevel, providers, models, budgetConfig, refreshRuntimeCatalog]
  );

  const testPersonalConnection = useCallback(
    async (params: {
      connectionId?: string;
      providerId?: ConnectProviderId;
      apiKey?: string;
      endpointUrl?: string;
      selectedModel?: string;
    }) => {
      const resp = await authFetch('/api/connect/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await resp.json();
      await refreshConnectState();
      return {
        ok: Boolean(data.ok),
        verified: Boolean(data.verified),
        message: data.message,
        error: data.error,
        latencyMs: data.latencyMs,
      };
    },
    [refreshConnectState]
  );

  const savePersonalConnection = useCallback(
    async (params: {
      id?: string;
      providerId: ConnectProviderId;
      label?: string;
      apiKey?: string;
      endpointUrl?: string;
      regionId?: string;
      selectedModel?: string;
      isDefault?: boolean;
      dailyRequestLimit?: number;
      monthlyBudgetAlertUsd?: number;
    }) => {
      const resp = await authFetch('/api/connect/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo verificar y guardar la conexión personal.');
      }
      await refreshConnectState();
      return data as { connection: PersonalConnectionDTO; verified: boolean };
    },
    [refreshConnectState]
  );

  const updatePersonalConnection = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          PersonalConnectionDTO,
          'label' | 'selectedModel' | 'endpointUrl' | 'regionId' | 'isDefault' | 'dailyRequestLimit' | 'monthlyBudgetAlertUsd'
        >
      >
    ) => {
      const resp = await authFetch(`/api/connect/connections/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo actualizar la conexión.');
      await refreshConnectState();
      return data.connection as PersonalConnectionDTO;
    },
    [refreshConnectState]
  );

  const disconnectPersonalConnection = useCallback(
    async (id: string) => {
      const resp = await authFetch(`/api/connect/connections/${encodeURIComponent(id)}/disconnect`, {
        method: 'POST',
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo desconectar la cuenta.');
      await refreshConnectState();
    },
    [refreshConnectState]
  );

  const deletePersonalConnection = useCallback(
    async (id: string) => {
      const resp = await authFetch(`/api/connect/connections/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'No se pudo eliminar la credencial.');
      await refreshConnectState();
    },
    [refreshConnectState]
  );

  const startChatGptOAuth = useCallback(async () => {
    const resp = await authFetch('/api/connect/oauth/chatgpt/start');
    const data = await resp.json();
    return {
      oauthConfigured: Boolean(data.oauthConfigured),
      authorizeUrl: data.authorizeUrl as string | undefined,
      error: data.error as string | undefined,
    };
  }, []);

  const sendPersonalChat = useCallback(
    async (params: {
      connectionId: string;
      prompt: string;
      systemInstruction?: string;
      history?: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
      maxOutputTokens?: number;
    }): Promise<PersonalChatResponse> => {
      const resp = await authFetch('/api/connect/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await resp.json();
      void refreshConnectState();
      if (!resp.ok) {
        const err = new Error(data.error || 'Tu IA personal no pudo completar la solicitud.') as Error & {
          code?: string;
          requiresUserSwitchApproval?: boolean;
        };
        err.code = data.code;
        err.requiresUserSwitchApproval = Boolean(data.requiresUserSwitchApproval);
        throw err;
      }
      return data as PersonalChatResponse;
    },
    [refreshConnectState]
  );

  const comparePersonalConnections = useCallback(
    async (params: {
      connectionIds: string[];
      prompt: string;
      systemInstruction?: string;
    }): Promise<PersonalCompareResponse> => {
      const resp = await authFetch('/api/connect/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await resp.json();
      void refreshConnectState();
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo ejecutar la comparación con tus IAs personales.');
      }
      return data as PersonalCompareResponse;
    },
    [refreshConnectState]
  );

  // Silence unused deleteDoc import warning if not directly needed
  void deleteDoc;

  const value = useMemo<AIGatewayContextValue>(
    () => ({
      providers,
      models,
      providerStatuses,
      budgetConfig,
      adminSettings,
      effectivePlanPolicy,
      requestsHistory,
      usageRecords,
      runtimeUsage,
      conversations,
      messagesByConversation,
      testingProviderId,
      freemiumStatus,
      freemiumLoading,
      plansModalOpen,
      plansLimitMessage,
      openPlansModal,
      closePlansModal,
      refreshFreemiumStatus,
      refreshRuntimeCatalog,
      seedDefaultGatewayConfig,
      toggleProviderEnabled,
      updateProviderDefaultModel,
      toggleModelEnabled,
      runProviderConnectionTest,
      saveBudgetConfig,
      saveAdminSettings,
      ensureConversation,
      renameConversation,
      toggleFavoriteConversation,
      deleteConversation,
      recordGatewayTurn,
      toggleFavoriteMessage,
      sendGatewayChat,
      sendGatewayChatStream,
      runGatewayCompare,
      connectCatalog,
      chatgptOAuthConfigured,
      personalConnections,
      personalUsage,
      fabroBillingSummary,
      connectLoading,
      refreshConnectState,
      testPersonalConnection,
      savePersonalConnection,
      updatePersonalConnection,
      disconnectPersonalConnection,
      deletePersonalConnection,
      startChatGptOAuth,
      sendPersonalChat,
      comparePersonalConnections,
    }),
    [
      providers,
      models,
      providerStatuses,
      budgetConfig,
      adminSettings,
      effectivePlanPolicy,
      requestsHistory,
      usageRecords,
      runtimeUsage,
      conversations,
      messagesByConversation,
      testingProviderId,
      freemiumStatus,
      freemiumLoading,
      plansModalOpen,
      plansLimitMessage,
      openPlansModal,
      closePlansModal,
      refreshFreemiumStatus,
      refreshRuntimeCatalog,
      seedDefaultGatewayConfig,
      toggleProviderEnabled,
      updateProviderDefaultModel,
      toggleModelEnabled,
      runProviderConnectionTest,
      saveBudgetConfig,
      saveAdminSettings,
      ensureConversation,
      renameConversation,
      toggleFavoriteConversation,
      deleteConversation,
      recordGatewayTurn,
      toggleFavoriteMessage,
      sendGatewayChat,
      sendGatewayChatStream,
      runGatewayCompare,
      connectCatalog,
      chatgptOAuthConfigured,
      personalConnections,
      personalUsage,
      fabroBillingSummary,
      connectLoading,
      refreshConnectState,
      testPersonalConnection,
      savePersonalConnection,
      updatePersonalConnection,
      disconnectPersonalConnection,
      deletePersonalConnection,
      startChatGptOAuth,
      sendPersonalChat,
      comparePersonalConnections,
    ]
  );

  return <AIGatewayContext.Provider value={value}>{children}</AIGatewayContext.Provider>;
};

export function useAIGateway(): AIGatewayContextValue {
  const ctx = useContext(AIGatewayContext);
  if (!ctx) throw new Error('useAIGateway must be used within AIGatewayProvider');
  return ctx;
}
