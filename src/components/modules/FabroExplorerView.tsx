import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { usePlatform } from '../../context/PlatformContext';
import { authFetch } from '../../lib/apiClient';
import type {
  ExternalOnlyRule,
  ModuleHomeConfig,
  PortalCategory,
  PortalEntry,
} from '../../types/fabro';
import { FabroBrowserWorkspace } from '../browser/FabroBrowserWorkspace';
import {
  PortalAdminManager,
  type UserShortcutActionPayload,
} from '../common/PortalAdminManager';

interface PortalsSnapshotResponse {
  categories: PortalCategory[];
  portals: PortalEntry[];
  homeConfig?: ModuleHomeConfig;
  externalOnlyRules?: ExternalOnlyRule[];
  userPrefs?: {
    customPortals: PortalEntry[];
    hiddenPortalIds?: string[];
    externalOnlyPortalIds?: string[];
    externalOnlyRules?: ExternalOnlyRule[];
  };
}

interface GuestShortcutState {
  hiddenPortalIds: string[];
  externalOnlyPortalIds: string[];
  externalOnlyRules: ExternalOnlyRule[];
}

const GUEST_SHORTCUT_KEY = 'fabro_explorer_guest_shortcuts_v1';

function readGuestShortcuts(): GuestShortcutState {
  try {
    const raw = localStorage.getItem(GUEST_SHORTCUT_KEY);
    if (!raw) {
      return { hiddenPortalIds: [], externalOnlyPortalIds: [], externalOnlyRules: [] };
    }
    const parsed = JSON.parse(raw) as Partial<GuestShortcutState>;
    return {
      hiddenPortalIds: Array.isArray(parsed.hiddenPortalIds) ? parsed.hiddenPortalIds : [],
      externalOnlyPortalIds: Array.isArray(parsed.externalOnlyPortalIds)
        ? parsed.externalOnlyPortalIds
        : [],
      externalOnlyRules: Array.isArray(parsed.externalOnlyRules) ? parsed.externalOnlyRules : [],
    };
  } catch {
    return { hiddenPortalIds: [], externalOnlyPortalIds: [], externalOnlyRules: [] };
  }
}

