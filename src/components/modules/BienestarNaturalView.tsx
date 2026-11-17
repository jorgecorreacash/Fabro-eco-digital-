import React, { useMemo, useState } from 'react';
import {
  Clover,
  Dumbbell,
  Flame,
  HeartPulse,
  Leaf,
  Star,
  Sun,
  Timer,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { getLocalTodayDateKey, useHabitTimer } from '../../context/HabitTimerContext';
import { useLastDay } from '../../context/LastDayContext';
import { CalorieCounterView } from './CalorieCounterView';
import { ExercisesLevelsView } from './ExercisesLevelsView';
import { HabitWellnessView } from './HabitWellnessView';
import { HoroscopeView } from './HoroscopeView';
import { LastDayView } from './LastDayView';
import { LuckyNumbersView } from './LuckyNumbersView';

type WellnessTabId =
  | 'resumen'
  | 'ultimo-dia'
  | 'calorias'
  | 'habitos'
  | 'ejercicios'
  | 'horoscopo'
  | 'suerte';

export const BienestarNaturalView: React.FC = () => {
  const { setActiveSection } = useFabro();
  const { dreams, writings, activities, reflections } = useLastDay();
  const { habits, calorieFoodEntries, calorieTarget } = useHabitTimer();

  const [tab, setTab] = useState<WellnessTabId>('resumen');
  const todayKey = getLocalTodayDateKey();
  const todayReflection = useMemo(
    () => reflections.find((r) => r.dateKey === todayKey) || reflections[0],
    [reflections, todayKey]
  );

  const completedTodayCount = useMemo(
    () => activities.filter((a) => a.status === 'completada').length,
    [activities]
  );

  const todayCaloriesConsumed = useMemo(
    () =>
      calorieFoodEntries
        .filter((f) => f.dateKey === todayKey)
        .reduce((acc, f) => acc + (f.calories || 0), 0),
    [calorieFoodEntries, todayKey]
  );

  const tabs: Array<{
    id: WellnessTabId;
    label: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'resumen', label: 'Visión General', icon: Leaf },
    { id: 'ultimo-dia', label: 'El Último Día de Tu Vida', icon: Sun },
    { id: 'calorias', label: 'Contador de Calorías', icon: Flame },
    { id: 'habitos', label: 'Organización, Hábitos y Nutrición', icon: Timer },
    { id: 'ejercicios', label: 'Salud y Ejercicios', icon: Dumbbell },
    { id: 'horoscopo', label: 'Horóscopos', icon: Star },
    { id: 'suerte', label: 'Números de la Suerte 🍀', icon: Clover },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-emerald-500/30 fabro-shell-surface p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                Sector 02 · Bienestar y Salud
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('inicio')}
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer whitespace-nowrap"
              >
                ← Volver a Inicio
              </button>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-[#FAF6EE] [text-wrap:balance]">
              Bienestar, Salud y El Último Día de Tu Vida
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              <em>«Si hoy fuera tu último día, ¿cómo elegirías vivirlo?»</em> — Reflexión estoica cotidiana, mi vida y legado privado, contador de calorías y hábitos, ejercicios con guías visuales y acompañamiento emocional responsable.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Herramienta orientativa de bienestar y prevención: no reemplaza diagnóstico médico ni atención clínica profesional.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-200 dark:divide-white/10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-[#070B17]/60 shrink-0 text-center">
            <div className="px-3.5 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Felicidad hoy</p>
              <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                {todayReflection?.happinessScore ?? '—'}/10
              </p>
            </div>
            <div className="px-3.5 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Calorías hoy</p>
              <p className="font-mono text-sm font-bold tabular-nums text-amber-600 dark:text-[#E5B842] mt-0.5">
                {todayCaloriesConsumed}/{calorieTarget}
              </p>
            </div>
            <div className="px-3.5 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Sueños · Escritos</p>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">
                {dreams.length} · {writings.length}
              </p>
            </div>
            <div className="px-3.5 py-2">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Metas de hoy</p>
              <p className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-[#FAF6EE] mt-0.5">
                {completedTodayCount}/{activities.length}
              </p>
            </div>
          </div>
        </div>

        {/* Sub-navigation */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/80 dark:border-white/10">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {tab === 'resumen' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[
            {
              id: 'ultimo-dia' as const,
              title: 'El Último Día de Tu Vida',
              meta: `${dreams.length} sueños · ${writings.length} escritos · Mi Legado privado`,
              desc: 'Reflexión diaria, registro emocional, actividades felices con traslado al día siguiente, recuerdos personales, Consejero IA y bóveda privada Mi Legado.',
              cta: 'Abrir El Último Día',
              icon: Sun,
              accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
            },
            {
              id: 'calorias' as const,
              title: 'Contador de Calorías',
              meta: `${todayCaloriesConsumed} / ${calorieTarget} kcal hoy · Macros y ejercicio`,
              desc: 'Calculá tu objetivo calórico diario, cargá comidas desde el catálogo rápido o manualmente y balanceá tus calorías quemadas.',
              cta: 'Abrir Contador de Calorías',
              icon: Flame,
              accent: 'text-amber-600 dark:text-[#E5B842] bg-amber-500/10',
            },
            {
              id: 'habitos' as const,
              title: 'Hábitos, Nutrición y Salud IA',
              meta: `${habits.length} rutinas configurables · Alertas sonoras`,
              desc: 'Temporizadores para rutinas de descanso, estudio y movimiento con alertas audibles, plan nutricional equilibrado y guía diaria.',
              cta: 'Abrir Hábitos y Nutrición',
              icon: HeartPulse,
              accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
            },
            {
              id: 'ejercicios' as const,
              title: 'Ejercicios con Niveles',
              meta: 'Inicial · Intermedio · Avanzado · Maestro',
              desc: 'Rutinas guiadas por intervalos con cronómetro en vivo, técnica de postura y registro histórico de minutos activos.',
              cta: 'Entrenar por niveles',
              icon: Dumbbell,
              accent: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
            },
            {
              id: 'horoscopo' as const,
              title: 'Horóscopos del Día',
              meta: '12 signos · Afinidad · Lectura diaria',
              desc: 'Pronóstico cotidiano enfocado en vínculos, concentración y cuidado personal según tu signo zodiacal.',
              cta: 'Ver mi horóscopo',
              icon: Star,
              accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
            },
            {
              id: 'suerte' as const,
              title: 'Números de la Suerte 🍀',
              meta: 'Trébol diario · Generador · Numerología',
              desc: 'Combinación personal diaria bajo el trébol de cuatro hojas, generador personalizable y cálculo numerológico.',
              cta: 'Generar números 🍀',
              icon: Clover,
              accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.id}
                className="rounded-xl border border-slate-200/90 dark:border-slate-800 fabro-shell-surface p-5 flex flex-col justify-between gap-4 hover:border-emerald-500/50 transition-colors"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-bold text-slate-900 dark:text-white leading-snug">
                        {card.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {card.meta}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {card.desc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab(card.id)}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {card.cta}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {tab === 'ultimo-dia' && <LastDayView />}
      {tab === 'calorias' && <CalorieCounterView embedded />}
      {tab === 'habitos' && <HabitWellnessView />}
      {tab === 'ejercicios' && <ExercisesLevelsView />}
      {tab === 'horoscopo' && <HoroscopeView />}
      {tab === 'suerte' && <LuckyNumbersView />}
    </div>
  );
};
