import React, { useState } from 'react';
import { CheckCircle2, Download, Monitor, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean; fullWidth?: boolean }> = ({
  compact = false,
  fullWidth = false,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        App PWA instalada
      </span>
    );
  }

  const handleClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      const accepted = await install();
      setInstalling(false);
      if (!accepted) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        disabled={installing}
        onClick={() => void handleClick()}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer active:scale-[0.98] transition-all whitespace-nowrap disabled:opacity-60 ${
          fullWidth ? 'w-full' : ''
        } ${
          compact
            ? 'min-h-[38px] px-3 py-1.5 text-xs'
            : 'min-h-[44px] px-4 py-2 text-xs shadow-[0_6px_16px_-6px_rgba(16,185,129,0.45)]'
        }`}
      >
        {isIOS ? (
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Download className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>
          {installing
            ? 'Instalando...'
            : compact
            ? 'Instalar app'
            : isIOS
            ? 'Instalar FABRO en iPhone / iPad'
            : 'Instalar app FABRO (PWA)'}
        </span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuide(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border-2 fabro-border fabro-surface p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold flex items-center gap-2">
                {isIOS || isAndroid ? (
                  <Smartphone className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <Monitor className="w-4 h-4 text-emerald-500 shrink-0" />
                )}
                Instalar FABRO en tu dispositivo
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Cerrar guía de instalación"
                className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-xs fabro-muted leading-relaxed space-y-2 list-decimal pl-4">
                <li>
                  Abrí <strong>https://fabroeco.netlify.app/</strong> en <strong>Safari</strong>.
                </li>
                <li>
                  Tocá el botón <strong>Compartir</strong> (cuadro con flecha hacia arriba).
                </li>
                <li>
                  Elegí <strong>Agregar a pantalla de inicio</strong> y tocá <strong>Agregar</strong>.
                </li>
              </ol>
            ) : isAndroid ? (
              <ol className="text-xs fabro-muted leading-relaxed space-y-2 list-decimal pl-4">
                <li>
                  Abrí <strong>https://fabroeco.netlify.app/</strong> en <strong>Google Chrome</strong> (no dentro de WhatsApp, Instagram o un visor interno).
                </li>
                <li>
                  Tocá el menú de <strong>3 puntos (⋮)</strong> arriba a la derecha.
                </li>
                <li>
                  Elegí <strong>Instalar aplicación</strong> o <strong>Agregar a la pantalla principal</strong>.
                </li>
              </ol>
            ) : (
              <ol className="text-xs fabro-muted leading-relaxed space-y-2 list-decimal pl-4">
                <li>
                  En <strong>Chrome o Edge</strong>, mirá el extremo derecho de la barra de direcciones.
                </li>
                <li>
                  Tocá el ícono de <strong>Instalar FABRO</strong> (pantalla con flecha) o abrí el menú <strong>⋮ → Guardar y compartir → Instalar FABRO</strong>.
                </li>
              </ol>
            )}

            <p className="rounded-xl border fabro-border fabro-surface-elevated p-2.5 text-[11px] fabro-muted leading-snug">
              Si ya la habías instalado antes y quedó en una versión vieja, cerrá la app instalada y volvé a abrirla con conexión para que se actualice automáticamente.
            </p>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full min-h-[42px] rounded-xl fabro-btn-primary text-xs font-bold cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
