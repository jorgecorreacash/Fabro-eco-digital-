import type { PaintedCalendarEvent } from '../types/ecosystem';
import type {
  CalendarCategoryConfig,
  CalendarDomain,
  CalendarPreferences,
  StudyEvaluation,
  UnifiedCalendarEvent,
} from '../types/study2';

export const DEFAULT_CALENDAR_CATEGORIES: CalendarCategoryConfig[] = [
  {
    id: 'cat-estudio',
    name: 'Estudio y clases',
    color: '#2563EB', // Azul
    domain: 'academico',
    priority: 2,
    enabled: true,
  },
  {
    id: 'cat-examenes',
    name: 'Exámenes y evaluaciones',
    color: '#7C3AED', // Violeta
    domain: 'academico',
    priority: 1,
    enabled: true,
  },
  {
    id: 'cat-personal',
    name: 'Actividades personales',
    color: '#16A34A', // Verde
    domain: 'personal',
    priority: 4,
    enabled: true,
  },
  {
    id: 'cat-turnos',
    name: 'Turnos y reuniones',
    color: '#EA580C', // Naranja
    domain: 'turnos',
    priority: 3,
    enabled: true,
  },
  {
    id: 'cat-vencimientos',
    name: 'Vencimientos y fechas importantes',
    color: '#DC2626', // Rojo
    domain: 'profesional',
    priority: 0,
    enabled: true,
  },
  {
    id: 'cat-recordatorios',
    name: 'Recordatorios',
    color: '#475569', // Gris
    domain: 'recordatorios',
    priority: 5,
    enabled: true,
  },
];

export const DEFAULT_CALENDAR_PREFERENCES: CalendarPreferences = {
  weekStartsOn: 1,
  defaultView: 'month',
  multiEventRule: 'priority',
};

export const CALENDAR_DOMAIN_LABELS: Record<CalendarDomain | 'todos', string> = {
  todos: 'Todos',
  academico: 'Académicos',
  profesional: 'Profesionales',
  personal: 'Personales',
  turnos: 'Turnos',
  recordatorios: 'Recordatorios',
  otros: 'Otros',
};

export const CALENDAR_PRESET_SWATCHES: string[] = [
  '#2563EB', // Azul
  '#7C3AED', // Violeta
  '#16A34A', // Verde
  '#EA580C', // Naranja
  '#DC2626', // Rojo
  '#475569', // Gris pizarra
  '#0891B2', // Cian
  '#DB2777', // Rosa
  '#CA8A04', // Ámbar oscuro
  '#0D9488', // Turquesa
  '#4F46E5', // Índigo
  '#15803D', // Esmeralda
];

/**
 * Computes WCAG relative luminance of a #RRGGBB hex color and returns
 * the highest-contrast readable text color (#FFFFFF or #0F172A).
 */
