import { useCallback, useEffect, useState } from 'react';
import type { NetworkSnapshot } from '../types/ecosystem';

interface NavigatorConnectionLike {
  downlink?: number;
  rtt?: number;
  effectiveType?: string;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function getBrowserConnection(): NavigatorConnectionLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as unknown as { connection?: NavigatorConnectionLike }).connection;
}

export function useNetworkMonitor() {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot>(() => {
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const conn = getBrowserConnection();
    return {
      isOnline: online,
      syncStatus: online ? 'sincronizado-local' : 'modo-offline',
      downlinkMbps: online && typeof conn?.downlink === 'number' ? conn.downlink : online ? null : 0,
      latencyMs: online && typeof conn?.rtt === 'number' ? conn.rtt : null,
      effectiveType: online ? conn?.effectiveType || 'En línea' : 'Offline',
      measuredAt: null,
      measuring: false,
    };
  });

  const measureNow = useCallback(async () => {
    const conn = getBrowserConnection();
    const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!browserOnline) {
      setSnapshot({
        isOnline: false,
        syncStatus: 'modo-offline',
        downlinkMbps: 0,
        latencyMs: null,
        effectiveType: 'Offline',
        measuredAt: new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        measuring: false,
      });
      return;
    }

    setSnapshot((prev) => ({ ...prev, measuring: true }));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);
    const start = performance.now();

    try {
      const resp = await fetch(`/api/health?net_probe=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      const rttMs = Math.max(1, Math.round(performance.now() - start));
      const payload = await resp.text();
      const bytes = Math.max(128, payload.length);
      const seconds = Math.max(0.004, rttMs / 1000);
      // Use browser downlink API when available; otherwise derive conservative estimate from probe RTT
      const estimatedMbps =
        typeof conn?.downlink === 'number' && conn.downlink > 0
          ? Number(conn.downlink.toFixed(1))
          : Number(Math.min(100, Math.max(0.8, (bytes * 8) / (seconds * 1_000_000) * 180)).toFixed(1));

      setSnapshot({
        isOnline: resp.ok,
        syncStatus: resp.ok ? 'sincronizado-local' : 'pendiente-red',
        downlinkMbps: resp.ok ? estimatedMbps : 0,
        latencyMs: resp.ok ? rttMs : null,
        effectiveType: conn?.effectiveType ? conn.effectiveType.toUpperCase() : 'RED ACTIVA',
        measuredAt: new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        measuring: false,
      });
    } catch {
      setSnapshot({
        isOnline: false,
        syncStatus: 'modo-offline',
        downlinkMbps: 0,
        latencyMs: null,
        effectiveType: 'Sin servidor',
        measuredAt: new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        measuring: false,
      });
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    const conn = getBrowserConnection();
    const onStatusChange = () => {
      void measureNow();
    };

    window.addEventListener('online', onStatusChange);
    window.addEventListener('offline', onStatusChange);
    conn?.addEventListener?.('change', onStatusChange);

    void measureNow();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void measureNow();
      }
    }, 45_000);

    return () => {
      window.removeEventListener('online', onStatusChange);
      window.removeEventListener('offline', onStatusChange);
      conn?.removeEventListener?.('change', onStatusChange);
      window.clearInterval(intervalId);
    };
  }, [measureNow]);

  return { snapshot, measureNow };
}
