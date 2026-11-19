import React, { useEffect, useRef, useState } from 'react';
import { Gauge, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useConnectionSpeed } from '../../hooks/useConnectionSpeed';

export const ConnectionSpeedBadge: React.FC = () => {
  const { speed, runSpeedTest } = useConnectionSpeed(30_000);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const accentClass =
    speed.quality === 'offline'
      ? 'text-rose-600 dark:text-rose-400 border-rose-500/45 bg-rose-500/10'
      : speed.quality === 'slow'
      ? 'text-amber-700 dark:text-amber-300 border-amber-500/45 bg-amber-500/10'
      : speed.quality === 'moderate'
      ? 'text-sky-700 dark:text-sky-300 fabro-border fabro-surface'
      : 'text-emerald-700 dark:text-emerald-400 fabro-border fabro-surface';

  const compactLabel = !speed.online
    ? 'Offline'
    : speed.effectiveMbps !== null
    ? `${speed.effectiveMbps >= 100 ? Math.round(speed.effectiveMbps) : speed.effectiveMbps.toFixed(1)} Mbps`
    : speed.rttMs !== null
    ? `${speed.rttMs} ms`
    : 'Red';

  const mobileShortLabel = !speed.online
    ? 'Off'
    : speed.effectiveMbps !== null
    ? `${Math.round(speed.effectiveMbps)}M`
    : speed.rttMs !== null
    ? `${speed.rttMs}ms`
    : 'Red';

  const lastCheckedFormatted = speed.lastCheckedAt
    ? new Intl.DateTimeFormat('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(speed.lastCheckedAt))
    : 'Midiendo...';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Velocidad de conexión: ${compactLabel} (${speed.qualityLabel})`}
        title={`Conexión ${speed.qualityLabel} · ${compactLabel}${speed.rttMs !== null ? ` · ${speed.rttMs} ms` : ''}`}
        className={`h-9 inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border px-2 sm:px-2.5 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors hover:border-[var(--fabro-accent)] ${accentClass}`}
      >
        {speed.online ? (
          <Wifi className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
        )}
        <span className="sm:hidden font-mono tabular-nums text-[11px] font-semibold text-[var(--fabro-text)]">
          {mobileShortLabel}
        </span>
        <span className="hidden sm:inline font-mono tabular-nums text-[11px] font-semibold text-[var(--fabro-text)]">
          {compactLabel}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Monitor de velocidad de conexión"
          className="fixed sm:absolute right-2.5 sm:right-0 top-14 sm:top-auto sm:mt-2 w-72 max-w-[calc(100vw-1.25rem)] rounded-xl border fabro-border fabro-surface p-3.5 shadow-lg z-50 space-y-3 text-xs"
        >
          <div className="flex items-center justify-between gap-2 pb-2 border-b fabro-border">
            <div className="flex items-center gap-1.5 font-semibold">
              <Gauge className="w-4 h-4 text-[#0284C7] dark:text-[#38BDF8]" />
              <span>Velocidad de conexión</span>
            </div>
            <span className="font-semibold text-[11px] fabro-muted">{speed.qualityLabel}</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border fabro-border fabro-surface-elevated p-2.5">
              <p className="text-[11px] fabro-muted">Descarga</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {!speed.online
                  ? '0 Mbps'
                  : speed.effectiveMbps !== null
                  ? `${speed.effectiveMbps.toFixed(1)} Mbps`
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border fabro-border fabro-surface-elevated p-2.5">
              <p className="text-[11px] fabro-muted">Latencia (Ping)</p>
              <p className="text-base font-bold font-mono tabular-nums mt-0.5">
                {!speed.online ? '—' : speed.rttMs !== null ? `${speed.rttMs} ms` : '—'}
              </p>
            </div>
          </div>

          <div className="space-y-1 text-[11px] fabro-muted">
            <div className="flex items-center justify-between gap-2">
              <span>Tipo de red</span>
              <span className="font-medium text-[var(--fabro-text)]">{speed.effectiveType}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Ahorro de datos</span>
              <span className="font-medium text-[var(--fabro-text)]">
                {speed.saveData ? 'Activado' : 'Desactivado'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Última medición</span>
              <span className="font-mono tabular-nums text-[var(--fabro-text)]">
                {lastCheckedFormatted}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={speed.testing}
            onClick={() => void runSpeedTest(true)}
            className="w-full min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0284C7] text-white font-semibold px-3 cursor-pointer disabled:opacity-60 transition-opacity"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${speed.testing ? 'animate-spin' : ''}`} />
            <span>{speed.testing ? 'Midiendo velocidad...' : 'Medir velocidad ahora'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
