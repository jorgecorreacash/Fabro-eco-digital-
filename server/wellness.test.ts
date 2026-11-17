import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {
  resetAntiSpamWindowsForTests,
  setTestTokenVerifierForTests,
} from './authMiddleware.ts';
import {
  buildDailySuggestionsPrompt,
  buildMealPlanPrompt,
  createWellnessRouter,
  normalizeMealPlanBundle,
  normalizeWellnessBundle,
  sanitizeDateKey,
} from './wellnessRouter.ts';

async function runTests() {
  resetAntiSpamWindowsForTests();

  // 1. Date key sanitization
  assert.equal(sanitizeDateKey('2026-11-14'), '2026-11-14');
  assert.match(sanitizeDateKey('invalid-date'), /^\d{4}-\d{2}-\d{2}$/);

  // 2. Prompt builders include key contextual parameters
  const dailyPrompt = buildDailySuggestionsPrompt({
    dateKey: '2026-11-14',
    focusArea: 'Manejo del estrés y estudio',
    routinesSummary: 'Estudio 50m, Ejercicio 30m',
    nutritionGoal: 'Energía y concentración',
    dietaryPreference: 'Vegetariana',
  });
  assert.ok(dailyPrompt.includes('2026-11-14'));
  assert.ok(dailyPrompt.includes('Vegetariana'));
  assert.ok(dailyPrompt.includes('Estudio 50m'));

  const mealPrompt = buildMealPlanPrompt({
    dateKey: '2026-11-14',
    goal: 'Rendimiento físico',
    preference: 'Sin TACC',
    restrictions: 'maní',
    waterTargetGlasses: 9,
    routinesSummary: 'Entrenamiento tarde 45m',
  });
  assert.ok(mealPrompt.includes('Sin TACC'));
  assert.ok(mealPrompt.includes('maní'));
  assert.ok(mealPrompt.includes('9 vasos'));

  // 3. Normalization clamps out-of-range durations & fills safe defaults
  const normWellness = normalizeWellnessBundle(
    {
      dailyHeadline: 'Enfoque equilibrado para hoy',
      mentalHealth: [
        {
          title: 'Respiración 4-7-8',
          description: 'Calma el sistema nervioso entre sesiones.',
          durationMinutes: 999,
          category: 'Respiración',
          actionableStep: 'Inhalá 4s, sostené 7s, exhalá 8s.',
        },
      ],
      physicalHealth: [
        {
          title: 'Movilidad cervical',
          description: 'Libera tensión acumulada frente a pantallas.',
          durationMinutes: 0,
          category: 'Postura',
          actionableStep: 'Rotaciones lentas de hombros.',
        },
      ],
      nutritionTip: {
        title: 'Hidratación constante',
        summary: 'Tomá agua antes de cada bloque.',
        hydrationReminder: '1 vaso por bloque.',
      },
    },
    '2026-11-14',
    'estres_estudio'
  );
  assert.equal(normWellness.dateKey, '2026-11-14');
  assert.equal(normWellness.mentalHealth[0].durationMinutes, 60);
  assert.equal(normWellness.physicalHealth[0].durationMinutes, 2);

  const normMeals = normalizeMealPlanBundle(
    {
      dailySummary: 'Menú completo equilibrado',
      hydrationNote: '8 vasos hoy',
      meals: [
        {
          slot: 'desayuno',
          slotLabel: 'Desayuno',
          title: 'Yogur con avena y fruta',
          foods: ['Yogur natural', 'Avena', 'Banana'],
          benefits: 'Energía sostenida',
          approxKcal: 380,
          prepMinutes: 8,
        },
      ],
    },
    '2026-11-14'
  );
  assert.equal(normMeals.meals.length, 1);
  assert.equal(normMeals.meals[0].slot, 'desayuno');
  assert.equal(normMeals.meals[0].approxKcal, 380);

  // 4. Router HTTP tests (Auth Guard + Mocked Gemini Generation)
  setTestTokenVerifierForTests(async (token) => {
    if (token === 'valid-student-token') {
      return {
        uid: 'student_wellness_1',
        email: 'estudiante@fabro.edu',
        displayName: 'Estudiante Test',
        emailVerified: true,
        isSuperAdmin: false,
        isAdmin: false,
      };
    }
    return null;
  });

  const app = express();
  app.use(express.json());
  app.use(
    '/api/wellness',
    createWellnessRouter({
      generateDailySuggestionsFn: async () => ({
        dailyHeadline: 'Jornada productiva y saludable para hoy',
        mentalHealth: [
          {
            title: 'Pausa atencional de 5 minutos',
            description: 'Desconectá estímulos visuales para recuperar foco.',
            durationMinutes: 5,
            category: 'Atención plena',
            actionableStep: 'Respirá profundo con los ojos cerrados 5 minutos.',
          },
        ],
        physicalHealth: [
          {
            title: 'Estiramiento de espalda y cuello',
            description: 'Compensa horas de lectura sentada.',
            durationMinutes: 8,
            category: 'Movilidad',
            actionableStep: 'Realizá extensiones dorsales de pie.',
          },
        ],
        nutritionTip: {
          title: 'Colación inteligente',
          summary: 'Combiná fruta fresca con frutos secos.',
          hydrationReminder: 'Tené una botella de agua cerca del escritorio.',
        },
      }),
      generateMealPlanFn: async () => ({
        dailySummary: 'Plan adaptado al estudio',
        hydrationNote: '8 vasos diarios',
        meals: [
          {
            slot: 'desayuno',
            slotLabel: 'Desayuno',
            title: 'Tostadas integrales con palta y huevo',
            foods: ['Pan integral', 'Palta', 'Huevo'],
            benefits: 'Saciedad y concentración',
            approxKcal: 410,
            prepMinutes: 10,
          },
        ],
      }),
    })
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Rejects unauthenticated requests
    const unauthResp = await fetch(`${baseUrl}/api/wellness/daily-suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateKey: '2026-11-14' }),
    });
    assert.equal(unauthResp.status, 401);

    // Authenticated daily-suggestions succeeds
    const dailyResp = await fetch(`${baseUrl}/api/wellness/daily-suggestions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-student-token',
      },
      body: JSON.stringify({
        dateKey: '2026-11-14',
        focusArea: 'equilibrio_integral',
        routinesSummary: 'Estudio 50m',
      }),
    });
    assert.equal(dailyResp.status, 200);
    const dailyBody = (await dailyResp.json()) as {
      dateKey: string;
      mentalHealth: Array<{ title: string }>;
      physicalHealth: Array<{ title: string }>;
    };
    assert.equal(dailyBody.dateKey, '2026-11-14');
    assert.equal(dailyBody.mentalHealth[0].title, 'Pausa atencional de 5 minutos');
    assert.equal(dailyBody.physicalHealth[0].title, 'Estiramiento de espalda y cuello');

    // Authenticated generate-meal-plan succeeds
    const mealResp = await fetch(`${baseUrl}/api/wellness/generate-meal-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-student-token',
      },
      body: JSON.stringify({
        dateKey: '2026-11-14',
        goal: 'Energía y concentración',
        preference: 'Sin restricciones',
      }),
    });
    assert.equal(mealResp.status, 200);
    const mealBody = (await mealResp.json()) as {
      dateKey: string;
      meals: Array<{ title: string; approxKcal: number }>;
    };
    assert.equal(mealBody.dateKey, '2026-11-14');
    assert.equal(mealBody.meals[0].title, 'Tostadas integrales con palta y huevo');
    assert.equal(mealBody.meals[0].approxKcal, 410);
  } finally {
    setTestTokenVerifierForTests(null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('All wellness router & routine/nutrition unit tests passed.');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
