import React, { useState } from 'react';
import { CheckCircle2, Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4" />
        App PWA instalada
      </span>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white font-bold cursor-pointer active:scale-95 transition-transform whitespace-nowrap ${
          compact ? 'min-h-[38px] px-2.5 py-1 text-xs' : 'min-h-[44px] px-4 py-2 text-xs shadow-[0_6px_16px_-6px_rgba(16,185,129,0.45)]'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Instalar' : 'Instalar app 🍀 FABRO'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#0284C7]/50 bg-[#0284C7]/10 text-[#0369A1] dark:text-[#38BDF8] font-bold cursor-pointer active:scale-95 whitespace-nowrap ${
            compact ? 'min-h-[38px] px-2.5 py-1 text-xs' : 'min-h-[44px] px-3.5 py-2 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>{compact ? 'Instalar iOS' : 'Instalar en iPhone / iPad'}</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIOSGuide(false);
            }}
          >
            <div className="w-full max-w-sm rounded-2xl border-2 fabro-border fabro-surface p-5 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold">Instalar 🍀 FABRO 🍀 en iOS</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar guía iOS"
                  className="min-h-[40px] min-w-[40px] rounded-xl border-2 fabro-border flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs fabro-muted leading-relaxed">
                1. Tocá el botón <strong>Compartir</strong> en la barra inferior o superior de Safari.<br />
                2. Deslizá y elegí <strong>Agregar a inicio</strong>.<br />
                3. Abrí FABRO desde el ícono del trébol para habilitar notificaciones PWA en iOS.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
