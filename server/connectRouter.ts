import { GoogleGenAI } from '@google/genai';
import express, { type Response } from 'express';
import {
  checkAntiSpamWindow,
  getClientIp,
  requireAuth,
  type AuthenticatedRequest,
} from './authMiddleware.ts';
import {
  checkPersonalConnectionLimit,
  consumeOAuthPkceSession,
  createOAuthPkceSession,
  decryptSecret,
  deleteOwnedConnection,
  disconnectOwnedConnection,
  getConnectProviderCatalog,
  getDefaultOwnedConnectionInternal,
  getOwnedConnectionInternal,
  getUserPersonalUsageSummary,
  isChatGptOAuthConfigured,
  listUserConnectionsDTO,
  recordPersonalUsage,
  sanitizeSecretFromText,
  updateOwnedConnectionMeta,
  upsertPersonalConnection,
  type ConnectProviderId,
} from './connectStore.ts';
import { getUserFreemiumStatus } from './freemiumStore.ts';

function normalizeBaseUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

function isAllowedEndpointUrl(url: string, allowLocalForTests = false): boolean {
  const clean = normalizeBaseUrl(url);
  if (!clean) return false;
  try {
    const parsed = new URL(clean);
    if (allowLocalForTests) {
      return (
        parsed.protocol === 'https:' ||
        (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))
      );
    }
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface PersonalCallOutput {
  text: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  modelUsed: string;
}

export async function callProviderWithPersonalSecret(params: {
  providerId: ConnectProviderId;
  endpointUrl: string;
  model: string;
  personalSecret: string;
  prompt: string;
  systemInstruction?: string;
  history?: Array<{ role: 'user' | 'model' | 'assistant'; text: string }>;
  maxTokens?: number;
}): Promise<PersonalCallOutput> {
  const startedAt = Date.now();
  const baseUrl = normalizeBaseUrl(params.endpointUrl);
  const maxTokens = Math.max(8, Math.min(8192, params.maxTokens || 2048));

  // STRICT ISOLATION: Never fall back to process.env admin keys!
  if (!params.personalSecret.trim()) {
    throw new Error('La conexión personal no tiene una credencial activa configurada.');
  }

  if (params.providerId === 'gemini') {
    // Use ONLY the student's personal Gemini API key
    const ai = new GoogleGenAI({ apiKey: params.personalSecret.trim() });
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const msg of (params.history || []).slice(-12)) {
      if (!msg.text?.trim()) continue;
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text.slice(0, 8000) }],
      });
    }
    contents.push({ role: 'user', parts: [{ text: params.prompt }] });

    try {
      const resp = await ai.models.generateContent({
        model: params.model || 'gemini-2.5-flash',
        contents,
        config: {
          ...(params.systemInstruction ? { systemInstruction: params.systemInstruction } : {}),
          maxOutputTokens: maxTokens,
        },
      });
      const text = (resp.text || '').trim();
      if (!text) throw new Error('Google Gemini no devolvió texto para tu solicitud.');
      const inTok = resp.usageMetadata?.promptTokenCount || Math.max(1, Math.ceil(params.prompt.length / 4));
      const outTok = resp.usageMetadata?.candidatesTokenCount || Math.max(1, Math.ceil(text.length / 4));
      return {
        text,
        inputTokens: inTok,
        outputTokens: outTok,
        estimatedCostUsd: 0, // Personal quota / Google AI Studio billing
        latencyMs: Date.now() - startedAt,
        modelUsed: params.model || 'gemini-2.5-flash',
      };
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      throw new Error(sanitizeSecretFromText(raw, params.personalSecret));
    }
  }

  if (params.providerId === 'claude') {
    const messagesPayload: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const h of (params.history || []).slice(-12)) {
      if (!h.text?.trim()) continue;
      messagesPayload.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text.slice(0, 8000),
      });
    }
    messagesPayload.push({ role: 'user', content: params.prompt });

    const endpointPath = baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl}/messages`;
    const resp = await fetch(endpointPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.personalSecret.trim(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: maxTokens,
        ...(params.systemInstruction ? { system: params.systemInstruction } : {}),
        messages: messagesPayload,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const json = (await resp.json().catch(() => ({}))) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      error?: { message?: string };
    };

    if (!resp.ok) {
      const rawMsg = json.error?.message || `Anthropic Claude rechazó la solicitud (HTTP ${resp.status}).`;
      throw new Error(sanitizeSecretFromText(rawMsg, params.personalSecret));
    }

    const text = (json.content || [])
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) {
      throw new Error('Anthropic Claude respondió sin contenido.');
    }

    return {
      text,
      inputTokens: json.usage?.input_tokens || Math.max(1, Math.ceil(params.prompt.length / 4)),
      outputTokens: json.usage?.output_tokens || Math.max(1, Math.ceil(text.length / 4)),
      estimatedCostUsd: 0,
      latencyMs: Date.now() - startedAt,
      modelUsed: params.model,
    };
  }

  // OpenAI & OpenAI-compatible path (OpenAI, DeepSeek, Qwen, Mistral, Grok)
  const messagesPayload: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (params.systemInstruction) {
    messagesPayload.push({ role: 'system', content: params.systemInstruction });
  }
  for (const h of (params.history || []).slice(-12)) {
    if (!h.text?.trim()) continue;
    messagesPayload.push({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text.slice(0, 8000),
    });
  }
  messagesPayload.push({ role: 'user', content: params.prompt });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${params.personalSecret.trim()}`,
  };

  const endpointPath = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const resp = await fetch(endpointPath, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: params.model,
      messages: messagesPayload,
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(45_000),
  });

  const json = (await resp.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string; code?: string };
    message?: string;
  };

  if (!resp.ok) {
    const rawMsg =
      json.error?.message ||
      json.message ||
      `El proveedor ${params.providerId} rechazó la solicitud (HTTP ${resp.status}).`;
    throw new Error(sanitizeSecretFromText(rawMsg, params.personalSecret));
  }

  const text = (json.choices?.[0]?.message?.content || '').trim();
  if (!text) {
    throw new Error(`El proveedor ${params.providerId} respondió sin contenido.`);
  }

  const inTok = json.usage?.prompt_tokens || Math.max(1, Math.ceil(params.prompt.length / 4));
  const outTok = json.usage?.completion_tokens || Math.max(1, Math.ceil(text.length / 4));

  return {
    text,
    inputTokens: inTok,
    outputTokens: outTok,
    estimatedCostUsd: 0, // Personal provider invoice / wallet
    latencyMs: Date.now() - startedAt,
    modelUsed: params.model,
  };
}

