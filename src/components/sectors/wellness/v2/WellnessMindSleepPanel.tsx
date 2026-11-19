import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BookOpen,
  Brain,
  Check,
  Clock,
  Feather,
  Heart,
  Info,
  Lock,
  Moon,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import { playSoftBell } from '../../../../services/webAudioPtt';
import {
  computeSleepDurationHours,
  nowTimeLabel,
  todayIsoDate,
  wellnessAmbientAudio,
  type AmbientSoundKind,
} from '../../../../services/wellnessVault';
import type {
  EmotionEntryKind,
  EmotionJournalEntry,
  SleepLogEntry,
  WellnessStateSnapshot,
} from '../../../../types/wellness';
import { BreathingTool } from '../BreathingTool';
import { GuidedStoicReflectionsTool } from '../GuidedStoicReflectionsTool';
import { HydrationSleepTool } from '../HydrationSleepTool';
import { StoicRouletteTool } from '../StoicRouletteTool';
import { TimeCapsuleTool } from '../TimeCapsuleTool';
import { WellnessBarChart, WellnessLineChart } from './WellnessCharts';

interface WellnessMindSleepPanelProps {
  section: 'mente-emociones' | 'sueno-descanso' | 'fabro-respira';
  state: WellnessStateSnapshot;
  onUpdateState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
}

const EMOTION_KINDS: Array<{ id: EmotionEntryKind; label: string }> = [
  { id: 'diario', label: 'Diario personal' },
  { id: 'gratitud', label: 'Gratitud' },
  { id: 'preocupacion', label: 'Preocupaciones' },
  { id: 'reflexion', label: 'Reflexión' },
  { id: 'autoconocimiento', label: 'Autoconocimiento' },
  { id: 'momento-positivo', label: 'Momento positivo' },
];

const SELF_KNOWLEDGE_PROMPTS = [
  '¿Qué actividad de esta semana te devolvió energía genuina?',
  '¿Qué preocupación actual depende realmente de tu acción hoy y cuál no?',
  '¿Qué pequeño límite sano te ayudaría a cuidar mejor tu calma?',
  'Si hoy fuera el último día de tu vida, ¿qué conversación o gesto valorarías más?',
];

const PMR_STEPS = [
  '1. Pies y pantorrillas: tensá suave 5 segundos al inhalar, soltá completamente 10 segundos al exhalar.',
  '2. Muslos y glúteos: contraé sin dolor 5 segundos y dejá que el peso caiga sobre la silla o colchoneta.',
  '3. Abdomen y espalda baja: activá el centro 5 segundos y soltá permitiendo una respiración abdominal libre.',
  '4. Hombros y manos: cerrá puños y subí hombros 5 segundos; al exhalar dejá caer los hombros lejos de las orejas.',
  '5. Mandíbula y frente: aflojá dientes, lengua y entrecejo durante 3 exhalaciones lentas.',
];

