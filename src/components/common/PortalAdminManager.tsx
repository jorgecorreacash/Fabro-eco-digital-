import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FolderPlus,
  Home,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { authFetch } from '../../lib/apiClient';
import {
  PORTAL_ICON_OPTIONS,
  formatProbeDate,
  getCompatibilityMeta,
  resolvePortalIcon,
} from '../../lib/portalIcons';
import type {
  ExternalOnlyRule,
  ModuleHomeConfig,
  ModuleStartPage,
  PortalCategory,
  PortalEntry,
  PortalModuleId,
} from '../../types/fabro';

export type UserShortcutActionPayload = {
  action:
    | 'mark_external_only'
    | 'remove_shortcut_external'
    | 'remove_incompatible_shortcuts'
    | 'restore_shortcut'
    | 'unmark_external_only';
  portalId?: string;
  url?: string;
  name?: string;
  reason?: string;
  clearExternalOnly?: boolean;
};

interface PortalAdminManagerProps {
  module: PortalModuleId;
  portals: PortalEntry[];
  categories: PortalCategory[];
  homeConfig?: ModuleHomeConfig;
  externalOnlyRules?: ExternalOnlyRule[];
  hiddenPortalIds?: string[];
  externalOnlyPortalIds?: string[];
  allKnownPortals?: PortalEntry[];
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
  onUserShortcutAction?: (payload: UserShortcutActionPayload) => Promise<void>;
}

type CompatFilter = 'all' | 'web_ok' | 'web_blocked' | 'untested';

function isPortalWebBlocked(p: PortalEntry): boolean {
  return (
    p.iframeAllowed === false ||
    p.requiresExternal === true ||
    p.compatibilityStatus === 'external_required' ||
    p.compatibilityStatus === 'unreachable'
  );
}

