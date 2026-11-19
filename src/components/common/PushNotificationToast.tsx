import React from 'react';
import { ArrowUpRight, Bell, BellRing, Newspaper, Users, X } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';

export const PushNotificationToast: React.FC = () => {
  const {
    activePushToasts,
    dismissPushToast,
    navigateTo,
    navigateToCultureSection,
    notificationPermission,
    requestNotificationPermission,
  } = useEcosystem();

  if (activePushToasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notificaciones push de FABRO"
      className="fixed top-16 right-3 sm:right-5 z-[70] flex flex-col gap-2.5 w-[min(370px,calc(100vw-1.5rem))] pointer-events-none"
    >
      {activePushToasts.map((toast) => {
        const isCulture = toast.category === 'culture-news';
        const isCommunity = toast.category === 'community';
        const accentBorder = isCulture
          ? 'border-[#9A3412]/50'
          : isCommunity
          ? 'border-[#0284C7]/50'
          : 'border-emerald-600/50';
        const accentText = isCulture
          ? 'text-[#9A3412] dark:text-[#FDBA74]'
          : isCommunity
          ? 'text-[#0284C7] dark:text-[#38BDF8]'
          : 'text-emerald-700 dark:text-emerald-300';
        const categoryLabel = isCulture
          ? 'FABRO Cultura · Nueva noticia'
          : isCommunity
          ? 'Comunidades FABRO · Novedad'
          : 'Aviso del Ecosistema';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-2xl border ${accentBorder} fabro-surface shadow-[0_14px_34px_-12px_rgba(15,23,42,0.28)] p-4 space-y-2.5`}
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0 flex items-start gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl border fabro-border fabro-surface-elevated flex items-center justify-center shrink-0 mt-0.5 ${accentText}`}
                >
                  {isCulture ? (
                    <Newspaper className="w-4 h-4" strokeWidth={1.75} />
                  ) : isCommunity ? (
                    <Users className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Bell className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className={`font-semibold uppercase tracking-wide ${accentText}`}>
                      {categoryLabel}
                    </span>
                    <span className="font-mono tabular-nums fabro-muted">{toast.createdAt}</span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold leading-snug mt-0.5 line-clamp-2">
                    {toast.title}
                  </p>
                  <p className="text-xs fabro-muted leading-relaxed mt-0.5 line-clamp-2">
                    {toast.body}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissPushToast(toast.id)}
                aria-label="Cerrar notificación"
                className="w-7 h-7 rounded-lg flex items-center justify-center fabro-muted hover:text-[var(--fabro-text)] cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border">
              <button
                type="button"
                onClick={() => {
                  if (toast.target.sector === 'cultura' && toast.cultureNav) {
                    navigateToCultureSection(toast.cultureNav);
                  } else {
                    navigateTo(toast.target.sector, toast.target.submenu);
                  }
                  dismissPushToast(toast.id);
                }}
                className={`min-h-[32px] inline-flex items-center gap-1 text-xs font-bold hover:underline cursor-pointer ${accentText}`}
              >
                <span>{toast.actionLabel}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>

              {notificationPermission === 'default' && (
                <button
                  type="button"
                  onClick={() => void requestNotificationPermission()}
                  className="min-h-[32px] inline-flex items-center gap-1 text-[11px] font-semibold fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
                >
                  <BellRing className="w-3 h-3" />
                  <span>Activar push del dispositivo</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
