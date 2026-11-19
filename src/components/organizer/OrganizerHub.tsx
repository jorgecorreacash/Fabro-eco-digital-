import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Grid2x2,
  Inbox,
  Moon,
  Play,
  Plus,
  RotateCcw,
  Star,
  Sun,
  Sunrise,
  Trash2,
} from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { getTodayDateKey } from '../../services/localVault';
import type {
  EisenhowerQuadrant,
  OrganizerTabId,
  TimeBlockDuration,
  TimeBlockSector,
} from '../../types/ecosystem';
import { SwipeableSubscreenContainer } from '../navigation/SwipeableSubscreenContainer';

interface OrganizerHubProps {
  compact?: boolean;
}

const QUADRANTS: Array<{
  id: EisenhowerQuadrant;
  title: string;
  subtitle: string;
  borderClass: string;
  badgeClass: string;
  accentHex: string;
}> = [
  {
    id: 'hacer-ahora',
    title: 'Hacer Ahora',
    subtitle: 'Urgente e Importante',
    borderClass: 'border-2 border-rose-500/70',
    badgeClass: 'border-rose-500/45 bg-rose-500/12 text-rose-700 dark:text-rose-300',
    accentHex: '#F43F5E',
  },
  {
    id: 'planificar',
    title: 'Planificar',
    subtitle: 'Importante, No Urgente',
    borderClass: 'border-2 border-blue-600/70',
    badgeClass: 'border-blue-600/45 bg-blue-600/12 text-blue-700 dark:text-blue-300',
    accentHex: '#2563EB',
  },
  {
    id: 'delegar-rapido',
    title: 'Delegar / Rutina Rápida',
    subtitle: 'Urgente, Poco Importante',
    borderClass: 'border-2 border-amber-500/75',
    badgeClass: 'border-amber-500/45 bg-amber-500/12 text-amber-800 dark:text-amber-300',
    accentHex: '#F59E0B',
  },
  {
    id: 'posponer',
    title: 'Posponer / Eliminar',
    subtitle: 'Ni Urgente ni Importante',
    borderClass: 'border-2 border-slate-400/70 dark:border-slate-600',
    badgeClass: 'border-slate-400/45 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    accentHex: '#64748B',
  },
];

const SECTOR_STYLES: Record<
  TimeBlockSector,
  { label: string; border: string; bg: string; text: string }
