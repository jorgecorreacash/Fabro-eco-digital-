import React, { useMemo, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  Bot,
  Calendar,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  KeyRound,
  Loader2,
  Plus,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { useEcosystem } from '../../../../context/EcosystemContext';
import {
  PRESET_WELLNESS_CHALLENGES,
  WELLNESS_EDUCATION_GUIDES,
} from '../../../../data/wellnessCatalog';
import { sendByokChatCompletion } from '../../../../services/byokChatClient';
import { findByokKeyForWellnessEngine } from '../../../../services/wellnessAiService';
import {
  buildAuthorizedCoachContext,
  downloadWellnessPdfReport,
  exportWellnessBackupJson,
  exportWellnessCsv,
  generateLocalCoachReply,
  todayIsoDate,
} from '../../../../services/wellnessVault';
import type {
  CoachDataPermissions,
  WellnessChallengeItem,
  WellnessStateSnapshot,
} from '../../../../types/wellness';
import { OrganizerHub } from '../../../organizer/OrganizerHub';
import { WellnessAiHeaderBar } from '../WellnessAiHeaderBar';
import { WellnessAiStudioPanel } from '../WellnessAiStudioPanel';
import { WellnessVideoLibraryPanel } from '../WellnessVideoLibraryPanel';
import { WellnessBarChart, WellnessLineChart } from './WellnessCharts';

interface WellnessCoachHistoryChallengesPanelProps {
  section:
    | 'educacion-conocimiento'
    | 'agenda-objetivos'
    | 'fabro-coach'
    | 'mi-historial'
    | 'fabro-desafios';
  state: WellnessStateSnapshot;
  onUpdateState: (updater: (prev: WellnessStateSnapshot) => WellnessStateSnapshot) => void;
}

export const WellnessCoachHistoryChallengesPanel: React.FC<
  WellnessCoachHistoryChallengesPanelProps
> = ({ section, state, onUpdateState }) => {
  const {
    profile,
    moodLogs,
    byokKeys,
    getByokSecret,
    wellnessAiEngine,
    addScheduledReminder,
    addWallPost,
    navigateTo,
  } = useEcosystem();

  const [feedback, setFeedback] = useState<string | null>(null);
  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  // --- 11. Agenda ---
  const [remTitle, setRemTitle] = useState('');
  const [remDate, setRemDate] = useState(todayIsoDate());
  const [remTime, setRemTime] = useState('09:00');

  // --- 12. FABRO COACH ---
  const [coachInput, setCoachInput] = useState('');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachTab, setCoachTab] = useState<'conversacion' | 'herramientas-ia'>('conversacion');

  // --- 13. Mi historial ---
  const [histFilter, setHistFilter] = useState<'todo' | 'nutricion' | 'ejercicio' | 'sueno' | 'salud'>('todo');
  const [histDays, setHistDays] = useState<7 | 30 | 90 | 365>(30);
  const [includeEmotionalInPdf, setIncludeEmotionalInPdf] = useState(false);

  // --- 14. FABRO DESAFÍOS ---
  const [customChTitle, setCustomChTitle] = useState('');
  const [customChDays, setCustomChDays] = useState('14');
  const [customChGoal, setCustomChGoal] = useState('');

  const triggerDownload = (content: string, fileName: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // 10. EDUCACIÓN Y CONOCIMIENTO
  // =========================================================================
  if (section === 'educacion-conocimiento') {
    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0369A1]">
            10 · Educación y conocimiento
          </p>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0369A1]" />
            Guías prácticas de bienestar y videoteca educativa
          </h2>
          <p className="fabro-muted">
            Contenidos claros sobre nutrición cotidiana, fuerza segura, sueño, regulación emocional y hábitos sostenibles.
          </p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WELLNESS_EDUCATION_GUIDES.map((g) => (
            <article key={g.id} className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0369A1]">
                {g.category}
              </p>
              <h3 className="font-display text-base font-bold">{g.title}</h3>
              <p className="fabro-muted leading-relaxed">{g.summary}</p>
              <ul className="space-y-1.5 list-disc pl-4 leading-relaxed">
                {g.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <WellnessVideoLibraryPanel />
      </div>
    );
  }

  // =========================================================================
  // 11. AGENDA Y OBJETIVOS
  // =========================================================================
  if (section === 'agenda-objetivos') {
    const unifiedAgenda = [
      ...state.medicalAppointments.map((a) => ({
        id: a.id,
        date: a.date,
        label: `Turno médico: ${a.specialty}${a.time ? ` (${a.time})` : ''}`,
        area: 'Salud',
      })),
      ...state.familyEvents.map((f) => ({
        id: f.id,
        date: f.date,
        label: `Social/Familia: ${f.title}`,
        area: 'Relaciones',
      })),
      ...state.personalGoals
        .filter((g) => !g.completed)
        .map((g) => ({
          id: g.id,
          date: g.dueDate,
          label: `Meta (${g.horizon}): ${g.title} (${g.currentValue}/${g.targetValue} ${g.unit})`,
          area: 'Objetivos',
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">
              11 · Agenda y objetivos
            </p>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#2563EB]" />
              Calendario centralizado de bienestar y Organizador integral
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={remTitle}
              onChange={(e) => setRemTitle(e.target.value)}
              placeholder="Nuevo recordatorio local (ej. Tomar agua, caminar, turno)"
              className="sm:col-span-2 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
            />
            <input
              type="date"
              value={remDate}
              onChange={(e) => setRemDate(e.target.value)}
              className="min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
            />
            <div className="flex gap-1.5">
              <input
                type="time"
                value={remTime}
                onChange={(e) => setRemTime(e.target.value)}
                className="flex-1 min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-2 font-mono fabro-input"
              />
              <button
                type="button"
                onClick={() => {
                  if (!remTitle.trim()) return;
                  const targetMs = new Date(`${remDate}T${remTime || '09:00'}`).getTime();
                  const mins = Math.max(1, Math.round((targetMs - Date.now()) / 60000));
                  addScheduledReminder(
                    remTitle.trim(),
                    'bienestar',
                    'organizador-integral',
                    mins
                  );
                  setRemTitle('');
                  notify('Recordatorio local con aviso sonoro programado.');
                }}
                className="min-h-[38px] rounded-xl bg-[#2563EB] text-white px-3 font-semibold cursor-pointer"
              >
                <Bell className="w-4 h-4" />
              </button>
            </div>
          </div>
          {feedback && (
            <p className="font-semibold text-[#047857] dark:text-[#34D399]">{feedback}</p>
          )}
        </section>

        <section className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2.5">
          <h3 className="text-sm font-bold">
            Eventos y compromisos unificados de Bienestar ({unifiedAgenda.length})
          </h3>
          {unifiedAgenda.length === 0 ? (
            <p className="fabro-muted">
              A medida que cargues turnos médicos, metas, actividades familiares o desafíos, aparecerán aquí automáticamente.
            </p>
          ) : (
            <div className="divide-y fabro-border">
              {unifiedAgenda.slice(0, 15).map((ev) => (
                <div key={ev.id} className="py-2 flex items-center justify-between gap-2">
                  <span>{ev.label}</span>
                  <span className="font-mono text-[11px] fabro-muted shrink-0">
                    {ev.date} · {ev.area}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Preserved OrganizerHub */}
        <OrganizerHub />
      </div>
    );
  }

  // =========================================================================
  // 12. FABRO COACH
  // =========================================================================
  if (section === 'fabro-coach') {
    const togglePerm = (k: keyof CoachDataPermissions) => {
      onUpdateState((prev) => ({
        ...prev,
        coachPermissions: {
          ...prev.coachPermissions,
          [k]: !prev.coachPermissions[k],
        },
      }));
    };

    const handleAskCoach = async (customPrompt?: string) => {
      const q = (customPrompt ?? coachInput).trim();
      if (!q) return;

      const userMsg = {
        id: `cm-u-${Date.now()}`,
        role: 'user' as const,
        createdAt: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        text: q,
      };
      onUpdateState((prev) => ({
        ...prev,
        coachMessages: [...prev.coachMessages, userMsg],
      }));
      if (!customPrompt) setCoachInput('');

      const foundByok = findByokKeyForWellnessEngine(byokKeys, getByokSecret, wellnessAiEngine);
      if (foundByok) {
        setCoachLoading(true);
        const ctx = buildAuthorizedCoachContext(state, state.coachPermissions, {
          moodLogsCount: moodLogs.length,
        });
        const res = await sendByokChatCompletion({
          keyMeta: foundByok.keyMeta,
          rawApiKey: foundByok.secret,
          history: [],
          userText: `Consulta del usuario: "${q}"

Contexto AUTORIZADO por el usuario (no inventes datos que no estén aquí):
${ctx.authorizedCount === 0 ? 'El usuario no autorizó lectura de registros todavía.' : ctx.summaryLines.join('\n')}

Respondé en español claro separando explícitamente:
[Datos registrados]
[Estimación orientativa] (si aplica)
[Sugerencias prácticas]`,
          systemInstructionOverride:
            'Sos FABRO COACH, un asistente de hábitos y organización personal dentro de FABRO Bienestar. Nunca diagnostiques enfermedades ni prescribas medicamentos. Diferenciá claramente entre datos reales registrados por el usuario, estimaciones y sugerencias generales.',
        });
        setCoachLoading(false);
        if (res.ok && res.content.trim()) {
          onUpdateState((prev) => ({
            ...prev,
            coachMessages: [
              ...prev.coachMessages,
              {
                id: `cm-a-${Date.now()}`,
                role: 'coach',
                createdAt: new Date().toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
                text: res.content.trim(),
                sourceLabel: `BYOK · ${foundByok.keyMeta.providerName}`,
              },
            ],
          }));
          return;
        }
      }

      const localReply = generateLocalCoachReply(q, state, state.coachPermissions, {
        moodLogsCount: moodLogs.length,
      });
      onUpdateState((prev) => ({
        ...prev,
        coachMessages: [
          ...prev.coachMessages,
          {
            id: `cm-a-${Date.now()}`,
            role: 'coach',
            createdAt: new Date().toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            text: localReply,
            sourceLabel: 'Motor analítico local offline ($0)',
          },
        ],
      }));
    };

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4338CA]">
                12 · FABRO COACH · Asistente transversal
              </p>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Bot className="w-5 h-5 text-[#4338CA]" />
                Análisis transparente sobre tus datos autorizados
              </h2>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setCoachTab('conversacion')}
                className={`min-h-[36px] rounded-xl border px-3 font-semibold cursor-pointer ${
                  coachTab === 'conversacion'
                    ? 'border-[#4338CA] bg-[#4338CA] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                Conversación Coach
              </button>
              <button
                type="button"
                onClick={() => setCoachTab('herramientas-ia')}
                className={`min-h-[36px] rounded-xl border px-3 font-semibold cursor-pointer ${
                  coachTab === 'herramientas-ia'
                    ? 'border-[#4338CA] bg-[#4338CA] text-white'
                    : 'fabro-border fabro-surface-elevated fabro-muted'
                }`}
              >
                Generadores BYOK
              </button>
            </div>
          </div>

          <div className="rounded-xl border fabro-border fabro-surface-elevated p-3 flex items-start gap-2 fabro-muted">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#4338CA]" />
            <span>
              FABRO COACH funciona 100% gratis con análisis local offline y, si conectás tu propia clave en BYOK, potencia las respuestas con tu proveedor elegido. No realiza diagnósticos ni reemplaza atención médica.
            </span>
          </div>

          {/* Explicit Data Authorization Switches */}
          <div className="space-y-2">
            <p className="font-semibold">
              Autorización explícita de lectura (todo desactivado por defecto hasta que decidas):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {(
                [
                  ['nutrition', 'Nutrición'],
                  ['fitness', 'Actividad física'],
                  ['sleep', 'Sueño'],
                  ['habitsAndGoals', 'Hábitos y metas'],
                  ['mood', 'Ánimo'],
                  ['healthMetrics', 'Salud'],
                ] as Array<[keyof CoachDataPermissions, string]>
              ).map(([k, label]) => (
                <label
                  key={k}
                  className="flex items-center gap-2 rounded-xl border fabro-border fabro-surface-elevated px-2.5 py-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={state.coachPermissions[k]}
                    onChange={() => togglePerm(k)}
                    className="accent-[#4338CA]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        {coachTab === 'conversacion' ? (
          <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                'Resumí mi progreso real de esta semana',
                '¿Qué metas o hábitos tengo pendientes?',
                'Explicame cómo interpretar mi IMC orientativo',
                'Armame un plan simple de 3 hábitos sostenibles',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => void handleAskCoach(preset)}
                  className="rounded-lg border fabro-border fabro-surface-elevated px-3 py-1.5 font-medium hover:border-[#4338CA] cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {state.coachMessages.length === 0 ? (
                <div className="rounded-xl border border-dashed fabro-border p-6 text-center fabro-muted">
                  Elegí qué módulos autorizás arriba y escribí una consulta para recibir un análisis claro separando datos registrados, estimaciones y sugerencias.
                </div>
              ) : (
                state.coachMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl border p-3.5 space-y-1 ${
                      msg.role === 'user'
                        ? 'border-[#4338CA]/35 bg-[#4338CA]/5 ml-6'
                        : 'fabro-border fabro-surface-elevated mr-6'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] fabro-muted font-mono">
                      <span className="font-semibold uppercase">
                        {msg.role === 'user' ? 'Tu consulta' : 'FABRO COACH'}
                      </span>
                      <span>
                        {msg.sourceLabel ? `${msg.sourceLabel} · ` : ''}
                        {msg.createdAt}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleAskCoach();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                placeholder="Consultá sobre tus registros, hábitos, rutinas o indicadores..."
                className="flex-1 min-h-[42px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
              />
              <button
                type="submit"
                disabled={coachLoading}
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-[#4338CA] text-white px-4 font-semibold cursor-pointer disabled:opacity-60"
              >
                {coachLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t fabro-border fabro-muted">
              <button
                type="button"
                onClick={() => navigateTo('ia', 'claves-byok')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#4338CA] hover:underline cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Configurar clave propia en IA BYOK (opcional)
              </button>
              {state.coachMessages.length > 0 && (
                <button
                  type="button"
                  onClick={() => onUpdateState((prev) => ({ ...prev, coachMessages: [] }))}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  Limpiar conversación
                </button>
              )}
            </div>
          </section>
        ) : (
          <div className="space-y-4">
            <WellnessAiHeaderBar />
            <WellnessAiStudioPanel key="well-v2-coach-studio" initialTab="habitos" />
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 13. MI HISTORIAL
  // =========================================================================
  if (section === 'mi-historial') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - histDays);
    const cutoffIso = cutoff.toISOString().slice(0, 10);

    const unifiedRows = useMemo(() => {
      const items: Array<{ id: string; date: string; kind: string; title: string; detail: string }> =
        [];
      if (histFilter === 'todo' || histFilter === 'nutricion') {
        state.mealLogs
          .filter((m) => m.date >= cutoffIso)
          .forEach((m) =>
            items.push({
              id: m.id,
              date: m.date,
              kind: 'Nutrición',
              title: `${m.name} (${m.slot})`,
              detail: `${m.calories} kcal · P${m.proteinG}g C${m.carbsG}g G${m.fatG}g`,
            })
          );
      }
      if (histFilter === 'todo' || histFilter === 'ejercicio') {
        state.workoutLogs
          .filter((w) => w.date >= cutoffIso)
          .forEach((w) =>
            items.push({
              id: w.id,
              date: w.date,
              kind: 'Entrenamiento',
              title: w.routineName,
              detail: `${w.durationMin} min · RPE ${w.effortRpe}/10`,
            })
          );
      }
      if (histFilter === 'todo' || histFilter === 'sueno') {
        state.sleepLogs
          .filter((s) => s.date >= cutoffIso)
          .forEach((s) =>
            items.push({
              id: s.id,
              date: s.date,
              kind: 'Sueño',
              title: `${s.bedtime} – ${s.wakeTime}`,
              detail: `${s.durationHours} h · Calidad ${s.quality}/5`,
            })
          );
      }
      if (histFilter === 'todo' || histFilter === 'salud') {
        state.healthMetrics
          .filter((h) => h.date >= cutoffIso)
          .forEach((h) =>
            items.push({
              id: h.id,
              date: h.date,
              kind: 'Salud',
              title: 'Medición personal',
              detail:
                [
                  h.weightKg ? `${h.weightKg} kg` : null,
                  h.systolicBp && h.diastolicBp ? `PA ${h.systolicBp}/${h.diastolicBp}` : null,
                  h.heartRateBpm ? `${h.heartRateBpm} lpm` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Registro guardado',
            })
          );
      }
      return items.sort((a, b) => b.date.localeCompare(a.date));
    }, [cutoffIso, histFilter, state.healthMetrics, state.mealLogs, state.sleepLogs, state.workoutLogs]);

    const weightLine = [...state.healthMetrics]
      .filter((h) => typeof h.weightKg === 'number' && h.date >= cutoffIso)
      .reverse()
      .map((h) => ({ label: h.date.slice(5), value: h.weightKg as number }));

    const sleepBars = [...state.sleepLogs]
      .filter((s) => s.date >= cutoffIso)
      .slice(0, 10)
      .reverse()
      .map((s) => ({ label: s.date.slice(5), value: s.durationHours }));

    return (
      <div className="space-y-5 text-xs">
        <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#334155] dark:text-slate-300">
                13 · Mi historial unificado
              </p>
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <History className="w-5 h-5" />
                Línea temporal personal y exportación portátil
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadWellnessPdfReport(
                    state,
                    profile.displayName || 'Usuario FABRO',
                    includeEmotionalInPdf
                  )
                }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#0F172A] text-white dark:bg-white dark:text-slate-950 px-3.5 font-semibold cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    exportWellnessCsv(state),
                    `fabro-bienestar-${todayIsoDate()}.csv`,
                    'text/csv;charset=utf-8'
                  )
                }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 font-semibold cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    exportWellnessBackupJson(state),
                    `fabro-bienestar-respaldo-${todayIsoDate()}.json`,
                    'application/json'
                  )
                }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border fabro-border fabro-surface-elevated px-3 font-semibold cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t fabro-border pt-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['todo', 'Todo'],
                  ['nutricion', 'Nutrición'],
                  ['ejercicio', 'Entrenamiento'],
                  ['sueno', 'Sueño'],
                  ['salud', 'Salud'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setHistFilter(id)}
                  className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                    histFilter === id
                      ? 'bg-[#059669] text-white'
                      : 'fabro-surface-elevated fabro-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 cursor-pointer fabro-muted">
                <input
                  type="checkbox"
                  checked={includeEmotionalInPdf}
                  onChange={(e) => setIncludeEmotionalInPdf(e.target.checked)}
                  className="accent-[#059669]"
                />
                <span>Incluir diario emocional en PDF</span>
              </label>
              <select
                value={histDays}
                onChange={(e) => setHistDays(Number(e.target.value) as 7 | 30 | 90 | 365)}
                className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2.5 font-mono fabro-input"
              >
                <option value={7}>7 días</option>
                <option value={30}>30 días</option>
                <option value={90}>90 días</option>
                <option value={365}>Último año</option>
              </select>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WellnessLineChart title="Evolución de peso" points={weightLine} unit=" kg" accentColor="#BE123C" />
          <WellnessBarChart title="Horas de sueño en el período" data={sleepBars} unit="h" accentColor="#0F766E" />
        </div>

        <section className="rounded-2xl border fabro-border fabro-surface p-4 space-y-2">
          <h3 className="text-sm font-bold">Registros encontrados ({unifiedRows.length})</h3>
          {unifiedRows.length === 0 ? (
            <p className="fabro-muted">
              No hay registros en este período y filtro. Tus datos aparecerán aquí automáticamente al usar cada módulo.
            </p>
          ) : (
            <div className="divide-y fabro-border max-h-96 overflow-y-auto">
              {unifiedRows.map((row) => (
                <div key={`${row.kind}-${row.id}`} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      <span className="fabro-muted font-mono mr-2">{row.date}</span>
                      [{row.kind}] {row.title}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums fabro-muted">{row.detail}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // =========================================================================
  // 14. FABRO DESAFÍOS
  // =========================================================================
  const today = todayIsoDate();

  const activatePreset = (preset: (typeof PRESET_WELLNESS_CHALLENGES)[number]) => {
    if (state.challenges.some((c) => c.id === preset.id)) {
      notify('Ese desafío ya está en tu lista.');
      return;
    }
    const item: WellnessChallengeItem = {
      ...preset,
      startDate: today,
      completedDates: [],
      active: true,
    };
    onUpdateState((prev) => ({ ...prev, challenges: [item, ...prev.challenges] }));
    notify(`Desafío «${item.title}» iniciado.`);
  };

  const toggleChallengeToday = (id: string) => {
    onUpdateState((prev) => ({
      ...prev,
      challenges: prev.challenges.map((c) => {
        if (c.id !== id) return c;
        const done = c.completedDates.includes(today);
        return {
          ...c,
          completedDates: done
            ? c.completedDates.filter((d) => d !== today)
            : [today, ...c.completedDates],
        };
      }),
    }));
  };

  const shareChallengeVoluntarily = async (c: WellnessChallengeItem) => {
    const pct = Math.min(100, Math.round((c.completedDates.length / Math.max(1, c.durationDays)) * 100));
    await addWallPost({
      author: profile.displayName || 'Usuario FABRO',
      fabroId: profile.fabroId || 'FABRO',
      authorAvatar: profile.photoURL,
      text: `Avance voluntario en FABRO Desafíos: «${c.title}» — ${c.completedDates.length}/${c.durationDays} días (${pct}%). #Bienestar`,
      origin: 'bienestar',
      categoryTag: 'Hábitos saludables',
    });
    notify('Progreso del desafío compartido voluntariamente en Comunidad de Bienestar.');
  };

  return (
    <div className="space-y-5 text-xs">
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#EA580C]">
          14 · FABRO DESAFÍOS · Retos voluntarios
        </p>
        <h2 className="font-display text-xl font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#EA580C]" />
          Constancia personal, calendario de cumplimiento e insignias
        </h2>
        <p className="fabro-muted">
          Sumate a retos saludables a tu ritmo o creá los tuyos. Compartir en comunidad es siempre opcional.
        </p>
        {feedback && (
          <p className="font-semibold text-[#047857] dark:text-[#34D399] flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            {feedback}
          </p>
        )}
      </section>

      {/* Active Challenges */}
      <section className="rounded-2xl border fabro-border fabro-surface p-5 space-y-3">
        <h3 className="text-sm font-bold">Mis desafíos activos ({state.challenges.length})</h3>
        {state.challenges.length === 0 ? (
          <p className="fabro-muted">
            Elegí uno del catálogo abajo o creá un desafío personalizado para comenzar.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {state.challenges.map((c) => {
              const pct = Math.min(
                100,
                Math.round((c.completedDates.length / Math.max(1, c.durationDays)) * 100)
              );
              const doneToday = c.completedDates.includes(today);
              const earned = c.completedDates.length >= c.durationDays;
              return (
                <div
                  key={c.id}
                  className="rounded-xl border fabro-border fabro-surface-elevated p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">{c.title}</p>
                      <p className="text-[11px] fabro-muted">{c.dailyGoalLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateState((prev) => ({
                          ...prev,
                          challenges: prev.challenges.filter((x) => x.id !== c.id),
                        }))
                      }
                      className="fabro-muted hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div className="h-full bg-[#EA580C]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between font-mono text-[11px] fabro-muted">
                    <span>
                      {c.completedDates.length}/{c.durationDays} días ({pct}%)
                    </span>
                    {earned && (
                      <span className="text-[#EA580C] font-bold inline-flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        Insignia: {c.badgeTitle}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => toggleChallengeToday(c.id)}
                      className={`min-h-[34px] rounded-lg px-3 font-semibold cursor-pointer ${
                        doneToday
                          ? 'bg-[#059669] text-white'
                          : 'border border-[#EA580C] text-[#EA580C]'
                      }`}
                    >
                      {doneToday ? 'Cumplido hoy ✓' : 'Marcar día de hoy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareChallengeVoluntarily(c)}
                      className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border fabro-border px-2.5 fabro-muted hover:text-[var(--fabro-text)] cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" />
                      Compartir avance
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Preset Catalog + Custom Creator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
          <h3 className="text-sm font-bold">Catálogo de desafíos voluntarios</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRESET_WELLNESS_CHALLENGES.map((preset) => (
              <div
                key={preset.id}
                className="rounded-xl border fabro-border fabro-surface-elevated p-3 space-y-1.5 flex flex-col justify-between"
              >
                <div>
                  <p className="font-semibold">{preset.title}</p>
                  <p className="text-[11px] fabro-muted mt-0.5">{preset.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => activatePreset(preset)}
                  className="min-h-[32px] mt-2 rounded-lg border border-[#EA580C] text-[#EA580C] font-semibold cursor-pointer hover:bg-[#EA580C] hover:text-white transition-colors"
                >
                  Iniciar desafío
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-4 rounded-2xl border fabro-border fabro-surface p-4 space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#EA580C]" />
            Crear desafío propio
          </h3>
          <input
            type="text"
            value={customChTitle}
            onChange={(e) => setCustomChTitle(e.target.value)}
            placeholder="Nombre del desafío"
            className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          />
          <input
            type="number"
            min={3}
            max={90}
            value={customChDays}
            onChange={(e) => setCustomChDays(e.target.value)}
            placeholder="Duración en días"
            className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 font-mono fabro-input"
          />
          <input
            type="text"
            value={customChGoal}
            onChange={(e) => setCustomChGoal(e.target.value)}
            placeholder="Objetivo diario (ej. 10 min de estiramiento)"
            className="w-full min-h-[38px] rounded-xl border fabro-border fabro-surface-elevated px-3 fabro-input"
          />
          <button
            type="button"
            onClick={() => {
              if (!customChTitle.trim()) return;
              const item: WellnessChallengeItem = {
                id: `ch-custom-${Date.now()}`,
                title: customChTitle.trim(),
                category: 'personalizado',
                description: customChGoal.trim() || 'Desafío personal voluntario',
                durationDays: Math.min(90, Math.max(3, Number(customChDays) || 14)),
                dailyGoalLabel: customChGoal.trim() || 'Cumplir meta diaria',
                startDate: today,
                completedDates: [],
                active: true,
                badgeTitle: 'Compromiso Personal',
              };
              onUpdateState((prev) => ({ ...prev, challenges: [item, ...prev.challenges] }));
              setCustomChTitle('');
              setCustomChGoal('');
              notify(`Desafío «${item.title}» creado.`);
            }}
            className="min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#EA580C] text-white font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Crear desafío
          </button>
        </div>
      </div>
    </div>
  );
};
