import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Edit3,
  Palette,
  Plus,
  Repeat,
  RotateCcw,
  Settings2,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { useStudy2 } from '../../../context/Study2Context';
import {
  CALENDAR_ALARM_TONE_LABELS,
  playCalendarAlarmTone,
} from '../../../services/calendarAlarmAudio';
import {
  addDaysToDateKey,
  CALENDAR_DOMAIN_LABELS,
  CALENDAR_PRESET_SWATCHES,
  expandEventsForDateRange,
  formatDateKey,
  getContrastTextColor,
  getTodayLocalDateKey,
  parseDateKey,
  resolveDayCellPaint,
  resolveEventColor,
  type CalendarEventOccurrence,
} from '../../../services/unifiedCalendarService';
import type { CalendarAlarmTone } from '../../../types/ecosystem';
import type {
  CalendarCategoryConfig,
  CalendarDomain,
  CalendarRecurrenceRule,
  UnifiedCalendarEvent,
} from '../../../types/study2';

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_SHORT_SUN = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAYS_SHORT_MON = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface UnifiedShiftCalendarProps {
  /** Optional subtitle / context label (e.g. "FABRO Estudio" or "Herramientas Generales") */
  contextLabel?: string;
  /** Optional subject pre-filter (used inside a single subject workspace) */
  fixedSubjectId?: string;
  /** Default domain filter */
  initialDomain?: CalendarDomain | 'todos';
}

interface EventDraft {
  editingId: string | null;
  title: string;
  description: string;
  dateKey: string;
  allDay: boolean;
  startTime: string;
  durationMinutes: number;
  categoryId: string;
  customColor: string;
  domain: CalendarDomain;
  subjectId: string;
  recurrence: CalendarRecurrenceRule;
  recurrenceDaysOfWeek: number[];
  recurrenceEndDate: string;
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  alarmTone: CalendarAlarmTone;
}

function buildInitialDraft(
  dateKey: string,
  defaultCategory: CalendarCategoryConfig | undefined,
  fixedSubjectId?: string
): EventDraft {
  return {
    editingId: null,
    title: '',
    description: '',
    dateKey,
    allDay: false,
    startTime: '09:00',
    durationMinutes: 60,
    categoryId: defaultCategory?.id || 'cat-estudio',
    customColor: '',
    domain: defaultCategory?.domain || 'academico',
    subjectId: fixedSubjectId || '',
    recurrence: 'none',
    recurrenceDaysOfWeek: [parseDateKey(dateKey).getDay()],
    recurrenceEndDate: '',
    reminderEnabled: false,
    reminderMinutesBefore: 15,
    alarmTone: 'campana',
  };
}

