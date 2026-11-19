import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Droplets,
  Flame,
  Heart,
  Moon,
  SlidersHorizontal,
  Target,
  Trophy,
  Utensils,
  Wind,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import { useRadio } from '../../../../context/RadioContext';
import { DEFAULT_HYDRATION_SLEEP, vaultGet } from '../../../../services/localVault';
import { todayIsoDate } from '../../../../services/wellnessVault';
import type { HydrationSleepState } from '../../../../types/ecosystem';
import type {
  MyDayWidgetVisibility,
  WellnessNavId,
  WellnessStateSnapshot,
} from '../../../../types/wellness';
import { WellnessBarChart } from './WellnessCharts';

interface WellnessMyDayPanelProps {
  state: WellnessStateSnapshot;
  onNavigate: (id: WellnessNavId) => void;
  onUpdateState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
}

function lastNDaysIso(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
  }
  return days;
}

export const WellnessMyDayPanel: React.FC<WellnessMyDayPanelProps> = ({
  state,
  onNavigate,
  onUpdateState,
}) => {
  const { moodLogs, scheduledReminders, profile } = useEcosystem();
  const { openRadioModal } = useRadio();
  const [period, setPeriod] = useState<'dia' | 'semana' | 'mes'>('semana');
  const [showCustomize, setShowCustomize] = useState(false);
  const [hydration, setHydration] = useState<HydrationSleepState>(DEFAULT_HYDRATION_SLEEP);

  useEffect(() => {
    let active = true;
    void vaultGet<HydrationSleepState>('hydration_sleep', DEFAULT_HYDRATION_SLEEP).then((stored) => {
      if (active) setHydration(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const today = todayIsoDate();
  const widgets = state.privacySettings.myDayWidgets;

  const toggleWidget = (key: keyof MyDayWidgetVisibility) => {
    onUpdateState((prev) => ({
      ...prev,
      privacySettings: {
        ...prev.privacySettings,
        myDayWidgets: {
          ...prev.privacySettings.myDayWidgets,
          [key]: !prev.privacySettings.myDayWidgets[key],
        },
      },
    }));
  };

  const todayMeals = useMemo(
    () => state.mealLogs.filter((m) => m.date === today),
    [state.mealLogs, today]
  );
  const todayCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0);
  const todayProtein = Math.round(todayMeals.reduce((sum, m) => sum + m.proteinG, 0));

  const todayWorkouts = useMemo(
    () => state.workoutLogs.filter((w) => w.date === today),
    [state.workoutLogs, today]
  );
  const todayWorkoutMin = todayWorkouts.reduce((sum, w) => sum + w.durationMin, 0);

  const latestSleep = state.sleepLogs.find((s) => s.date === today) || state.sleepLogs[0] || null;
  const latestEmotion = state.emotionEntries[0] || null;
  const activeHabits = state.dailyHabits.filter((h) => !h.archived);
  const habitsDoneToday = activeHabits.filter((h) => h.completedDates.includes(today)).length;
  const pendingGoals = state.personalGoals.filter((g) => !g.completed);
  const activeChallenges = state.challenges.filter((c) => c.active);
  const upcomingAppointments = state.medicalAppointments
    .filter((a) => !a.completed && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  const chartDays = useMemo(() => {
    if (period === 'dia') return [today];
    if (period === 'semana') return lastNDaysIso(7);
    return lastNDaysIso(14);
  }, [period, today]);

  const calorieSeries = useMemo(
    () =>
      chartDays.map((day) => ({
        label: day.slice(5),
        value: state.mealLogs
          .filter((m) => m.date === day)
          .reduce((acc, m) => acc + m.calories, 0),
      })),
    [chartDays, state.mealLogs]
  );

  const movementSeries = useMemo(
    () =>
      chartDays.map((day) => ({
        label: day.slice(5),
        value: state.workoutLogs
          .filter((w) => w.date === day)
          .reduce((acc, w) => acc + w.durationMin, 0),
      })),
    [chartDays, state.workoutLogs]
  );

  const sleepSeries = useMemo(
    () =>
      chartDays.map((day) => {
        const entry = state.sleepLogs.find((s) => s.date === day);
        return {
          label: day.slice(5),
          value: entry ? entry.durationHours : 0,
        };
      }),
    [chartDays, state.sleepLogs]
  );

  const waterTodayMl = hydration.date === today ? hydration.waterMl : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border fabro-border fabro-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#059669] dark:text-[#34D399]">
            01 · Centro de control diario · El Último Día de Tu Vida
          </p>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
            Mi día en FABRO Bienestar
          </h2>
          <p className="text-xs fabro-muted max-w-2xl">
            {profile.displayName ? `Hola, ${profile.displayName}. ` : ''}
            Resumen real basado únicamente en los registros que cargaste hoy ({today}). Sin datos inventados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('fabro-respira')}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#059669] bg-[#059669] text-white px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Wind className="w-3.5 h-3.5" />
            Pausa Respira
          </button>
          <button
            type="button"
            onClick={() => setShowCustomize((v) => !v)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Personalizar vista
          </button>
        </div>
      </section>

      {showCustomize && (
        <section className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs">
          <p className="font-semibold">Elegí qué bloques mostrar en «Mi día»:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(
              [
                ['nutrition', 'Nutrición'],
                ['hydration', 'Hidratación'],
                ['fitness', 'Actividad física'],
                ['sleep', 'Sueño'],
                ['mood', 'Estado de ánimo'],
                ['habits', 'Hábitos'],
                ['goals', 'Metas'],
                ['challenges', 'Desafíos'],
                ['agenda', 'Agenda próxima'],
              ] as Array<[keyof MyDayWidgetVisibility, string]>
            ).map(([k, label]) => (
              <label
                key={k}
                className="flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={widgets[k]}
                  onChange={() => toggleWidget(k)}
                  className="accent-[#059669]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {widgets.nutrition && (
          <button
            type="button"
            onClick={() => onNavigate('nutricion')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-2 hover:border-[#D97706] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Utensils className="w-3.5 h-3.5 text-[#D97706]" />
                Alimentación hoy
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {todayCalories} <span className="text-xs font-normal fabro-muted">kcal</span>
            </p>
            <p className="text-[11px] fabro-muted font-mono tabular-nums">
              Meta {state.nutritionPrefs.dailyCalorieGoal} kcal · Proteína {todayProtein} g · {todayMeals.length} registros
            </p>
          </button>
        )}

        {widgets.hydration && (
          <button
            type="button"
            onClick={() => onNavigate('sueno-descanso')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-2 hover:border-[#0284C7] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Droplets className="w-3.5 h-3.5 text-[#0284C7]" />
                Hidratación hoy
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {waterTodayMl} <span className="text-xs font-normal fabro-muted">ml</span>
            </p>
            <p className="text-[11px] fabro-muted font-mono tabular-nums">
              Meta diaria: {hydration.waterGoalMl} ml ({Math.min(100, Math.round((waterTodayMl / Math.max(1, hydration.waterGoalMl)) * 100))}%)
            </p>
          </button>
        )}

        {widgets.fitness && (
          <button
            type="button"
            onClick={() => onNavigate('actividad-fisica')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-2 hover:border-[#0284C7] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Activity className="w-3.5 h-3.5 text-[#0284C7]" />
                Movimiento hoy
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {todayWorkoutMin} <span className="text-xs font-normal fabro-muted">min</span>
            </p>
            <p className="text-[11px] fabro-muted font-mono tabular-nums">
              {todayWorkouts.length} sesiones hoy · {state.workoutLogs.length} totales
            </p>
          </button>
        )}

        {widgets.sleep && (
          <button
            type="button"
            onClick={() => onNavigate('sueno-descanso')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-2 hover:border-[#0F766E] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Moon className="w-3.5 h-3.5 text-[#0F766E]" />
                Último descanso
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {latestSleep ? `${latestSleep.durationHours} h` : '—'}
            </p>
            <p className="text-[11px] fabro-muted font-mono tabular-nums">
              {latestSleep
                ? `${latestSleep.date} · Calidad ${latestSleep.quality}/5`
                : `Sin noches registradas (meta ${state.sleepPrefs.targetHours} h)`}
            </p>
          </button>
        )}

        {widgets.mood && (
          <button
            type="button"
            onClick={() => onNavigate('mente-emociones')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-2 hover:border-[#4F46E5] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Heart className="w-3.5 h-3.5 text-[#4F46E5]" />
                Ánimo y claridad
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {latestEmotion ? `${latestEmotion.moodScore}/10` : moodLogs[0] ? `${moodLogs[0].score}/10` : '—'}
            </p>
            <p className="text-[11px] fabro-muted truncate">
              {latestEmotion
                ? `${latestEmotion.moodLabel} (${latestEmotion.date})`
                : moodLogs[0]
                ? `${moodLogs[0].emotion} (registro previo)`
                : 'Privado por defecto · Registrá cómo te sentís'}
            </p>
          </button>
        )}

        {widgets.habits && (
          <button
            type="button"
            onClick={() => onNavigate('desarrollo-personal')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-2 hover:border-[#7C3AED] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                Hábitos diarios
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">
              {habitsDoneToday}/{activeHabits.length}
            </p>
            <p className="text-[11px] fabro-muted">
              {activeHabits.length === 0 ? 'Creá tu primer hábito diario' : 'Marcados hoy'}
            </p>
          </button>
        )}

        {widgets.goals && (
          <button
            type="button"
            onClick={() => onNavigate('desarrollo-personal')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-2 hover:border-[#7C3AED] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Target className="w-3.5 h-3.5 text-[#7C3AED]" />
                Metas pendientes
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">{pendingGoals.length}</p>
            <p className="text-[11px] fabro-muted truncate">
              {pendingGoals[0] ? `Próxima: ${pendingGoals[0].title}` : 'Sin metas abiertas todavía'}
            </p>
          </button>
        )}

        {widgets.challenges && (
          <button
            type="button"
            onClick={() => onNavigate('fabro-desafios')}
            className="rounded-2xl border fabro-border fabro-surface p-4 text-left space-y-2 hover:border-[#EA580C] transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs fabro-muted">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Trophy className="w-3.5 h-3.5 text-[#EA580C]" />
                FABRO Desafíos
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
            <p className="font-mono text-2xl font-bold tabular-nums">{activeChallenges.length}</p>
            <p className="text-[11px] fabro-muted truncate">
              {activeChallenges[0] ? activeChallenges[0].title : 'Retos voluntarios disponibles'}
            </p>
          </button>
        )}
      </section>

      {/* Period Filter & Real-Data Charts */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold">Evolución real de tus registros</h3>
            <p className="text-xs fabro-muted">
              Gráficos generados directamente desde tu base local en IndexedDB.
            </p>
          </div>
          <div className="inline-flex rounded-xl border fabro-border fabro-surface p-1 text-xs">
            {(
              [
                ['dia', 'Hoy'],
                ['semana', '7 días'],
                ['mes', '14 días'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPeriod(id)}
                className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition-colors ${
                  period === id
                    ? 'bg-[#059669] text-white'
                    : 'fabro-muted hover:text-[var(--fabro-text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <WellnessBarChart
            title="Calorías registradas"
            subtitle="Suma diaria desde Nutrición"
            data={calorieSeries}
            accentColor="#D97706"
            unit="kcal"
            goalValue={state.nutritionPrefs.dailyCalorieGoal}
            emptyMessage="Registrá una comida en «2. Nutrición» para ver tu balance diario."
          />
          <WellnessBarChart
            title="Minutos de actividad física"
            subtitle="Sesiones guardadas en Entrenamiento"
            data={movementSeries}
            accentColor="#0284C7"
            unit="min"
            emptyMessage="Registrá una sesión en «3. Actividad física» para ver tus minutos activos."
          />
          <WellnessBarChart
            title="Horas de descanso"
            subtitle="Registros desde Sueño y descanso"
            data={sleepSeries}
            accentColor="#0F766E"
            unit="h"
            goalValue={state.sleepPrefs.targetHours}
            emptyMessage="Cargá una noche en «5. Sueño y descanso» para ver tu regularidad."
          />
        </div>
      </section>

      {/* Upcoming Agenda & Quick Actions */}
      {widgets.agenda && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                Próximos turnos y recordatorios
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('agenda-objetivos')}
                className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
              >
                Abrir Agenda →
              </button>
            </div>
            {upcomingAppointments.length === 0 && scheduledReminders.length === 0 ? (
              <p className="text-xs fabro-muted">
                No tenés turnos médicos ni recordatorios activos hoy. Podés programarlos en «11. Agenda y objetivos» o «6. Salud y prevención».
              </p>
            ) : (
              <div className="divide-y fabro-border text-xs">
                {upcomingAppointments.map((app) => (
                  <div key={app.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{app.specialty}</p>
                      <p className="fabro-muted text-[11px]">
                        {app.professional || 'Control médico'} {app.location ? `· ${app.location}` : ''}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-[11px] fabro-muted shrink-0">
                      {app.date} {app.time}
                    </span>
                  </div>
                ))}
                {scheduledReminders.slice(0, 3).map((r) => (
                  <div key={r.id} className="py-2 flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{r.title}</span>
                    <span className="font-mono tabular-nums text-[11px] fabro-muted shrink-0">
                      {new Date(r.triggerAtMs).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="font-display text-sm font-bold flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#059669]" />
              Accesos directos de bienestar
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(
                [
                  ['fabro-deportes', 'Abrir FABRO DEPORTES'],
                  ['nutricion', 'Registrar comida / escanear'],
                  ['actividad-fisica', 'Iniciar entrenamiento'],
                  ['mente-emociones', 'Diario y Estoicismo'],
                  ['fabro-coach', 'Consultar a FABRO COACH'],
                  ['mi-historial', 'Exportar historial PDF'],
                  ['primeros-auxilios', 'Guía de Primeros Auxilios'],
                ] as Array<[WellnessNavId, string]>
              ).map(([target, label]) => (
                <button
                  key={target}
                  type="button"
                  onClick={() => onNavigate(target)}
                  className={`min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-left font-medium transition-colors cursor-pointer ${
                    target === 'fabro-deportes'
                      ? 'col-span-2 border-[#0284C7]/45 text-[#0284C7] dark:text-[#38BDF8] font-semibold hover:border-[#0284C7]'
                      : 'hover:border-[#059669]'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => openRadioModal()}
                className="col-span-2 min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 py-2 text-left font-semibold hover:border-[#0284C7] transition-colors cursor-pointer"
              >
                Radio Digital AM / FM en vivo
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
