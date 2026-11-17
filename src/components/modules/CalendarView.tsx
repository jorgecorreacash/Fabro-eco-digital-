import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import type { CalendarEventType } from '../../types/fabro';

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  examen: 'Examen',
  parcial: 'Parcial',
  final: 'Final',
  entrega: 'Entrega',
  tp: 'Trabajo práctico',
  clase: 'Clase',
  recordatorio: 'Recordatorio',
  objetivo: 'Objetivo / Meta',
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const CalendarView: React.FC = () => {
  const {
    calendarEvents,
    subjects,
    selectedSubjectId,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
  } = useFabro();

  const [viewMode, setViewMode] = useState<'dia' | 'semana' | 'mes'>('mes');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarEventType>('parcial');
  const [subjectId, setSubjectId] = useState(selectedSubjectId || '');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.name || 'General';
  const getSubjectColor = (id: string) => subjects.find((s) => s.id === id)?.color || '#0284C7';

  const shiftPeriod = (dir: -1 | 1) => {
    const next = new Date(anchorDate);
    if (viewMode === 'dia') next.setDate(next.getDate() + dir);
    else if (viewMode === 'semana') next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchorDate(next);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setFormError('');
    try {
      await createCalendarEvent({
        subjectId,
        title: title.trim(),
        type,
        date,
        time,
        notes,
        completed: false,
      });
      setShowForm(false);
      setTitle('');
      setNotes('');
    } catch {
      setFormError('No se pudo agendar la actividad. Intentá nuevamente.');
    }
  };

  const monthDays = useMemo(() => {
    const year = anchorDate.getFullYear();
    const month = anchorDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Monday first
    const startDate = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      return {
        date: d,
        iso: toISODate(d),
        inMonth: d.getMonth() === month,
      };
    });
  }, [anchorDate]);

  const weekDays = useMemo(() => {
    const dayOfWeek = (anchorDate.getDay() + 6) % 7;
    const monday = new Date(anchorDate);
    monday.setDate(anchorDate.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return { date: d, iso: toISODate(d) };
    });
  }, [anchorDate]);

  const anchorIso = toISODate(anchorDate);
  const weeklyObjectives = useMemo(
    () => calendarEvents.filter((e) => e.type === 'objetivo'),
    [calendarEvents]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Organizador académico
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Controlá parciales, finales, trabajos prácticos, clases y objetivos semanales por día, semana o mes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
            {(['dia', 'semana', 'mes'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer ${
                  viewMode === m
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {m === 'dia' ? 'Día' : m === 'semana' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setDate(anchorIso);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Agendar
          </button>
        </div>
      </div>

      {/* Period Navigator */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] px-4 py-3">
        <button
          type="button"
          onClick={() => shiftPeriod(-1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Período anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold capitalize">
            {anchorDate.toLocaleDateString('es-AR', {
              month: 'long',
              year: 'numeric',
              ...(viewMode === 'dia' ? { day: 'numeric' } : {}),
            })}
          </span>
          <button
            type="button"
            onClick={() => setAnchorDate(new Date())}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
          >
            Hoy
          </button>
        </div>
        <button
          type="button"
          onClick={() => shiftPeriod(1)}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Período siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Calendar Views */}
      {viewMode === 'mes' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-center text-[11px] sm:text-xs font-semibold text-slate-500 py-2">
              {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 dark:divide-slate-800">
              {monthDays.map((cell) => {
                const dayEvents = calendarEvents.filter((e) => e.date === cell.iso);
                const isToday = cell.iso === toISODate(new Date());
                const isSelected = cell.iso === anchorIso;
                return (
                  <div
                    key={cell.iso}
                    onClick={() => {
                      setAnchorDate(cell.date);
                      setDate(cell.iso);
                    }}
                    className={`min-h-[54px] sm:min-h-[92px] p-1.5 sm:p-2 space-y-1 cursor-pointer transition-colors ${
                      cell.inMonth ? '' : 'bg-slate-50/60 dark:bg-slate-900/30 opacity-50'
                    } ${isSelected ? 'bg-sky-500/10' : ''} ${
                      isToday ? 'ring-1 ring-inset ring-sky-500/70' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          isToday || isSelected
                            ? 'font-bold text-sky-600 dark:text-sky-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                    </div>

                    {/* Compact Dots on Mobile */}
                    {dayEvents.length > 0 && (
                      <div className="flex sm:hidden flex-wrap gap-1 pt-0.5">
                        {dayEvents.slice(0, 4).map((ev) => (
                          <span
                            key={ev.id}
                            className={`w-1.5 h-1.5 rounded-full ${ev.completed ? 'opacity-40' : ''}`}
                            style={{ backgroundColor: getSubjectColor(ev.subjectId) }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Event Titles on Tablet/Desktop */}
                    <div className="hidden sm:block space-y-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          className={`text-[11px] px-1.5 py-0.5 rounded truncate ${
                            ev.completed ? 'line-through opacity-60' : 'font-medium'
                          }`}
                          style={{
                            backgroundColor: `${getSubjectColor(ev.subjectId)}20`,
                            color: getSubjectColor(ev.subjectId),
                          }}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-slate-400">+{dayEvents.length - 3} más</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda Card (Always convenient on mobile) */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                Agenda del {anchorIso}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setDate(anchorIso);
                  setShowForm(true);
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agendar este día
              </button>
            </div>
            {calendarEvents.filter((e) => e.date === anchorIso).length === 0 ? (
              <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
                No hay actividades para esta fecha. Tocá otro día del calendario o agendá una nueva.
              </p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {calendarEvents
                  .filter((e) => e.date === anchorIso)
                  .map((ev) => (
                    <div key={ev.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => void updateCalendarEvent(ev.id, { completed: !ev.completed })}
                          className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                        >
                          {ev.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4" />}
                        </button>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${ev.completed ? 'line-through opacity-60' : ''}`}>
                            {ev.title}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {EVENT_TYPE_LABELS[ev.type]} · {getSubjectName(ev.subjectId)} {ev.time ? `· ${ev.time}` : ''}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteCalendarEvent(ev.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                        aria-label="Eliminar actividad"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'semana' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((wd) => {
            const items = calendarEvents.filter((e) => e.date === wd.iso);
            return (
              <div key={wd.iso} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] p-3 space-y-2 min-h-[180px]">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">
                  {wd.date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
                </p>
                {items.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Sin eventos</p>
                ) : (
                  <div className="space-y-1.5">
                    {items.map((ev) => (
                      <div key={ev.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-xs space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => void updateCalendarEvent(ev.id, { completed: !ev.completed })}
                            className={`text-left font-medium cursor-pointer ${ev.completed ? 'line-through opacity-60' : ''}`}
                          >
                            {ev.title}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteCalendarEvent(ev.id)}
                            className="text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {EVENT_TYPE_LABELS[ev.type]} {ev.time ? `· ${ev.time}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'dia' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] divide-y divide-slate-200 dark:divide-slate-800">
          {calendarEvents.filter((e) => e.date === anchorIso).length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay actividades agendadas para el {anchorIso}.
            </div>
          ) : (
            calendarEvents
              .filter((e) => e.date === anchorIso)
              .map((ev) => (
                <div key={ev.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => void updateCalendarEvent(ev.id, { completed: !ev.completed })}
                      className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                    >
                      {ev.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Circle className="w-5 h-5" />}
                    </button>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${ev.completed ? 'line-through opacity-60' : ''}`}>
                        {ev.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {EVENT_TYPE_LABELS[ev.type]} · {getSubjectName(ev.subjectId)} {ev.time ? `· ${ev.time}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteCalendarEvent(ev.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
          )}
        </div>
      )}

      {/* Weekly Objectives & Upcoming List */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
            Objetivos semanales y próximas entregas ({weeklyObjectives.length} objetivos · {calendarEvents.length} total)
          </h3>
        </div>
        {calendarEvents.length === 0 ? (
          <p className="p-5 text-xs text-slate-500">Sin actividades registradas todavía.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {[...calendarEvents]
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 12)
              .map((ev) => (
                <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => void updateCalendarEvent(ev.id, { completed: !ev.completed })}
                      className="text-slate-400 hover:text-emerald-600 cursor-pointer shrink-0"
                    >
                      {ev.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4" />}
                    </button>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${ev.completed ? 'line-through opacity-60' : ''}`}>
                        {ev.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {EVENT_TYPE_LABELS[ev.type]} · {getSubjectName(ev.subjectId)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs tabular-nums text-slate-500">
                      {ev.date} {ev.time || ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => void deleteCalendarEvent(ev.id)}
                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/* Add Event Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] my-2 sm:my-6 shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623]">
              <h3 className="font-display text-lg font-bold">Nueva actividad académica</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-4 sm:p-6 space-y-3.5">
              {formError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Primer Parcial de Álgebra"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CalendarEventType)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Nombre de la materia
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  >
                    <option value="">General</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Notas / Aula / Recordatorio
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