export const UnifiedShiftCalendar: React.FC<UnifiedShiftCalendarProps> = ({
  contextLabel,
  fixedSubjectId,
  initialDomain = 'todos',
}) => {
  const {
    snapshot,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    toggleCalendarEventCompleted,
    upsertCalendarCategory,
    deleteCalendarCategory,
    moveCalendarCategoryPriority,
    resetCalendarCategories,
    updateCalendarPreferences,
  } = useStudy2();

  const todayKey = getTodayLocalDateKey();
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>(
    snapshot.calendarPreferences.defaultView || 'month'
  );
  const [domainFilter, setDomainFilter] = useState<CalendarDomain | 'todos'>(initialDomain);
  const [subjectFilter, setSubjectFilter] = useState<string>(fixedSubjectId || '');
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Event modal state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [draft, setDraft] = useState<EventDraft>(() =>
    buildInitialDraft(todayKey, snapshot.calendarCategories[0], fixedSubjectId)
  );
  const [formError, setFormError] = useState<string | null>(null);

  // New category quick state inside Config panel
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#0891B2');
  const [newCatDomain, setNewCatDomain] = useState<CalendarDomain>('otros');

  const categoriesSorted = useMemo(
    () => [...snapshot.calendarCategories].sort((a, b) => a.priority - b.priority),
    [snapshot.calendarCategories]
  );

  const enabledCategoryIds = useMemo(
    () => new Set(categoriesSorted.filter((c) => c.enabled).map((c) => c.id)),
    [categoriesSorted]
  );

  const activeSubjects = useMemo(
    () => snapshot.subjects.filter((s) => !s.archived),
    [snapshot.subjects]
  );

  const subjectNameMap = useMemo(
    () => new Map(snapshot.subjects.map((s) => [s.id, s.name])),
    [snapshot.subjects]
  );

  const selectedDateObj = useMemo(() => parseDateKey(selectedDateKey), [selectedDateKey]);
  const cursorYear = selectedDateObj.getFullYear();
  const cursorMonth = selectedDateObj.getMonth();
  const weekStartsOn = snapshot.calendarPreferences.weekStartsOn;

  // Compute grid date keys for Month or Week view
  const { visibleRangeStart, visibleRangeEnd, monthGridCells, weekDateKeys } = useMemo(() => {
    const firstOfMonth = new Date(cursorYear, cursorMonth, 1, 12, 0, 0);
    const firstDow = firstOfMonth.getDay();
    const leadingDays = (firstDow - weekStartsOn + 7) % 7;
    const gridStart = new Date(cursorYear, cursorMonth, 1 - leadingDays, 12, 0, 0);

    const cells: Array<{ dateKey: string; dayNum: number; inCurrentMonth: boolean }> = [];
    for (let i = 0; i < 42; i += 1) {
      const dt = new Date(gridStart);
      dt.setDate(gridStart.getDate() + i);
      cells.push({
        dateKey: formatDateKey(dt),
        dayNum: dt.getDate(),
        inCurrentMonth: dt.getMonth() === cursorMonth,
      });
    }

    // Current week around selectedDateObj
    const selDow = selectedDateObj.getDay();
    const diffToWeekStart = (selDow - weekStartsOn + 7) % 7;
    const weekStartDt = new Date(selectedDateObj);
    weekStartDt.setDate(selectedDateObj.getDate() - diffToWeekStart);
    const weekKeys: string[] = [];
    for (let i = 0; i < 7; i += 1) {
      const dt = new Date(weekStartDt);
      dt.setDate(weekStartDt.getDate() + i);
      weekKeys.push(formatDateKey(dt));
    }

    const minKey =
      cells[0].dateKey < weekKeys[0] ? cells[0].dateKey : weekKeys[0];
    const maxKey =
      cells[cells.length - 1].dateKey > weekKeys[6]
        ? cells[cells.length - 1].dateKey
        : weekKeys[6];

    return {
      visibleRangeStart: minKey,
      visibleRangeEnd: maxKey,
      monthGridCells: cells,
      weekDateKeys: weekKeys,
    };
  }, [cursorMonth, cursorYear, selectedDateObj, weekStartsOn]);

  // Filter base events by domain, enabled categories, and subject
  const filteredBaseEvents = useMemo(() => {
    return snapshot.calendarEvents.filter((ev) => {
      if (!enabledCategoryIds.has(ev.categoryId)) return false;
      if (domainFilter !== 'todos' && ev.domain !== domainFilter) return false;
      const effectiveSub = fixedSubjectId || subjectFilter;
      if (effectiveSub && ev.subjectId !== effectiveSub) return false;
      return true;
    });
  }, [
    domainFilter,
    enabledCategoryIds,
    fixedSubjectId,
    snapshot.calendarEvents,
    subjectFilter,
  ]);

  // Expand occurrences across visible range
  const occurrencesByDate = useMemo(() => {
    const expanded = expandEventsForDateRange(
      filteredBaseEvents,
      visibleRangeStart,
      visibleRangeEnd
    );
    const map = new Map<string, CalendarEventOccurrence[]>();
    for (const occ of expanded) {
      const list = map.get(occ.dateKey) || [];
      list.push(occ);
      map.set(occ.dateKey, list);
    }
    return map;
  }, [filteredBaseEvents, visibleRangeEnd, visibleRangeStart]);

  const selectedDayOccurrences = occurrencesByDate.get(selectedDateKey) || [];

  const handleNavigate = (delta: -1 | 1) => {
    if (viewMode === 'month') {
      const next = new Date(cursorYear, cursorMonth + delta, 1, 12, 0, 0);
      setSelectedDateKey(formatDateKey(next));
    } else if (viewMode === 'week') {
      setSelectedDateKey(addDaysToDateKey(selectedDateKey, delta * 7));
    } else {
      setSelectedDateKey(addDaysToDateKey(selectedDateKey, delta));
    }
  };

  const openNewEventModal = (dateKeyOverride?: string) => {
    const targetDate = dateKeyOverride || selectedDateKey;
    const defaultCat =
      categoriesSorted.find((c) => c.enabled) || categoriesSorted[0];
    setDraft(buildInitialDraft(targetDate, defaultCat, fixedSubjectId));
    setFormError(null);
    setEventModalOpen(true);
  };

  const openEditEventModal = (ev: UnifiedCalendarEvent) => {
    setDraft({
      editingId: ev.id,
      title: ev.title,
      description: ev.description || '',
      dateKey: ev.dateKey,
      allDay: ev.allDay,
      startTime: ev.startTime || '09:00',
      durationMinutes: ev.durationMinutes || 60,
      categoryId: ev.categoryId,
      customColor: ev.customColor || '',
      domain: ev.domain,
      subjectId: ev.subjectId || '',
      recurrence: ev.recurrence,
      recurrenceDaysOfWeek: ev.recurrenceDaysOfWeek || [parseDateKey(ev.dateKey).getDay()],
      recurrenceEndDate: ev.recurrenceEndDate || '',
      reminderEnabled: ev.reminderEnabled,
      reminderMinutesBefore: ev.reminderMinutesBefore,
      alarmTone: ev.alarmTone,
    });
    setFormError(null);
    setEventModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      setFormError('Ingresá un título para la actividad o turno.');
      return;
    }
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      dateKey: draft.dateKey,
      allDay: draft.allDay,
      startTime: draft.allDay ? '00:00' : draft.startTime || '09:00',
      durationMinutes: Math.max(15, Number(draft.durationMinutes) || 60),
      categoryId: draft.categoryId,
      customColor: draft.customColor || undefined,
      domain: draft.domain,
      subjectId: fixedSubjectId || draft.subjectId || undefined,
      recurrence: draft.recurrence,
      recurrenceDaysOfWeek:
        draft.recurrence === 'custom_days' ? draft.recurrenceDaysOfWeek : undefined,
      recurrenceEndDate:
        draft.recurrence !== 'none' && draft.recurrenceEndDate
          ? draft.recurrenceEndDate
          : undefined,
      reminderEnabled: draft.reminderEnabled,
      reminderMinutesBefore: draft.reminderMinutesBefore,
      alarmTone: draft.alarmTone,
      completed: false,
    };

    if (draft.editingId) {
      updateCalendarEvent(draft.editingId, payload);
    } else {
      addCalendarEvent(payload);
    }
    setSelectedDateKey(draft.dateKey);
    setEventModalOpen(false);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newCatName.trim();
    if (!clean) return;
    upsertCalendarCategory({
      id: `cat-custom-${Date.now()}`,
      name: clean,
      color: newCatColor,
      domain: newCatDomain,
      priority: categoriesSorted.length,
      enabled: true,
    });
    setNewCatName('');
  };

  const weekdayLabels = weekStartsOn === 1 ? WEEKDAYS_SHORT_MON : WEEKDAYS_SHORT_SUN;

  const selectedDateHuman = useMemo(() => {
    return parseDateKey(selectedDateKey).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDateKey]);

  const headerTitle = useMemo(() => {
    if (viewMode === 'month') return `${MONTHS_ES[cursorMonth]} ${cursorYear}`;
    if (viewMode === 'week') {
      const s = parseDateKey(weekDateKeys[0]);
      const e = parseDateKey(weekDateKeys[6]);
      return `${s.getDate()} ${MONTHS_ES[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTHS_ES[
        e.getMonth()
      ].slice(0, 3)} ${e.getFullYear()}`;
    }
    return selectedDateHuman;
  }, [cursorMonth, cursorYear, selectedDateHuman, viewMode, weekDateKeys]);

  return (
    <div className="space-y-4">
      {/* Header Controls Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <CalendarIcon className="w-4 h-4 shrink-0" />
              <span>{contextLabel || 'Calendario Visual Unificado'}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight capitalize text-slate-900 dark:text-white truncate">
              {headerTitle}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Navigation controls */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-0.5">
              <button
                type="button"
                onClick={() => handleNavigate(-1)}
                aria-label="Período anterior"
                className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedDateKey(todayKey)}
                className="min-h-[38px] px-3 rounded-lg text-xs font-bold hover:bg-white dark:hover:bg-slate-700 cursor-pointer whitespace-nowrap"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => handleNavigate(1)}
                aria-label="Período siguiente"
                className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* View Switcher */}
            <div
              role="tablist"
              aria-label="Vista del calendario"
              className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-0.5"
            >
              {(
                [
                  { id: 'month', label: 'Mes' },
                  { id: 'week', label: 'Semana' },
                  { id: 'day', label: 'Día' },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === v.id}
                  onClick={() => setViewMode(v.id)}
                  className={`min-h-[38px] px-3 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap transition-colors ${
                    viewMode === v.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Configure Categories & Colors */}
            <button
              type="button"
              onClick={() => setShowConfigPanel((p) => !p)}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                showConfigPanel
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Colores y categorías</span>
            </button>

            {/* Primary CTA: Add Event */}
            <button
              type="button"
              onClick={() => openNewEventModal(selectedDateKey)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva actividad</span>
            </button>
          </div>
        </div>

        {/* Domain Filters + Optional Subject Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {(Object.keys(CALENDAR_DOMAIN_LABELS) as Array<CalendarDomain | 'todos'>).map(
              (dom) => {
                const active = domainFilter === dom;
                return (
                  <button
                    key={dom}
                    type="button"
                    onClick={() => setDomainFilter(dom)}
                    className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {CALENDAR_DOMAIN_LABELS[dom]}
                  </button>
                );
              }
            )}
          </div>

          {!fixedSubjectId && activeSubjects.length > 0 && (
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Filtrar calendario por materia"
              className="min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="">Todas mis materias</option>
              {activeSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Interactive Legend Strip (Click to toggle visibility) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {categoriesSorted.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() =>
                upsertCalendarCategory({ ...cat, enabled: !cat.enabled })
              }
              title={
                cat.enabled
                  ? 'Clic para ocultar esta categoría en el calendario'
                  : 'Clic para volver a mostrar esta categoría'
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-opacity ${
                cat.enabled
                  ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 opacity-100'
                  : 'border-dashed border-slate-300 dark:border-slate-700 opacity-45 line-through'
              }`}
            >
              <span
                className="w-3 h-3 rounded-xs shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Collapsible Category & Visual Preferences Configurator */}
      {showConfigPanel && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-blue-600" />
                Personalización de colores, categorías y visualización
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                El orden superior define qué color pinta la celda completa cuando hay varios eventos el mismo día.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetCalendarCategories}
                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restablecer sugeridos
              </button>
              <button
                type="button"
                onClick={() => setShowConfigPanel(false)}
                aria-label="Cerrar configuración"
                className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* General Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <label className="space-y-1 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Primer día de la semana
              </span>
              <select
                value={snapshot.calendarPreferences.weekStartsOn}
                onChange={(e) =>
                  updateCalendarPreferences({
                    weekStartsOn: Number(e.target.value) === 0 ? 0 : 1,
                  })
                }
                className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-medium"
              >
                <option value={1}>Lunes</option>
                <option value={0}>Domingo</option>
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Color de celda con múltiples eventos
              </span>
              <select
                value={snapshot.calendarPreferences.multiEventRule}
                onChange={(e) =>
                  updateCalendarPreferences({
                    multiEventRule: e.target.value as
                      | 'priority'
                      | 'first_created'
                      | 'latest_created',
                  })
                }
                className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-medium"
              >
                <option value="priority">Prioridad de categoría (recomendado)</option>
                <option value="first_created">Primer evento registrado</option>
                <option value="latest_created">Último evento registrado</option>
              </select>
            </label>
          </div>

          {/* Existing Categories List */}
          <div className="space-y-2">
            {categoriesSorted.map((cat, idx) => (
              <div
                key={cat.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-2.5"
              >
                <span className="font-mono text-[11px] font-bold text-slate-400 w-5 text-center tabular-nums">
                  {idx + 1}
                </span>
                <input
                  type="color"
                  value={cat.color}
                  onChange={(e) =>
                    upsertCalendarCategory({ ...cat, color: e.target.value })
                  }
                  aria-label={`Color de ${cat.name}`}
                  className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) =>
                    upsertCalendarCategory({ ...cat, name: e.target.value })
                  }
                  aria-label="Nombre de categoría"
                  className="flex-1 min-w-[150px] min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-semibold"
                />
                <select
                  value={cat.domain}
                  onChange={(e) =>
                    upsertCalendarCategory({
                      ...cat,
                      domain: e.target.value as CalendarDomain,
                    })
                  }
                  className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs"
                >
                  {(
                    Object.keys(CALENDAR_DOMAIN_LABELS).filter(
                      (k) => k !== 'todos'
                    ) as CalendarDomain[]
                  ).map((d) => (
                    <option key={d} value={d}>
                      {CALENDAR_DOMAIN_LABELS[d]}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveCalendarCategoryPriority(cat.id, 'up')}
                    aria-label="Subir prioridad"
                    className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === categoriesSorted.length - 1}
                    onClick={() => moveCalendarCategoryPriority(cat.id, 'down')}
                    aria-label="Bajar prioridad"
                    className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-35 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={categoriesSorted.length <= 1}
                    onClick={() => deleteCalendarCategory(cat.id)}
                    aria-label={`Eliminar categoría ${cat.name}`}
                    className="min-h-[32px] min-w-[32px] rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 flex items-center justify-center disabled:opacity-35 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Create New Category */}
          <form
            onSubmit={handleAddCategory}
            className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800"
          >
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              aria-label="Color nueva categoría"
              className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer"
            />
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nueva categoría (ej. Prácticas, Guardia, Idiomas)..."
              className="flex-1 min-w-[180px] min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs"
            />
            <select
              value={newCatDomain}
              onChange={(e) => setNewCatDomain(e.target.value as CalendarDomain)}
              className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
            >
              {(
                Object.keys(CALENDAR_DOMAIN_LABELS).filter(
                  (k) => k !== 'todos'
                ) as CalendarDomain[]
              ).map((d) => (
                <option key={d} value={d}>
                  {CALENDAR_DOMAIN_LABELS[d]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="min-h-[38px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              Agregar categoría
            </button>
          </form>
        </section>
      )}

      {/* Main Split: Calendar Canvas + Selected Day Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left/Main Calendar Grid */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4">
          {viewMode === 'month' && (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {weekdayLabels.map((lbl) => (
                  <div
                    key={lbl}
                    className="py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                  >
                    {lbl}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {monthGridCells.map((cell) => {
                  const occs = occurrencesByDate.get(cell.dateKey) || [];
                  const paint = resolveDayCellPaint(
                    occs,
                    snapshot.calendarCategories,
                    snapshot.calendarPreferences.multiEventRule
                  );
                  const isToday = cell.dateKey === todayKey;
                  const isSelected = cell.dateKey === selectedDateKey;
                  const hasFill = Boolean(paint.primaryColor);

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => setSelectedDateKey(cell.dateKey)}
                      onDoubleClick={() => openNewEventModal(cell.dateKey)}
                      style={
                        hasFill
                          ? {
                              backgroundColor: paint.primaryColor!,
                              color: paint.textColor,
                            }
                          : undefined
                      }
                      className={`group relative min-h-[72px] sm:min-h-[86px] rounded-xl p-1.5 sm:p-2 text-left flex flex-col justify-between transition-all cursor-pointer border ${
                        hasFill
                          ? 'border-transparent shadow-xs'
                          : cell.inCurrentMonth
                          ? 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                          : 'border-slate-100 dark:border-slate-800/50 bg-slate-50/70 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600'
                      } ${
                        isSelected
                          ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                          : ''
                      } ${!cell.inCurrentMonth && hasFill ? 'opacity-70' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-1 w-full">
                        <span
                          className={`text-xs sm:text-sm font-bold tabular-nums leading-none ${
                            isToday && !hasFill
                              ? 'inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-600 text-white'
                              : isToday && hasFill
                              ? 'underline decoration-2 underline-offset-4'
                              : ''
                          }`}
                        >
                          {cell.dayNum}
                        </span>

                        {paint.extraCount > 0 && (
                          <span
                            className="text-[10px] font-extrabold tabular-nums px-1.5 py-0.5 rounded-md leading-none"
                            style={{
                              backgroundColor:
                                paint.textColor === '#FFFFFF'
                                  ? 'rgba(0,0,0,0.24)'
                                  : 'rgba(15,23,42,0.14)',
                              color: paint.textColor,
                            }}
                          >
                            +{paint.extraCount}
                          </span>
                        )}
                      </div>

                      {paint.primaryEvent ? (
                        <div className="mt-1 space-y-0.5 min-w-0 w-full">
                          <p className="text-[10px] sm:text-[11px] font-bold leading-tight line-clamp-2 break-words">
                            {paint.primaryEvent.event.title}
                          </p>
                          {!paint.primaryEvent.event.allDay && (
                            <p className="hidden sm:block text-[10px] font-mono opacity-85 tabular-nums">
                              {paint.primaryEvent.event.startTime}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] opacity-0 group-hover:opacity-60 transition-opacity">
                          +
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {viewMode === 'week' && (
            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {weekDateKeys.map((dk) => {
                const dt = parseDateKey(dk);
                const occs = occurrencesByDate.get(dk) || [];
                const paint = resolveDayCellPaint(
                  occs,
                  snapshot.calendarCategories,
                  snapshot.calendarPreferences.multiEventRule
                );
                const isSelected = dk === selectedDateKey;
                const isToday = dk === todayKey;

                return (
                  <div
                    key={dk}
                    onClick={() => setSelectedDateKey(dk)}
                    style={
                      paint.primaryColor
                        ? {
                            backgroundColor: paint.primaryColor,
                            color: paint.textColor,
                          }
                        : undefined
                    }
                    className={`rounded-xl border p-2.5 min-h-[180px] flex flex-col gap-2 cursor-pointer transition-all ${
                      paint.primaryColor
                        ? 'border-transparent'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60'
                    } ${
                      isSelected
                        ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-slate-900'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-current/15 pb-1.5">
                      <span className="text-[11px] font-bold uppercase opacity-80">
                        {WEEKDAYS_SHORT_SUN[dt.getDay()]}
                      </span>
                      <span
                        className={`text-sm font-extrabold tabular-nums ${
                          isToday ? 'underline decoration-2 underline-offset-4' : ''
                        }`}
                      >
                        {dt.getDate()}
                      </span>
                    </div>

                    <div className="space-y-1.5 flex-1">
                      {occs.length === 0 ? (
                        <p className="text-[11px] opacity-55">Libre</p>
                      ) : (
                        occs.map((occ) => (
                          <div
                            key={occ.occurrenceId}
                            className="rounded-lg px-2 py-1 text-[11px] leading-snug"
                            style={{
                              backgroundColor:
                                paint.textColor === '#FFFFFF'
                                  ? 'rgba(0,0,0,0.2)'
                                  : 'rgba(15,23,42,0.1)',
                            }}
                          >
                            <p className="font-bold truncate">{occ.event.title}</p>
                            <p className="text-[10px] font-mono opacity-85">
                              {occ.event.allDay ? 'Todo el día' : occ.event.startTime}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === 'day' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Vista diaria detallada
                  </p>
                  <p className="text-base font-bold capitalize">{selectedDateHuman}</p>
                </div>
                <button
                  type="button"
                  onClick={() => openNewEventModal(selectedDateKey)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-blue-600 text-white px-3 text-xs font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar en este día
                </button>
              </div>

              {selectedDayOccurrences.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No hay actividades programadas para este día.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tocá «Agregar en este día» para crear un turno, clase, examen o recordatorio.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayOccurrences.map((occ) => {
                    const bg = resolveEventColor(occ.event, snapshot.calendarCategories);
                    const fg = getContrastTextColor(bg);
                    const subName = occ.event.subjectId
                      ? subjectNameMap.get(occ.event.subjectId)
                      : undefined;
                    return (
                      <div
                        key={occ.occurrenceId}
                        style={{ backgroundColor: bg, color: fg }}
                        className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-mono opacity-90">
                            <span>
                              {occ.event.allDay
                                ? 'Todo el día'
                                : `${occ.event.startTime} (${occ.event.durationMinutes} min)`}
                            </span>
                            <span>·</span>
                            <span>{CALENDAR_DOMAIN_LABELS[occ.event.domain]}</span>
                            {subName && (
                              <>
                                <span>·</span>
                                <span className="font-sans font-bold">{subName}</span>
                              </>
                            )}
                          </div>
                          <p
                            className={`text-base font-bold ${
                              occ.event.completed ? 'line-through opacity-75' : ''
                            }`}
                          >
                            {occ.event.title}
                          </p>
                          {occ.event.description && (
                            <p className="text-xs opacity-90 whitespace-pre-line">
                              {occ.event.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleCalendarEventCompleted(occ.event.id)}
                            className="min-h-[36px] px-2.5 rounded-lg bg-black/15 hover:bg-black/25 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {occ.event.completed ? 'Hecho' : 'Completar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditEventModal(occ.event)}
                            aria-label="Editar evento"
                            className="min-h-[36px] min-w-[36px] rounded-lg bg-black/15 hover:bg-black/25 flex items-center justify-center cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCalendarEvent(occ.event.id)}
                            aria-label="Eliminar evento"
                            className="min-h-[36px] min-w-[36px] rounded-lg bg-black/15 hover:bg-black/25 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Selected Day Full Event List (sorted by time) */}
        <aside className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Agenda del día
              </p>
              <h3 className="text-sm font-bold capitalize text-slate-900 dark:text-white leading-snug">
                {selectedDateHuman}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => openNewEventModal(selectedDateKey)}
              className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-2.5 text-xs font-bold cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Sumar
            </button>
          </div>

          {selectedDayOccurrences.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-5 text-center space-y-1.5">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Día libre
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Seleccioná otro día o agregá una actividad para pintar esta fecha.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-0.5">
              {selectedDayOccurrences.map((occ) => {
                const color = resolveEventColor(occ.event, snapshot.calendarCategories);
                const textColor = getContrastTextColor(color);
                const cat = snapshot.calendarCategories.find(
                  (c) => c.id === occ.event.categoryId
                );
                const subName = occ.event.subjectId
                  ? subjectNameMap.get(occ.event.subjectId)
                  : undefined;

                return (
                  <div
                    key={occ.occurrenceId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950"
                  >
                    <div
                      style={{ backgroundColor: color, color: textColor }}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] font-bold"
                    >
                      <span className="truncate">{cat?.name || 'Actividad'}</span>
                      <span className="font-mono tabular-nums shrink-0 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {occ.event.allDay ? 'Todo el día' : occ.event.startTime}
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCalendarEventCompleted(occ.event.id)}
                          className="flex items-start gap-2 text-left cursor-pointer min-w-0 flex-1"
                        >
                          {occ.event.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <span
                            className={`text-xs font-bold leading-snug ${
                              occ.event.completed
                                ? 'line-through text-slate-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {occ.event.title}
                          </span>
                        </button>
                      </div>

                      {occ.event.description && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-line">
                          {occ.event.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{CALENDAR_DOMAIN_LABELS[occ.event.domain]}</span>
                        {subName && (
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {subName}
                          </span>
                        )}
                        {occ.event.recurrence !== 'none' && (
                          <span className="inline-flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            Recurrente
                          </span>
                        )}
                        {occ.event.reminderEnabled && (
                          <span className="inline-flex items-center gap-1">
                            <Bell className="w-3 h-3" />
                            {occ.event.reminderMinutesBefore} min antes
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => openEditEventModal(occ.event)}
                          className="min-h-[30px] px-2 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCalendarEvent(occ.event.id)}
                          className="min-h-[30px] px-2 rounded-lg text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Create / Edit Event Modal */}
      {eventModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={draft.editingId ? 'Editar actividad' : 'Nueva actividad'}
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEventModalOpen(false)}
        >
          <form
            onSubmit={handleSaveEvent}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold">
                {draft.editingId ? 'Editar actividad' : 'Nueva actividad o turno'}
              </h3>
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                aria-label="Cerrar"
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <p className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                {formError}
              </p>
            )}

            <div className="space-y-3">
              <label className="block space-y-1 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Título *
                </span>
                <input
                  type="text"
                  required
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Ej. Parcial de Anatomía, Turno médico, Clase práctica..."
                  className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm"
                />
              </label>

              <label className="block space-y-1 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Descripción / notas
                </span>
                <textarea
                  rows={2}
                  value={draft.description}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, description: e.target.value }))
                  }
                  placeholder="Aula, dirección, enlace, requisitos o temas..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-xs"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Fecha
                  </span>
                  <input
                    type="date"
                    required
                    value={draft.dateKey}
                    onChange={(e) => setDraft((d) => ({ ...d, dateKey: e.target.value }))}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-mono"
                  />
                </label>

                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Categoría y color
                  </span>
                  <select
                    value={draft.categoryId}
                    onChange={(e) => {
                      const chosen = categoriesSorted.find((c) => c.id === e.target.value);
                      setDraft((d) => ({
                        ...d,
                        categoryId: e.target.value,
                        domain: chosen ? chosen.domain : d.domain,
                      }));
                    }}
                    className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-semibold"
                  >
                    {categoriesSorted.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Optional Custom Color Override */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Color personalizado de celda (opcional)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, customColor: '' }))}
                    className={`min-h-[30px] px-2 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                      !draft.customColor
                        ? 'border-slate-900 dark:border-white bg-slate-100 dark:bg-slate-800'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Usar color de categoría
                  </button>
                  {CALENDAR_PRESET_SWATCHES.slice(0, 8).map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, customColor: hex }))}
                      aria-label={`Color ${hex}`}
                      style={{ backgroundColor: hex }}
                      className={`w-7 h-7 rounded-lg cursor-pointer ${
                        draft.customColor === hex
                          ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-2'
                          : ''
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={draft.customColor || '#2563EB'}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, customColor: e.target.value }))
                    }
                    aria-label="Selector de color libre"
                    className="w-7 h-7 rounded-lg cursor-pointer border border-slate-300"
                  />
                </div>
              </div>

              {/* Time & All-day */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.allDay}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, allDay: e.target.checked }))
                    }
                    className="w-4 h-4 rounded-sm accent-blue-600"
                  />
                  Todo el día
                </label>

                {!draft.allDay && (
                  <>
                    <label className="inline-flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500">Inicio</span>
                      <input
                        type="time"
                        value={draft.startTime}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, startTime: e.target.value }))
                        }
                        className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs font-mono"
                      />
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs">
                      <span className="text-slate-500">Duración (min)</span>
                      <input
                        type="number"
                        min={15}
                        max={720}
                        step={15}
                        value={draft.durationMinutes}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            durationMinutes: Number(e.target.value) || 60,
                          }))
                        }
                        className="w-20 min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs font-mono"
                      />
                    </label>
                  </>
                )}
              </div>

              {/* Domain + Linked Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Ámbito
                  </span>
                  <select
                    value={draft.domain}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        domain: e.target.value as CalendarDomain,
                      }))
                    }
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
                  >
                    {(
                      Object.keys(CALENDAR_DOMAIN_LABELS).filter(
                        (k) => k !== 'todos'
                      ) as CalendarDomain[]
                    ).map((dom) => (
                      <option key={dom} value={dom}>
                        {CALENDAR_DOMAIN_LABELS[dom]}
                      </option>
                    ))}
                  </select>
                </label>

                {!fixedSubjectId && (
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Vincular a materia / curso (opcional)
                    </span>
                    <select
                      value={draft.subjectId}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, subjectId: e.target.value }))
                      }
                      className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs"
                    >
                      <option value="">Sin materia asociada</option>
                      {activeSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {/* Recurrence */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="block space-y-1 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Repetición
                    </span>
                    <select
                      value={draft.recurrence}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          recurrence: e.target.value as CalendarRecurrenceRule,
                        }))
                      }
                      className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs"
                    >
                      <option value="none">No se repite</option>
                      <option value="daily">Todos los días</option>
                      <option value="weekly">Todas las semanas</option>
                      <option value="monthly">Todos los meses</option>
                      <option value="custom_days">Días personalizados</option>
                    </select>
                  </label>

                  {draft.recurrence !== 'none' && (
                    <label className="block space-y-1 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Hasta (opcional)
                      </span>
                      <input
                        type="date"
                        value={draft.recurrenceEndDate}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, recurrenceEndDate: e.target.value }))
                        }
                        className="w-full min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs font-mono"
                      />
                    </label>
                  )}
                </div>

                {draft.recurrence === 'custom_days' && (
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS_SHORT_SUN.map((lbl, dow) => {
                      const active = draft.recurrenceDaysOfWeek.includes(dow);
                      return (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() =>
                            setDraft((d) => {
                              const exists = d.recurrenceDaysOfWeek.includes(dow);
                              const next = exists
                                ? d.recurrenceDaysOfWeek.filter((x) => x !== dow)
                                : [...d.recurrenceDaysOfWeek, dow];
                              return {
                                ...d,
                                recurrenceDaysOfWeek: next.length > 0 ? next : [dow],
                              };
                            })
                          }
                          className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                            active
                              ? 'bg-blue-600 text-white'
                              : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reminder & Alarm Tone */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2.5">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.reminderEnabled}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, reminderEnabled: e.target.checked }))
                    }
                    className="w-4 h-4 accent-blue-600"
                  />
                  Activar recordatorio con alerta sonora
                </label>

                {draft.reminderEnabled && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={draft.reminderMinutesBefore}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          reminderMinutesBefore: Number(e.target.value),
                        }))
                      }
                      className="min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs"
                    >
                      <option value={0}>A la hora exacta</option>
                      <option value={10}>10 minutos antes</option>
                      <option value={15}>15 minutos antes</option>
                      <option value={30}>30 minutos antes</option>
                      <option value={60}>1 hora antes</option>
                    </select>

                    <select
                      value={draft.alarmTone}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          alarmTone: e.target.value as CalendarAlarmTone,
                        }))
                      }
                      className="flex-1 min-w-[140px] min-h-[36px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs"
                    >
                      {(Object.keys(CALENDAR_ALARM_TONE_LABELS) as CalendarAlarmTone[]).map(
                        (tone) => (
                          <option key={tone} value={tone}>
                            {CALENDAR_ALARM_TONE_LABELS[tone]}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={() => playCalendarAlarmTone(draft.alarmTone)}
                      className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Probar
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEventModalOpen(false)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 text-xs font-bold cursor-pointer"
              >
                {draft.editingId ? 'Guardar cambios' : 'Crear actividad'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
