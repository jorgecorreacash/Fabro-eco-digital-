import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Check,
  Download,
  ExternalLink,
  FilePlus2,
  Folder,
  FolderPlus,
  Globe,
  Home,
  LayoutDashboard,
  Loader2,
  Lock,
  Maximize2,
  Menu,
  Minimize2,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Unlock,
  Upload,
  UserCheck,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  DEFAULT_BROWSER_SETTINGS,
  SEARCH_ENGINE_TEMPLATES,
  detectPlatformCapabilities,
  getTranslateServiceUrl,
  isDangerousDownloadFile,
  isPdfResource,
  resolveOmniboxInput,
  validateSafeNavigationUrl,
} from '../../browser/platformBridge';
import type {
  BrowserDownloadItem,
  BrowserFavoriteEntry,
  BrowserFavoriteFolder,
  BrowserHistoryEntry,
  BrowserProfile,
  BrowserSettings,
  BrowserTab,
  DefaultSearchEngineId,
  SitePermissionRecord,
} from '../../browser/types';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { authFetch } from '../../lib/apiClient';
import { exportMarkdownToPdf } from '../../lib/exporters';
import { formatProbeDate, resolvePortalIcon } from '../../lib/portalIcons';
import type {
  ExternalOnlyRule,
  ModuleHomeConfig,
  PortalCategory,
  PortalEntry,
  PortalModuleId,
} from '../../types/fabro';
import { LocalPdfViewer } from './LocalPdfViewer';

interface FabroBrowserWorkspaceProps {
  module: PortalModuleId;
  title: string;
  subtitle: string;
  categories: PortalCategory[];
  portals: PortalEntry[];
  adminHomeConfig?: ModuleHomeConfig;
  externalOnlyRules?: ExternalOnlyRule[];
  loadingPortals: boolean;
  onRefreshPortals: () => Promise<void>;
  onPatchPortalProbe: (portalId: string, patch: Partial<PortalEntry>) => void;
  onMarkExternalOnly?: (params: {
    portalId?: string;
    name: string;
    url: string;
    removeShortcut: boolean;
    reason?: string;
  }) => Promise<void>;
  onOpenManager?: () => void;
  defaultPortalId?: string;
  headerExtraActions?: React.ReactNode;
}

type AiAssistantTask =
  | 'resumir'
  | 'explicar'
  | 'traducir'
  | 'apuntes'
  | 'preguntas'
  | 'fichas'
  | 'documento'
  | 'comparar'
  | 'citas';

