import assert from 'node:assert/strict';
import {
  DEFAULT_CALENDAR_CATEGORIES,
  expandEventsForDateRange,
  getContrastTextColor,
  resolveDayCellPaint,
  upsertCalendarEventForEvaluation,
} from '../src/services/unifiedCalendarService';
import {
  computeLineDiff,
  computeRealStudyProgress,
  generateAcademicCitation,
} from '../src/services/study2ToolsUtils';
import { convertUnitValue, evaluateMathExpression } from '../src/services/toolsEngine';
import type {
  StudyEvaluation,
  StudySubject,
  StudyTaskItem,
  UnifiedCalendarEvent,
} from '../src/types/study2';

async function runTests() {
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];

  const test = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      results.push({ name, ok: true, detail: 'OK' });
    } catch (err) {
      results.push({
        name,
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // 1. WCAG automatic text contrast for full-cell painted days
  await test('WCAG contraste automático en celdas coloreadas', () => {
    assert.equal(getContrastTextColor('#2563EB'), '#FFFFFF');
    assert.equal(getContrastTextColor('#7C3AED'), '#FFFFFF');
    assert.equal(getContrastTextColor('#DC2626'), '#FFFFFF');
    assert.equal(getContrastTextColor('#FDE047'), '#0F172A');
    assert.equal(getContrastTextColor('#E2E8F0'), '#0F172A');
  });

  // 2. Recurrence expansion (daily, weekly, monthly, custom_days)
  await test('Expansión de recurrencias de calendario (diaria, semanal, mensual, días custom)', () => {
    const base: Omit<UnifiedCalendarEvent, 'id' | 'recurrence' | 'recurrenceDaysOfWeek'> = {
      title: 'Evento recurrente',
      description: '',
      dateKey: '2026-05-01',
      allDay: false,
      startTime: '09:00',
      durationMinutes: 60,
      categoryId: 'cat-estudio',
      domain: 'academico',
      reminderEnabled: false,
      reminderMinutesBefore: 15,
      alarmTone: 'campana',
      completed: false,
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
    };

    const dailyEvents = expandEventsForDateRange(
      [{ ...base, id: 'ev-daily', recurrence: 'daily' }],
      '2026-05-01',
      '2026-05-05'
    );
    assert.equal(dailyEvents.length, 5);

    const weeklyEvents = expandEventsForDateRange(
      [{ ...base, id: 'ev-weekly', recurrence: 'weekly' }],
      '2026-05-01',
      '2026-05-29'
    );
    assert.equal(weeklyEvents.length, 5); // May 1, 8, 15, 22, 29

    const monthlyEvents = expandEventsForDateRange(
      [{ ...base, id: 'ev-monthly', recurrence: 'monthly' }],
      '2026-05-01',
      '2026-08-31'
    );
    assert.equal(monthlyEvents.length, 4); // May 1, Jun 1, Jul 1, Aug 1

    const customEvents = expandEventsForDateRange(
      [{ ...base, id: 'ev-custom', recurrence: 'custom_days', recurrenceDaysOfWeek: [1, 3, 5] }],
      '2026-05-01',
      '2026-05-10'
    );
    // 2026-05-01 Fri (5), May 4 Mon (1), May 6 Wed (3), May 8 Fri (5) => 4 occurrences
    assert.equal(customEvents.length, 4);
  });

  // 3. Full-cell priority painting and +N counter
  await test('Pintado completo de celda por prioridad configurable y badge +N', () => {
    const evStudy: UnifiedCalendarEvent = {
      id: 'ev-1',
      title: 'Clase',
      description: '',
      dateKey: '2026-05-10',
      allDay: false,
      startTime: '08:00',
      durationMinutes: 60,
      categoryId: 'cat-estudio', // priority 2, #2563EB
      domain: 'academico',
      recurrence: 'none',
      reminderEnabled: false,
      reminderMinutesBefore: 10,
      alarmTone: 'campana',
      completed: false,
      createdAt: '2026-05-01T08:00:00.000Z',
      updatedAt: '2026-05-01T08:00:00.000Z',
    };
    const evDeadline: UnifiedCalendarEvent = {
      ...evStudy,
      id: 'ev-2',
      title: 'Vencimiento crítico',
      categoryId: 'cat-vencimientos', // priority 0, #DC2626
      domain: 'profesional',
    };
    const occs = expandEventsForDateRange([evStudy, evDeadline], '2026-05-10', '2026-05-10');
    const painted = resolveDayCellPaint(occs, DEFAULT_CALENDAR_CATEGORIES, 'priority');
    assert.equal(painted.primaryColor, '#DC2626');
    assert.equal(painted.textColor, '#FFFFFF');
    assert.equal(painted.extraCount, 1);
  });

  // 4. Evaluation <-> Calendar synchronization without duplicates
  await test('Sincronización Evaluaciones <-> Calendario sin duplicados', () => {
    const evalItem: StudyEvaluation = {
      id: 'eval-101',
      subjectId: 'sub-1',
      title: 'Primer Parcial',
      kind: 'parcial',
      dateKey: '2026-06-15',
      startTime: '10:00',
      topics: ['Unidad 1', 'Unidad 2'],
      status: 'programada',
      maxGrade: 10,
      observations: 'Llevar calculadora',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    };

    const first = upsertCalendarEventForEvaluation([], evalItem, 'Análisis Matemático');
    assert.equal(first.events.length, 1);
    assert.equal(first.events[0].dateKey, '2026-06-15');
    assert.equal(first.events[0].categoryId, 'cat-examenes');

    // Update date and status -> must update in-place without creating duplicate
    const updatedEval: StudyEvaluation = {
      ...evalItem,
      dateKey: '2026-06-20',
      status: 'aprobada',
      grade: 9,
      calendarEventId: first.calendarEventId,
    };
    const second = upsertCalendarEventForEvaluation(
      first.events,
      updatedEval,
      'Análisis Matemático'
    );
    assert.equal(second.events.length, 1);
    assert.equal(second.events[0].dateKey, '2026-06-20');
    assert.equal(second.events[0].completed, true);
  });

  // 5. Real study progress math (strictly null when empty, exact when populated)
  await test('Cálculo real de progreso (sin datos inventados ni porcentajes falsos)', () => {
    const emptyReport = computeRealStudyProgress({
      subjects: [],
      tasks: [],
      evaluations: [],
      pomodoroLogs: [],
    });
    assert.equal(emptyReport.activeSubjectsCount, 0);
    assert.equal(emptyReport.averageGrade, null);
    assert.equal(emptyReport.overallCompletionPercent, null);
    assert.equal(emptyReport.totalStudyMinutes, 0);

    const subject: StudySubject = {
      id: 's1',
      name: 'Derecho Civil',
      kind: 'materia_universitaria',
      institution: 'UBA',
      professor: 'Dra. Gómez',
      color: '#2563EB',
      icon: 'scale',
      units: [
        {
          id: 'u1',
          title: 'Unidad 1',
          topics: [
            { id: 't1', title: 'Tema A', completed: true },
            { id: 't2', title: 'Tema B', completed: false },
          ],
        },
      ],
      archived: false,
      orderIndex: 0,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    };
    const tasks: StudyTaskItem[] = [
      {
        id: 'tk1',
        subjectId: 's1',
        title: 'Leer fallo',
        completed: true,
        priority: 'alta',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'tk2',
        subjectId: 's1',
        title: 'Resumen',
        completed: false,
        priority: 'media',
        createdAt: '2026-05-01T00:00:00.000Z',
      },
    ];
    const evals: StudyEvaluation[] = [
      {
        id: 'e1',
        subjectId: 's1',
        title: 'Parcial 1',
        kind: 'parcial',
        dateKey: '2026-05-12',
        startTime: '09:00',
        topics: [],
        status: 'aprobada',
        grade: 8,
        maxGrade: 10,
        observations: '',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'e2',
        subjectId: 's1',
        title: 'Parcial 2',
        kind: 'parcial',
        dateKey: '2026-06-12',
        startTime: '09:00',
        topics: [],
        status: 'aprobada',
        grade: 10,
        maxGrade: 10,
        observations: '',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ];

    const populated = computeRealStudyProgress({
      subjects: [subject],
      tasks,
      evaluations: evals,
      pomodoroLogs: [
        {
          id: 'p1',
          subject: 'Derecho Civil',
          minutes: 50,
          completedAt: '2026-05-02T10:00:00.000Z',
        },
      ],
    });
    assert.equal(populated.overallCompletionPercent, 50); // 2 of 4 items done
    assert.equal(populated.averageGrade, 9);
    assert.equal(populated.totalStudyMinutes, 50);
  });

  // 6. Academic citations, line diff, scientific calculator, unit converter
  await test('Citas (APA/MLA/Chicago/IEEE/ISO 690), comparador diff, calculadora y conversor', () => {
    const input = {
      authors: 'Bunge, Mario',
      year: '2004',
      title: 'La investigación científica',
      publisherOrJournal: 'Siglo XXI',
      kind: 'libro' as const,
    };
    assert.ok(generateAcademicCitation('apa7', input).includes('Bunge, Mario (2004).'));
    assert.ok(generateAcademicCitation('mla9', input).includes('2004'));
    assert.ok(generateAcademicCitation('chicago', input).includes('2004.'));
    assert.ok(generateAcademicCitation('ieee', input).includes('"La investigación científica,"'));
    assert.ok(generateAcademicCitation('iso690', input).includes('BUNGE, MARIO.'));

    const diff = computeLineDiff('Línea 1\nLínea 2\nLínea 3', 'Línea 1\nLínea 2 editada\nLínea 3');
    assert.equal(diff.addedCount, 1);
    assert.equal(diff.removedCount, 1);
    assert.equal(diff.unchangedCount, 2);

    const calc = evaluateMathExpression('sqrt(81) + 2^3', 0);
    assert.equal(calc.ok, true);
    assert.equal(calc.value, 17);

    const tempF = convertUnitValue('temperatura', 'c', 'f', 100);
    assert.equal(Math.round(tempF), 212);
  });

  // 7. Live free backend endpoints (/api/study/research & /api/study/dictionary)
  await test('Endpoint gratuito GET /api/study/research (OpenAlex/Crossref/Wikipedia ES)', async () => {
    const res = await fetch('http://127.0.0.1:3000/api/study/research?q=epistemologia');
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      sources: Array<{ title: string; url: string; sourceName: string }>;
    };
    assert.equal(json.ok, true);
    assert.ok(Array.isArray(json.sources));
    assert.ok(json.sources.length > 0, 'Debe devolver al menos una fuente verificable real');
    assert.ok(json.sources[0].url.startsWith('http'), 'La fuente debe incluir URL real');
  });

  await test('Endpoint gratuito GET /api/study/dictionary (Wikcionario/Wikipedia ES)', async () => {
    const res = await fetch('http://127.0.0.1:3000/api/study/dictionary?word=epistemologia');
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      ok: boolean;
      term: string;
      definition: string;
      sourceLabel: string;
    };
    assert.equal(json.ok, true);
    assert.ok(typeof json.definition === 'string' && json.definition.length > 20);
  });

  console.log('\n=== RESULTADOS PRUEBAS FABRO ESTUDIO 2.0 ===');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name}${r.ok ? '' : ` -> ${r.detail}`}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exit(1);
  }
  console.log(`\nTotal: ${results.length}/${results.length} pruebas superadas.`);
}

void runTests();
