import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import {
  resetAntiSpamWindowsForTests,
  setTestTokenVerifierForTests,
} from './authMiddleware.ts';
import { createConnectRouter } from './connectRouter.ts';
import {
  getConnectProviderCatalog,
  resetConnectStoreForTests,
  sanitizeSecretFromText,
} from './connectStore.ts';
import {
  getUserFreemiumStatus,
  resetFreemiumStoreInMemory,
  setFreemiumStorePathForTests,
} from './freemiumStore.ts';

async function runTests() {
  const tmpConnectStore = path.join(os.tmpdir(), `fabro-connect-test-${Date.now()}.json`);
  const tmpFreemiumStore = path.join(os.tmpdir(), `fabro-connect-freemium-${Date.now()}.json`);
  resetConnectStoreForTests(tmpConnectStore);
  setFreemiumStorePathForTests(tmpFreemiumStore);
  resetFreemiumStoreInMemory();
  resetAntiSpamWindowsForTests();

  const VALID_SECRET_A = 'sk-personal-userA-secret-99887766';
  const INVALID_SECRET = 'sk-invalid-bad-key-00001111';
  const VALID_SECRET_B = 'sk-personal-userB-secret-55443322';
  const ADMIN_SECRET = 'sk-admin-should-never-be-sent';
  process.env.GEMINI_API_KEY = ADMIN_SECRET;

  // Ephemeral local mock AI provider server verifying exact Authorization headers
  const observedAuthHeaders: string[] = [];
  let forceProviderFailure = false;

  const mockProviderServer = http.createServer((req, res) => {
    const authHeader = String(req.headers.authorization || '');
    observedAuthHeaders.push(authHeader);

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (forceProviderFailure) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: {
              message: `Upstream failure for key ${authHeader.replace('Bearer ', '')}`,
            },
          })
        );
        return;
      }

      if (authHeader === `Bearer ${VALID_SECRET_A}` || authHeader === `Bearer ${VALID_SECRET_B}`) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: `Respuesta personal verificada (${authHeader.slice(-6)})`,
                },
              },
            ],
            usage: { prompt_tokens: 24, completion_tokens: 18 },
          })
        );
        return;
      }

      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: {
            message: `Invalid API key provided: ${authHeader.replace('Bearer ', '')}`,
          },
        })
      );
    });
  });

  await new Promise<void>((resolve) => mockProviderServer.listen(0, '127.0.0.1', () => resolve()));
  const mockAddr = mockProviderServer.address() as { port: number };
  const mockEndpoint = `http://127.0.0.1:${mockAddr.port}/v1`;

  // Mock Firebase Auth tokens for User A and User B
  setTestTokenVerifierForTests(async (token) => {
    if (token === 'token-user-a') {
      return {
        uid: 'uid_connect_user_a',
        email: 'usera@fabro.test',
        displayName: 'Estudiante A',
        emailVerified: true,
        isSuperAdmin: false,
        isAdmin: false,
      };
    }
    if (token === 'token-user-b') {
      return {
        uid: 'uid_connect_user_b',
        email: 'userb@fabro.test',
        displayName: 'Estudiante B',
        emailVerified: true,
        isSuperAdmin: false,
        isAdmin: false,
      };
    }
    return null;
  });

  const app = express();
  app.use(express.json());
  app.use('/api/connect', createConnectRouter({ allowLocalEndpointsForTests: true }));

  const apiServer = http.createServer(app);
  await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', () => resolve()));
  const apiAddr = apiServer.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${apiAddr.port}/api/connect`;

  try {
    // Catalog sanity check: expanded multi-provider BYOK catalog
    const catalog = getConnectProviderCatalog();
    assert.ok(catalog.length >= 7, 'FABRO Connect debe incluir OpenAI, Gemini, Claude, DeepSeek, Qwen, Mistral y Grok');
    const openaiEntry = catalog.find((c) => c.id === 'openai');
    const geminiEntry = catalog.find((c) => c.id === 'gemini');
    assert.ok(openaiEntry, 'ChatGPT / OpenAI debe figurar en el catálogo');
    assert.equal(openaiEntry.officialUrl, 'https://chatgpt.com/');
    assert.ok(geminiEntry, 'Google Gemini debe figurar en el catálogo');
    assert.equal(geminiEntry.officialUrl, 'https://gemini.google.com/');
    assert.ok(catalog.some((c) => c.id === 'claude'), 'Claude debe figurar en el catálogo');
    assert.ok(catalog.some((c) => c.id === 'deepseek'), 'DeepSeek debe figurar en el catálogo');

    // ------------------------------------------------------------------
    // 1. Valid personal API key passes live probe & saves encrypted
    // ------------------------------------------------------------------
    const saveValidResp = await fetch(`${baseUrl}/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-a',
      },
      body: JSON.stringify({
        providerId: 'openai',
        label: 'Mi ChatGPT Personal A',
        apiKey: VALID_SECRET_A,
        endpointUrl: mockEndpoint,
        selectedModel: 'gpt-4o-mini',
        isDefault: true,
        dailyRequestLimit: 2,
      }),
    });
    assert.equal(saveValidResp.status, 200);
    const saveValidJson = (await saveValidResp.json()) as {
      verified: boolean;
      connection: { id: string; status: string; lastTestStatus: string; maskedKey: string };
    };
    assert.equal(saveValidJson.verified, true);
    assert.equal(saveValidJson.connection.status, 'connected');
    assert.equal(saveValidJson.connection.lastTestStatus, 'verified');
    assert.ok(!saveValidJson.connection.maskedKey.includes(VALID_SECRET_A), 'No debe exponer la clave plana');
    const connIdA = saveValidJson.connection.id;
    console.log('✓ Test 1 PASSED: API Key personal válida supera prueba real y se guarda cifrada.');

    // ------------------------------------------------------------------
    // 2. Invalid API key fails probe and is NOT saved as connected
    // ------------------------------------------------------------------
    const saveInvalidResp = await fetch(`${baseUrl}/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-a',
      },
      body: JSON.stringify({
        providerId: 'openai',
        label: 'Clave Inválida',
        apiKey: INVALID_SECRET,
        endpointUrl: mockEndpoint,
        selectedModel: 'gpt-4o-mini',
      }),
    });
    assert.equal(saveInvalidResp.status, 400);
    const saveInvalidJson = (await saveInvalidResp.json()) as { verified: boolean; error: string };
    assert.equal(saveInvalidJson.verified, false);
    assert.ok(!saveInvalidJson.error.includes(INVALID_SECRET), 'El mensaje de error no debe filtrar la key');
    console.log('✓ Test 2 PASSED: API Key inválida rechazada sin guardarse como "Conectada".');

    // ------------------------------------------------------------------
    // 3. Connect -> Disconnect -> Reconnect / Delete lifecycle
    // ------------------------------------------------------------------
    const saveTempResp = await fetch(`${baseUrl}/connections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-a',
      },
      body: JSON.stringify({
        providerId: 'openai',
        label: 'Conexión Temporal',
        apiKey: VALID_SECRET_A,
        endpointUrl: mockEndpoint,
        selectedModel: 'gpt-4o',
      }),
    });
    assert.equal(saveTempResp.status, 200);
    const tempId = ((await saveTempResp.json()) as { connection: { id: string } }).connection.id;

    const discResp = await fetch(`${baseUrl}/connections/${tempId}/disconnect`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-user-a' },
    });
    assert.equal(discResp.status, 200);
    const discJson = (await discResp.json()) as { connection: { status: string } };
    assert.equal(discJson.connection.status, 'disconnected');

    // Attempt chat on disconnected connection must be rejected
    const chatDiscResp = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-a',
      },
      body: JSON.stringify({ connectionId: tempId, prompt: 'Hola' }),
    });
    assert.equal(chatDiscResp.status, 400);

    const delResp = await fetch(`${baseUrl}/connections/${tempId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-user-a' },
    });
    assert.equal(delResp.status, 200);
    console.log('✓ Test 3 PASSED: Ciclo completo conectar -> desconectar -> bloquear uso -> eliminar.');

    // ------------------------------------------------------------------
    // 4. Cross-user isolation (User B cannot access/use/delete User A)
    // ------------------------------------------------------------------
    const listB = await fetch(`${baseUrl}/connections`, {
      headers: { Authorization: 'Bearer token-user-b' },
    });
    const listBJson = (await listB.json()) as { connections: Array<{ id: string }> };
    assert.equal(listBJson.connections.length, 0);

    const stealChat = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-b',
      },
      body: JSON.stringify({ connectionId: connIdA, prompt: 'Intentar usar key ajena' }),
    });
    assert.equal(stealChat.status, 404);

    const stealDelete = await fetch(`${baseUrl}/connections/${connIdA}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-user-b' },
    });
    assert.equal(stealDelete.status, 404);
    console.log('✓ Test 4 PASSED: Aislamiento estricto entre usuarios (User B bloqueado con 404).');

    // ------------------------------------------------------------------
    // 5. Exclusive personal execution: sends ONLY user A key, NEVER admin key
    // ------------------------------------------------------------------
    observedAuthHeaders.length = 0;
    const chatAResp = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-a',
      },
      body: JSON.stringify({
        connectionId: connIdA,
        prompt: 'Explicá brevemente qué es la hermenéutica.',
      }),
    });
    assert.equal(chatAResp.status, 200);
    const chatAJson = (await chatAResp.json()) as {
      billingOwner: string;
      fabroQuotaConsumed: boolean;
      text: string;
    };
    assert.equal(chatAJson.billingOwner, 'personal');
    assert.equal(chatAJson.fabroQuotaConsumed, false);
    assert.equal(observedAuthHeaders[0], `Bearer ${VALID_SECRET_A}`);
    assert.ok(!observedAuthHeaders.some((h) => h.includes(ADMIN_SECRET)), 'Jamás debe enviarse la clave admin');
    console.log('✓ Test 5 PASSED: Ejecución exclusiva con credencial personal del estudiante.');

    // ------------------------------------------------------------------
    // 6. Failure handling: NO silent fallback to admin key; requests explicit approval
    // ------------------------------------------------------------------
    forceProviderFailure = true;
    const failChatResp = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-a',
      },
      body: JSON.stringify({
        connectionId: connIdA,
        prompt: 'Consulta durante caída del proveedor personal',
      }),
    });
    forceProviderFailure = false;
    assert.equal(failChatResp.status, 502);
    const failChatJson = (await failChatResp.json()) as {
      requiresUserSwitchApproval: boolean;
      error: string;
    };
    assert.equal(failChatJson.requiresUserSwitchApproval, true);
    assert.ok(!failChatJson.error.includes(VALID_SECRET_A), 'El fallo no debe filtrar el secreto');
    console.log('✓ Test 6 PASSED: Sin fallback silencioso; solicita aprobación explícita ante error.');

    // ------------------------------------------------------------------
    // 7. Freemium isolation: personal chat leaves FABRO daily quota at 0/5
    // ------------------------------------------------------------------
    const freemiumAfterPersonal = getUserFreemiumStatus('uid_connect_user_a', 'usera@fabro.test');
    assert.equal(freemiumAfterPersonal.usedToday, 0);
    assert.equal(freemiumAfterPersonal.remainingToday, 5);
    console.log('✓ Test 7 PASSED: Uso personal NO consume el límite diario gratuito de FABRO (0/5).');

    // ------------------------------------------------------------------
    // 8. Personal daily request limit blocks excess requests cleanly
    // ------------------------------------------------------------------
    // Note: connection A has dailyRequestLimit: 2; 1 successful query was made in Test 5.
    const secondOk = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-a',
      },
      body: JSON.stringify({ connectionId: connIdA, prompt: 'Segunda consulta personal permitida' }),
    });
    assert.equal(secondOk.status, 200);

    const thirdBlocked = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-user-a',
      },
      body: JSON.stringify({ connectionId: connIdA, prompt: 'Tercera consulta excede límite personal' }),
    });
    assert.equal(thirdBlocked.status, 429);
    const thirdJson = (await thirdBlocked.json()) as { code: string; requiresUserSwitchApproval: boolean };
    assert.equal(thirdJson.code, 'PERSONAL_LIMIT_REACHED');
    assert.equal(thirdJson.requiresUserSwitchApproval, true);
    console.log('✓ Test 8 PASSED: Límite diario personal opcional bloquea excedentes sin tocar cuota FABRO.');

    // ------------------------------------------------------------------
    // 9. Secret leakage audit across store disk file, DTOs, and sanitizer
    // ------------------------------------------------------------------
    const listA = await fetch(`${baseUrl}/connections`, {
      headers: { Authorization: 'Bearer token-user-a' },
    });
    const listARawText = await listA.text();
    assert.ok(!listARawText.includes(VALID_SECRET_A), 'GET /connections no debe contener la key en texto plano');

    const diskContent = fs.readFileSync(tmpConnectStore, 'utf8');
    assert.ok(!diskContent.includes(VALID_SECRET_A), 'El archivo persistido debe almacenar la key cifrada con AES-256-GCM');

    const sanitized = sanitizeSecretFromText(`Bad key ${VALID_SECRET_A}`, VALID_SECRET_A);
    assert.ok(!sanitized.includes(VALID_SECRET_A));
    console.log('✓ Test 9 PASSED: Auditoría de cifrado y cero filtración de secretos en DTOs/disco/errores.');

    // ------------------------------------------------------------------
    // 10. Differentiated personal vs FABRO billing summary & logs
    // ------------------------------------------------------------------
    const listAData = JSON.parse(listARawText) as {
      personalUsage: {
        queriesToday: number;
        recentLogs: Array<{ billingOwner: string; status: string }>;
      };
      fabroBillingSummary: { usedToday: number; dailyLimit: number; remainingToday: number };
    };
    assert.equal(listAData.personalUsage.queriesToday, 2);
    assert.ok(listAData.personalUsage.recentLogs.every((l) => l.billingOwner === 'personal'));
    assert.equal(listAData.fabroBillingSummary.usedToday, 0);
    assert.equal(listAData.fabroBillingSummary.remainingToday, 5);
    console.log('✓ Test 10 PASSED: Registro diferenciado CONSUMO PERSONAL vs CONSUMO FABRO verificado.');
  } finally {
    setTestTokenVerifierForTests(null);
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
    await new Promise<void>((resolve) => mockProviderServer.close(() => resolve()));
    try {
      if (fs.existsSync(tmpConnectStore)) fs.unlinkSync(tmpConnectStore);
      if (fs.existsSync(tmpFreemiumStore)) fs.unlinkSync(tmpFreemiumStore);
    } catch {
      // ignore cleanup errors
    }
  }
}

runTests()
  .then(() => {
    console.log('\nTodos los 10 tests de FABRO CONNECT pasaron correctamente.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fallo en tests de FABRO CONNECT:', err);
    process.exit(1);
  });
