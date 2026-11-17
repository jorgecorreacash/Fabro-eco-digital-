import React from 'react';
import { Crown, RefreshCw, Sparkles } from 'lucide-react';
import { useAIGateway } from '../../context/AIGatewayContext';

interface FreemiumStatusCardProps {
  compact?: boolean;
}

export const FreemiumStatusCard: React.FC<FreemiumStatusCardProps> = ({ compact = false }) => {
  const { freemiumStatus, freemiumLoading, openPlansModal, refreshFreemiumStatus } = useAIGateway();

  if (!freemiumStatus) {
    return (
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Plan de FABRO IA y Consumo Diario
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {freemiumLoading ? 'Consultando estado actual de tu plan...' : 'Sincronizando cuota diaria de inteligencia artificial.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openPlansModal()}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ver planes
          </button>
        </div>
      </section>
    );
  }

  const isPremium = freemiumStatus.planTier === 'premium';
  const totalLimit = freemiumStatus.dailyLimit + freemiumStatus.extraCredits;
  const pct = totalLimit > 0 ? Math.min(100, Math.round((freemiumStatus.usedToday / totalLimit) * 100)) : 100;
  const exhausted = freemiumStatus.totalAvailableToday <= 0;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {isPremium ? (
            <Crown className="w-4 h-4 text-amber-500 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              Plan actual: {freemiumStatus.planLabel}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPremium
                ? 'Modelos avanzados, investigación profunda y comparación Multi-IA habilitados.'
                : 'Acceso gratuito a FABRO IA y modelos libres/abiertos.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void refreshFreemiumStatus()}
            disabled={freemiumLoading}
            aria-label="Actualizar estado de consultas"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${freemiumLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => openPlansModal()}
            className="rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isPremium ? 'Ver beneficios PREMIUM' : 'Conocer FABRO PREMIUM'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3">
          <p className="text-slate-500 dark:text-slate-400">Plan actual</p>
          <p className="font-display font-bold text-sm text-slate-900 dark:text-white mt-0.5">
            {freemiumStatus.planLabel}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3">
          <p className="text-slate-500 dark:text-slate-400">Consultas utilizadas</p>
          <p className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-white mt-0.5">
            {freemiumStatus.usedToday} de {freemiumStatus.dailyLimit}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3">
          <p className="text-slate-500 dark:text-slate-400">Consultas restantes</p>
          <p
            className={`font-mono tabular-nums font-bold text-sm mt-0.5 ${
              exhausted ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'
            }`}
          >
            {freemiumStatus.remainingToday}
            {freemiumStatus.extraCredits > 0 ? ` (+${freemiumStatus.extraCredits} extras)` : ''}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3">
          <p className="text-slate-500 dark:text-slate-400">Fecha y hora del próximo reinicio</p>
          <p className="font-mono tabular-nums font-semibold text-xs text-slate-800 dark:text-slate-200 mt-0.5">
            {freemiumStatus.nextResetFormatted}
          </p>
        </div>
      </div>

      {!compact && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            <span>Consumo diario ({pct}%)</span>
            <span>
              Máx. {freemiumStatus.maxInputChars.toLocaleString('es-AR')} caract. entrada · {freemiumStatus.maxOutputTokens.toLocaleString('es-AR')} tok. salida
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                exhausted ? 'bg-amber-500' : isPremium ? 'bg-amber-500' : 'bg-sky-600'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {exhausted && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
          <span>
            {isPremium
              ? 'Alcanzaste el límite diario de tu plan PREMIUM. Tus consultas se reinician automáticamente en la fecha indicada.'
              : 'Alcanzaste el límite diario de consultas gratuitas. Podés continuar mañana o conocer FABRO PREMIUM'}
          </span>
          {!isPremium && (
            <button
              type="button"
              onClick={() => openPlansModal('Alcanzaste el límite diario de consultas gratuitas. Podés continuar mañana o conocer FABRO PREMIUM')}
              className="font-semibold text-amber-900 dark:text-amber-100 underline cursor-pointer shrink-0"
            >
              Ver detalles
            </button>
          )}
        </div>
      )}
    </section>
  );
};