export function getContrastTextColor(hexColor: string): '#FFFFFF' | '#0F172A' {
  const clean = (hexColor || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#FFFFFF';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.36 ? '#0F172A' : '#FFFFFF';
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map((n) => Number(n));
  return new Date(y || 2025, Math.max(0, (m || 1) - 1), d || 1, 12, 0, 0, 0);
}

export function addDaysToDateKey(dateKey: string, deltaDays: number): string {
  const dt = parseDateKey(dateKey);
  dt.setDate(dt.getDate() + deltaDays);
  return formatDateKey(dt);
}

export function getTodayLocalDateKey(): string {
  return formatDateKey(new Date());
}

export interface CalendarEventOccurrence {
  occurrenceId: string;
  event: UnifiedCalendarEvent;
  dateKey: string;
  isRecurringInstance: boolean;
}

/**
 * Expands base + recurring events cleanly within [rangeStartKey, rangeEndKey]
 * without duplicating stored records.
 */
export function expandEventsForDateRange(
  events: UnifiedCalendarEvent[],
  rangeStartKey: string,
  rangeEndKey: string
): CalendarEventOccurrence[] {
  const startDt = parseDateKey(rangeStartKey);
  const endDt = parseDateKey(rangeEndKey);
  const out: CalendarEventOccurrence[] = [];

  for (const ev of events) {
    if (!ev.dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(ev.dateKey)) continue;

    if (ev.recurrence === 'none') {
      if (ev.dateKey >= rangeStartKey && ev.dateKey <= rangeEndKey) {
        out.push({
          occurrenceId: `${ev.id}::${ev.dateKey}`,
          event: ev,
          dateKey: ev.dateKey,
          isRecurringInstance: false,
        });
      }
      continue;
    }

    const evStart = parseDateKey(ev.dateKey);
    const evEnd =
      ev.recurrenceEndDate && /^\d{4}-\d{2}-\d{2}$/.test(ev.recurrenceEndDate)
        ? parseDateKey(ev.recurrenceEndDate)
        : endDt;
    const effectiveEnd = evEnd < endDt ? evEnd : endDt;
    if (evStart > effectiveEnd) continue;

    const cursor = new Date(Math.max(evStart.getTime(), startDt.getTime()));
    cursor.setHours(12, 0, 0, 0);
    const originDay = evStart.getDate();
    const originDow = evStart.getDay();
    const customDays = new Set(ev.recurrenceDaysOfWeek || [originDow]);

    let guard = 0;
    while (cursor <= effectiveEnd && guard < 400) {
      guard += 1;
      const curKey = formatDateKey(cursor);
      let matches = false;

      if (ev.recurrence === 'daily') {
        matches = true;
      } else if (ev.recurrence === 'weekly') {
        matches = cursor.getDay() === originDow;
      } else if (ev.recurrence === 'monthly') {
        const lastDayOfMonth = new Date(
          cursor.getFullYear(),
          cursor.getMonth() + 1,
          0
        ).getDate();
        matches = cursor.getDate() === Math.min(originDay, lastDayOfMonth);
      } else if (ev.recurrence === 'custom_days') {
        matches = customDays.has(cursor.getDay());
      }

      if (matches && curKey >= ev.dateKey) {
        out.push({
          occurrenceId: `${ev.id}::${curKey}`,
          event: ev,
          dateKey: curKey,
          isRecurringInstance: curKey !== ev.dateKey,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return out.sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
    return (a.event.startTime || '00:00').localeCompare(b.event.startTime || '00:00');
  });
}

export function resolveEventColor(
  event: UnifiedCalendarEvent,
  categories: CalendarCategoryConfig[]
): string {
  if (event.customColor && /^#[0-9a-fA-F]{6}$/.test(event.customColor)) {
    return event.customColor;
  }
  const cat = categories.find((c) => c.id === event.categoryId);
  return cat?.color || '#2563EB';
}

export interface DayCellPaintResult {
  primaryColor: string | null;
  textColor: '#FFFFFF' | '#0F172A';
  primaryEvent: CalendarEventOccurrence | null;
  extraCount: number;
  allEvents: CalendarEventOccurrence[];
}

/**
 * Resolves the full-cell fill color and readable text color for a calendar day.
 */
export function resolveDayCellPaint(
  dayOccurrences: CalendarEventOccurrence[],
  categories: CalendarCategoryConfig[],
  multiEventRule: CalendarPreferences['multiEventRule'] = 'priority'
): DayCellPaintResult {
  if (dayOccurrences.length === 0) {
    return {
      primaryColor: null,
      textColor: '#0F172A',
      primaryEvent: null,
      extraCount: 0,
      allEvents: [],
    };
  }

  const catPriorityMap = new Map(categories.map((c) => [c.id, c.priority]));

  const sorted = [...dayOccurrences].sort((a, b) => {
    if (multiEventRule === 'first_created') {
      return a.event.createdAt.localeCompare(b.event.createdAt);
    }
    if (multiEventRule === 'latest_created') {
      return b.event.createdAt.localeCompare(a.event.createdAt);
    }
    const pa = catPriorityMap.get(a.event.categoryId) ?? 99;
    const pb = catPriorityMap.get(b.event.categoryId) ?? 99;
    if (pa !== pb) return pa - pb;
    return (a.event.startTime || '00:00').localeCompare(b.event.startTime || '00:00');
  });

  const primary = sorted[0];
  const color = resolveEventColor(primary.event, categories);
  return {
    primaryColor: color,
    textColor: getContrastTextColor(color),
    primaryEvent: primary,
    extraCount: Math.max(0, sorted.length - 1),
    allEvents: dayOccurrences,
  };
}

/**
 * Non-destructive migration from legacy PaintedCalendarEvent records into UnifiedCalendarEvent.
 */
export function migrateLegacyPaintedEvents(
  legacyEvents: PaintedCalendarEvent[]
): UnifiedCalendarEvent[] {
  const colorToCategory: Record<string, { catId: string; domain: CalendarDomain }> = {
    examen: { catId: 'cat-examenes', domain: 'academico' },
    entrega: { catId: 'cat-vencimientos', domain: 'academico' },
    estudio: { catId: 'cat-estudio', domain: 'academico' },
    personal: { catId: 'cat-personal', domain: 'personal' },
  };

  return legacyEvents.map((ev) => {
    const mapped = colorToCategory[ev.colorCode] || {
      catId: 'cat-estudio',
      domain: 'academico' as CalendarDomain,
    };
    const now = ev.createdAt || new Date().toISOString();
    const startTime =
      ev.alarmTime && /^\d{2}:\d{2}$/.test(ev.alarmTime)
        ? ev.alarmTime
        : `${String(Math.min(23, Math.max(0, ev.startHour ?? 9))).padStart(2, '0')}:00`;
    return {
      id: ev.id,
      title: ev.title,
      description: ev.notes || '',
      dateKey: ev.dateKey,
      allDay: false,
      startTime,
      durationMinutes: Number(ev.durationMinutes) || 60,
      categoryId: mapped.catId,
      domain: mapped.domain,
      recurrence: 'none',
      reminderEnabled: Boolean(ev.alarmEnabled),
      reminderMinutesBefore: 10,
      alarmTone: ev.alarmTone || 'campana',
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Synchronizes a StudyEvaluation into a single linked UnifiedCalendarEvent (never duplicates).
 */
export function upsertCalendarEventForEvaluation(
  events: UnifiedCalendarEvent[],
  evaluation: StudyEvaluation,
  subjectName: string
): { events: UnifiedCalendarEvent[]; calendarEventId: string } {
  const existing = events.find(
    (e) =>
      e.linkedEvaluationId === evaluation.id ||
      (evaluation.calendarEventId && e.id === evaluation.calendarEventId)
  );
  const now = new Date().toISOString();
  const calId = existing?.id || evaluation.calendarEventId || `cal-eval-${evaluation.id}`;
  const kindLabelMap: Record<StudyEvaluation['kind'], string> = {
    parcial: 'Parcial',
    final: 'Final',
    recuperatorio: 'Recuperatorio',
    tp_evaluado: 'TP evaluado',
    oral: 'Examen oral',
    cuestionario: 'Evaluación',
  };

  const title = `${kindLabelMap[evaluation.kind]}: ${evaluation.title}${
    subjectName ? ` (${subjectName})` : ''
  }`;
  const description = [
    evaluation.topics.length > 0 ? `Temas: ${evaluation.topics.join(', ')}` : '',
    evaluation.observations || '',
  ]
    .filter(Boolean)
    .join('\n');

  const syncedEvent: UnifiedCalendarEvent = {
    id: calId,
    title,
    description,
    dateKey: evaluation.dateKey,
    allDay: !evaluation.startTime,
    startTime: evaluation.startTime || '09:00',
    durationMinutes: 90,
    categoryId: 'cat-examenes',
    domain: 'academico',
    subjectId: evaluation.subjectId,
    linkedEvaluationId: evaluation.id,
    recurrence: 'none',
    reminderEnabled: true,
    reminderMinutesBefore: 60,
    alarmTone: 'campana',
    completed: evaluation.status === 'aprobada' || evaluation.status === 'rendida',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  // Remove any stale duplicates pointing to this evaluation before reinserting
  const cleaned = events.filter(
    (e) => e.id !== calId && e.linkedEvaluationId !== evaluation.id
  );
  return {
    events: [syncedEvent, ...cleaned],
    calendarEventId: calId,
  };
}