export function createConnectRouter(options?: { allowLocalEndpointsForTests?: boolean }): express.Router {
  const router = express.Router();
  const allowLocalForTests = Boolean(options?.allowLocalEndpointsForTests);

  // Public catalog describing available providers (ChatGPT & Google Gemini), OAuth eligibility, and billing clarity
  router.get('/catalog', (_req, res) => {
    res.json({
      providers: getConnectProviderCatalog(),
      chatgptOAuthConfigured: isChatGptOAuthConfigured(),
    });
  });

  // Protected: list ONLY the signed-in user's personal connections + separated personal vs FABRO billing summary
  router.get('/connections', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const u = req.authUser!;
    const connections = listUserConnectionsDTO(u.uid);
    const personalUsage = getUserPersonalUsageSummary(u.uid);
    const fabroStatus = getUserFreemiumStatus(u.uid, u.email, u.displayName);
    res.json({
      connections,
      personalUsage,
      fabroBillingSummary: {
        planLabel: fabroStatus.planLabel,
        usedToday: fabroStatus.usedToday,
        dailyLimit: fabroStatus.dailyLimit,
        remainingToday: fabroStatus.remainingToday,
      },
    });
  });

  // Protected: real live test of raw personal key OR an existing saved connection owned by the user
  router.post('/connections/test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const u = req.authUser!;
    const body = req.body ?? {};
    const connectionId = typeof body.connectionId === 'string' ? body.connectionId.trim() : '';

    let providerId = body.providerId as ConnectProviderId;
    let endpointUrl = typeof body.endpointUrl === 'string' ? body.endpointUrl.trim() : '';
    let selectedModel = typeof body.selectedModel === 'string' ? body.selectedModel.trim() : '';
    let rawSecret = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    let existingId = '';

    if (connectionId) {
      const owned = getOwnedConnectionInternal(u.uid, connectionId);
      if (!owned) {
        res.status(404).json({ error: 'Conexión personal no encontrada para tu usuario.' });
        return;
      }
      existingId = owned.id;
      providerId = owned.providerId;
      endpointUrl = endpointUrl || owned.endpointUrl;
      selectedModel = selectedModel || owned.selectedModel;
      rawSecret = rawSecret || decryptSecret(owned.encryptedSecret);
    }

    const catalog = getConnectProviderCatalog();
    const def = catalog.find((p) => p.id === providerId);
    if (!def) {
      res.status(400).json({ error: 'Proveedor no reconocido.' });
      return;
    }

    const effectiveEndpoint = endpointUrl || def.defaultEndpoint;
    const effectiveModel = selectedModel || def.defaultModel;
    if (!isAllowedEndpointUrl(effectiveEndpoint, allowLocalForTests)) {
      res.status(400).json({ error: 'El endpoint debe usar HTTPS válido.' });
      return;
    }

    try {
      const result = await callProviderWithPersonalSecret({
        providerId,
        endpointUrl: effectiveEndpoint,
        model: effectiveModel,
        personalSecret: rawSecret,
        prompt: 'Respondé únicamente con la palabra: OK',
        maxTokens: 16,
      });

      if (existingId) {
        await updateOwnedConnectionMeta(u.uid, existingId, {
          status: 'connected',
          lastTestStatus: 'verified',
          lastTestedAt: new Date().toISOString(),
          lastError: '',
        });
      }

      res.json({
        ok: true,
        verified: true,
        providerId,
        modelTested: result.modelUsed,
        latencyMs: result.latencyMs,
        message: `Conexión verificada con ${def.name} (${result.modelUsed}) en ${result.latencyMs} ms.`,
      });
    } catch (err) {
      const safeErr = sanitizeSecretFromText(
        err instanceof Error ? err.message : 'Fallo al verificar la credencial.',
        rawSecret
      );
      if (existingId) {
        await updateOwnedConnectionMeta(u.uid, existingId, {
          status: 'error',
          lastTestStatus: 'failed',
          lastTestedAt: new Date().toISOString(),
          lastError: safeErr,
        });
      }
      res.status(400).json({
        ok: false,
        verified: false,
        error: safeErr,
      });
    }
  });

  // Protected: Save BYOK personal connection ONLY after real live verification succeeds
  router.post('/connections', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const u = req.authUser!;
    const body = req.body ?? {};
    const providerId = body.providerId as ConnectProviderId;
    const catalog = getConnectProviderCatalog();
    const def = catalog.find((p) => p.id === providerId);
    if (!def) {
      res.status(400).json({ error: 'Proveedor no compatible.' });
      return;
    }

    const rawApiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const existingId = typeof body.id === 'string' ? body.id.trim() : '';
    const existingOwned = existingId ? getOwnedConnectionInternal(u.uid, existingId) : null;
    if (existingId && !existingOwned) {
      res.status(404).json({ error: 'Conexión no encontrada para este usuario.' });
      return;
    }

    const secretToUse = rawApiKey || (existingOwned ? decryptSecret(existingOwned.encryptedSecret) : '');
    if (!secretToUse) {
      res.status(400).json({ error: 'Ingresá tu API Key personal para conectar este proveedor.' });
      return;
    }

    const endpointUrl = normalizeBaseUrl(
      typeof body.endpointUrl === 'string' && body.endpointUrl.trim()
        ? body.endpointUrl
        : existingOwned?.endpointUrl || def.defaultEndpoint
    );
    if (!isAllowedEndpointUrl(endpointUrl, allowLocalForTests)) {
      res.status(400).json({ error: 'URL de endpoint inválida. Debe usar HTTPS válido.' });
      return;
    }

    const selectedModel = String(body.selectedModel || existingOwned?.selectedModel || def.defaultModel).trim().slice(0, 120);
    const label = String(body.label || existingOwned?.label || `${def.shortName} Personal`).trim().slice(0, 80);

    // Mandatory live test before marking as connected!
    try {
      await callProviderWithPersonalSecret({
        providerId,
        endpointUrl,
        model: selectedModel,
        personalSecret: secretToUse,
        prompt: 'Respondé únicamente con la palabra: OK',
        maxTokens: 16,
      });
    } catch (err) {
      const safeErr = sanitizeSecretFromText(
        err instanceof Error ? err.message : 'No se pudo validar la API Key con el proveedor.',
        secretToUse
      );
      res.status(400).json({
        error: `No se guardó como conectada porque la prueba real falló: ${safeErr}`,
        verified: false,
      });
      return;
    }

    const saved = await upsertPersonalConnection({
      id: existingOwned?.id,
      uid: u.uid,
      providerId,
      providerName: def.name,
      label,
      authMethod: 'byok',
      rawSecret: rawApiKey,
      endpointUrl,
      regionId: typeof body.regionId === 'string' ? body.regionId.slice(0, 60) : existingOwned?.regionId,
      selectedModel,
      verified: true,
      isDefault: Boolean(body.isDefault),
      dailyRequestLimit:
        typeof body.dailyRequestLimit === 'number' ? body.dailyRequestLimit : existingOwned?.dailyRequestLimit || 0,
      monthlyBudgetAlertUsd:
        typeof body.monthlyBudgetAlertUsd === 'number'
          ? body.monthlyBudgetAlertUsd
          : existingOwned?.monthlyBudgetAlertUsd || 0,
    });

    res.json({ connection: saved, verified: true });
  });

  // Protected: Update model, label, personal daily limit, or default status
  router.patch('/connections/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const u = req.authUser!;
    const id = String(req.params.id || '').trim();
    const owned = getOwnedConnectionInternal(u.uid, id);
    if (!owned) {
      res.status(404).json({ error: 'Conexión no encontrada.' });
      return;
    }
    const body = req.body ?? {};
    if (typeof body.endpointUrl === 'string' && body.endpointUrl.trim()) {
      if (!isAllowedEndpointUrl(body.endpointUrl, allowLocalForTests)) {
        res.status(400).json({ error: 'URL de endpoint inválida.' });
        return;
      }
    }
    const updated = await updateOwnedConnectionMeta(u.uid, id, {
      ...(typeof body.label === 'string' ? { label: body.label } : {}),
      ...(typeof body.selectedModel === 'string' ? { selectedModel: body.selectedModel } : {}),
      ...(typeof body.endpointUrl === 'string' ? { endpointUrl: normalizeBaseUrl(body.endpointUrl) } : {}),
      ...(typeof body.regionId === 'string' ? { regionId: body.regionId } : {}),
      ...(typeof body.isDefault === 'boolean' ? { isDefault: body.isDefault } : {}),
      ...(typeof body.dailyRequestLimit === 'number' ? { dailyRequestLimit: body.dailyRequestLimit } : {}),
      ...(typeof body.monthlyBudgetAlertUsd === 'number' ? { monthlyBudgetAlertUsd: body.monthlyBudgetAlertUsd } : {}),
    });
    res.json({ connection: updated });
  });

  // Protected: Disconnect (revoke active connection without losing config or forcing delete)
  router.post('/connections/:id/disconnect', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const u = req.authUser!;
    const updated = await disconnectOwnedConnection(u.uid, String(req.params.id || '').trim());
    if (!updated) {
      res.status(404).json({ error: 'Conexión no encontrada.' });
      return;
    }
    res.json({ connection: updated });
  });

  // Protected: Permanently delete saved encrypted API key & connection
  router.delete('/connections/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const u = req.authUser!;
    const deleted = await deleteOwnedConnection(u.uid, String(req.params.id || '').trim());
    if (!deleted) {
      res.status(404).json({ error: 'Conexión no encontrada.' });
      return;
    }
    res.json({ ok: true });
  });

  // -------------------------------------------------------------------------
  // Sign in with ChatGPT — Real OAuth 2.0 + PKCE (Only when configured)
  // -------------------------------------------------------------------------
  router.get('/oauth/chatgpt/start', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const clientId = (process.env.OPENAI_CHATGPT_OAUTH_CLIENT_ID || '').trim();
    if (!clientId) {
      res.status(501).json({
        oauthConfigured: false,
        error:
          'Sign in with ChatGPT requiere un Client ID autorizado por OpenAI (OPENAI_CHATGPT_OAUTH_CLIENT_ID) para aplicaciones web alojadas. Podés conectar ahora mismo tu API Key personal de OpenAI (BYOK) o abrir ChatGPT en el Visor Web.',
      });
      return;
    }

    const origin = `${req.protocol}://${req.get('host')}`;
    const redirectUri = (process.env.OPENAI_CHATGPT_OAUTH_REDIRECT_URI || `${origin}/api/connect/oauth/chatgpt/callback`).trim();
    const { state, codeChallenge } = createOAuthPkceSession(req.authUser!.uid, redirectUri);

    const authUrl = new URL('https://auth.openai.com/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email offline_access');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    res.json({
      oauthConfigured: true,
      authorizeUrl: authUrl.toString(),
    });
  });

  router.get('/oauth/chatgpt/callback', async (req, res) => {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const errParam = String(req.query.error || '');

    if (errParam) {
      res.status(400).send(`Autorización ChatGPT cancelada o rechazada: ${errParam}`);
      return;
    }

    const session = consumeOAuthPkceSession(state);
    const clientId = (process.env.OPENAI_CHATGPT_OAUTH_CLIENT_ID || '').trim();
    if (!session || !code || !clientId) {
      res.status(400).send('Sesión PKCE expirada o inválida.');
      return;
    }

    try {
      const tokenResp = await fetch('https://auth.openai.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          code,
          redirect_uri: session.redirectUri,
          code_verifier: session.codeVerifier,
          ...(process.env.OPENAI_CHATGPT_OAUTH_CLIENT_SECRET
            ? { client_secret: process.env.OPENAI_CHATGPT_OAUTH_CLIENT_SECRET }
            : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      const tokenJson = (await tokenResp.json().catch(() => ({}))) as {
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
        scope?: string;
        error_description?: string;
      };

      if (!tokenResp.ok || !tokenJson.access_token) {
        res.status(400).send(tokenJson.error_description || 'No se pudo completar el intercambio OAuth con OpenAI.');
        return;
      }

      let emailFromIdToken = '';
      if (tokenJson.id_token && tokenJson.id_token.includes('.')) {
        try {
          const payloadB64 = tokenJson.id_token.split('.')[1];
          const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as { email?: string };
          emailFromIdToken = String(parsed.email || '');
        } catch {
          // ignore malformed id_token claim
        }
      }

      const hasPlanScope = String(tokenJson.scope || '').includes('chatgpt.tokens.use');
      await upsertPersonalConnection({
        uid: session.uid,
        providerId: 'openai',
        providerName: 'ChatGPT (Sign in with ChatGPT)',
        label: emailFromIdToken ? `ChatGPT · ${emailFromIdToken}` : 'ChatGPT OAuth',
        authMethod: 'oauth_pkce',
        rawSecret: tokenJson.access_token,
        rawRefreshToken: tokenJson.refresh_token,
        endpointUrl: 'https://api.openai.com/v1',
        selectedModel: 'gpt-4o-mini',
        verified: true,
        oauthAccountEmail: emailFromIdToken || undefined,
        oauthPlanScope: hasPlanScope ? 'plan_usage' : 'identity_only',
      });

      res.send(
        '<!doctype html><html><body style="font-family:sans-serif;background:#090D16;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;"><div><h2>Cuenta ChatGPT conectada correctamente</h2><p>Podés cerrar esta ventana y volver a FABRO.</p><script>if(window.opener){window.opener.postMessage({type:"fabro:oauth-connected",provider:"openai"},"*");}</script></div></body></html>'
      );
    } catch {
      res.status(500).send('Error al conectar con el servidor OAuth de OpenAI.');
    }
  });

  // -------------------------------------------------------------------------
  // Exclusive Personal AI Chat (NEVER touches FABRO 5/day free quota or Admin API keys!)
  // -------------------------------------------------------------------------
  router.post('/chat', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const u = req.authUser!;
    const userSpam = checkAntiSpamWindow(`connect:${u.uid}`, 20);
    if (!userSpam.allowed) {
      res.status(429).json({
        error: `Demasiadas solicitudes personales seguidas. Esperá ${userSpam.retryAfterSec} segundos.`,
        code: 'RATE_LIMIT_PERSONAL',
      });
      return;
    }
    const ipSpam = checkAntiSpamWindow(`connect_ip:${getClientIp(req)}`, 40);
    if (!ipSpam.allowed) {
      res.status(429).json({ error: 'Límite temporal de tráfico alcanzado.', code: 'RATE_LIMIT_IP' });
      return;
    }

    const body = req.body ?? {};
    const prompt = String(body.prompt || '').trim().slice(0, 60000);
    if (!prompt) {
      res.status(400).json({ error: 'Escribí una consulta para enviar a tu IA personal.' });
      return;
    }

    const requestedConnId = typeof body.connectionId === 'string' ? body.connectionId.trim() : '';
    const requestedProviderId = typeof body.providerId === 'string' ? (body.providerId as ConnectProviderId) : undefined;

    const conn = requestedConnId
      ? getOwnedConnectionInternal(u.uid, requestedConnId)
      : getDefaultOwnedConnectionInternal(u.uid, requestedProviderId);

    if (!conn || conn.uid !== u.uid) {
      res.status(404).json({
        error: 'No tenés una conexión personal verificada seleccionada para este proveedor.',
        code: 'PERSONAL_CONNECTION_MISSING',
        requiresUserSwitchApproval: true,
      });
      return;
    }

    if (conn.status !== 'connected' || conn.lastTestStatus !== 'verified') {
      res.status(400).json({
        error: `La conexión "${conn.label}" no está verificada o fue desconectada. Probalo en FABRO CONNECT o autorizá cambiar a FABRO IA.`,
        code: 'PERSONAL_CONNECTION_NOT_VERIFIED',
        requiresUserSwitchApproval: true,
      });
      return;
    }

    if (conn.authMethod === 'oauth_pkce' && conn.oauthPlanScope === 'identity_only') {
      res.status(400).json({
        error:
          'Tu conexión "Sign in with ChatGPT" solo tiene alcance de identidad (OIDC) y no incluye uso directo de tokens del plan. Agregá tu API Key personal de OpenAI (BYOK) o autorizá cambiar a FABRO IA.',
        code: 'OAUTH_IDENTITY_ONLY',
        requiresUserSwitchApproval: true,
      });
      return;
    }

    const limitCheck = checkPersonalConnectionLimit(u.uid, conn);
    if (!limitCheck.allowed) {
      await recordPersonalUsage({
        uid: u.uid,
        connectionId: conn.id,
        connectionLabel: conn.label,
        providerId: conn.providerId,
        modelId: conn.selectedModel,
        authMethod: conn.authMethod,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        status: 'blocked',
        errorMessage: limitCheck.message,
        latencyMs: 0,
      });
      res.status(429).json({
        error: limitCheck.message,
        code: 'PERSONAL_LIMIT_REACHED',
        requiresUserSwitchApproval: true,
      });
      return;
    }

    const decryptedSecret = decryptSecret(conn.encryptedSecret);
    try {
      const result = await callProviderWithPersonalSecret({
        providerId: conn.providerId,
        endpointUrl: conn.endpointUrl,
        model: (typeof body.modelOverride === 'string' && body.modelOverride.trim()) || conn.selectedModel,
        personalSecret: decryptedSecret,
        prompt,
        systemInstruction: typeof body.systemInstruction === 'string' ? body.systemInstruction : undefined,
        history: Array.isArray(body.history) ? body.history : [],
        maxTokens: typeof body.maxOutputTokens === 'number' ? body.maxOutputTokens : 4096,
      });

      await recordPersonalUsage({
        uid: u.uid,
        connectionId: conn.id,
        connectionLabel: conn.label,
        providerId: conn.providerId,
        modelId: result.modelUsed,
        authMethod: conn.authMethod,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        status: 'success',
        latencyMs: result.latencyMs,
      });

      res.json({
        text: result.text,
        connectionId: conn.id,
        connectionLabel: conn.label,
        providerId: conn.providerId,
        providerName: conn.providerName,
        modelUsed: result.modelUsed,
        authMethod: conn.authMethod,
        billingOwner: 'personal',
        fabroQuotaConsumed: false,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        latencyMs: result.latencyMs,
      });
    } catch (err) {
      const safeErr = sanitizeSecretFromText(
        err instanceof Error ? err.message : 'Error ejecutando la consulta con tu proveedor personal.',
        decryptedSecret
      );
      await recordPersonalUsage({
        uid: u.uid,
        connectionId: conn.id,
        connectionLabel: conn.label,
        providerId: conn.providerId,
        modelId: conn.selectedModel,
        authMethod: conn.authMethod,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        status: 'error',
        errorMessage: safeErr,
        latencyMs: 0,
      });
      // NEVER silently fall back to admin API key! Ask user approval explicitly.
      res.status(502).json({
        error: `Tu conexión personal "${conn.label}" falló: ${safeErr}`,
        code: 'PERSONAL_PROVIDER_FAILED',
        requiresUserSwitchApproval: true,
      });
    }
  });

  // Protected: Compare multiple connected personal AIs side-by-side (zero FABRO quota consumed)
  router.post('/compare', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const u = req.authUser!;
    const body = req.body ?? {};
    const prompt = String(body.prompt || '').trim().slice(0, 30000);
    const connectionIds: string[] = Array.isArray(body.connectionIds)
      ? body.connectionIds.map((id: unknown) => String(id).trim()).filter(Boolean).slice(0, 4)
      : [];

    if (!prompt || connectionIds.length === 0) {
      res.status(400).json({ error: 'Escribí una consulta y elegí al menos una IA personal conectada.' });
      return;
    }

    const results = await Promise.all(
      connectionIds.map(async (cid) => {
        const conn = getOwnedConnectionInternal(u.uid, cid);
        if (!conn || conn.uid !== u.uid || conn.status !== 'connected' || conn.lastTestStatus !== 'verified') {
          return {
            connectionId: cid,
            label: conn?.label || 'Conexión no disponible',
            providerId: conn?.providerId || 'openai',
            modelUsed: conn?.selectedModel || '',
            status: 'error' as const,
            text: '',
            error: 'Conexión no verificada o no autorizada.',
            latencyMs: 0,
            inputTokens: 0,
            outputTokens: 0,
          };
        }
        const limitCheck = checkPersonalConnectionLimit(u.uid, conn);
        if (!limitCheck.allowed) {
          return {
            connectionId: cid,
            label: conn.label,
            providerId: conn.providerId,
            modelUsed: conn.selectedModel,
            status: 'error' as const,
            text: '',
            error: limitCheck.message || 'Límite personal alcanzado.',
            latencyMs: 0,
            inputTokens: 0,
            outputTokens: 0,
          };
        }
        const secret = decryptSecret(conn.encryptedSecret);
        try {
          const out = await callProviderWithPersonalSecret({
            providerId: conn.providerId,
            endpointUrl: conn.endpointUrl,
            model: conn.selectedModel,
            personalSecret: secret,
            prompt,
            systemInstruction: typeof body.systemInstruction === 'string' ? body.systemInstruction : undefined,
            maxTokens: 2048,
          });
          await recordPersonalUsage({
            uid: u.uid,
            connectionId: conn.id,
            connectionLabel: conn.label,
            providerId: conn.providerId,
            modelId: out.modelUsed,
            authMethod: conn.authMethod,
            inputTokens: out.inputTokens,
            outputTokens: out.outputTokens,
            estimatedCostUsd: out.estimatedCostUsd,
            status: 'success',
            latencyMs: out.latencyMs,
          });
          return {
            connectionId: cid,
            label: conn.label,
            providerId: conn.providerId,
            modelUsed: out.modelUsed,
            status: 'ok' as const,
            text: out.text,
            error: '',
            latencyMs: out.latencyMs,
            inputTokens: out.inputTokens,
            outputTokens: out.outputTokens,
          };
        } catch (err) {
          const safeErr = sanitizeSecretFromText(err instanceof Error ? err.message : 'Error del proveedor', secret);
          await recordPersonalUsage({
            uid: u.uid,
            connectionId: conn.id,
            connectionLabel: conn.label,
            providerId: conn.providerId,
            modelId: conn.selectedModel,
            authMethod: conn.authMethod,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
            status: 'error',
            errorMessage: safeErr,
            latencyMs: 0,
          });
          return {
            connectionId: cid,
            label: conn.label,
            providerId: conn.providerId,
            modelUsed: conn.selectedModel,
            status: 'error' as const,
            text: '',
            error: safeErr,
            latencyMs: 0,
            inputTokens: 0,
            outputTokens: 0,
          };
        }
      })
    );

    res.json({ prompt, billingOwner: 'personal', fabroQuotaConsumed: false, results });
  });

  return router;
}