export const PortalAdminManager: React.FC<PortalAdminManagerProps> = ({
  module,
  portals,
  categories,
  homeConfig,
  externalOnlyRules = [],
  hiddenPortalIds = [],
  externalOnlyPortalIds = [],
  allKnownPortals,
  isAdmin,
  onRefresh,
  onUserShortcutAction,
}) => {
  const [probingAll, setProbingAll] = useState(false);
  const [probingId, setProbingId] = useState<string | null>(null);
  const [busyPortalId, setBusyPortalId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [compatFilter, setCompatFilter] = useState<CompatFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Admin Home & Start Pages Config
  const [homePortalId, setHomePortalId] = useState(homeConfig?.defaultPortalId || '');
  const [homeUrl, setHomeUrl] = useState(homeConfig?.homeUrl || 'https://www.wikipedia.org/');
  const [homeTitle, setHomeTitle] = useState(homeConfig?.homeTitle || 'Inicio');
  const [startPages, setStartPages] = useState<ModuleStartPage[]>(homeConfig?.startPages || []);
  const [selectedStartPortalId, setSelectedStartPortalId] = useState('');
  const [customStartTitle, setCustomStartTitle] = useState('');
  const [customStartUrl, setCustomStartUrl] = useState('');

  useEffect(() => {
    if (!homeConfig) return;
    setHomePortalId(homeConfig.defaultPortalId || '');
    setHomeUrl(homeConfig.homeUrl || '');
    setHomeTitle(homeConfig.homeTitle || 'Inicio');
    setStartPages(homeConfig.startPages || []);
  }, [homeConfig]);

  // Add / Edit Portal Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formCategoryId, setFormCategoryId] = useState(categories[0]?.id || '');
  const [formIconName, setFormIconName] = useState<string>('Globe');
  const [formDescription, setFormDescription] = useState('');
  const [formActive, setFormActive] = useState(true);

  // New category form
  const [newCategoryName, setNewCategoryName] = useState('');

  const sortedPortals = useMemo(
    () => [...portals].sort((a, b) => a.order - b.order),
    [portals]
  );

  const hiddenSet = useMemo(() => new Set(hiddenPortalIds), [hiddenPortalIds]);
  const externalOnlySet = useMemo(() => new Set(externalOnlyPortalIds), [externalOnlyPortalIds]);

  const stats = useMemo(() => {
    const visiblePortals = isAdmin
      ? sortedPortals
      : sortedPortals.filter((p) => !hiddenSet.has(p.id));
    const total = visiblePortals.length;
    const integrated = visiblePortals.filter(
      (p) =>
        !externalOnlySet.has(p.id) &&
        (p.compatibilityStatus === 'iframe_compatible' || p.compatibilityStatus === 'auth_warning')
    ).length;
    const externalOnly = visiblePortals.filter(
      (p) => externalOnlySet.has(p.id) || isPortalWebBlocked(p)
    ).length;
    const untested = visiblePortals.filter(
      (p) => !externalOnlySet.has(p.id) && p.compatibilityStatus === 'untested'
    ).length;
    return { total, integrated, externalOnly, untested };
  }, [sortedPortals, isAdmin, hiddenSet, externalOnlySet]);

  const displayedPortals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base = isAdmin
      ? sortedPortals
      : sortedPortals.filter((p) => !hiddenSet.has(p.id));
    return base.filter((p) => {
      if (q && !`${p.name} ${p.url} ${p.categoryName}`.toLowerCase().includes(q)) {
        return false;
      }
      const forcedExternal = externalOnlySet.has(p.id);
      if (compatFilter === 'web_ok') {
        return (
          !forcedExternal &&
          (p.compatibilityStatus === 'iframe_compatible' || p.compatibilityStatus === 'auth_warning')
        );
      }
      if (compatFilter === 'web_blocked') {
        return forcedExternal || isPortalWebBlocked(p);
      }
      if (compatFilter === 'untested') {
        return !forcedExternal && p.compatibilityStatus === 'untested';
      }
      return true;
    });
  }, [sortedPortals, compatFilter, searchQuery, isAdmin, hiddenSet, externalOnlySet]);

  const hiddenPortalsList = useMemo(() => {
    const catalog = allKnownPortals || sortedPortals;
    return catalog.filter((p) => hiddenSet.has(p.id));
  }, [allKnownPortals, sortedPortals, hiddenSet]);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormCategoryId(categories[0]?.id || '');
    setFormIconName('Globe');
    setFormDescription('');
    setFormActive(true);
  };

  const handleEditStart = (portal: PortalEntry) => {
    setEditingId(portal.id);
    setFormName(portal.name);
    setFormUrl(portal.url);
    setFormCategoryId(portal.categoryId || categories[0]?.id || '');
    setFormIconName(portal.iconName || 'Globe');
    setFormDescription(portal.description || '');
    setFormActive(portal.active);
    setNotice('');
    setErrorMsg('');
  };

  const handleSavePortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    setErrorMsg('');
    setNotice('');
    try {
      const resp = await authFetch('/api/portals/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          module,
          name: formName.trim(),
          url: formUrl.trim(),
          categoryId: formCategoryId || categories[0]?.id || '',
          iconName: formIconName,
          description: formDescription.trim(),
          active: formActive,
        }),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo guardar el portal.');
      }
      resetForm();
      await onRefresh();
      setNotice(editingId ? 'Portal actualizado.' : 'Portal agregado correctamente.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar portal.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveHomeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingHome(true);
    setErrorMsg('');
    setNotice('');
    try {
      const resp = await authFetch('/api/portals/admin/home-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          homeUrl: homeUrl.trim(),
          homeTitle: homeTitle.trim() || 'Inicio',
          defaultPortalId: homePortalId || undefined,
          startPages,
        }),
      });
      const data = (await resp.json()) as { error?: string };
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo guardar la configuración de inicio.');
      }
      await onRefresh();
      setNotice('Páginas de inicio guardadas para todos los usuarios.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar páginas de inicio.');
    } finally {
      setSavingHome(false);
    }
  };

  const handleAddStartPageFromPortal = () => {
    if (!selectedStartPortalId || startPages.length >= 8) return;
    const p = sortedPortals.find((item) => item.id === selectedStartPortalId);
    if (!p) return;
    if (startPages.some((sp) => sp.url === p.url)) {
      setSelectedStartPortalId('');
      return;
    }
    setStartPages((prev) => [...prev, { title: p.name, url: p.url, portalId: p.id }]);
    setSelectedStartPortalId('');
  };

  const handleAddCustomStartPage = () => {
    if (!customStartUrl.trim() || startPages.length >= 8) return;
    const url = customStartUrl.trim();
    const title = customStartTitle.trim() || url;
    if (startPages.some((sp) => sp.url === url)) return;
    setStartPages((prev) => [...prev, { title, url }]);
    setCustomStartTitle('');
    setCustomStartUrl('');
  };

  const handleBulkDeleteIncompatible = async () => {
    setDeletingBulk(true);
    setErrorMsg('');
    setNotice('');
    try {
      if (isAdmin) {
        const resp = await authFetch(`/api/portals/admin/incompatible/${module}`, {
          method: 'DELETE',
        });
        const data = (await resp.json()) as {
          deletedCount?: number;
          error?: string;
        };
        if (!resp.ok) {
          throw new Error(data.error || 'No se pudieron eliminar los portales incompatibles.');
        }
        setConfirmBulkDelete(false);
        await onRefresh();
        setNotice(
          data.deletedCount && data.deletedCount > 0
            ? `Se eliminaron ${data.deletedCount} accesos directos y quedaron marcados para apertura externa exclusiva.`
            : 'No se encontraron portales bloqueados para eliminar. Probá primero la compatibilidad.'
        );
      } else if (onUserShortcutAction) {
        await onUserShortcutAction({ action: 'remove_incompatible_shortcuts' });
        setConfirmBulkDelete(false);
        setNotice(
          'Se eliminaron de tu navegador los accesos que no cargan por iframe y quedaron marcados para apertura externa exclusiva.'
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error en eliminación masiva.');
    } finally {
      setDeletingBulk(false);
    }
  };

  const handleMarkExternalOnlyAction = async (portal: PortalEntry, removeShortcut: boolean) => {
    setBusyPortalId(portal.id);
    setErrorMsg('');
    setNotice('');
    try {
      if (isAdmin) {
        const resp = await authFetch(
          `/api/portals/admin/items/${module}/${portal.id}/external-only`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              removeShortcut,
              reason: removeShortcut
                ? 'Acceso directo eliminado · apertura externa exclusiva por fallo en iframe.'
                : 'Marcado para apertura externa exclusiva (no carga correctamente mediante iframe).',
            }),
          }
        );
        const data = (await resp.json()) as { error?: string };
        if (!resp.ok) {
          throw new Error(data.error || 'No se pudo actualizar el modo externo del portal.');
        }
        await onRefresh();
        setNotice(
          removeShortcut
            ? `Acceso directo "${portal.name}" eliminado y marcado para apertura externa exclusiva.`
            : `"${portal.name}" marcado para apertura externa exclusiva.`
        );
      } else if (onUserShortcutAction) {
        await onUserShortcutAction({
          action: removeShortcut ? 'remove_shortcut_external' : 'mark_external_only',
          portalId: portal.id,
          url: portal.url,
          name: portal.name,
          reason: removeShortcut
            ? 'Acceso directo eliminado · apertura externa exclusiva por fallo en iframe.'
            : 'Marcado para apertura externa exclusiva (no carga correctamente mediante iframe).',
        });
        setNotice(
          removeShortcut
            ? `Acceso directo "${portal.name}" eliminado de tu Explorer y marcado para apertura externa exclusiva.`
            : `"${portal.name}" marcado para apertura externa exclusiva.`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al marcar apertura externa.');
    } finally {
      setBusyPortalId(null);
    }
  };

  const handleRemoveGlobalExternalRule = async (rule: ExternalOnlyRule) => {
    setErrorMsg('');
    setNotice('');
    try {
      if (isAdmin) {
        const resp = await authFetch(`/api/portals/admin/external-rules/${module}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: rule.url, portalId: rule.portalId }),
        });
        if (!resp.ok) throw new Error('No se pudo quitar la regla de apertura externa.');
        await onRefresh();
        setNotice(`Regla externa eliminada para "${rule.name}".`);
      } else if (onUserShortcutAction) {
        await onUserShortcutAction({
          action: 'unmark_external_only',
          portalId: rule.portalId,
          url: rule.url,
        });
        setNotice(`Se quitó la marca de apertura externa exclusiva para "${rule.name}".`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar regla.');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newCategoryName.trim()) return;
    setSaving(true);
    setErrorMsg('');
    setNotice('');
    try {
      const resp = await authFetch('/api/portals/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          name: newCategoryName.trim(),
        }),
      });
      const data = (await resp.json()) as { category?: PortalCategory; error?: string };
      if (!resp.ok) {
        throw new Error(data.error || 'No se pudo crear la categoría.');
      }
      setNewCategoryName('');
      if (data.category?.id) setFormCategoryId(data.category.id);
      await onRefresh();
      setNotice('Categoría creada.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al crear categoría.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (portal: PortalEntry) => {
    if (!isAdmin) return;
    setErrorMsg('');
    try {
      const resp = await authFetch('/api/portals/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: portal.id,
          module,
          name: portal.name,
          url: portal.url,
          categoryId: portal.categoryId,
          iconName: portal.iconName,
          description: portal.description,
          active: !portal.active,
          order: portal.order,
        }),
      });
      if (!resp.ok) {
        const d = (await resp.json()) as { error?: string };
        throw new Error(d.error || 'No se pudo cambiar el estado.');
      }
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar estado.');
    }
  };

  const handleReorder = async (portalId: string, direction: 'up' | 'down') => {
    if (!isAdmin) return;
    setErrorMsg('');
    try {
      const resp = await authFetch('/api/portals/admin/items/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, id: portalId, direction }),
      });
      if (!resp.ok) throw new Error('No se pudo reordenar el portal.');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al reordenar.');
    }
  };

  const handleDelete = async (portal: PortalEntry) => {
    if (!isAdmin) return;
    setErrorMsg('');
    try {
      const resp = await authFetch(`/api/portals/admin/items/${module}/${portal.id}`, {
        method: 'DELETE',
      });
      if (!resp.ok) throw new Error('No se pudo eliminar el portal.');
      await onRefresh();
      setNotice(`Portal "${portal.name}" eliminado.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al eliminar portal.');
    }
  };

  const handleProbeSingle = async (portal: PortalEntry) => {
    setProbingId(portal.id);
    setErrorMsg('');
    try {
      const resp = await authFetch('/api/portals/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalId: portal.id, url: portal.url }),
      });
      if (!resp.ok) {
        const d = (await resp.json()) as { error?: string };
        throw new Error(d.error || 'Error al verificar portal.');
      }
      await onRefresh();
      setNotice(`Verificación real completada para ${portal.name}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error en verificación.');
    } finally {
      setProbingId(null);
    }
  };

  const handleProbeAll = async () => {
    if (!isAdmin) return;
    setProbingAll(true);
    setErrorMsg('');
    setNotice('');
    try {
      const resp = await authFetch('/api/portals/admin/probe-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module }),
      });
      const data = (await resp.json()) as { testedCount?: number; error?: string };
      if (!resp.ok) {
        throw new Error(data.error || 'Error al ejecutar verificación masiva.');
      }
      await onRefresh();
      setNotice(`Verificación en tiempo real completada en ${data.testedCount || 0} portales.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error en prueba masiva.');
    } finally {
      setProbingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + Live Stats */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              {isAdmin
                ? 'Administración de Portales y Reglas Externas'
                : 'Administración de Accesos Directos'}
            </p>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {module === 'ai-browser'
                ? 'Portales de FABRO AI Browser'
                : 'Portales y Accesos Directos · FABRO Explorer'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAdmin
                ? 'Verificá cabeceras reales, configurá páginas de inicio y eliminá o marcá para apertura externa exclusiva los portales que no cargan mediante iframe.'
                : 'Eliminá de tu Explorer los accesos directos que no cargan correctamente en iframe y marcalos para abrirse exclusivamente en una pestaña externa oficial.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                disabled={probingAll}
                onClick={() => void handleProbeAll()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {probingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {probingAll ? 'Probando todos...' : 'Probar compatibilidad de todos'}
              </button>
            )}

            {stats.externalOnly > 0 && (isAdmin || Boolean(onUserShortcutAction)) && !confirmBulkDelete && (
              <button
                type="button"
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar accesos incompatibles con iframe ({stats.externalOnly})</span>
              </button>
            )}
          </div>
        </div>

        {(isAdmin || Boolean(onUserShortcutAction)) && confirmBulkDelete && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Confirmar eliminación de {stats.externalOnly} accesos directos que no cargan mediante iframe
                </p>
                <p className="text-[11px] opacity-90">
                  Se quitarán los accesos directos de la barra lateral y sus URLs quedarán marcadas para apertura externa exclusiva.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={deletingBulk}
                onClick={() => void handleBulkDeleteIncompatible()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                {deletingBulk && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirmar eliminación
              </button>
              <button
                type="button"
                disabled={deletingBulk}
                onClick={() => setConfirmBulkDelete(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#090D16] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Total listados</p>
            <p className="font-mono tabular-nums text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.total}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Abren en ventana web</p>
            <p className="font-mono tabular-nums text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.integrated}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Bloquean ventana web</p>
            <p className="font-mono tabular-nums text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {stats.externalOnly}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Sin verificar</p>
            <p className="font-mono tabular-nums text-xl font-bold text-slate-700 dark:text-slate-300 mt-0.5">
              {stats.untested}
            </p>
          </div>
        </div>

        {(notice || errorMsg) && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              errorMsg
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {errorMsg || notice}
          </div>
        )}
      </div>

      {/* Admin Explorer Home & Start Pages Configuration */}
      {isAdmin && (
        <form
          onSubmit={(e) => void handleSaveHomeConfig(e)}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Home className="w-4 h-4 text-sky-500" />
                <span>Páginas de inicio del Explorador</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configurá el sitio principal del botón Inicio y las pestañas que se abren automáticamente al ingresar.
              </p>
            </div>
            <button
              type="submit"
              disabled={savingHome}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {savingHome ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Guardar páginas de inicio</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Portal predeterminado para Inicio
              </label>
              <select
                value={homePortalId}
                onChange={(e) => {
                  const id = e.target.value;
                  setHomePortalId(id);
                  const chosen = sortedPortals.find((p) => p.id === id);
                  if (chosen) {
                    setHomeUrl(chosen.url);
                    setHomeTitle(chosen.name);
                  }
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
              >
                <option value="">URL personalizada...</option>
                {sortedPortals
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({isPortalWebBlocked(p) ? 'Externo' : p.compatibilityStatus === 'iframe_compatible' ? 'Ventana Web' : 'Sin probar'})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Título de página de inicio
              </label>
              <input
                type="text"
                required
                value={homeTitle}
                onChange={(e) => setHomeTitle(e.target.value)}
                placeholder="Ej: Biblioteca Wikipedia"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                URL de página de inicio
              </label>
              <input
                type="url"
                required
                value={homeUrl}
                onChange={(e) => {
                  setHomeUrl(e.target.value);
                  setHomePortalId('');
                }}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Pestañas iniciales al abrir ({startPages.length}/8)
              </p>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Si está vacío, se abrirá solo la página principal configurada arriba.
              </span>
            </div>

            {startPages.length > 0 && (
              <div className="space-y-1.5">
                {startPages.map((sp, index) => (
                  <div
                    key={`${sp.url}_${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="font-mono tabular-nums text-[11px] text-slate-400">
                        {index + 1}.
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white truncate">
                        {sp.title}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="font-mono text-[11px] text-slate-500 truncate">
                        {sp.url}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setStartPages((prev) => prev.filter((_, idx) => idx !== index))
                      }
                      title="Quitar página inicial"
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <div className="flex gap-2">
                <select
                  value={selectedStartPortalId}
                  onChange={(e) => setSelectedStartPortalId(e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">Elegir portal del catálogo...</option>
                  {sortedPortals
                    .filter((p) => p.active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedStartPortalId || startPages.length >= 8}
                  onClick={handleAddStartPageFromPortal}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500/60 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                >
                  Agregar pestaña
                </button>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="text"
                  value={customStartTitle}
                  onChange={(e) => setCustomStartTitle(e.target.value)}
                  placeholder="Título libre"
                  className="w-full sm:w-32 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="url"
                  value={customStartUrl}
                  onChange={(e) => setCustomStartUrl(e.target.value)}
                  placeholder="https://sitio-inicial.edu/"
                  className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={!customStartUrl.trim() || startPages.length >= 8}
                  onClick={handleAddCustomStartPage}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500/60 disabled:opacity-45 cursor-pointer whitespace-nowrap"
                >
                  + URL
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Admin Forms: Create/Edit Portal & Create Category */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <form
            onSubmit={(e) => void handleSavePortal(e)}
            className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {editingId ? <Pencil className="w-4 h-4 text-sky-500" /> : <Plus className="w-4 h-4 text-sky-500" />}
                <span>{editingId ? 'Editar portal existente' : 'Agregar nuevo portal'}</span>
              </h4>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Nombre del portal
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Biblioteca Digital"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Dirección URL oficial
                </label>
                <input
                  type="url"
                  required
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Categoría
                </label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Icono
                </label>
                <select
                  value={formIconName}
                  onChange={(e) => setFormIconName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
                >
                  {PORTAL_ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Descripción corta
              </label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Uso académico o propósito del portal..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                />
                <span>Portal activo en menú lateral</span>
              </label>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingId ? 'Guardar cambios' : 'Agregar portal'}
              </button>
            </div>
          </form>

          <form
            onSubmit={(e) => void handleCreateCategory(e)}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-sky-500" />
                <span>Nueva categoría</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Organizá los portales visibles en el navegador lateral.
              </p>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nombre de categoría..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !newCategoryName.trim()}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-sky-500/50 disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              Crear categoría
            </button>
          </form>
        </div>
      )}

      {/* Compatibility Filters + Search + Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#090D16]">
            {(
              [
                { id: 'all', label: `Todos (${stats.total})` },
                { id: 'web_ok', label: `Ventana web (${stats.integrated})` },
                { id: 'web_blocked', label: `Apertura externa / No cargan (${stats.externalOnly})` },
                { id: 'untested', label: `Sin verificar (${stats.untested})` },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCompatFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  compatFilter === opt.id
                    ? 'bg-white dark:bg-[#0F1623] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar portal o URL..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#090D16] border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">Portal</th>
                <th className="px-4 py-3 font-semibold">Categoría</th>
                <th className="px-4 py-3 font-semibold">Estado de compatibilidad</th>
                <th className="px-4 py-3 font-semibold">Modo de apertura</th>
                <th className="px-4 py-3 font-semibold">Última prueba</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {displayedPortals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    No hay portales en esta categoría de filtro.
                  </td>
                </tr>
              ) : (
                displayedPortals.map((portal, idx) => {
                  const Icon = resolvePortalIcon(portal.iconName);
                  const isForcedExternal = externalOnlySet.has(portal.id);
                  const meta = isForcedExternal
                    ? getCompatibilityMeta('external_required', 'apertura_externa')
                    : getCompatibilityMeta(portal.compatibilityStatus, portal.openingMode);
                  const webBlocked = isForcedExternal || isPortalWebBlocked(portal);
                  const isBusy = busyPortalId === portal.id;
                  return (
                    <tr
                      key={portal.id}
                      className={!portal.active ? 'opacity-55 bg-slate-50/50 dark:bg-slate-900/20' : ''}
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-2.5">
                          <Icon className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                              <span>{portal.name}</span>
                              {!portal.active && (
                                <span className="text-[10px] font-mono text-rose-500">· Deshabilitado</span>
                              )}
                              {webBlocked && (
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                  · Apertura externa exclusiva
                                </span>
                              )}
                            </div>
                            <a
                              href={portal.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 inline-flex items-center gap-1 break-all"
                            >
                              <span>{portal.url}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {portal.categoryName || 'General'}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className={`font-semibold ${meta.textClass}`}>
                          {meta.shortLabel}
                          {typeof portal.httpStatus === 'number' && portal.httpStatus > 0 && (
                            <span className="ml-1.5 font-mono tabular-nums text-[11px] opacity-85">
                              · HTTP {portal.httpStatus}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-0.5">
                          {isForcedExternal
                            ? 'Marcado para apertura externa exclusiva (sin carga por iframe).'
                            : portal.statusMessage}
                        </p>
                        {(portal.xFrameOptions || portal.cspFrameAncestors) && (
                          <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {[
                              portal.xFrameOptions ? `XFO: ${portal.xFrameOptions}` : '',
                              portal.cspFrameAncestors ? `CSP: ${portal.cspFrameAncestors}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                        {meta.modeLabel}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                        {formatProbeDate(portal.lastTestedAt)}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="inline-flex items-center justify-end gap-1 flex-wrap">
                          <button
                            type="button"
                            disabled={probingId === portal.id}
                            onClick={() => void handleProbeSingle(portal)}
                            title="Verificar cabeceras en vivo"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/60 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {probingId === portal.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="w-3 h-3 text-sky-500" />
                            )}
                            <span>Probar</span>
                          </button>

                          {(isAdmin || Boolean(onUserShortcutAction)) && !webBlocked && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleMarkExternalOnlyAction(portal, false)}
                              title="Marcar para apertura externa exclusiva cuando no carga correctamente en iframe"
                              className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Solo externo</span>
                            </button>
                          )}

                          {(isAdmin || Boolean(onUserShortcutAction)) && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleMarkExternalOnlyAction(portal, true)}
                              title="Eliminar acceso directo y marcar dominio para apertura externa exclusiva"
                              className="inline-flex items-center gap-1 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              <span>Eliminar acceso</span>
                            </button>
                          )}

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                disabled={idx === 0 || compatFilter !== 'all'}
                                onClick={() => void handleReorder(portal.id, 'up')}
                                title="Subir orden"
                                className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === displayedPortals.length - 1 || compatFilter !== 'all'}
                                onClick={() => void handleReorder(portal.id, 'down')}
                                title="Bajar orden"
                                className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleToggleActive(portal)}
                                title={portal.active ? 'Deshabilitar' : 'Habilitar'}
                                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 hover:border-sky-500/60 whitespace-nowrap cursor-pointer"
                              >
                                {portal.active ? 'Ocultar' : 'Activar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditStart(portal)}
                                title="Editar portal"
                                className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-sky-600 cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(portal)}
                                title="Eliminar definitivamente sin regla externa"
                                className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Removed Shortcuts & Exclusive External-Only Rules Registry */}
      {(externalOnlyRules.length > 0 || hiddenPortalsList.length > 0) && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Portales marcados para apertura externa exclusiva ({externalOnlyRules.length})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sus accesos directos fueron removidos o restringidos por fallar en iframe. Si abrís su dirección directamente, FABRO los lanzará siempre en pestaña externa oficial.
              </p>
            </div>
          </div>

          {!isAdmin && hiddenPortalsList.length > 0 && onUserShortcutAction && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Accesos directos ocultos de tu Explorer ({hiddenPortalsList.length})
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
                {hiddenPortalsList.map((hp) => (
                  <div
                    key={hp.id}
                    className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">
                        {hp.name}
                        <span className="ml-2 text-[11px] font-normal text-amber-600 dark:text-amber-400">
                          · Solo apertura externa
                        </span>
                      </p>
                      <p className="font-mono text-[11px] text-slate-500 truncate">{hp.url}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          void onUserShortcutAction({
                            action: 'restore_shortcut',
                            portalId: hp.id,
                            url: hp.url,
                            clearExternalOnly: false,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:border-sky-500/60 cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restaurar acceso directo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {externalOnlyRules.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
              {externalOnlyRules.map((rule, i) => (
                <div
                  key={`${rule.url}_${i}`}
                  className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {rule.name}
                      </span>
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        · Apertura externa exclusiva
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        · {formatProbeDate(rule.markedAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {rule.reason}
                    </p>
                    <a
                      href={rule.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 break-all mt-0.5"
                    >
                      <span>{rule.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                  {(isAdmin || Boolean(onUserShortcutAction)) && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveGlobalExternalRule(rule)}
                      className="rounded-md border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-rose-600 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Quitar regla externa
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
