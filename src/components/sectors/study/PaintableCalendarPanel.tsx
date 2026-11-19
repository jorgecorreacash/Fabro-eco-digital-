import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  CALENDAR_ALARM_TONE_LABELS,
  playCalendarAlarmTone,
} from '../../../services/calendarAlarmAudio';
import type {
  CalendarAlarmTone,
  CalendarColorCode,
  PaintedCalendarEvent,
  TimeBlockDuration,
} from '../../../types/ecosystem';

interface ColorPaletteMeta {
  code: CalendarColorCode;
  label: string;
  shortLabel: string;
  hex: string;
  cellBg: string;
  borderClass: string;
  badgeClass: string;
}

const COLOR_CODES: ColorPaletteMeta[] = [
  {
    code: 'examen',
    label: 'Examen / Parcial',
    shortLabel: 'Examen',
    hex: '#EF4444',
    cellBg: 'bg-rose-500/18',
    borderClass: 'border-rose-500',
    badgeClass: 'bg-rose-600 text-white border-rose-600',
  },
  {
    code: 'trabajo',
    label: 'Día de Trabajo / Cursada',
    shortLabel: 'Cursada / Trabajo',
    hex: '#2563EB',
    cellBg: 'bg-blue-500/18',
    borderClass: 'border-blue-500',
    badgeClass: 'bg-blue-600 text-white border-blue-600',
  },
  {
    code: 'entrega',
    label: 'Entrega de TP',
    shortLabel: 'Entrega TP',
    hex: '#10B981',
    cellBg: 'bg-emerald-500/18',
    borderClass: 'border-emerald-500',
    badgeClass: 'bg-emerald-600 text-white border-emerald-600',
  },
  {
    code: 'estudio',
    label: 'Estudio Intensivo',
    shortLabel: 'Estudio',
    hex: '#7C3AED',
    cellBg: 'bg-violet-500/18',
    borderClass: 'border-violet-500',
    badgeClass: 'bg-violet-600 text-white border-violet-600',
  },
  {
    code: 'personal',
    label: 'Evento Personal',
    shortLabel: 'Personal',
    hex: '#D97706',
    cellBg: 'bg-amber-500/20',
    borderClass: 'border-amber-500',
    badgeClass: 'bg-amber-500 text-slate-950 border-amber-500',
  },
];

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function getColorMeta(code: CalendarColorCode): ColorPaletteMeta {
  return COLOR_CODES.find((c) => c.code === code) || COLOR_CODES[0];
}

