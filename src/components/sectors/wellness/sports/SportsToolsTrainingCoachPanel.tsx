import React, { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  Bike,
  Calculator,
  Check,
  ClipboardCheck,
  Dumbbell,
  ExternalLink,
  Flag,
  Footprints,
  HeartPulse,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trash2,
  Users,
  Waves,
} from 'lucide-react';
import { RUNNING_PROGRAMS, TEAM_SPORTS_DRILLS } from '../../../../data/sportsCatalog';
import {
  calculateBodyFatUsNavy,
  calculateHeartRateZones,
  calculateMetEnergyKcal,
  calculateRunningMetrics,
  suggestStrengthRestSeconds,
} from '../../../../services/sportsService';
import { calculateOrientativeBmi, todayIsoDate } from '../../../../services/wellnessVault';
import type {
  CoachAthleteMember,
  CoachTrainingGroup,
  SportsUserState,
} from '../../../../types/sports';
import type { WellnessStateSnapshot } from '../../../../types/wellness';

interface SportsToolsTrainingCoachPanelProps {
  section: 'entrenamiento' | 'herramientas-deportivas' | 'entrenadores';
  sportsState: SportsUserState;
  wellnessState: WellnessStateSnapshot;
  onUpdateSportsState: (updater: (prev: SportsUserState) => SportsUserState) => void;
  onUpdateWellnessState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
}

