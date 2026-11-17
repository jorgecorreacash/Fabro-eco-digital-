import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  GraduationCap,
  Languages,
  Layers,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Save,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAIGateway } from '../../context/AIGatewayContext';
import { useFabro } from '../../context/FabroContext';
import { useHabitTimer } from '../../context/HabitTimerContext';
import { markdownToHtml } from '../../lib/exporters';
import { FabroAIActionStrip } from '../common/FabroAIActionStrip';

type StudyTab = 'pomodoro' | 'agenda' | 'practica' | 'idiomas_audio';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const FabroStudyView: React.FC = () => {
  const {
    subjects,
    selectedSubjectId,
    calendarEvents,
    decks,
    exams,
    logStudySession,
    createNote,
    setActiveSection,
    setAiDraftPrompt,
  } = useFabro();

  const { sendGatewayChat, personalConnections, sendPersonalChat } = useAIGateway();
  const {
    activeHabit,
    remainingSeconds: habitRemainingSec,
    isRunning: habitRunning,
    isPaused: habitPaused,
    requestOpenHabitStudio,
  } = useHabitTimer();

  const [tab, setTab] = useState<StudyTab>('pomodoro');
  const [notice, setNotice] = useState<string | null>(null);

  // 1. Pomodoro / Study Timer
  const [presetMinutes, setPresetMinutes] = useState<number>(25);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [running, setRunning] = useState(false);
  const [focusTopic, setFocusTopic] = useState('');
  const [focusSubjectId, setFocusSubjectId] = useState(selectedSubjectId || subjects[0]?.id || '');

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const applyPreset = (mins: number) => {
    setRunning(false);
    setPresetMinutes(mins);
    setSecondsLeft(mins * 60);
  };

  const handleLogPomodoroSession = async () => {
    const elapsedMins = Math.max(1, Math.round((presetMinutes * 60 - secondsLeft) / 60) || presetMinutes);
    await logStudySession({
      subjectId: focusSubjectId || subjects[0]?.id || '',
      activityType: 'lectura',
      durationMinutes: elapsedMins,
      topic: focusTopic.trim() || `Bloque Pomodoro (${presetMinutes} min)`,
      date: new Date().toISOString().slice(0, 10),
    });
    setNotice(`Sesión de ${elapsedMins} minutos registrada en Mi Progreso.`);
  };

  // 2. Study Planner from Calendar + Subjects
  const [dailyHoursGoal, setDailyHoursGoal] = useState(3);
  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return calendarEvents
      .filter((ev) => !ev.completed && ev.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [calendarEvents]);

  const generatedPlanMarkdown = useMemo(() => {
    const lines = [
      `# Planificador Académico Diario (${dailyHoursGoal} hs/día)`,
      '',
      '## Prioridades próximas de tu agenda',
      ...(upcomingEvents.length > 0
        ? upcomingEvents.map((ev) => `- **${ev.date}** · ${ev.title} (${ev.type})`)
        : ['- Sin eventos pendientes próximos: dedicá el bloque al repaso general de tus materias activas.']),
      '',
      '## Distribución sugerida por materias',
      ...(subjects.length > 0
        ? subjects.slice(0, 5).map((s, idx) => {
            const mins = Math.round((dailyHoursGoal * 60) / Math.min(5, subjects.length));
            return `${idx + 1}. **${s.name}**: ${mins} min de lectura activa + 15 min de autoevaluación.`;
          })
        : ['1. Cargá materias en "Mis materias" para generar una distribución personalizada.']),
    ];
    return lines.join('\n');
  }, [dailyHoursGoal, subjects, upcomingEvents]);

  // 3. Translator & Quick AI Oral Simulator
  const [sourceText, setSourceText] = useState('');
  const [targetLang, setTargetLang] = useState('Inglés académico');
  const [translatedText, setTranslatedText] = useState('');
  const [translating, setTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setTranslating(true);
    setNotice(null);
    const prompt = `Traducí con precisión terminológica al idioma "${targetLang}" el siguiente texto académico, conservando el sentido técnico y agregando si corresponde 2 aclaraciones breves de vocabulario:\n\n${sourceText}`;
    try {
      const activeConn = personalConnections.find((c) => c.status === 'connected');
      if (activeConn) {
        const res = await sendPersonalChat({
          connectionId: activeConn.id,
          prompt,
        });
        setTranslatedText(res.text);
      } else {
        const res = await sendGatewayChat({
          prompt,
          routingMode: 'automatica',
          requestedProviderId: 'auto',
          useWebSearch: false,
        });
        setTranslatedText(res.text);
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'No se pudo completar la traducción.');
    } finally {
      setTranslating(false);
    }
  };

  // 4. Web Speech API Read-Aloud & Live Audio Transcription
  const [speechText, setSpeechText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const recognitionCtor =
    typeof window !== 'undefined'
      ? (window as unknown as {
          SpeechRecognition?: new () => SpeechRecognitionLike;
          webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
          .webkitSpeechRecognition
      : undefined;

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleReadAloud = () => {
    if (!speechSupported) {
      setNotice('Tu navegador no soporta síntesis de voz Web Speech API.');
      return;
    }
    const text = (speechText || translatedText || sourceText).trim();
    if (!text) {
      setNotice('Ingresá o pegá texto primero para escucharlo en voz alta.');
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-AR';
    utter.rate = speechRate;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  const handleStopSpeaking = () => {
    if (speechSupported) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  const handleToggleTranscription = () => {
    if (transcribing && recognitionRef.current) {
      recognitionRef.current.stop();
      setTranscribing(false);
      return;
    }
    if (!recognitionCtor) {
      setNotice('El dictado por micrófono (SpeechRecognition) requiere Chrome o Edge compatible.');
      return;
    }
    const rec = new recognitionCtor();
    rec.lang = 'es-AR';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      let chunk = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          chunk += ev.results[i][0].transcript + ' ';
        }
      }
      if (chunk.trim()) {
        setSpeechText((prev) => (prev ? `${prev.trim()} ${chunk.trim()}` : chunk.trim()));
      }
    };
    rec.onerror = () => setTranscribing(false);
    rec.onend = () => setTranscribing(false);
    recognitionRef.current = rec;
    setTranscribing(true);
    rec.start();
  };

  const handleSaveStudyArtifact = async (title: string, content: string) => {
    if (!content.trim()) return;
    await createNote({
      subjectId: focusSubjectId || subjects[0]?.id || '',
      unit: '',
      folder: 'FABRO STUDY',
      title,
      contentHtml: markdownToHtml(content),
      contentText: content,
      tags: ['fabro-study'],
      attachments: [],
      offlineAvailable: true,
    });
    setNotice(`"${title}" guardado en Apuntes.`);
  };

  const formatSec = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };

  const activeContentForAI =
    tab === 'agenda'
      ? generatedPlanMarkdown
      : [sourceText, translatedText, speechText].filter(Boolean).join('\n\n') || generatedPlanMarkdown;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            FABRO STUDY · PRODUCTIVIDAD, PRÁCTICA Y VOZ
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Pomodoro, Planificador, Simulador Oral, Traductor y Lectura en Voz Alta
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 max-w-3xl">
            Centralizá tus bloques de concentración, agenda de entregas, mazos de repaso, traducción académica y transcripción por voz en un solo tablero.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <Timer className="w-4 h-4 text-sky-500 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white truncate">
                Hábito activo: {activeHabit.name}{' '}
                <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                  ({habitRunning || habitPaused ? formatSec(habitRemainingSec) : `${activeHabit.durationMinutes} min`})
                </span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configurá rutinas, alertas sonoras, dieta nutricional y bienestar con IA desde Temporizador de Hábitos.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestOpenHabitStudio}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span>Abrir Hábitos y Bienestar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'pomodoro', label: 'Temporizador Pomodoro', icon: Clock },
            { id: 'agenda', label: 'Agenda y Planificador', icon: Calendar },
            { id: 'practica', label: 'Flashcards y Simulador Oral', icon: GraduationCap },
            { id: 'idiomas_audio', label: 'Traductor, Lectura y Dictado', icon: Languages },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as StudyTab)}
                className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-sky-500 bg-sky-600 text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] text-slate-700 dark:text-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {notice && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-medium text-sky-800 dark:text-sky-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {tab === 'pomodoro' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-6 flex flex-col items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-8 space-y-5">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Pomodoro 25m', mins: 25 },
                { label: 'Bloque profundo 50m', mins: 50 },
                { label: 'Pausa corta 5m', mins: 5 },
              ].map((p) => (
                <button
                  key={p.mins}
                  type="button"
                  onClick={() => applyPreset(p.mins)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    presetMinutes === p.mins
                      ? 'border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <p className="font-mono text-6xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">
              {formatSec(secondsLeft)}
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {running ? 'Pausar' : 'Iniciar'}
              </button>
              <button
                type="button"
                onClick={() => applyPreset(presetMinutes)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reiniciar
              </button>
              <button
                type="button"
                onClick={() => void handleLogPomodoroSession()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Registrar sesión
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4 text-xs">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Configuración de sesión enfocada
            </h3>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Materia vinculada
              </label>
              <select
                value={focusSubjectId}
                onChange={(e) => setFocusSubjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="">General / Estudio libre</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tema u objetivo del bloque
              </label>
              <input
                type="text"
                value={focusTopic}
                onChange={(e) => setFocusTopic(e.target.value)}
                placeholder="Ej.: Lectura crítica Unidad 3 y resolución de casos"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </section>
      )}

      {tab === 'agenda' && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Agenda académica y planificador automático
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Basado en tus {upcomingEvents.length} próximos eventos y {subjects.length} materias activas.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Horas/día:</label>
              <input
                type="number"
                min={1}
                max={14}
                value={dailyHoursGoal}
                onChange={(e) => setDailyHoursGoal(Math.max(1, Math.min(14, Number(e.target.value) || 2)))}
                className="w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1 font-mono tabular-nums"
              />
              <button
                type="button"
                onClick={() => setActiveSection('calendario')}
                className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
              >
                Abrir Calendario completo
              </button>
            </div>
          </div>

          <pre className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-4 text-xs font-sans whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed">
            {generatedPlanMarkdown}
          </pre>

          <button
            type="button"
            onClick={() => void handleSaveStudyArtifact('Planificador de estudio diario', generatedPlanMarkdown)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Guardar planificación en Apuntes
          </button>
        </section>
      )}

      {tab === 'practica' && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
              <Layers className="w-5 h-5" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Flashcards y Repaso Espaciado
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Tenés <span className="font-mono font-bold tabular-nums">{decks.length}</span> mazos activos con algoritmo SM-2 para memorizar conceptos, leyes y definiciones.
            </p>
            <button
              type="button"
              onClick={() => setActiveSection('memorizacion')}
              className="w-full rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
            >
              Ir a Memorización y Flashcards
            </button>
          </article>

          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <GraduationCap className="w-5 h-5" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Simulador de Exámenes y Mesa Oral
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Practicá exámenes escritos u orales evaluados (<span className="font-mono font-bold tabular-nums">{exams.length}</span> historial registrado) o iniciá una defensa oral en vivo.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setActiveSection('examenes')}
                className="w-full rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
              >
                Abrir Exámenes FABRO
              </button>
              <button
                type="button"
                onClick={() => {
                  setAiDraftPrompt(
                    '/SIMULADOR_ORAL Actuá como tribunal de examen oral universitario. Hacé una pregunta por turno, esperá mi respuesta, corregí precisión conceptual y sugerí cómo defender mejor el argumento.'
                  );
                  setActiveSection('fabro-ai');
                }}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Iniciar Tribunal Oral en FABRO IA
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <BookMarked className="w-5 h-5" />
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Diccionario Técnico y Glosario
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Consultá terminología disciplinar y guardá definiciones vinculadas a tus materias.
            </p>
            <button
              type="button"
              onClick={() => setActiveSection('diccionario')}
              className="w-full rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 cursor-pointer"
            >
              Abrir Diccionario FABRO
            </button>
          </article>
        </section>
      )}

      {tab === 'idiomas_audio' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Translator */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Languages className="w-4 h-4 text-sky-500" />
                Traductor Académico
              </h3>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2.5 py-1.5 text-slate-900 dark:text-white"
              >
                <option value="Inglés académico">Inglés académico</option>
                <option value="Español técnico">Español técnico</option>
                <option value="Portugués">Portugués</option>
                <option value="Francés">Francés</option>
                <option value="Italiano">Italiano</option>
                <option value="Alemán">Alemán</option>
              </select>
            </div>
            <textarea
              rows={5}
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder="Pegá un párrafo, abstract o cita para traducir con terminología precisa..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-3 text-slate-900 dark:text-white"
            />
            <button
              type="button"
              disabled={translating || !sourceText.trim()}
              onClick={() => void handleTranslate()}
              className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer"
            >
              {translating ? 'Traduciendo...' : 'Traducir ahora'}
            </button>
            {translatedText && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090D16] p-3.5 space-y-2">
                <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed">
                  {translatedText}
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveStudyArtifact(`Traducción (${targetLang})`, translatedText)}
                  className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold hover:underline cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar traducción en Apuntes
                </button>
              </div>
            )}
          </section>

          {/* Read-Aloud & Live Voice Transcription */}
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-500" />
                Lectura en Voz Alta y Transcripción
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Velocidad:</span>
                <select
                  value={speechRate}
                  onChange={(e) => setSpeechRate(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] px-2 py-1 font-mono"
                >
                  <option value={0.85}>0.85x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                </select>
              </div>
            </div>

            <textarea
              rows={5}
              value={speechText}
              onChange={(e) => setSpeechText(e.target.value)}
              placeholder="Escribí, pegá apuntes para escuchar en voz alta o usá el micrófono para dictar en vivo..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#090D16] p-3 text-slate-900 dark:text-white"
            />

            <div className="flex flex-wrap gap-2">
              {speaking ? (
                <button
                  type="button"
                  onClick={handleStopSpeaking}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 font-semibold text-white cursor-pointer"
                >
                  <VolumeX className="w-4 h-4" />
                  Detener lectura
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReadAloud}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  Escuchar texto
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleTranscription}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 font-semibold cursor-pointer ${
                  transcribing
                    ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {transcribing ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {transcribing ? 'Detener dictado' : 'Transcribir micrófono'}
              </button>

              {speechText.trim() && (
                <button
                  type="button"
                  onClick={() => void handleSaveStudyArtifact('Transcripción y notas de audio', speechText)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3.5 py-2 font-semibold text-sky-700 dark:text-sky-300 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  Guardar en Apuntes
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Acciones directas con FABRO IA sobre este material de estudio
        </p>
        <FabroAIActionStrip
          title="Sesión de estudio FABRO"
          content={activeContentForAI}
          onSavedNote={(msg) => setNotice(msg)}
        />
      </section>
    </div>
  );
};