export const PaintableCalendarPanel: React.FC = () => {
  const {
    paintedCalendarEvents,
    savePaintedCalendarEvent,
    deletePaintedCalendarEvent,
    notificationPermission,
    requestNotificationPermission,
    navigateTo,
  } = useEcosystem();

  const today = new Date();
  const todayKey = toDateKey(today);

  const [viewMode, setViewMode] = useState<'mensual' | 'semanal'>('mensual');
  const [cursorDate, setCursorDate] = useState<Date>(
    new Date(today.getFullYear(), today.getMonth(), today.getDate())
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  // Day Event Editor State
  const [colorCode, setColorCode] = useState<CalendarColorCode>('examen');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [startHour, setStartHour] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<TimeBlockDuration>(60);
  const [alarmEnabled, setAlarmEnabled] = useState<boolean>(true);
  const [alarmTime, setAlarmTime] = useState<string>('09:30');
  const [alarmTone, setAlarmTone] = useState<CalendarAlarmTone>('campana');
  const [feedback, setFeedback] = useState<string | null>(null);

  const eventsByDate = useMemo(() => {
    const map: Record<string, PaintedCalendarEvent[]> = {};
    paintedCalendarEvents.forEach((ev) => {
      map[ev.dateKey] = [...(map[ev.dateKey] || []), ev];
    });
    return map;
  }, [paintedCalendarEvents]);

  const monthCells = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // Monday = 0 ... Sunday = 6
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date; key: string; inMonth: boolean }> = [];

    for (let i = offset - 1; i >= 0; i -= 1) {
      const d = new Date(year, month, -i);
      cells.push({ date: d, key: toDateKey(d), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month, day);
      cells.push({ date: d, key: toDateKey(d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const nextDay = cells.length - (offset + daysInMonth) + 1;
      const d = new Date(year, month + 1, nextDay);
      cells.push({ date: d, key: toDateKey(d), inMonth: false });
    }
    return cells;
  }, [cursorDate]);

  const weekCells = useMemo(() => {
    const base = new Date(`${selectedDateKey}T12:00:00`);
    const offset = (base.getDay() + 6) % 7;
    const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset);
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
      return { date: d, key: toDateKey(d), inMonth: true };
    });
  }, [selectedDateKey]);

  const selectedDayEvents = eventsByDate[selectedDateKey] || [];
  const upcomingAlarms = useMemo(
    () =>
      paintedCalendarEvents
        .filter((e) => e.alarmEnabled && !e.alarmFired)
        .sort((a, b) => `${a.dateKey} ${a.alarmTime}`.localeCompare(`${b.dateKey} ${b.alarmTime}`))
        .slice(0, 6),
    [paintedCalendarEvents]
  );

  const monthLabel = cursorDate.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

  const shiftPeriod = (dir: -1 | 1) => {
    if (viewMode === 'mensual') {
      setCursorDate(new Date(cursorDate.getFullYear(), cursorDate.getMonth() + dir, 1));
    } else {
      const cur = new Date(`${selectedDateKey}T12:00:00`);
      cur.setDate(cur.getDate() + dir * 7);
      setSelectedDateKey(toDateKey(cur));
      setCursorDate(cur);
    }
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    savePaintedCalendarEvent({
      dateKey: selectedDateKey,
      colorCode,
      title: cleanTitle,
      subject: subject.trim() || getColorMeta(colorCode).shortLabel,
      notes: notes.trim(),
      startHour,
      durationMinutes,
      alarmEnabled,
      alarmTime,
      alarmTone,
    });

    setTitle('');
    setNotes('');
    setFeedback(
      `Evento pintado en ${selectedDateKey} y sincronizado con tus Bloques de Tiempo${
        alarmEnabled ? ` (Alarma sonora ${alarmTime} hs)` : ''
      }.`
    );
    window.setTimeout(() => setFeedback(null), 3500);
  };

  const handleQuickPaint = (code: CalendarColorCode) => {
    setColorCode(code);
    if (!title.trim()) {
      setTitle(getColorMeta(code).label);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + View Mode Switcher + Color Legend */}
      <div className="rounded-2xl border-2 border-[#06B6D4]/40 fabro-surface p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-[#06B6D4]" />
              Calendario Interactivo Pintable y Alarmas Sonoras
            </h2>
            <p className="text-xs fabro-muted mt-0.5">
              Tocá cualquier día para pintarlo por código de color, activar recordatorio con sonido y sincronizarlo automáticamente con tus Bloques de Tiempo.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border-2 fabro-border fabro-surface-elevated p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('mensual')}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-bold cursor-pointer ${
                  viewMode === 'mensual' ? 'bg-[#2563EB] text-white' : 'fabro-muted'
                }`}
              >
                Mensual
              </button>
              <button
                type="button"
                onClick={() => setViewMode('semanal')}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-bold cursor-pointer ${
                  viewMode === 'semanal' ? 'bg-[#2563EB] text-white' : 'fabro-muted'
                }`}
              >
                Semanal
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('bienestar', 'organizador-integral')}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border-2 border-[#0EA5E9]/60 bg-[#0EA5E9]/12 text-[#0284C7] dark:text-[#38BDF8] px-3 py-1.5 text-xs font-bold cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Clock className="w-3.5 h-3.5" />
              Ver Bloques de Tiempo
            </button>
          </div>
        </div>

        {/* Color Legend Chips */}
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {COLOR_CODES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => handleQuickPaint(c.code)}
              className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-1 font-bold cursor-pointer transition-all ${
                colorCode === c.code
                  ? c.badgeClass
                  : 'fabro-border fabro-surface-elevated hover:opacity-90'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/50"
                style={{ backgroundColor: c.hex }}
              />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Calendar Grid (Left) + Day Painter & Sound Alarm Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Calendar Grid */}
        <div className="lg:col-span-7 rounded-2xl border-2 fabro-border fabro-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              aria-label="Período anterior"
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border-2 fabro-border fabro-surface-elevated cursor-pointer active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="font-display text-sm sm:text-base font-bold capitalize">
                {monthLabel}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCursorDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
                  setSelectedDateKey(todayKey);
                }}
                className="text-[11px] font-bold text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
              >
                Ir a Hoy ({todayKey})
              </button>
            </div>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              aria-label="Período siguiente"
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border-2 fabro-border fabro-surface-elevated cursor-pointer active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold fabro-muted">
            {WEEKDAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div
            className={`grid grid-cols-7 gap-1.5 ${
              viewMode === 'semanal' ? 'min-h-[150px]' : ''
            }`}
          >
            {(viewMode === 'mensual' ? monthCells : weekCells).map((cell) => {
              const dayEvents = eventsByDate[cell.key] || [];
              const primaryEvent = dayEvents[0];
              const primaryMeta = primaryEvent ? getColorMeta(primaryEvent.colorCode) : null;
              const isSelected = cell.key === selectedDateKey;
              const isToday = cell.key === todayKey;
              const hasAlarm = dayEvents.some((e) => e.alarmEnabled);

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => setSelectedDateKey(cell.key)}
                  className={`rounded-xl border-2 p-1.5 sm:p-2 text-left flex flex-col justify-between transition-all cursor-pointer active:scale-[0.97] ${
                    viewMode === 'semanal' ? 'min-h-[120px]' : 'min-h-[62px] sm:min-h-[74px]'
                  } ${
                    primaryMeta
                      ? `${primaryMeta.cellBg} ${primaryMeta.borderClass}`
                      : 'fabro-border fabro-surface-elevated'
                  } ${!cell.inMonth ? 'opacity-45' : ''} ${
                    isSelected ? 'ring-2 ring-offset-1 ring-[#2563EB] shadow-md' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-mono font-bold tabular-nums ${
                        isToday
                          ? 'rounded-md bg-[#2563EB] text-white px-1.5 py-0.5 text-[11px]'
                          : ''
                      }`}
                    >
                      {cell.date.getDate()}
                    </span>
                    {hasAlarm && (
                      <Bell className="w-3 h-3 text-amber-600 dark:text-amber-300 shrink-0" />
                    )}
                  </div>

                  {dayEvents.length > 0 && (
                    <div className="space-y-0.5 mt-1">
                      <div className="flex flex-wrap gap-1">
                        {dayEvents.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getColorMeta(ev.colorCode).hex }}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] font-bold leading-tight line-clamp-2 hidden sm:block">
                        {primaryEvent.title}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Painter & Sound Alarm Panel */}
        <div className="lg:col-span-5 space-y-4">
          <form
            onSubmit={handleSaveEvent}
            className="rounded-2xl border-2 border-[#2563EB]/35 fabro-surface p-4 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#2563EB]" />
                Pintar día: <span className="font-mono">{selectedDateKey}</span>
              </h3>
              <span
                className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold ${
                  getColorMeta(colorCode).badgeClass
                }`}
              >
                {getColorMeta(colorCode).shortLabel}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {COLOR_CODES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setColorCode(c.code)}
                  title={c.label}
                  className={`min-h-[38px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-transform active:scale-95 ${
                    colorCode === c.code
                      ? 'border-current scale-[1.03] shadow-sm'
                      : 'fabro-border opacity-75'
                  }`}
                  style={{
                    backgroundColor: `${c.hex}25`,
                    borderColor: colorCode === c.code ? c.hex : undefined,
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-[9px] font-bold truncate max-w-full px-1">
                    {c.shortLabel.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Parcial de Derecho Civil / Entrega TP 2 / Cursada..."
              className="min-h-[42px] w-full rounded-xl border-2 fabro-border fabro-surface-elevated px-3 py-2 text-xs fabro-input"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Materia o etiqueta"
                className="min-h-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated px-2.5 py-1.5 text-xs fabro-input"
              />
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                aria-label="Hora de bloque"
                className="min-h-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated px-2 py-1.5 text-xs font-mono fabro-input"
              >
                {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                  <option key={h} value={h}>
                    Bloque {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value) as TimeBlockDuration)}
                aria-label="Duración en bloques de tiempo"
                className="min-h-[40px] rounded-xl border-2 fabro-border fabro-surface-elevated px-2 py-1.5 text-xs font-semibold fabro-input"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>1 hora</option>
                <option value={120}>2 horas</option>
              </select>
            </div>

            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas o temas a repasar para este evento (opcional)..."
              className="w-full rounded-xl border-2 fabro-border fabro-surface-elevated p-2.5 text-xs fabro-input"
            />

            {/* Sound Alarm Configuration */}
            <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/8 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alarmEnabled}
                    onChange={(e) => setAlarmEnabled(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <BellRing className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                  Recordatorio con Sonido (Web Audio)
                </label>
                {notificationPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={() => void requestNotificationPermission()}
                    className="text-[10px] font-bold underline text-amber-700 dark:text-amber-300 cursor-pointer"
                  >
                    Activar aviso PWA
                  </button>
                )}
              </div>

              {alarmEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="time"
                    value={alarmTime}
                    onChange={(e) => setAlarmTime(e.target.value)}
                    aria-label="Hora de la alarma"
                    className="sm:col-span-4 min-h-[38px] rounded-xl border-2 fabro-border fabro-surface px-2.5 py-1 text-xs font-mono fabro-input"
                  />
                  <select
                    value={alarmTone}
                    onChange={(e) => setAlarmTone(e.target.value as CalendarAlarmTone)}
                    aria-label="Tono de alarma"
                    className="sm:col-span-5 min-h-[38px] rounded-xl border-2 fabro-border fabro-surface px-2 py-1 text-xs font-semibold fabro-input"
                  >
                    {(Object.keys(CALENDAR_ALARM_TONE_LABELS) as CalendarAlarmTone[]).map((t) => (
                      <option key={t} value={t}>
                        {CALENDAR_ALARM_TONE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => playCalendarAlarmTone(alarmTone)}
                    className="sm:col-span-3 min-h-[38px] inline-flex items-center justify-center gap-1 rounded-xl border-2 border-amber-500 bg-amber-500 text-slate-950 px-2.5 py-1 text-[11px] font-bold cursor-pointer active:scale-95"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Probar
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#2563EB] bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Pintar día y Agendar en Bloques de Tiempo
            </button>

            {feedback && (
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <Check className="w-4 h-4 shrink-0" />
                {feedback}
              </p>
            )}
          </form>

          {/* Events on Selected Day */}
          <div className="rounded-2xl border-2 fabro-border fabro-surface p-4 space-y-2.5 text-xs">
            <h3 className="font-display text-sm font-bold">
              Eventos del {selectedDateKey} ({selectedDayEvents.length})
            </h3>
            {selectedDayEvents.length === 0 ? (
              <p className="fabro-muted text-xs">
                No hay eventos pintados en esta fecha todavía. Elegí un color arriba y guardá tu tarea o parcial.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((ev) => {
                  const meta = getColorMeta(ev.colorCode);
                  return (
                    <div
                      key={ev.id}
                      className={`rounded-xl border-2 ${meta.borderClass} ${meta.cellBg} p-3 flex items-start justify-between gap-2`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${meta.badgeClass}`}
                          >
                            {meta.shortLabel}
                          </span>
                          <span className="font-mono text-[11px] font-semibold">
                            {String(ev.startHour).padStart(2, '0')}:00 ({ev.durationMinutes} min)
                          </span>
                          {ev.alarmEnabled && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              <Bell className="w-3 h-3" />
                              {ev.alarmTime}
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-sm">{ev.title}</p>
                        {ev.notes && <p className="text-[11px] fabro-muted">{ev.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {ev.alarmEnabled && (
                          <button
                            type="button"
                            onClick={() => playCalendarAlarmTone(ev.alarmTone)}
                            title="Probar tono"
                            className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border fabro-surface inline-flex items-center justify-center cursor-pointer"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deletePaintedCalendarEvent(ev.id)}
                          aria-label={`Eliminar ${ev.title}`}
                          className="min-h-[34px] min-w-[34px] rounded-lg border fabro-border fabro-surface text-rose-600 inline-flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {upcomingAlarms.length > 0 && (
              <div className="pt-2.5 border-t fabro-border space-y-1.5">
                <p className="text-[11px] font-bold fabro-muted flex items-center gap-1.5">
                  <BellRing className="w-3.5 h-3.5 text-amber-500" />
                  Próximas alarmas sonoras activas ({upcomingAlarms.length})
                </p>
                <div className="space-y-1">
                  {upcomingAlarms.map((al) => (
                    <button
                      key={al.id}
                      type="button"
                      onClick={() => setSelectedDateKey(al.dateKey)}
                      className="w-full rounded-lg border fabro-border fabro-surface-elevated px-2.5 py-1.5 flex items-center justify-between gap-2 text-left text-[11px] cursor-pointer hover:border-[#2563EB]"
                    >
                      <span className="font-semibold truncate">{al.title}</span>
                      <span className="font-mono fabro-muted shrink-0">
                        {al.dateKey} · {al.alarmTime}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