const AI_ASSISTANT_TASKS: Array<{ id: AiAssistantTask; label: string }> = [
  { id: 'resumir', label: 'Resumir' },
  { id: 'explicar', label: 'Explicar conceptos' },
  { id: 'traducir', label: 'Traducir texto' },
  { id: 'apuntes', label: 'Crear apuntes' },
  { id: 'preguntas', label: 'Generar preguntas' },
  { id: 'fichas', label: 'Crear fichas de estudio' },
  { id: 'documento', label: 'Analizar documento' },
  { id: 'comparar', label: 'Comparar info' },
  { id: 'citas', label: 'Citas bibliográficas' },
];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export const FabroBrowserWorkspace: React.FC<FabroBrowserWorkspaceProps> = ({
  module,
  title,
  subtitle,
  categories,
  portals,
  adminHomeConfig,
  externalOnlyRules = [],
  loadingPortals,
  onRefreshPortals,
  onPatchPortalProbe,
  onMarkExternalOnly,
  onOpenManager,
  defaultPortalId,
  headerExtraActions,
}) => {
  const {
    user,
    profile: fabroUserProfile,
    theme,
    toggleTheme,
    setActiveSection,
    createNote,
    createDeck,
    createCard,
    subjects,
    selectedSubjectId,
  } = useFabro();
  const { isAdmin } = usePlatform();
  const { sendGatewayChat } = useAIGateway();

  const capabilities = useMemo(() => detectPlatformCapabilities(), []);
  const uidPrefix = user?.uid || 'anon';

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === selectedSubjectId) || subjects[0] || null,
    [subjects, selectedSubjectId]
  );

  // ------------------------------------------------------------------
  // Multi-Profile State (Isolated per user & per local device profile)
  // ------------------------------------------------------------------
  const profilesStorageKey = `fabro_browser_profiles_${uidPrefix}`;
  const [profiles, setProfiles] = useState<BrowserProfile[]>(() =>
    readJsonStorage<BrowserProfile[]>(profilesStorageKey, [
      {
        id: 'default',
        name: fabroUserProfile?.displayName || 'Estudiante Principal',
        partitionKey: `persist:fabro_${uidPrefix}_default`,
        accentColor: '#0284c7',
        createdAt: new Date().toISOString(),
      },
    ])
  );
  const [activeProfileId, setActiveProfileId] = useState<string>(
    () => readJsonStorage<string>(`fabro_browser_active_profile_${uidPrefix}`, 'default')
  );
  const activeProfile = useMemo(
    () => profiles.find((p) => p.id === activeProfileId) || profiles[0],
    [profiles, activeProfileId]
  );

  useEffect(() => {
    writeJsonStorage(profilesStorageKey, profiles);
  }, [profiles, profilesStorageKey]);

  useEffect(() => {
    writeJsonStorage(`fabro_browser_active_profile_${uidPrefix}`, activeProfileId);
  }, [activeProfileId, uidPrefix]);

  // Per-profile isolated storage keys
  const profileNs = `${uidPrefix}_${activeProfile?.id || 'default'}_${module}`;
  const tabsKey = `fabro_browser_tabs_${profileNs}`;
  const favFoldersKey = `fabro_browser_fav_folders_${uidPrefix}_${activeProfile?.id || 'default'}`;
  const favItemsKey = `fabro_browser_fav_items_${uidPrefix}_${activeProfile?.id || 'default'}`;
  const historyKey = `fabro_browser_history_${uidPrefix}_${activeProfile?.id || 'default'}`;
  const downloadsKey = `fabro_browser_downloads_${uidPrefix}_${activeProfile?.id || 'default'}`;
  const settingsKey = `fabro_browser_settings_${uidPrefix}_${activeProfile?.id || 'default'}`;
  const permissionsKey = `fabro_browser_perms_${uidPrefix}_${activeProfile?.id || 'default'}`;

  // ------------------------------------------------------------------
  // Settings, Permissions, Favorites, History, Downloads, Tabs
  // ------------------------------------------------------------------
  const [settings, setSettings] = useState<BrowserSettings>(() =>
    readJsonStorage<BrowserSettings>(settingsKey, DEFAULT_BROWSER_SETTINGS)
  );
  const [permissions, setPermissions] = useState<SitePermissionRecord[]>(() =>
    readJsonStorage<SitePermissionRecord[]>(permissionsKey, [])
  );
  const [favFolders, setFavFolders] = useState<BrowserFavoriteFolder[]>(() =>
    readJsonStorage<BrowserFavoriteFolder[]>(favFoldersKey, [
      { id: 'folder_general', name: 'General', createdAt: new Date().toISOString() },
      { id: 'folder_ia', name: 'Inteligencia Artificial', createdAt: new Date().toISOString() },
      { id: 'folder_acad', name: 'Investigación y Estudio', createdAt: new Date().toISOString() },
    ])
  );
  const [favorites, setFavorites] = useState<BrowserFavoriteEntry[]>(() =>
    readJsonStorage<BrowserFavoriteEntry[]>(favItemsKey, [])
  );
  const [history, setHistory] = useState<BrowserHistoryEntry[]>(() =>
    readJsonStorage<BrowserHistoryEntry[]>(historyKey, [])
  );
  const [downloads, setDownloads] = useState<BrowserDownloadItem[]>(() =>
    readJsonStorage<BrowserDownloadItem[]>(downloadsKey, [])
  );

  // Sync profile-isolated stores when profile switches
  useEffect(() => {
    setSettings(readJsonStorage<BrowserSettings>(settingsKey, DEFAULT_BROWSER_SETTINGS));
    setPermissions(readJsonStorage<SitePermissionRecord[]>(permissionsKey, []));
    setFavFolders(
      readJsonStorage<BrowserFavoriteFolder[]>(favFoldersKey, [
        { id: 'folder_general', name: 'General', createdAt: new Date().toISOString() },
        { id: 'folder_ia', name: 'Inteligencia Artificial', createdAt: new Date().toISOString() },
        { id: 'folder_acad', name: 'Investigación y Estudio', createdAt: new Date().toISOString() },
      ])
    );
    setFavorites(readJsonStorage<BrowserFavoriteEntry[]>(favItemsKey, []));
    setHistory(readJsonStorage<BrowserHistoryEntry[]>(historyKey, []));
    setDownloads(readJsonStorage<BrowserDownloadItem[]>(downloadsKey, []));
  }, [
    settingsKey,
    permissionsKey,
    favFoldersKey,
    favItemsKey,
    historyKey,
    downloadsKey,
  ]);

  useEffect(() => writeJsonStorage(settingsKey, settings), [settings, settingsKey]);
  useEffect(() => writeJsonStorage(permissionsKey, permissions), [permissions, permissionsKey]);
  useEffect(() => writeJsonStorage(favFoldersKey, favFolders), [favFolders, favFoldersKey]);
  useEffect(() => writeJsonStorage(favItemsKey, favorites), [favorites, favItemsKey]);
  useEffect(() => writeJsonStorage(historyKey, history), [history, historyKey]);
  useEffect(() => writeJsonStorage(downloadsKey, downloads), [downloads, downloadsKey]);

  const [tabs, setTabs] = useState<BrowserTab[]>(() =>
    readJsonStorage<BrowserTab[]>(tabsKey, [])
  );
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [omniboxValue, setOmniboxValue] = useState('');
  const [omniboxError, setOmniboxError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  // UI Overlays & Drawers
  const [sidebarOpenDesktop, setSidebarOpenDesktop] = useState(settings.showSidebar);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [activeToolDrawer, setActiveToolDrawer] = useState<
    null | 'favorites' | 'history' | 'downloads' | 'profiles' | 'settings'
  >(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Sidebar Portal Filters
  const [portalSearch, setPortalSearch] = useState('');
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const [addingCustomPortal, setAddingCustomPortal] = useState(false);
  const [customPortalName, setCustomPortalName] = useState('');
  const [customPortalUrl, setCustomPortalUrl] = useState('');

  // History & Favorites sub-filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | 'week'>('all');
  const [selectedFavFolder, setSelectedFavFolder] = useState<string>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFavId, setEditingFavId] = useState<string | null>(null);
  const [editingFavTitle, setEditingFavTitle] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [confirmDeletePortalId, setConfirmDeletePortalId] = useState<string | null>(null);
  const [deletingPortalId, setDeletingPortalId] = useState<string | null>(null);

  // AI Assistant State (Voluntary text only)
  const [aiTask, setAiTask] = useState<AiAssistantTask>('resumir');
  const [aiTextA, setAiTextA] = useState('');
  const [aiTextB, setAiTextB] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  const browserContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);
  const autoProbedRef = useRef<Set<string>>(new Set());

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) || tabs[0] || null,
    [tabs, activeTabId]
  );

  // Save tabs per profile
  useEffect(() => {
    if (tabs.length > 0) {
      writeJsonStorage(
        tabsKey,
        tabs.map((t) => ({ ...t, pdfDataUrl: undefined }))
      );
    }
  }, [tabs, tabsKey]);

  const isForcedExternalByRule = useCallback(
    (url: string, portalId?: string) => {
      if (externalOnlyRules.length === 0) return false;
      let host = '';
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch {
        host = '';
      }
      return externalOnlyRules.some(
        (r) =>
          (portalId && r.portalId === portalId) ||
          r.url === url ||
          (host && r.hostname && r.hostname === host)
      );
    },
    [externalOnlyRules]
  );

  // Seed initial tab cleanly from Admin Start Pages / Home Config when portals arrive
  useEffect(() => {
    if (portals.length === 0) return;
    if (tabs.length === 0) {
      const startPages = adminHomeConfig?.startPages || [];
      if (startPages.length > 0) {
        const seededTabs: BrowserTab[] = startPages.map((sp) => {
          const matched =
            (sp.portalId && portals.find((p) => p.id === sp.portalId)) ||
            portals.find((p) => p.url === sp.url);
          const tabUrl = matched?.url || sp.url;
          const forcedExt = isForcedExternalByRule(tabUrl, matched?.id || sp.portalId);
          const isAllowed =
            capabilities.supportsNativeTabs ||
            (!forcedExt && matched?.iframeAllowed === true && !matched?.requiresExternal);
          return {
            id: makeId('tab'),
            portalId: matched?.id || sp.portalId || '',
            title: matched?.name || sp.title || sp.url,
            url: tabUrl,
            iconName: matched?.iconName || 'Globe',
            isLoading: false,
            errorMessage: '',
            modality: isPdfResource(tabUrl)
              ? 'pdf_local'
              : isAllowed
              ? 'integrado'
              : 'externo',
            profileId: activeProfile?.id || 'default',
            historyStack: [tabUrl],
            historyIndex: 0,
            zoomPercent: 100,
            readerMode: false,
            iframeAllowed: forcedExt ? false : matched ? matched.iframeAllowed : null,
            requiresExternal: forcedExt ? true : matched ? matched.requiresExternal : false,
            statusMessage: forcedExt
              ? 'Marcado para apertura externa exclusiva (no carga mediante iframe).'
              : matched?.statusMessage || 'Página de inicio configurada por el administrador.',
          };
        });
        setTabs(seededTabs);
        setActiveTabId(seededTabs[0].id);
        setOmniboxValue(seededTabs[0].url);
        return;
      }

      const preferred =
        (adminHomeConfig?.defaultPortalId &&
          portals.find((p) => p.id === adminHomeConfig.defaultPortalId)) ||
        (defaultPortalId && portals.find((p) => p.id === defaultPortalId)) ||
        portals.find((p) => p.compatibilityStatus === 'iframe_compatible') ||
        portals[0];

      if (adminHomeConfig?.homeUrl && !portals.some((p) => p.url === adminHomeConfig.homeUrl) && !preferred) {
        const customHomeTab: BrowserTab = {
          id: makeId('tab'),
          portalId: '',
          title: adminHomeConfig.homeTitle || 'Inicio',
          url: adminHomeConfig.homeUrl,
          iconName: 'Home',
          isLoading: false,
          errorMessage: '',
          modality: capabilities.supportsNativeTabs ? 'integrado' : 'externo',
          profileId: activeProfile?.id || 'default',
          historyStack: [adminHomeConfig.homeUrl],
          historyIndex: 0,
          zoomPercent: 100,
          readerMode: false,
          iframeAllowed: null,
          requiresExternal: false,
          statusMessage: 'Página de inicio configurada por el administrador.',
        };
        setTabs([customHomeTab]);
        setActiveTabId(customHomeTab.id);
        setOmniboxValue(customHomeTab.url);
        return;
      }

      if (!preferred) return;
      const initialModality =
        preferred.iframeAllowed === true && !preferred.requiresExternal ? 'integrado' : 'externo';
      const initialTab: BrowserTab = {
        id: makeId('tab'),
        portalId: preferred.id,
        title: preferred.name,
        url: preferred.url,
        iconName: preferred.iconName,
        isLoading: false,
        errorMessage: '',
        modality: capabilities.supportsNativeTabs ? 'integrado' : initialModality,
        profileId: activeProfile?.id || 'default',
        historyStack: [preferred.url],
        historyIndex: 0,
        zoomPercent: 100,
        readerMode: false,
        iframeAllowed: preferred.iframeAllowed,
        requiresExternal: preferred.requiresExternal,
        statusMessage: preferred.statusMessage,
      };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
      setOmniboxValue(initialTab.url);
    } else if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
      setOmniboxValue(tabs[0].url);
    }
  }, [
    portals,
    tabs,
    activeTabId,
    defaultPortalId,
    adminHomeConfig,
    capabilities.supportsNativeTabs,
    activeProfile?.id,
  ]);

  // Ensure any open tab matching an exclusive external-only rule never stays in iframe mode
  useEffect(() => {
    if (externalOnlyRules.length === 0) return;
    setTabs((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (t.modality === 'integrado' && isForcedExternalByRule(t.url, t.portalId)) {
          changed = true;
          return {
            ...t,
            modality: 'externo' as const,
            iframeAllowed: false,
            requiresExternal: true,
            statusMessage:
              'Marcado para apertura externa exclusiva (no carga correctamente mediante iframe).',
          };
        }
        return t;
      });
      return changed ? next : prev;
    });
  }, [externalOnlyRules, isForcedExternalByRule]);

  // Keep omnibox synced when switching tabs
  useEffect(() => {
    if (activeTab) {
      setOmniboxValue(activeTab.url);
      setOmniboxError('');
    }
  }, [activeTab?.id, activeTab?.url]);

  const recordHistory = useCallback(
    (entry: { portalId?: string; title: string; url: string; modality: BrowserTab['modality'] }) => {
      const item: BrowserHistoryEntry = {
        id: makeId('hist'),
        portalId: entry.portalId,
        title: entry.title,
        url: entry.url,
        module,
        modality: entry.modality,
        visitedAt: new Date().toISOString(),
      };
      setHistory((prev) => [item, ...prev].slice(0, 120));

      if (user && entry.portalId) {
        void authFetch('/api/portals/me/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            portalId: entry.portalId,
            name: entry.title,
            url: entry.url,
            module,
          }),
        }).catch(() => undefined);
      }
    },
    [module, user]
  );

  // Live probe URL ONLY when untested (never insist or loop!)
  const probeUrlOnce = useCallback(
    async (tabId: string, url: string, portalId?: string) => {
      try {
        const resp = await authFetch('/api/portals/probe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ portalId: portalId || undefined, url }),
        });
        if (!resp.ok) return;
        const data = (await resp.json()) as { probe?: Partial<PortalEntry> };
        const probe = data.probe;
        if (!probe) return;

        if (portalId) {
          onPatchPortalProbe(portalId, probe);
        }

        const allowsFrame =
          probe.iframeAllowed === true &&
          !probe.requiresExternal &&
          probe.compatibilityStatus !== 'external_required' &&
          probe.compatibilityStatus !== 'unreachable';

        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  isLoading: false,
                  iframeAllowed: probe.iframeAllowed ?? false,
                  requiresExternal: Boolean(probe.requiresExternal),
                  statusMessage: probe.statusMessage,
                  modality: capabilities.supportsNativeTabs
                    ? 'integrado'
                    : isPdfResource(t.url)
                    ? 'pdf_local'
                    : allowsFrame
                    ? 'integrado'
                    : 'externo',
                }
              : t
          )
        );
      } catch {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, isLoading: false } : t))
        );
      }
    },
    [capabilities.supportsNativeTabs, onPatchPortalProbe]
  );

  // Open or focus a portal inside the active tab (or open a new tab)
  const navigateToPortal = useCallback(
    (portal: PortalEntry, openInNewTab = false) => {
      setMobileSidebarOpen(false);
      setOmniboxError('');

      const isPdf = isPdfResource(portal.url);
      const forcedExt = isForcedExternalByRule(portal.url, portal.id);
      const allowsIntegrated =
        capabilities.supportsNativeTabs ||
        (!forcedExt && portal.iframeAllowed === true && !portal.requiresExternal);
      const modality: BrowserTab['modality'] = isPdf
        ? 'pdf_local'
        : allowsIntegrated
        ? 'integrado'
        : 'externo';

      const targetTabId = openInNewTab || !activeTab ? makeId('tab') : activeTab.id;

      if (openInNewTab || !activeTab) {
        const newTab: BrowserTab = {
          id: targetTabId,
          portalId: portal.id,
          title: portal.name,
          url: portal.url,
          iconName: portal.iconName,
          isLoading: !forcedExt && portal.compatibilityStatus === 'untested',
          errorMessage: '',
          modality,
          profileId: activeProfile?.id || 'default',
          historyStack: [portal.url],
          historyIndex: 0,
          zoomPercent: 100,
          readerMode: false,
          iframeAllowed: forcedExt ? false : portal.iframeAllowed,
          requiresExternal: forcedExt ? true : portal.requiresExternal,
          statusMessage: forcedExt
            ? 'Marcado para apertura externa exclusiva (no carga mediante iframe).'
            : portal.statusMessage,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        if (window.fabroElectronBridge?.openTab && activeProfile) {
          void window.fabroElectronBridge.openTab(newTab.id, portal.url, activeProfile.partitionKey);
        }
      } else {
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== targetTabId) return t;
            const nextStack = [...t.historyStack.slice(0, t.historyIndex + 1), portal.url];
            return {
              ...t,
              portalId: portal.id,
              title: portal.name,
              url: portal.url,
              iconName: portal.iconName,
              isLoading: !forcedExt && portal.compatibilityStatus === 'untested',
              errorMessage: '',
              modality,
              openedExternallyAt: undefined,
              historyStack: nextStack,
              historyIndex: nextStack.length - 1,
              pdfDataUrl: undefined,
              pdfFileName: undefined,
              iframeAllowed: forcedExt ? false : portal.iframeAllowed,
              requiresExternal: forcedExt ? true : portal.requiresExternal,
              statusMessage: forcedExt
                ? 'Marcado para apertura externa exclusiva (no carga mediante iframe).'
                : portal.statusMessage,
            };
          })
        );
        if (window.fabroElectronBridge?.navigate) {
          void window.fabroElectronBridge.navigate(targetTabId, portal.url);
        }
      }

      setOmniboxValue(portal.url);
      recordHistory({ portalId: portal.id, title: portal.name, url: portal.url, modality });

      if (!forcedExt && portal.compatibilityStatus === 'untested' && !autoProbedRef.current.has(portal.id)) {
        autoProbedRef.current.add(portal.id);
        void probeUrlOnce(targetTabId, portal.url, portal.id);
      }
    },
    [
      activeProfile,
      activeTab,
      capabilities.supportsNativeTabs,
      isForcedExternalByRule,
      probeUrlOnce,
      recordHistory,
    ]
  );

  // Navigate via Omnibox (URL or search)
  const handleOmniboxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOmniboxError('');
    const resolved = resolveOmniboxInput(omniboxValue, settings.defaultSearchEngine);
    if (!resolved.validation.valid) {
      setOmniboxError(resolved.validation.reason || 'URL inválida.');
      return;
    }

    const finalUrl = resolved.validation.normalizedUrl;
    if (settings.httpsOnlyWarning && !resolved.validation.isHttps && !isPdfResource(finalUrl)) {
      setOmniboxError('Advertencia: este sitio utiliza HTTP sin cifrado HTTPS.');
    }

    const knownPortal = portals.find((p) => {
      try {
        return new URL(p.url).hostname === new URL(finalUrl).hostname;
      } catch {
        return false;
      }
    });

    const isPdf = isPdfResource(finalUrl);
    const forcedExt = isForcedExternalByRule(finalUrl, knownPortal?.id);
    const targetTabId = activeTab ? activeTab.id : makeId('tab');
    const knownAllows =
      !forcedExt && knownPortal && knownPortal.iframeAllowed === true && !knownPortal.requiresExternal;
    const modality: BrowserTab['modality'] = capabilities.supportsNativeTabs
      ? 'integrado'
      : isPdf
      ? 'pdf_local'
      : knownAllows
      ? 'integrado'
      : 'externo';

    if (!activeTab) {
      const created: BrowserTab = {
        id: targetTabId,
        portalId: knownPortal?.id || '',
        title: knownPortal?.name || resolved.validation.hostname,
        url: finalUrl,
        iconName: knownPortal?.iconName || 'Globe',
        isLoading: !knownPortal && !isPdf,
        errorMessage: '',
        modality,
        profileId: activeProfile?.id || 'default',
        historyStack: [finalUrl],
        historyIndex: 0,
        zoomPercent: 100,
        readerMode: false,
        iframeAllowed: knownPortal ? knownPortal.iframeAllowed : null,
        requiresExternal: knownPortal ? knownPortal.requiresExternal : false,
        statusMessage: knownPortal?.statusMessage,
      };
      setTabs([created]);
      setActiveTabId(created.id);
    } else {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          const nextStack = [...t.historyStack.slice(0, t.historyIndex + 1), finalUrl];
          return {
            ...t,
            portalId: knownPortal?.id || '',
            title: knownPortal?.name || resolved.validation.hostname,
            url: finalUrl,
            iconName: knownPortal?.iconName || 'Globe',
            isLoading: !knownPortal && !isPdf,
            errorMessage: '',
            modality,
            openedExternallyAt: undefined,
            historyStack: nextStack,
            historyIndex: nextStack.length - 1,
            pdfDataUrl: undefined,
            pdfFileName: undefined,
            iframeAllowed: knownPortal ? knownPortal.iframeAllowed : null,
            requiresExternal: knownPortal ? knownPortal.requiresExternal : false,
            statusMessage: knownPortal?.statusMessage,
          };
        })
      );
    }

    if (window.fabroElectronBridge?.navigate) {
      void window.fabroElectronBridge.navigate(targetTabId, finalUrl);
    }
    recordHistory({
      portalId: knownPortal?.id,
      title: knownPortal?.name || resolved.validation.hostname,
      url: finalUrl,
      modality,
    });

    if (!knownPortal && !isPdf && !capabilities.supportsNativeTabs) {
      void probeUrlOnce(targetTabId, finalUrl);
    }
  };

  // Mark external launch explicitly (NEVER simulate integration!)
  const handleMarkOpenedExternally = (tab: BrowserTab) => {
    const nowIso = new Date().toISOString();
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tab.id
          ? {
              ...t,
              modality: 'externo_abierto',
              openedExternallyAt: nowIso,
            }
          : t
      )
    );
    if (window.FabroAndroidBridge?.openCustomTab) {
      window.FabroAndroidBridge.openCustomTab(tab.url);
    } else if (window.fabroElectronBridge?.openSystemBrowser) {
      void window.fabroElectronBridge.openSystemBrowser(tab.url);
    }
  };

  const handleNewTab = () => {
    const adminDefault =
      (adminHomeConfig?.defaultPortalId &&
        portals.find((p) => p.id === adminHomeConfig.defaultPortalId)) ||
      (adminHomeConfig?.homeUrl && portals.find((p) => p.url === adminHomeConfig.homeUrl));
    const defaultPortal =
      adminDefault ||
      portals.find((p) => p.compatibilityStatus === 'iframe_compatible') ||
      portals[0];
    const url = adminHomeConfig?.homeUrl || defaultPortal?.url || settings.homePageUrl;
    const forcedExt = isForcedExternalByRule(url, defaultPortal?.id);
    const isAllowed =
      capabilities.supportsNativeTabs ||
      (!forcedExt && defaultPortal?.iframeAllowed === true && !defaultPortal.requiresExternal);
    const created: BrowserTab = {
      id: makeId('tab'),
      portalId: defaultPortal?.id || '',
      title: defaultPortal?.name || adminHomeConfig?.homeTitle || 'Nueva pestaña',
      url,
      iconName: defaultPortal?.iconName || 'Globe',
      isLoading: !forcedExt && !defaultPortal && !capabilities.supportsNativeTabs,
      errorMessage: '',
      modality: isAllowed ? 'integrado' : 'externo',
      profileId: activeProfile?.id || 'default',
      historyStack: [url],
      historyIndex: 0,
      zoomPercent: 100,
      readerMode: false,
      iframeAllowed: forcedExt ? false : (defaultPortal?.iframeAllowed ?? null),
      requiresExternal: forcedExt ? true : (defaultPortal?.requiresExternal ?? false),
      statusMessage: forcedExt
        ? 'Marcado para apertura externa exclusiva (no carga mediante iframe).'
        : defaultPortal?.statusMessage,
    };
    setTabs((prev) => [...prev, created]);
    setActiveTabId(created.id);
    if (!forcedExt && !defaultPortal && !capabilities.supportsNativeTabs) {
      void probeUrlOnce(created.id, url);
    }
    if (window.fabroElectronBridge?.openTab && activeProfile) {
      void window.fabroElectronBridge.openTab(created.id, url, activeProfile.partitionKey);
    }
  };

  const handleCloseTab = (tabId: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((t) => t.id === tabId);
      const next = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        const replacement = next[Math.max(0, idx - 1)] || next[0];
        if (replacement) setActiveTabId(replacement.id);
      }
      return next;
    });
    if (window.fabroElectronBridge?.closeTab) {
      void window.fabroElectronBridge.closeTab(tabId);
    }
  };

  const handleBack = () => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    if (window.fabroElectronBridge?.goBack) {
      void window.fabroElectronBridge.goBack(activeTab.id);
    }
    const nextIdx = activeTab.historyIndex - 1;
    const nextUrl = activeTab.historyStack[nextIdx];
    const matchedPortal = portals.find((p) => p.url === nextUrl);
    const forcedExt = isForcedExternalByRule(nextUrl, matchedPortal?.id);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              historyIndex: nextIdx,
              url: nextUrl,
              title: matchedPortal?.name || nextUrl,
              portalId: matchedPortal?.id || '',
              modality:
                !forcedExt && matchedPortal && matchedPortal.iframeAllowed === true && !matchedPortal.requiresExternal
                  ? 'integrado'
                  : 'externo',
              openedExternallyAt: undefined,
            }
          : t
      )
    );
  };

  const handleForward = () => {
    if (!activeTab || activeTab.historyIndex >= activeTab.historyStack.length - 1) return;
    if (window.fabroElectronBridge?.goForward) {
      void window.fabroElectronBridge.goForward(activeTab.id);
    }
    const nextIdx = activeTab.historyIndex + 1;
    const nextUrl = activeTab.historyStack[nextIdx];
    const matchedPortal = portals.find((p) => p.url === nextUrl);
    const forcedExt = isForcedExternalByRule(nextUrl, matchedPortal?.id);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? {
              ...t,
              historyIndex: nextIdx,
              url: nextUrl,
              title: matchedPortal?.name || nextUrl,
              portalId: matchedPortal?.id || '',
              modality:
                !forcedExt && matchedPortal && matchedPortal.iframeAllowed === true && !matchedPortal.requiresExternal
                  ? 'integrado'
                  : 'externo',
              openedExternallyAt: undefined,
            }
          : t
      )
    );
  };

  const handleReload = () => {
    if (!activeTab) return;
    if (window.fabroElectronBridge?.reload) {
      void window.fabroElectronBridge.reload(activeTab.id);
    }
    // Only reload iframe when modality is genuinely integrated
    if (activeTab.modality === 'integrado') {
      setReloadNonce((n) => n + 1);
    }
  };

  const handleGoHome = () => {
    const effectiveHomeUrl = adminHomeConfig?.homeUrl || settings.homePageUrl;
    const portalHome =
      (adminHomeConfig?.defaultPortalId &&
        portals.find((p) => p.id === adminHomeConfig.defaultPortalId)) ||
      portals.find((p) => p.url === effectiveHomeUrl) ||
      (defaultPortalId ? portals.find((p) => p.id === defaultPortalId) : undefined);

    if (portalHome) {
      navigateToPortal(portalHome, false);
      return;
    }

    if (effectiveHomeUrl && activeTab) {
      const targetTabId = activeTab.id;
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== targetTabId) return t;
          const nextStack = [...t.historyStack.slice(0, t.historyIndex + 1), effectiveHomeUrl];
          return {
            ...t,
            portalId: '',
            title: adminHomeConfig?.homeTitle || 'Inicio',
            url: effectiveHomeUrl,
            iconName: 'Home',
            isLoading: !capabilities.supportsNativeTabs,
            modality: capabilities.supportsNativeTabs ? 'integrado' : 'externo',
            historyStack: nextStack,
            historyIndex: nextStack.length - 1,
            openedExternallyAt: undefined,
          };
        })
      );
      setOmniboxValue(effectiveHomeUrl);
      if (!capabilities.supportsNativeTabs) {
        void probeUrlOnce(targetTabId, effectiveHomeUrl);
      }
    }
  };

  const handleRemovePortalFromApp = async (portal: PortalEntry) => {
    setDeletingPortalId(portal.id);
    try {
      if (onMarkExternalOnly) {
        await onMarkExternalOnly({
          portalId: portal.id,
          name: portal.name,
          url: portal.url,
          removeShortcut: true,
          reason: 'Acceso directo eliminado por fallar en iframe · apertura externa exclusiva.',
        });
      } else {
        if (portal.isSystem && !isAdmin) return;
        const endpoint = portal.isSystem
          ? `/api/portals/admin/items/${module}/${portal.id}`
          : `/api/portals/me/custom/${portal.id}`;
        const resp = await authFetch(endpoint, { method: 'DELETE' });
        if (!resp.ok) {
          throw new Error('No se pudo eliminar el portal.');
        }
        await onRefreshPortals();
      }
      setConfirmDeletePortalId(null);

      // Switch or reset tabs pointing to the deleted portal cleanly
      const remaining = portals.filter((p) => p.id !== portal.id);
      const fallback =
        remaining.find((p) => p.compatibilityStatus === 'iframe_compatible') || remaining[0];
      setTabs((prev) =>
        prev
          .filter((t) => t.portalId !== portal.id || prev.length === 1)
          .map((t) =>
            t.portalId === portal.id && fallback
              ? {
                  ...t,
                  portalId: fallback.id,
                  title: fallback.name,
                  url: fallback.url,
                  iconName: fallback.iconName,
                  modality:
                    fallback.iframeAllowed === true && !fallback.requiresExternal
                      ? 'integrado'
                      : 'externo',
                  iframeAllowed: fallback.iframeAllowed,
                  requiresExternal: fallback.requiresExternal,
                  statusMessage: fallback.statusMessage,
                  historyStack: [fallback.url],
                  historyIndex: 0,
                }
              : t
          )
      );
    } catch (err) {
      setOmniboxError(err instanceof Error ? err.message : 'Error eliminando portal.');
    } finally {
      setDeletingPortalId(null);
    }
  };

  const handleFlagActiveTabExternalOnly = async (tab: BrowserTab, removeShortcut: boolean) => {
    const reason = 'Marcado manualmente por no cargar correctamente mediante iframe · apertura externa exclusiva.';
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tab.id
          ? {
              ...t,
              modality: 'externo',
              iframeAllowed: false,
              requiresExternal: true,
              statusMessage: reason,
            }
          : t
      )
    );
    if (onMarkExternalOnly) {
      try {
        await onMarkExternalOnly({
          portalId: tab.portalId || undefined,
          name: tab.title,
          url: tab.url,
          removeShortcut,
          reason,
        });
      } catch (err) {
        setOmniboxError(err instanceof Error ? err.message : 'Error al marcar apertura externa.');
      }
    }
  };

  // Favorites Management
  const isCurrentFavorite = Boolean(
    activeTab && favorites.some((f) => f.url === activeTab.url)
  );

  const toggleCurrentFavorite = () => {
    if (!activeTab) return;
    if (isCurrentFavorite) {
      setFavorites((prev) => prev.filter((f) => f.url !== activeTab.url));
    } else {
      const entry: BrowserFavoriteEntry = {
        id: makeId('fav'),
        portalId: activeTab.portalId || undefined,
        title: activeTab.title,
        url: activeTab.url,
        folderId: favFolders[0]?.id || 'folder_general',
        categoryName: module === 'ai-browser' ? 'Inteligencia Artificial' : 'Navegación',
        iconName: activeTab.iconName || 'Globe',
        createdAt: new Date().toISOString(),
      };
      setFavorites((prev) => [entry, ...prev]);
    }
  };

  const handleCreateFavoriteFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const folder: BrowserFavoriteFolder = {
      id: makeId('fld'),
      name: newFolderName.trim(),
      createdAt: new Date().toISOString(),
    };
    setFavFolders((prev) => [...prev, folder]);
    setNewFolderName('');
  };

  // Download Manager
  const startSafeDownload = async (url: string, suggestedFilename?: string) => {
    const filename =
      suggestedFilename ||
      url.split('/').pop()?.split('?')[0] ||
      `archivo-fabro-${Date.now()}.pdf`;
    const downloadId = makeId('dl');

    if (settings.blockDangerousDownloads && isDangerousDownloadFile(filename)) {
      setDownloads((prev) => [
        {
          id: downloadId,
          filename,
          url,
          mimeType: 'application/octet-stream',
          status: 'blocked',
          progressPercent: 0,
          bytesReceived: 0,
          totalBytes: 0,
          startedAt: new Date().toISOString(),
          safetyNote: 'Bloqueado: extensión potencialmente ejecutable o riesgosa.',
        },
        ...prev,
      ]);
      setActiveToolDrawer('downloads');
      return;
    }

    setDownloads((prev) => [
      {
        id: downloadId,
        filename,
        url,
        mimeType: isPdfResource(filename) ? 'application/pdf' : 'application/octet-stream',
        status: 'in_progress',
        progressPercent: 20,
        bytesReceived: 0,
        totalBytes: 0,
        startedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    setActiveToolDrawer('downloads');

    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloads((prev) =>
        prev.map((d) =>
          d.id === downloadId
            ? {
                ...d,
                status: 'completed',
                progressPercent: 100,
                bytesReceived: blob.size,
                totalBytes: blob.size,
                mimeType: blob.type || d.mimeType,
                localObjectUrl: objUrl,
              }
            : d
        )
      );
    } catch {
      // Fallback: mark manual external download when server blocks CORS fetch
      setDownloads((prev) =>
        prev.map((d) =>
          d.id === downloadId
            ? {
                ...d,
                status: 'cancelled',
                safetyNote: 'El servidor externo exige descarga directa desde tu navegador.',
              }
            : d
        )
      );
    }
  };

  // Local PDF Upload into Integrated PDF Viewer Tab
  const handleLocalPdfSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objUrl = URL.createObjectURL(file);
    const pdfTab: BrowserTab = {
      id: makeId('tab'),
      portalId: '',
      title: file.name,
      url: objUrl,
      iconName: 'FileText',
      isLoading: false,
      errorMessage: '',
      modality: 'pdf_local',
      profileId: activeProfile?.id || 'default',
      historyStack: [objUrl],
      historyIndex: 0,
      zoomPercent: 100,
      readerMode: false,
      pdfDataUrl: objUrl,
      pdfFileName: file.name,
      iframeAllowed: true,
      requiresExternal: false,
      statusMessage: 'Visor PDF integrado de FABRO.',
    };
    setTabs((prev) => [...prev, pdfTab]);
    setActiveTabId(pdfTab.id);
    e.target.value = '';
  };

  const handleSendPdfToDocuments = (extractedText: string, fileName: string) => {
    try {
      sessionStorage.setItem(
        'fabro_documents_handoff',
        JSON.stringify({ fileName, extractedText, from: module, sentAt: new Date().toISOString() })
      );
    } catch {
      // ignore
    }
    setActiveSection('documents');
  };

  // Profile Management
  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    const id = `prof_${Date.now().toString(36)}`;
    const created: BrowserProfile = {
      id,
      name: newProfileName.trim(),
      partitionKey: `persist:fabro_${uidPrefix}_${id}`,
      accentColor: '#0ea5e9',
      createdAt: new Date().toISOString(),
    };
    setProfiles((prev) => [...prev, created]);
    setActiveProfileId(id);
    setTabs([]);
    setNewProfileName('');
  };

  const handleClearProfileBrowsingData = () => {
    setHistory([]);
    setDownloads([]);
    if (activeProfile && window.fabroElectronBridge?.clearProfileData) {
      void window.fabroElectronBridge.clearProfileData(activeProfile.partitionKey);
    }
    if (activeProfile && window.FabroAndroidBridge?.clearProfileCookies) {
      window.FabroAndroidBridge.clearProfileCookies(activeProfile.id);
    }
  };

  // Custom Student Portal Addition
  const handleSaveCustomPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateSafeNavigationUrl(customPortalUrl);
    if (!check.valid || !customPortalName.trim()) {
      setOmniboxError(check.reason || 'Nombre o URL inválida.');
      return;
    }
    if (user) {
      const resp = await authFetch('/api/portals/me/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          name: customPortalName.trim(),
          url: check.normalizedUrl,
        }),
      });
      if (resp.ok) {
        await onRefreshPortals();
      }
    }
    setCustomPortalName('');
    setCustomPortalUrl('');
    setAddingCustomPortal(false);
  };

  // FABRO AI ASSISTANT (Voluntary user-shared text ONLY)
  const handleRunAiAssistant = async (overrideTask?: AiAssistantTask) => {
    const task = overrideTask || aiTask;
    if (overrideTask) setAiTask(overrideTask);
    if (!aiTextA.trim()) {
      setAiError('Pegá o compartí voluntariamente el texto o respuesta que querés analizar.');
      return;
    }
    setAiRunning(true);
    setAiError('');
    setAiNotice('');

    const instructions: Record<AiAssistantTask, string> = {
      resumir: 'Resumí de manera clara y estructurada las ideas principales, conceptos clave y conclusiones del texto compartido.',
      explicar: 'Explicá los conceptos y términos técnicos del texto de forma didáctica y universitaria con ejemplos claros.',
      traducir: 'Traducí fielmente el texto compartido al español académico claro (o al inglés si ya está en español).',
      apuntes: 'Convertí el contenido compartido en un apunte ordenado con subtítulos, puntos clave y definiciones.',
      preguntas: 'Generá 6 preguntas de autoevaluación con respuestas explicadas a partir del contenido compartido.',
      fichas: 'Generá exactamente 5 fichas de estudio en formato:\nTARJETA 1:\nFRENTE: ...\nREVERSO: ...\n(sin texto extra antes ni después de las tarjetas).',
      documento: 'Realizá un análisis crítico del documento o fragmento compartido destacando tesis, argumentos y puntos a verificar.',
      comparar: 'Compará el Texto A y el Texto B señalando coincidencias, diferencias, contradicciones y síntesis crítica.',
      citas: 'Elaborá sugerencias de citas bibliográficas (APA 7 y formato académico) y notas de referencia usando la URL y el contenido compartido.',
    };

    const prompt = [
      instructions[task],
      activeSubject ? `Materia: ${activeSubject.name}.` : '',
      activeTab ? `Página de referencia indicada por el usuario: ${activeTab.title} (${activeTab.url}).` : '',
      '',
      '=== CONTENIDO COMPARTIDO A ===',
      aiTextA.trim(),
      aiTextB.trim() ? `\n=== CONTENIDO COMPARTIDO B ===\n${aiTextB.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const res = await sendGatewayChat({
        prompt,
        systemInstruction:
          'Sos FABRO AI ASSISTANT. Solo analizás contenido compartido voluntariamente por el estudiante. Respondé en español riguroso.',
        routingMode: 'automatica',
        requestedProviderId: 'auto',
      });
      setAiOutput(res.text);

      // If task was "fichas", parse cards and offer instant save or create deck automatically
      if (task === 'fichas' && user) {
        const blocks = res.text.split(/TARJETA\s+\d+\s*:/i).filter((b) => b.trim());
        const parsedCards = blocks
          .map((blk) => {
            const frontMatch = blk.match(/FRENTE\s*:\s*([\s\S]*?)(?=REVERSO\s*:|$)/i);
            const backMatch = blk.match(/REVERSO\s*:\s*([\s\S]*)/i);
            return {
              front: (frontMatch?.[1] || '').trim(),
              back: (backMatch?.[1] || '').trim(),
            };
          })
          .filter((c) => c.front && c.back);

        if (parsedCards.length > 0) {
          const deckId = await createDeck({
            subjectId: activeSubject?.id || '',
            title: `Fichas · ${activeTab?.title || 'Navegador FABRO'}`,
            description: `Generadas desde ${activeTab?.url || 'FABRO Browser'}`,
          });
          const today = new Date().toISOString().slice(0, 10);
          for (const card of parsedCards) {
            await createCard(deckId, {
              question: card.front,
              answer: card.back,
              cardType: 'flashcard',
              options: [],
              correctOptionIndex: 0,
              easeFactor: 2.5,
              intervalDays: 1,
              repetitions: 0,
              nextReviewDate: today,
              lastResult: 'pendiente',
            });
          }
          setAiNotice(`Se creó el mazo con ${parsedCards.length} fichas en Memorización.`);
        }
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error ejecutando FABRO AI Assistant.');
    } finally {
      setAiRunning(false);
    }
  };

  const handleSaveAiToNotes = async () => {
    if (!aiOutput.trim()) return;
    await createNote({
      subjectId: activeSubject?.id || '',
      title: `${AI_ASSISTANT_TASKS.find((t) => t.id === aiTask)?.label || 'Nota'} · ${activeTab?.title || 'FABRO Browser'}`,
      unit: 'FABRO Browser',
      folder: 'Navegación e Investigación',
      tags: ['fabro-browser', module],
      attachments: [],
      offlineAvailable: true,
      contentHtml: aiOutput
        .split('\n')
        .map((l) => `<p>${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
        .join(''),
      contentText: aiOutput,
    });
    setAiNotice('Guardado en Apuntes.');
  };

  // Toggle Fullscreen safely
  const handleToggleFullscreen = () => {
    if (!browserContainerRef.current) return;
    if (!document.fullscreenElement) {
      void browserContainerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => undefined);
    } else {
      void document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => undefined);
    }
  };

  // Filtered Sidebar Portals
  const filteredPortals = useMemo(() => {
    const q = portalSearch.trim().toLowerCase();
    return portals.filter((p) => {
      if (!p.active) return false;
      if (!q) return true;
      return `${p.name} ${p.categoryName} ${p.url}`.toLowerCase().includes(q);
    });
  }, [portals, portalSearch]);

  const groupedPortals = useMemo(() => {
    const groups: Array<{ id: string; name: string; items: PortalEntry[] }> = [];
    const custom = filteredPortals.filter((p) => !p.isSystem);
    if (custom.length > 0) {
      groups.push({ id: 'custom', name: 'Mis portales propios', items: custom });
    }
    const sortedCats = [...categories].sort((a, b) => a.order - b.order);
    for (const cat of sortedCats) {
      const items = filteredPortals
        .filter((p) => p.isSystem && p.categoryId === cat.id)
        .sort((a, b) => a.order - b.order);
      if (items.length > 0) groups.push({ id: cat.id, name: cat.name, items });
    }
    const uncat = filteredPortals.filter(
      (p) => p.isSystem && !sortedCats.some((c) => c.id === p.categoryId)
    );
    if (uncat.length > 0) groups.push({ id: 'other', name: 'Otros', items: uncat });
    return groups;
  }, [categories, filteredPortals]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const now = Date.now();
    const todayPrefix = new Date().toISOString().slice(0, 10);
    return history.filter((h) => {
      if (historyDateFilter === 'today' && !h.visitedAt.startsWith(todayPrefix)) return false;
      if (historyDateFilter === 'week' && now - Date.parse(h.visitedAt) > 7 * 86400_000) return false;
      if (!q) return true;
      return `${h.title} ${h.url}`.toLowerCase().includes(q);
    });
  }, [history, historyDateFilter, historySearch]);

  const activeUrlCheck = useMemo(
    () => validateSafeNavigationUrl(activeTab?.url || ''),
    [activeTab?.url]
  );

  const renderPortalSidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-2.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={portalSearch}
            onChange={(e) => setPortalSearch(e.target.value)}
            placeholder="Filtrar portales..."
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-8 pr-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 px-0.5">
          <span>Motor: {capabilities.platform === 'web' ? 'Web Selectivo' : capabilities.engineName}</span>
          <span className="font-mono tabular-nums">{filteredPortals.length}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
        {loadingPortals ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
            <span>Cargando...</span>
          </div>
        ) : groupedPortals.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">Sin portales coincidentes.</p>
        ) : (
          groupedPortals.map((grp) => {
            const collapsed = !portalSearch.trim() && Boolean(collapsedCats[grp.id]);
            return (
              <div key={grp.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsedCats((prev) => ({ ...prev, [grp.id]: !prev[grp.id] }))
                  }
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <span className="truncate">
                    {grp.name} ({grp.items.length})
                  </span>
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  )}
                </button>
                {!collapsed && (
                  <div className="space-y-0.5">
                    {grp.items.map((p) => {
                      const Icon = resolvePortalIcon(p.iconName);
                      const isCurrent = activeTab?.portalId === p.id;
                      const isIntegratedCapable =
                        capabilities.supportsNativeTabs ||
                        (!isForcedExternalByRule(p.url, p.id) &&
                          p.iframeAllowed === true &&
                          !p.requiresExternal);
                      const canDeletePortal = Boolean(onMarkExternalOnly) || !p.isSystem || isAdmin;
                      const isConfirmingDel = confirmDeletePortalId === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
                            isCurrent
                              ? 'bg-sky-600/12 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => navigateToPortal(p, false)}
                            className="flex-1 min-w-0 flex items-center gap-2 text-left text-xs font-medium cursor-pointer"
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                            <span className="truncate">{p.name}</span>
                          </button>
                          <span
                            title={
                              isIntegratedCapable
                                ? 'Integrado dentro de FABRO'
                                : 'Apertura externa exclusiva (no carga en iframe)'
                            }
                            className={`text-[10px] font-mono shrink-0 ${
                              isIntegratedCapable
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {isIntegratedCapable ? 'Int' : 'Ext'}
                          </span>
                          {isConfirmingDel ? (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={deletingPortalId === p.id}
                                onClick={() => void handleRemovePortalFromApp(p)}
                                title="Eliminar acceso y marcar apertura externa"
                                className="px-1.5 py-0.5 rounded bg-rose-600 text-[10px] font-semibold text-white cursor-pointer"
                              >
                                Borrar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePortalId(null)}
                                title="Cancelar"
                                className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => navigateToPortal(p, true)}
                                title={`Abrir ${p.name} en nueva pestaña`}
                                className="p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-sky-500 cursor-pointer shrink-0"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                              {canDeletePortal && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePortalId(p.id)}
                                  title="Eliminar acceso directo y marcar para apertura externa exclusiva"
                                  className="p-0.5 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add custom portal + local PDF opener + Shortcut manager */}
      <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
        <button
          type="button"
          onClick={() => pdfFileInputRef.current?.click()}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/50 cursor-pointer whitespace-nowrap"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Abrir PDF en Visor</span>
        </button>
        <input
          ref={pdfFileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleLocalPdfSelected}
        />

        {onOpenManager && (
          <button
            type="button"
            onClick={onOpenManager}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/50 cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Administrar accesos directos</span>
          </button>
        )}

        {!addingCustomPortal ? (
          <button
            type="button"
            onClick={() => setAddingCustomPortal(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-sky-500/50 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar enlace propio</span>
          </button>
        ) : (
          <form onSubmit={(e) => void handleSaveCustomPortal(e)} className="space-y-1.5 pt-1">
            <input
              type="text"
              required
              value={customPortalName}
              onChange={(e) => setCustomPortalName(e.target.value)}
              placeholder="Nombre del sitio"
              className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1 text-xs"
            />
            <input
              type="url"
              required
              value={customPortalUrl}
              onChange={(e) => setCustomPortalUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1 text-xs"
            />
            <div className="flex gap-1">
              <button
                type="submit"
                className="flex-1 rounded bg-sky-600 py-1 text-[11px] font-semibold text-white cursor-pointer"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setAddingCustomPortal(false)}
                className="rounded border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  // Modality Label (NEVER claim integrated if opened externally!)
  const renderModalityText = (tab: BrowserTab | null) => {
    if (!tab) return null;
    if (tab.modality === 'pdf_local') {
      return (
        <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
          Visor PDF Integrado
        </span>
      );
    }
    if (tab.modality === 'integrado') {
      return (
        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          Modalidad: Integrado
        </span>
      );
    }
    if (tab.modality === 'externo_abierto') {
      return (
        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
          Portal abierto externamente
        </span>
      );
    }
    return (
      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
        Modalidad: Externo
      </span>
    );
  };

  return (
    <div ref={browserContainerRef} className="space-y-3">
      {/* Top Identity + Return to FABRO + Extra Tabs */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-600/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {subtitle} · Perfil: <strong className="text-slate-700 dark:text-slate-200">{activeProfile?.name}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {headerExtraActions}
          <button
            type="button"
            onClick={() => setActiveSection('estudio-panel')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Regresar a Educación</span>
          </button>
        </div>
      </div>

      {/* Main Browser Frame */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden flex flex-col min-h-[660px] lg:h-[calc(100dvh-13rem)]">
        {/* 1. TOP MULTI-TAB BAR */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#090D16] px-2 pt-1.5 flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = resolvePortalIcon(tab.iconName);
            const active = activeTab?.id === tab.id;
            return (
              <div
                key={tab.id}
                className={`group flex items-center gap-1.5 rounded-t-lg border-x border-t px-2.5 py-1.5 text-xs min-w-[130px] max-w-[210px] shrink-0 transition-colors ${
                  active
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0C121E] text-slate-900 dark:text-white font-semibold'
                    : 'border-transparent bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveTabId(tab.id);
                    if (window.fabroElectronBridge?.switchTab) {
                      void window.fabroElectronBridge.switchTab(tab.id);
                    }
                  }}
                  className="flex-1 min-w-0 flex items-center gap-1.5 text-left cursor-pointer"
                >
                  {tab.isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500 shrink-0" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                  )}
                  <span className="truncate">{tab.title}</span>
                </button>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    tab.modality === 'integrado' || tab.modality === 'pdf_local'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                  title={
                    tab.modality === 'externo_abierto'
                      ? 'Portal abierto externamente'
                      : tab.modality === 'integrado'
                      ? 'Integrado en FABRO'
                      : 'Apertura externa'
                  }
                />
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleCloseTab(tab.id)}
                    aria-label={`Cerrar pestaña ${tab.title}`}
                    className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={handleNewTab}
            title="Abrir nueva pestaña"
            className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer shrink-0 mb-0.5"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* 2. BROWSER NAVIGATION & OMNIBOX BAR */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C121E] px-2.5 py-2 flex flex-wrap items-center gap-1.5">
          {/* Nav Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <Menu className="w-3.5 h-3.5" />
              <span>Portales</span>
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpenDesktop((v) => !v)}
              title={sidebarOpenDesktop ? 'Ocultar panel lateral' : 'Mostrar panel lateral'}
              className="hidden lg:inline-flex p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {sidebarOpenDesktop ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              disabled={!activeTab || activeTab.historyIndex <= 0}
              onClick={handleBack}
              title="Atrás"
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!activeTab || activeTab.historyIndex >= activeTab.historyStack.length - 1}
              onClick={handleForward}
              title="Adelante"
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-35 cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReload}
              title="Recargar"
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-sky-600 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleGoHome}
              title="Inicio"
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-sky-600 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Omnibox Address & Search Bar with HTTPS Security Indicator */}
          <form
            onSubmit={handleOmniboxSubmit}
            className="flex-1 min-w-[200px] flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1 focus-within:border-sky-500"
          >
            <span
              title={activeUrlCheck.securityLabel}
              className={`shrink-0 ${
                activeUrlCheck.isHttps
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {activeUrlCheck.isHttps ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
            </span>
            <input
              type="text"
              value={omniboxValue}
              onChange={(e) => setOmniboxValue(e.target.value)}
              placeholder={`Ingresá URL https:// o buscá con ${SEARCH_ENGINE_TEMPLATES[settings.defaultSearchEngine].name}...`}
              className="flex-1 min-w-0 bg-transparent text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none py-0.5"
            />
            {activeTab && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(activeTab.url);
                  setCopiedUrl(true);
                  window.setTimeout(() => setCopiedUrl(false), 1600);
                }}
                title="Copiar dirección"
                className="p-1 text-slate-400 hover:text-sky-500 cursor-pointer shrink-0"
              >
                {copiedUrl ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </form>

          {/* Browser Tools Cluster */}
          <div className="flex items-center gap-1 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={toggleCurrentFavorite}
              title={isCurrentFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              className={`p-1.5 rounded-md border cursor-pointer ${
                isCurrentFavorite
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isCurrentFavorite ? 'fill-amber-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveToolDrawer((d) => (d === 'favorites' ? null : 'favorites'))
              }
              title="Carpetas de Favoritos"
              className={`p-1.5 rounded-md border cursor-pointer ${
                activeToolDrawer === 'favorites'
                  ? 'border-sky-500 bg-sky-600/10 text-sky-600 dark:text-sky-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveToolDrawer((d) => (d === 'history' ? null : 'history'))}
              title="Historial de navegación"
              className={`p-1.5 rounded-md border cursor-pointer ${
                activeToolDrawer === 'history'
                  ? 'border-sky-500 bg-sky-600/10 text-sky-600 dark:text-sky-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveToolDrawer((d) => (d === 'downloads' ? null : 'downloads'))
              }
              title="Administrador de descargas"
              className={`relative p-1.5 rounded-md border cursor-pointer ${
                activeToolDrawer === 'downloads'
                  ? 'border-sky-500 bg-sky-600/10 text-sky-600 dark:text-sky-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              {downloads.length > 0 && (
                <span className="ml-0.5 font-mono text-[10px] font-bold">
                  {downloads.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveToolDrawer((d) => (d === 'profiles' ? null : 'profiles'))
              }
              title="Perfiles de navegación"
              className={`p-1.5 rounded-md border cursor-pointer ${
                activeToolDrawer === 'profiles'
                  ? 'border-sky-500 bg-sky-600/10 text-sky-600 dark:text-sky-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveToolDrawer((d) => (d === 'settings' ? null : 'settings'))
              }
              title="Configuración y privacidad del navegador"
              className={`p-1.5 rounded-md border cursor-pointer ${
                activeToolDrawer === 'settings'
                  ? 'border-sky-500 bg-sky-600/10 text-sky-600 dark:text-sky-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
              className="hidden sm:inline-flex p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>

            {settings.enableAiAssistant && (
              <button
                type="button"
                onClick={() => setAiDrawerOpen((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer ${
                  aiDrawerOpen
                    ? 'border-sky-500 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-sky-500/50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden md:inline">FABRO AI</span>
              </button>
            )}

            {activeTab && activeTab.modality !== 'pdf_local' && (
              <a
                href={activeTab.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleMarkOpenedExternally(activeTab)}
                className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 whitespace-nowrap"
              >
                <span>Abrir portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* 3. HONEST MODALITY & SECURITY STATUS STRIP */}
        {activeTab && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0C121E] px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 flex-wrap">
              {renderModalityText(activeTab)}
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-600 dark:text-slate-300">
                {activeTab.modality === 'externo_abierto'
                  ? `Abierto en nueva pestaña (${formatProbeDate(activeTab.openedExternallyAt)}). FABRO sigue activo acá.`
                  : activeTab.statusMessage ||
                    (activeTab.modality === 'integrado'
                      ? 'El sitio admite visualización integrada.'
                      : 'Este sitio requiere abrirse en pestaña oficial externa.')}
              </span>
              {omniboxError && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="text-rose-600 dark:text-rose-400 font-medium">{omniboxError}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 text-slate-500 dark:text-slate-400">
              {activeTab.modality === 'integrado' && (
                <>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setTabs((prev) =>
                          prev.map((t) =>
                            t.id === activeTab.id
                              ? { ...t, zoomPercent: Math.max(70, t.zoomPercent - 10) }
                              : t
                          )
                        )
                      }
                      className="p-0.5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <ZoomOut className="w-3 h-3" />
                    </button>
                    <span className="font-mono tabular-nums">{activeTab.zoomPercent}%</span>
                    <button
                      type="button"
                      onClick={() =>
                        setTabs((prev) =>
                          prev.map((t) =>
                            t.id === activeTab.id
                              ? { ...t, zoomPercent: Math.min(150, t.zoomPercent + 10) }
                              : t
                          )
                        )
                      }
                      className="p-0.5 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleFlagActiveTabExternalOnly(activeTab, false)}
                    className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 cursor-pointer whitespace-nowrap"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>¿No carga en iframe? Solo externo</span>
                  </button>
                  {onMarkExternalOnly && (
                    <button
                      type="button"
                      onClick={() => void handleFlagActiveTabExternalOnly(activeTab, true)}
                      className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 cursor-pointer whitespace-nowrap"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Eliminar acceso</span>
                    </button>
                  )}
                </>
              )}
              <a
                href={getTranslateServiceUrl(activeTab.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-sky-600 dark:hover:text-sky-400 whitespace-nowrap"
              >
                Traducir página
              </a>
            </div>
          </div>
        )}

        {/* 4. MAIN WORKSPACE ROW: Portal Sidebar + Browser Viewport + Optional Tool/AI Drawer */}
        <div className="flex-1 min-h-0 flex relative overflow-hidden">
          {/* Desktop Left Portals Sidebar */}
          {sidebarOpenDesktop && (
            <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C121E]">
              {renderPortalSidebar()}
            </aside>
          )}

          {/* Mobile Drawer Portals Sidebar */}
          {mobileSidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex bg-black/60">
              <div className="w-72 max-w-[85vw] h-full bg-white dark:bg-[#0C121E] border-r border-slate-200 dark:border-slate-800 flex flex-col">
                <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Portales ({filteredPortals.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1 text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {renderPortalSidebar()}
              </div>
            </div>
          )}

          {/* CENTRAL VIEWPORT */}
          <div className="flex-1 min-w-0 flex flex-col bg-slate-50 dark:bg-[#090D16] relative">
            {!activeTab ? (
              <div className="flex-1 flex items-center justify-center p-10 text-xs text-slate-500">
                Seleccioná un portal o abrí una pestaña nueva.
              </div>
            ) : activeTab.modality === 'pdf_local' ? (
              <LocalPdfViewer
                fileName={activeTab.pdfFileName || activeTab.title || 'documento.pdf'}
                fileDataUrl={activeTab.pdfDataUrl}
                remoteUrl={activeTab.pdfDataUrl ? undefined : activeTab.url}
                onSendToDocuments={handleSendPdfToDocuments}
                onSaveDownload={(fn, url) => void startSafeDownload(url, fn)}
              />
            ) : activeTab.modality === 'integrado' ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Only render iframe when portal genuinely permits framing (ZERO useless retries!) */}
                <div
                  className="flex-1 min-h-0 overflow-auto bg-white"
                  style={
                    activeTab.zoomPercent !== 100
                      ? { zoom: `${activeTab.zoomPercent}%` }
                      : undefined
                  }
                >
                  <iframe
                    key={`${activeTab.id}_${activeTab.url}_${reloadNonce}`}
                    src={activeTab.url}
                    title={activeTab.title}
                    className="w-full h-full min-h-[500px] border-0 bg-white"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </div>
            ) : (
              /* ZERO IFRAME ATTEMPTS FOR BLOCKED PORTALS — Clean External Navigation Workspace */
              <div className="flex-1 flex items-center justify-center p-5 sm:p-8 overflow-y-auto">
                <div className="max-w-xl w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-6 sm:p-7 space-y-5">
                  <div className="flex items-start gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      {activeTab.modality === 'externo_abierto' ? (
                        <ExternalLink className="w-5 h-5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5" />
                      )}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                          {activeTab.title}
                        </h3>
                        <span className="text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {activeTab.modality === 'externo_abierto'
                            ? '· Portal abierto externamente'
                            : '· Modalidad: Externo'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {activeTab.modality === 'externo_abierto'
                          ? 'El portal se abrió en su propia pestaña oficial para respetar sus políticas de seguridad y permitirte iniciar sesión con tu cuenta sin bloqueos. Esta ventana de FABRO permanece lista para que cambies de herramienta o trabajes con FABRO AI.'
                          : 'Este portal oficial bloquea la incrustación en marcos web mediante Content-Security-Policy (frame-ancestors) o X-Frame-Options. Para evitar pantallas en blanco o errores técnicos, FABRO lo abre en una pestaña directa con tu propia sesión.'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3.5 space-y-1.5 text-[11px]">
                    <div className="font-mono text-slate-700 dark:text-slate-200 break-all">
                      URL: {activeTab.url}
                    </div>
                    <div className="text-slate-500 dark:text-slate-400">
                      Web: Apertura externa directa · Escritorio Windows: WebContentsView nativo · Android: WebView / Chrome Custom Tabs
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href={activeTab.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleMarkOpenedExternally(activeTab)}
                      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 whitespace-nowrap"
                    >
                      <span>
                        {activeTab.modality === 'externo_abierto'
                          ? 'VOLVER A ABRIR PORTAL EXTERNO'
                          : 'ABRIR PORTAL'}
                      </span>
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    <button
                      type="button"
                      onClick={() => setAiDrawerOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/50 cursor-pointer whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                      <span>Trabajar respuesta en FABRO AI</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void startSafeDownload(activeTab.url)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-sky-500/50 cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar recurso</span>
                    </button>

                    {(() => {
                      const activePortal = portals.find((p) => p.id === activeTab.portalId);
                      const canRemove =
                        activePortal && (Boolean(onMarkExternalOnly) || !activePortal.isSystem || isAdmin);
                      if (!canRemove) return null;
                      if (confirmDeletePortalId === activePortal.id) {
                        return (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={deletingPortalId === activePortal.id}
                              onClick={() => void handleRemovePortalFromApp(activePortal)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer whitespace-nowrap"
                            >
                              {deletingPortalId === activePortal.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Confirmar eliminación</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePortalId(null)}
                              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePortalId(activePortal.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>
                            {activePortal.isSystem
                              ? 'Eliminar acceso (solo externo)'
                              : 'Eliminar enlace propio'}
                          </span>
                        </button>
                      );
                    })()}
                  </div>

                  {/* Quick Switch Strip to jump cleanly between portals */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Cambiar rápidamente de portal:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {portals.slice(0, 8).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => navigateToPortal(p, false)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                            activeTab.portalId === p.id
                              ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-sky-500/50'
                          }`}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SLIDE-OVER TOOL DRAWERS: Favorites, History, Downloads, Profiles, Settings */}
            {activeToolDrawer && (
              <div className="absolute inset-y-0 right-0 z-30 w-full sm:w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C121E] shadow-2xl flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    {activeToolDrawer === 'favorites' && 'Favoritos y Carpetas'}
                    {activeToolDrawer === 'history' && 'Historial de Navegación'}
                    {activeToolDrawer === 'downloads' && 'Administrador de Descargas'}
                    {activeToolDrawer === 'profiles' && 'Perfiles Independientes'}
                    {activeToolDrawer === 'settings' && 'Configuración y Privacidad'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveToolDrawer(null)}
                    className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  {/* FAVORITES MANAGER */}
                  {activeToolDrawer === 'favorites' && (
                    <>
                      <form onSubmit={handleCreateFavoriteFolder} className="flex gap-1.5">
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Nueva carpeta de favoritos..."
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                          <span>Crear</span>
                        </button>
                      </form>

                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedFavFolder('all')}
                          className={`rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer ${
                            selectedFavFolder === 'all'
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          Todos ({favorites.length})
                        </button>
                        {favFolders.map((fld) => (
                          <button
                            key={fld.id}
                            type="button"
                            onClick={() => setSelectedFavFolder(fld.id)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium cursor-pointer ${
                              selectedFavFolder === fld.id
                                ? 'bg-sky-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <Folder className="w-3 h-3" />
                            <span>{fld.name}</span>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-2">
                        {favorites
                          .filter((f) => selectedFavFolder === 'all' || f.folderId === selectedFavFolder)
                          .map((fav) => (
                            <div
                              key={fav.id}
                              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-2.5 space-y-1.5"
                            >
                              {editingFavId === fav.id ? (
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={editingFavTitle}
                                    onChange={(e) => setEditingFavTitle(e.target.value)}
                                    className="flex-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0C121E] px-2 py-1 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFavorites((prev) =>
                                        prev.map((x) =>
                                          x.id === fav.id ? { ...x, title: editingFavTitle.trim() || x.title } : x
                                        )
                                      );
                                      setEditingFavId(null);
                                    }}
                                    className="rounded bg-sky-600 px-2 py-1 text-[11px] text-white cursor-pointer"
                                  >
                                    OK
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const match = portals.find((p) => p.url === fav.url);
                                      if (match) navigateToPortal(match, false);
                                      else {
                                        setOmniboxValue(fav.url);
                                      }
                                      setActiveToolDrawer(null);
                                    }}
                                    className="text-left min-w-0 flex-1 cursor-pointer"
                                  >
                                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                                      {fav.title}
                                    </p>
                                    <p className="text-[10px] font-mono text-slate-500 truncate">
                                      {fav.url}
                                    </p>
                                  </button>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingFavId(fav.id);
                                        setEditingFavTitle(fav.title);
                                      }}
                                      className="text-[10px] text-sky-600 hover:underline cursor-pointer"
                                    >
                                      Renombrar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setFavorites((prev) => prev.filter((x) => x.id !== fav.id))
                                      }
                                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                              <select
                                value={fav.folderId}
                                onChange={(e) =>
                                  setFavorites((prev) =>
                                    prev.map((x) =>
                                      x.id === fav.id ? { ...x, folderId: e.target.value } : x
                                    )
                                  )
                                }
                                className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0C121E] px-2 py-1 text-[11px]"
                              >
                                {favFolders.map((fld) => (
                                  <option key={fld.id} value={fld.id}>
                                    Carpeta: {fld.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                      </div>
                    </>
                  )}

                  {/* HISTORY MANAGER */}
                  {activeToolDrawer === 'history' && (
                    <>
                      <div className="space-y-2">
                        <input
                          type="search"
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          placeholder="Buscar por título o URL..."
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex gap-1">
                            {(
                              [
                                { id: 'all', label: 'Todo' },
                                { id: 'today', label: 'Hoy' },
                                { id: 'week', label: '7 días' },
                              ] as const
                            ).map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => setHistoryDateFilter(d.id)}
                                className={`rounded px-2 py-1 text-[11px] font-medium cursor-pointer ${
                                  historyDateFilter === d.id
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                          {history.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setHistory([])}
                              className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                            >
                              Borrar historial
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {filteredHistory.length === 0 ? (
                          <p className="text-slate-500 text-center py-6">Sin registros.</p>
                        ) : (
                          filteredHistory.map((h) => (
                            <div
                              key={h.id}
                              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-2.5"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  const match = portals.find((p) => p.url === h.url);
                                  if (match) navigateToPortal(match, false);
                                  else setOmniboxValue(h.url);
                                  setActiveToolDrawer(null);
                                }}
                                className="flex-1 min-w-0 text-left cursor-pointer"
                              >
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {h.title}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500 truncate">{h.url}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {formatProbeDate(h.visitedAt)}
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setHistory((prev) => prev.filter((item) => item.id !== h.id))
                                }
                                className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {/* DOWNLOADS MANAGER */}
                  {activeToolDrawer === 'downloads' && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Protección activa contra archivos ejecutables peligrosos.
                        </p>
                        {downloads.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setDownloads([])}
                            className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>

                      {downloads.length === 0 ? (
                        <p className="text-slate-500 text-center py-6">
                          No hay descargas recientes en este perfil.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {downloads.map((dl) => (
                            <div
                              key={dl.id}
                              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-2.5 space-y-1.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                                    {dl.filename}
                                  </p>
                                  <p className="text-[10px] font-mono text-slate-500 truncate">
                                    {dl.status} · {dl.progressPercent}%
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDownloads((prev) => prev.filter((d) => d.id !== dl.id))
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              {dl.safetyNote && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                  {dl.safetyNote}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap">
                                {dl.localObjectUrl && isPdfResource(dl.filename, dl.mimeType) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const pdfTab: BrowserTab = {
                                        id: makeId('tab'),
                                        portalId: '',
                                        title: dl.filename,
                                        url: dl.localObjectUrl!,
                                        iconName: 'FileText',
                                        isLoading: false,
                                        errorMessage: '',
                                        modality: 'pdf_local',
                                        profileId: activeProfile?.id || 'default',
                                        historyStack: [dl.localObjectUrl!],
                                        historyIndex: 0,
                                        zoomPercent: 100,
                                        readerMode: false,
                                        pdfDataUrl: dl.localObjectUrl,
                                        pdfFileName: dl.filename,
                                        iframeAllowed: true,
                                        requiresExternal: false,
                                      };
                                      setTabs((prev) => [...prev, pdfTab]);
                                      setActiveTabId(pdfTab.id);
                                      setActiveToolDrawer(null);
                                    }}
                                    className="text-[11px] font-semibold text-sky-600 hover:underline cursor-pointer"
                                  >
                                    Abrir en Visor PDF
                                  </button>
                                )}
                                <a
                                  href={dl.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-slate-600 dark:text-slate-300 hover:underline"
                                >
                                  Abrir enlace directo
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* PROFILES MANAGER */}
                  {activeToolDrawer === 'profiles' && (
                    <>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Cada perfil mantiene sus propias pestañas, favoritos, historial, configuración y partición de sesión aislada (sin compartir cookies entre usuarios).
                      </p>

                      <div className="space-y-1.5">
                        {profiles.map((prof) => {
                          const isCurrent = prof.id === activeProfile?.id;
                          return (
                            <div
                              key={prof.id}
                              className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${
                                isCurrent
                                  ? 'border-sky-500 bg-sky-500/10'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveProfileId(prof.id);
                                  setTabs([]);
                                }}
                                className="flex-1 text-left cursor-pointer min-w-0"
                              >
                                <p className="font-semibold text-slate-900 dark:text-white truncate">
                                  {prof.name}
                                </p>
                                <p className="text-[10px] font-mono text-slate-500 truncate">
                                  Partición: {prof.partitionKey}
                                </p>
                              </button>
                              {isCurrent && (
                                <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                                  Activo
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <form onSubmit={handleCreateProfile} className="flex gap-1.5">
                        <input
                          type="text"
                          value={newProfileName}
                          onChange={(e) => setNewProfileName(e.target.value)}
                          placeholder="Nuevo perfil (ej: Tesis)..."
                          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                        >
                          Crear
                        </button>
                      </form>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <button
                          type="button"
                          onClick={handleClearProfileBrowsingData}
                          className="w-full rounded-lg border border-rose-500/40 bg-rose-500/10 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                        >
                          Borrar datos locales de navegación de este perfil
                        </button>
                      </div>
                    </>
                  )}

                  {/* SETTINGS & PRIVACY */}
                  {activeToolDrawer === 'settings' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block font-semibold text-slate-800 dark:text-slate-200">
                          Motor de búsqueda predeterminado
                        </label>
                        <select
                          value={settings.defaultSearchEngine}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              defaultSearchEngine: e.target.value as DefaultSearchEngineId,
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs"
                        >
                          <option value="google">Google</option>
                          <option value="duckduckgo">DuckDuckGo</option>
                          <option value="bing">Bing</option>
                          <option value="scholar">Google Académico</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block font-semibold text-slate-800 dark:text-slate-200">
                          Página de inicio
                        </label>
                        <input
                          type="url"
                          value={settings.homePageUrl}
                          onChange={(e) =>
                            setSettings((s) => ({ ...s, homePageUrl: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Apariencia (clara u oscura)</span>
                        <button
                          type="button"
                          onClick={toggleTheme}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium cursor-pointer"
                        >
                          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                          <span>{theme === 'dark' ? 'Tema Oscuro' : 'Tema Claro'}</span>
                        </button>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          Privacidad, Seguridad y FABRO IA
                        </p>
                        {(
                          [
                            {
                              key: 'blockDangerousDownloads',
                              label: 'Bloquear descargas potencialmente peligrosas (.exe, .bat, .ps1)',
                            },
                            {
                              key: 'blockUnauthorizedPopups',
                              label: 'Bloquear ventanas emergentes no autorizadas',
                            },
                            {
                              key: 'httpsOnlyWarning',
                              label: 'Mostrar advertencia en conexiones HTTP sin cifrado',
                            },
                            {
                              key: 'enableAiAssistant',
                              label: 'Habilitar panel lateral FABRO AI Assistant',
                            },
                          ] as const
                        ).map((opt) => (
                          <label key={opt.key} className="flex items-start gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings[opt.key]}
                              onChange={(e) =>
                                setSettings((s) => ({ ...s, [opt.key]: e.target.checked }))
                              }
                              className="mt-0.5"
                            />
                            <span className="text-slate-700 dark:text-slate-300">{opt.label}</span>
                          </label>
                        ))}
                      </div>

                      {/* Per-Origin Site Permissions */}
                      {activeUrlCheck.hostname && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            Permisos del sitio ({activeUrlCheck.hostname})
                          </p>
                          {(() => {
                            const origin = activeUrlCheck.hostname;
                            const current: SitePermissionRecord = permissions.find(
                              (p) => p.origin === origin
                            ) || {
                              origin,
                              camera: 'ask',
                              microphone: 'ask',
                              geolocation: 'ask',
                              popups: 'block',
                              downloads: 'ask',
                            };
                            const updatePerm = (
                              field: keyof Omit<SitePermissionRecord, 'origin'>,
                              value: string
                            ) => {
                              setPermissions((prev) => {
                                const exists = prev.some((p) => p.origin === origin);
                                const updated = { ...current, [field]: value } as SitePermissionRecord;
                                return exists
                                  ? prev.map((p) => (p.origin === origin ? updated : p))
                                  : [updated, ...prev];
                              });
                            };
                            return (
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <label className="space-y-0.5">
                                  <span className="text-slate-500">Cámara</span>
                                  <select
                                    value={current.camera}
                                    onChange={(e) => updatePerm('camera', e.target.value)}
                                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1"
                                  >
                                    <option value="ask">Preguntar</option>
                                    <option value="allow">Permitir</option>
                                    <option value="deny">Bloquear</option>
                                  </select>
                                </label>
                                <label className="space-y-0.5">
                                  <span className="text-slate-500">Micrófono</span>
                                  <select
                                    value={current.microphone}
                                    onChange={(e) => updatePerm('microphone', e.target.value)}
                                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1"
                                  >
                                    <option value="ask">Preguntar</option>
                                    <option value="allow">Permitir</option>
                                    <option value="deny">Bloquear</option>
                                  </select>
                                </label>
                                <label className="space-y-0.5">
                                  <span className="text-slate-500">Ubicación</span>
                                  <select
                                    value={current.geolocation}
                                    onChange={(e) => updatePerm('geolocation', e.target.value)}
                                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1"
                                  >
                                    <option value="ask">Preguntar</option>
                                    <option value="allow">Permitir</option>
                                    <option value="deny">Bloquear</option>
                                  </select>
                                </label>
                                <label className="space-y-0.5">
                                  <span className="text-slate-500">Emergentes</span>
                                  <select
                                    value={current.popups}
                                    onChange={(e) => updatePerm('popups', e.target.value)}
                                    className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1"
                                  >
                                    <option value="block">Bloquear</option>
                                    <option value="allow">Permitir</option>
                                  </select>
                                </label>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Acceso al perfil y cuenta FABRO</span>
                          <button
                            type="button"
                            onClick={() => setActiveSection('perfil')}
                            className="text-sky-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Ver Perfil</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearProfileBrowsingData}
                          className="w-full rounded-lg border border-rose-500/40 bg-rose-500/10 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                        >
                          Limpiar historial y descargas locales
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 5. COLLAPSIBLE FABRO AI ASSISTANT PANEL (Voluntary user-shared text ONLY) */}
          {aiDrawerOpen && settings.enableAiAssistant && (
            <aside className="w-full xl:w-96 shrink-0 border-t xl:border-t-0 xl:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C121E] flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-sky-500" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      FABRO AI ASSISTANT
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Solo procesa el contenido que pegues voluntariamente
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
                <textarea
                  rows={4}
                  value={aiTextA}
                  onChange={(e) => setAiTextA(e.target.value)}
                  placeholder="Pegá acá el fragmento de página, texto o respuesta que decidís compartir con FABRO IA..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />

                <textarea
                  rows={2}
                  value={aiTextB}
                  onChange={(e) => setAiTextB(e.target.value)}
                  placeholder="Opcional: segundo texto para comparar información..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
                />

                <div className="flex flex-wrap gap-1">
                  {AI_ASSISTANT_TASKS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={aiRunning}
                      onClick={() => void handleRunAiAssistant(t.id)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                        aiTask === t.id && aiOutput
                          ? 'border-sky-500 bg-sky-600 text-white'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-200 hover:border-sky-500/60'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {aiRunning && (
                  <div className="flex items-center gap-2 py-2 text-sky-600 dark:text-sky-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Procesando con FABRO IA...</span>
                  </div>
                )}

                {aiError && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-700 dark:text-rose-300">
                    {aiError}
                  </div>
                )}

                {aiNotice && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                    {aiNotice}
                  </div>
                )}

                {aiOutput && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sky-600 dark:text-sky-400">Resultado</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleSaveAiToNotes()}
                          className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F1623] px-2 py-1 text-[11px] font-semibold cursor-pointer"
                        >
                          <FilePlus2 className="w-3 h-3" />
                          <span>Guardar en Apuntes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            exportMarkdownToPdf({
                              title: `FABRO AI · ${activeTab?.title || 'Navegador'}`,
                              subjectName: activeSubject?.name,
                              sourceUrls: activeTab
                                ? [{ title: activeTab.title, url: activeTab.url }]
                                : undefined,
                              markdown: aiOutput,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </div>
                    <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {aiOutput}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
