import React, { useState } from 'react';
import { ChevronDown, ChevronUp, KeyRound, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  findByokKeyForWellnessEngine,
  WELLNESS_EQUIPMENT_LABELS,
  WELLNESS_GOAL_LABELS,
  WELLNESS_LEVEL_LABELS,
} from '../../../services/wellnessAiService';
import type {
  WellnessEquipmentId,
  WellnessGoalId,
  WellnessLevelId,
} from '../../../types/ecosystem';

export const WellnessAiHeaderBar: React.FC = () => {
  const {
    byokKeys,
    getByokSecret,
    wellnessAiEngine,
    setWellnessAiEngine,
    wellnessPhysicalProfile,
    updateWellnessPhysicalProfile,
    navigateTo,
  } = useEcosystem();

  const [profileOpen, setProfileOpen] = useState(false);

  const geminiReady = Boolean(findByokKeyForWellnessEngine(byokKeys, getByokSecret, 'gemini'));
  const openaiReady = Boolean(findByokKeyForWellnessEngine(byokKeys, getByokSecret, 'openai'));
  const activeReady = wellnessAiEngine === 'gemini' ? geminiReady : openaiReady;

  return (
    <section className="rounded-2xl border fabro-surface p-3.5 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* 1-Tap Motor Switcher: Gemini / ChatGPT */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold inline-flex items-center gap-1.5 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-[#10B981]" />
            Asistente IA (BYOK):
          </span>

          <div className="inline-flex rounded-xl border fabro-border fabro-surface-elevated p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setWellnessAiEngine('gemini')}
              className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition-all ${
                wellnessAiEngine === 'gemini'
                  ? 'bg-[#10B981] text-white shadow-xs'
                  : 'fabro-muted hover:text-current'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  geminiReady
                    ? wellnessAiEngine === 'gemini'
                      ? 'bg-white'
                      : 'bg-emerald-500'
                    : 'bg-amber-400'
                }`}
              />
              Gemini
            </button>
            <button
              type="button"
              onClick={() => setWellnessAiEngine('openai')}
              className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold cursor-pointer transition-all ${
                wellnessAiEngine === 'openai'
                  ? 'bg-[#0EA5E9] text-white shadow-xs'
                  : 'fabro-muted hover:text-current'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  openaiReady
                    ? wellnessAiEngine === 'openai'
                      ? 'bg-white'
                      : 'bg-emerald-500'
                    : 'bg-amber-400'
                }`}
              />
              ChatGPT
            </button>
          </div>

          {!activeReady && (
            <button
              type="button"
              onClick={() => navigateTo('ia', 'claves-byok')}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2.5 py-1 text-[11px] font-bold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Cargar clave {wellnessAiEngine === 'gemini' ? 'Gemini' : 'ChatGPT'}
            </button>
          )}
        </div>

        {/* Collapsible Quick Physical Profile Trigger */}
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated hover:border-[#10B981] px-3 py-1.5 text-xs font-semibold cursor-pointer active:scale-95 whitespace-nowrap"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#10B981]" />
          Perfil físico rápido (local)
          {profileOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Summary line when collapsed */}
      {!profileOpen && (
        <p className="text-[11px] fabro-muted leading-relaxed">
          Contexto automático:{' '}
          <strong className="font-semibold">
            {WELLNESS_GOAL_LABELS[wellnessPhysicalProfile.goal]}
          </strong>{' '}
          · {WELLNESS_LEVEL_LABELS[wellnessPhysicalProfile.level]} ·{' '}
          {WELLNESS_EQUIPMENT_LABELS[wellnessPhysicalProfile.equipment]}
          {wellnessPhysicalProfile.age ? ` · ${wellnessPhysicalProfile.age} años` : ''}
          {wellnessPhysicalProfile.dietPreferences
            ? ` · ${wellnessPhysicalProfile.dietPreferences}`
            : ''}
        </p>
      )}

      {/* Collapsible 100% Local Physical Profile Card */}
      {profileOpen && (
        <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 sm:p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-[#047857] dark:text-[#34D399]">
              Perfil físico rápido (Opcional · 100% privado y local)
            </p>
            <span className="text-[11px] fabro-muted">
              Se envía solo a tu clave BYOK cuando generás un plan.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <label className="space-y-1 block">
              <span className="font-semibold fabro-muted">Edad (opcional)</span>
              <input
                type="number"
                min={12}
                max={99}
                value={wellnessPhysicalProfile.age}
                onChange={(e) => updateWellnessPhysicalProfile({ age: e.target.value })}
                placeholder="Ej: 26"
                className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-3 py-1.5 text-xs fabro-input"
              />
            </label>

            <label className="space-y-1 block">
              <span className="font-semibold fabro-muted">Objetivo principal</span>
              <select
                value={wellnessPhysicalProfile.goal}
                onChange={(e) =>
                  updateWellnessPhysicalProfile({ goal: e.target.value as WellnessGoalId })
                }
                className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-2.5 py-1.5 text-xs font-medium outline-none"
              >
                {(Object.keys(WELLNESS_GOAL_LABELS) as WellnessGoalId[]).map((g) => (
                  <option key={g} value={g} className="text-slate-900">
                    {WELLNESS_GOAL_LABELS[g]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="font-semibold fabro-muted">Nivel físico</span>
              <select
                value={wellnessPhysicalProfile.level}
                onChange={(e) =>
                  updateWellnessPhysicalProfile({ level: e.target.value as WellnessLevelId })
                }
                className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-2.5 py-1.5 text-xs font-medium outline-none"
              >
                {(Object.keys(WELLNESS_LEVEL_LABELS) as WellnessLevelId[]).map((lvl) => (
                  <option key={lvl} value={lvl} className="text-slate-900">
                    {WELLNESS_LEVEL_LABELS[lvl]}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 block">
              <span className="font-semibold fabro-muted">Equipamiento disponible</span>
              <select
                value={wellnessPhysicalProfile.equipment}
                onChange={(e) =>
                  updateWellnessPhysicalProfile({
                    equipment: e.target.value as WellnessEquipmentId,
                  })
                }
                className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-2.5 py-1.5 text-xs font-medium outline-none"
              >
                {(Object.keys(WELLNESS_EQUIPMENT_LABELS) as WellnessEquipmentId[]).map((eq) => (
                  <option key={eq} value={eq} className="text-slate-900">
                    {WELLNESS_EQUIPMENT_LABELS[eq]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="font-semibold fabro-muted">
              Preferencias, alergias alimentarias o limitaciones articulares (opcional)
            </span>
            <input
              type="text"
              value={wellnessPhysicalProfile.dietPreferences}
              onChange={(e) => updateWellnessPhysicalProfile({ dietPreferences: e.target.value })}
              placeholder="Ej: Sin lactosa, vegetariano, presupuesto económico, cuidar rodilla derecha..."
              className="min-h-[40px] w-full rounded-xl border fabro-border fabro-surface px-3 py-1.5 text-xs fabro-input"
            />
          </label>
        </div>
      )}
    </section>
  );
};