> = {
  estudio: {
    label: 'Estudio',
    border: 'border-[#2563EB]',
    bg: 'bg-[#2563EB]/12',
    text: 'text-[#1D4ED8] dark:text-[#60A5FA]',
  },
  bienestar: {
    label: 'Bienestar',
    border: 'border-[#10B981]',
    bg: 'bg-[#10B981]/12',
    text: 'text-[#047857] dark:text-[#34D399]',
  },
  personal: {
    label: 'Personal',
    border: 'border-[#7C3AED]',
    bg: 'bg-[#7C3AED]/12',
    text: 'text-[#6D28D9] dark:text-[#C4B5FD]',
  },
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 -> 23:00

function formatHourLabel(hour: number, minute: number = 0): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const OrganizerHub: React.FC<OrganizerHubProps> = ({ compact = false }) => {
  const {
    inboxItems,
    organizerTasks,
    timeBlocks,
    dailyReview,
    organizerActiveTab,
    setOrganizerActiveTab,
    setQuickCaptureOpen,
    addInboxCapture,
    convertInboxToTask,
    scheduleInboxToTimeBlock,
    sendInboxToStudyNote,
    dismissInboxItem,
    addTimeBlock,
    toggleTimeBlockDone,
    deleteTimeBlock,
    startPomodoroForTask,
    addOrganizerTask,
    moveTaskQuadrant,
    toggleOrganizerTask,
    deleteOrganizerTask,
    toggleTop3Priority,
    updateMorningIntention,
    saveNightReflection,
    rolloverPendingTasksToTomorrow,
    navigateTo,
  } = useEcosystem();

  const [now, setNow] = useState(() => new Date());
  const [inlineInboxText, setInlineInboxText] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  // Per-inbox-item conversion state
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convType, setConvType] = useState<'task' | 'block' | 'note'>('task');
  const [convQuadrant, setConvQuadrant] = useState<EisenhowerQuadrant>('hacer-ahora');
  const [convSector, setConvSector] = useState<TimeBlockSector>('estudio');
  const [convSubject, setConvSubject] = useState('General');
  const [convHour, setConvHour] = useState(9);
  const [convMin, setConvMin] = useState<0 | 30>(0);
  const [convDuration, setConvDuration] = useState<TimeBlockDuration>(45);

  // New Time Block form
  const [blockTitle, setBlockTitle] = useState('');
  const [blockSubject, setBlockSubject] = useState('Estudio');
  const [blockHour, setBlockHour] = useState(10);
  const [blockMin, setBlockMin] = useState<0 | 30>(0);
  const [blockDuration, setBlockDuration] = useState<TimeBlockDuration>(60);
  const [blockSector, setBlockSector] = useState<TimeBlockSector>('estudio');

  // New Matrix Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubject, setTaskSubject] = useState('General');
  const [taskQuadrant, setTaskQuadrant] = useState<EisenhowerQuadrant>('hacer-ahora');
  const [taskSector, setTaskSector] = useState<TimeBlockSector>('estudio');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Daily Review local inputs
  const [reviewSubMode, setReviewSubMode] = useState<'morning' | 'night'>('morning');
  const [intentionDraft, setIntentionDraft] = useState(dailyReview.morningIntention);
  const [nightRefDraft, setNightRefDraft] = useState(dailyReview.nightReflection);
  const [nightGratDraft, setNightGratDraft] = useState(dailyReview.nightGratitude);

  useEffect(() => {
    setIntentionDraft(dailyReview.morningIntention);
    setNightRefDraft(dailyReview.nightReflection);
    setNightGratDraft(dailyReview.nightGratitude);
  }, [dailyReview.morningIntention, dailyReview.nightReflection, dailyReview.nightGratitude]);

  // Live current-time indicator every 30s
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const flashMsg = (msg: string) => {
    setActionMsg(msg);
    window.setTimeout(() => setActionMsg(null), 3200);
  };

  const todayKey = getTodayDateKey();
  const todayBlocks = useMemo(
    () =>
      timeBlocks
        .filter((b) => !b.dateKey || b.dateKey === todayKey)
        .sort((a, b) => a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute)),
    [timeBlocks, todayKey]
  );

  const top3Tasks = useMemo(
    () => organizerTasks.filter((t) => t.isTop3Priority).slice(0, 3),
    [organizerTasks]
  );

  const pendingTasks = useMemo(() => organizerTasks.filter((t) => !t.done), [organizerTasks]);
  const completedTasksCount = organizerTasks.filter((t) => t.done).length;
  const completedBlocksCount = todayBlocks.filter((b) => b.done).length;
  const totalDayItems = organizerTasks.length + todayBlocks.length;
  const completionPct =
    totalDayItems > 0
      ? Math.round(((completedTasksCount + completedBlocksCount) / totalDayItems) * 100)
      : 0;

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeStr = formatHourLabel(currentHour, currentMinute);

  const tabs: Array<{
    id: OrganizerTabId;
    label: string;
    badge?: number;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'inbox', label: 'Bandeja Rápida', badge: inboxItems.length, icon: Inbox },
    { id: 'bloques', label: 'Bloques Horarios', badge: todayBlocks.length, icon: CalendarClock },
    { id: 'matriz', label: 'Matriz Eisenhower', badge: pendingTasks.length, icon: Grid2x2 },
    { id: 'revision', label: 'Revisión Diaria', icon: Sunrise },
  ];

  const handleOpenConvert = (id: string, mode: 'task' | 'block' | 'note') => {
    if (convertingId === id && convType === mode) {
      setConvertingId(null);
      return;
    }
    setConvertingId(id);
    setConvType(mode);
  };

  const handleConfirmConversion = (inboxId: string) => {
    if (convType === 'task') {
      convertInboxToTask(inboxId, convQuadrant, convSubject || 'General', convSector);
      flashMsg('Convertido a tarea en la Matriz de Eisenhower.');
    } else if (convType === 'block') {
      scheduleInboxToTimeBlock(
        inboxId,
        convHour,
        convMin,
        convDuration,
        convSector,
        convSubject || 'General'
      );
      flashMsg(`Agendado a las ${formatHourLabel(convHour, convMin)}.`);
    } else {
      sendInboxToStudyNote(inboxId, convSubject || 'General');
      flashMsg('Enviado a Cuadernos Digitales en Sector Estudio.');
    }
    setConvertingId(null);
  };

  return (
    <section className="rounded-2xl border-2 border-[#10B981]/35 fabro-surface p-4 sm:p-6 space-y-5 shadow-[0_10px_26px_-12px_rgba(16,185,129,0.22)]">
      {/* Header & Quick Capture Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#047857] dark:text-[#34D399]">
            Centro Unificado de Organización Integral
          </p>
          <h2 className="font-display text-lg sm:text-xl font-bold">
            Bandeja, Bloques de Tiempo, Prioridades y Revisión
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setQuickCaptureOpen(true)}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0EA5E9] bg-[#0EA5E9] text-white px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Captura Rápida
          </button>
          {compact && (
            <button
              type="button"
              onClick={() => navigateTo('bienestar', 'organizador-integral')}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border-2 fabro-border fabro-surface-elevated px-3.5 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Vista completa
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4 Sub-tabs Navigation */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = organizerActiveTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOrganizerActiveTab(tab.id)}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-xs font-bold cursor-pointer transition-all active:scale-95 whitespace-nowrap ${
                active
                  ? 'border-[#10B981] bg-[#10B981] text-white shadow-[0_6px_14px_-6px_rgba(16,185,129,0.5)]'
                  : 'fabro-border fabro-surface-elevated hover:border-[#10B981]/60'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && (
                <span
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${
                    active ? 'bg-white/25 text-white' : 'fabro-surface border fabro-border'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {actionMsg && (
        <div className="rounded-xl border-2 border-[#10B981]/50 bg-[#10B981]/12 px-4 py-2.5 text-xs font-bold text-[#047857] dark:text-[#34D399]">
          {actionMsg}
        </div>
      )}

      <SwipeableSubscreenContainer
        items={tabs.map((t) => ({ id: t.id, label: t.label }))}
        activeId={organizerActiveTab}
        onSelect={(nextId) => setOrganizerActiveTab(nextId as OrganizerTabId)}
        accentColor="#10B981"
        galleryLabel="Indicador deslizable del Organizador Integral"
      >
      {/* TAB 1: BANDEJA DE ENTRADA RÁPIDA (INBOX) */}
      {organizerActiveTab === 'inbox' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border-2 fabro-border fabro-surface-elevated p-4">
            <div>
              <p className="text-xs font-bold flex items-center gap-2">
                <Inbox className="w-4 h-4 text-[#0EA5E9]" />
                Elementos sin clasificar: {inboxItems.length}
              </p>
              <p className="text-[11px] fabro-muted mt-0.5">
                Vaciá tu mente sin fricción y convertí cada captura cuando estés listo.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inlineInboxText.trim()) return;
                addInboxCapture(inlineInboxText);
                setInlineInboxText('');
                flashMsg('Captura guardada en la bandeja.');
              }}
              className="flex gap-2 w-full sm:w-auto sm:min-w-[320px]"
            >
              <input
                type="text"
                value={inlineInboxText}
                onChange={(e) => setInlineInboxText(e.target.value)}
                placeholder="Anotar algo rápido aquí..."
                className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface px-3 py-2 text-xs fabro-input"
              />
              <button
                type="submit"
                className="min-h-[44px] rounded-xl border-2 border-[#0EA5E9] bg-[#0EA5E9] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
              >
                Agregar
              </button>
            </form>
          </div>

          {inboxItems.length === 0 ? (
            <div className="rounded-xl border-2 fabro-border fabro-surface-elevated p-6 text-center text-xs fabro-muted space-y-2">
              <p className="font-bold text-[var(--fabro-text)]">Bandeja despejada (0 pendientes)</p>
              <p>Usá el botón flotante «+ Captura Rápida» en cualquier pantalla para anotar ideas al vuelo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inboxItems.map((item) => {
                const isEditingThis = convertingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border-2 border-[#0EA5E9]/35 fabro-surface-elevated p-4 space-y-3"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-bold leading-snug">{item.text}</p>
                        <p className="text-[11px] font-mono fabro-muted">
                          Capturado: {item.createdAt}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenConvert(item.id, 'task')}
                          className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
                            isEditingThis && convType === 'task'
                              ? 'border-[#2563EB] bg-[#2563EB] text-white'
                              : 'border-[#2563EB]/45 bg-[#2563EB]/10 text-[#1D4ED8] dark:text-[#60A5FA]'
                          }`}
                        >
                          Convertir en Tarea
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenConvert(item.id, 'block')}
                          className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
                            isEditingThis && convType === 'block'
                              ? 'border-[#10B981] bg-[#10B981] text-white'
                              : 'border-[#10B981]/45 bg-[#10B981]/10 text-[#047857] dark:text-[#34D399]'
                          }`}
                        >
                          Agendar en Bloque
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenConvert(item.id, 'note')}
                          className={`min-h-[44px] rounded-xl border-2 px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 ${
                            isEditingThis && convType === 'note'
                              ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                              : 'border-[#7C3AED]/45 bg-[#7C3AED]/10 text-[#6D28D9] dark:text-[#C4B5FD]'
                          }`}
                        >
                          Enviar a Apuntes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            dismissInboxItem(item.id);
                            flashMsg('Elemento descartado de la bandeja.');
                          }}
                          aria-label="Descartar captura"
                          className="min-h-[44px] min-w-[44px] rounded-xl border-2 fabro-border fabro-surface text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer active:scale-95"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {isEditingThis && (
                      <div className="pt-3 border-t fabro-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                        {convType === 'task' && (
                          <>
                            <select
                              value={convQuadrant}
                              onChange={(e) => setConvQuadrant(e.target.value as EisenhowerQuadrant)}
                              aria-label="Cuadrante de prioridad"
                              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
                            >
                              {QUADRANTS.map((q) => (
                                <option key={q.id} value={q.id}>
                                  {q.title}
                                </option>
                              ))}
                            </select>
                            <select
                              value={convSector}
                              onChange={(e) => setConvSector(e.target.value as TimeBlockSector)}
                              aria-label="Sector"
                              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
                            >
                              <option value="estudio">Estudio</option>
                              <option value="bienestar">Bienestar</option>
                              <option value="personal">Personal</option>
                            </select>
                          </>
                        )}

                        {convType === 'block' && (
                          <>
                            <div className="flex gap-1.5">
                              <select
                                value={convHour}
                                onChange={(e) => setConvHour(Number(e.target.value))}
                                aria-label="Hora"
                                className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface px-2 py-2 fabro-input"
                              >
                                {HOURS.slice(0, -1).map((h) => (
                                  <option key={h} value={h}>
                                    {formatHourLabel(h, 0).slice(0, 2)} h
                                  </option>
                                ))}
                              </select>
                              <select
                                value={convMin}
                                onChange={(e) => setConvMin(Number(e.target.value) as 0 | 30)}
                                aria-label="Minutos"
                                className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-2 py-2 fabro-input"
                              >
                                <option value={0}>:00</option>
                                <option value={30}>:30</option>
                              </select>
                            </div>
                            <select
                              value={convDuration}
                              onChange={(e) =>
                                setConvDuration(Number(e.target.value) as TimeBlockDuration)
                              }
                              aria-label="Duración"
                              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
                            >
                              <option value={30}>30 min</option>
                              <option value={45}>45 min</option>
                              <option value={60}>1 hora</option>
                              <option value={120}>2 horas</option>
                            </select>
                            <select
                              value={convSector}
                              onChange={(e) => setConvSector(e.target.value as TimeBlockSector)}
                              aria-label="Sector del bloque"
                              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
                            >
                              <option value="estudio">Estudio</option>
                              <option value="bienestar">Bienestar</option>
                              <option value="personal">Personal</option>
                            </select>
                          </>
                        )}

                        <input
                          type="text"
                          value={convSubject}
                          onChange={(e) => setConvSubject(e.target.value)}
                          placeholder="Materia o categoría..."
                          className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
                        />

                        <button
                          type="button"
                          onClick={() => handleConfirmConversion(item.id)}
                          className="min-h-[44px] rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
                        >
                          Confirmar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PLANIFICADOR DIARIO POR BLOQUES DE TIEMPO (06:00 - 23:00) */}
      {organizerActiveTab === 'bloques' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!blockTitle.trim()) return;
              addTimeBlock({
                title: blockTitle.trim(),
                subject: blockSubject.trim() || 'General',
                startHour: blockHour,
                startMinute: blockMin,
                durationMinutes: blockDuration,
                sector: blockSector,
              });
              setBlockTitle('');
              flashMsg(`Bloque agregado a las ${formatHourLabel(blockHour, blockMin)}.`);
            }}
            className="rounded-xl border-2 fabro-border fabro-surface-elevated p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs"
          >
            <input
              type="text"
              value={blockTitle}
              onChange={(e) => setBlockTitle(e.target.value)}
              placeholder="Actividad o sesión de estudio..."
              className="min-h-[44px] lg:col-span-2 rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
            />
            <input
              type="text"
              value={blockSubject}
              onChange={(e) => setBlockSubject(e.target.value)}
              placeholder="Materia / Área"
              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
            />
            <div className="flex gap-1.5">
              <select
                value={blockHour}
                onChange={(e) => setBlockHour(Number(e.target.value))}
                aria-label="Hora de inicio"
                className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface px-2 py-2 fabro-input"
              >
                {HOURS.slice(0, -1).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:
                  </option>
                ))}
              </select>
              <select
                value={blockMin}
                onChange={(e) => setBlockMin(Number(e.target.value) as 0 | 30)}
                aria-label="Minutos de inicio"
                className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-2 py-2 fabro-input"
              >
                <option value={0}>00</option>
                <option value={30}>30</option>
              </select>
            </div>
            <div className="flex gap-1.5">
              <select
                value={blockDuration}
                onChange={(e) => setBlockDuration(Number(e.target.value) as TimeBlockDuration)}
                aria-label="Duración del bloque"
                className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface px-2 py-2 fabro-input"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 h</option>
                <option value={120}>2 h</option>
              </select>
              <select
                value={blockSector}
                onChange={(e) => setBlockSector(e.target.value as TimeBlockSector)}
                aria-label="Sector del bloque"
                className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface px-2 py-2 fabro-input"
              >
                <option value="estudio">Estudio</option>
                <option value="bienestar">Bienestar</option>
                <option value="personal">Personal</option>
              </select>
            </div>
            <button
              type="submit"
              className="min-h-[44px] rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
            >
              + Agendar
            </button>
          </form>

          <div className="flex items-center justify-between gap-2 text-xs px-1">
            <span className="font-bold flex items-center gap-1.5 text-[#0284C7] dark:text-[#38BDF8]">
              <Clock className="w-4 h-4" />
              Hora actual en vivo: <span className="font-mono tabular-nums">{currentTimeStr}</span>
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {(['estudio', 'bienestar', 'personal'] as const).map((sec) => (
                <span
                  key={sec}
                  className={`rounded-lg border-2 px-2 py-0.5 font-bold ${SECTOR_STYLES[sec].border} ${SECTOR_STYLES[sec].bg} ${SECTOR_STYLES[sec].text}`}
                >
                  {SECTOR_STYLES[sec].label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 max-h-[540px] overflow-y-auto pr-1">
            {HOURS.map((hour) => {
              const slotBlocks = todayBlocks.filter((b) => b.startHour === hour);
              const isCurrentHour = currentHour === hour;
              return (
                <div
                  key={hour}
                  className={`rounded-xl border-2 p-2.5 transition-colors ${
                    isCurrentHour
                      ? 'border-[#0EA5E9] bg-[#0EA5E9]/8'
                      : 'fabro-border fabro-surface-elevated'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-16 shrink-0 pt-1">
                      <p className="font-mono text-xs font-extrabold tabular-nums">
                        {formatHourLabel(hour, 0)}
                      </p>
                      {isCurrentHour && (
                        <p className="text-[10px] font-bold text-[#0284C7] dark:text-[#38BDF8] font-mono tabular-nums">
                          Ahora {currentTimeStr}
                        </p>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      {slotBlocks.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBlockHour(hour);
                            setBlockMin(0);
                          }}
                          className="w-full min-h-[36px] text-left rounded-lg border border-dashed fabro-border px-3 py-1.5 text-[11px] fabro-muted hover:border-[#10B981] cursor-pointer"
                        >
                          Franja libre · Tocar para preseleccionar {formatHourLabel(hour, 0)}
                        </button>
                      ) : (
                        slotBlocks.map((block) => {
                          const st = SECTOR_STYLES[block.sector];
                          return (
                            <div
                              key={block.id}
                              className={`rounded-xl border-2 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${st.border} ${st.bg}`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleTimeBlockDone(block.id)}
                                  aria-label="Alternar bloque completado"
                                  className="mt-0.5 cursor-pointer shrink-0"
                                >
                                  {block.done ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Circle className="w-5 h-5 fabro-muted" />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span className={`font-bold ${st.text}`}>{st.label}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono font-bold tabular-nums">
                                      {formatHourLabel(block.startHour, block.startMinute)} (
                                      {block.durationMinutes} min)
                                    </span>
                                    {block.subject && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span className="fabro-muted truncate">{block.subject}</span>
                                      </>
                                    )}
                                  </div>
                                  <p
                                    className={`text-xs font-bold mt-0.5 ${
                                      block.done ? 'line-through opacity-60' : ''
                                    }`}
                                  >
                                    {block.title}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => startPomodoroForTask(block.subject || block.title)}
                                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                  Iniciar Pomodoro
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteTimeBlock(block.id)}
                                  aria-label="Eliminar bloque horario"
                                  className="min-h-[40px] min-w-[40px] rounded-xl border-2 fabro-border fabro-surface text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: MATRIZ DE PRIORIDADES DE EISENHOWER (4 CUADRANTES) */}
      {organizerActiveTab === 'matriz' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!taskTitle.trim()) return;
              addOrganizerTask(
                taskTitle.trim(),
                taskQuadrant,
                taskSubject.trim() || 'General',
                taskSector
              );
              setTaskTitle('');
              flashMsg('Tarea agregada a la Matriz de Eisenhower.');
            }}
            className="rounded-xl border-2 fabro-border fabro-surface-elevated p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs"
          >
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Nueva tarea prioritaria..."
              className="min-h-[44px] lg:col-span-2 rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
            />
            <input
              type="text"
              value={taskSubject}
              onChange={(e) => setTaskSubject(e.target.value)}
              placeholder="Materia / Categoría"
              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-3 py-2 fabro-input"
            />
            <select
              value={taskQuadrant}
              onChange={(e) => setTaskQuadrant(e.target.value as EisenhowerQuadrant)}
              aria-label="Cuadrante"
              className="min-h-[44px] rounded-xl border-2 fabro-border fabro-surface px-2.5 py-2 fabro-input"
            >
              {QUADRANTS.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
            <div className="flex gap-1.5">
              <select
                value={taskSector}
                onChange={(e) => setTaskSector(e.target.value as TimeBlockSector)}
                aria-label="Sector"
                className="min-h-[44px] flex-1 rounded-xl border-2 fabro-border fabro-surface px-2 py-2 fabro-input"
              >
                <option value="estudio">Estudio</option>
                <option value="bienestar">Bienestar</option>
                <option value="personal">Personal</option>
              </select>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl border-2 border-[#2563EB] bg-[#2563EB] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
              >
                + Sumar
              </button>
            </div>
          </form>

          <p className="text-[11px] fabro-muted">
            Tip: En computadora podés arrastrar tarjetas entre cuadrantes; en móvil usá el selector rápido o la estrella para fijar en tu Top 3 del día.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {QUADRANTS.map((quad) => {
              const items = organizerTasks.filter((t) => t.quadrant === quad.id);
              return (
                <div
                  key={quad.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggingTaskId) {
                      moveTaskQuadrant(draggingTaskId, quad.id);
                      setDraggingTaskId(null);
                    }
                  }}
                  className={`rounded-2xl ${quad.borderClass} fabro-surface-elevated p-4 space-y-3 min-h-[190px]`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-block rounded-lg border px-2.5 py-0.5 text-[11px] font-bold ${quad.badgeClass}`}
                      >
                        {quad.subtitle}
                      </span>
                      <h3 className="font-display text-base font-bold mt-1">{quad.title}</h3>
                    </div>
                    <span className="font-mono text-xs font-bold fabro-muted tabular-nums">
                      {items.length}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-xs fabro-muted py-4 text-center border border-dashed fabro-border rounded-xl">
                      Sin tareas en este cuadrante.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {items.map((task) => (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => setDraggingTaskId(task.id)}
                          onDragEnd={() => setDraggingTaskId(null)}
                          className="rounded-xl border-2 fabro-border fabro-surface p-3 space-y-2 text-xs cursor-grab active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => toggleOrganizerTask(task.id)}
                              className="flex items-start gap-2 text-left flex-1 min-w-0 cursor-pointer"
                            >
                              {task.done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-4 h-4 fabro-muted shrink-0 mt-0.5" />
                              )}
                              <div className="min-w-0">
                                <p
                                  className={`font-bold leading-snug ${
                                    task.done ? 'line-through opacity-60' : ''
                                  }`}
                                >
                                  {task.title}
                                </p>
                                <p className="text-[11px] fabro-muted">
                                  {task.subject} · {SECTOR_STYLES[task.sector].label}
                                </p>
                              </div>
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleTop3Priority(task.id)}
                                title={
                                  task.isTop3Priority
                                    ? 'Quitar de Prioridades Máximas (Top 3)'
                                    : 'Fijar como Prioridad Máxima (Top 3)'
                                }
                                aria-label="Fijar en Top 3"
                                className={`min-h-[36px] min-w-[36px] rounded-lg border flex items-center justify-center cursor-pointer ${
                                  task.isTop3Priority
                                    ? 'border-[#F59E0B] bg-[#F59E0B]/15 text-[#F59E0B]'
                                    : 'fabro-border fabro-muted'
                                }`}
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${
                                    task.isTop3Priority ? 'fill-current' : ''
                                  }`}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteOrganizerTask(task.id)}
                                aria-label="Eliminar tarea"
                                className="min-h-[36px] min-w-[36px] rounded-lg border fabro-border text-rose-600 dark:text-rose-400 flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t fabro-border">
                            <select
                              value={task.quadrant}
                              onChange={(e) =>
                                moveTaskQuadrant(task.id, e.target.value as EisenhowerQuadrant)
                              }
                              aria-label="Mover a cuadrante"
                              className="min-h-[34px] rounded-lg border fabro-border fabro-surface-elevated px-2 py-1 text-[11px] fabro-input"
                            >
                              {QUADRANTS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  Mover a: {opt.title}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => startPomodoroForTask(task.subject || task.title)}
                              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-[#2563EB]/45 bg-[#2563EB]/10 text-[#1D4ED8] dark:text-[#60A5FA] px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              Pomodoro
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: REVISIÓN DIARIA GUIADA (MAÑANA Y NOCHE) */}
      {organizerActiveTab === 'revision' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setReviewSubMode('morning')}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 ${
                reviewSubMode === 'morning'
                  ? 'border-[#F59E0B] bg-[#F59E0B] text-white'
                  : 'fabro-border fabro-surface-elevated'
              }`}
            >
              <Sun className="w-4 h-4" />
              Modo Mañana · Top 3 del Día
            </button>
            <button
              type="button"
              onClick={() => setReviewSubMode('night')}
              className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-xs font-bold cursor-pointer active:scale-95 ${
                reviewSubMode === 'night'
                  ? 'border-[#7C3AED] bg-[#7C3AED] text-white'
                  : 'fabro-border fabro-surface-elevated'
              }`}
            >
              <Moon className="w-4 h-4" />
              Modo Noche · Cierre y Mañana
            </button>
          </div>

          {reviewSubMode === 'morning' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border-2 border-[#F59E0B]/45 fabro-surface-elevated p-5 space-y-4 text-xs">
                <div>
                  <p className="text-[11px] font-bold uppercase text-[#B45309] dark:text-[#FBBF24]">
                    «El último día de tu vida» · Enfoque consciente
                  </p>
                  <h3 className="font-display text-base font-bold mt-1">
                    Elegí hasta 3 Prioridades Máximas ({top3Tasks.length}/3)
                  </h3>
                  <p className="fabro-muted mt-0.5">
                    Se fijan automáticamente en la parte superior de tu Espacio de Trabajo para no perder el rumbo.
                  </p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {organizerTasks.length === 0 ? (
                    <p className="fabro-muted">Agregá tareas en la Matriz para elegir tus 3 prioridades.</p>
                  ) : (
                    organizerTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => toggleTop3Priority(task.id)}
                        className={`w-full min-h-[44px] rounded-xl border-2 px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer ${
                          task.isTop3Priority
                            ? 'border-[#F59E0B] bg-[#F59E0B]/12 font-bold'
                            : 'fabro-border fabro-surface'
                        }`}
                      >
                        <span className="truncate flex-1">{task.title}</span>
                        <span className="inline-flex items-center gap-1 text-[11px] shrink-0">
                          <Star
                            className={`w-3.5 h-3.5 ${
                              task.isTop3Priority ? 'text-[#F59E0B] fill-current' : 'fabro-muted'
                            }`}
                          />
                          {task.isTop3Priority ? 'Top 3' : 'Fijar'}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[#10B981]/35 fabro-surface-elevated p-5 space-y-4 text-xs">
                <h3 className="font-display text-base font-bold">Intención de la mañana</h3>
                <textarea
                  rows={4}
                  value={intentionDraft}
                  onChange={(e) => setIntentionDraft(e.target.value)}
                  placeholder="Si hoy fuera el último día, ¿qué haría que valga la pena vivirlo con serenidad?"
                  className="w-full rounded-xl border-2 fabro-border fabro-surface p-3 leading-relaxed fabro-input"
                />
                <button
                  type="button"
                  onClick={() => {
                    updateMorningIntention(intentionDraft);
                    flashMsg('Intención de mañana guardada.');
                  }}
                  className="min-h-[44px] w-full rounded-xl border-2 border-[#F59E0B] bg-[#F59E0B] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
                >
                  Guardar intención y Top 3
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl border-2 border-[#7C3AED]/40 fabro-surface-elevated p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-base font-bold">Balance del día</h3>
                  <span className="font-mono text-lg font-extrabold text-[#7C3AED] dark:text-[#C4B5FD] tabular-nums">
                    {completionPct}%
                  </span>
                </div>
                <div className="h-3 rounded-full border fabro-border fabro-surface overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#7C3AED] to-[#10B981] transition-all"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <p className="fabro-muted leading-relaxed">
                  Completaste {completedTasksCount} de {organizerTasks.length} tareas y{' '}
                  {completedBlocksCount} de {todayBlocks.length} bloques horarios hoy.
                </p>

                <div className="rounded-xl border-2 fabro-border fabro-surface p-4 space-y-3">
                  <p className="font-bold">
                    ¿Quedaron {pendingTasks.length} tareas pendientes?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const moved = rolloverPendingTasksToTomorrow();
                      flashMsg(
                        moved > 0
                          ? `Se pasaron ${moved} tarea(s) pendientes para mañana con la mente tranquila.`
                          : 'No quedan tareas pendientes para pasar a mañana.'
                      );
                    }}
                    className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#7C3AED] bg-[#7C3AED] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Pasar pendientes a mañana (1 toque)
                  </button>
                  {dailyReview.rolledOverAt && (
                    <p className="text-[11px] fabro-muted">
                      Último pase registrado: {dailyReview.rolledOverAt}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[#10B981]/35 fabro-surface-elevated p-5 space-y-3">
                <h3 className="font-display text-base font-bold">Reflexión y gratitud nocturna</h3>
                <label className="block space-y-1">
                  <span className="fabro-muted font-semibold">¿Qué aprendí o resolví hoy?</span>
                  <textarea
                    rows={3}
                    value={nightRefDraft}
                    onChange={(e) => setNightRefDraft(e.target.value)}
                    placeholder="Breve aprendizaje del día..."
                    className="w-full rounded-xl border-2 fabro-border fabro-surface p-2.5 fabro-input"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="fabro-muted font-semibold">Algo por lo que agradecer hoy</span>
                  <textarea
                    rows={2}
                    value={nightGratDraft}
                    onChange={(e) => setNightGratDraft(e.target.value)}
                    placeholder="Un momento, persona o avance..."
                    className="w-full rounded-xl border-2 fabro-border fabro-surface p-2.5 fabro-input"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    saveNightReflection(nightRefDraft, nightGratDraft);
                    flashMsg('Cierre del día guardado localmente.');
                  }}
                  className="min-h-[44px] w-full rounded-xl border-2 border-[#10B981] bg-[#10B981] text-white px-4 py-2 font-bold cursor-pointer active:scale-95"
                >
                  Guardar cierre nocturno
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </SwipeableSubscreenContainer>

      {/* Quick shortcut footer to Study Notes */}
      <div className="pt-2 border-t fabro-border flex flex-wrap items-center justify-between gap-2 text-[11px] fabro-muted">
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-[#2563EB]" />
          Conectado con Cuadernos Digitales y Pomodoro de Sector 1 Estudio
        </span>
        <button
          type="button"
          onClick={() => navigateTo('estudio', 'materias-apuntes')}
          className="font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
        >
          Ir a Apuntes de Estudio
        </button>
      </div>
    </section>
  );
};
