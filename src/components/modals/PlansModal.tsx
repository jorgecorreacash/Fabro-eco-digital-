import React from 'react';
import { Check, Crown, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import type { FreemiumStatus } from '../../types/fabro';

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  freemiumStatus: FreemiumStatus | null;
  limitMessage?: string;
}

export const PlansModal: React.FC<PlansModalProps> = ({
  isOpen,
  onClose,
  freemiumStatus,
  limitMessage,
}) => {
  if (!isOpen) return null;

  const isPremium = freemiumStatus?.planTier === 'premium';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Planes de FABRO IA"
    >
      <div className="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-sky-500" />
              Planes de FABRO IA — Acceso Académico
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toda la plataforma educativa de FABRO (apuntes, materias, cursos, comunidad, biblioteca y buscador de fuentes) sigue siendo abierta y gratuita.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {limitMessage && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
            <p className="font-semibold">{limitMessage}</p>
            {freemiumStatus?.nextResetFormatted && (
              <p className="mt-1 opacity-90 font-mono tabular-nums">
                Próximo reinicio automático: {freemiumStatus.nextResetFormatted}
              </p>
            )}
          </div>
        )}

        {freemiumStatus && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Plan actual</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                {freemiumStatus.planLabel}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Consultas utilizadas</p>
              <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-white mt-0.5">
                {freemiumStatus.usedToday} de {freemiumStatus.dailyLimit}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Consultas restantes</p>
              <p className="font-mono tabular-nums font-bold text-sky-600 dark:text-sky-400 mt-0.5">
                {freemiumStatus.remainingToday}
                {freemiumStatus.extraCredits > 0 ? ` (+${freemiumStatus.extraCredits} cr.)` : ''}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Próximo reinicio</p>
              <p className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                {freemiumStatus.nextResetFormatted}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Plan Gratuito */}
          <div
            className={`rounded-2xl border p-5 space-y-4 ${
              !isPremium
                ? 'border-sky-500/60 bg-sky-500/5'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B111C]'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                  PLAN GRATUITO
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ideal para consultas académicas diarias
                </p>
              </div>
              {!isPremium && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Activo
                </span>
              )}
            </div>

            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              $0 <span className="text-xs font-normal text-slate-500">/ mes</span>
            </div>

            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>5 consultas de IA por día por usuario registrado</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Acceso a FABRO IA: resúmenes, explicaciones y ayuda académica</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Acceso a modelos gratuitos disponibles (Google Gemini Flash Lite y Hydrogen)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Historial completo de consultas y guardado directo en Apuntes</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>Reinicio diario automático y sin descuento por errores del servidor</span>
              </li>
            </ul>
          </div>

          {/* Plan Premium */}
          <div
            className={`rounded-2xl border p-5 space-y-4 ${
              isPremium
                ? 'border-amber-500/70 bg-amber-500/10'
                : 'border-cyan-500/40 bg-gradient-to-br from-sky-500/10 via-transparent to-cyan-500/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-500" />
                  FABRO PREMIUM
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Máxima profundidad investigativa y multi-IA
                </p>
              </div>
              {isPremium && (
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Activo
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                50
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                consultas diarias iniciales (ampliables)
              </span>
            </div>

            <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>Acceso a modelos avanzados (ChatGPT / OpenAI GPT-4o y GPT-4o mini + Gemini Profundo)</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>Investigación profunda y lectura ampliada de documentos extensos</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>Comparación paralela entre múltiples inteligencias artificiales</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>Estudio de generación/edición de imágenes de alta calidad (Nano Banana 2.1)</span>
              </li>
              <li className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                <span>Prioridad de procesamiento y límites extendidos de contexto</span>
              </li>
            </ul>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#090D16] p-3 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
              <span>
                {isPremium
                  ? 'Tu cuenta tiene habilitado FABRO PREMIUM. Si necesitás más consultas o créditos institucionales, contactá al equipo de administración.'
                  : 'La activación de FABRO PREMIUM y la asignación de créditos adicionales se gestionan de forma centralizada desde la administración de la plataforma.'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 dark:bg-sky-600 px-5 py-2 text-xs font-semibold text-white hover:opacity-90 cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
