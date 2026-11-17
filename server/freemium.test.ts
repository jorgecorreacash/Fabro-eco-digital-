import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import http from 'node:http';
import {
  FREE_QUOTA_EXHAUSTED_MESSAGE,
  commitAiUsage,
  flushFreemiumStoreForTests,
  getAdminDashboardSnapshot,
  getBudgetStatusSnapshot,
  getUserFreemiumStatus,
  grantUserCreditsAdmin,
  recordDirectSpendForTests,
  releaseAiQuotaReservation,
  reserveAiQuota,
  resetFreemiumStoreInMemory,
  setFreemiumStorePathForTests,
  setUserPlanAdmin,
  updateSystemLimitsAdmin,
} from './freemiumStore.ts';
import {
  executeGatewayChat,
  setAdapterInvokerForTests,
} from './aiGateway.ts';
import {
  resetAntiSpamWindowsForTests,
  setTestTokenVerifierForTests,
} from './authMiddleware.ts';
import { freemiumAiGuardMiddleware } from './freemiumMiddleware.ts';

async function runTests() {
  const tmpStore = path.join(os.tmpdir(), `fabro-freemium-test-${Date.now()}.json`);
  setFreemiumStorePathForTests(tmpStore);
  resetFreemiumStoreInMemory();
  resetAntiSpamWindowsForTests();

  const freeUser = {
    uid: 'student_free_1',
    email: 'free1@fabro.test',
    displayName: 'Estudiante Gratis',
  };
  const raceUser = {
    uid: 'student_race_2',
    email: 'race2@fabro.test',
    displayName: 'Estudiante Concurrencia',
  };
  const errUser = {
    uid: 'student_err_3',
    email: 'err3@fabro.test',
    displayName: 'Estudiante Error',
  };
  const premiumUser = {
    uid: 'student_prem_4',
    email: 'prem4@fabro.test',
    displayName: 'Estudiante Premium',
  };

  // Raise anti-spam limit slightly ONLY to let concurrency test fire 8 parallel calls cleanly
  updateSystemLimitsAdmin({ antiSpamPerMinute: 30 }, 'jorgecorreasp@gmail.com');

  // ------------------------------------------------------------------
  // TEST 1: Free Plan 5/day limit & exact Spanish block message on #6
  // ------------------------------------------------------------------
  for (let i = 1; i <= 5; i += 1) {
    const res = await reserveAiQuota({
      ...freeUser,
      endpoint: '/api/ai/tutor',
      operationType: 'tutor',
    });
    await commitAiUsage(res, {
      endpoint: '/api/ai/tutor',
      providerId: 'gemini',
      modelId: 'gemini-3.1-flash-lite',
      tierUsed: 'free',
      inputTokens: 400,
      outputTokens: 600,
      costUsd: 0.0002,
      latencyMs: 120,
    });
  }

  const freeStatusAfter5 = getUserFreemiumStatus(freeUser.uid, freeUser.email);
  assert.equal(freeStatusAfter5.planTier, 'free');
  assert.equal(freeStatusAfter5.usedToday, 5);
  assert.equal(freeStatusAfter5.dailyLimit, 5);
  assert.equal(freeStatusAfter5.remainingToday, 0);

  let blockedMsg = '';
  try {
    await reserveAiQuota({ ...freeUser, endpoint: '/api/ai/tutor' });
    assert.fail('La consulta 6 gratuita debió bloquearse');
  } catch (err) {
    blockedMsg = err instanceof Error ? err.message : '';
  }
  assert.equal(blockedMsg, FREE_QUOTA_EXHAUSTED_MESSAGE);
  console.log('✓ Test 1 PASSED: Límite diario gratuito (5/5) y mensaje exacto en la consulta #6.');

  // ------------------------------------------------------------------
  // TEST 2: Concurrency race-condition protection (8 parallel requests)
  // ------------------------------------------------------------------
  const parallelAttempts = await Promise.allSettled(
    Array.from({ length: 8 }, (_, idx) =>
      reserveAiQuota({
        ...raceUser,
        endpoint: `/api/ai/source-search#${idx}`,
      })
    )
  );
  const succeeded = parallelAttempts.filter((r) => r.status === 'fulfilled');
  const rejected = parallelAttempts.filter((r) => r.status === 'rejected');
  assert.equal(succeeded.length, 5, 'Solo deben pasar exactamente 5 solicitudes concurrentes');
  assert.equal(rejected.length, 3, 'Las otras 3 solicitudes concurrentes deben rechazarse');
  console.log('✓ Test 2 PASSED: Protección contra concurrencia simultánea (8 paralelas -> 5 permitidas, 3 bloqueadas).');

  // ------------------------------------------------------------------
  // TEST 3: Provider internal error MUST NOT deduct user's daily quota
  // ------------------------------------------------------------------
  const beforeErrStatus = getUserFreemiumStatus(errUser.uid, errUser.email);
  assert.equal(beforeErrStatus.usedToday, 0);

  const errReservation = await reserveAiQuota({
    ...errUser,
    endpoint: '/api/ai/tutor',
  });
  await releaseAiQuotaReservation(errReservation, {
    endpoint: '/api/ai/tutor',
    providerId: 'gemini',
    modelId: 'gemini-4-hydrogen',
    errorMessage: '503 INTERNAL_PROVIDER_UNAVAILABLE',
    latencyMs: 310,
  });

  const afterErrStatus = getUserFreemiumStatus(errUser.uid, errUser.email);
  assert.equal(afterErrStatus.usedToday, 0, 'Un error interno del proveedor NO debe consumir consultas');
  assert.equal(afterErrStatus.remainingToday, 5);
  console.log('✓ Test 3 PASSED: Errores internos de proveedor devuelven la consulta sin descontar cuota.');

  // ------------------------------------------------------------------
  // TEST 4: Monthly budget thresholds ($30 USD -> 50% / 75% / 90% / 100%)
  // ------------------------------------------------------------------
  setUserPlanAdmin({
    uid: premiumUser.uid,
    planTier: 'premium',
    adminEmail: 'jorgecorreasp@gmail.com',
  });
  const premStatus = getUserFreemiumStatus(premiumUser.uid, premiumUser.email);
  assert.equal(premStatus.planTier, 'premium');
  assert.equal(premStatus.dailyLimit, 50);

  // 50% ($15.50 / $30)
  const s50 = recordDirectSpendForTests(15.5, 'openai', 'gpt-4o');
  assert.equal(s50.activeThreshold, 50);
  assert.equal(s50.paidBlocked, false);

  // 75% ($23.00 / $30)
  const s75 = recordDirectSpendForTests(7.5, 'openai', 'gpt-4o');
  assert.equal(s75.activeThreshold, 75);
  assert.equal(s75.paidBlocked, false);

  // 90% ($27.50 / $30) -> restricts commercial models
  const s90 = recordDirectSpendForTests(4.5, 'openai', 'gpt-4o-mini');
  assert.equal(s90.activeThreshold, 90);
  assert.equal(s90.paidRestricted, true);

  // 100% ($30.50 / $30) -> hard backend block on new paid operations
  const s100 = recordDirectSpendForTests(3.0, 'openai', 'gpt-4o');
  assert.equal(s100.activeThreshold, 100);
  assert.equal(s100.paidBlocked, true);

  // Trying to reserve a paid-only operation when budget is >=100% MUST fail cleanly
  let paidBlockedError = '';
  try {
    await reserveAiQuota({
      ...premiumUser,
      endpoint: '/api/ai/image',
      requirePaidModel: true,
    });
    assert.fail('Operación paga debió bloquearse al 100% del presupuesto');
  } catch (err) {
    paidBlockedError = err instanceof Error ? err.message : '';
  }
  assert.ok(paidBlockedError.includes('presupuesto mensual'));

  const dash = getAdminDashboardSnapshot();
  const alertTypes = new Set(dash.alerts.map((a) => a.type));
  assert.ok(alertTypes.has('budget_50'), 'Debe generar alerta al 50%');
  assert.ok(alertTypes.has('budget_75'), 'Debe generar alerta al 75%');
  assert.ok(alertTypes.has('budget_90'), 'Debe generar alerta al 90%');
  assert.ok(alertTypes.has('budget_100'), 'Debe generar alerta al 100%');
  console.log('✓ Test 4 PASSED: Umbrales de presupuesto mensual $30 USD (50/75/90/100%) + bloqueo backend.');

  // ------------------------------------------------------------------
  // TEST 5: Automatic Failover in FABRO AI Router (Gemini -> OpenAI)
  // ------------------------------------------------------------------
  updateSystemLimitsAdmin({ monthlyBudgetUsd: 100 }, 'jorgecorreasp@gmail.com');
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  const prevOpenAiKey = process.env.OPENAI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-dummy-gemini-key-for-routing-12345';
  process.env.OPENAI_API_KEY = 'sk-test-dummy-openai-key-for-routing-12345';

  let callsOrder: string[] = [];
  setAdapterInvokerForTests(async ({ model }) => {
    callsOrder.push(model.providerId);
    if (model.providerId === 'gemini') {
      throw new Error('503 PRIMARY_GEMINI_DOWN');
    }
    return {
      text: 'Respuesta exitosa mediante respaldo automático.',
      inputTokens: 120,
      outputTokens: 80,
    };
  });

  const gwFailoverResult = await executeGatewayChat({
    userId: errUser.uid,
    userEmail: errUser.email,
    planTier: 'premium',
    prompt: 'Explicá el principio de legalidad',
    routingMode: 'manual',
    requestedProviderId: 'gemini',
    requestedModelId: 'gemini__gemini-3.1-flash-lite',
  });

  setAdapterInvokerForTests(null);
  if (prevGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = prevGeminiKey;
  if (prevOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = prevOpenAiKey;

  assert.equal(gwFailoverResult.fallbackUsed, true);
  assert.equal(callsOrder[0], 'gemini');
  assert.ok(callsOrder.length >= 2, 'Debe intentar respaldo secundario al fallar el primario');
  assert.equal(gwFailoverResult.providerId, 'openai');
  console.log('✓ Test 5 PASSED: Cambio automático de proveedor (failover) cuando el primario falla.');

  // ------------------------------------------------------------------
  // TEST 6: HTTP Security (401 unauthenticated, zero key leaks, error refunds)
  // ------------------------------------------------------------------
  setTestTokenVerifierForTests(async (tok) => {
    if (tok === 'valid-free-user') {
      return {
        uid: 'http_user_1',
        email: 'http1@fabro.test',
        displayName: 'HTTP Test',
        emailVerified: true,
        isSuperAdmin: false,
        isAdmin: false,
      };
    }
    return null;
  });

  const testApp = express();
  testApp.use(express.json());
  testApp.use('/api/ai', freemiumAiGuardMiddleware);
  testApp.post('/api/ai/mock-fail', (_req, res) => {
    res.status(503).json({ error: 'Proveedor caído temporalmente' });
  });
  testApp.post('/api/ai/mock-ok', (_req, res) => {
    res.json({ reply: 'Respuesta académica ok', providerUsed: 'gemini' });
  });

  const server = http.createServer(testApp);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Unauthenticated call -> 401
    const rUnauth = await fetch(`${baseUrl}/api/ai/mock-ok`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hola' }),
    });
    assert.equal(rUnauth.status, 401);

    // Authenticated call that fails internally (503) -> does not consume quota
    const rFail = await fetch(`${baseUrl}/api/ai/mock-fail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-free-user',
      },
      body: JSON.stringify({ message: 'hola' }),
    });
    assert.equal(rFail.status, 503);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(getUserFreemiumStatus('http_user_1', 'http1@fabro.test').usedToday, 0);

    // Grant extra credit & verify it works
    const cr = grantUserCreditsAdmin({ uid: 'http_user_1', delta: 2, note: 'Bono test' });
    assert.equal(cr.balance, 2);

    // Authenticated success -> consumes 1 query & attaches X-Fabro-Quota
    const rOk = await fetch(`${baseUrl}/api/ai/mock-ok`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-free-user',
      },
      body: JSON.stringify({ message: 'hola' }),
    });
    assert.equal(rOk.status, 200);
    const quotaHeader = rOk.headers.get('x-fabro-quota') || '';
    assert.ok(quotaHeader.includes('"usedToday":1'));
    const bodyText = await rOk.text();
    assert.ok(!bodyText.includes('AIza') && !bodyText.includes('sk-'));

    const budgetNow = getBudgetStatusSnapshot();
    assert.ok(budgetNow.monthCostUsd >= 30);
  } finally {
    setTestTokenVerifierForTests(null);
    server.close();
  }

  await flushFreemiumStoreForTests();
  console.log('✓ Test 6 PASSED: Autenticación obligatoria, cero filtración de claves, header X-Fabro-Quota y créditos extra.');
  console.log('\nALL 6 FREEMIUM & COST-CONTROL TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('TEST FAILURE:', err);
  process.exit(1);
});
