import { useCallback, useEffect, useRef, useState } from 'react';

interface NetworkInformationLike extends EventTarget {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  type?: string;
}

export type ConnectionQuality = 'offline' | 'excellent' | 'good' | 'moderate' | 'slow';

export interface ConnectionSpeedSnapshot {
  online: boolean;
  downlinkMbps: number | null;
  measuredMbps: number | null;
  effectiveMbps: number | null;
  rttMs: number | null;
  effectiveType: string;
  connectionType: string;
  saveData: boolean;
  quality: ConnectionQuality;
  qualityLabel: string;
  testing: boolean;
  lastCheckedAt: string | null;
  method: 'probe' | 'network-api' | 'offline';
}

function getNavigatorConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || null;
}

function classifyQuality(
  online: boolean,
  mbps: number | null,
  rttMs: number | null
): { quality: ConnectionQuality; label: string } {
  if (!online) return { quality: 'offline', label: 'Sin conexión' };
  if (mbps !== null) {
    if (mbps >= 20 && (rttMs === null || rttMs < 120)) {
      return { quality: 'excellent', label: 'Excelente' };
    }
    if (mbps >= 5) return { quality: 'good', label: 'Buena' };
    if (mbps >= 1.5) return { quality: 'moderate', label: 'Moderada' };
    return { quality: 'slow', label: 'Lenta' };
  }
  if (rttMs !== null) {
    if (rttMs < 80) return { quality: 'excellent', label: 'Excelente' };
    if (rttMs < 180) return { quality: 'good', label: 'Buena' };
    if (rttMs < 380) return { quality: 'moderate', label: 'Moderada' };
    return { quality: 'slow', label: 'Lenta' };
  }
  return { quality: 'good', label: 'Activa' };
}

function formatEffectiveType(raw?: string, type?: string): string {
  const t = (type || '').toLowerCase();
  if (t === 'wifi') return 'Wi-Fi';
  if (t === 'ethernet') return 'Cable / Ethernet';
  if (t === 'cellular') return (raw || 'Móvil').toUpperCase();
  if (!raw) return 'Red activa';
  return raw.toUpperCase();
}