export const WellnessMindSleepPanel: React.FC<WellnessMindSleepPanelProps> = ({
  section,
  state,
  onUpdateState,
}) => {
  const { addMoodLog, addScheduledReminder } = useEcosystem();

  // Mind & Emotions state
  const [mindSubTab, setMindSubTab] = useState<'diario' | 'estoicismo-legado'>('diario');
  const [entryKind, setEntryKind] = useState<EmotionEntryKind>('diario');
  const [moodScore, setMoodScore] = useState(7);
  const [moodLabel, setMoodLabel] = useState('Sereno / enfocado');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [speaking, setSpeaking] = useState(false);

  // Sleep state
  const [sleepDate, setSleepDate] = useState(todayIsoDate());
  const [bedtime, setBedtime] = useState(state.sleepPrefs.usualBedtime || '23:00');
  const [wakeTime, setWakeTime] = useState(state.sleepPrefs.usualWakeTime || '07:00');
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [awakenings, setAwakenings] = useState(0);
  const [checkedRoutine, setCheckedRoutine] = useState<string[]>([]);
  const [dreamNote, setDreamNote] = useState('');
  const [sleepNotes, setSleepNotes] = useState('');

  // FABRO RESPIRA state
  const [activeAmbient, setActiveAmbient] = useState<AmbientSoundKind | null>(() =>
    wellnessAmbientAudio.getActiveKind()
  );
  const [ambientVolume, setAmbientVolume] = useState(0.25);
  const [focusMinutes, setFocusMinutes] = useState(10);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(600);
  const [focusRunning, setFocusRunning] = useState(false);

  const [feedback, setFeedback] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3000);
  };

  useEffect(() => {
    if (!focusRunning) return;
    const id = window.setInterval(() => {
      setFocusSecondsLeft((prev) => {
        if (prev <= 1) {
          setFocusRunning(false);
          playSoftBell('break-end');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [focusRunning]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const moodChartPoints = useMemo(() => {
    return [...state.emotionEntries]
      .slice(0, 14)
      .reverse()
      .map((e) => ({ label: e.date.slice(5), value: e.moodScore }));
  }, [state.emotionEntries]);

  const sleepChartData = useMemo(() => {
    return [...state.sleepLogs]
      .slice(0, 10)
      .reverse()
      .map((s) => ({ label: s.date.slice(5), value: s.durationHours }));
  }, [state.sleepLogs]);

  const handleSaveEmotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryContent.trim()) return;
    const item: EmotionJournalEntry = {
      id: `emo-${Date.now()}`,
      date: todayIsoDate(),
      time: nowTimeLabel(),
      kind: entryKind,
      moodScore,
      moodLabel: moodLabel.trim() || 'Registrado',
      title:
        entryTitle.trim() ||
        EMOTION_KINDS.find((k) => k.id === entryKind)?.label ||
        'Entrada privada',
      content: entryContent.trim(),
      privateOnly: true,
    };
    onUpdateState((prev) => ({
      ...prev,
      emotionEntries: [item, ...prev.emotionEntries],
    }));
    addMoodLog(moodScore, item.moodLabel, item.title);
    setEntryTitle('');
    setEntryContent('');
    notify('Entrada guardada de forma 100% privada en tu dispositivo.');
  };

  const handleReadAloud = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-AR';
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  const handleSaveSleep = (e: React.FormEvent) => {
    e.preventDefault();
    const durationHours = computeSleepDurationHours(bedtime, wakeTime);
    const entry: SleepLogEntry = {
      id: `slp-${Date.now()}`,
      date: sleepDate,
      bedtime,
      wakeTime,
      durationHours,
      quality: sleepQuality,
      awakenings: Math.max(0, awakenings),
      bedtimeRoutineDone: checkedRoutine,
      dreamNote: dreamNote.trim() || undefined,
      notes: sleepNotes.trim() || undefined,
    };
    onUpdateState((prev) => ({
      ...prev,
      sleepLogs: [entry, ...prev.sleepLogs.filter((s) => s.date !== sleepDate)],
    }));
    setDreamNote('');
    setSleepNotes('');
    notify(`Descanso guardado (${durationHours} h · Calidad ${sleepQuality}/5).`);
  };

  const handleToggleAmbient = (kind: AmbientSoundKind) => {
    if (activeAmbient === kind) {
      wellnessAmbientAudio.stop();
      setActiveAmbient(null);
      return;
    }
    const ok = wellnessAmbientAudio.start(kind, ambientVolume);
    if (ok) {
      setActiveAmbient(kind);
    } else {
      notify('Tu navegador no habilitó Web Audio API.');
    }
  };

  // =========================================================================
  // 4. MENTE Y EMOCIONES
  // =========================================================================
  if (section === 'mente-emociones') {
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4F46E5]">
                04 · Mente y emociones · Privado por defecto
              </p>
              <h2 className="font-display text-xl font-bold">
                Diario emocional, gratitud y legado «El Último Día de Tu Vida»
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs fabro-muted">
              <Lock className="w-3.5 h-3.5 text-[#4F46E5]" />
              Solo local en IndexedDB · Nunca se publica automáticamente
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 border-t fabro-border pt-3 text-xs">
            <button
              type="button"
              onClick={() => setMindSubTab('diario')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 font-semibold cursor-pointer ${
                mindSubTab === 'diario'
                  ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                  : 'fabro-border fabro-surface-elevated fabro-muted'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Diario, ánimo y gratitud
            </button>
            <button
              type="button"
              onClick={() => setMindSubTab('estoicismo-legado')}
              className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 font-semibold cursor-pointer ${
                mindSubTab === 'estoicismo-legado'
                  ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                  : 'fabro-border fabro-surface-elevated fabro-muted'
              }`}
            >
              <Feather className="w-3.5 h-3.5" />
              El Último Día de Tu Vida (Estoicismo y Cápsula del Tiempo)
            </button>
          </div>

          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 text-xs fabro-muted flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#4F46E5]" />
            <span>
              Este espacio es una herramienta de autoconocimiento y registro personal. No sustituye acompañamiento psicológico ni psiquiátrico profesional. Ante angustia severa o crisis, comunicáte con profesionales de salud o líneas de asistencia de tu país.
            </span>
          </div>

          {feedback && (
            <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {feedback}
            </p>
          )}
        </section>

        {mindSubTab === 'diario' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
            <form
              onSubmit={handleSaveEmotion}
              className="lg:col-span-7 rounded-2xl border fabro-border fabro-surface p-5 space-y-4"
            >
              <div className="flex flex-wrap gap-1.5">
                {EMOTION_KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setEntryKind(k.id)}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      entryKind === k.id
                        ? 'bg-[#4F46E5] text-white'
                        : 'fabro-surface-elevated fabro-muted'
                    }`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Estado de ánimo actual (1 al 10)</span>
                  <span className="font-mono font-bold tabular-nums text-[#4F46E5]">
                    {moodScore}/10
                  </span>
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMoodScore(n)}
                      className={`min-h-[36px] rounded-lg border font-mono font-bold cursor-pointer ${
                        moodScore === n
                          ? 'border-[#4F46E5] bg-[#4F46E5] text-white'
                          : 'fabro-border fabro-surface-elevated fabro-muted'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={moodLabel}
                  onChange={(e) => setMoodLabel(e.target.value)}
                  placeholder="Emoción principal (ej. Calma, cansancio, ilusión)"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
                <input
                  type="text"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  placeholder="Título opcional de la entrada"
                  className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
                />
              </div>

              <textarea
                rows={5}
                value={entryContent}
                onChange={(e) => setEntryContent(e.target.value)}
                placeholder="Escribí libremente tus pensamientos, preocupaciones, aprendizajes o motivos de gratitud..."
                required
                className="w-full rounded-xl border fabro-border fabro-surface-elevated p-3 leading-relaxed fabro-input"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEntryContent((prev) =>
                      prev
                        ? prev
                        : SELF_KNOWLEDGE_PROMPTS[
                            Math.floor(Math.random() * SELF_KNOWLEDGE_PROMPTS.length)
                          ]
                    )
                  }
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 font-medium cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                  Sugerir pregunta de autoconocimiento
                </button>
                <div className="flex items-center gap-2">
                  {entryContent.trim() && (
                    <button
                      type="button"
                      onClick={() => handleReadAloud(entryContent)}
                      className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 font-medium cursor-pointer"
                    >
                      {speaking ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      {speaking ? 'Detener voz' : 'Escuchar'}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="min-h-[38px] rounded-xl bg-[#4F46E5] text-white px-4 font-semibold cursor-pointer"
                  >
                    Guardar en diario privado
                  </button>
                </div>
              </div>
            </form>

            <div className="lg:col-span-5 space-y-4">
              <WellnessLineChart
                title="Evolución emocional reciente"
                subtitle="Escala declarada (1 a 10)"
                points={moodChartPoints}
                accentColor="#4F46E5"
                unit="/10"
              />

              <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5">
                <h3 className="text-sm font-bold">Entradas guardadas ({state.emotionEntries.length})</h3>
                {state.emotionEntries.length === 0 ? (
                  <p className="fabro-muted">Tu diario emocional está vacío y listo para tu primera nota.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {state.emotionEntries.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{item.title}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-[#4F46E5] font-bold">
                              {item.moodScore}/10
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateState((prev) => ({
                                  ...prev,
                                  emotionEntries: prev.emotionEntries.filter((x) => x.id !== item.id),
                                }))
                              }
                              className="fabro-muted hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] fabro-muted font-mono">
                          {item.date} {item.time} · {item.moodLabel}
                        </p>
                        <p className="leading-relaxed whitespace-pre-wrap">{item.content}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mindSubTab === 'estoicismo-legado' && (
          <div className="space-y-5">
            <GuidedStoicReflectionsTool />
            <StoicRouletteTool />
            <TimeCapsuleTool />
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 5. SUEÑO Y DESCANSO
  // =========================================================================
  if (section === 'sueno-descanso') {
    const computedHours = computeSleepDurationHours(bedtime, wakeTime);
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0F766E]">
                05 · Sueño y descanso
              </p>
              <h2 className="font-display text-xl font-bold">
                Registro de descanso, rutinas nocturnas e hidratación
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                addScheduledReminder(
                  'Preparar descanso nocturno (FABRO Bienestar)',
                  'bienestar',
                  'organizacion-calorias',
                  60
                );
                notify('Recordatorio local de descanso agregado a tu Agenda (en 60 min).');
              }}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 text-xs font-semibold cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#0F766E]" />
              Crear recordatorio nocturno
            </button>
          </div>
          <p className="text-xs fabro-muted flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#0F766E]" />
            <span>
              Transparencia: FABRO calcula la duración a partir de los horarios que registrás y tu calidad subjetiva. Sin sensores externos dedicados, la app no mide fases de sueño profundo ni REM.
            </span>
          </p>
          {feedback && (
            <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399] flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              {feedback}
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          <form
            onSubmit={handleSaveSleep}
            className="lg:col-span-6 rounded-2xl border fabro-border fabro-surface p-5 space-y-3.5"
          >
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Moon className="w-4 h-4 text-[#0F766E]" />
              Registrar noche de descanso
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1">
                <span className="fabro-muted">Fecha</span>
                <input
                  type="date"
                  value={sleepDate}
                  onChange={(e) => setSleepDate(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">Acostarse</span>
                <input
                  type="time"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
                />
              </label>
              <label className="space-y-1">
                <span className="fabro-muted">Despertar</span>
                <input
                  type="time"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border fabro-border fabro-surface-elevated px-3.5 py-2.5">
              <span className="fabro-muted">Duración calculada</span>
              <span className="font-mono text-base font-bold tabular-nums text-[#0F766E]">
                {computedHours} horas
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="fabro-muted">Calidad subjetiva (1–5)</span>
                <div className="flex gap-1">
                  {([1, 2, 3, 4, 5] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setSleepQuality(q)}
                      className={`flex-1 min-h-[36px] rounded-lg border font-mono font-bold cursor-pointer ${
                        sleepQuality === q
                          ? 'border-[#0F766E] bg-[#0F766E] text-white'
                          : 'fabro-border fabro-surface-elevated fabro-muted'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-1">
                <span className="fabro-muted">Despertares nocturnos</span>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={awakenings}
                  onChange={(e) => setAwakenings(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold">Rutina previa cumplida:</span>
              {state.sleepPrefs.routineChecklist.map((step) => (
                <label key={step} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedRoutine.includes(step)}
                    onChange={() =>
                      setCheckedRoutine((prev) =>
                        prev.includes(step) ? prev.filter((x) => x !== step) : [...prev, step]
                      )
                    }
                    className="accent-[#0F766E]"
                  />
                  <span>{step}</span>
                </label>
              ))}
            </div>

            <textarea
              rows={2}
              value={dreamNote}
              onChange={(e) => setDreamNote(e.target.value)}
              placeholder="Diario de sueños (opcional, 100% privado)..."
              className="w-full rounded-xl border fabro-border fabro-surface-elevated p-2.5 fabro-input"
            />
            <input
              type="text"
              value={sleepNotes}
              onChange={(e) => setSleepNotes(e.target.value)}
              placeholder="Observaciones (cafeína tarde, estrés, temperatura...)"
              className="w-full min-h-[36px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />

            <button
              type="submit"
              className="min-h-[40px] w-full rounded-xl bg-[#0F766E] text-white font-semibold cursor-pointer"
            >
              Guardar registro de sueño
            </button>
          </form>

          <div className="lg:col-span-6 space-y-4">
            <WellnessBarChart
              title="Duración de sueño registrada"
              subtitle="Últimas noches cargadas"
              data={sleepChartData}
              accentColor="#0F766E"
              unit="h"
              goalValue={state.sleepPrefs.targetHours}
            />

            <div className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5">
              <h3 className="text-sm font-bold">Historial de noches ({state.sleepLogs.length})</h3>
              {state.sleepLogs.length === 0 ? (
                <p className="fabro-muted">Todavía no registraste noches en este módulo.</p>
              ) : (
                <div className="divide-y fabro-border max-h-56 overflow-y-auto">
                  {state.sleepLogs.map((s) => (
                    <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono font-semibold tabular-nums">
                          {s.date} · {s.bedtime}–{s.wakeTime} ({s.durationHours} h)
                        </p>
                        <p className="text-[11px] fabro-muted">
                          Calidad {s.quality}/5 · Despertares: {s.awakenings}
                          {s.dreamNote ? ` · Sueño anotado` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateState((prev) => ({
                            ...prev,
                            sleepLogs: prev.sleepLogs.filter((x) => x.id !== s.id),
                          }))
                        }
                        className="fabro-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preserved Hydration & Sleep Legacy Tool */}
        <HydrationSleepTool />
      </div>
    );
  }

  // =========================================================================
  // 15. FABRO RESPIRA
  // =========================================================================
  const focusMinDisp = String(Math.floor(focusSecondsLeft / 60)).padStart(2, '0');
  const focusSecDisp = String(focusSecondsLeft % 60).padStart(2, '0');

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#059669]">
          15 · FABRO RESPIRA · 100% funcional sin internet
        </p>
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Wind className="w-5 h-5 text-[#059669]" />
          Respiración guiada, sonidos ambientales offline y relajación muscular
        </h2>
        <p className="text-xs fabro-muted">
          Todo el audio ambiental se sintetiza localmente con Web Audio API ($0, sin descargas ni consumo de datos).
        </p>
      </section>

      {/* Preserved Interactive Breathing Tool */}
      <BreathingTool />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
        {/* Offline Ambient Soundscape Studio */}
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              {activeAmbient ? (
                <Volume2 className="w-4 h-4 text-[#059669]" />
              ) : (
                <VolumeX className="w-4 h-4 fabro-muted" />
              )}
              Sonidos ambientales sintéticos (offline)
            </h3>
            {activeAmbient && (
              <button
                type="button"
                onClick={() => {
                  wellnessAmbientAudio.stop();
                  setActiveAmbient(null);
                }}
                className="rounded-lg border fabro-border px-2.5 py-1 font-semibold cursor-pointer"
              >
                Silenciar
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['rain', 'Lluvia suave'],
                ['ocean', 'Olas lentas'],
                ['brown', 'Ruido marrón calma'],
                ['harmonic', 'Acorde armónico zen'],
              ] as Array<[AmbientSoundKind, string]>
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => handleToggleAmbient(kind)}
                className={`min-h-[44px] rounded-xl border px-3 py-2 font-semibold text-left cursor-pointer transition-colors ${
                  activeAmbient === kind
                    ? 'border-[#059669] bg-[#059669] text-white'
                    : 'fabro-border fabro-surface-elevated hover:border-[#059669]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="fabro-muted">Volumen suave ({Math.round(ambientVolume * 100)}%)</span>
            <input
              type="range"
              min={0.05}
              max={0.55}
              step={0.05}
              value={ambientVolume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setAmbientVolume(v);
                wellnessAmbientAudio.setVolume(v);
              }}
              className="w-full accent-[#059669]"
            />
          </label>
        </div>

        {/* Focus & Pause Timer */}
        <div className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0284C7]" />
            Temporizador de meditación o pausa de enfoque
          </h3>
          <div className="flex items-center justify-between rounded-xl border fabro-border fabro-surface-elevated px-4 py-3">
            <span className="font-mono text-3xl font-bold tabular-nums">
              {focusMinDisp}:{focusSecDisp}
            </span>
            <div className="flex gap-1.5">
              {[3, 5, 10, 15, 25].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setFocusRunning(false);
                    setFocusMinutes(m);
                    setFocusSecondsLeft(m * 60);
                  }}
                  className={`px-2 py-1 rounded-lg border font-mono cursor-pointer ${
                    focusMinutes === m
                      ? 'border-[#0284C7] bg-[#0284C7] text-white'
                      : 'fabro-border fabro-surface'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFocusRunning((v) => !v)}
              className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#059669] text-white font-semibold cursor-pointer"
            >
              {focusRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {focusRunning ? 'Pausar sesión' : 'Iniciar temporizador'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFocusRunning(false);
                setFocusSecondsLeft(focusMinutes * 60);
              }}
              className="min-h-[40px] rounded-xl border fabro-border fabro-surface-elevated px-3.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Progressive Muscle Relaxation */}
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3 text-xs">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#059669]" />
          Guía rápida de relajación muscular progresiva (3 minutos)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PMR_STEPS.map((step) => (
            <div
              key={step}
              className="rounded-xl border fabro-border fabro-surface-elevated p-3 leading-relaxed"
            >
              {step}
            </div>
          ))}
        </div>
        <div className="pt-1">
          <button
            type="button"
            onClick={() => handleReadAloud(PMR_STEPS.join(' '))}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3.5 font-semibold cursor-pointer"
          >
            <Brain className="w-3.5 h-3.5 text-[#059669]" />
            {speaking ? 'Detener guía hablada' : 'Escuchar guía en voz alta (offline)'}
          </button>
        </div>
      </section>
    </div>
  );
};
