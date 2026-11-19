import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpCircle,
  CheckCircle2,
  CloudOff,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  Wifi,
  X,
} from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEcosystem } from '../../context/EcosystemContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';

type DeploymentMode = 'update-available' | 'cached-offline' | 'online-synced';

interface CacheSummary {
  cacheCount: number;
  entryCount: number;
  hasController: boolean;
}

export const DeploymentStatusBar: React.FC<{ hasMobileBottomNav?: boolean }> = ({
  hasMobileBottomNav = true,
}) => {
  const { network, measureNetwork } = useEcosystem();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [swLifecycle, setSwLifecycle] = useState<
    'active' | 'installing' | 'waiting' | 'registering' | 'unsupported' | 'error'
  >(() =>
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'registering' : 'unsupported'
  );
  const [swError, setSwError] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [cacheStats, setCacheStats] = useState<CacheSummary>({
    cacheCount: 0,
    entryCount: 0,
    hasController:
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      Boolean(navigator.serviceWorker.controller),
  });

  const panelRef = useRef<HTMLDivElement | null>(null);

  const readCacheStats = useCallback(async () => {
    const hasController =
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      Boolean(navigator.serviceWorker.controller);

    if (typeof window === 'undefined' || !('caches' in window)) {
      setCacheStats({ cacheCount: 0, entryCount: 0, hasController });
      return;
    }
    try {
      const names = await window.caches.keys();
      const counts = await Promise.all(
        names.map(async (name) => {
          const cache = await window.caches.open(name);
          const keys = await cache.keys();
          return keys.length;
        })
      );
      const entryCount = counts.reduce((acc, n) => acc + n, 0);
      setCacheStats({ cacheCount: names.length, entryCount, hasController });
    } catch {
      setCacheStats((prev) => ({ ...prev, hasController }));
    }
  }, []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setSwRegistration(registration);
      if (registration.waiting) {
        setSwLifecycle('waiting');
        setNeedRefresh(true);
      } else if (registration.installing) {
        setSwLifecycle('installing');
      } else if (registration.active) {
        setSwLifecycle('active');
      }
      setLastCheckedAt(
        new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      );
      void readCacheStats();
    },
    onNeedRefresh() {
      setSwLifecycle('waiting');
      setNeedRefresh(true);
      setNoticeDismissed(false);
      setLastCheckedAt(
        new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      );
    },
    onOfflineReady() {
      setSwLifecycle('active');
      void readCacheStats();
    },
    onRegisterError(error) {
      setSwLifecycle('error');
      setSwError(error instanceof Error ? error.message : 'No se pudo registrar el Service Worker.');
    },
  });

  const checkDeploymentStatus = useCallback(async () => {
    setCheckingUpdates(true);
    try {
      await measureNetwork();
      if (navigator.onLine && swRegistration) {
        await swRegistration.update();
        if (swRegistration.waiting) {
          setSwLifecycle('waiting');
          setNeedRefresh(true);
        }
      }
      await readCacheStats();
      setLastCheckedAt(
        new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      );
    } catch {
      // ignore transient failures
    } finally {
      setCheckingUpdates(false);
    }
  }, [measureNetwork, readCacheStats, setNeedRefresh, swRegistration]);

  useEffect(() => {
    void readCacheStats();
  }, [network.isOnline, readCacheStats]);

  useEffect(() => {
    if (needRefresh || !network.isOnline) {
      setNoticeDismissed(false);
    }
  }, [needRefresh, network.isOnline]);

  useEffect(() => {
    if (!swRegistration) return;
    const handleUpdateFound = () => {
      const installing = swRegistration.installing;
      if (!installing) return;
      setSwLifecycle('installing');
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            setSwLifecycle('waiting');
            setNeedRefresh(true);
            setNoticeDismissed(false);
          } else {
            setSwLifecycle('active');
          }
          void readCacheStats();
        }
      });
    };

    swRegistration.addEventListener('updatefound', handleUpdateFound);
    return () => {
      swRegistration.removeEventListener('updatefound', handleUpdateFound);
    };
  }, [readCacheStats, setNeedRefresh, swRegistration]);

  useEffect(() => {
    if (!panelOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [panelOpen]);

  const handleApplyUpdate = async () => {
    setApplyingUpdate(true);
    try {
      await updateServiceWorker(true);
      window.setTimeout(() => {
        if (swRegistration?.waiting) {
          swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
      }, 1500);
    } catch {
      setApplyingUpdate(false);
    }
  };

  const handleResetAppCache = async () => {
    if (!network.isOnline) return;
    setClearingCache(true);
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
      await swRegistration?.update();
      window.location.reload();
    } catch {
      setClearingCache(false);
    }
  };

  const deploymentMode: DeploymentMode = needRefresh
    ? 'update-available'
    : !network.isOnline
    ? 'cached-offline'
    : 'online-synced';

  const label =
    deploymentMode === 'update-available'
      ? 'Nueva versión disponible'
      : deploymentMode === 'cached-offline'
      ? 'Versión en caché (Offline)'
      : 'Despliegue al día';

  const showFloatingNotice =
    !noticeDismissed &&
    !panelOpen &&
    (deploymentMode === 'update-available' || deploymentMode === 'cached-offline');

  return (
    <div
      ref={panelRef}
      className={`no-print fixed ${
        hasMobileBottomNav ? 'bottom-[72px] lg:bottom-4' : 'bottom-4'
      } left-3 sm:left-4 z-40 flex flex-col items-start gap-2 max-w-[calc(100vw-1.5rem)]`}
    >
      {panelOpen && (
        <div
          role="dialog"
          aria-label="Estado de Despliegue y PWA"
          className="w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-xl border fabro-surface p-4 shadow-lg space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold fabro-gold-text">Estado de Despliegue</p>
              <h2 className="font-display text-sm font-bold mt-0.5">{label}</h2>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="Cerrar panel de Estado de Despliegue"
              className="p-1.5 rounded-lg fabro-muted hover:opacity-100 cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <p className="rounded-lg border fabro-border fabro-surface-elevated p-3 text-xs leading-relaxed">
            {deploymentMode === 'update-available'
              ? 'Hay una nueva versión descargada en segundo plano. Actualizá cuando quieras para activarla sin perder tu bóveda local.'
              : deploymentMode === 'cached-offline'
              ? 'Estás trabajando sobre la versión guardada en caché (offline). Tus cambios locales se guardan en IndexedDB y LocalStorage.'
              : `Despliegue sincronizado en línea. ${cacheStats.entryCount} recursos en caché listos para modo sin conexión.`}
          </p>

          {swError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
              {swError}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border fabro-border p-2.5">
              <p className="text-[11px] fabro-muted">Ejecución</p>
              <p className="font-semibold mt-0.5">{isInstalled ? 'App PWA' : 'Navegador'}</p>
            </div>
            <div className="rounded-lg border fabro-border p-2.5">
              <p className="text-[11px] fabro-muted">Service Worker</p>
              <p className="font-semibold mt-0.5">
                {swLifecycle === 'waiting'
                  ? 'Esperando actualizar'
                  : swLifecycle === 'active' || cacheStats.hasController
                  ? 'Activo'
                  : swLifecycle === 'unsupported'
                  ? 'No compatible'
                  : 'Registrando'}
              </p>
            </div>
            <div className="rounded-lg border fabro-border p-2.5">
              <p className="text-[11px] fabro-muted">Caché PWA</p>
              <p className="font-mono font-semibold mt-0.5 tabular-nums">
                {cacheStats.entryCount} archivos ({cacheStats.cacheCount})
              </p>
            </div>
            <div className="rounded-lg border fabro-border p-2.5">
              <p className="text-[11px] fabro-muted">Último chequeo</p>
              <p className="font-mono font-semibold mt-0.5 tabular-nums">
                {lastCheckedAt || 'Al iniciar'}
              </p>
            </div>
          </div>

          {showIOSHint && isIOS && !isInstalled && (
            <p className="rounded-lg border fabro-border p-2.5 text-xs fabro-muted">
              En Safari (iPhone/iPad): tocá <strong>Compartir</strong> y elegí{' '}
              <strong>Agregar a inicio</strong>.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {needRefresh && (
              <button
                type="button"
                disabled={applyingUpdate}
                onClick={() => void handleApplyUpdate()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg fabro-accent-bg px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <ArrowUpCircle className={`w-3.5 h-3.5 ${applyingUpdate ? 'animate-spin' : ''}`} />
                {applyingUpdate ? 'Aplicando...' : 'Actualizar ahora'}
              </button>
            )}

            <button
              type="button"
              disabled={checkingUpdates}
              onClick={() => void checkDeploymentStatus()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border fabro-border px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} />
              Buscar actualización
            </button>

            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={() => void install()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg fabro-accent-soft px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar PWA
              </button>
            )}

            {!isInstalled && !isInstallable && isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSHint((v) => !v)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg fabro-accent-soft px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar iOS
              </button>
            )}

            {network.isOnline && cacheStats.cacheCount > 0 && (
              <button
                type="button"
                disabled={clearingCache}
                onClick={() => void handleResetAppCache()}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border fabro-border px-2.5 py-2 text-xs fabro-muted cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Refrescar caché
              </button>
            )}
          </div>
        </div>
      )}

      {showFloatingNotice && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border fabro-surface px-3.5 py-2.5 shadow-lg flex items-center gap-2.5 max-w-sm"
        >
          {deploymentMode === 'update-available' ? (
            <ArrowUpCircle className="w-4 h-4 fabro-accent-text shrink-0" strokeWidth={1.75} />
          ) : (
            <CloudOff className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" strokeWidth={1.75} />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate">{label}</p>
            <p className="text-xs fabro-muted truncate">
              {deploymentMode === 'update-available'
                ? 'Compilación lista para activar'
                : `${cacheStats.entryCount} recursos en caché PWA`}
            </p>
          </div>
          {deploymentMode === 'update-available' ? (
            <button
              type="button"
              disabled={applyingUpdate}
              onClick={() => void handleApplyUpdate()}
              className="rounded-lg fabro-accent-bg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Actualizar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void checkDeploymentStatus()}
              className="rounded-lg border fabro-border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reintentar
            </button>
          )}
          <button
            type="button"
            onClick={() => setNoticeDismissed(true)}
            aria-label="Ocultar aviso"
            className="p-1 fabro-muted cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        aria-expanded={panelOpen}
        aria-label={label}
        className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border-2 fabro-surface px-3 py-1.5 text-xs font-bold shadow-sm cursor-pointer whitespace-nowrap active:scale-95 transition-transform"
      >
        {deploymentMode === 'update-available' ? (
          <ArrowUpCircle className="w-4 h-4 fabro-accent-text shrink-0" strokeWidth={2} />
        ) : deploymentMode === 'cached-offline' ? (
          <HardDrive className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" strokeWidth={2} />
        ) : offlineReady || cacheStats.hasController ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" strokeWidth={2} />
        ) : (
          <Wifi className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" strokeWidth={2} />
        )}
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">
          {deploymentMode === 'update-available'
            ? 'Nueva'
            : deploymentMode === 'cached-offline'
            ? 'Offline'
            : 'PWA'}
        </span>
      </button>
    </div>
  );
};