export function useConnectionSpeed(autoIntervalMs = 30_000): {
  speed: ConnectionSpeedSnapshot;
  runSpeedTest: (fullProbe?: boolean) => Promise<void>;
} {
  const [speed, setSpeed] = useState<ConnectionSpeedSnapshot>(() => {
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    const conn = getNavigatorConnection();
    const downlink = typeof conn?.downlink === 'number' && conn.downlink > 0 ? conn.downlink : null;
    const rtt = typeof conn?.rtt === 'number' && conn.rtt > 0 ? conn.rtt : null;
    const q = classifyQuality(online, downlink, rtt);
    return {
      online,
      downlinkMbps: downlink,
      measuredMbps: null,
      effectiveMbps: downlink,
      rttMs: rtt,
      effectiveType: formatEffectiveType(conn?.effectiveType, conn?.type),
      connectionType: conn?.type || conn?.effectiveType || 'desconocido',
      saveData: Boolean(conn?.saveData),
      quality: q.quality,
      qualityLabel: q.label,
      testing: false,
      lastCheckedAt: null,
      method: online ? 'network-api' : 'offline',
    };
  });

  const testingRef = useRef(false);

  const runSpeedTest = useCallback(async (fullProbe = true) => {
    if (testingRef.current) return;
    const online = typeof navigator === 'undefined' ? true : navigator.onLine;
    const conn = getNavigatorConnection();
    const apiDownlink =
      typeof conn?.downlink === 'number' && conn.downlink > 0 ? conn.downlink : null;
    const apiRtt = typeof conn?.rtt === 'number' && conn.rtt > 0 ? conn.rtt : null;

    if (!online) {
      setSpeed({
        online: false,
        downlinkMbps: null,
        measuredMbps: null,
        effectiveMbps: null,
        rttMs: null,
        effectiveType: 'Offline',
        connectionType: 'none',
        saveData: Boolean(conn?.saveData),
        quality: 'offline',
        qualityLabel: 'Sin conexión',
        testing: false,
        lastCheckedAt: new Date().toISOString(),
        method: 'offline',
      });
      return;
    }

    testingRef.current = true;
    setSpeed((prev) => ({ ...prev, testing: true }));

    let measuredRtt: number | null = apiRtt;
    let measuredMbps: number | null = null;

    try {
      // 1. Lightweight RTT ping against local origin (works in Express & static SPA hosting)
      const pingStart = performance.now();
      const pingController = new AbortController();
      const pingTimeout = window.setTimeout(() => pingController.abort(), 5000);
      try {
        const pingUrl = `/api/health?_p=${Date.now()}`;
        const pingRes = await fetch(pingUrl, {
          cache: 'no-store',
          signal: pingController.signal,
        });
        window.clearTimeout(pingTimeout);
        const ct = pingRes.headers.get('content-type') || '';
        if (pingRes.ok && ct.includes('application/json')) {
          measuredRtt = Math.max(1, Math.round(performance.now() - pingStart));
        } else {
          // Static deploy fallback: time lightweight same-origin root fetch
          const staticStart = performance.now();
          await fetch(`/?_p=${Date.now()}`, { cache: 'no-store' });
          measuredRtt = Math.max(1, Math.round(performance.now() - staticStart));
        }
      } catch {
        window.clearTimeout(pingTimeout);
      }

      // 2. Real download throughput probe (skipped during background tick if user enabled saveData)
      if (fullProbe && !conn?.saveData) {
        const probeController = new AbortController();
        const probeTimeout = window.setTimeout(() => probeController.abort(), 7000);
        try {
          const dlStart = performance.now();
          const probeRes = await fetch(`/api/speed-probe?_s=${Date.now()}`, {
            cache: 'no-store',
            signal: probeController.signal,
          });
          const ct = (probeRes.headers.get('content-type') || '').toLowerCase();
          if (probeRes.ok && ct.includes('application/octet-stream')) {
            const buf = await probeRes.arrayBuffer();
            const elapsedSec = Math.max(0.004, (performance.now() - dlStart) / 1000);
            if (buf.byteLength >= 32_768) {
              const mbps = (buf.byteLength * 8) / (elapsedSec * 1_000_000);
              // Cap unrealistic loopback spikes on localhost dev while keeping honest throughput
              measuredMbps = Number(Math.min(mbps, 999.9).toFixed(1));
            }
          } else {
            // Static hosting fallback: timed fetch of public CORS JSON payload (~50-100KB)
            const fbStart = performance.now();
            const fbRes = await fetch(
              `https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/scoreboard?_s=${Date.now()}`,
              { cache: 'no-store', signal: probeController.signal }
            );
            if (fbRes.ok) {
              const buf = await fbRes.arrayBuffer();
              const elapsedSec = Math.max(0.008, (performance.now() - fbStart) / 1000);
              if (buf.byteLength >= 4096) {
                const mbps = (buf.byteLength * 8) / (elapsedSec * 1_000_000);
                measuredMbps = Number(Math.min(mbps, 999.9).toFixed(1));
              }
            }
          }
          window.clearTimeout(probeTimeout);
        } catch {
          window.clearTimeout(probeTimeout);
        }
      }
    } finally {
      testingRef.current = false;
    }

    const effectiveMbps = measuredMbps ?? apiDownlink;
    const q = classifyQuality(true, effectiveMbps, measuredRtt);

    setSpeed((prev) => ({
      online: true,
      downlinkMbps: apiDownlink,
      measuredMbps: measuredMbps ?? prev.measuredMbps,
      effectiveMbps: measuredMbps ?? apiDownlink ?? prev.effectiveMbps,
      rttMs: measuredRtt ?? prev.rttMs,
      effectiveType: formatEffectiveType(conn?.effectiveType, conn?.type),
      connectionType: conn?.type || conn?.effectiveType || 'activa',
      saveData: Boolean(conn?.saveData),
      quality: q.quality,
      qualityLabel: q.label,
      testing: false,
      lastCheckedAt: new Date().toISOString(),
      method: measuredMbps !== null ? 'probe' : 'network-api',
    }));
  }, []);

  useEffect(() => {
    void runSpeedTest(true);

    const onOnline = () => void runSpeedTest(true);
    const onOffline = () => void runSpeedTest(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const conn = getNavigatorConnection();
    const onConnChange = () => void runSpeedTest(false);
    conn?.addEventListener?.('change', onConnChange);

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runSpeedTest(false);
      }
    }, autoIntervalMs);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      conn?.removeEventListener?.('change', onConnChange);
      window.clearInterval(interval);
    };
  }, [autoIntervalMs, runSpeedTest]);

  return { speed, runSpeedTest };
}