export const SportsToolsTrainingCoachPanel: React.FC<SportsToolsTrainingCoachPanelProps> = ({
  section,
  sportsState,
  wellnessState,
  onUpdateSportsState,
  onUpdateWellnessState,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  // --- 14. FABRO SPORT TOOLS: Stopwatch + Laps ---
  const [swMs, setSwMs] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [swLaps, setSwLaps] = useState<number[]>([]);

  useEffect(() => {
    if (!swRunning) return;
    const start = Date.now() - swMs;
    const id = window.setInterval(() => {
      setSwMs(Date.now() - start);
    }, 100);
    return () => window.clearInterval(id);
  }, [swRunning]);

  // Pace / Speed calculator
  const [calcDistKm, setCalcDistKm] = useState('10');
  const [calcMinutes, setCalcMinutes] = useState('52');

  // HR zones calculator
  const [hrAge, setHrAge] = useState('30');
  const [hrRest, setHrRest] = useState('60');

  // Body fat & BMI calculator
  const [bfSex, setBfSex] = useState<'masculino' | 'femenino'>('masculino');
  const [bfHeight, setBfHeight] = useState('175');
  const [bfWeight, setBfWeight] = useState('74');
  const [bfNeck, setBfNeck] = useState('38');
  const [bfWaist, setBfWaist] = useState('84');
  const [bfHip, setBfHip] = useState('96');

  // Energy MET calculator
  const [metValue, setMetValue] = useState('8');
  const [metMinutes, setMetMinutes] = useState('45');

  // Strength rest calculator
  const [restGoal, setRestGoal] = useState<'fuerza' | 'hipertrofia' | 'resistencia'>('hipertrofia');

  // Personal Records & Recovery log
  const [prDiscipline, setPrDiscipline] = useState('Running');
  const [prMetric, setPrMetric] = useState('5 km');
  const [prValue, setPrValue] = useState('');

  const [recHr, setRecHr] = useState('');
  const [recFatigue, setRecFatigue] = useState(4);
  const [recScore, setRecScore] = useState(7);

  // --- 13. Training logs (Running, Cycling, Swimming) ---
  const [trainTab, setTrainTab] = useState<'running' | 'ciclismo' | 'natacion' | 'equipo'>('running');
  const [runDist, setRunDist] = useState('5');
  const [runMin, setRunMin] = useState('28');
  const [runNotes, setRunNotes] = useState('');

  const [cycRoute, setCycRoute] = useState('');
  const [cycDist, setCycDist] = useState('25');
  const [cycMin, setCycMin] = useState('65');
  const [cycElev, setCycElev] = useState('');

  const [swimTitle, setSwimTitle] = useState('');
  const [swimMeters, setSwimMeters] = useState('1200');
  const [swimDetails, setSwimDetails] = useState('200 m calentamiento + 8×100 m crol (pausa 20 s) + 200 m afloje');

  // --- 15. Entrenadores ---
  const [groupName, setGroupName] = useState('');
  const [groupSport, setGroupSport] = useState('Fútbol');
  const [groupSched, setGroupSched] = useState('Lun / Mié / Vie 18:30');
  const [activeGroupId, setActiveGroupId] = useState<string>(sportsState.coachGroups[0]?.id || '');
  const [athleteName, setAthleteName] = useState('');
  const [athleteConsent, setAthleteConsent] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDetails, setPlanDetails] = useState('');
  const [testName, setTestName] = useState('');
  const [testResult, setTestResult] = useState('');

  const formatSw = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    const tenths = Math.floor((ms % 1000) / 100);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  };

  // =========================================================================
  // 13. ENTRENAMIENTO POR DISCIPLINA (Integrado con FABRO Bienestar)
  // =========================================================================
  if (section === 'entrenamiento') {
    const handleLogRun = (e: React.FormEvent) => {
      e.preventDefault();
      const d = Number(runDist) || 0;
      const m = Number(runMin) || 0;
      if (d <= 0 || m <= 0) return;
      const metrics = calculateRunningMetrics(d, m);
      const paceLabel = metrics?.paceLabel || '—';
      onUpdateSportsState((prev) => ({
        ...prev,
        runningLogs: [
          {
            id: `run-${Date.now()}`,
            date: todayIsoDate(),
            distanceKm: d,
            durationMin: m,
            pacePerKm: paceLabel,
            notes: runNotes.trim() || undefined,
          },
          ...prev.runningLogs,
        ],
      }));
      // Direct single-source-of-truth integration with FABRO BIENESTAR
      onUpdateWellnessState((prev) => ({
        ...prev,
        workoutLogs: [
          {
            id: `wlog-run-${Date.now()}`,
            date: todayIsoDate(),
            routineName: `Running ${d} km (${paceLabel})`,
            category: 'cardio',
            durationMin: Math.round(m),
            effortRpe: 6,
            notes: runNotes.trim() || 'Registrado desde FABRO DEPORTES',
          },
          ...prev.workoutLogs,
        ],
      }));
      setRunNotes('');
      notify(`Carrera de ${d} km registrada y sincronizada con «Mi día» y «Actividad física».`);
    };

    const handleLogCycling = (e: React.FormEvent) => {
      e.preventDefault();
      const d = Number(cycDist) || 0;
      const m = Number(cycMin) || 0;
      if (d <= 0 || m <= 0) return;
      const speed = (d / (m / 60)).toFixed(1);
      onUpdateSportsState((prev) => ({
        ...prev,
        cyclingLogs: [
          {
            id: `cyc-${Date.now()}`,
            date: todayIsoDate(),
            route: cycRoute.trim() || 'Recorrido libre',
            distanceKm: d,
            durationMin: m,
            elevationM: cycElev ? Number(cycElev) : undefined,
          },
          ...prev.cyclingLogs,
        ],
      }));
      onUpdateWellnessState((prev) => ({
        ...prev,
        workoutLogs: [
          {
            id: `wlog-cyc-${Date.now()}`,
            date: todayIsoDate(),
            routineName: `Ciclismo ${d} km (${speed} km/h)`,
            category: 'cardio',
            durationMin: Math.round(m),
            effortRpe: 6,
            notes: cycRoute.trim() || 'Registrado desde FABRO DEPORTES',
          },
          ...prev.workoutLogs,
        ],
      }));
      setCycRoute('');
      setCycElev('');
      notify(`Recorrido en bici de ${d} km guardado y sincronizado con FABRO Bienestar.`);
    };

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#059669]">
              13 · Entrenamiento por disciplina · Sincronizado con FABRO Bienestar
            </p>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-[#059669]" />
              Programas de Running, Ciclismo, Natación y Deportes de equipo
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5 border-t fabro-border pt-3">
            {(
              [
                ['running', 'Running (5K a 42K)', Footprints],
                ['ciclismo', 'Ciclismo', Bike],
                ['natacion', 'Natación', Waves],
                ['equipo', 'Deportes de equipo y fuerza', Activity],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTrainTab(id)}
                className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 font-semibold cursor-pointer ${
                  trainTab === id
                    ? 'border-[#059669] bg-[#059669] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
          {feedback && (
            <p className="font-semibold text-[#059669] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {feedback}
            </p>
          )}
        </section>

        {trainTab === 'running' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-3">
              {RUNNING_PROGRAMS.map((p) => (
                <article key={p.id} className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-bold">{p.title}</h3>
                    <span className="font-mono text-[11px] text-[#059669] font-semibold">
                      {p.distance} · {p.weeklySessions} días/sem
                    </span>
                  </div>
                  <p className="fabro-muted">{p.summary}</p>
                  <ul className="list-disc pl-4 space-y-1">
                    {p.weeks.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="lg:col-span-5 space-y-4">
              <form
                onSubmit={handleLogRun}
                className="rounded-2xl border fabro-border fabro-surface p-4 space-y-3"
              >
                <h3 className="text-sm font-bold">Registrar carrera / rodaje</h3>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="fabro-muted">Distancia (km)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={runDist}
                      onChange={(e) => setRunDist(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="fabro-muted">Tiempo (min)</span>
                    <input
                      type="number"
                      step="0.5"
                      value={runMin}
                      onChange={(e) => setRunMin(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={runNotes}
                  onChange={(e) => setRunNotes(e.target.value)}
                  placeholder="Sensaciones, terreno o ritmo..."
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
                <button
                  type="submit"
                  className="min-h-[38px] w-full rounded-xl bg-[#059669] text-white font-semibold cursor-pointer"
                >
                  Guardar carrera (sincroniza con Mi día)
                </button>
              </form>

              <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
                <h3 className="text-sm font-bold">Historial Running ({sportsState.runningLogs.length})</h3>
                {sportsState.runningLogs.length === 0 ? (
                  <p className="fabro-muted">Sin salidas registradas todavía.</p>
                ) : (
                  <div className="divide-y fabro-border">
                    {sportsState.runningLogs.slice(0, 8).map((r) => (
                      <div key={r.id} className="py-2 flex items-center justify-between font-mono">
                        <span>
                          {r.date} · {r.distanceKm} km
                        </span>
                        <span className="text-[#059669] font-semibold">
                          {r.durationMin} min ({r.pacePerKm})
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {trainTab === 'ciclismo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <form
              onSubmit={handleLogCycling}
              className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3"
            >
              <h3 className="text-sm font-bold">Registrar recorrido de ciclismo</h3>
              <input
                type="text"
                value={cycRoute}
                onChange={(e) => setCycRoute(e.target.value)}
                placeholder="Ruta o circuito"
                className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={cycDist}
                  onChange={(e) => setCycDist(e.target.value)}
                  placeholder="Km"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  value={cycMin}
                  onChange={(e) => setCycMin(e.target.value)}
                  placeholder="Min"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
                <input
                  type="number"
                  value={cycElev}
                  onChange={(e) => setCycElev(e.target.value)}
                  placeholder="Desnivel (m)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </div>
              <button
                type="submit"
                className="min-h-[38px] rounded-xl bg-[#059669] text-white px-4 font-semibold cursor-pointer"
              >
                Guardar recorrido
              </button>
            </form>

            <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
              <h3 className="text-sm font-bold">Historial de recorridos ({sportsState.cyclingLogs.length})</h3>
              {sportsState.cyclingLogs.length === 0 ? (
                <p className="fabro-muted">Aún no registraste salidas en bicicleta.</p>
              ) : (
                <div className="divide-y fabro-border font-mono">
                  {sportsState.cyclingLogs.map((c) => {
                    const vel = (c.distanceKm / Math.max(0.05, c.durationMin / 60)).toFixed(1);
                    return (
                      <div key={c.id} className="py-2 flex items-center justify-between gap-2">
                        <span className="font-sans font-semibold">{c.route}</span>
                        <span>
                          {c.distanceKm} km · {vel} km/h{c.elevationM ? ` · +${c.elevationM}m` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {trainTab === 'natacion' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
              <h3 className="text-sm font-bold">Planificador de series de natación</h3>
              <input
                type="text"
                value={swimTitle}
                onChange={(e) => setSwimTitle(e.target.value)}
                placeholder="Título (ej. Técnica crol + resistencia)"
                className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <input
                type="number"
                value={swimMeters}
                onChange={(e) => setSwimMeters(e.target.value)}
                placeholder="Metros totales"
                className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
              />
              <textarea
                rows={3}
                value={swimDetails}
                onChange={(e) => setSwimDetails(e.target.value)}
                className="w-full rounded-xl border fabro-border fabro-surface-elevated p-3 fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  const meters = Math.max(50, Number(swimMeters) || 1000);
                  onUpdateSportsState((prev) => ({
                    ...prev,
                    swimSeries: [
                      {
                        id: `sw-${Date.now()}`,
                        date: todayIsoDate(),
                        title: swimTitle.trim() || `Sesión ${meters} m`,
                        totalMeters: meters,
                        details: swimDetails.trim(),
                      },
                      ...prev.swimSeries,
                    ],
                  }));
                  setSwimTitle('');
                  notify('Serie de natación guardada.');
                }}
                className="min-h-[38px] rounded-xl bg-[#0284C7] text-white px-4 font-semibold cursor-pointer"
              >
                Guardar serie
              </button>
            </div>

            <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
              <h3 className="text-sm font-bold">Series planificadas ({sportsState.swimSeries.length})</h3>
              {sportsState.swimSeries.length === 0 ? (
                <p className="fabro-muted">Aún no guardaste series de natación.</p>
              ) : (
                sportsState.swimSeries.map((s) => (
                  <div key={s.id} className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>{s.title}</span>
                      <span className="font-mono text-[#0284C7]">{s.totalMeters} m</span>
                    </div>
                    <p className="fabro-muted">{s.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {trainTab === 'equipo' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {TEAM_SPORTS_DRILLS.map((d) => (
                <article key={d.id} className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase text-[#059669]">{d.area}</p>
                  <h3 className="font-display text-sm font-bold">{d.title}</h3>
                  <p className="fabro-muted leading-relaxed">{d.detail}</p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                      `${d.title} preparacion fisica deportes de equipo`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0284C7] hover:underline"
                  >
                    Ver referencia técnica en YouTube
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </article>
              ))}
            </div>
            <div className="rounded-2xl border fabro-border fabro-surface p-4">
              <p className="font-semibold">
                Rutinas de gimnasio y fuerza integradas: tenés {wellnessState.customRoutines.length} rutinas propias y {wellnessState.workoutLogs.length} sesiones totales sincronizadas con «3. Actividad física» de FABRO Bienestar.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 14. FABRO SPORT TOOLS (Calculadoras con fórmulas + Cronómetro + PRs)
  // =========================================================================
  if (section === 'herramientas-deportivas') {
    const runCalc = calculateRunningMetrics(Number(calcDistKm) || 0, Number(calcMinutes) || 0);
    const hrCalc = calculateHeartRateZones(
      Number(hrAge) || 0,
      hrRest ? Number(hrRest) : undefined
    );
    const bfCalc = calculateBodyFatUsNavy({
      sex: bfSex,
      heightCm: Number(bfHeight) || 0,
      neckCm: Number(bfNeck) || 0,
      waistCm: Number(bfWaist) || 0,
      hipCm: bfSex === 'femenino' ? Number(bfHip) || 0 : undefined,
    });
    const bmiCalc = calculateOrientativeBmi(Number(bfWeight) || 0, Number(bfHeight) || 0);
    const metKcal = calculateMetEnergyKcal(
      Number(metValue) || 0,
      Number(bfWeight) || 70,
      Number(metMinutes) || 0
    );
    const restAdvice = suggestStrengthRestSeconds(restGoal);

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
            14 · FABRO SPORT TOOLS · 100% funcional sin internet
          </p>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#0284C7]" />
            Cronómetro de vueltas, calculadoras con fórmulas y marcas personales
          </h2>
          <p className="fabro-muted">
            Todas las calculadoras explican explícitamente sus fórmulas. Las estimaciones de zonas cardíacas, grasa corporal y gasto calórico son orientativas y no sustituyen mediciones clínicas.
          </p>
          {feedback && (
            <p className="font-semibold text-[#059669] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {feedback}
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Stopwatch + Lap Counter */}
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Timer className="w-4 h-4 text-[#0284C7]" />
              Cronómetro deportivo y tiempos por vuelta
            </h3>
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-4 text-center">
              <p className="font-mono text-4xl font-bold tabular-nums">{formatSw(swMs)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSwRunning((v) => !v)}
                className="min-h-[38px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0284C7] text-white font-semibold cursor-pointer"
              >
                {swRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {swRunning ? 'Pausar' : 'Iniciar'}
              </button>
              <button
                type="button"
                disabled={swMs === 0}
                onClick={() => setSwLaps((prev) => [swMs, ...prev])}
                className="min-h-[38px] inline-flex items-center gap-1 rounded-xl border fabro-border fabro-surface-elevated px-3.5 font-semibold cursor-pointer disabled:opacity-50"
              >
                <Flag className="w-3.5 h-3.5" />
                Vuelta
              </button>
              <button
                type="button"
                onClick={() => {
                  setSwRunning(false);
                  setSwMs(0);
                  setSwLaps([]);
                }}
                className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            {swLaps.length > 0 && (
              <div className="max-h-32 overflow-y-auto divide-y fabro-border font-mono">
                {swLaps.map((lap, idx) => (
                  <div key={`${lap}-${idx}`} className="py-1.5 flex justify-between">
                    <span>Vuelta #{swLaps.length - idx}</span>
                    <span>{formatSw(lap)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pace, Speed & Race Time Calculator */}
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Footprints className="w-4 h-4 text-[#059669]" />
              Calculadora de Pace, Velocidad y Tiempos de carrera
            </h3>
            <p className="text-[11px] fabro-muted">
              Fórmulas: Ritmo = tiempo ÷ distancia · Velocidad = distancia ÷ (tiempo / 60).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="fabro-muted">Distancia (km)</span>
                <input
                  type="number"
                  step="0.1"
                  value={calcDistKm}
                  onChange={(e) => setCalcDistKm(e.target.value)}
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">Tiempo total (min)</span>
                <input
                  type="number"
                  step="0.5"
                  value={calcMinutes}
                  onChange={(e) => setCalcMinutes(e.target.value)}
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
            </div>
            {runCalc && (
              <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-2 font-mono tabular-nums">
                <div className="flex justify-between text-sm font-bold">
                  <span>Ritmo: {runCalc.paceLabel}</span>
                  <span className="text-[#059669]">{runCalc.speedKmh} km/h</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1 border-t fabro-border text-[11px] text-center">
                  {runCalc.projections.map((p) => (
                    <div key={p.label}>
                      <p className="fabro-muted">{p.label}</p>
                      <p className="font-semibold">{p.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Heart Rate Zones (Orientative) */}
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-rose-600" />
              Zonas de frecuencia cardíaca (estimación orientativa)
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="fabro-muted">Edad (años)</span>
                <input
                  type="number"
                  value={hrAge}
                  onChange={(e) => setHrAge(e.target.value)}
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">FC reposo opcional (lpm)</span>
                <input
                  type="number"
                  value={hrRest}
                  onChange={(e) => setHrRest(e.target.value)}
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
            </div>
            {hrCalc && (
              <div className="space-y-2">
                <p className="text-[11px] fabro-muted">{hrCalc.formulaUsed}</p>
                <div className="divide-y fabro-border font-mono text-[11px]">
                  {hrCalc.zones.map((z) => (
                    <div key={z.zone} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="font-sans">
                        <strong>{z.zone}</strong> {z.name}
                      </span>
                      <span>
                        {z.minBpm}–{z.maxBpm} lpm
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Body Fat (US Navy), BMI, Energy MET & Strength Rest */}
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="text-sm font-bold">
              IMC, % grasa corporal (US Navy) y gasto MET (estimaciones)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={bfSex}
                onChange={(e) => setBfSex(e.target.value as 'masculino' | 'femenino')}
                className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 fabro-input"
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
              </select>
              <input
                type="number"
                value={bfHeight}
                onChange={(e) => setBfHeight(e.target.value)}
                placeholder="Altura cm"
                className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
              />
              <input
                type="number"
                value={bfWeight}
                onChange={(e) => setBfWeight(e.target.value)}
                placeholder="Peso kg"
                className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
              />
              <input
                type="number"
                value={bfNeck}
                onChange={(e) => setBfNeck(e.target.value)}
                placeholder="Cuello cm"
                className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
              />
              <input
                type="number"
                value={bfWaist}
                onChange={(e) => setBfWaist(e.target.value)}
                placeholder="Cintura cm"
                className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
              />
              {bfSex === 'femenino' && (
                <input
                  type="number"
                  value={bfHip}
                  onChange={(e) => setBfHip(e.target.value)}
                  placeholder="Cadera cm"
                  className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
                />
              )}
            </div>
            <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1 font-mono text-[11px]">
              <p>
                IMC orientativo: <strong>{bmiCalc ? bmiCalc.bmi : '—'}</strong>{' '}
                {bmiCalc ? `(${bmiCalc.category})` : ''}
              </p>
              <p>
                % grasa estimado (US Navy):{' '}
                <strong>{bfCalc ? `${bfCalc.bodyFatPct}%` : 'Revisá medidas'}</strong>
              </p>
              <p className="font-sans fabro-muted">
                Advertencia: fórmulas indirectas con margen de error; no reemplazan evaluación antropométrica ISAK ni clínica.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t fabro-border">
              <select
                value={metValue}
                onChange={(e) => setMetValue(e.target.value)}
                className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 fabro-input"
              >
                <option value="3.5">Caminata moderada (3.5 MET)</option>
                <option value="6">Fuerza / Gimnasio (6 MET)</option>
                <option value="8">Ciclismo / Fútbol (8 MET)</option>
                <option value="9.8">Running 10 km/h (9.8 MET)</option>
              </select>
              <input
                type="number"
                value={metMinutes}
                onChange={(e) => setMetMinutes(e.target.value)}
                placeholder="Minutos"
                className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
              />
            </div>
            <p className="font-mono text-[11px]">
              Gasto energético estimado (kcal = MET × peso × h):{' '}
              <strong className="text-[#D97706]">~{metKcal} kcal</strong>
            </p>

            <div className="pt-2 border-t fabro-border space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Calculadora de descansos entre series:</span>
                <select
                  value={restGoal}
                  onChange={(e) =>
                    setRestGoal(e.target.value as 'fuerza' | 'hipertrofia' | 'resistencia')
                  }
                  className="rounded-lg border fabro-border fabro-surface-elevated px-2 py-1 fabro-input"
                >
                  <option value="fuerza">Fuerza máxima</option>
                  <option value="hipertrofia">Hipertrofia</option>
                  <option value="resistencia">Resistencia muscular</option>
                </select>
              </div>
              <p className="fabro-muted">
                <strong className="text-[var(--fabro-text)]">{restAdvice.rangeSec}:</strong>{' '}
                {restAdvice.rationale}
              </p>
            </div>
          </div>
        </div>

        {/* Personal Records + Recovery / Fatigue */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Award className="w-4 h-4 text-[#D97706]" />
              Registro de marcas personales (PRs)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={prDiscipline}
                onChange={(e) => setPrDiscipline(e.target.value)}
                placeholder="Disciplina"
                className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              />
              <input
                type="text"
                value={prMetric}
                onChange={(e) => setPrMetric(e.target.value)}
                placeholder="Prueba (5K, Sentadilla)"
                className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 fabro-input"
              />
              <input
                type="text"
                value={prValue}
                onChange={(e) => setPrValue(e.target.value)}
                placeholder="Marca (22:40 / 90 kg)"
                className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (!prValue.trim()) return;
                onUpdateSportsState((prev) => ({
                  ...prev,
                  personalRecords: [
                    {
                      id: `pr-${Date.now()}`,
                      date: todayIsoDate(),
                      discipline: prDiscipline.trim() || 'Deporte',
                      metricName: prMetric.trim() || 'Marca',
                      valueLabel: prValue.trim(),
                    },
                    ...prev.personalRecords,
                  ],
                }));
                setPrValue('');
                notify('Marca personal guardada.');
              }}
              className="min-h-[36px] rounded-xl bg-[#D97706] text-white px-4 font-semibold cursor-pointer"
            >
              Guardar marca
            </button>
            <div className="divide-y fabro-border">
              {sportsState.personalRecords.map((pr) => (
                <div key={pr.id} className="py-2 flex items-center justify-between gap-2">
                  <span>
                    <strong>{pr.discipline}</strong> · {pr.metricName}:{' '}
                    <span className="font-mono font-bold text-[#D97706]">{pr.valueLabel}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSportsState((prev) => ({
                        ...prev,
                        personalRecords: prev.personalRecords.filter((x) => x.id !== pr.id),
                      }))
                    }
                    className="fabro-muted hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
            <h3 className="text-sm font-bold">Recuperación, fatiga percibida y FC medida</h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="fabro-muted">FC reposo (lpm)</span>
                <input
                  type="number"
                  value={recHr}
                  onChange={(e) => setRecHr(e.target.value)}
                  placeholder="Ej. 58"
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">Fatiga ({recFatigue}/10)</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={recFatigue}
                  onChange={(e) => setRecFatigue(Number(e.target.value))}
                  className="w-full accent-amber-600 mt-2"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">Recuperación ({recScore}/10)</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={recScore}
                  onChange={(e) => setRecScore(Number(e.target.value))}
                  className="w-full accent-[#059669] mt-2"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                onUpdateSportsState((prev) => ({
                  ...prev,
                  recoveryLogs: [
                    {
                      id: `rec-${Date.now()}`,
                      date: todayIsoDate(),
                      restingHrBpm: recHr ? Number(recHr) : undefined,
                      fatigueLevel: recFatigue,
                      recoveryScore: recScore,
                    },
                    ...prev.recoveryLogs,
                  ],
                }));
                setRecHr('');
                notify('Estado de recuperación registrado.');
              }}
              className="min-h-[36px] rounded-xl bg-[#059669] text-white px-4 font-semibold cursor-pointer"
            >
              Registrar recuperación de hoy
            </button>
            <div className="divide-y fabro-border font-mono text-[11px]">
              {sportsState.recoveryLogs.slice(0, 5).map((r) => (
                <div key={r.id} className="py-1.5 flex justify-between">
                  <span>{r.date}</span>
                  <span>
                    {r.restingHrBpm ? `FC ${r.restingHrBpm} · ` : ''}Fatiga {r.fatigueLevel}/10 · Recup. {r.recoveryScore}/10
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 15. HERRAMIENTAS PARA ENTRENADORES (Consentimiento expreso obligatorio)
  // =========================================================================
  const activeGroup =
    sportsState.coachGroups.find((g) => g.id === activeGroupId) || sportsState.coachGroups[0] || null;

  const updateGroup = (groupId: string, fn: (g: CoachTrainingGroup) => CoachTrainingGroup) => {
    onUpdateSportsState((prev) => ({
      ...prev,
      coachGroups: prev.coachGroups.map((g) => (g.id === groupId ? fn(g) : g)),
    }));
  };

  const today = todayIsoDate();

  return (
    <div className="space-y-5 text-xs">
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
          15 · Espacio para entrenadores y profesores
        </p>
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-[#0284C7]" />
          Grupos, asistencia, pruebas físicas y planificación
        </h2>
        <p className="text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Regla de privacidad estricta: el acceso y consulta de evaluaciones de cada deportista solo se habilita cuando existe <strong>autorización expresa</strong> registrada.
          </span>
        </p>
        {feedback && <p className="font-semibold text-[#059669]">{feedback}</p>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Create & list groups */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5">
            <h3 className="text-sm font-bold">Crear grupo deportivo</h3>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ej. Sub-17 Fútbol / Grupo Running Parque"
              className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="text"
              value={groupSport}
              onChange={(e) => setGroupSport(e.target.value)}
              placeholder="Deporte"
              className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="text"
              value={groupSched}
              onChange={(e) => setGroupSched(e.target.value)}
              placeholder="Días y horarios"
              className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <button
              type="button"
              onClick={() => {
                if (!groupName.trim()) return;
                const created: CoachTrainingGroup = {
                  id: `grp-${Date.now()}`,
                  name: groupName.trim(),
                  sport: groupSport.trim() || 'General',
                  schedule: groupSched.trim(),
                  athletes: [],
                  sharedPlans: [],
                };
                onUpdateSportsState((prev) => ({
                  ...prev,
                  coachGroups: [created, ...prev.coachGroups],
                }));
                setActiveGroupId(created.id);
                setGroupName('');
                notify(`Grupo «${created.name}» creado.`);
              }}
              className="min-h-[38px] w-full inline-flex items-center justify-center gap-1 rounded-xl bg-[#0284C7] text-white font-semibold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear grupo
            </button>
          </div>

          <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
            <h3 className="text-sm font-bold">Mis grupos ({sportsState.coachGroups.length})</h3>
            {sportsState.coachGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setActiveGroupId(g.id)}
                className={`w-full rounded-xl border p-3 text-left cursor-pointer ${
                  activeGroup?.id === g.id
                    ? 'border-[#0284C7] bg-[#0284C7]/10'
                    : 'fabro-border fabro-surface-elevated'
                }`}
              >
                <p className="font-semibold">{g.name}</p>
                <p className="text-[11px] fabro-muted">
                  {g.sport} · {g.athletes.length} deportistas · {g.schedule}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Active group management */}
        <div className="lg:col-span-8 space-y-4">
          {!activeGroup ? (
            <div className="rounded-2xl border border-dashed fabro-border p-8 text-center fabro-muted">
              Creá tu primer grupo deportivo a la izquierda para gestionar asistencia, planes y pruebas físicas.
            </div>
          ) : (
            <>
              <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-[#059669]" />
                  Deportistas y asistencia — {activeGroup.name}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={athleteName}
                    onChange={(e) => setAthleteName(e.target.value)}
                    placeholder="Nombre del deportista"
                    className="flex-1 min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                  />
                  <label className="inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={athleteConsent}
                      onChange={(e) => setAthleteConsent(e.target.checked)}
                      className="accent-[#059669]"
                    />
                    <span>Autorización expresa otorgada</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!athleteName.trim()) return;
                      const member: CoachAthleteMember = {
                        id: `ath-${Date.now()}`,
                        name: athleteName.trim(),
                        discipline: activeGroup.sport,
                        consentGranted: athleteConsent,
                        attendanceDates: [],
                        physicalTests: [],
                      };
                      updateGroup(activeGroup.id, (g) => ({
                        ...g,
                        athletes: [member, ...g.athletes],
                      }));
                      setAthleteName('');
                      setAthleteConsent(false);
                    }}
                    className="min-h-[36px] rounded-xl bg-[#059669] text-white px-4 font-semibold cursor-pointer"
                  >
                    Sumar
                  </button>
                </div>

                <div className="space-y-2.5 pt-2">
                  {activeGroup.athletes.map((ath) => {
                    const presentToday = ath.attendanceDates.includes(today);
                    return (
                      <div
                        key={ath.id}
                        className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{ath.name}</p>
                            <p className="text-[11px] fabro-muted">
                              Asistencias: {ath.attendanceDates.length} ·{' '}
                              {ath.consentGranted ? (
                                <span className="text-[#059669] font-semibold inline-flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> Datos autorizados
                                </span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-400">
                                  Sin autorización expresa (métricas restringidas)
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateGroup(activeGroup.id, (g) => ({
                                  ...g,
                                  athletes: g.athletes.map((x) =>
                                    x.id === ath.id
                                      ? { ...x, consentGranted: !x.consentGranted }
                                      : x
                                  ),
                                }))
                              }
                              className="rounded-lg border fabro-border px-2.5 py-1 cursor-pointer"
                            >
                              {ath.consentGranted ? 'Revocar permiso' : 'Autorizar datos'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateGroup(activeGroup.id, (g) => ({
                                  ...g,
                                  athletes: g.athletes.map((x) =>
                                    x.id === ath.id
                                      ? {
                                          ...x,
                                          attendanceDates: presentToday
                                            ? x.attendanceDates.filter((d) => d !== today)
                                            : [today, ...x.attendanceDates],
                                        }
                                      : x
                                  ),
                                }))
                              }
                              className={`rounded-lg px-2.5 py-1 font-semibold cursor-pointer ${
                                presentToday
                                  ? 'bg-[#059669] text-white'
                                  : 'border border-[#059669] text-[#059669]'
                              }`}
                            >
                              {presentToday ? 'Presente hoy ✓' : 'Marcar asistencia'}
                            </button>
                          </div>
                        </div>

                        {ath.consentGranted && (
                          <div className="pt-2 border-t fabro-border space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              <input
                                type="text"
                                value={testName}
                                onChange={(e) => setTestName(e.target.value)}
                                placeholder="Prueba física (ej. Test Cooper, Salto vertical)"
                                className="flex-1 min-h-[32px] rounded-lg border fabro-border fabro-surface px-2 fabro-input"
                              />
                              <input
                                type="text"
                                value={testResult}
                                onChange={(e) => setTestResult(e.target.value)}
                                placeholder="Resultado"
                                className="w-28 min-h-[32px] rounded-lg border fabro-border fabro-surface px-2 font-mono fabro-input"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (!testName.trim() || !testResult.trim()) return;
                                  updateGroup(activeGroup.id, (g) => ({
                                    ...g,
                                    athletes: g.athletes.map((x) =>
                                      x.id === ath.id
                                        ? {
                                            ...x,
                                            physicalTests: [
                                              {
                                                id: `tst-${Date.now()}`,
                                                date: today,
                                                testName: testName.trim(),
                                                result: testResult.trim(),
                                              },
                                              ...x.physicalTests,
                                            ],
                                          }
                                        : x
                                    ),
                                  }));
                                  setTestName('');
                                  setTestResult('');
                                }}
                                className="rounded-lg bg-[#0284C7] text-white px-2.5 font-semibold cursor-pointer"
                              >
                                + Prueba
                              </button>
                            </div>
                            {ath.physicalTests.map((t) => (
                              <p key={t.id} className="text-[11px] font-mono fabro-muted">
                                • {t.date} · {t.testName}: <strong>{t.result}</strong>
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Group training plans */}
              <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
                <h3 className="text-sm font-bold">Planificación y rutinas del grupo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    placeholder="Sesión (ej. Velocidad + técnica pase)"
                    className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                  />
                  <input
                    type="text"
                    value={planDetails}
                    onChange={(e) => setPlanDetails(e.target.value)}
                    placeholder="Bloques / ejercicios"
                    className="min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!planTitle.trim()) return;
                    updateGroup(activeGroup.id, (g) => ({
                      ...g,
                      sharedPlans: [
                        {
                          id: `sp-${Date.now()}`,
                          date: today,
                          title: planTitle.trim(),
                          details: planDetails.trim(),
                        },
                        ...g.sharedPlans,
                      ],
                    }));
                    setPlanTitle('');
                    setPlanDetails('');
                  }}
                  className="min-h-[36px] rounded-xl bg-[#0284C7] text-white px-4 font-semibold cursor-pointer"
                >
                  Guardar sesión planificada
                </button>
                {activeGroup.sharedPlans.map((p) => (
                  <div key={p.id} className="rounded-xl border fabro-border fabro-surface-elevated p-3">
                    <p className="font-semibold">
                      {p.date} · {p.title}
                    </p>
                    <p className="fabro-muted">{p.details}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
