import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Plus,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useFabro } from '../../context/FabroContext';
import { buildWhatsAppShareHref, formatForWhatsApp } from '../../lib/whatsapp';

interface RemindersWidgetProps {
  variant?: 'header' | 'card';
}

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const RemindersWidget: React.FC<RemindersWidgetProps> = ({ variant = 'card' }) => {
  const {
    calendarEvents,
    subjects,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    setActiveSection,
    selectedSubjectId,
  } = useFabro();

  const [openPopover, setOpenPopover] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getTodayStr);
  const [time, setTime] = useState('');
  const [subjectId, setSubjectId] = useState(selectedSubjectId || '');
  const [saving, setSaving] = useState(false);
  const [copiedList, setCopiedList] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission;
  });

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedSubjectId && !subjectId) {
      setSubjectId(selectedSubjectId);
    }
  }, [selectedSubjectId, subjectId]);

  useEffect(() => {
    if (variant !== 'header' || !openPopover) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPopover(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [variant, openPopover]);

  const today = getTodayStr();

  const pendingReminders = useMemo(() => {
    return calendarEvents
      .filter((ev) => !ev.completed)
      .sort((a, b) => {
        const cmp = a.date.localeCompare(b.date);
        if (cmp !== 0) return cmp;
        return (a.time || '23:59').localeCompare(b.time || '23:59');
      });
  }, [calendarEvents]);

  const dueTodayOrOverdueCount = useMemo(
    () => pendingReminders.filter((ev) => ev.date <= today).length,
    [pendingReminders, today]
  );

  // Local interval check for browser notifications on timed reminders
  useEffect(() => {
    if (variant !== 'header') return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'granted') return;

    const checkDue = () => {
      const now = new Date();
      const todayKey = getTodayStr();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      for (const ev of pendingReminders) {
        if (ev.date !== todayKey || !ev.time) continue;
        if (ev.time === hhmm) {
          const sentKey = `fabro_notif_${ev.id}_${ev.date}_${ev.time}`;
          if (!sessionStorage.getItem(sentKey)) {
            sessionStorage.setItem(sentKey, '1');
            try {
              new window.Notification(`Recordatorio FABRO: ${ev.title}`, {
                body: ev.notes || `Programado para las ${ev.time}`,
                icon: '/pwa-192x192.png',
              });
            } catch {
              // Ignore restricted notification environments
            }
          }
        }
      }
    };

    checkDue();
    const timer = window.setInterval(checkDue, 30000);
    return () => window.clearInterval(timer);
  }, [variant, pendingReminders]);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await window.Notification.requestPermission();
      setNotifPermission(perm);
    } catch {
      // Ignore permission rejection
    }
  };

  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await createCalendarEvent({
        subjectId: subjectId || '',
        title: title.trim(),
        type: 'recordatorio',
        date: date || today,
        time: time.trim(),
        notes: '',
        completed: false,
      });
      setTitle('');
      setTime('');
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.name || '';

  const whatsappText = useMemo(() => {
    const lines = pendingReminders.slice(0, 12).map((r) => {
      const subj = getSubjectName(r.subjectId);
      const timeStr = r.time ? ` ${r.time}` : '';
      return `• [${r.date}${timeStr}] ${r.title}${subj ? ` (${subj})` : ''}`;
    });
    return formatForWhatsApp({
      title: 'Mis recordatorios académicos',
      subtitle: `${pendingReminders.length} pendientes`,
      body: lines.length > 0 ? lines.join('\n') : 'Sin recordatorios pendientes.',
    });
  }, [pendingReminders, subjects]);

  const waHref = useMemo(() => buildWhatsAppShareHref(whatsappText).href, [whatsappText]);

  const handleCopyReminders = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopiedList(true);
      window.setTimeout(() => setCopiedList(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const renderQuickForm = () => (
    <form onSubmit={(e) => void handleQuickCreate(e)} className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/70 p-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Ej: Repasar Unidad 2 o entregar TP..."
        required
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Hora del recordatorio"
          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
        />
      </div>
      <div className="flex items-center gap-2">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
        >
          <option value="">General (sin materia)</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 cursor-pointer shrink-0"
        >
          Guardar
        </button>
      </div>
    </form>
  );

  if (variant === 'header') {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpenPopover((v) => !v)}
          aria-label="Abrir widget de recordatorios"
          title="Recordatorios y alertas de estudio"
          className={`relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            dueTodayOrOverdueCount > 0
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          {dueTodayOrOverdueCount > 0 ? (
            <BellRing className="w-3.5 h-3.5" />
          ) : (
            <Bell className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Recordatorios</span>
          {pendingReminders.length > 0 && (
            <span className="font-mono tabular-nums text-[11px] font-semibold">
              ({pendingReminders.length})
            </span>
          )}
        </button>

        {openPopover && (
          <div className="fixed sm:absolute right-3 sm:right-0 top-14 sm:top-full sm:mt-2 w-[min(94vw,380px)] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] shadow-2xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  Recordatorios
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAddForm((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-700 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Nuevo
                </button>
                <button
                  type="button"
                  onClick={() => setOpenPopover(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  aria-label="Cerrar recordatorios"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3 max-h-[68dvh] overflow-y-auto">
              {notifPermission === 'default' && (
                <div className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-sky-800 dark:text-sky-200">
                  <span>Activá avisos con hora programada</span>
                  <button
                    type="button"
                    onClick={() => void requestNotificationPermission()}
                    className="font-semibold underline cursor-pointer shrink-0"
                  >
                    Activar
                  </button>
                </div>
              )}

              {showAddForm && renderQuickForm()}

              {pendingReminders.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No tenés recordatorios pendientes.
                  </p>
                  {!showAddForm && (
                    <button
                      type="button"
                      onClick={() => setShowAddForm(true)}
                      className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Crear tu primer recordatorio rápido
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pendingReminders.slice(0, 8).map((ev) => {
                    const isOverdue = ev.date < today;
                    const isToday = ev.date === today;
                    const subj = getSubjectName(ev.subjectId);
                    return (
                      <div key={ev.id} className="py-2.5 flex items-start gap-2.5">
                        <button
                          type="button"
                          onClick={() => void updateCalendarEvent(ev.id, { completed: true })}
                          aria-label={`Completar ${ev.title}`}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer shrink-0"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-900 dark:text-white leading-snug">
                            {ev.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                            <span
                              className={`font-mono tabular-nums ${
                                isOverdue
                                  ? 'text-red-600 dark:text-red-400 font-semibold'
                                  : isToday
                                  ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                  : ''
                              }`}
                            >
                              {isOverdue ? 'Vencido · ' : isToday ? 'Hoy · ' : ''}
                              {ev.date}
                              {ev.time ? ` ${ev.time}` : ''}
                            </span>
                            {subj && <span className="truncate">· {subj}</span>}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void deleteCalendarEvent(ev.id)}
                          aria-label="Eliminar recordatorio"
                          className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-2">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <Share2 className="w-3.5 h-3.5" />
                Enviar a WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  setOpenPopover(false);
                  setActiveSection('calendario');
                }}
                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Abrir Calendario
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Dashboard Widget Card Variant
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0F1623] overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Widget de recordatorios
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {pendingReminders.length === 0
                ? 'Todo al día'
                : `${pendingReminders.length} pendientes · ${dueTodayOrOverdueCount} para hoy o vencidos`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {notifPermission === 'default' && (
            <button
              type="button"
              onClick={() => void requestNotificationPermission()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              Activar alertas
            </button>
          )}
          {pendingReminders.length > 0 && (
            <>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              >
                <Share2 className="w-3.5 h-3.5" />
                WhatsApp
              </a>
              <button
                type="button"
                onClick={() => void handleCopyReminders()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                title="Copiar lista de recordatorios"
              >
                {copiedList ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddForm ? 'Cerrar' : 'Agregar'}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {showAddForm && renderQuickForm()}

        {pendingReminders.length === 0 ? (
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Anotá recordatorios rápidos de lectura, repasos, entregas o parciales.</span>
            <button
              type="button"
              onClick={() => setActiveSection('calendario')}
              className="inline-flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer shrink-0"
            >
              <Calendar className="w-3.5 h-3.5" />
              Ir a Agenda completa
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {pendingReminders.slice(0, 6).map((ev) => {
              const isOverdue = ev.date < today;
              const isToday = ev.date === today;
              const subj = getSubjectName(ev.subjectId);
              return (
                <div
                  key={ev.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-start gap-2.5 bg-slate-50/50 dark:bg-slate-900/40"
                >
                  <button
                    type="button"
                    onClick={() => void updateCalendarEvent(ev.id, { completed: true })}
                    aria-label={`Marcar ${ev.title} como completado`}
                    className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {ev.title}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span
                        className={`font-mono tabular-nums ${
                          isOverdue
                            ? 'text-red-600 dark:text-red-400 font-semibold'
                            : isToday
                            ? 'text-amber-600 dark:text-amber-400 font-semibold'
                            : ''
                        }`}
                      >
                        {isOverdue ? 'Vencido · ' : isToday ? 'Hoy · ' : ''}
                        {ev.date}
                        {ev.time ? ` ${ev.time}` : ''}
                      </span>
                      {subj && <span className="truncate">· {subj}</span>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteCalendarEvent(ev.id)}
                    aria-label="Eliminar recordatorio"
                    className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
