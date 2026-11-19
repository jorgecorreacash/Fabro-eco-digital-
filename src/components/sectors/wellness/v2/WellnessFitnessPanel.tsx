import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Dumbbell,
  ExternalLink,
  Film,
  ListPlus,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Timer,
  Trash2,
} from 'lucide-react';
import { EXERCISE_LIBRARY, FITNESS_CATEGORIES } from '../../../../data/wellnessCatalog';
import { playSoftBell } from '../../../../services/webAudioPtt';
import { todayIsoDate } from '../../../../services/wellnessVault';
import type {
  CustomWorkoutRoutine,
  ExerciseDefinition,
  FitnessCategoryId,
  RoutineExerciseStep,
  WellnessStateSnapshot,
  WorkoutSessionRecord,
} from '../../../../types/wellness';
import { CalisthenicsTimerTool } from '../CalisthenicsTimerTool';
import { WellnessAiStudioPanel } from '../WellnessAiStudioPanel';
import { WellnessVideoLibraryPanel } from '../WellnessVideoLibraryPanel';
import { WellnessBarChart } from './WellnessCharts';

interface WellnessFitnessPanelProps {
  state: WellnessStateSnapshot;
  onUpdateState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
}

type FitnessSubTab = 'biblioteca' | 'rutinas' | 'sesion-contador' | 'temporizador' | 'videos-ia';