function getHostnameSafe(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function matchesRule(portal: PortalEntry, rules: ExternalOnlyRule[]): boolean {
  const host = getHostnameSafe(portal.url);
  return rules.some(
    (r) =>
      (r.portalId && r.portalId === portal.id) ||
      r.url === portal.url ||
      (host && r.hostname && r.hostname === host)
  );
}

export const FabroExplorerView: React.FC = () => {
  const { user } = useFabro();
  const { isAdmin } = usePlatform();

  const [mode, setMode] = useState<'browser' | 'admin'>('browser');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [categories, setCategories] = useState<PortalCategory[]>([]);
  const [systemPortals, setSystemPortals] = useState<PortalEntry[]>([]);
  const [customPortals, setCustomPortals] = useState<PortalEntry[]>([]);
  const [homeConfig, setHomeConfig] = useState<ModuleHomeConfig | undefined>(undefined);
  const [globalExternalRules, setGlobalExternalRules] = useState<ExternalOnlyRule[]>([]);
  const [userHiddenIds, setUserHiddenIds] = useState<string[]>([]);
  const [userExternalIds, setUserExternalIds] = useState<string[]>([]);
  const [userExternalRules, setUserExternalRules] = useState<ExternalOnlyRule[]>([]);
  const [guestState, setGuestState] = useState<GuestShortcutState>(() => readGuestShortcuts());

  const loadSnapshot = useCallback(async () => {
    setErrorMsg('');
    try {
      const endpoint = user
        ? `/api/portals/me/explorer${isAdmin ? '?includeInactive=true' : ''}`
        : '/api/portals/explorer';
      const resp = user ? await authFetch(endpoint) : await fetch(endpoint);
      if (!resp.ok) throw new Error('No se pudieron cargar los portales.');
      const data = (await resp.json()) as PortalsSnapshotResponse;

      setCategories(data.categories || []);
      setSystemPortals(data.portals || []);
      setCustomPortals(data.userPrefs?.customPortals || []);
      setHomeConfig(data.homeConfig);
      setGlobalExternalRules(data.externalOnlyRules || []);
      setUserHiddenIds(data.userPrefs?.hiddenPortalIds || []);
      setUserExternalIds(data.userPrefs?.externalOnlyPortalIds || []);
      setUserExternalRules(data.userPrefs?.externalOnlyRules || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error cargando portales.');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    try {
      localStorage.setItem(GUEST_SHORTCUT_KEY, JSON.stringify(guestState));
    } catch {
      // ignore storage errors
    }
  }, [guestState]);

  const effectiveHiddenIds = useMemo(
    () => (user ? userHiddenIds : guestState.hiddenPortalIds),
    [user, userHiddenIds, guestState.hiddenPortalIds]
  );

  const effectiveExternalIds = useMemo(
    () => (user ? userExternalIds : guestState.externalOnlyPortalIds),
    [user, userExternalIds, guestState.externalOnlyPortalIds]
  );

  const combinedExternalRules = useMemo(() => {
    const userRules = user ? userExternalRules : guestState.externalOnlyRules;
    const seen = new Set<string>();
    const merged: ExternalOnlyRule[] = [];
    for (const r of [...userRules, ...globalExternalRules]) {
      const key = `${r.portalId || ''}|${r.url}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(r);
      }
    }
    return merged;
  }, [user, userExternalRules, guestState.externalOnlyRules, globalExternalRules]);

  const knownAllPortals = useMemo(() => {
    const activeSystem = systemPortals.filter((p) => p.active);
    const externalSet = new Set(effectiveExternalIds);
    return [...customPortals, ...activeSystem].map((p) => {
      if (externalSet.has(p.id) || matchesRule(p, combinedExternalRules)) {
        return {
          ...p,
          compatibilityStatus: 'external_required' as const,
          openingMode: 'apertura_externa' as const,
          iframeAllowed: false,
          requiresExternal: true,
          statusMessage:
            'Marcado para apertura externa exclusiva (no carga correctamente mediante iframe).',
        };
      }
      return p;
    });
  }, [customPortals, systemPortals, effectiveExternalIds, combinedExternalRules]);

  const browserPortals = useMemo(() => {
    if (isAdmin) return knownAllPortals;
    const hiddenSet = new Set(effectiveHiddenIds);
    return knownAllPortals.filter((p) => !hiddenSet.has(p.id));
  }, [knownAllPortals, isAdmin, effectiveHiddenIds]);

  const handleUserShortcutAction = useCallback(
    async (payload: UserShortcutActionPayload) => {
      if (user) {
        const resp = await authFetch('/api/portals/me/shortcuts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ module: 'explorer', ...payload }),
        });
        const data = (await resp.json()) as {
          error?: string;
          userPrefs?: PortalsSnapshotResponse['userPrefs'];
        };
        if (!resp.ok) {
          throw new Error(data.error || 'No se pudo actualizar el acceso directo.');
        }
        if (data.userPrefs) {
          setCustomPortals(data.userPrefs.customPortals || []);
          setUserHiddenIds(data.userPrefs.hiddenPortalIds || []);
          setUserExternalIds(data.userPrefs.externalOnlyPortalIds || []);
          setUserExternalRules(data.userPrefs.externalOnlyRules || []);
        }
        return;
      }

      // Guest fallback stored locally
      const nowIso = new Date().toISOString();
      setGuestState((prev) => {
        if (payload.action === 'mark_external_only') {
          const rule: ExternalOnlyRule | null = payload.url
            ? {
                module: 'explorer',
                portalId: payload.portalId,
                name: payload.name || payload.url,
                url: payload.url,
                hostname: getHostnameSafe(payload.url),
                reason:
                  payload.reason ||
                  'Marcado para apertura externa exclusiva (no carga mediante iframe).',
                markedAt: nowIso,
              }
            : null;
          return {
            ...prev,
            externalOnlyPortalIds: payload.portalId
              ? Array.from(new Set([...prev.externalOnlyPortalIds, payload.portalId]))
              : prev.externalOnlyPortalIds,
            externalOnlyRules: rule
              ? [rule, ...prev.externalOnlyRules.filter((r) => r.url !== rule.url)]
              : prev.externalOnlyRules,
          };
        }
        if (payload.action === 'remove_shortcut_external') {
          const rule: ExternalOnlyRule | null = payload.url
            ? {
                module: 'explorer',
                portalId: payload.portalId,
                name: payload.name || payload.url,
                url: payload.url,
                hostname: getHostnameSafe(payload.url),
                reason:
                  payload.reason ||
                  'Acceso directo eliminado · apertura externa exclusiva por fallo en iframe.',
                markedAt: nowIso,
              }
            : null;
          return {
            hiddenPortalIds: payload.portalId
              ? Array.from(new Set([...prev.hiddenPortalIds, payload.portalId]))
              : prev.hiddenPortalIds,
            externalOnlyPortalIds: payload.portalId
              ? Array.from(new Set([...prev.externalOnlyPortalIds, payload.portalId]))
              : prev.externalOnlyPortalIds,
            externalOnlyRules: rule
              ? [rule, ...prev.externalOnlyRules.filter((r) => r.url !== rule.url)]
              : prev.externalOnlyRules,
          };
        }
        if (payload.action === 'remove_incompatible_shortcuts') {
          const blocked = knownAllPortals.filter(
            (p) =>
              p.iframeAllowed === false ||
              p.requiresExternal === true ||
              p.compatibilityStatus === 'external_required' ||
              p.compatibilityStatus === 'unreachable'
          );
          const newHidden = Array.from(
            new Set([...prev.hiddenPortalIds, ...blocked.map((p) => p.id)])
          );
          const newExtIds = Array.from(
            new Set([...prev.externalOnlyPortalIds, ...blocked.map((p) => p.id)])
          );
          const newRules: ExternalOnlyRule[] = [
            ...blocked.map((p) => ({
              module: 'explorer' as const,
              portalId: p.id,
              name: p.name,
              url: p.url,
              hostname: getHostnameSafe(p.url),
              reason: p.statusMessage || 'No carga en iframe · apertura externa exclusiva.',
              markedAt: nowIso,
            })),
            ...prev.externalOnlyRules.filter(
              (r) => !blocked.some((b) => b.url === r.url || b.id === r.portalId)
            ),
          ];
          return {
            hiddenPortalIds: newHidden,
            externalOnlyPortalIds: newExtIds,
            externalOnlyRules: newRules,
          };
        }
        if (payload.action === 'restore_shortcut') {
          return {
            ...prev,
            hiddenPortalIds: prev.hiddenPortalIds.filter((id) => id !== payload.portalId),
            externalOnlyPortalIds: payload.clearExternalOnly
              ? prev.externalOnlyPortalIds.filter((id) => id !== payload.portalId)
              : prev.externalOnlyPortalIds,
            externalOnlyRules: payload.clearExternalOnly
              ? prev.externalOnlyRules.filter(
                  (r) => r.portalId !== payload.portalId && r.url !== payload.url
                )
              : prev.externalOnlyRules,
          };
        }
        return {
          ...prev,
          externalOnlyPortalIds: prev.externalOnlyPortalIds.filter(
            (id) => id !== payload.portalId
          ),
          externalOnlyRules: prev.externalOnlyRules.filter(
            (r) => r.portalId !== payload.portalId && r.url !== payload.url
          ),
        };
      });
    },
    [user, knownAllPortals]
  );

  const handleMarkExternalOnlyFromBrowser = useCallback(
    async (params: {
      portalId?: string;
      name: string;
      url: string;
      removeShortcut: boolean;
      reason?: string;
    }) => {
      if (isAdmin && params.portalId) {
        const target = systemPortals.find((p) => p.id === params.portalId);
        if (target?.isSystem) {
          const resp = await authFetch(
            `/api/portals/admin/items/explorer/${params.portalId}/external-only`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                removeShortcut: params.removeShortcut,
                reason:
                  params.reason ||
                  'Marcado para apertura externa exclusiva (no carga correctamente mediante iframe).',
              }),
            }
          );
          if (!resp.ok) {
            throw new Error('No se pudo actualizar el estado del portal.');
          }
          await loadSnapshot();
          return;
        }
      }

      await handleUserShortcutAction({
        action: params.removeShortcut ? 'remove_shortcut_external' : 'mark_external_only',
        portalId: params.portalId,
        name: params.name,
        url: params.url,
        reason: params.reason,
      });
    },
    [isAdmin, systemPortals, loadSnapshot, handleUserShortcutAction]
  );

  const handlePatchPortalProbe = useCallback((portalId: string, patch: Partial<PortalEntry>) => {
    setSystemPortals((prev) =>
      prev.map((item) => (item.id === portalId ? { ...item, ...patch } : item))
    );
    setCustomPortals((prev) =>
      prev.map((item) => (item.id === portalId ? { ...item, ...patch } : item))
    );
  }, []);

  if (mode === 'admin') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
            {isAdmin
              ? 'Administración de Portales · FABRO EXPLORER'
              : 'Administración de Accesos Directos · FABRO EXPLORER'}
          </h2>
          <button
            type="button"
            onClick={() => setMode('browser')}
            className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap"
          >
            Volver al Navegador
          </button>
        </div>
        <PortalAdminManager
          module="explorer"
          portals={isAdmin ? systemPortals : knownAllPortals}
          allKnownPortals={knownAllPortals}
          categories={categories}
          homeConfig={homeConfig}
          externalOnlyRules={combinedExternalRules}
          hiddenPortalIds={effectiveHiddenIds}
          externalOnlyPortalIds={effectiveExternalIds}
          isAdmin={isAdmin}
          onRefresh={loadSnapshot}
          onUserShortcutAction={handleUserShortcutAction}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}
      <FabroBrowserWorkspace
        module="explorer"
        title="FABRO EXPLORER · Navegador Académico y Portales"
        subtitle="Pestañas, perfiles independientes, visor PDF integrado y apertura externa inteligente sin errores de iframe"
        categories={categories}
        portals={browserPortals}
        adminHomeConfig={homeConfig}
        externalOnlyRules={combinedExternalRules}
        loadingPortals={loading}
        onRefreshPortals={loadSnapshot}
        onPatchPortalProbe={handlePatchPortalProbe}
        onMarkExternalOnly={handleMarkExternalOnlyFromBrowser}
        onOpenManager={() => setMode('admin')}
        defaultPortalId={homeConfig?.defaultPortalId || 'exp_wikipedia'}
        headerExtraActions={
          <button
            type="button"
            onClick={() => setMode('admin')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500/50 cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'Administrar portales' : 'Administrar accesos'}</span>
          </button>
        }
      />
    </div>
  );
};