export const WellnessFitnessPanel: React.FC<WellnessFitnessPanelProps> = ({
  state,
  onUpdateState,
}) => {
  const [subTab, setSubTab] = useState<FitnessSubTab>('biblioteca');
  const [selectedCategory, setSelectedCategory] = useState<'todas' | FitnessCategoryId>('todas');
  const [difficultyFilter, setDifficultyFilter] = useState<'Todas' | ExerciseDefinition['difficulty']>('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeExercise, setActiveExercise] = useState<ExerciseDefinition>(EXERCISE_LIBRARY[0]);

  // Routine builder
  const [routineName, setRoutineName] = useState('');
  const [routineCat, setRoutineCat] = useState<FitnessCategoryId>('fuerza');
  const [routineDifficulty, setRoutineDifficulty] = useState<CustomWorkoutRoutine['difficulty']>('Principiante');
  const [draftSteps, setDraftSteps] = useState<RoutineExerciseStep[]>([]);

  // Live session + Manual rep counter + Rest timer
  const [sessionRoutineName, setSessionRoutineName] = useState('');
  const [sessionCat, setSessionCat] = useState<FitnessCategoryId>('fuerza');
  const [sessionDurationMin, setSessionDurationMin] = useState('30');
  const [sessionRpe, setSessionRpe] = useState(6);
  const [sessionNotes, setSessionNotes] = useState('');
  const [repCount, setRepCount] = useState(0);
  const [setCount, setSetCount] = useState(0);
  const [restSeconds, setRestSeconds] = useState(45);
  const [restRunning, setRestRunning] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!restRunning) return;
    const id = window.setInterval(() => {
      setRestSeconds((prev) => {
        if (prev <= 1) {
          setRestRunning(false);
          playSoftBell('break-end');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [restRunning]);

  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const allExercises = useMemo(
    () => [...state.customExercises, ...EXERCISE_LIBRARY],
    [state.customExercises]
  );

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allExercises.filter((ex) => {
      const catOk = selectedCategory === 'todas' || ex.category === selectedCategory;
      const diffOk = difficultyFilter === 'Todas' || ex.difficulty === difficultyFilter;
      const qOk =
        !q ||
        ex.name.toLowerCase().includes(q) ||
        ex.muscles.some((m) => m.toLowerCase().includes(q)) ||
        ex.equipment.toLowerCase().includes(q);
      return catOk && diffOk && qOk;
    });
  }, [allExercises, selectedCategory, difficultyFilter, searchQuery]);

  const addExerciseToDraftRoutine = (ex: ExerciseDefinition) => {
    setDraftSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        exerciseId: ex.id,
        name: ex.name,
        sets: ex.defaultSets,
        reps: ex.defaultReps,
        restSec: ex.defaultRestSec,
      },
    ]);
    notify(`«${ex.name}» sumado al borrador de rutina.`);
  };

  const handleSaveRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineName.trim() || draftSteps.length === 0) return;
    const routine: CustomWorkoutRoutine = {
      id: `rt-${Date.now()}`,
      name: routineName.trim(),
      category: routineCat,
      estimatedMin: Math.max(10, draftSteps.length * 6),
      difficulty: routineDifficulty,
      exercises: draftSteps,
      createdAt: todayIsoDate(),
    };
    onUpdateState((prev) => ({
      ...prev,
      customRoutines: [routine, ...prev.customRoutines],
    }));
    setRoutineName('');
    setDraftSteps([]);
    notify(`Rutina «${routine.name}» guardada en tu gimnasio digital.`);
  };

  const handleLogWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    const record: WorkoutSessionRecord = {
      id: `wlog-${Date.now()}`,
      date: todayIsoDate(),
      routineName: sessionRoutineName.trim() || 'Entrenamiento general',
      category: sessionCat,
      durationMin: Math.max(1, Number(sessionDurationMin) || 20),
      totalReps: repCount > 0 ? repCount : undefined,
      effortRpe: sessionRpe,
      notes: sessionNotes.trim() || undefined,
    };
    onUpdateState((prev) => ({
      ...prev,
      workoutLogs: [record, ...prev.workoutLogs],
    }));
    setSessionRoutineName('');
    setSessionNotes('');
    setRepCount(0);
    setSetCount(0);
    notify(`Sesión «${record.routineName}» (${record.durationMin} min) guardada en tu historial.`);
  };

  const last7WorkoutSeries = useMemo(() => {
    const arr: Array<{ label: string; value: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      arr.push({
        label: iso.slice(5),
        value: state.workoutLogs
          .filter((w) => w.date === iso)
          .reduce((acc, w) => acc + w.durationMin, 0),
      });
    }
    return arr;
  }, [state.workoutLogs]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
              03 · Actividad física y entrenamiento
            </p>
            <h2 className="font-display text-xl font-bold">
              Gimnasio digital, 15 categorías, rutinas y contador manual
            </h2>
          </div>
          <div className="text-xs font-mono tabular-nums fabro-muted">
            {state.workoutLogs.length} sesiones · {state.customRoutines.length} rutinas propias
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-t fabro-border pt-3 text-xs">
          {(
            [
              ['biblioteca', 'Biblioteca (15 áreas)', Dumbbell],
              ['rutinas', 'Armador de rutinas', ListPlus],
              ['sesion-contador', 'Registrar sesión y reps', Activity],
              ['temporizador', 'Intervalos / Calistenia', Timer],
              ['videos-ia', 'Videoteca y Entrenador IA', Film],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-semibold cursor-pointer transition-colors ${
                subTab === id
                  ? 'border-[#0284C7] bg-[#0284C7] text-white'
                  : 'fabro-border fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {feedback && (
          <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399] flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {feedback}
          </p>
        )}
      </section>

      {subTab === 'biblioteca' && (
        <div className="space-y-4">
          {/* 15 Categories Bar */}
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ejercicio, músculo o equipamiento..."
                className="flex-1 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <select
                value={difficultyFilter}
                onChange={(e) =>
                  setDifficultyFilter(e.target.value as 'Todas' | ExerciseDefinition['difficulty'])
                }
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              >
                <option value="Todas">Todas las dificultades</option>
                <option value="Principiante">Principiante</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('todas')}
                className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                  selectedCategory === 'todas'
                    ? 'bg-[#0284C7] text-white'
                    : 'fabro-surface-elevated fabro-muted'
                }`}
              >
                Todas ({allExercises.length})
              </button>
              {FITNESS_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#0284C7] text-white font-semibold'
                      : 'fabro-surface-elevated fabro-muted hover:text-[var(--fabro-text)]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
            <div className="lg:col-span-5 rounded-2xl border fabro-border fabro-surface p-3 divide-y fabro-border max-h-[520px] overflow-y-auto">
              {filteredExercises.map((ex) => {
                const selected = activeExercise.id === ex.id;
                const catLabel =
                  FITNESS_CATEGORIES.find((c) => c.id === ex.category)?.label || ex.category;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setActiveExercise(ex)}
                    className={`w-full py-3 px-2.5 text-left flex items-start justify-between gap-2 cursor-pointer rounded-xl transition-colors ${
                      selected ? 'bg-[#0284C7]/10' : 'hover:bg-[var(--fabro-surface-2)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{ex.name}</p>
                      <p className="text-[11px] fabro-muted">
                        {catLabel} · {ex.difficulty} · {ex.equipment}
                      </p>
                    </div>
                    <span className="font-mono text-[11px] fabro-muted shrink-0">
                      {ex.defaultSets}×{ex.defaultReps}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-7 rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
                    {FITNESS_CATEGORIES.find((c) => c.id === activeExercise.category)?.label} ·{' '}
                    {activeExercise.difficulty}
                  </p>
                  <h3 className="font-display text-lg font-bold mt-0.5">{activeExercise.name}</h3>
                  <p className="fabro-muted mt-1">
                    Músculos implicados: {activeExercise.muscles.join(', ')} · Equipamiento:{' '}
                    {activeExercise.equipment}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addExerciseToDraftRoutine(activeExercise)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#0284C7] text-white px-3.5 font-semibold cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Sumar a rutina
                </button>
              </div>

              <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-2">
                <p className="font-semibold">Ejecución técnica paso a paso</p>
                <ol className="list-decimal pl-5 space-y-1.5 leading-relaxed">
                  {activeExercise.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                <p className="font-mono text-[11px] fabro-muted pt-1">
                  Referencia inicial: {activeExercise.defaultSets} series · {activeExercise.defaultReps} · Descanso {activeExercise.defaultRestSec} s
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/35 bg-amber-500/5 p-3.5 flex items-start gap-2 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Precaución y seguridad articular</p>
                  <p className="mt-0.5">{activeExercise.precautions}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border">
                <a
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                    activeExercise.videoSearchQuery
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Buscar demostración técnica en YouTube
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setSessionRoutineName(activeExercise.name);
                    setSessionCat(activeExercise.category);
                    setSubTab('sesion-contador');
                  }}
                  className="text-xs font-semibold text-[#059669] hover:underline cursor-pointer"
                >
                  Practicar con contador manual →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'rutinas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
          <form
            onSubmit={handleSaveRoutine}
            className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3"
          >
            <h3 className="text-sm font-bold">Constructor de rutina personalizada</h3>
            <input
              type="text"
              value={routineName}
              onChange={(e) => setRoutineName(e.target.value)}
              placeholder="Nombre de la rutina (ej. Full Body Lunes y Jueves)"
              required
              className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={routineCat}
                onChange={(e) => setRoutineCat(e.target.value as FitnessCategoryId)}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                {FITNESS_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={routineDifficulty}
                onChange={(e) =>
                  setRoutineDifficulty(e.target.value as CustomWorkoutRoutine['difficulty'])
                }
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              >
                <option value="Principiante">Principiante</option>
                <option value="Intermedio">Intermedio</option>
                <option value="Avanzado">Avanzado</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Ejercicios en el borrador ({draftSteps.length})</p>
                <button
                  type="button"
                  onClick={() =>
                    setDraftSteps((prev) => [
                      ...prev,
                      {
                        id: `custom-step-${Date.now()}`,
                        name: 'Ejercicio libre',
                        sets: 3,
                        reps: '12 reps',
                        restSec: 60,
                      },
                    ])
                  }
                  className="text-[#0284C7] font-semibold cursor-pointer"
                >
                  + Agregar fila libre
                </button>
              </div>
              {draftSteps.length === 0 ? (
                <p className="fabro-muted">
                  Sumá ejercicios desde la pestaña «Biblioteca» o agregá una fila libre arriba.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {draftSteps.map((step) => (
                    <div
                      key={step.id}
                      className="rounded-xl border fabro-border fabro-surface-elevated p-2.5 grid grid-cols-12 gap-1.5 items-center"
                    >
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) =>
                          setDraftSteps((prev) =>
                            prev.map((s) => (s.id === step.id ? { ...s, name: e.target.value } : s))
                          )
                        }
                        className="col-span-5 rounded-lg border fabro-border fabro-surface px-2 py-1 fabro-input"
                      />
                      <input
                        type="number"
                        min={1}
                        value={step.sets}
                        onChange={(e) =>
                          setDraftSteps((prev) =>
                            prev.map((s) =>
                              s.id === step.id ? { ...s, sets: Math.max(1, Number(e.target.value) || 1) } : s
                            )
                          )
                        }
                        title="Series"
                        className="col-span-2 rounded-lg border fabro-border fabro-surface px-2 py-1 font-mono fabro-input"
                      />
                      <input
                        type="text"
                        value={step.reps}
                        onChange={(e) =>
                          setDraftSteps((prev) =>
                            prev.map((s) => (s.id === step.id ? { ...s, reps: e.target.value } : s))
                          )
                        }
                        title="Repeticiones"
                        className="col-span-2 rounded-lg border fabro-border fabro-surface px-2 py-1 font-mono fabro-input"
                      />
                      <input
                        type="number"
                        min={0}
                        value={step.weightKg ?? ''}
                        onChange={(e) =>
                          setDraftSteps((prev) =>
                            prev.map((s) =>
                              s.id === step.id
                                ? { ...s, weightKg: e.target.value ? Number(e.target.value) : undefined }
                                : s
                            )
                          )
                        }
                        placeholder="kg"
                        className="col-span-2 rounded-lg border fabro-border fabro-surface px-2 py-1 font-mono fabro-input"
                      />
                      <button
                        type="button"
                        onClick={() => setDraftSteps((prev) => prev.filter((s) => s.id !== step.id))}
                        className="col-span-1 flex justify-center fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!routineName.trim() || draftSteps.length === 0}
              className="min-h-[40px] w-full rounded-xl bg-[#0284C7] text-white font-semibold cursor-pointer disabled:opacity-50"
            >
              Guardar rutina personalizada
            </button>
          </form>

          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="text-sm font-bold">Mis rutinas guardadas ({state.customRoutines.length})</h3>
            {state.customRoutines.length === 0 ? (
              <p className="fabro-muted">Todavía no creaste rutinas personalizadas.</p>
            ) : (
              <div className="space-y-3">
                {state.customRoutines.map((rt) => (
                  <div key={rt.id} className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm">{rt.name}</p>
                        <p className="text-[11px] fabro-muted">
                          {FITNESS_CATEGORIES.find((c) => c.id === rt.category)?.label} · {rt.difficulty} · {rt.exercises.length} ejercicios
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            customRoutines: prev.customRoutines.filter((x) => x.id !== rt.id),
                          }))
                        }
                        className="fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <ul className="space-y-0.5 text-[11px] fabro-muted font-mono">
                      {rt.exercises.map((s) => (
                        <li key={s.id}>
                          • {s.name}: {s.sets} × {s.reps}
                          {s.weightKg ? ` (${s.weightKg} kg)` : ''}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        setSessionRoutineName(rt.name);
                        setSessionCat(rt.category);
                        setSessionDurationMin(String(rt.estimatedMin));
                        setSubTab('sesion-contador');
                      }}
                      className="min-h-[34px] rounded-lg bg-[#059669] text-white px-3 font-semibold cursor-pointer"
                    >
                      Iniciar y registrar esta rutina
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'sesion-contador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          {/* Manual Rep Counter + Rest Timer */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold">Contador manual de repeticiones y series</h3>
                <p className="fabro-muted mt-0.5">
                  Control manual sin sensores externos ni conteo automático engañoso.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-2">
                  <p className="fabro-muted">Repeticiones</p>
                  <p className="font-mono text-3xl font-bold tabular-nums">{repCount}</p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRepCount((v) => Math.max(0, v - 1))}
                      className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border fabro-surface flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRepCount((v) => v + 1)}
                      className="min-h-[38px] min-w-[38px] rounded-xl bg-[#0284C7] text-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-2">
                  <p className="fabro-muted">Series</p>
                  <p className="font-mono text-3xl font-bold tabular-nums">{setCount}</p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSetCount((v) => Math.max(0, v - 1))}
                      className="min-h-[38px] min-w-[38px] rounded-xl border fabro-border fabro-surface flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSetCount((v) => v + 1)}
                      className="min-h-[38px] min-w-[38px] rounded-xl bg-[#059669] text-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Rest countdown */}
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Temporizador de descanso entre series</span>
                  <span className="font-mono text-lg font-bold tabular-nums">{restSeconds}s</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[30, 45, 60, 90].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setRestRunning(false);
                        setRestSeconds(sec);
                      }}
                      className="px-2.5 py-1 rounded-lg border fabro-border fabro-surface font-mono cursor-pointer"
                    >
                      {sec}s
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRestRunning((v) => !v)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[#059669] text-white px-3 py-1 font-semibold cursor-pointer"
                  >
                    {restRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {restRunning ? 'Pausar' : 'Iniciar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRestRunning(false);
                      setRestSeconds(45);
                    }}
                    aria-label="Reiniciar descanso"
                    className="p-1.5 rounded-lg border fabro-border fabro-surface cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Log Workout Form + History */}
          <div className="lg:col-span-7 space-y-4">
            <form
              onSubmit={handleLogWorkout}
              className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3"
            >
              <h3 className="text-sm font-bold">Guardar sesión completada</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={sessionRoutineName}
                  onChange={(e) => setSessionRoutineName(e.target.value)}
                  placeholder="Nombre de la sesión"
                  required
                  className="sm:col-span-2 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
                <select
                  value={sessionCat}
                  onChange={(e) => setSessionCat(e.target.value as FitnessCategoryId)}
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
                >
                  {FITNESS_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                  <span className="fabro-muted">Duración (minutos)</span>
                  <input
                    type="number"
                    min={1}
                    value={sessionDurationMin}
                    onChange={(e) => setSessionDurationMin(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                  />
                </label>
                <label className="space-y-1">
                  <span className="fabro-muted">Esfuerzo percibido (RPE {sessionRpe}/10)</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={sessionRpe}
                    onChange={(e) => setSessionRpe(Number(e.target.value))}
                    className="w-full accent-[#0284C7] mt-2"
                  />
                </label>
              </div>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Notas (pesos usados, sensaciones, postura...)"
                className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-[#0284C7] text-white px-5 font-semibold cursor-pointer"
              >
                Registrar sesión de hoy
              </button>
            </form>

            <WellnessBarChart
              title="Minutos entrenados (últimos 7 días)"
              data={last7WorkoutSeries}
              accentColor="#0284C7"
              unit="min"
            />
          </div>
        </div>
      )}

      {subTab === 'temporizador' && <CalisthenicsTimerTool />}

      {subTab === 'videos-ia' && (
        <div className="space-y-5">
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-[#0284C7]">
              <Sparkles className="w-4 h-4" />
              Entrenador Personal con tu clave BYOK (preservado)
            </p>
            <WellnessAiStudioPanel key="well-v2-entrenador" initialTab="entrenador" />
          </div>
          <WellnessVideoLibraryPanel />
        </div>
      )}
    </div>
  );
};
